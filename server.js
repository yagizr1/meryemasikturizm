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
const TRIPS_FILE = path.join(DATA, 'trips.json');
const GROUPS_FILE = path.join(DATA, 'groups.json');
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
if (!fs.existsSync(TRIPS_FILE)) fs.writeFileSync(TRIPS_FILE, '[]\n');
if (!fs.existsSync(GROUPS_FILE)) fs.writeFileSync(GROUPS_FILE, '[]\n');

function cleanTrip(body, existing) {
  const tour = String(body.tour || '').trim().slice(0, 160);
  const start = String(body.start || '').trim();
  const end = String(body.end || '').trim() || start;
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!tour) return { error: 'Tur adı gerekli.' };
  if (!dateRe.test(start) || !dateRe.test(end) || Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end))) {
    return { error: 'Gidiş ve dönüş tarihini seçin.' };
  }
  if (end < start) return { error: 'Dönüş, gidişten önce olamaz.' };
  const capacity = Math.max(0, Math.min(999, Math.round(Number(body.capacity) || 0)));
  let filled = Math.max(0, Math.min(999, Math.round(Number(body.filled) || 0)));
  if (capacity > 0) filled = Math.min(filled, capacity);
  return {
    trip: {
      id: existing ? existing.id : crypto.randomBytes(8).toString('hex'),
      tour,
      start,
      end,
      capacity,
      filled,
      note: String(body.note || '').trim().slice(0, 500),
      updatedAt: new Date().toISOString()
    }
  };
}

function cleanMember(body) {
  const name = String(body && body.name || '').trim().slice(0, 80);
  const phone = String(body && body.phone || '').trim().slice(0, 30);
  if (!name || !phone.replace(/\D/g, '')) return null;
  const id = String(body.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 40) || crypto.randomBytes(6).toString('hex');
  return {
    id,
    name,
    phone,
    leadId: String(body.leadId || '').replace(/[^a-z0-9]/gi, '').slice(0, 40)
  };
}

function cleanGroup(body, existing) {
  const name = String(body.name || '').trim().slice(0, 120);
  if (!name) return { error: 'Grup adı gerekli.' };
  const start = String(body.start || '').trim();
  const end = String(body.end || '').trim();
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (start && !dateRe.test(start)) return { error: 'Gidiş tarihini seçin.' };
  if (end && !dateRe.test(end)) return { error: 'Dönüş tarihini seçin.' };
  if (start && end && end < start) return { error: 'Dönüş, gidişten önce olamaz.' };
  const invite = String(body.invite || '').trim().slice(0, 300);
  if (invite && !/^https:\/\/(chat\.whatsapp\.com|wa\.me)\//i.test(invite)) {
    return { error: 'Grup linki https://chat.whatsapp.com/ ile başlamalı.' };
  }
  const seen = new Set();
  const members = [];
  (Array.isArray(body.members) ? body.members : []).forEach((item) => {
    const member = cleanMember(item);
    if (!member) return;
    const key = member.phone.replace(/\D/g, '');
    if (seen.has(key)) return;
    seen.add(key);
    members.push(member);
  });
  return {
    group: {
      id: existing ? existing.id : crypto.randomBytes(8).toString('hex'),
      name,
      tour: String(body.tour || '').trim().slice(0, 160),
      start,
      end,
      note: String(body.note || '').trim().slice(0, 500),
      message: String(body.message || '').trim().slice(0, 1000),
      invite,
      members: members.slice(0, 200),
      updatedAt: new Date().toISOString()
    }
  };
}

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return now.getFullYear() + '-' + month + '-' + day;
}

function sameTourName(a, b) {
  return String(a || '').trim().toLocaleLowerCase('tr') === String(b || '').trim().toLocaleLowerCase('tr');
}

function publicTrip(trip) {
  const capacity = Number(trip.capacity) || 0;
  const filled = Number(trip.filled) || 0;
  const full = capacity > 0 && filled >= capacity;
  return {
    id: trip.id,
    tour: trip.tour,
    start: trip.start,
    end: trip.end || trip.start,
    capacity,
    filled,
    remaining: capacity > 0 ? Math.max(0, capacity - filled) : null,
    full
  };
}

