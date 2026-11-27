/*! © 2026 Dr. Hassan Alduvayhi — All rights reserved.
    SHAM Medical home screen (app-style home page) | v0.1.0 (ar/en/tr) | requires hawi-core.js v0.5
    Page: <div data-hawi-app="home"></div> in the theme's "Top Widgets" section (home page only).
          The theme hides "Latest posts" (#Blog01) only while this app is on the page.
    Blocks, in order (data-order="hero,sections,daily,spec,rows,about" reorders or drops them):
      hero     greeting · one search · "continue where you left off" (or a first step for new visitors) · review today · mistakes
      sections the site's sections as tiles (SECTIONS below; soon:1 = "coming soon")
      daily    case of the day: the same case for every visitor on a given day
      spec     browse by specialty
      rows     newest posts of each content type (ROWS below): a swipe row on phones, a grid on desktop
      about    who we are + create a free account
    TO ADD A NEW SECTION LATER (quizzes, radiology, …): one line in SECTIONS (+ one in ROWS if it has posts with a label,
    + its app name in PROG if it saves progress with H.prog). A new kind of block: one function in BLOCKS + its id in ORDER. */
(function (w, d) {
  'use strict';
  var H = w.Hawi; if (!H || !H.prog || !H.cards) return;
  var bi = H.bi, esc = H.esc;
  function B(ar, en, tr) { return { ar: ar, en: en, tr: tr }; }
  function T(tpl, v) { var o = {}; ['ar', 'en', 'tr'].forEach(function (l) { o[l] = tpl[l].replace(/\{(\w+)\}/g, function (_, k) { return v[k] != null ? v[k] : ''; }); }); return o; }

  /* ---------- icons (stroke, 24×24) ---------- */
  var P = {
    cases: 'M6 4h-1a2 2 0 0 0 -2 2v3.5a5.5 5.5 0 0 0 11 0v-3.5a2 2 0 0 0 -2 -2h-1M8 15a6 6 0 1 0 12 0v-3M11 3v2M6 3v2M18 10a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
    ecg: 'M2 12h4l2-5 4 11 3-8 2 2h5',
    mindmaps: 'M10 12h-3M7 12v-5h3M7 12v5h3M10 5h8v4h-8zM10 15h8v4h-8zM3 10h4v4h-4z',
    cards: 'M8 4h11a1 1 0 0 1 1 1v12M5 7h11a1 1 0 0 1 1 1v11a1 1 0 0 1 -1 1h-11a1 1 0 0 1 -1 -1v-11a1 1 0 0 1 1 -1z',
    log: 'M9 4h6v3h-6zM9 5h-3a1 1 0 0 0 -1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1 -1v-14a1 1 0 0 0 -1 -1h-3M12 11v4M12 18v.01',
    ddx: 'M12 3v5M12 8l-6 5M12 8l6 5M6 13v4M18 13v4M4 17h4v4h-4zM16 17h4v4h-4z',
    qbank: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.01M4 4h16v16h-16z',
    search: 'M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13zM20 20l-4.8-4.8',
    play: 'M8 5v14l11-7z',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    spark: 'M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z'
  };
  function ic(n) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:100%;height:100%;max-width:none"><path d="' + P[n] + '"/></svg>'; }

  /* ---------- the site's sections: ONE LINE PER SECTION (order = order on screen) ---------- */
  var SECTIONS = [
    { id: 'cases', c: '#0c9784', u: '/p/clinical-cases.html', n: B('الحالات السريرية', 'Clinical Cases', 'Klinik Vakalar'), s: B('شخّص وعالج كطبيب', 'Diagnose and treat', 'Tanı koy, tedavi et') },
    { id: 'ecg', c: '#c4352b', u: '/p/ecg-academy.html', n: B('أكاديمية تخطيط القلب', 'ECG Academy', 'EKG Akademisi'), s: B('دروس ومكتبة وحالات', 'Lessons, library, cases', 'Dersler, kütüphane, vakalar') },
    { id: 'mindmaps', c: '#6d5bd0', u: '/p/mind-maps.html', n: B('الخرائط الذهنية', 'Mind Maps', 'Zihin Haritaları'), s: B('الأسباب في شجرة واحدة', 'Causes in one tree', 'Nedenler tek ağaçta') },
    { id: 'cards', c: '#d9730d', u: '/p/cards.html', n: B('بطاقات شام', 'SHAM Cards', 'SHAM Kartları'), s: B('مراجعة متباعدة يومية', 'Daily spaced review', 'Günlük aralıklı tekrar') },
    { id: 'ddx', c: '#2f6fd6', soon: 1, n: B('التشخيص التفريقي', 'Differential Diagnosis', 'Ayırıcı Tanı'), s: B('قريباً', 'Coming soon', 'Yakında') },
    { id: 'qbank', c: '#55636c', soon: 1, n: B('بنوك الأسئلة', 'Question Banks', 'Soru Bankaları'), s: B('قريباً', 'Coming soon', 'Yakında') }
  ];
  /* newest posts per content type (Blogger label → row) */
  var ROWS = [
    { lb: 'Clinical Cases', ic: 'cases', c: '#0c9784', u: '/p/clinical-cases.html', n: B('أحدث الحالات', 'New cases', 'Yeni vakalar') },
    { lb: 'Mind Maps', ic: 'mindmaps', c: '#6d5bd0', u: '/p/mind-maps.html', n: B('أحدث الخرائط الذهنية', 'New mind maps', 'Yeni zihin haritaları') },
    { lb: 'ECG', ic: 'ecg', c: '#c4352b', u: '/p/ecg-academy.html', n: B('أحدث دروس تخطيط القلب', 'New ECG lessons', 'Yeni EKG dersleri') }
  ];
  /* apps whose H.prog records {t, u, at} feed "continue where you left off" */
  var PROG = { case: SECTIONS[0], ecg: SECTIONS[1], mindmap: SECTIONS[2] };
  /* specialties — same ids, labels and colours as hawi-cases.js and the theme's case covers */
  var SP = {
    im: { lb: 'Internal Medicine', c: '#0c9784', n: B('الأمراض الباطنة', 'Internal Medicine', 'İç Hastalıkları') },
    ps: { lb: 'Psychiatry', c: '#6d5bd0', n: B('الطب النفسي', 'Psychiatry', 'Psikiyatri') },
    pd: { lb: 'Pediatrics', c: '#d9730d', n: B('طب الأطفال', 'Pediatrics', 'Çocuk Sağlığı ve Hastalıkları') },
    og: { lb: 'Obstetrics and Gynecology', c: '#c2417a', n: B('النسائية والتوليد', 'Obstetrics and Gynecology', 'Kadın Hastalıkları ve Doğum') },
    sg: { lb: 'Surgery', c: '#2f6fd6', n: B('الجراحة', 'Surgery', 'Cerrahi') }
  };
  var SPK = ['im', 'ps', 'pd', 'og', 'sg'];
  var LV = [null, B('مبتدئ', 'Beginner', 'Başlangıç'), B('متوسط', 'Intermediate', 'Orta'), B('متقدم', 'Advanced', 'İleri')];
  var SEX = { m: B('ذكر', 'Male', 'Erkek'), f: B('أنثى', 'Female', 'Kadın') };
  var ORDER = 'hero,sections,daily,spec,rows,about';

  var L = {
    morning: B('صباح الخير', 'Good morning', 'Günaydın'), evening: B('مساء الخير', 'Good evening', 'İyi akşamlar'),
    ask: B('ماذا تتعلّم اليوم؟', 'What will you learn today?', 'Bugün ne öğreneceksin?'),
    ph: B('ابحث في الحالات والدروس والخرائط…', 'Search cases, lessons, maps…', 'Vaka, ders, harita ara…'),
    cont: B('تابع من حيث توقفت', 'Continue where you left off', 'Kaldığın yerden devam et'),
    best: B('أفضل درجة {n}', 'Best score {n}', 'En iyi puan {n}'),
    open: B('افتح', 'Open', 'Aç'),
    intro: B('تعلّم الطب بحالات سريرية وخرائط ذهنية وبطاقات مراجعة، بثلاث لغات.', 'Learn medicine with clinical cases, mind maps and review cards, in three languages.', 'Tıbbı klinik vakalar, zihin haritaları ve tekrar kartlarıyla, üç dilde öğren.'),
    first: B('ابدأ بحالة اليوم', 'Start with today\'s case', 'Günün vakasıyla başla'),
    firstS: B('حالة واحدة تكفي لتعرف كيف يعمل الموقع.', 'One case is enough to see how it works.', 'Nasıl çalıştığını görmek için bir vaka yeter.'),
    signup: B('أنشئ حساباً مجانياً ليُحفظ تقدّمك على كل أجهزتك', 'Create a free account to keep your progress on all devices', 'İlerlemeni tüm cihazlarında saklamak için ücretsiz hesap aç'),
    review: B('مراجعتك اليوم', 'Review today', 'Bugünkü tekrar'),
    cardsN: B('{n} بطاقة', '{n} cards', '{n} kart'), noRev: B('لا شيء مستحق', 'Nothing due', 'Bekleyen yok'),
    mist: B('سجل أخطائي', 'My mistakes', 'Hatalarım'), mistN: B('{n} خطأ', '{n} mistakes', '{n} hata'), noMist: B('فارغ', 'Empty', 'Boş'),
    secT: B('الأقسام', 'Sections', 'Bölümler'), soon: B('قريباً', 'Soon', 'Yakında'),
    dailyT: B('تحدّي اليوم', 'Today\'s challenge', 'Günün meydan okuması'), dailyK: B('حالة اليوم', 'Case of the day', 'Günün vakası'),
    solve: B('حُلّ الحالة', 'Solve the case', 'Vakayı çöz'), done: B('حللتها: {n}', 'Solved: {n}', 'Çözüldü: {n}'),
    years: B('{n} سنة', '{n} y', '{n} yaş'),
    specT: B('حسب التخصص', 'By specialty', 'Uzmanlığa göre'),
    all: B('عرض الكل', 'See all', 'Tümünü gör'),
    aboutT: B('من طبيب إلى أطباء المستقبل', 'From a doctor to the doctors of tomorrow', 'Bir doktordan geleceğin doktorlarına'),
    aboutP: B('شام الطبّية منصة تعليمية مجانية: تتعلّم بحلّ الحالات، وتراجع ما نسيته في الوقت المناسب، ويتحوّل كل خطأ إلى بطاقة مراجعة.',
      'SHAM Medical is a free learning platform: you learn by solving cases, review what you forget at the right time, and every mistake becomes a review card.',
      'SHAM Tıp ücretsiz bir eğitim platformudur: vaka çözerek öğrenir, unuttuğunu doğru zamanda tekrar eder, her hatan bir tekrar kartına dönüşür.'),
    aboutL: B('من نحن', 'About us', 'Hakkımızda'), join: B('أنشئ حساباً مجانياً', 'Create a free account', 'Ücretsiz hesap aç')
  };

  var CSS = '.hwh{display:grid;gap:22px;grid-template-columns:minmax(0,1fr);margin:0 0 26px;color:var(--hw-ink)}.hwh *{box-sizing:border-box}' +
    '.hwh a{color:inherit;text-decoration:none}.hwh h2.hwh-h{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:17px;margin:0 0 10px}' +
    '.hwh-h a{font-size:13px;font-weight:600;color:var(--hw-accent-ink)}' +
    '.hwh-i{display:inline-grid;place-items:center;flex:0 0 auto;width:var(--s,40px);height:var(--s,40px);padding:calc(var(--s,40px)*.22);border-radius:12px;background:color-mix(in srgb,var(--c) 14%,transparent);color:var(--c)}' +
    /* hero */
    '.hwh-hi small{display:block;font-size:13px;color:var(--hw-muted)}.hwh-hi b{display:block;font-size:22px;line-height:1.35}' +
    '.hwh-q{display:flex;align-items:center;gap:8px;margin-top:12px;padding:0 14px;height:48px;border-radius:14px;border:1px solid var(--hw-line);background:var(--hw-bg)}' +
    '.hwh-q span{width:20px;height:20px;color:var(--hw-muted);flex:0 0 auto}.hwh-q input{flex:1;min-width:0;border:0;outline:0;background:transparent;font:inherit;font-size:15px;color:inherit}' +
    '.hwh-g{display:grid;gap:10px;grid-template-columns:1fr 1fr;margin-top:12px}' +
    '.hwh-big{grid-column:1/-1;display:flex;gap:14px;align-items:center;padding:16px;border-radius:18px;background:linear-gradient(135deg,var(--hw-accent),var(--hw-accent-deep));color:#fff!important}' +
    '.hwh-big .hwh-i{--c:#fff;background:rgba(255,255,255,.18)}.hwh-big small{display:block;font-size:12.5px;opacity:.85}.hwh-big b{display:block;font-size:16.5px;line-height:1.45}' +
    '.hwh-big em{display:block;font-style:normal;font-size:12.5px;opacity:.85;margin-top:2px}.hwh-big>span:last-child{margin-inline-start:auto;width:22px;height:22px;flex:0 0 auto}' +
    '[dir=rtl] .hwh-big>span:last-child svg,html[data-lang=ar] .hwh-big>span:last-child svg{transform:scaleX(-1)}' +
    '.hwh-intro{grid-column:1/-1;margin:0;font-size:14px;line-height:1.8;color:var(--hw-muted)}' +
    '.hwh-sign{grid-column:1/-1;font:inherit;font-size:13px;color:var(--hw-accent-ink);background:none;border:0;padding:0;cursor:pointer;text-align:start;text-decoration:underline;text-underline-offset:3px}' +
    '.hwh-mini{display:flex;gap:10px;align-items:center;padding:12px;border-radius:16px;border:1px solid var(--hw-line);background:var(--hw-bg)}' +
    '.hwh-mini .hwh-i{--s:36px}.hwh-mini small{display:block;font-size:12px;color:var(--hw-muted)}.hwh-mini b{display:block;font-size:14.5px}' +
    /* tiles */
    '.hwh-tiles{display:grid;gap:10px;grid-template-columns:1fr 1fr}@media(min-width:768px){.hwh-tiles{grid-template-columns:repeat(3,1fr)}}' +
    '.hwh-tile{position:relative;display:grid;gap:8px;padding:14px;border-radius:16px;border:1px solid var(--hw-line);background:var(--hw-bg);transition:transform .15s,box-shadow .15s}' +
    'a.hwh-tile:hover{transform:translateY(-2px);box-shadow:0 8px 22px -12px rgba(0,0,0,.35)}' +
    '.hwh-tile b{font-size:14.5px;line-height:1.4}.hwh-tile small{font-size:12px;color:var(--hw-muted);line-height:1.5}' +
    '.hwh-tile.soon{opacity:.6}.hwh-tile.soon i{position:absolute;top:10px;inset-inline-end:10px;font-style:normal;font-size:11px;padding:2px 8px;border-radius:99px;background:var(--hw-bg-soft);border:1px solid var(--hw-line)}' +
    /* daily */
    '.hwh-day{display:flex;gap:14px;align-items:center;padding:14px;border-radius:18px;border:1px solid var(--hw-line);border-inline-start:5px solid var(--c);background:var(--hw-bg)}' +
    '.hwh-day .hwh-i,.hwh-day img{--s:64px;width:64px;height:64px;border-radius:14px;object-fit:cover;flex:0 0 auto}' +
    '.hwh-day small{display:block;font-size:12px;color:var(--hw-muted)}.hwh-day small em{font-style:normal;font-weight:700;color:var(--c)}.hwh-day b{display:block;font-size:16px;line-height:1.45;margin:2px 0}' +
    '.hwh-btn{display:inline-flex;align-items:center;gap:6px;margin-top:6px;font-size:13px;font-weight:700;padding:6px 14px;border-radius:99px;background:var(--c);color:#fff!important}' +
    '.hwh-btn.ok{background:var(--hw-ok-soft);color:var(--hw-ok)!important}' +
    /* specialties */
    '.hwh-sp{display:flex;flex-wrap:wrap;gap:8px}.hwh-sp a{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:99px;border:1px solid var(--hw-line);background:var(--hw-bg);font-size:13.5px}' +
    '.hwh-sp i{width:10px;height:10px;border-radius:50%;background:var(--c)}' +
    /* rows: swipe on phones, grid on desktop */
    '.hwh-row{display:grid;grid-auto-flow:column;grid-auto-columns:72%;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:6px;scrollbar-width:none}.hwh-row::-webkit-scrollbar{display:none}' +
    '@media(min-width:768px){.hwh-row{grid-auto-flow:row;grid-template-columns:repeat(3,1fr);grid-auto-columns:auto;overflow:visible}}' +
    '.hwh-pc{scroll-snap-align:start;display:grid;grid-template-rows:auto 1fr;border-radius:16px;overflow:hidden;border:1px solid var(--hw-line);background:var(--hw-bg)}' +
    '.hwh-pc>span{display:grid;place-items:center;aspect-ratio:16/9;background:color-mix(in srgb,var(--c) 12%,transparent);color:var(--c)}.hwh-pc>span>span{width:44px;height:44px}' +
    '.hwh-pc img{width:100%;height:100%;object-fit:cover;display:block}.hwh-pc b{display:block;padding:10px 12px 12px;font-size:14px;line-height:1.5}' +
    /* about */
    '.hwh-ab{padding:18px;border-radius:18px;background:var(--hw-accent-soft);border:1px solid var(--hw-line)}.hwh-ab b{display:block;font-size:16.5px;margin-bottom:6px}' +
    '.hwh-ab p{margin:0 0 12px;font-size:14px;line-height:1.85;color:var(--hw-muted)}.hwh-ab .hwh-btns{display:flex;flex-wrap:wrap;gap:8px}' +
    '.hwh-ab button,.hwh-ab a{font:inherit;font-size:13.5px;font-weight:700;padding:8px 16px;border-radius:99px;cursor:pointer;border:1px solid var(--hw-accent);background:var(--hw-accent);color:#fff}' +
    '.hwh-ab a{background:transparent;color:var(--hw-accent-ink)}' +
    '.hwh-sk{height:90px;border-radius:16px;background:var(--hw-bg-soft)}';
  function inject() { if (d.getElementById('hwh-css')) return; var s = d.createElement('style'); s.id = 'hwh-css'; s.textContent = CSS; d.head.appendChild(s); }
  function iBox(name, c, size) { return '<span class="hwh-i" style="--c:' + c + (size ? ';--s:' + size + 'px' : '') + '">' + ic(name) + '</span>'; }
  function user() { return w.HawiAcct && w.HawiAcct.user || null; }

  /* ---------- Blogger feeds (summary; same origin) ---------- */
  var cache = {};
  function feed(label, max) {
    var k = label + '|' + max;
    if (cache[k]) return cache[k];
    if (!H.isBlog()) return Promise.resolve([]);
    return (cache[k] = fetch('/feeds/posts/summary/-/' + encodeURIComponent(label) + '?alt=json&max-results=' + max)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return ((j && j.feed && j.feed.entry) || []).map(parse).filter(Boolean); })
      .catch(function () { delete cache[k]; return []; }));
  }
  function parse(e) {
    var lk = (e.link || []).filter(function (l) { return l.rel === 'alternate'; })[0]; if (!lk) return null;
    var path; try { path = new URL(lk.href, location.href).pathname; } catch (x) { path = lk.href; }
    var tp = String((e.title && e.title.$t) || '').split(' | ');
    var seg = String((e.summary && e.summary.$t) || '').split('‖').map(function (s) { return s.trim(); });
    var tok = /^([a-z]{2})-(\d)-(\d+)-([mf])$/.exec(seg[3] || '') || [];
    var labels = (e.category || []).map(function (c) { return c.term; });
    var sp = tok[1] && SP[tok[1]] ? tok[1] : SPK.filter(function (k) { return labels.indexOf(SP[k].lb) > -1; })[0] || null;
    var th = e.media$thumbnail && e.media$thumbnail.url;
    return {
      u: path, t: { ar: tp[0], en: tp[1] || tp[0], tr: tp[2] || tp[1] || tp[0] },
      cc: seg.length > 3 ? { ar: seg[0], en: seg[1], tr: seg[2] } : null,
      sp: sp, lv: tok[2] ? +tok[2] : 0, age: tok[3] || '', sex: tok[4] || '',
      img: th ? th.replace(/\/s\d+(-c)?\//, '/w640-h360-c/') : ''
    };
  }
  /* case of the day: same pick for every visitor on a given (local) day, stable while the list does not change */
  function dayNo() { var t = new Date(); return Math.floor(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) / 864e5); }
  function daily() {
    return feed('Clinical Cases', 150).then(function (all) {
      if (!all.length) return null;
      var list = all.slice().sort(function (a, b) { return a.u < b.u ? -1 : 1; });
      return list[(dayNo() * 7919) % list.length];
    });
  }
  function caseRec(u) { var all = H.prog('case').all(); for (var id in all) if (all[id] && all[id].u === u) return all[id]; return null; }

  /* ---------- blocks ---------- */
  var BLOCKS = {
    hero: function (box) {
      var u = user(), h = new Date().getHours(), name = u && u.name ? ' ' + String(u.name).split(' ')[0] : '';
      var hi = h >= 4 && h < 12 ? L.morning : L.evening;
      /* newest progress record of any app */
      var last = null;
      Object.keys(PROG).forEach(function (app) {
        var all = H.prog(app).all();
        Object.keys(all).forEach(function (id) { var r = all[id]; if (r && r.u && r.t && (!last || r.at > last.r.at)) last = { app: app, r: r }; });
      });
      var due = H.cards.due(), nDue = due.rev + due.learn + Math.min(due.fresh, H.cards.pref().perDay), nMist = H.log.list().length;
      var html = '<div class="hwh-hi"><small>' + bi(hi) + esc(name) + '</small><b>' + bi(L.ask) + '</b></div>' +
        '<form class="hwh-q" action="/search" method="get" role="search"><span>' + ic('search') + '</span><input type="search" name="q" autocomplete="off" aria-label="' + esc(H.t(L.ph)) + '" placeholder="' + esc(H.t(L.ph)) + '"></form>' +
        '<div class="hwh-g">';
      if (last) {
        var s = PROG[last.app], r = last.r;
        html += '<a class="hwh-big" href="' + esc(r.u) + '">' + iBox(s.id, '#fff', 46) + '<span><small>' + bi(L.cont) + ' · ' + bi(s.n) + '</small><b>' + bi(r.t) + '</b>' +
          (r.best != null ? '<em>' + bi(T(L.best, { n: r.best })) + '</em>' : '') + '</span><span>' + ic('arrow') + '</span></a>';
      } else {
        html += '<p class="hwh-intro">' + bi(L.intro) + '</p>' +
          '<a class="hwh-big js-first" href="' + SECTIONS[0].u + '">' + iBox('play', '#fff', 46) + '<span><small>' + bi(L.dailyK) + '</small><b>' + bi(L.first) + '</b><em>' + bi(L.firstS) + '</em></span><span>' + ic('arrow') + '</span></a>' +
          (u ? '' : '<button type="button" class="hwh-sign js-sign">' + bi(L.signup) + '</button>');
      }
      html += '<a class="hwh-mini" href="/p/cards.html">' + iBox('cards', '#d9730d') + '<span><small>' + bi(L.review) + '</small><b>' + bi(nDue ? T(L.cardsN, { n: nDue }) : L.noRev) + '</b></span></a>' +
        '<a class="hwh-mini" href="/p/mistakes-log.html">' + iBox('log', '#c4352b') + '<span><small>' + bi(L.mist) + '</small><b>' + bi(nMist ? T(L.mistN, { n: nMist }) : L.noMist) + '</b></span></a></div>';
      box.innerHTML = html;
      if (!last) daily().then(function (c) { var a = box.querySelector('.js-first'); if (c && a) a.href = c.u; });
    },
    sections: function (box) {
      box.innerHTML = '<h2 class="hwh-h">' + bi(L.secT) + '</h2><div class="hwh-tiles">' + SECTIONS.map(function (s) {
        var inner = iBox(s.id, s.c) + '<b>' + bi(s.n) + '</b><small>' + bi(s.s) + '</small>';
        return s.soon || !s.u ? '<div class="hwh-tile soon" aria-disabled="true">' + inner + '<i>' + bi(L.soon) + '</i></div>' : '<a class="hwh-tile" href="' + esc(s.u) + '">' + inner + '</a>';
      }).join('') + '</div>';
    },
    daily: function (box) {
      box.innerHTML = '<h2 class="hwh-h">' + bi(L.dailyT) + '</h2><div class="hwh-sk"></div>';
      daily().then(function (c) {
        if (!c) { box.remove(); return; }
        var sp = SP[c.sp], col = sp ? sp.c : '#0c9784', r = caseRec(c.u);
        var meta = [sp ? '<em>' + bi(sp.n) + '</em>' : '', c.sex ? bi(SEX[c.sex]) : '', c.age ? bi(T(L.years, { n: c.age })) : '', LV[c.lv] ? bi(LV[c.lv]) : '']
          .filter(Boolean).join(' · ');
        box.innerHTML = '<h2 class="hwh-h">' + bi(L.dailyT) + '</h2><a class="hwh-day" style="--c:' + col + '" href="' + esc(c.u) + '">' +
          (c.img ? '<img src="' + esc(c.img.replace('/w640-h360-c/', '/w128-h128-c/')) + '" alt="" loading="lazy">' : iBox('cases', col, 64)) +
          '<span><small>' + bi(L.dailyK) + (meta ? ' · ' + meta : '') + '</small><b>' + bi(c.t) + '</b>' +
          (r && r.best != null ? '<span class="hwh-btn ok">' + bi(T(L.done, { n: r.best })) + '</span>' : '<span class="hwh-btn">' + bi(L.solve) + '</span>') + '</span></a>';
      });
    },
    spec: function (box) {
      box.innerHTML = '<h2 class="hwh-h">' + bi(L.specT) + '</h2><div class="hwh-sp">' + SPK.map(function (k) {
        return '<a href="/search/label/' + encodeURIComponent(SP[k].lb) + '" style="--c:' + SP[k].c + '"><i></i>' + bi(SP[k].n) + '</a>';
      }).join('') + '</div>';
    },
    rows: function (box) {
      box.style.display = 'grid'; box.style.gap = '22px';
      ROWS.forEach(function (row) {
        var el = d.createElement('div'); box.appendChild(el);
        feed(row.lb, 6).then(function (list) {
          if (!list.length) { el.remove(); return; }
          el.innerHTML = '<h2 class="hwh-h">' + bi(row.n) + '<a href="' + esc(row.u) + '">' + bi(L.all) + '</a></h2><div class="hwh-row">' + list.map(function (p) {
            var col = p.sp && SP[p.sp] ? SP[p.sp].c : row.c;
            return '<a class="hwh-pc" style="--c:' + col + '" href="' + esc(p.u) + '"><span>' + (p.img ? '<img src="' + esc(p.img) + '" alt="" loading="lazy">' : '<span>' + ic(row.ic) + '</span>') + '</span><b>' + bi(p.t) + '</b></a>';
          }).join('') + '</div>';
        });
      });
    },
    about: function (box) {
      box.innerHTML = '<div class="hwh-ab"><b>' + bi(L.aboutT) + '</b><p>' + bi(L.aboutP) + '</p><div class="hwh-btns">' +
        (user() ? '' : '<button type="button" class="js-sign">' + bi(L.join) + '</button>') + '<a href="/p/about.html">' + bi(L.aboutL) + '</a></div></div>';
    }
  };

  /* ---------- the app ---------- */
  H.apps.home = function (mount) {
    inject();
    mount.innerHTML = '<div class="hwh"></div>';
    var root = mount.firstChild, ids = String(mount.getAttribute('data-order') || ORDER).split(/[\s,]+/).filter(function (id) { return BLOCKS[id]; }), boxes = {};
    ids.forEach(function (id) { var b = d.createElement('section'); b.className = 'hwh-b hwh-' + id; root.appendChild(b); boxes[id] = b; BLOCKS[id](b); });
    root.addEventListener('click', function (e) {
      var s = e.target.closest && e.target.closest('.js-sign');
      if (s && w.HawiAcct && w.HawiAcct.open) { e.preventDefault(); w.HawiAcct.open(); }
    });
    /* sign-in, sync and reviews change the counts: redraw the blocks that show them */
    var tm;
    function redraw() { clearTimeout(tm); tm = setTimeout(function () { ['hero', 'about'].forEach(function (id) { if (boxes[id]) BLOCKS[id](boxes[id]); }); }, 250); }
    w.addEventListener('hawi:user', redraw);
    w.addEventListener('hawi:store', function (e) { if (e.detail && /:(prog|log)$/.test(e.detail.key)) redraw(); });
  };
  H.boot();
})(window, document);
