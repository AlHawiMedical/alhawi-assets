/*! © 2026 Dr. Hassan Alduvayhi — All rights reserved. Unauthorized copying or reuse is prohibited.
    Site map for people: main pages + every post, grouped (clinical cases by specialty, ECG, other), updated automatically
    from the Blogger feed | v0.1.0 (ar/en/tr) | requires hawi-core.js v0.4
    Page: <div data-hawi-app="sitemap"></div> */
(function (w, d) {
  'use strict';
  var H = w.Hawi; if (!H || !H.bi) return;
  var bi = H.bi;
  function B(ar, en, tr) { return { ar: ar, en: en, tr: tr }; }

  var L = {
    pages: B('الصفحات الرئيسية', 'Main pages', 'Ana sayfalar'),
    cases: B('الحالات السريرية', 'Clinical Cases', 'Klinik Vakalar'),
    ecg: B('تخطيط القلب', 'ECG', 'EKG'),
    other: B('مقالات ودروس أخرى', 'Other articles and lessons', 'Diğer makaleler ve dersler'),
    general: B('عامة', 'General', 'Genel'),
    loading: B('جارٍ تحميل محتوى الموقع…', 'Loading the site content…', 'Site içeriği yükleniyor…'),
    error: B('تعذّر تحميل قائمة المحتوى. حدّث الصفحة بعد قليل.', 'Could not load the content list. Refresh the page in a moment.', 'İçerik listesi yüklenemedi. Biraz sonra sayfayı yenileyin.'),
    none: B('لا محتوى منشوراً في هذا القسم بعد.', 'Nothing published in this section yet.', 'Bu bölümde henüz yayımlanmış içerik yok.'),
    total: B('عدد المواد المنشورة:', 'Published items:', 'Yayımlanan içerik:')
  };
  /* main pages: paths are relative, so the list survives a domain change */
  var PAGES = [
    ['/', B('الرئيسية', 'Home', 'Ana Sayfa')],
    ['/p/clinical-cases.html', B('الحالات السريرية', 'Clinical Cases', 'Klinik Vakalar')],
    ['/p/ecg-academy.html', B('أكاديمية تخطيط القلب', 'ECG Academy', 'EKG Akademisi')],
    ['/p/mistakes-log.html', B('سجل أخطائي', 'My Mistakes Log', 'Hata Günlüğüm')],
    ['/p/about.html', B('من نحن', 'About', 'Hakkımızda')],
    ['/p/contact.html', B('اتصل بنا', 'Contact', 'İletişim')],
    ['/p/medical-disclaimer.html', B('إخلاء المسؤولية الطبية', 'Medical Disclaimer', 'Tıbbi Sorumluluk Reddi')],
    ['/p/privacy-policy.html', B('سياسة الخصوصية', 'Privacy Policy', 'Gizlilik Politikası')],
    ['/p/terms-of-use.html', B('شروط الاستخدام', 'Terms of Use', 'Kullanım Koşulları')]
  ];
  /* specialty labels (claude/alhawi-tags.md) — same names as the breadcrumb */
  var SP = [
    ['Internal Medicine', B('الأمراض الباطنة', 'Internal Medicine', 'İç Hastalıkları')],
    ['Psychiatry', B('الطب النفسي', 'Psychiatry', 'Psikiyatri')],
    ['Pediatrics', B('طب الأطفال', 'Pediatrics', 'Çocuk Sağlığı ve Hastalıkları')],
    ['Obstetrics and Gynecology', B('النسائية والتوليد', 'Obstetrics and Gynecology', 'Kadın Hastalıkları ve Doğum')],
    ['Surgery', B('الجراحة', 'Surgery', 'Cerrahi')],
    ['Differential Diagnosis', B('التشخيص التفريقي', 'Differential Diagnosis', 'Ayırıcı Tanı')]
  ];

  var CSS = '.hw-sm{display:grid;gap:14px}' +
    '.hw-sm .hw-card{margin:0}' +
    '.hw-sm h3{display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
    '.hw-sm h3 .n{font-size:13px;font-weight:700;padding:2px 8px;border-radius:99px;background:var(--hw-accent-soft);color:var(--hw-accent-ink)}' +
    '.hw-sm h4{margin:12px 0 6px;font-size:15px;opacity:.8}' +
    '.hw-sm ul{list-style:none!important;margin:0!important;padding:0!important;display:grid;gap:2px}' +
    '.hw-sm li{list-style:none!important;margin:0!important;padding:0!important}' +
    '.hw-sm li::before,.hw-sm li::marker{content:none!important;display:none!important}' +
    '.hw-sm li a{display:block;padding:7px 10px;border-radius:8px;color:var(--hw-ink);text-decoration:none;line-height:1.5}' +
    '.hw-sm li a:hover,.hw-sm li a:focus-visible{background:var(--hw-accent-soft);color:var(--hw-accent-ink)}' +
    '.hw-sm .hw-note{opacity:.7;font-size:14px;margin:0}' +
    '@media(min-width:700px){.hw-sm .cols{display:block;columns:2;column-gap:16px}.hw-sm .cols li{break-inside:avoid}}';
  function style() {
    if (d.getElementById('hwSmCss')) return;
    var s = d.createElement('style'); s.id = 'hwSmCss'; s.textContent = CSS; d.head.appendChild(s);
  }

  /* every post from the summary feed (150 per request, Blogger's maximum) */
  function allPosts() {
    var out = [];
    function page(start) {
      return fetch('/feeds/posts/summary?alt=json&max-results=150&start-index=' + start)
        .then(function (r) { if (!r.ok) throw new Error('feed ' + r.status); return r.json(); })
        .then(function (j) {
          var es = (j && j.feed && j.feed.entry) || [];
          es.forEach(function (e) {
            var lk = (e.link || []).filter(function (l) { return l.rel === 'alternate'; })[0];
            if (!lk) return;
            var parts = String((e.title && e.title.$t) || '').split(' | ');
            out.push({
              u: lk.href.replace(/^https?:\/\/[^/]+/, ''),
              t: { ar: parts[0], en: parts[1] || parts[0], tr: parts[2] || '' },
              c: (e.category || []).map(function (c) { return c.term; })
            });
          });
          return es.length === 150 ? page(start + 150) : out;
        });
    }
    return page(1);
  }
  function list(items, cols) {
    return '<ul' + (cols && items.length > 8 ? ' class="cols"' : '') + '>' + items.map(function (x) {
      return '<li><a href="' + H.esc(x.u) + '">' + bi(x.t) + '</a></li>';
    }).join('') + '</ul>';
  }
  function card(title, n, body) {
    return '<section class="hw-card"><h3>' + bi(title) + (n != null ? ' <span class="n">' + n + '</span>' : '') + '</h3>' + body + '</section>';
  }

  H.apps.sitemap = function (mount) {
    style();
    mount.classList.add('hw-sm');
    var pages = PAGES.map(function (p) { return { u: p[0], t: p[1] }; });
    mount.innerHTML = card(L.pages, null, list(pages)) + '<p class="hw-note js-wait">' + bi(L.loading) + '</p>';
    allPosts().then(function (posts) {
      var cases = [], ecg = [], other = [];
      posts.forEach(function (p) {
        if (p.c.indexOf('Clinical Cases') > -1) cases.push(p);
        else if (p.c.indexOf('ECG') > -1) ecg.push(p);
        else other.push(p);
      });
      var html = card(L.pages, null, list(pages));
      /* clinical cases, by specialty (a case without a known specialty goes to «General») */
      var body = '', used = {};
      SP.forEach(function (s) {
        var g = cases.filter(function (p) { return p.c.indexOf(s[0]) > -1 && !used[p.u]; });
        g.forEach(function (p) { used[p.u] = 1; });
        if (g.length) body += '<h4>' + bi(s[1]) + ' (' + g.length + ')</h4>' + list(g, true);
      });
      var rest = cases.filter(function (p) { return !used[p.u]; });
      if (rest.length) body += '<h4>' + bi(L.general) + ' (' + rest.length + ')</h4>' + list(rest, true);
      html += card(L.cases, cases.length, body || '<p class="hw-note">' + bi(L.none) + '</p>');
      html += card(L.ecg, ecg.length, ecg.length ? list(ecg, true) : '<p class="hw-note">' + bi(L.none) + '</p>');
      if (other.length) html += card(L.other, other.length, list(other, true));
      html += '<p class="hw-note">' + bi(L.total) + ' ' + posts.length + '</p>';
      mount.innerHTML = html;
    }, function () {
      var wv = mount.querySelector('.js-wait'); if (wv) wv.innerHTML = bi(L.error);
    });
  };
  if (d.readyState !== 'loading' && H.boot) H.boot();
})(window, document);