function applySeatChange(lead, status, requestedTripId) {
  const allowed = ['bekliyor', 'arandi', 'kayit'];
  const nextStatus = allowed.includes(status) ? status : (lead.status || 'bekliyor');
  const trips = readJson(TRIPS_FILE, []);
  const prevId = lead.status === 'kayit' ? (lead.tripId || '') : '';
  let nextId = nextStatus === 'kayit' ? String(requestedTripId || '') : '';
  const today = todayIso();
  if (nextStatus === 'kayit' && !nextId) {
    const open = trips
      .filter((trip) => sameTourName(trip.tour, lead.tour) && (trip.end || trip.start) >= today)
      .filter((trip) => !(Number(trip.capacity) > 0 && Number(trip.filled) >= Number(trip.capacity)))
      .sort((a, b) => String(a.start).localeCompare(String(b.start)));
    if (!open.length) return { error: 'Bu tur için açık çıkış yok. Önce takvime tarih ekleyin.' };
    nextId = open[0].id;
  }
  if (nextStatus === 'kayit') {
    const target = trips.find((trip) => trip.id === nextId);
    if (!target) return { error: 'Çıkış bulunamadı.' };
    if (prevId !== nextId && Number(target.capacity) > 0 && Number(target.filled) >= Number(target.capacity)) {
      return { error: 'Bu çıkış dolu.' };
    }
  }
  if (prevId && prevId !== nextId) {
    const prev = trips.find((trip) => trip.id === prevId);
    if (prev) prev.filled = Math.max(0, (Number(prev.filled) || 0) - 1);
  }
  if (nextId && nextId !== prevId) {
    const next = trips.find((trip) => trip.id === nextId);
    if (next) {
      next.filled = (Number(next.filled) || 0) + 1;
      if (Number(next.capacity) > 0) next.filled = Math.min(next.filled, Number(next.capacity));
    }
  }
  writeJson(TRIPS_FILE, trips);
  lead.status = nextStatus;
  lead.tripId = nextId;
  return { lead };
}

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
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
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
        status: 'bekliyor',
        tripId: '',
        createdAt: new Date().toISOString()
      };
      leads.push(lead);
      writeJson(LEADS_FILE, leads);
      send(res, 201, { ok: true, id: lead.id });
      return;
    }

    if (pathname.startsWith('/api/leads/') && req.method === 'PATCH') {
      if (!requireAuth(req, res)) return;
      const id = decodeURIComponent(pathname.slice('/api/leads/'.length));
      const leads = readJson(LEADS_FILE, []);
      const lead = leads.find((item) => item.id === id);
      if (!lead) {
        send(res, 404, { error: 'Kayıt bulunamadı.' });
        return;
      }
      const body = JSON.parse((await readBody(req, 1024 * 16)).toString() || '{}');
      const result = applySeatChange(lead, body.status, body.tripId);
      if (result.error) {
        send(res, 400, { error: result.error });
        return;
      }
      writeJson(LEADS_FILE, leads);
      send(res, 200, lead);
      return;
    }

    if (pathname.startsWith('/api/leads/') && req.method === 'DELETE') {
      if (!requireAuth(req, res)) return;
      const id = decodeURIComponent(pathname.slice('/api/leads/'.length));
      const leads = readJson(LEADS_FILE, []);
      const lead = leads.find((item) => item.id === id);
      if (lead && lead.status === 'kayit' && lead.tripId) applySeatChange(lead, 'bekliyor', '');
      writeJson(LEADS_FILE, leads.filter((item) => item.id !== id));
      send(res, 200, { ok: true });
      return;
    }

    if (pathname === '/api/departures' && req.method === 'GET') {
      const today = todayIso();
      const trips = readJson(TRIPS_FILE, [])
        .filter((trip) => (trip.end || trip.start) >= today)
        .sort((a, b) => String(a.start).localeCompare(String(b.start)))
        .map(publicTrip);
      send(res, 200, trips);
      return;
    }

    if (pathname === '/api/trips' && req.method === 'GET') {
      if (!requireAuth(req, res)) return;
      const trips = readJson(TRIPS_FILE, []);
      trips.sort((a, b) => String(a.start).localeCompare(String(b.start)));
      send(res, 200, trips);
      return;
    }

    if (pathname === '/api/trips' && req.method === 'POST') {
      if (!requireAuth(req, res)) return;
      const body = JSON.parse((await readBody(req, 1024 * 32)).toString() || '{}');
      const cleaned = cleanTrip(body);
      if (cleaned.error) {
        send(res, 400, { error: cleaned.error });
        return;
      }
      const trips = readJson(TRIPS_FILE, []);
      trips.push(cleaned.trip);
      writeJson(TRIPS_FILE, trips);
      send(res, 201, cleaned.trip);
      return;
    }

    if (pathname.startsWith('/api/trips/') && (req.method === 'PUT' || req.method === 'DELETE')) {
      if (!requireAuth(req, res)) return;
      const id = decodeURIComponent(pathname.slice('/api/trips/'.length));
      const trips = readJson(TRIPS_FILE, []);
      const index = trips.findIndex((trip) => trip.id === id);
      if (index < 0) {
        send(res, 404, { error: 'Çıkış bulunamadı.' });
        return;
      }
      if (req.method === 'DELETE') {
        trips.splice(index, 1);
        writeJson(TRIPS_FILE, trips);
        send(res, 200, { ok: true });
        return;
      }
      const body = JSON.parse((await readBody(req, 1024 * 32)).toString() || '{}');
      const cleaned = cleanTrip(body, trips[index]);
      if (cleaned.error) {
        send(res, 400, { error: cleaned.error });
        return;
      }
      trips[index] = cleaned.trip;
      writeJson(TRIPS_FILE, trips);
      send(res, 200, cleaned.trip);
      return;
    }

    if (pathname === '/api/groups' && req.method === 'GET') {
      if (!requireAuth(req, res)) return;
      const groups = readJson(GROUPS_FILE, []);
      groups.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
      send(res, 200, groups);
      return;
    }

    if (pathname === '/api/groups' && req.method === 'POST') {
      if (!requireAuth(req, res)) return;
      const body = JSON.parse((await readBody(req, 1024 * 64)).toString() || '{}');
      const cleaned = cleanGroup(body);
      if (cleaned.error) {
        send(res, 400, { error: cleaned.error });
        return;
      }
      const groups = readJson(GROUPS_FILE, []);
      groups.push(cleaned.group);
      writeJson(GROUPS_FILE, groups);
      send(res, 201, cleaned.group);
      return;
    }

    if (pathname.startsWith('/api/groups/') && (req.method === 'PUT' || req.method === 'DELETE')) {
      if (!requireAuth(req, res)) return;
      const id = decodeURIComponent(pathname.slice('/api/groups/'.length));
      const groups = readJson(GROUPS_FILE, []);
      const index = groups.findIndex((group) => group.id === id);
      if (index < 0) {
        send(res, 404, { error: 'Grup bulunamadı.' });
        return;
      }
      if (req.method === 'DELETE') {
        groups.splice(index, 1);
        writeJson(GROUPS_FILE, groups);
        send(res, 200, { ok: true });
        return;
      }
      const body = JSON.parse((await readBody(req, 1024 * 64)).toString() || '{}');
      const cleaned = cleanGroup(body, groups[index]);
      if (cleaned.error) {
        send(res, 400, { error: cleaned.error });
        return;
      }
      groups[index] = cleaned.group;
      writeJson(GROUPS_FILE, groups);
      send(res, 200, cleaned.group);
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
    if (pathname === '/turlar' || pathname === '/turlar/') {
      redirect(res, '/anasayfa#turlar');
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
