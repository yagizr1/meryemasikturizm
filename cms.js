(function () {
  const API = (location.port === '8787') ? '' : 'http://127.0.0.1:8787';
  const TOKEN_KEY = 'mt-admin-token';
  let draft = null;
  let dirty = false;

  function getPath(obj, path) {
    return String(path).split('.').reduce((current, key) => (current == null ? current : current[key]), obj);
  }

  function setPath(obj, path, value) {
    const keys = String(path).split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const nextKey = keys[i + 1];
      if (current[keys[i]] == null) current[keys[i]] = /^\d+$/.test(nextKey) ? [] : {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function stars(count) {
    const total = Math.max(0, Math.min(5, Number(count) || 0));
    let html = '';
    for (let i = 0; i < total; i++) html += '<i class="fa-solid fa-star"></i>';
    return html;
  }

  function safeIcon(icon) {
    return /^fa-[a-z0-9-]+$/i.test(icon || '') ? icon : 'fa-star';
  }

  function fillLinks(selector, links) {
    if (!Array.isArray(links)) return;
    let nodes = [...document.querySelectorAll(selector)];
    if (!nodes.length) return;
    const sample = nodes[0];
    const inList = sample.parentElement.tagName === 'LI';
    const host = inList ? sample.parentElement.parentElement : sample.parentElement;
    while (nodes.length < links.length) {
      const clone = (inList ? sample.parentElement : sample).cloneNode(true);
      const anchor = inList ? clone.querySelector('a') : clone;
      const divider = host.querySelector('.pt-4');
      if (!inList && divider) host.insertBefore(clone, divider);
      else host.appendChild(clone);
      nodes.push(anchor);
    }
    while (nodes.length > links.length) {
      const extra = nodes.pop();
      (extra.parentElement.tagName === 'LI' ? extra.parentElement : extra).remove();
    }
    nodes.forEach((node, index) => {
      const label = node.querySelector('.mobile-link-label');
      if (label) label.textContent = links[index].label || '';
      else node.textContent = links[index].label || '';
      node.setAttribute('href', links[index].href || '#');
    });
  }

  function renderTours(tours) {
    const grid = document.getElementById('tour-grid');
    if (!grid || !Array.isArray(tours)) return;
    grid.innerHTML = tours.map((tour) => {
      const badgeClass = tour.badgeTone === 'green'
        ? 'absolute top-4 right-4 bg-emeraldBrand text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-md uppercase tracking-wider'
        : 'absolute top-4 right-4 gold-gradient text-emeraldBrand-dark text-xs font-bold px-3 py-1.5 rounded-full shadow-md uppercase tracking-wider';
      return `
        <div class="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 hover:shadow-2xl transition-all duration-300 flex flex-col justify-between group">
          <div>
            <div class="relative h-60 overflow-hidden">
              <img src="${esc(tour.image)}" alt="${esc(tour.imageAlt || tour.title)}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
              <div class="${badgeClass}">${esc(tour.badge)}</div>
              <div class="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md text-white text-xs px-3 py-1 rounded-lg">
                <i class="fa-solid fa-clock mr-1 text-goldBrand"></i> ${esc(tour.duration)}
              </div>
            </div>
            <div class="p-6">
              <span class="text-xs uppercase font-bold tracking-wider text-emeraldBrand">${esc(tour.location)}</span>
              <h3 class="text-2xl font-serif font-bold text-gray-900 mt-1">${esc(tour.title)}</h3>
              <p class="text-gray-600 text-sm mt-2 leading-relaxed">${esc(tour.description)}</p>
              <div class="mt-6 space-y-2 border-t border-gray-100 pt-4 text-sm text-gray-600">
                <div class="flex items-center justify-between"><span class="flex items-center"><i class="fa-solid fa-plane-departure text-emeraldBrand mr-2 w-5"></i> Uçuş:</span><span class="font-semibold text-gray-800">${esc(tour.flight)}</span></div>
                <div class="flex items-center justify-between"><span class="flex items-center"><i class="fa-solid fa-hotel text-emeraldBrand mr-2 w-5"></i> Konaklama:</span><span class="font-semibold text-gray-800">${esc(tour.hotel)}</span></div>
                <div class="flex items-center justify-between"><span class="flex items-center"><i class="fa-solid fa-utensils text-emeraldBrand mr-2 w-5"></i> Yemek:</span><span class="font-semibold text-gray-800">${esc(tour.meal)}</span></div>
              </div>
            </div>
          </div>
          <div class="p-6 pt-0 flex flex-wrap items-center justify-between gap-3 border-t border-gray-50 mt-4">
            <div>
              <span class="text-xs text-gray-400 block">Kişi başı başlayan</span>
              <span class="text-2xl font-bold text-emeraldBrand font-serif">${esc(tour.price)}</span>
            </div>
            <button type="button" class="js-register bg-emeraldBrand hover:bg-emeraldBrand-dark text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow-md transition-colors" data-tour="${esc(tour.title)}">Kayıt Ol / Bilgi Al</button>
          </div>
        </div>`;
    }).join('');
  }

  function renderHotels(hotels) {
    const grid = document.getElementById('hotel-grid');
    if (!grid || !Array.isArray(hotels)) return;
    grid.innerHTML = hotels.map((hotel) => `
      <div class="bg-white rounded-3xl overflow-hidden shadow-lg border border-gray-100 group">
        <div class="h-56 overflow-hidden relative">
          <img src="${esc(hotel.image)}" alt="${esc(hotel.imageAlt || hotel.title)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
          <div class="absolute bottom-3 left-3 bg-emeraldBrand text-white text-xs px-3 py-1 rounded-lg font-semibold">
            <i class="fa-solid fa-location-dot text-goldBrand mr-1"></i> ${esc(hotel.city)}
          </div>
        </div>
        <div class="p-6">
          <div class="flex items-center text-goldBrand text-sm mb-2">${stars(hotel.stars)}</div>
          <h3 class="text-xl font-serif font-bold text-gray-900">${esc(hotel.title)}</h3>
          <p class="text-gray-600 text-sm mt-2">${esc(hotel.description)}</p>
        </div>
      </div>`).join('');
  }

  function renderReasons(reasons) {
    const grid = document.getElementById('reason-grid');
    if (!grid || !Array.isArray(reasons)) return;
    grid.innerHTML = reasons.map((reason) => `
      <div class="bg-emeraldBrand/40 border border-goldBrand/20 p-8 rounded-3xl backdrop-blur-md hover:border-goldBrand transition-all group">
        <div class="w-14 h-14 rounded-2xl gold-gradient flex items-center justify-center text-emeraldBrand-dark text-2xl mb-6 group-hover:scale-110 transition-transform">
          <i class="fa-solid ${safeIcon(reason.icon)}"></i>
        </div>
        <h3 class="text-xl font-serif font-bold text-white mb-2">${esc(reason.title)}</h3>
        <p class="text-gray-300 text-sm leading-relaxed">${esc(reason.text)}</p>
      </div>`).join('');
  }

  function renderGallery(items) {
    const grid = document.getElementById('gallery-grid');
    if (!grid || !Array.isArray(items)) return;
    grid.innerHTML = items.map((item) => `
      <button type="button" class="js-gallery group rounded-3xl overflow-hidden shadow-lg border border-gray-100 bg-white focus:outline-none focus:ring-2 focus:ring-goldBrand" data-src="${esc(item.src)}" data-caption="${esc(item.caption)}">
        <img src="${esc(item.src)}" alt="${esc(item.caption)}" class="w-full h-auto object-contain group-hover:scale-105 transition-transform duration-500">
      </button>`).join('');
  }

  function renderFaqs(faqs) {
    const list = document.getElementById('faq-list');
    if (!list || !Array.isArray(faqs)) return;
    list.innerHTML = faqs.map((faq) => `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all">
        <button type="button" class="js-faq w-full px-6 py-5 text-left font-semibold text-gray-900 flex items-center justify-between focus:outline-none">
          <span class="text-base sm:text-lg flex items-center">
            <i class="fa-solid fa-circle-question text-goldBrand mr-3 text-xl"></i>
            ${esc(faq.question)}
          </span>
          <i class="js-faq-icon fa-solid fa-chevron-down text-emeraldBrand transition-transform duration-300"></i>
        </button>
        <div class="js-faq-body hidden px-6 pb-5 text-gray-600 text-sm sm:text-base leading-relaxed border-t border-gray-100 pt-4">${esc(faq.answer)}</div>
      </div>`).join('');
  }

  function renderReviews(reviews) {
    const grid = document.getElementById('review-grid');
    if (!grid || !Array.isArray(reviews)) return;
    grid.innerHTML = reviews.map((review) => `
      <div class="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 flex flex-col justify-between relative">
        <div class="absolute top-6 right-6 text-gray-200 text-3xl"><i class="fa-solid fa-quote-right"></i></div>
        <div>
          <div class="flex items-center space-x-1 text-goldBrand text-sm mb-4">${stars(review.stars)}</div>
          <p class="text-gray-700 text-sm leading-relaxed italic mb-6">"${esc(review.text)}"</p>
        </div>
        <div class="flex items-center space-x-3 pt-4 border-t border-gray-100">
          <div class="w-10 h-10 rounded-full bg-emeraldBrand text-white font-serif font-bold flex items-center justify-center text-sm">${esc(review.initials)}</div>
          <div>
            <h4 class="font-bold text-gray-900 text-sm">${esc(review.name)}</h4>
            <span class="text-xs text-gray-400">${esc(review.meta)}</span>
          </div>
        </div>
      </div>`).join('');
  }

  function renderTourOptions(data) {
    const select = document.getElementById('form-tour');
    if (!select || !data) return;
    const names = []
      .concat((data.tours || []).map((tour) => tour.title).filter(Boolean))
      .concat(data.contact && data.contact.extraTours || []);
    if (!names.length) return;
    const current = select.value;
    select.innerHTML = names.map((name) => `<option>${esc(name)}</option>`).join('');
    if (names.includes(current)) select.value = current;
  }

  function applyContent(data) {
    if (!data) return;
    document.querySelectorAll('[data-cms]').forEach((el) => {
      const value = getPath(data, el.getAttribute('data-cms'));
      if (value == null) return;
      el.textContent = value;
    });
    document.querySelectorAll('[data-cms-href]').forEach((el) => {
      const value = getPath(data, el.getAttribute('data-cms-href'));
      if (value == null || value === '') return;
      el.setAttribute('href', value);
    });
    document.querySelectorAll('[data-cms-href="social.whatsapp"]').forEach((el) => {
      if (el.getAttribute('href') && el.getAttribute('href') !== '#') return;
      const digits = String(data.brand && data.brand.whatsappDigits || '').replace(/\D/g, '');
      if (digits) el.setAttribute('href', 'https://wa.me/' + digits);
    });
    document.querySelectorAll('[data-cms-src]').forEach((el) => {
      const value = getPath(data, el.getAttribute('data-cms-src'));
      if (!value || el.getAttribute('src') === value) return;
      el.setAttribute('src', value);
      if (el.tagName === 'SOURCE' && el.parentElement && typeof el.parentElement.load === 'function') {
        el.parentElement.load();
      }
    });
    document.querySelectorAll('[data-cms-tel]').forEach((el) => {
      const digits = String(data.brand && data.brand.phoneDigits || '').replace(/\D/g, '');
      if (digits) el.setAttribute('href', 'tel:+' + digits);
    });
    document.querySelectorAll('[data-cms-wa]').forEach((el) => {
      const digits = String(data.brand && data.brand.whatsappDigits || '').replace(/\D/g, '');
      if (digits) el.setAttribute('href', 'https://wa.me/' + digits);
    });
    document.querySelectorAll('[data-cms-mail]').forEach((el) => {
      const email = data.brand && data.brand.email;
      if (!email) return;
      el.textContent = email;
      el.setAttribute('href', 'mailto:' + email);
    });
    if (data.hero && data.hero.bgImage) {
      const hero = document.getElementById('anasayfa');
      const image = String(data.hero.bgImage).replace(/'/g, '%27');
      hero.style.background = "linear-gradient(rgba(8, 28, 21, 0.75), rgba(27, 67, 50, 0.85)), url('" + image + "') center/cover no-repeat";
    }
    if (data.meta && data.meta.title) document.title = data.meta.title;
    fillLinks('#desktop-nav a', data.nav);
    fillLinks('#mobile-menu .mobile-link', data.nav);
    fillLinks('#footer-links a', data.nav);
    if (data.footer) {
      fillLinks('#footer-tours a', data.footer.tours);
      fillLinks('#footer-legal a', data.footer.links);
    }
    renderTours(data.tours);
    renderHotels(data.hotels);
    renderReasons(data.reasons);
    renderGallery(data.gallery);
    renderFaqs(data.faqs);
    renderReviews(data.reviews);
    renderTourOptions(data);
    if (typeof window.mountPhoneSliders === 'function') window.mountPhoneSliders();
  }

  async function loadContent() {
    const response = await fetch(API + '/api/content', { cache: 'no-store' });
    if (!response.ok) throw new Error('İçerik alınamadı');
    return response.json();
  }

  window.saveLead = function (lead) {
    return fetch(API + '/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead)
    }).catch(() => null);
  };

  document.addEventListener('click', (event) => {
    const register = event.target.closest('.js-register');
    if (register && typeof openModal === 'function') {
      openModal(register.getAttribute('data-tour') || '');
      return;
    }
    const gallery = event.target.closest('.js-gallery');
    if (gallery && typeof openGallery === 'function') {
      openGallery(gallery.getAttribute('data-src') || '', gallery.getAttribute('data-caption') || '');
      return;
    }
    const faq = event.target.closest('.js-faq');
    if (faq) {
      const card = faq.parentElement;
      const body = card && card.querySelector('.js-faq-body');
      const icon = faq.querySelector('.js-faq-icon');
      if (body) body.classList.toggle('hidden');
      if (icon) icon.classList.toggle('rotate-180');
    }
  });

  const TABS = [
    { id: 'genel', label: 'Genel' },
    { id: 'anasayfa', label: 'Anasayfa' },
    { id: 'hakkimizda', label: 'Hakkımızda' },
    { id: 'turlar', label: 'Turlar' },
    { id: 'oteller', label: 'Oteller' },
    { id: 'neden', label: 'Neden Biz' },
    { id: 'galeri', label: 'Galeri' },
    { id: 'sss', label: 'SSS' },
    { id: 'yorumlar', label: 'Yorumlar' },
    { id: 'iletisim', label: 'İletişim' },
    { id: 'kayitlar', label: 'Kayıtlar' }
  ];

  const FIELD_TABS = {
    genel: [
      { path: 'meta.title', label: 'Sekme başlığı', group: 'Marka' },
      { path: 'brand.name', label: 'Marka adı', group: 'Marka' },
      { path: 'brand.tagline', label: 'Marka alt yazısı', group: 'Marka' },
      { path: 'brand.phoneNav', label: 'Menüdeki telefon', group: 'İletişim' },
      { path: 'brand.phoneContact', label: 'İletişimdeki telefon', group: 'İletişim' },
      { path: 'brand.phoneDigits', label: 'Arama numarası (905...)', group: 'İletişim' },
      { path: 'brand.whatsappDigits', label: 'WhatsApp numarası (905...)', group: 'İletişim' },
      { path: 'brand.email', label: 'E-posta', group: 'İletişim' },
      { path: 'brand.address', label: 'Adres', type: 'textarea', group: 'İletişim' },
      { path: 'social.facebook', label: 'Facebook linki', group: 'Sosyal medya' },
      { path: 'social.instagram', label: 'Instagram linki', group: 'Sosyal medya' },
      { path: 'cta.desktop', label: 'Üst menü butonu', group: 'Butonlar' },
      { path: 'cta.mobile', label: 'Mobil menü butonu', group: 'Butonlar' },
      { path: 'cta.href', label: 'Kayıt butonu linki', group: 'Butonlar' },
      { path: 'brand.footerText', label: 'Footer tanıtım yazısı', type: 'textarea', group: 'Logolar' },
      { path: 'brand.logo', label: 'Footer logo', type: 'image', group: 'Logolar' },
      { path: 'brand.logo2', label: 'Footer ikinci logo', type: 'image', group: 'Logolar' }
    ],
    anasayfa: [
      { path: 'hero.bgImage', label: 'Arka plan fotoğrafı', type: 'image', group: 'Görsel' },
      { path: 'hero.titleBefore', label: 'Başlık başlangıcı', group: 'Başlık' },
      { path: 'hero.titleHighlight', label: 'Başlık vurgusu', group: 'Başlık' },
      { path: 'hero.titleAfter', label: 'Başlık devamı', group: 'Başlık' },
      { path: 'hero.subtitle', label: 'Alt metin', type: 'textarea', group: 'Başlık' },
      { path: 'hero.primaryText', label: 'Birinci buton', group: 'Butonlar' },
      { path: 'hero.primaryHref', label: 'Birinci buton linki', group: 'Butonlar' },
      { path: 'hero.secondaryText', label: 'WhatsApp butonu yazısı', group: 'Butonlar' },
      { path: 'hero.stat1Value', label: 'Sol istatistik', group: 'İstatistikler' },
      { path: 'hero.stat1Label', label: 'Sol istatistik açıklaması', group: 'İstatistikler' },
      { path: 'hero.stat2Value', label: 'Sağ istatistik', group: 'İstatistikler' },
      { path: 'hero.stat2Label', label: 'Sağ istatistik açıklaması', group: 'İstatistikler' },
      { path: 'hero.stat3Value', label: 'Alt sol istatistik', group: 'İstatistikler' },
      { path: 'hero.stat3Label', label: 'Alt sol açıklaması', group: 'İstatistikler' },
      { path: 'hero.stat4Value', label: 'Alt sağ istatistik', group: 'İstatistikler' },
      { path: 'hero.stat4Label', label: 'Alt sağ açıklaması', group: 'İstatistikler' }
    ],
    hakkimizda: [
      { path: 'about.title', label: 'Başlık' },
      { path: 'about.p1', label: 'Birinci paragraf', type: 'textarea' },
      { path: 'about.p2', label: 'İkinci paragraf', type: 'textarea' },
      { path: 'about.f1', label: 'Sol kutu' },
      { path: 'about.f2', label: 'Sağ kutu' },
      { path: 'about.video', label: 'Tanıtım videosu', type: 'image' }
    ],
    turlar: [
      { path: 'toursSection.title', label: 'Bölüm başlığı' },
      { path: 'toursSection.subtitle', label: 'Bölüm açıklaması', type: 'textarea' }
    ],
    oteller: [
      { path: 'hotelsSection.badge', label: 'Üst etiket' },
      { path: 'hotelsSection.title', label: 'Başlık' },
      { path: 'hotelsSection.subtitle', label: 'Açıklama', type: 'textarea' }
    ],
    neden: [
      { path: 'reasonsSection.badge', label: 'Üst etiket' },
      { path: 'reasonsSection.title', label: 'Başlık' },
      { path: 'reasonsSection.subtitle', label: 'Açıklama', type: 'textarea' }
    ],
    galeri: [
      { path: 'gallerySection.title', label: 'Başlık' },
      { path: 'gallerySection.subtitle', label: 'Açıklama', type: 'textarea' }
    ],
    sss: [
      { path: 'faqSection.badge', label: 'Üst etiket' },
      { path: 'faqSection.title', label: 'Başlık' },
      { path: 'faqSection.subtitle', label: 'Açıklama', type: 'textarea' }
    ],
    yorumlar: [
      { path: 'reviewsSection.badge', label: 'Üst etiket' },
      { path: 'reviewsSection.title', label: 'Başlık' },
      { path: 'reviewsSection.subtitle', label: 'Açıklama', type: 'textarea' },
      { path: 'reviewsSection.score', label: 'Puan' },
      { path: 'reviewsSection.count', label: 'Değerlendirme sayısı' }
    ],
    iletisim: [
      { path: 'contact.badge', label: 'Üst etiket', group: 'İletişim bölümü' },
      { path: 'contact.title', label: 'Başlık', group: 'İletişim bölümü' },
      { path: 'contact.subtitle', label: 'Açıklama', type: 'textarea', group: 'İletişim bölümü' },
      { path: 'contact.officeTitle', label: 'Adres başlığı', group: 'İletişim bölümü' },
      { path: 'contact.phoneTitle', label: 'Telefon başlığı', group: 'İletişim bölümü' },
      { path: 'contact.emailTitle', label: 'E-posta başlığı', group: 'İletişim bölümü' },
      { path: 'contact.formTitle', label: 'Form başlığı', group: 'İletişim bölümü' },
      { path: 'contact.extraTours', label: 'Formdaki ek turlar (her satıra bir tur)', type: 'lines', group: 'İletişim bölümü' },
      { path: 'social.facebook', label: 'Facebook linki', group: 'Sosyal ikonlar' },
      { path: 'social.instagram', label: 'Instagram linki', group: 'Sosyal ikonlar' },
      { path: 'social.whatsapp', label: 'WhatsApp linki', group: 'Sosyal ikonlar' },
      { path: 'footer.quickTitle', label: 'Footer menü başlığı', group: 'Footer' },
      { path: 'footer.toursTitle', label: 'Footer tur başlığı', group: 'Footer' },
      { path: 'footer.legalTitle', label: 'Yasal başlık', group: 'Footer' },
      { path: 'footer.legalText', label: 'Yasal metin', type: 'textarea', group: 'Footer' },
      { path: 'footer.certified', label: 'Onay yazısı', group: 'Footer' },
      { path: 'footer.copyright', label: 'Telif satırı', group: 'Footer' },
      { path: 'footer.creditBefore', label: 'Ajans yazısı başlangıcı', group: 'Footer' },
      { path: 'footer.creditName', label: 'Ajans adı', group: 'Footer' },
      { path: 'footer.creditAfter', label: 'Ajans yazısı devamı', group: 'Footer' }
    ]
  };

  const LISTS = {
    genel: [
      { id: 'nav', title: 'Menü linkleri', path: 'nav', blank: () => ({ label: 'Yeni', href: '#' }), fields: [
        { key: 'label', label: 'Yazı' },
        { key: 'href', label: 'Link' }
      ] }
    ],
    turlar: [
      { id: 'tours', title: 'Tur kartları', path: 'tours', blank: () => ({ image: '', imageAlt: '', badge: '', badgeTone: 'gold', duration: '', location: '', title: 'Yeni tur', description: '', flight: '', hotel: '', meal: '', price: '' }), fields: [
        { key: 'image', label: 'Fotoğraf', type: 'image' },
        { key: 'imageAlt', label: 'Fotoğraf açıklaması' },
        { key: 'badge', label: 'Rozet' },
        { key: 'badgeTone', label: 'Rozet rengi', type: 'tone' },
        { key: 'duration', label: 'Süre' },
        { key: 'location', label: 'Bölge' },
        { key: 'title', label: 'Tur adı' },
        { key: 'description', label: 'Açıklama', type: 'textarea' },
        { key: 'flight', label: 'Uçuş' },
        { key: 'hotel', label: 'Konaklama' },
        { key: 'meal', label: 'Yemek' },
        { key: 'price', label: 'Fiyat' }
      ] }
    ],
    oteller: [
      { id: 'hotels', title: 'Oteller', path: 'hotels', blank: () => ({ image: '', imageAlt: '', city: '', stars: 5, title: 'Yeni otel', description: '' }), fields: [
        { key: 'image', label: 'Fotoğraf', type: 'image' },
        { key: 'imageAlt', label: 'Fotoğraf açıklaması' },
        { key: 'city', label: 'Konum' },
        { key: 'stars', label: 'Yıldız (1-5)' },
        { key: 'title', label: 'Otel adı' },
        { key: 'description', label: 'Açıklama', type: 'textarea' }
      ] }
    ],
    neden: [
      { id: 'reasons', title: 'Maddeler', path: 'reasons', blank: () => ({ icon: 'fa-star', title: 'Yeni madde', text: '' }), fields: [
        { key: 'icon', label: 'İkon (fa-star gibi)' },
        { key: 'title', label: 'Başlık' },
        { key: 'text', label: 'Metin', type: 'textarea' }
      ] }
    ],
    galeri: [
      { id: 'gallery', title: 'Fotoğraflar', path: 'gallery', blank: () => ({ src: '', caption: 'Yeni fotoğraf' }), fields: [
        { key: 'src', label: 'Fotoğraf', type: 'image' },
        { key: 'caption', label: 'Açıklama' }
      ] }
    ],
    sss: [
      { id: 'faqs', title: 'Sorular', path: 'faqs', blank: () => ({ question: 'Yeni soru', answer: '' }), fields: [
        { key: 'question', label: 'Soru' },
        { key: 'answer', label: 'Cevap', type: 'textarea' }
      ] }
    ],
    yorumlar: [
      { id: 'reviews', title: 'Yorumlar', path: 'reviews', blank: () => ({ initials: '', name: 'Yeni misafir', meta: '', stars: 5, text: '' }), fields: [
        { key: 'name', label: 'Ad soyad' },
        { key: 'initials', label: 'Kısaltma' },
        { key: 'meta', label: 'Alt bilgi' },
        { key: 'stars', label: 'Yıldız (1-5)' },
        { key: 'text', label: 'Yorum', type: 'textarea' }
      ] }
    ],
    iletisim: [
      { id: 'footer-tours', title: 'Footer tur linkleri', path: 'footer.tours', blank: () => ({ label: 'Yeni tur', href: '#turlar' }), fields: [
        { key: 'label', label: 'Yazı' },
        { key: 'href', label: 'Link' }
      ] },
      { id: 'footer-links', title: 'Alt yasal linkler', path: 'footer.links', blank: () => ({ label: 'Yeni link', href: '#' }), fields: [
        { key: 'label', label: 'Yazı' },
        { key: 'href', label: 'Link' }
      ] }
    ]
  };

  function authHeaders(extra) {
    return Object.assign({ Authorization: 'Bearer ' + (sessionStorage.getItem(TOKEN_KEY) || '') }, extra || {});
  }

  function isImagePath(value) {
    return /\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/i.test(value || '') || /^https?:/i.test(value || '');
  }

  function markDirty() {
    dirty = true;
    const status = document.getElementById('admin-status');
    if (status) status.textContent = 'Kaydedilmemiş değişiklik var';
  }

  const FIELD_CLASS = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-emeraldBrand';

  function fieldCaption(text) {
    const caption = document.createElement('span');
    caption.className = 'block text-xs font-semibold text-gray-500 mb-1';
    caption.textContent = text;
    return caption;
  }

  function makeControl(path, label, type, value) {
    if (type === 'image') {
      const wrap = document.createElement('div');
      wrap.className = 'block';
      const caption = fieldCaption(label);
      wrap.appendChild(caption);
      const row = document.createElement('div');
      row.className = 'flex items-center gap-3';
      const preview = document.createElement('img');
      preview.alt = '';
      preview.className = 'w-16 h-16 object-contain rounded-xl bg-gray-50 shrink-0 border border-gray-100';
      if (value && !/\.(mp4|webm)(\?|$)/i.test(value)) preview.src = value;
      const stack = document.createElement('div');
      stack.className = 'flex-1 min-w-0 space-y-2';
      const input = document.createElement('input');
      input.className = FIELD_CLASS;
      input.placeholder = 'Dosya adresi veya yükleyin';
      input.value = value || '';
      input.addEventListener('input', () => {
        setPath(draft, path, input.value);
        if (!/\.(mp4|webm)(\?|$)/i.test(input.value)) preview.src = input.value;
        markDirty();
      });
      const pick = document.createElement('label');
      pick.className = 'inline-flex items-center gap-2 cursor-pointer bg-emeraldBrand text-white rounded-xl px-3 py-2 text-xs font-semibold';
      const pickText = document.createElement('span');
      pickText.textContent = 'Dosya seç';
      pick.appendChild(pickText);
      const file = document.createElement('input');
      file.type = 'file';
      file.accept = 'image/*,video/mp4,video/webm';
      file.className = 'hidden';
      file.addEventListener('change', async () => {
        const chosen = file.files && file.files[0];
        if (!chosen) return;
        pickText.textContent = 'Yükleniyor...';
        try {
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(chosen);
          });
          const response = await fetch(API + '/api/upload', {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ name: chosen.name, data: dataUrl })
          });
          const json = await response.json();
          if (!response.ok) throw new Error(json.error || 'Yüklenemedi');
          input.value = json.path;
          setPath(draft, path, json.path);
          if (!/\.(mp4|webm)(\?|$)/i.test(json.path)) preview.src = json.path;
          markDirty();
          pickText.textContent = 'Dosya seç';
        } catch (err) {
          pickText.textContent = err.message;
        }
      });
      pick.appendChild(file);
      stack.appendChild(input);
      stack.appendChild(pick);
      row.appendChild(preview);
      row.appendChild(stack);
      wrap.appendChild(row);
      return wrap;
    }

    const wrap = document.createElement('label');
    wrap.className = 'block';
    wrap.appendChild(fieldCaption(label));

    if (type === 'textarea' || type === 'lines') {
      const area = document.createElement('textarea');
      area.rows = type === 'lines' ? 4 : 3;
      area.className = FIELD_CLASS;
      area.value = type === 'lines' ? (Array.isArray(value) ? value.join('\n') : '') : (value || '');
      area.addEventListener('input', () => {
        if (type === 'lines') {
          setPath(draft, path, area.value.split('\n').map((line) => line.trim()).filter(Boolean));
        } else {
          setPath(draft, path, area.value);
        }
        markDirty();
      });
      wrap.appendChild(area);
      return wrap;
    }

    if (type === 'tone') {
      const select = document.createElement('select');
      select.className = FIELD_CLASS;
      [['gold', 'Altın'], ['green', 'Yeşil']].forEach((option) => {
        const node = document.createElement('option');
        node.value = option[0];
        node.textContent = option[1];
        if (value === option[0]) node.selected = true;
        select.appendChild(node);
      });
      select.addEventListener('change', () => {
        setPath(draft, path, select.value);
        markDirty();
      });
      wrap.appendChild(select);
      return wrap;
    }

    const input = document.createElement('input');
    input.className = FIELD_CLASS;
    input.value = value == null ? '' : value;
    input.addEventListener('input', () => {
      setPath(draft, path, input.value);
      markDirty();
    });
    wrap.appendChild(input);
    return wrap;
  }

  function paintList(block) {
    const wrap = document.getElementById('list-' + block.id);
    if (!wrap) return;
    const items = getPath(draft, block.path) || [];
    wrap.innerHTML = '';
    const heading = document.createElement('div');
    heading.className = 'flex items-center justify-between mt-2 mb-3';
    const title = document.createElement('h3');
    title.className = 'text-lg font-serif font-bold text-emeraldBrand-dark';
    title.textContent = block.title;
    const count = document.createElement('span');
    count.className = 'text-xs font-semibold text-gray-500 bg-white border border-gray-100 rounded-full px-3 py-1';
    count.textContent = items.length + ' kayıt';
    heading.appendChild(title);
    heading.appendChild(count);
    wrap.appendChild(heading);
    items.forEach((item, index) => {
      const open = block.openIndex === index;
      const card = document.createElement('div');
      card.className = 'bg-white rounded-2xl border border-gray-100 mb-3 overflow-hidden';
      const top = document.createElement('div');
      top.className = 'flex items-center gap-3 px-4 py-3';
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'flex-1 flex items-center gap-3 text-left min-w-0';
      const badge = document.createElement('span');
      badge.className = 'w-8 h-8 rounded-full bg-emeraldBrand-pale text-emeraldBrand text-xs font-bold flex items-center justify-center shrink-0';
      badge.textContent = String(index + 1);
      const name = document.createElement('span');
      name.className = 'font-semibold text-gray-900 text-sm truncate';
      name.textContent = item.title || item.name || item.label || item.question || item.caption || ('Kayıt ' + (index + 1));
      const chevron = document.createElement('i');
      chevron.className = 'fa-solid fa-chevron-down text-xs text-gray-400 shrink-0 transition-transform' + (open ? ' rotate-180' : '');
      toggle.appendChild(badge);
      toggle.appendChild(name);
      toggle.appendChild(chevron);
      toggle.addEventListener('click', () => {
        block.openIndex = open ? -1 : index;
        paintList(block);
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'text-red-600 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-red-50 shrink-0';
      remove.textContent = 'Sil';
      remove.addEventListener('click', () => {
        items.splice(index, 1);
        if (block.openIndex === index) block.openIndex = -1;
        else if (block.openIndex > index) block.openIndex -= 1;
        markDirty();
        paintList(block);
      });
      top.appendChild(toggle);
      top.appendChild(remove);
      card.appendChild(top);
      if (open) {
        const body = document.createElement('div');
        body.className = 'grid md:grid-cols-2 gap-4 px-4 pb-4 pt-1 border-t border-gray-100';
        block.fields.forEach((field) => {
          const control = makeControl(block.path + '.' + index + '.' + field.key, field.label, field.type, item[field.key]);
          if (field.type === 'textarea' || field.type === 'image' || field.type === 'lines') control.classList.add('md:col-span-2');
          body.appendChild(control);
        });
        card.appendChild(body);
      }
      wrap.appendChild(card);
    });
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'border border-dashed border-gray-300 rounded-xl px-4 py-3 text-sm font-semibold text-emeraldBrand w-full bg-white';
    add.textContent = '+ Yeni ekle';
    add.addEventListener('click', () => {
      items.push(block.blank());
      setPath(draft, block.path, items);
      block.openIndex = items.length - 1;
      markDirty();
      paintList(block);
    });
    wrap.appendChild(add);
  }

  const TAB_INTRO = {
    genel: ['Genel', 'Marka, telefon, sosyal linkler ve menü.'],
    anasayfa: ['Anasayfa', 'Karşılama yazıları, butonlar ve arka plan.'],
    hakkimizda: ['Hakkımızda', 'Metinler ve tanıtım videosu.'],
    turlar: ['Turlar', 'Bölüm yazısı ve tur kartları. Karta tıklayınca ayrıntılar açılır.'],
    oteller: ['Oteller', 'Otel listesi. Düzenlemek için karta tıklayın.'],
    neden: ['Neden Biz', 'Kısa maddeler. Düzenlemek için karta tıklayın.'],
    galeri: ['Galeri', 'Fotoğraflar kapalı durur, düzenlemek için açın.'],
    sss: ['Sıkça Sorulan Sorular', 'Soruyu açıp cevabını yazın.'],
    yorumlar: ['Yorumlar', 'Puan alanı ve misafir yorumları.'],
    iletisim: ['İletişim', 'İletişim metinleri, sosyal ikon linkleri ve footer.']
  };

  function renderFieldGroups(pane, fields) {
    let current = null;
    let grid = null;
    fields.forEach((field) => {
      const group = field.group || 'Yazılar';
      if (group !== current) {
        current = group;
        const card = document.createElement('section');
        card.className = 'bg-white rounded-2xl border border-gray-100 p-5 mb-4';
        const heading = document.createElement('h3');
        heading.className = 'text-sm font-semibold text-emeraldBrand mb-4';
        heading.textContent = group;
        grid = document.createElement('div');
        grid.className = 'grid md:grid-cols-2 gap-4';
        card.appendChild(heading);
        card.appendChild(grid);
        pane.appendChild(card);
      }
      const control = makeControl(field.path, field.label, field.type, getPath(draft, field.path));
      if (field.type === 'textarea' || field.type === 'image' || field.type === 'lines') control.classList.add('md:col-span-2');
      grid.appendChild(control);
    });
  }

  function renderEditor(tabId) {
    const pane = document.getElementById('admin-pane');
    pane.innerHTML = '';
    if (tabId === 'kayitlar') {
      renderLeads(pane);
      return;
    }
    const intro = TAB_INTRO[tabId] || ['İçerik', ''];
    const head = document.createElement('div');
    head.className = 'mb-5';
    const title = document.createElement('h2');
    title.className = 'text-2xl font-serif font-bold text-emeraldBrand-dark';
    title.textContent = intro[0];
    const hint = document.createElement('p');
    hint.className = 'text-sm text-gray-600 mt-1';
    hint.textContent = intro[1];
    head.appendChild(title);
    head.appendChild(hint);
    pane.appendChild(head);
    renderFieldGroups(pane, FIELD_TABS[tabId] || []);
    (LISTS[tabId] || []).forEach((block) => {
      if (block.openIndex == null) block.openIndex = -1;
      const holder = document.createElement('div');
      holder.id = 'list-' + block.id;
      holder.className = 'mb-6';
      pane.appendChild(holder);
      paintList(block);
    });
    if (tabId === 'genel') pane.appendChild(passwordCard());
  }

  function passwordCard() {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl border border-gray-100 p-5 space-y-3 mt-6';
    card.innerHTML = '<h3 class="text-lg font-serif font-bold text-emeraldBrand-dark">Şifre değiştir</h3>';
    const current = document.createElement('input');
    const next = document.createElement('input');
    [current, next].forEach((input) => {
      input.type = 'password';
      input.className = FIELD_CLASS;
    });
    current.placeholder = 'Mevcut şifre';
    next.placeholder = 'Yeni şifre';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bg-emeraldBrand text-white rounded-xl px-4 py-2 text-sm font-semibold';
    button.textContent = 'Şifreyi güncelle';
    const note = document.createElement('p');
    note.className = 'text-sm text-gray-600';
    button.addEventListener('click', async () => {
      note.textContent = '';
      const response = await fetch(API + '/api/password', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ current: current.value, next: next.value })
      });
      const json = await response.json().catch(() => ({}));
      note.textContent = response.ok ? 'Şifre güncellendi.' : (json.error || 'Şifre güncellenemedi.');
      if (response.ok) {
        current.value = '';
        next.value = '';
      }
    });
    card.appendChild(current);
    card.appendChild(next);
    card.appendChild(button);
    card.appendChild(note);
    return card;
  }

  async function renderLeads(pane) {
    pane.innerHTML = '<p class="text-sm text-gray-600 mb-4">Kayıt Ol / Bilgi Al ve iletişim formundan bırakılan ad soyad ile telefon burada görünür.</p>';
    const response = await fetch(API + '/api/leads', { headers: authHeaders(), cache: 'no-store' });
    if (response.status === 401) {
      logout();
      return;
    }
    const leads = await response.json();
    if (!leads.length) {
      const empty = document.createElement('p');
      empty.className = 'bg-white rounded-2xl border border-gray-100 p-5 text-gray-600';
      empty.textContent = 'Henüz kayıt yok.';
      pane.appendChild(empty);
      return;
    }
    const table = document.createElement('div');
    table.className = 'bg-white rounded-2xl border border-gray-100 overflow-x-auto';
    const rows = leads.map((lead) => {
      const date = new Date(lead.createdAt);
      const when = Number.isNaN(date.getTime()) ? '' : date.toLocaleString('tr-TR');
      return `<tr class="border-b border-gray-100 align-top">
        <td class="px-3 py-3 text-sm text-gray-500 whitespace-nowrap">${esc(when)}</td>
        <td class="px-3 py-3 text-sm font-semibold text-gray-900">${esc(lead.name)}</td>
        <td class="px-3 py-3 text-sm text-gray-800 whitespace-nowrap">${esc(lead.phone)}</td>
        <td class="px-3 py-3 text-sm text-gray-600">${esc(lead.tour)}</td>
        <td class="px-3 py-3 text-sm text-gray-600">${esc(lead.message)}</td>
        <td class="px-3 py-3 text-sm text-gray-500">${esc(lead.source)}</td>
        <td class="px-3 py-3"><button type="button" data-id="${esc(lead.id)}" class="js-delete-lead text-red-600 text-sm font-semibold">Sil</button></td>
      </tr>`;
    }).join('');
    table.innerHTML = `<table class="w-full text-left border-collapse">
      <thead><tr class="border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500">
        <th class="px-3 py-3">Tarih</th><th class="px-3 py-3">Ad Soyad</th><th class="px-3 py-3">Telefon</th><th class="px-3 py-3">Tur</th><th class="px-3 py-3">Mesaj</th><th class="px-3 py-3">Kaynak</th><th class="px-3 py-3"></th>
      </tr></thead><tbody>${rows}</tbody></table>`;
    table.addEventListener('click', async (event) => {
      const button = event.target.closest('.js-delete-lead');
      if (!button) return;
      await fetch(API + '/api/leads/' + encodeURIComponent(button.getAttribute('data-id')), {
        method: 'DELETE',
        headers: authHeaders()
      });
      renderLeads(pane);
    });
    pane.appendChild(table);
  }

  function showTab(tabId) {
    document.querySelectorAll('[data-admin-tab]').forEach((button) => {
      const active = button.getAttribute('data-admin-tab') === tabId;
      const nested = button.hasAttribute('data-nested');
      const base = nested
        ? 'w-full text-left pl-8 pr-3 py-2 rounded-xl text-sm font-medium '
        : 'w-full text-left px-3 py-2 rounded-xl text-sm font-medium ';
      button.className = base + (active ? 'bg-white/10 text-goldBrand' : 'text-white hover:bg-white/10');
    });
    renderEditor(tabId);
  }

  async function saveDraft() {
    const status = document.getElementById('admin-status');
    status.textContent = 'Kaydediliyor...';
    const response = await fetch(API + '/api/content', {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(draft)
    });
    if (response.status === 401) {
      logout();
      return;
    }
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      status.textContent = json.error || 'Kaydedilemedi';
      return;
    }
    dirty = false;
    status.textContent = 'Kaydedildi. Site güncellendi.';
    applyContent(draft);
  }

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    document.getElementById('admin-login').classList.remove('hidden');
    document.getElementById('admin-shell').classList.add('hidden');
  }

  function openAdmin() {
    window.__cmsAdmin = true;
    document.body.style.overflow = 'hidden';
    document.getElementById('admin-app').classList.remove('hidden');
  }

  function closeAdmin() {
    window.__cmsAdmin = false;
    document.body.style.overflow = '';
    document.getElementById('admin-app').classList.add('hidden');
  }

  function mountAdmin() {
    const root = document.createElement('div');
    root.id = 'admin-app';
    root.className = 'hidden fixed inset-0 z-[200] overflow-y-auto bg-[#f4f6f3]';
    root.innerHTML = `
      <div id="admin-login" class="min-h-screen flex items-center justify-center p-4">
        <form id="admin-login-form" class="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 max-w-md w-full space-y-4">
          <div class="w-12 h-12 rounded-2xl gold-gradient flex items-center justify-center text-emeraldBrand-dark text-xl"><i class="fa-solid fa-lock"></i></div>
          <h1 class="text-2xl font-serif font-bold text-emeraldBrand-dark">Yönetim Paneli</h1>
          <p class="text-sm text-gray-600">Yazılar, fotoğraflar, linkler ve gelen kayıtlar bu panelden yönetilir.</p>
          <label class="block"><span class="block text-sm font-medium text-gray-700 mb-1">Kullanıcı adı</span>
            <input id="admin-user" class="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-emeraldBrand" autocomplete="username" value="admin">
          </label>
          <label class="block"><span class="block text-sm font-medium text-gray-700 mb-1">Şifre</span>
            <input id="admin-pass" type="password" class="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-emeraldBrand" autocomplete="current-password">
          </label>
          <p id="admin-login-error" class="hidden bg-red-50 text-red-700 text-sm rounded-xl px-3 py-2"></p>
          <button class="w-full gold-gradient text-emeraldBrand-dark font-bold py-3 rounded-xl" type="submit">Giriş yap</button>
          <a href="/anasayfa" data-leave-admin class="block text-center text-sm text-emeraldBrand">Siteye dön</a>
        </form>
      </div>
      <div id="admin-shell" class="hidden min-h-screen grid lg:grid-cols-[260px_1fr]">
        <aside class="bg-emeraldBrand-dark text-white p-6 lg:sticky lg:top-0 lg:h-screen flex flex-col">
          <p class="font-serif font-bold text-xl mb-1">Meryem Aşık</p>
          <p class="text-xs uppercase tracking-wider text-goldBrand mb-6">Yönetim</p>
          <nav id="admin-tabs" class="space-y-2 overflow-y-auto flex-1 min-h-0"></nav>
          <div class="pt-4 mt-4 space-y-2 border-t border-white/10">
            <a id="admin-view-site" href="/anasayfa" data-leave-admin class="flex items-center justify-center gap-2 w-full rounded-xl border border-goldBrand/40 text-goldBrand font-semibold text-sm py-2.5 hover:bg-goldBrand hover:text-emeraldBrand-dark transition-colors">
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
              Siteyi gör
            </a>
            <button id="admin-logout" type="button" class="flex items-center justify-center gap-2 w-full rounded-xl border border-white/20 text-white font-semibold text-sm py-2.5 hover:bg-white/10 transition-colors">
              <i class="fa-solid fa-right-from-bracket"></i>
              Çıkış
            </button>
          </div>
        </aside>
        <section class="p-6 md:p-10">
          <div class="flex items-center justify-between gap-3 mb-6">
            <p id="admin-status" class="text-sm text-gray-600">Değişiklikten sonra Kaydet'e basın.</p>
            <button id="admin-save" type="button" class="gold-gradient text-emeraldBrand-dark font-bold px-5 py-2.5 rounded-full shrink-0">Kaydet</button>
          </div>
          <div id="admin-pane"></div>
        </section>
      </div>`;
    document.body.appendChild(root);

    const tabs = document.getElementById('admin-tabs');
    const folder = document.createElement('div');
    folder.className = 'space-y-1';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-goldBrand hover:bg-white/10';
    toggle.innerHTML = '<span class="flex items-center gap-2"><i id="admin-folder-type" class="fa-solid fa-folder"></i> İçerik Düzenleme</span><i id="admin-folder-icon" class="fa-solid fa-chevron-down text-xs transition-transform -rotate-90"></i>';
    const items = document.createElement('div');
    items.id = 'admin-folder-items';
    items.className = 'space-y-1 hidden';
    TABS.filter((tab) => tab.id !== 'kayitlar').forEach((tab) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('data-admin-tab', tab.id);
      button.setAttribute('data-nested', '1');
      button.textContent = tab.label;
      button.addEventListener('click', () => showTab(tab.id));
      items.appendChild(button);
    });
    toggle.addEventListener('click', () => {
      const closed = items.classList.toggle('hidden');
      document.getElementById('admin-folder-icon').classList.toggle('-rotate-90', closed);
      document.getElementById('admin-folder-type').className = closed ? 'fa-solid fa-folder' : 'fa-solid fa-folder-open';
    });
    folder.appendChild(toggle);
    folder.appendChild(items);
    tabs.appendChild(folder);

    const kayitlar = TABS.find((tab) => tab.id === 'kayitlar');
    const kayitButton = document.createElement('button');
    kayitButton.type = 'button';
    kayitButton.setAttribute('data-admin-tab', kayitlar.id);
    kayitButton.innerHTML = '<i class="fa-solid fa-address-book mr-2"></i>' + kayitlar.label;
    kayitButton.addEventListener('click', () => showTab(kayitlar.id));
    tabs.appendChild(kayitButton);

    document.getElementById('admin-login-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const error = document.getElementById('admin-login-error');
      error.classList.add('hidden');
      try {
        const response = await fetch(API + '/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: document.getElementById('admin-user').value.trim(),
            password: document.getElementById('admin-pass').value
          })
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.error || 'Giriş yapılamadı. Yönetim sunucusu açık mı?');
        sessionStorage.setItem(TOKEN_KEY, json.token);
        await enterPanel();
      } catch (err) {
        error.textContent = err.message || 'Yönetim sunucusu kapalı. baslat-admin.bat dosyasını çalıştırın.';
        error.classList.remove('hidden');
      }
    });

    document.getElementById('admin-save').addEventListener('click', saveDraft);
    document.getElementById('admin-logout').addEventListener('click', logout);
    root.querySelectorAll('[data-leave-admin]').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        if (dirty && !confirm('Kaydedilmemiş değişiklikler var. Siteye dönülsün mü?')) return;
        location.assign('/anasayfa');
      });
    });
  }

  function routePath() {
    return location.pathname.replace(/\/+$/, '') || '/';
  }

  function syncRoute() {
    const path = routePath();
    if (location.hash === '#/admin' && path !== '/admin') {
      history.replaceState(null, '', '/admin');
      openAdmin();
      return;
    }
    if (path === '/' || path === '/index.html') {
      location.replace(location.hash === '#/admin' ? '/admin' : '/anasayfa' + location.hash);
      return;
    }
    if (path === '/admin') openAdmin();
    else closeAdmin();
  }

  async function enterPanel() {
    if (!draft) draft = await loadContent();
    document.getElementById('admin-login').classList.add('hidden');
    document.getElementById('admin-shell').classList.remove('hidden');
    showTab('genel');
  }

  mountAdmin();
  window.addEventListener('hashchange', syncRoute);
  syncRoute();

  loadContent().then((data) => {
    draft = data;
    applyContent(data);
    if (sessionStorage.getItem(TOKEN_KEY) && routePath() === '/admin') {
      enterPanel().catch(() => logout());
    }
  }).catch(() => {
    const error = document.getElementById('admin-login-error');
    if (error && routePath() === '/admin') {
      error.textContent = 'Yönetim sunucusu kapalı. Proje klasöründeki baslat-admin.bat dosyasını çalıştırın.';
      error.classList.remove('hidden');
    }
  });
})();
