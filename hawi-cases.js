/*! Clinical cases hub: all cases (cards + filters) · random case · cases mistakes log · my progress
    | v0.1.1 (ar/en/tr) | requires hawi-core.js v0.4.1
    v0.1.1: "Favourites" status filter + heart on favourite cards (hearts set in each case, hawi-case v0.5)
    Page: <div data-hawi-app="cases"></div> ; tab order: data-order="cases,random,log,progress"
    Data: Blogger feed of label "Clinical Cases" (title "ar | en | tr"; hidden hw-snip line written by the encoder:
          "ar ‖ en ‖ tr ‖ <prefix>-<level>-<age>-<m|f> ‖"); scores from H.prog('case') matched by post path. */
(function (w, d) {
  'use strict';
  var H = w.Hawi; if (!H || !H.prog || !H.order) return;
  var bi = H.bi, icon = H.icon;
  function B(ar, en, tr) { return { ar: ar, en: en, tr: tr }; }
  var SELF = (d.currentScript && d.currentScript.src) || '';
  var BASE = SELF.replace(/[?#].*$/, '').replace(/[^\/]*$/, ''), VQ = (SELF.split('?')[1] ? '?' + SELF.split('?')[1] : '');

  /* specialties: id prefix → label (exact Blogger label), colour, names — same as the theme's card covers */
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
  var L = {
    cases: B('الحالات', 'Cases', 'Vakalar'), random: B('حالة عشوائية', 'Random Case', 'Rastgele Vaka'),
    log: B('سجل الأخطاء', 'Mistakes Log', 'Hata Günlüğü'), progress: B('تقدّمي', 'My Progress', 'İlerlemem'),
    all: B('الكل', 'All', 'Tümü'), spec: B('التخصص', 'Specialty', 'Uzmanlık'), level: B('المستوى', 'Level', 'Seviye'),
    status: B('الحالة', 'Status', 'Durum'), unsolved: B('لم تُحلّ', 'Not solved', 'Çözülmedi'), solved: B('محلولة', 'Solved', 'Çözüldü'),
    weak: B('ضعيفة (أقل من 60)', 'Weak (under 60)', 'Zayıf (60\'ın altı)'),
    fav: B('المفضلة', 'Favourites', 'Favoriler'),
    loading: B('جارٍ تحميل الحالات…', 'Loading cases…', 'Vakalar yükleniyor…'),
    fail: B('تعذّر تحميل الحالات. أعد تحميل الصفحة.', 'Could not load the cases. Please reload the page.', 'Vakalar yüklenemedi. Lütfen sayfayı yenileyin.'),
    none: B('لا حالات تطابق اختيارك.', 'No cases match your filters.', 'Seçiminize uyan vaka yok.'),
    count: B('{n} حالة', '{n} cases', '{n} vaka'),
    best: B('الأفضل', 'Best', 'En iyi'),
    rndT: B('حالة عشوائية', 'A Random Case', 'Rastgele Bir Vaka'),
    rndP: B('اختر التخصص والمستوى، وسنفتح لك حالة لم تحلّها بعد. إن كنت حللت كل الحالات المطابقة فستُفتح أضعفها.',
      'Pick a specialty and level and we will open a case you have not solved yet. If you have solved them all, the weakest one opens.',
      'Uzmanlık ve seviye seçin; henüz çözmediğiniz bir vaka açılır. Uyan tüm vakaları çözdüyseniz en zayıfı açılır.'),
    go: B('افتح حالة', 'Open a case', 'Vaka aç'),
    left: B('لم تُحلّ: {a} من {b}', 'Not solved: {a} of {b}', 'Çözülmeyen: {b} vakadan {a}'),
    progT: B('تقدّمي في الحالات', 'My Progress in Cases', 'Vakalardaki İlerlemem'),
    avg: B('متوسط أفضل درجاتك', 'Average best score', 'En iyi puan ortalaması'),
    solvedOf: B('{a} من {b} محلولة', '{a} of {b} solved', '{b} vakadan {a} çözüldü'),
    local: B('يُحفظ تقدّمك على هذا الجهاز.', 'Your progress is kept on this device.', 'İlerlemeniz bu cihazda saklanır.')
  };
  function T(tpl, v) { var o = {}; ['ar', 'en', 'tr'].forEach(function (l) { o[l] = tpl[l].replace(/\{(\w+)\}/g, function (_, k) { return v[k] != null ? v[k] : ''; }); }); return o; }

  var CSS = '.hwc{display:grid;gap:12px;grid-template-columns:minmax(0,1fr)}.hwc>*,.hwc .hw-panels,.hwc .hw-panel{min-width:0}' +
    '.hwc-f{display:grid;gap:8px}.hwc-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}' +
    '.hwc-row>small{font-size:12px;color:var(--hw-muted);min-width:64px}' +
    '.hwc-chip{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:13px;padding:5px 12px;border-radius:999px;border:1px solid var(--hw-line);background:transparent;color:inherit;cursor:pointer}' +
    '.hwc-chip[aria-pressed=true]{background:var(--hw-accent);border-color:var(--hw-accent);color:#fff}' +
    '.hwc-chip i{width:8px;height:8px;border-radius:50%;display:inline-block}' +
    '.hwc-chip svg{width:14px;height:14px;color:#c4352b}.hwc-chip[aria-pressed=true] svg{color:#fff}.hwc-chip svg *{fill:currentColor!important}' +
    '.hwc-card{position:relative}.hwc-fav{position:absolute;bottom:8px;inset-inline-end:10px;color:#c4352b;line-height:0}.hwc-fav svg{width:16px;height:16px}.hwc-fav svg *{fill:currentColor!important}' +
    '.hwc-n{font-size:13px;line-height:1.7;color:var(--hw-muted);margin:4px 0 8px}' +
    '.hwc-grid{display:grid;gap:12px;grid-template-columns:1fr}@media(min-width:640px){.hwc-grid{grid-template-columns:1fr 1fr}}' +
    '.hwc-card{display:flex;gap:12px;align-items:flex-start;padding:14px;border-radius:var(--hw-radius);border:1px solid var(--hw-line);background:var(--hw-bg);color:inherit;text-decoration:none;border-inline-start:4px solid var(--sp);transition:transform .15s,box-shadow .15s}' +
    '.hwc-card:hover{transform:translateY(-2px);box-shadow:0 8px 22px -12px rgba(0,0,0,.35)}' +
    '.hwc-ava{flex:0 0 52px;width:52px;height:52px;border-radius:12px;overflow:hidden;display:grid;place-items:center;background:color-mix(in srgb,var(--sp) 14%,transparent);color:var(--sp)}' +
    '.hwc-ava img{width:100%;height:100%;object-fit:cover}.hwc-ava svg{width:26px;height:26px;fill:none}' +
    '.hwc-b{flex:1;min-width:0}.hwc-b b{display:block;font-size:15.5px;line-height:1.45}' +
    '.hwc-m{display:block;font-size:12px;color:var(--hw-muted);margin-bottom:2px}.hwc-m em{font-style:normal;color:var(--sp);font-weight:700}' +
    '.hwc-cc{display:block;font-size:13px;color:var(--hw-muted);line-height:1.6;margin-top:4px}' +
    '.hwc-card .hw-ring{margin-inline-start:auto}' +
    '.hwc-bar{height:8px;border-radius:99px;background:var(--hw-line);overflow:hidden;margin-top:6px}.hwc-bar i{display:block;height:100%;background:var(--sp,var(--hw-accent))}' +
    '.hwc-pr{display:grid;gap:14px}.hwc-pr li{list-style:none}.hwc-pr ul{margin:0;padding:0;display:grid;gap:14px}' +
    '.hwc-pr .hwc-ph{display:flex;justify-content:space-between;gap:8px;font-size:14px}.hwc-pr .hwc-ph small{color:var(--hw-muted)}' +
    '.hwc-note{font-size:12.5px;color:var(--hw-muted);text-align:center;margin:4px 0 0}';
  function inject() {
    if (d.getElementById('hwc-css')) return;
    var st = d.createElement('style'); st.id = 'hwc-css'; st.textContent = CSS; d.head.appendChild(st);
  }
  /* stethoscope (generic case icon) */
  var ICO = '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h-1a2 2 0 0 0 -2 2v3.5a5.5 5.5 0 0 0 11 0v-3.5a2 2 0 0 0 -2 -2h-1M8 15a6 6 0 1 0 12 0v-3M11 3v2M6 3v2M18 10a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/></svg>';
  function ring(sc) {
    var c = sc >= 75 ? 'var(--hw-ok)' : sc >= 40 ? 'var(--hw-warn)' : 'var(--hw-bad)';
    return '<div class="hw-ring hw-ring--sm" style="--p:' + sc + ';--c:' + c + '"><span>' + sc + '</span></div>';
  }

  /* ---------- data: all posts labelled "Clinical Cases" ---------- */
  var cache = null;
  function parse(e) {
    var lk = (e.link || []).filter(function (l) { return l.rel === 'alternate'; })[0]; if (!lk) return null;
    var path; try { path = new URL(lk.href, location.href).pathname; } catch (x) { path = lk.href; }
    var tp = String((e.title && e.title.$t) || '').split(' | ');
    var sum = String((e.summary && e.summary.$t) || ''), seg = sum.split('‖').map(function (s) { return s.trim(); });
    var tok = /^([a-z]{2})-(\d)-(\d+)-([mf])$/.exec(seg[3] || '') || [];
    var labels = (e.category || []).map(function (c) { return c.term; });
    var sp = tok[1] && SP[tok[1]] ? tok[1] : SPK.filter(function (k) { return labels.indexOf(SP[k].lb) > -1; })[0] || null;
    var th = e.media$thumbnail && e.media$thumbnail.url;
    return {
      u: path, t: { ar: tp[0], en: tp[1] || tp[0], tr: tp[2] || tp[1] || tp[0] },
      cc: seg.length > 3 ? { ar: seg[0], en: seg[1], tr: seg[2] } : null,
      sp: sp, lv: tok[2] ? +tok[2] : 0, age: tok[3] || '', sex: tok[4] || '',
      img: th ? th.replace(/\/s\d+(-c)?\//, '/w120-h120-c/') : '',
      at: Date.parse((e.published && e.published.$t) || '') || 0
    };
  }
  function load() {
    if (cache) return cache;
    if (!H.isBlog()) return (cache = Promise.reject(new Error('not blogger')));
    var all = [], N = 150;
    function page(i) {
      return fetch('/feeds/posts/summary/-/Clinical%20Cases?alt=json&max-results=' + N + '&start-index=' + i)
        .then(function (r) { if (!r.ok) throw new Error('feed ' + r.status); return r.json(); })
        .then(function (j) {
          var es = (j && j.feed && j.feed.entry) || [];
          es.forEach(function (e) { var x = parse(e); if (x) all.push(x); });
          return es.length === N && i < 2000 ? page(i + N) : all;
        });
    }
    cache = page(1).catch(function (e) { cache = null; throw e; });
    return cache;
  }
  /* favourites (set by the heart in each case, hawi-case v0.5): case:data {fav:{<post path>:{t, at}}} */
  var HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.4C1.4 7.6 3.7 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.3 0 5.6 3.1 4.3 6.6-1.8 4.8-9.3 9.4-9.3 9.4z"/></svg>';
  function favs() { var x = H.store.get('case:data', null); return x && x.fav ? x.fav : {}; }
  var FV = {}; /* read once per redraw */
  /* progress records by post path */
  function scores() {
    var all = H.prog('case').all(), by = {};
    Object.keys(all).forEach(function (id) { var r = all[id]; if (r && r.u) by[r.u] = r; });
    return by;
  }

  /* ---------- the app ---------- */
  H.apps.cases = function (mount) {
    inject();
    mount.innerHTML = '<div class="hw-case hwc"><div class="js-top"></div><p class="hwc-note">' + bi(L.local) + '</p></div>';
    var f = { sp: '*', lv: '*', st: '*' };
    var tabs = H.order([
      { id: 'cases', label: L.cases, render: function (p) { withData(p, function (list) { casesTab(p, list); }); } },
      { id: 'random', label: L.random, render: function (p) { withData(p, function (list) { randomTab(p, list); }); } },
      { id: 'log', label: L.log, render: logTab },
      { id: 'progress', label: L.progress, render: function (p) { withData(p, function (list) { progressTab(p, list); }); } }
    ], mount.getAttribute('data-order'));
    var top = H.tabs(mount.querySelector('.js-top'), { variant: 'line', hash: true, tabs: tabs,
      onChange: function (id) { var x = top && top.panel(id); if (x && x._redraw) x._redraw(); } });

    function withData(p, cb) {
      p.innerHTML = '<p class="hwc-n">' + bi(L.loading) + '</p>';
      load().then(function (list) { cb(list.slice().sort(function (a, b) { return b.at - a.at; })); })
        .catch(function () { p.innerHTML = '<section class="hw-card"><p>' + bi(L.fail) + '</p></section>'; });
    }
    function present(list, key) {
      var seen = {}; list.forEach(function (c) { if (c[key]) seen[c[key]] = 1; }); return seen;
    }
    /* filter chips; onPick re-renders */
    function chips(list, keys, onPick) {
      var sps = present(list, 'sp'), lvs = present(list, 'lv');
      function row(k, label, opts) {
        return '<div class="hwc-row" role="group"><small>' + bi(label) + '</small>' + [['*', L.all, null]].concat(opts).map(function (o) {
          return '<button type="button" class="hwc-chip" data-k="' + k + '" data-v="' + o[0] + '" aria-pressed="' + (String(f[k]) === String(o[0])) + '">' +
            (o[2] ? '<i style="background:' + o[2] + '"></i>' : '') + (o[3] ? HEART : '') + bi(o[1]) + '</button>';
        }).join('') + '</div>';
      }
      var html = '<div class="hwc-f">';
      if (keys.indexOf('sp') > -1) html += row('sp', L.spec, SPK.filter(function (k) { return sps[k]; }).map(function (k) { return [k, SP[k].n, SP[k].c]; }));
      if (keys.indexOf('lv') > -1) html += row('lv', L.level, [1, 2, 3].filter(function (k) { return lvs[k]; }).map(function (k) { return [k, LV[k], null]; }));
      if (keys.indexOf('st') > -1) html += row('st', L.status, [['un', L.unsolved], ['ok', L.solved], ['weak', L.weak], ['fav', L.fav, null, true]]);
      html += '</div>';
      return { html: html, bind: function (root) {
        root.querySelectorAll('.hwc-chip').forEach(function (b) {
          b.addEventListener('click', function () { f[b.getAttribute('data-k')] = b.getAttribute('data-v'); onPick(); });
        });
      } };
    }
    function match(c, sc, keys) {
      var r = sc[c.u];
      if (keys.indexOf('sp') > -1 && f.sp !== '*' && c.sp !== f.sp) return false;
      if (keys.indexOf('lv') > -1 && f.lv !== '*' && String(c.lv) !== String(f.lv)) return false;
      if (keys.indexOf('st') > -1) {
        if (f.st === 'un' && r) return false;
        if (f.st === 'ok' && !r) return false;
        if (f.st === 'weak' && !(r && (r.best || 0) < 60)) return false;
        if (f.st === 'fav' && !FV[c.u]) return false;
      }
      return true;
    }

    function casesTab(p, list) {
      var keys = ['sp', 'lv', 'st'];
      function draw() {
        FV = favs();
        var sc = scores(), ch = chips(list, keys, draw), shown = list.filter(function (c) { return match(c, sc, keys); });
        p.innerHTML = '<section class="hw-card">' + ch.html + '<p class="hwc-n">' + bi(T(L.count, { n: shown.length })) + '</p></section>' +
          (shown.length ? '<div class="hwc-grid">' + shown.map(function (c) { return card(c, sc[c.u]); }).join('') + '</div>' :
            '<section class="hw-card"><p>' + bi(L.none) + '</p></section>');
        ch.bind(p);
      }
      p._redraw = draw; draw();
    }
    function card(c, r) {
      var s = SP[c.sp] || { c: 'var(--hw-accent)', n: null };
      var meta = [s.n ? '<em>' + bi(s.n) + '</em>' : '', c.sex ? bi(SEX[c.sex]) : ''].filter(Boolean).join(' · ');
      return '<a class="hwc-card" style="--sp:' + s.c + '" href="' + H.esc(c.u) + '">' +
        '<span class="hwc-ava">' + (c.img ? '<img loading="lazy" alt="" src="' + H.esc(c.img) + '">' : ICO) + '</span>' +
        '<span class="hwc-b"><span class="hwc-m">' + meta + (c.lv && LV[c.lv] ? ' <span class="hw-lvl lv-' + c.lv + '">' + bi(LV[c.lv]) + '</span>' : '') + '</span>' +
        '<b>' + bi(c.t) + '</b>' + (c.cc ? '<span class="hwc-cc">' + bi(c.cc) + '</span>' : '') + '</span>' +
        (r && r.best != null ? ring(r.best) : '') + (FV[c.u] ? '<span class="hwc-fav" aria-hidden="true">' + HEART + '</span>' : '') + '</a>';
    }

    function randomTab(p, list) {
      var keys = ['sp', 'lv'];
      function draw() {
        var sc = scores(), ch = chips(list, keys, draw), pool = list.filter(function (c) { return match(c, sc, keys); });
        var un = pool.filter(function (c) { return !sc[c.u]; });
        p.innerHTML = '<section class="hw-card"><h3>' + bi(L.rndT) + '</h3><p class="hwc-n">' + bi(L.rndP) + '</p>' + ch.html +
          '<p class="hwc-n">' + bi(T(L.left, { a: un.length, b: pool.length })) + '</p>' +
          '<div class="hw-acts"><button type="button" class="hw-btn hw-btn--accent js-go"' + (pool.length ? '' : ' disabled') + '>' + icon('bolt') + bi(L.go) + '</button></div></section>';
        ch.bind(p);
        p.querySelector('.js-go').addEventListener('click', function () {
          var c = un.length ? un[Math.floor(Math.random() * un.length)] :
            pool.slice().sort(function (a, b) { return (sc[a.u].best || 0) - (sc[b.u].best || 0); })[0];
          if (c) location.href = c.u;
        });
      }
      p._redraw = draw; draw();
    }

    function logTab(p) {
      p.innerHTML = '<div data-hawi-app="log" data-app="case"></div>';
      if (H.apps.log) { H.boot(p); return; }
      if (d.querySelector('script[data-hwc-log]')) return;
      var s = d.createElement('script'); s.src = BASE + 'hawi-log.js' + VQ; s.setAttribute('data-hwc-log', '');
      s.onload = function () { H.boot(); };
      d.body.appendChild(s);
    }

    function progressTab(p, list) {
      function draw() {
        var sc = scores(), rows = SPK.map(function (k) {
          var cs = list.filter(function (c) { return c.sp === k; }); if (!cs.length) return '';
          var done = cs.filter(function (c) { return sc[c.u]; }), avg = done.length ? Math.round(done.reduce(function (s, c) { return s + (sc[c.u].best || 0); }, 0) / done.length) : 0;
          var pct = Math.round(done.length / cs.length * 100);
          return '<li style="--sp:' + SP[k].c + '"><div class="hwc-ph"><b>' + bi(SP[k].n) + '</b><small>' + bi(T(L.solvedOf, { a: done.length, b: cs.length })) +
            (done.length ? ' · ' + bi(L.avg) + ': <b>' + avg + '</b>' : '') + '</small></div><div class="hwc-bar"><i style="width:' + pct + '%"></i></div></li>';
        }).join('');
        var done = list.filter(function (c) { return sc[c.u]; });
        var avg = done.length ? Math.round(done.reduce(function (s, c) { return s + (sc[c.u].best || 0); }, 0) / done.length) : 0;
        p.innerHTML = '<section class="hw-card hwc-pr"><h3>' + bi(L.progT) + '</h3>' +
          '<div class="hw-stats"><div><b>' + done.length + ' / ' + list.length + '</b>' + bi(L.solved) + '</div><div><b>' + avg + '</b>' + bi(L.avg) + '</div></div>' +
          '<ul>' + rows + '</ul></section>';
      }
      p._redraw = draw; draw();
    }
  };

  if (d.readyState !== 'loading' && H.boot) H.boot();
})(window, document);
