/*! Mind maps hub: all maps (search + specialty) · my maps (favourites + recent) | v0.1.1 (ar/en/tr) | requires hawi-core.js v0.4.1
    Page: <div data-hawi-app="mindmaps"></div> ; tab order: data-order="maps,mine" ; tab in URL: #mine
    Data: Blogger feed of label "Mind Maps" (title "ar | en | tr"; hidden hw-snip "ar ‖ en ‖ tr ‖ mm.<sp>.<nodes>.<red> ‖");
          favourites/visits from H.prog('mindmap') (records carry t, sp, u, n, fav — written by hawi-mindmap.js). */
(function (w, d) {
  'use strict';
  var H = w.Hawi; if (!H || !H.prog || !H.order) return;
  var bi = H.bi, esc = H.esc;
  function B(ar, en, tr) { return { ar: ar, en: en, tr: tr }; }
  var SP = {
    im: { lb: 'Internal Medicine', c: '#0c9784', n: B('الأمراض الباطنة', 'Internal Medicine', 'İç Hastalıkları') },
    ps: { lb: 'Psychiatry', c: '#6d5bd0', n: B('الطب النفسي', 'Psychiatry', 'Psikiyatri') },
    pd: { lb: 'Pediatrics', c: '#d9730d', n: B('طب الأطفال', 'Pediatrics', 'Çocuk Sağlığı ve Hastalıkları') },
    og: { lb: 'Obstetrics and Gynecology', c: '#c2417a', n: B('النسائية والتوليد', 'Obstetrics and Gynecology', 'Kadın Hastalıkları ve Doğum') },
    sg: { lb: 'Surgery', c: '#2f6fd6', n: B('الجراحة', 'Surgery', 'Cerrahi') }
  };
  var SPK = Object.keys(SP);
  var L = {
    maps: B('الخرائط', 'Maps', 'Haritalar'), mine: B('خرائطي', 'My Maps', 'Haritalarım'), all: B('الكل', 'All', 'Tümü'),
    q: B('ابحث في الخرائط…', 'Search maps…', 'Haritalarda ara…'), n: B('خريطة', 'maps', 'harita'),
    items: B('عنصر', 'items', 'öğe'), red: B('خطر', 'critical', 'kritik'), fav: B('في المفضّلة', 'Favourite', 'Favori'),
    seen: B('مرات الفتح', 'Opened', 'Açılma'), favs: B('المفضّلة', 'Favourites', 'Favoriler'),
    recent: B('آخر ما فتحت', 'Recently opened', 'Son açılanlar'), rm: B('إزالة من المفضّلة', 'Remove from favourites', 'Favorilerden çıkar'),
    none: B('لا نتائج', 'No results', 'Sonuç yok'), empty: B('لم تفتح أي خريطة بعد', 'You have not opened any map yet', 'Henüz harita açmadınız'),
    loading: B('جارٍ التحميل…', 'Loading…', 'Yükleniyor…'), fail: B('تعذّر تحميل الخرائط', 'Could not load the maps', 'Haritalar yüklenemedi'),
    local: B('«خرائطي» محفوظة على هذا الجهاز فقط', '"My Maps" is stored on this device only', '"Haritalarım" yalnızca bu cihazda saklanır')
  };
  var CSS = '.hwm{display:grid;gap:12px;grid-template-columns:minmax(0,1fr)}.hwm *{box-sizing:border-box}.hwm>*,.hwm .hw-panel{min-width:0}' +
    '.hwm-q{width:100%;font:inherit;padding:10px 14px;border-radius:12px;border:1px solid var(--hw-line);background:transparent;color:inherit}' +
    '.hwm-row{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.hwm-chip{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:13px;padding:5px 12px;border-radius:999px;border:1px solid var(--hw-line);background:transparent;color:inherit;cursor:pointer}' +
    '.hwm-chip[aria-pressed=true]{background:var(--hw-accent);border-color:var(--hw-accent);color:#fff}.hwm-chip i{width:8px;height:8px;border-radius:50%}' +
    '.hwm-n{font-size:13px;opacity:.7;margin:4px 0 10px}.hwm-grid{display:grid;gap:12px;grid-template-columns:1fr;list-style:none;margin:0;padding:0}@media(min-width:640px){.hwm-grid{grid-template-columns:1fr 1fr}}' +
    '.hwm-grid>li{margin:0!important;padding:0!important;list-style:none}.hwm-c{position:relative;display:flex;gap:12px;padding:14px;border-radius:14px;border:1px solid var(--hw-line);border-inline-start:4px solid var(--c);color:inherit;text-decoration:none;height:100%}' +
    '.hwm-c:hover{border-color:var(--c)}.hwm-i{flex:none;width:40px;height:40px;border-radius:10px;display:grid;place-items:center;background:color-mix(in srgb,var(--c) 14%,transparent);color:var(--c)}' +
    '.hwm-i svg{width:24px!important;height:24px!important;max-width:none;fill:none}[dir=rtl] .hwm-i svg{transform:scaleX(-1)}.hwm-b{min-width:0;flex:1}' +
    '.hwm-sp{font-size:12px;color:var(--c);font-weight:600}.hwm-t{font-weight:700;margin:2px 0 4px}.hwm-d{font-size:13px;opacity:.8;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}' +
    '.hwm-m{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;font-size:12px}.hwm-m span{padding:1px 8px;border-radius:999px;background:var(--hw-line)}.hwm-m .r{background:#c4352b;color:#fff}' +
    '.hwm-x{position:absolute;top:8px;inset-inline-end:8px;border:0;background:transparent;color:#c4352b;font-size:18px;cursor:pointer;line-height:1}' +
    '.hwm-h{font-weight:700;margin:14px 0 8px}.hwm-note{font-size:12px;opacity:.6;margin:0}';
  var ICO = '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="9" width="6" height="6" rx="1.5"/><rect x="16" y="3" width="6" height="5" rx="1.5"/><rect x="16" y="16" width="6" height="5" rx="1.5"/><path d="M8 12h4M12 5.5v13M12 5.5h4M12 18.5h4"/></svg>';
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
      .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function pathOf(u) { try { return new URL(u, location.href).pathname; } catch (e) { return u; } }

  var cache = null;
  function parse(e) {
    var lk = (e.link || []).filter(function (l) { return l.rel === 'alternate'; })[0]; if (!lk) return null;
    var tp = String((e.title && e.title.$t) || '').split(' | ');
    var seg = String((e.summary && e.summary.$t) || '').split('‖').map(function (s) { return s.trim(); });
    var tok = /^mm\.([a-z]{2})\.(\d+)\.(\d+)$/.exec(seg[3] || '') || [];
    var labels = (e.category || []).map(function (c) { return c.term; });
    var sp = tok[1] && SP[tok[1]] ? tok[1] : SPK.filter(function (k) { return labels.indexOf(SP[k].lb) > -1; })[0] || null;
    var dsc = seg.length > 3 ? B(seg[0], seg[1], seg[2]) : B(seg[0], seg[0], seg[0]);
    return { u: pathOf(lk.href), t: B(tp[0], tp[1] || tp[0], tp[2] || tp[1] || tp[0]), d: dsc, sp: sp,
      nn: tok[2] ? +tok[2] : 0, nr: tok[3] ? +tok[3] : 0, at: Date.parse((e.published && e.published.$t) || '') || 0 };
  }
  function load() {
    if (cache) return cache;
    if (!H.isBlog()) return (cache = Promise.reject(new Error('not blogger')));
    cache = fetch('/feeds/posts/summary/-/Mind%20Maps?alt=json&max-results=500')
      .then(function (r) { if (!r.ok) throw new Error('feed'); return r.json(); })
      .then(function (j) { return ((j.feed && j.feed.entry) || []).map(parse).filter(Boolean).sort(function (a, b) { return b.at - a.at; }); })
      .catch(function (e) { cache = null; throw e; });
    return cache;
  }
  function recs() { var all = H.prog('mindmap').all(), by = {}; Object.keys(all).forEach(function (id) { var r = all[id]; if (r && r.u) { r._id = id; by[r.u] = r; } }); return by; }

  function card(m, r, rm) {
    var s = SP[m.sp] || { c: 'var(--hw-accent)', n: null }, meta = [];
    if (m.nn) meta.push('<span>' + m.nn + ' ' + bi(L.items) + '</span>');
    if (m.nr) meta.push('<span class="r">' + m.nr + ' ' + bi(L.red) + '</span>');
    if (r && r.fav) meta.push('<span>♥ ' + bi(L.fav) + '</span>');
    if (r && r.n) meta.push('<span>' + bi(L.seen) + ': ' + r.n + '</span>');
    return '<li><a class="hwm-c" style="--c:' + s.c + '" href="' + esc(m.u) + '"><span class="hwm-i">' + ICO + '</span><span class="hwm-b">' +
      (s.n ? '<div class="hwm-sp">' + bi(s.n) + '</div>' : '') + '<div class="hwm-t">' + bi(m.t) + '</div>' +
      (m.d && m.d.ar ? '<div class="hwm-d">' + bi(m.d) + '</div>' : '') + (meta.length ? '<div class="hwm-m">' + meta.join('') + '</div>' : '') + '</span></a>' +
      (rm ? '<button type="button" class="hwm-x" data-rm="' + esc(rm) + '" title="' + esc(H.t(L.rm)) + '" aria-label="' + esc(H.t(L.rm)) + '">♥</button>' : '') + '</li>';
  }

  H.apps.mindmaps = function (mount) {
    if (!d.getElementById('hwm-css')) { var st = d.createElement('style'); st.id = 'hwm-css'; st.textContent = CSS; d.head.appendChild(st); }
    mount.innerHTML = '<div class="hw-case hwm"><div class="js-top"></div><p class="hwm-note">' + bi(L.local) + '</p></div>';
    var f = { q: '', sp: '*' };
    var top = H.tabs(mount.querySelector('.js-top'), { variant: 'line', hash: true, tabs: H.order([
      { id: 'maps', label: L.maps, render: mapsTab }, { id: 'mine', label: L.mine, render: mineTab }
    ], mount.getAttribute('data-order')), onChange: function (id) { var x = top && top.panel(id); if (x && x._redraw) x._redraw(); } });

    function mapsTab(p) {
      p.innerHTML = '<p class="hwm-n">' + bi(L.loading) + '</p>';
      load().then(function (list) {
        var has = {}; list.forEach(function (m) { if (m.sp) has[m.sp] = 1; });
        var sps = SPK.filter(function (k) { return has[k]; });
        p.innerHTML = '<input type="search" class="hwm-q" autocomplete="off">' +
          (sps.length > 1 ? '<div class="hwm-row">' + ['*'].concat(sps).map(function (k) {
            return '<button type="button" class="hwm-chip" data-sp="' + k + '" aria-pressed="' + (f.sp === k) + '">' + (SP[k] ? '<i style="background:' + SP[k].c + '"></i>' + bi(SP[k].n) : bi(L.all)) + '</button>';
          }).join('') + '</div>' : '') + '<p class="hwm-n js-n"></p><ul class="hwm-grid js-g"></ul>';
        var q = p.querySelector('.hwm-q'); q.value = f.q;
        function ph() { q.placeholder = H.t(L.q); } ph();
        new MutationObserver(ph).observe(d.documentElement, { attributes: true, attributeFilter: ['data-lang', 'dir', 'lang'] });
        function draw() {
          var R = recs(), k = norm(f.q).trim();
          var out = list.filter(function (m) {
            if (f.sp !== '*' && m.sp !== f.sp) return false;
            return !k || norm([m.t.ar, m.t.en, m.t.tr, m.d.ar, m.d.en, m.d.tr].join(' ')).indexOf(k) > -1;
          });
          p.querySelector('.js-n').innerHTML = out.length + ' ' + bi(L.n);
          p.querySelector('.js-g').innerHTML = out.length ? out.map(function (m) { return card(m, R[m.u]); }).join('') : '<li class="hwm-n">' + bi(L.none) + '</li>';
        }
        q.addEventListener('input', function () { f.q = q.value; draw(); });
        p.addEventListener('click', function (e) {
          var b = e.target.closest('[data-sp]'); if (!b) return; f.sp = b.getAttribute('data-sp');
          p.querySelectorAll('[data-sp]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); draw();
        });
        p._redraw = draw; draw();
      }).catch(function () { p.innerHTML = '<section class="hw-card"><p>' + bi(L.fail) + '</p></section>'; });
    }

    function mineTab(p) {
      function draw() {
        var P = H.prog('mindmap'), all = P.all(), rs = Object.keys(all).map(function (id) { var r = all[id]; r._id = id; return r; }).filter(function (r) { return r && r.u; });
        function m(r) { return { u: r.u, t: r.t || B(r.u, r.u, r.u), d: null, sp: r.sp && SP[r.sp] ? r.sp : null }; }
        var fv = rs.filter(function (r) { return r.fav; }).sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
        var rc = rs.slice().sort(function (a, b) { return (b.at || 0) - (a.at || 0); }).slice(0, 12);
        p.innerHTML = !rs.length ? '<p class="hwm-n">' + bi(L.empty) + '</p>' :
          (fv.length ? '<div class="hwm-h">' + bi(L.favs) + '</div><ul class="hwm-grid">' + fv.map(function (r) { return card(m(r), r, r._id); }).join('') + '</ul>' : '') +
          '<div class="hwm-h">' + bi(L.recent) + '</div><ul class="hwm-grid">' + rc.map(function (r) { return card(m(r), r); }).join('') + '</ul>';
      }
      p.addEventListener('click', function (e) {
        var b = e.target.closest('[data-rm]'); if (!b) return; e.preventDefault();
        var P = H.prog('mindmap'), id = b.getAttribute('data-rm'), r = P.get(id); if (r) { r.fav = false; P.set(id, r); } draw();
      });
      p._redraw = draw; draw();
    }
  };
  if (d.readyState !== 'loading' && H.boot) H.boot();
})(window, document);
