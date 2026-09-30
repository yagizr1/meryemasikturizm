const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = 8787;
const DATA = path.join(ROOT, 'data');
const UPLOADS = path.join(ROOT, 'uploads');
const AUTH_FILE = path.join(DATA, 'auth.json');
const CONTENT_FILE = path.join(DATA, 'site.json');
const LEADS_FILE = path.join(DATA, 'leads.json');
const SESSION_FILE = path.join(DATA, 'sessions.json');

fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

if (!fs.existsSync(AUTH_FILE)) {
  fs.writeFileSync(AUTH_FILE, JSON.stringify({
    username: 'admin',
    passwordHash: hashPassword('admin123')
  }, null, 2));
}

if (!fs.existsSync(LEADS_FILE)) fs.writeFileSync(LEADS_FILE, '[]\n');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return fallback;
  }
}

function writeJson(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

const sessions = new Set(readJson(SESSION_FILE, []));

function saveSessions() {
  writeJson(SESSION_FILE, [...sessions]);
}

function send(res, status, body, type) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store'
  });
  res.end(payload);
}

function tokenOf(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

function requireAuth(req, res) {
  if (!sessions.has(tokenOf(req))) {
    send(res, 401, { error: 'Oturum geçersiz. Tekrar giriş yapın.' });
    return false;
  }
  return true;
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('Dosya çok büyük.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ico': 'image/x-icon'
};

function redirect(res, location) {
  res.writeHead(302, {
    Location: location,
    'Cache-Control': 'no-store'
  });
  res.end();
}

function serveStatic(req, res, urlPath) {
  const root = path.resolve(ROOT);
  let filePath = path.resolve(root, '.' + decodeURIComponent(urlPath));
  if (!filePath.toLowerCase().startsWith(root.toLowerCase())) {
    send(res, 403, { error: 'Yasak' });
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    send(res, 404, { error: 'Bulunamadı' });
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache'
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    send(res, 204, '');
    return;
  }

  const url = new URL(req.url, 'http://127.0.0.1');
  const pathname = url.pathname;

  try {
    if (pathname === '/api/login' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req, 1024 * 64)).toString() || '{}');
      const auth = readJson(AUTH_FILE, {});
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      if (username !== auth.username || hashPassword(password) !== auth.passwordHash) {
        send(res, 401, { error: 'Kullanıcı adı veya şifre hatalı.' });
        return;
      }
      const token = crypto.randomBytes(24).toString('hex');
      sessions.add(token);
      saveSessions();
      send(res, 200, { token, username });
      return;
    }

    if (pathname === '/api/content' && req.method === 'GET') {
      send(res, 200, readJson(CONTENT_FILE, {}));
      return;
    }

    if (pathname === '/api/content' && req.method === 'PUT') {
      if (!requireAuth(req, res)) return;
      const body = JSON.parse((await readBody(req, 1024 * 1024 * 2)).toString() || '{}');
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        send(res, 400, { error: 'İçerik kaydedilemedi.' });
        return;
      }
      writeJson(CONTENT_FILE, body);
      send(res, 200, { ok: true });
      return;
    }

    if (pathname === '/api/password' && req.method === 'POST') {
      if (!requireAuth(req, res)) return;
      const body = JSON.parse((await readBody(req, 1024 * 32)).toString() || '{}');
      const auth = readJson(AUTH_FILE, {});
      if (hashPassword(body.current || '') !== auth.passwordHash) {
        send(res, 400, { error: 'Mevcut şifre hatalı.' });
        return;
      }
      const next = String(body.next || '');
      if (next.length < 4) {
        send(res, 400, { error: 'Yeni şifre en az 4 karakter olsun.' });
        return;
      }
      auth.passwordHash = hashPassword(next);
      writeJson(AUTH_FILE, auth);
      send(res, 200, { ok: true });
      return;
    }

    if (pathname === '/api/leads' && req.method === 'GET') {
      if (!requireAuth(req, res)) return;
      const leads = readJson(LEADS_FILE, []);
      send(res, 200, leads.slice().reverse());
      return;
    }

    if (pathname === '/api/leads' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req, 1024 * 64)).toString() || '{}');
      const name = String(body.name || '').trim().slice(0, 120);
      const phone = String(body.phone || '').trim().slice(0, 40);
      if (!name || !phone) {
        send(res, 400, { error: 'Ad soyad ve telefon gerekli.' });
        return;
      }
      const leads = readJson(LEADS_FILE, []);
      const lead = {
        id: crypto.randomBytes(8).toString('hex'),
        name,
        phone,
        tour: String(body.tour || '').trim().slice(0, 160),
        message: String(body.message || '').trim().slice(0, 2000),
        source: String(body.source || 'Form').trim().slice(0, 80),
        createdAt: new Date().toISOString()
      };
      leads.push(lead);
      writeJson(LEADS_FILE, leads);
      send(res, 201, { ok: true, id: lead.id });
      return;
    }

    if (pathname.startsWith('/api/leads/') && req.method === 'DELETE') {
      if (!requireAuth(req, res)) return;
      const id = decodeURIComponent(pathname.slice('/api/leads/'.length));
      const leads = readJson(LEADS_FILE, []).filter((lead) => lead.id !== id);
      writeJson(LEADS_FILE, leads);
      send(res, 200, { ok: true });
      return;
    }

    if (pathname === '/api/upload' && req.method === 'POST') {
      if (!requireAuth(req, res)) return;
      const body = JSON.parse((await readBody(req, 1024 * 1024 * 8)).toString() || '{}');
      const original = String(body.name || 'dosya');
      const ext = path.extname(original).toLowerCase();
      const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.webm'];
      if (!allowed.includes(ext)) {
        send(res, 400, { error: 'Bu dosya türü kabul edilmiyor. JPG, PNG, WEBP, GIF veya MP4 yükleyin.' });
        return;
      }
      const raw = String(body.data || '');
      const base64 = raw.includes(',') ? raw.split(',').pop() : raw;
      const buffer = Buffer.from(base64, 'base64');
      if (!buffer.length || buffer.length > 1024 * 1024 * 6) {
        send(res, 400, { error: 'Dosya boş veya 6 MB sınırını aşıyor.' });
        return;
      }
      const filename = Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex') + ext;
      fs.writeFileSync(path.join(UPLOADS, filename), buffer);
      send(res, 200, { path: 'uploads/' + filename });
      return;
    }

    if (pathname.startsWith('/api/')) {
      send(res, 404, { error: 'Bulunamadı' });
      return;
    }

    if (pathname === '/' || pathname === '/index.html') {
      redirect(res, '/anasayfa' + url.search);
      return;
    }
    if (pathname === '/anasayfa/' || pathname === '/admin/') {
      redirect(res, pathname.slice(0, -1) + url.search);
      return;
    }
    if (pathname === '/anasayfa' || pathname === '/admin') {
      serveStatic(req, res, '/index.html');
      return;
    }

    serveStatic(req, res, pathname);
  } catch (err) {
    send(res, 500, { error: err.message || 'Sunucu hatası' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Site: http://127.0.0.1:' + PORT + '/anasayfa');
  console.log('Admin panel: http://127.0.0.1:' + PORT + '/admin');
  console.log('Giris: admin / admin123');
});
