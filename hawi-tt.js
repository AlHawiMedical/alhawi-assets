/*! Tooltips + glossary (ar/en/tr) | v0.2.0 | requires hawi-core.js v0.4.2 (card button: v0.5)
    v0.2: glossary tooltips carry "Add to my cards" (SHAM Cards, card gloss:<key>)
    Shortcodes (in app data through H.fmt, or typed in a Blogger post):
      [[STEMI]]                  -> glossary entry found by its name or an alias (any language)
      [[احتشاء القلب|#stemi]]     -> glossary entry by key
      [[كلمة|شرح قصير]]           -> inline explanation (Syria24News form), written in that language's text
    First occurrence of each term per language only; repeats stay plain text.
    Glossary source is switchable without code changes (default GitHub):
      window.hawiGloss = { src: 'gh' | 'fs', fs: { project: '<firebase project id>', doc: 'glossary/main' }, fallback: true }
    Both sources hold the same string (hawi-glossary.json -> "d": "HW1…"), so switching or going back is one setting. */
(function (w, d) {
  'use strict';
  var H = w.Hawi; if (!H || !H.tt || H.ttInit) return;
  H.ttInit = true;
  function B(ar, en, tr) { return { ar: ar, en: en, tr: tr }; }
  var L = {
    lesson: B('الدرس', 'Lesson', 'Ders'), lib: B('في مكتبة تخطيط القلب', 'In the ECG library', 'EKG kütüphanesinde'),
    rel: B('مواد ذات صلة', 'Related Content', 'İlgili İçerik'), close: B('إغلاق', 'Close', 'Kapat'),
    loading: B('جارٍ التحميل…', 'Loading…', 'Yükleniyor…'),
    add: B('أضف إلى بطاقاتي', 'Add to my cards', 'Kartlarıma ekle'),
    inC: B('في بطاقاتي', 'In my cards', 'Kartlarımda')
  };
  var CARDS = '/p/cards.html';
  function cardBtn(k) {
    if (!H.cards) return '';
    return H.cards.has('gloss:' + k)
      ? '<a class="hw-ttp-c is-in" href="' + CARDS + '">' + H.icon('check') + T(L.inC) + '</a>'
      : '<button type="button" class="hw-ttp-c" data-card="' + H.esc(k) + '">' + T(L.add) + '</button>';
  }

  /* ---------- glossary: load once, from the configured source, with fallback ---------- */
  var CFG = w.hawiGloss || {};
  function fromGh() {
    return fetch(H.base + 'hawi-glossary.json' + H.ver).then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) { return j.d; });
  }
  function fromFs() {
    var f = CFG.fs || {}; if (!f.project) return Promise.reject(0);
    var KEY = 'tt:gloss-fs', TTL = 6 * 3600 * 1000, c = H.store.get(KEY, null);
    if (c && c.d && Date.now() - c.at < TTL) return Promise.resolve(c.d);
    return fetch('https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(f.project) +
      '/databases/(default)/documents/' + (f.doc || 'glossary/main') + '?mask.fieldPaths=d')
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) { var s = j.fields.d.stringValue; H.store.set(KEY, { at: Date.now(), d: s }); return s; });
  }
  var SRC = { gh: fromGh, fs: fromFs }, gloss = null;
  function load() {
    if (gloss) return gloss;
    var order = [CFG.src === 'fs' ? 'fs' : 'gh']; if (CFG.fallback !== false) order.push(order[0] === 'gh' ? 'fs' : 'gh');
    function next(i) {
      if (i >= order.length) return Promise.resolve({ e: [] });
      return SRC[order[i]]().then(H.decode).then(function (g) { H.ttSource = order[i]; return g; }, function () { return next(i + 1); });
    }
    gloss = next(0).then(index);
    return gloss;
  }
  /* Arabic-tolerant matching (from Syria24News tooltip.js): no tashkeel/tatweel, one alif, ى→ي, ة→ه */
  function norm(s) {
    return String(s || '').replace(/<[^>]*>/g, '').replace(/[ً-ْـ]/g, '').replace(/[آأإٱ]/g, 'ا')
      .replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function index(g) {
    var byK = {}, byN = {};
    (g.e || []).forEach(function (x) {
      if (!x || !x.k) return; byK[x.k] = x;
      [x.k].concat(x.n ? [x.n.ar, x.n.en, x.n.tr] : [], x.a || []).forEach(function (n) { if (n) byN[norm(n)] = x; });
    });
    return { k: byK, n: byN };
  }

  /* ---------- plain post bodies: [[…]] typed in the Blogger editor ---------- */
  function scanPost() {
    var host = d.getElementById('postBody'); if (!host || host.textContent.indexOf('[[') < 0) return;
    var tw = d.createTreeWalker(host, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
      var p = n.parentNode; if (!p || /^(SCRIPT|STYLE|TEXTAREA|CODE|PRE)$/.test(p.tagName)) return NodeFilter.FILTER_REJECT;
      if (p.closest('.hw-tt,[data-hawi-app]')) return NodeFilter.FILTER_REJECT;
      return n.nodeValue.indexOf('[[') > -1 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    } }), list = [], n;
    while ((n = tw.nextNode())) list.push(n);
    list.forEach(function (tn) {
      var h = H.tt(H.esc(tn.nodeValue)); if (h.indexOf('hw-tt') < 0) return;
      var tmp = d.createElement('span'); tmp.innerHTML = h;
      var f = d.createDocumentFragment(); while (tmp.firstChild) f.appendChild(tmp.firstChild);
      tn.parentNode.replaceChild(f, tn);
    });
    /* second pass: a shortcode the editor split with <b>, <span style>… (safe text blocks only, as in Syria24News) */
    host.querySelectorAll('p,li,h2,h3,h4,blockquote,td,th').forEach(function (el) {
      if (el.closest('[data-hawi-app]') || el.textContent.indexOf('[[') < 0) return;
      if (/<(img|iframe|video|audio|script|style|svg|canvas|table|form|input|button)\b/i.test(el.innerHTML)) return;
      var n = 0, h = el.innerHTML.replace(BROKEN, function (all, t, x) {
        t = clean(t); x = x == null ? null : clean(x); if (!t || x === '') return all;
        n++; /* keep the editor's tags that were inside the shortcode (e.g. </b>) right after it, so nothing stays open */
        return H.tt(H.esc('[[' + t + (x == null ? '' : '|' + x) + ']]')) + (all.match(/<[^>]+>/g) || []).join('');
      });
      if (n) el.innerHTML = h;
    });
  }

  var BROKEN = /\[\[((?:(?!\]\]|\[\[)[^|]){1,240}?)(?:\|((?:(?!\]\]|\[\[)[\s\S]){1,900}?))?\]\]/g;
  function clean(s) {
    var t = d.createElement('textarea'); t.innerHTML = String(s).replace(/<[^>]*>/g, '');
    return t.value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /* ---------- mark: resolve, first occurrence per (term, language), unknown -> plain ---------- */
  var seen = {};
  function mark(g) {
    d.querySelectorAll('.hw-tt:not([data-tt])').forEach(function (el) {
      var k = el.getAttribute('data-k'), inline = el.hasAttribute('data-d'), x = null;
      if (!inline) {
        x = k ? g.k[k] : g.n[norm(el.textContent)];
        if (!x) { el.setAttribute('data-tt', 'x'); plain(el); return; }
        el.setAttribute('data-k', x.k);
      }
      var lc = el.closest('[lang]'), id = (inline ? 'i:' + norm(el.textContent) : x.k) + '|' + (lc ? lc.getAttribute('lang') : '');
      if (seen[id]) { el.setAttribute('data-tt', 'x'); plain(el); return; }
      seen[id] = 1; el.setAttribute('data-tt', '1');
    });
  }
  function plain(el) { el.removeAttribute('tabindex'); el.removeAttribute('role'); el.classList.add('hw-tt-x'); }
  var tm = 0;
  function rescan() { clearTimeout(tm); tm = setTimeout(function () { load().then(mark); }, 60); }

  /* ---------- popup ---------- */
  var box = null, cur = null, hideT = 0;
  function ensure() {
    if (box) return box;
    box = d.createElement('div'); box.className = 'hw-ttp'; box.setAttribute('role', 'dialog'); box.hidden = true;
    box.addEventListener('mouseenter', function () { clearTimeout(hideT); });
    box.addEventListener('mouseleave', function () { if (!hoverOnly) return; hideT = setTimeout(close, 250); });
    d.body.appendChild(box); return box;
  }
  function T(v) { return H.esc(H.t(v)); }
  function fill(el, g) {
    var lang = H.lang(), html;
    box.setAttribute('lang', lang); box.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    if (el.hasAttribute('data-d')) {
      html = '<p class="hw-ttp-d">' + H.esc(el.getAttribute('data-d').replace(/<[^>]*>/g, '')) + '</p>';
    } else {
      var x = g.k[el.getAttribute('data-k')] || {}, self = location.pathname;
      html = '<b class="hw-ttp-t">' + T(x.n) + '</b><p class="hw-ttp-d">' + H.esc(H.t(x.d)).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') + '</p>';
      var links = '';
      if (x.lib) links += '<li><a href="/p/ecg-academy.html#library/' + H.esc(x.lib) + '">' + T(L.lib) + '</a></li>';
      html += '<ul class="hw-ttp-l">' + links + '</ul>' + cardBtn(x.k);
      if (x.les || x.tag) html += '<div class="hw-ttp-r" hidden></div>';
      setTimeout(function () {
        var ul = box.querySelector('.hw-ttp-l'), r = box.querySelector('.hw-ttp-r'); if (!ul || cur !== el) return;
        var jobs = [x.les ? H.feed(x.les, 1) : Promise.resolve([]), x.tag ? H.feed(x.tag, 6) : Promise.resolve([])];
        Promise.all(jobs).then(function (res) {
          if (cur !== el) return;
          var les = res[0].filter(function (p) { return p.u.indexOf(self) < 0; })[0];
          if (les) ul.insertAdjacentHTML('afterbegin', '<li><a href="' + H.esc(les.u) + '">' + T(L.lesson) + ': ' + T(les.t) + '</a></li>');
          var rel = res[1].filter(function (p) { return p.u.indexOf(self) < 0 && (!les || p.u !== les.u); }).slice(0, 4);
          if (rel.length && r) { r.hidden = false; r.innerHTML = '<small>' + T(L.rel) + '</small><ul class="hw-ttp-l">' +
            rel.map(function (p) { return '<li><a href="' + H.esc(p.u) + '">' + T(p.t) + '</a></li>'; }).join('') + '</ul>'; }
          place(el);
        });
      }, 0);
    }
    box.innerHTML = html + '<button type="button" class="hw-ttp-x" aria-label="' + T(L.close) + '">×</button>';
    box.querySelector('.hw-ttp-x').addEventListener('click', close);
    var cb = box.querySelector('button.hw-ttp-c');
    if (cb) cb.addEventListener('click', function (e) {
      e.stopPropagation(); var k = cb.getAttribute('data-card');
      H.cards.add('gloss:' + k, { how: 'tt' });
      cb.outerHTML = cardBtn(k); place(el);
    });
  }
  function place(el) {
    if (!box || box.hidden) return;
    var rs = el.getClientRects(), r = rs.length ? rs[0] : el.getBoundingClientRect(), vw = d.documentElement.clientWidth, vh = w.innerHeight;
    var bw = Math.min(320, vw - 16); box.style.width = bw + 'px';
    var bh = box.offsetHeight, top = r.top - bh - 10, below = top < 70;
    if (below) top = Math.min(r.bottom + 10, vh - bh - 8);
    var left = Math.max(8, Math.min(r.left + r.width / 2 - bw / 2, vw - bw - 8));
    box.style.top = Math.max(8, top) + 'px'; box.style.left = left + 'px';
    box.classList.toggle('is-below', below);
  }
  var hoverOnly = false;
  function open(el, byHover) {
    if (el.getAttribute('data-tt') !== '1') return;
    clearTimeout(hideT); ensure(); hoverOnly = !!byHover;
    if (cur === el && !box.hidden) { if (!byHover) hoverOnly = false; return; }
    if (cur) cur.classList.remove('is-open');
    cur = el; el.classList.add('is-open'); el.setAttribute('aria-expanded', 'true');
    load().then(function (g) { if (cur !== el) return; fill(el, g); box.hidden = false; place(el); });
  }
  function close() {
    clearTimeout(hideT);
    if (cur) { cur.classList.remove('is-open'); cur.setAttribute('aria-expanded', 'false'); }
    cur = null; if (box) box.hidden = true;
  }
  var canHover = w.matchMedia && w.matchMedia('(hover: hover)').matches;
  d.addEventListener('mouseover', function (e) {
    if (!canHover) return; var el = e.target.closest && e.target.closest('.hw-tt[data-tt="1"]');
    if (el) { clearTimeout(hideT); hideT = setTimeout(function () { open(el, true); }, 120); }
  });
  d.addEventListener('mouseout', function (e) {
    if (!canHover || !hoverOnly) return; var el = e.target.closest && e.target.closest('.hw-tt');
    if (el) { clearTimeout(hideT); hideT = setTimeout(close, 250); }
  });
  d.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('.hw-tt[data-tt="1"]');
    if (el) { e.preventDefault(); if (cur === el && !box.hidden && !hoverOnly) close(); else open(el, false); return; }
    if (box && !box.hidden && !box.contains(e.target)) close();
  });
  d.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { var c = cur; close(); if (c) c.focus(); return; }
    var el = e.target.closest && e.target.closest('.hw-tt[data-tt="1"]');
    if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(el, false); }
  });
  w.addEventListener('scroll', function () { if (cur && box && !box.hidden) place(cur); }, { passive: true });
  w.addEventListener('resize', close);
  d.addEventListener('hawi:lang', close);

  /* ---------- start: convert post shortcodes, then watch apps that render later (tabs, accordions) ---------- */
  scanPost(); rescan();
  new MutationObserver(function (ms) {
    for (var i = 0; i < ms.length; i++) for (var j = 0; j < ms[i].addedNodes.length; j++) {
      var n = ms[i].addedNodes[j]; if (n.nodeType === 1 && n !== box && !(box && box.contains(n)) && (n.classList.contains('hw-tt') || n.querySelector('.hw-tt'))) { rescan(); return; }
    }
  }).observe(d.body, { childList: true, subtree: true });
  H.gloss = load;
})(window, document);
