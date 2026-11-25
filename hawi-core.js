/*! Core: i18n helpers (ar/en/tr), tabs engine, accordion, modal, storage (progress + mistakes log), related posts, tab order | v0.4.1 */
(function (w, d) {
  'use strict';
  var H = w.Hawi = w.Hawi || {};
  H.version = '0.4.1';
  H.apps = H.apps || {};

  /* ---------- text & i18n ---------- */
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  H.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); };
  /* minimal markup: **bold** */
  H.fmt = function (s) { return H.esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); };
  H.LANGS = ['ar', 'en', 'tr'];
  H.lang = function () {
    if (w.hawiLang && w.hawiLang.get) return w.hawiLang.get();
    var l = d.documentElement.getAttribute('data-lang');
    return H.LANGS.indexOf(l) > -1 ? l : 'ar';
  };
  function has(s) { return s != null && String(s).trim() !== ''; }
  /* multilingual value -> one span per language (switching needs no re-render).
     tr is optional: when missing, Turkish readers see the English span (CSS fallback). */
  H.bi = function (v) {
    if (v == null) return '';
    if (typeof v !== 'object') return H.fmt(v);
    var ar = v.ar != null ? v.ar : v.en, en = v.en != null ? v.en : v.ar, tr = has(v.tr) ? v.tr : null;
    if (ar === en && (tr == null || tr === en)) return H.fmt(ar);
    return '<span class="lng-ar" lang="ar">' + H.fmt(ar) + '</span><span class="lng-en" lang="en">' + H.fmt(en) + '</span>' +
      (tr != null ? '<span class="lng-tr" lang="tr">' + H.fmt(tr) + '</span>' : '');
  };
  /* plain text in the current language (attributes, aria) */
  H.t = function (v) {
    if (v == null) return '';
    if (typeof v !== 'object') return String(v);
    var l = H.lang();
    if (l === 'tr' && has(v.tr)) return v.tr;
    return (l === 'ar' ? (v.ar != null ? v.ar : v.en) : (v.en != null ? v.en : v.ar)) || '';
  };

  /* ---------- data encoding (HW1) ----------
     Obfuscates case data inside posts so answers are not readable in page source
     or copyable by scrapers. Not cryptographic security: it raises the bar. */
  var SECRET = 'alHawi.v1#الحاوي-في-الطب';
  function mixBytes(bytes) {
    var key = new TextEncoder().encode(SECRET), k = key.length, out = new Uint8Array(bytes.length);
    for (var i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ key[i % k] ^ ((i * 31 + 7) & 255);
    return out;
  }
  H.encode = function (obj) {
    var bytes = mixBytes(new TextEncoder().encode(typeof obj === 'string' ? obj : JSON.stringify(obj)));
    var bin = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return 'HW1.' + btoa(bin);
  };
  H.decode = function (str) {
    str = String(str || '').trim();
    if (str.indexOf('HW1.') !== 0) return JSON.parse(str);
    var bin = atob(str.slice(4).replace(/\s+/g, '')), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(mixBytes(bytes)));
  };

  /* ---------- storage (safe) ----------
     One storage layer for every app, so accounts (Firebase) can plug in later without touching the apps.
     Keys: hawi:<app>:prog (progress) · hawi:<app>:log (mistakes) · hawi:<app>:<other> (synced data)
           hawi:<app>:pref (this device only) · hawi:meta (version, device id).
     Every write fires window event 'hawi:store' {key, sync}; a future sync layer listens to it
     (and batches writes) — apps never talk to the server directly. */
  function emit(k) {
    try { w.dispatchEvent(new CustomEvent('hawi:store', { detail: { key: k, sync: H.store.sync(k) } })); } catch (e) {}
  }
  H.store = {
    get: function (k, def) { try { var v = localStorage.getItem('hawi:' + k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set: function (k, v) { try { localStorage.setItem('hawi:' + k, JSON.stringify(v)); } catch (e) {} emit(k); },
    del: function (k) { try { localStorage.removeItem('hawi:' + k); } catch (e) {} emit(k); },
    /* keys (without 'hawi:') that start with a prefix */
    keys: function (pre) {
      var out = [];
      try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('hawi:' + (pre || '')) === 0) out.push(k.slice(5)); } } catch (e) {}
      return out;
    },
    /* goes to the account? only <app>:prog|log|train|data — device prefs, meta and pre-v0.4 keys stay local */
    sync: function (k) { return /^[a-z0-9-]+:(prog|log|train|data)$/.test(k); }
  };
  /* meta: data version + random device id (to tell devices apart when merging) */
  H.meta = function () {
    var m = H.store.get('meta', null);
    if (!m || !m.dev) {
      m = m || {};
      m.v = 2; m.dev = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); m.mig = m.mig || {};
      H.store.set('meta', m);
    }
    return m;
  };
  /* run an app's one-time migration (fn) once per device; old keys are kept (removed in a later version) */
  H.migrate = function (name, fn) {
    var m = H.meta(); if (m.mig && m.mig[name]) return;
    try { fn(); } catch (e) { return; }
    m = H.meta(); m.mig = m.mig || {}; m.mig[name] = Date.now(); H.store.set('meta', m);
  };
  H.path = function () { return location.pathname; };

  /* progress per item: H.prog(app) -> { get(id), set(id, rec), score(id, score, extra), all(), del(id), clear() }
     record: { best, last, n, at, ...app fields } ; merge rule later: best/n = max, the rest from the newest 'at' */
  H.prog = function (app) {
    var K = app + ':prog';
    function load() { var x = H.store.get(K, null); return x && x.r ? x : { v: 1, r: {} }; }
    return {
      get: function (id) { return load().r[id] || null; },
      all: function () { return load().r; },
      set: function (id, rec) { var x = load(); rec.at = Date.now(); x.r[id] = rec; H.store.set(K, x); return rec; },
      score: function (id, score, extra) {
        var x = load(), r = x.r[id] || { best: null, n: 0 };
        r.best = r.best == null ? score : Math.max(r.best, score); r.last = score; r.n = (r.n || 0) + 1; r.at = Date.now();
        if (extra) for (var k in extra) r[k] = extra[k];
        x.r[id] = r; H.store.set(K, x); return r;
      },
      del: function (id) { var x = load(); delete x.r[id]; H.store.set(K, x); },
      clear: function () { H.store.del(K); }
    };
  };

  /* mistakes log, one shape for every app (the general log reads them all):
     entry { id:'app:item:ref', app, it, k:'miss'|'bad'|'step', ref, x:{ar,en,tr} short text, t:{..} item title,
             tags:[], sp, lv, u: path (+#hash) to retry, c: times repeated, at, d: app data }
     H.log.put(app, item, mistakes[{k, ref, x, d}], info{t, tags, sp, lv, u}) keeps the LAST attempt only:
     mistakes no longer made are removed, repeated ones get c+1. Max H.log.MAX per app (oldest dropped). */
  H.log = {
    MAX: 2000,
    APPS: ['case', 'ecg'],
    _load: function (app) { var x = H.store.get(app + ':log', null); return x && x.e ? x : { v: 1, e: {} }; },
    put: function (app, item, list, info) {
      var x = H.log._load(app), now = Date.now(), keep = {};
      info = info || {};
      (list || []).forEach(function (m) {
        var id = app + ':' + item + ':' + m.ref, old = x.e[id];
        keep[id] = 1;
        x.e[id] = {
          id: id, app: app, it: item, k: m.k || 'miss', ref: String(m.ref), x: m.x || null, t: info.t || null,
          tags: (info.tags || []).slice(0, 8), sp: info.sp || null, lv: info.lv || 0, u: info.u || H.path(),
          c: old ? (old.c || 1) + 1 : 1, at: now, d: m.d || null
        };
      });
      Object.keys(x.e).forEach(function (id) { if (x.e[id].it === item && !keep[id]) delete x.e[id]; });
      var ids = Object.keys(x.e);
      if (ids.length > H.log.MAX) {
        ids.sort(function (a, b) { return x.e[a].at - x.e[b].at; }).slice(0, ids.length - H.log.MAX).forEach(function (id) { delete x.e[id]; });
      }
      H.store.set(app + ':log', x);
    },
    /* H.log.list({app, it, tag, sp}) -> entries, newest first */
    list: function (f) {
      f = f || {};
      var apps = f.app ? [f.app] : H.log.APPS, out = [];
      apps.forEach(function (a) { var e = H.log._load(a).e; Object.keys(e).forEach(function (id) { out.push(e[id]); }); });
      return out.filter(function (e) {
        var sp = e.sp && typeof e.sp === 'object' ? e.sp.en : e.sp;
        return (!f.it || e.it === f.it) && (!f.tag || (e.tags || []).indexOf(f.tag) > -1) && (!f.sp || sp === f.sp);
      }).sort(function (a, b) { return b.at - a.at; });
    },
    count: function (app) { return Object.keys(H.log._load(app).e).length; },
    clear: function (app, item) {
      if (!item) { H.store.del(app + ':log'); return; }
      var x = H.log._load(app); Object.keys(x.e).forEach(function (id) { if (x.e[id].it === item) delete x.e[id]; }); H.store.set(app + ':log', x);
    }
  };

  /* ---------- icons ---------- */
  var I = {
    lock: '<path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="4.5" y="11" width="15" height="10" rx="2.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    alert: '<circle cx="12" cy="12" r="9.5"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
    chev: '<path d="M6 9l6 6 6-6"/>',
    bolt: '<path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12L13 2z"/>',
    redo: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>'
  };
  H.icon = function (n) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (I[n] || '') + '</svg>';
  };

  /* ---------- tabs engine ----------
     H.tabs(root, {
       id, variant: 'steps'|'pills'|'line', numbered: bool, hash: bool,
       tabs: [{ id, label:{ar,en}, locked, done, render(panel, api) | html }],
       active, onChange(id), onLocked(id)
     }) -> api
     Panels render lazily on first open; any render() may create nested H.tabs. */
  var uidN = 0;
  H.tabs = function (root, o) {
    o = o || {};
    var uid = o.id || ('hwt' + (++uidN));
    var tabs = o.tabs || [];
    var byId = {}, current = null;
    root.classList.add('hw-tabs', 'hw-tabs--' + (o.variant || 'pills'));
    var list = d.createElement('div');
    list.className = 'hw-tablist'; list.setAttribute('role', 'tablist');
    var panels = d.createElement('div'); panels.className = 'hw-panels';
    root.innerHTML = ''; root.appendChild(list); root.appendChild(panels);

    tabs.forEach(function (t, i) {
      var b = d.createElement('button');
      b.type = 'button'; b.className = 'hw-tab'; b.id = uid + '-tab-' + t.id;
      b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', uid + '-panel-' + t.id);
      b.innerHTML = (o.numbered ? '<span class="hw-tab-num">' + (i + 1) + '</span>' : '') +
        '<span class="hw-tab-l">' + H.bi(t.label) + '</span><span class="hw-tab-lock" hidden>' + H.icon('lock') + '</span>';
      var p = d.createElement('div');
      p.className = 'hw-panel'; p.id = uid + '-panel-' + t.id; p.hidden = true;
      p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', b.id); p.tabIndex = 0;
      list.appendChild(b); panels.appendChild(p);
      byId[t.id] = { t: t, b: b, p: p, i: i, rendered: false };
      setLock(t.id, !!t.locked); setDone(t.id, !!t.done);
      b.addEventListener('click', function () {
        if (byId[t.id].locked) { shake(b); if (o.onLocked) o.onLocked(t.id); return; }
        api.select(t.id);
      });
    });

    list.addEventListener('keydown', function (e) {
      var k = e.key, ids = tabs.map(function (t) { return t.id; }).filter(function (id) { return !byId[id].locked; });
      if (!ids.length) return;
      var rtl = getComputedStyle(root).direction === 'rtl';
      var idx = ids.indexOf(current), n = null;
      if (k === 'ArrowRight') n = idx + (rtl ? -1 : 1);
      else if (k === 'ArrowLeft') n = idx + (rtl ? 1 : -1);
      else if (k === 'Home') n = 0; else if (k === 'End') n = ids.length - 1;
      if (n === null) return;
      e.preventDefault();
      n = (n + ids.length) % ids.length;
      api.select(ids[n], { focus: true });
    });

    function shake(b) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
    function setLock(id, v) {
      var x = byId[id]; if (!x) return; x.locked = v;
      x.b.classList.toggle('is-locked', v); x.b.setAttribute('aria-disabled', v ? 'true' : 'false');
      x.b.querySelector('.hw-tab-lock').hidden = !v;
    }
    function setDone(id, v) { var x = byId[id]; if (x) x.b.classList.toggle('is-done', v); }
    function render(x) {
      x.p.innerHTML = '';
      if (typeof x.t.render === 'function') x.t.render(x.p, api); else x.p.innerHTML = x.t.html || '';
      x.rendered = true;
    }

    var api = {
      el: root,
      get active() { return current; },
      select: function (id, opt) {
        var x = byId[id]; if (!x || x.locked) return false;
        tabs.forEach(function (t) {
          var y = byId[t.id], on = t.id === id;
          y.b.setAttribute('aria-selected', on ? 'true' : 'false');
          y.b.tabIndex = on ? 0 : -1; y.p.hidden = !on;
        });
        if (!x.rendered) render(x);
        var changed = current !== id; current = id;
        if (opt && opt.focus) x.b.focus();
        if (x.b.scrollIntoView && list.scrollWidth > list.clientWidth) x.b.scrollIntoView({ block: 'nearest', inline: 'center' });
        if (o.hash && changed && !(opt && opt.silent)) { try { history.replaceState(null, '', '#' + id); } catch (e) {} }
        if (changed && o.onChange) o.onChange(id);
        return true;
      },
      lock: function (id) { setLock(id, true); },
      unlock: function (id) { setLock(id, false); },
      done: function (id, v) { setDone(id, v !== false); },
      isLocked: function (id) { return !!(byId[id] && byId[id].locked); },
      panel: function (id) { return byId[id] && byId[id].p; },
      rerender: function (id) { var x = byId[id]; if (x) { if (x.p.hidden) x.rendered = false; else render(x); } }
    };

    var start = o.active || (tabs[0] && tabs[0].id);
    if (o.hash && location.hash) {
      var h = location.hash.slice(1);
      if (byId[h] && !byId[h].locked) start = h;
    }
    if (start) api.select(start, { silent: true });
    return api;
  };

  /* ---------- accordion (native <details>) ----------
     H.accordion(root, [{ id, title:{ar,en}, open, count, render(body) | html }], { soft }) */
  H.accordion = function (root, items, o) {
    o = o || {};
    root.classList.add('hw-acc'); if (o.soft) root.classList.add('hw-acc--soft');
    var out = {};
    items.forEach(function (it) {
      var det = d.createElement('details'); if (it.open) det.open = true;
      det.innerHTML = '<summary><span class="hw-acc-t">' + H.bi(it.title) + '</span><span class="hw-acc-c"></span>' + H.icon('chev').replace('<svg ', '<svg class="hw-chev" ') + '</summary><div class="hw-acc-b"></div>';
      var body = det.querySelector('.hw-acc-b');
      var done = false;
      function fill() { if (done) return; done = true; if (typeof it.render === 'function') it.render(body); else body.innerHTML = it.html || ''; }
      if (it.open) fill();
      det.addEventListener('toggle', function () { if (det.open) fill(); });
      root.appendChild(det);
      out[it.id] = { el: det, body: body, fill: fill, count: function (html) { det.querySelector('.hw-acc-c').innerHTML = html || ''; } };
    });
    return out;
  };

  /* ---------- modal ----------
     H.modal({ icon, title:{ar,en}, body: html, actions:[{label, kind, onClick(close)}] }) -> close() */
  H.modal = function (o) {
    var prev = d.activeElement;
    var m = d.createElement('div');
    m.className = 'hw-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = '<div class="hw-modal-box"><div class="hw-modal-h">' + (o.icon ? H.icon(o.icon) : '') +
      '<span>' + H.bi(o.title) + '</span><button type="button" class="hw-modal-x" aria-label="×">×</button></div>' +
      '<div class="hw-modal-c">' + (o.body || '') + '</div><div class="hw-modal-acts"></div></div>';
    var acts = m.querySelector('.hw-modal-acts');
    function close() { d.removeEventListener('keydown', onKey); m.remove(); if (prev && prev.focus) prev.focus(); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    (o.actions || []).forEach(function (a) {
      var b = d.createElement('button'); b.type = 'button';
      b.className = 'hw-btn' + (a.kind ? ' hw-btn--' + a.kind : '');
      b.innerHTML = (a.icon ? H.icon(a.icon) : '') + H.bi(a.label);
      b.addEventListener('click', function () { if (a.onClick) a.onClick(close); else close(); });
      acts.appendChild(b);
    });
    if (!acts.children.length) acts.remove();
    m.querySelector('.hw-modal-x').addEventListener('click', close);
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    d.addEventListener('keydown', onKey);
    d.body.appendChild(m);
    var f = acts.querySelector('button') || m.querySelector('.hw-modal-x'); if (f) f.focus();
    return close;
  };

  /* tab order chosen on the page: <div data-hawi-app="…" data-order="lessons,train,cases"> ;
     listed ids come first in that order, the rest keep their place after them; unknown ids are ignored */
  H.order = function (tabs, attr) {
    var ids = String(attr || '').split(/[\s,]+/).filter(Boolean);
    if (!ids.length) return tabs;
    var by = {}; tabs.forEach(function (t) { by[t.id] = t; });
    var first = ids.filter(function (id, i) { return by[id] && ids.indexOf(id) === i; }).map(function (id) { return by[id]; });
    return first.concat(tabs.filter(function (t) { return first.indexOf(t) < 0; }));
  };

  /* ---------- Blogger label feeds (same origin) ----------
     Works on any domain: only runs on Blogger pages (they carry an Atom feed link). */
  H.isBlog = function () { return !!d.querySelector('link[type="application/atom+xml"]'); };
  H.slug = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9-]/g, ''); };
  var feedCache = {};
  /* H.feed(label, max) -> Promise<[{u, t:{ar,en,tr}}]> ; post titles "Arabic | English | Türkçe" are split per language */
  H.feed = function (label, max) {
    var k = label + '|' + (max || 8);
    if (feedCache[k]) return feedCache[k];
    if (!H.isBlog()) return Promise.resolve([]);
    feedCache[k] = fetch('/feeds/posts/summary/-/' + encodeURIComponent(label) + '?alt=json&max-results=' + (max || 8))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        return ((j && j.feed && j.feed.entry) || []).map(function (e) {
          var lk = (e.link || []).filter(function (l) { return l.rel === 'alternate'; })[0];
          var parts = String((e.title && e.title.$t) || '').split(' | ');
          return lk ? { u: lk.href, t: { ar: parts[0], en: parts[1] || parts[0], tr: parts[2] || '' } } : null;
        }).filter(Boolean);
      })
      .catch(function () { return []; });
    return feedCache[k];
  };
  /* H.related(box, tags, selfUrl): fills box with posts sharing any of the tags (max 3 tags, 8 links);
     removes box (and an emptied parent <details>) when nothing is found. */
  var RELATED = { ar: 'مواد ذات صلة', en: 'Related Content', tr: 'İlgili İçerik' };
  H.related = function (box, tags, selfUrl) {
    function drop() { var det = box.closest && box.closest('details'); box.remove(); if (det && !det.querySelector('a')) det.remove(); }
    tags = (tags || []).map(H.slug).filter(Boolean).slice(0, 3);
    selfUrl = selfUrl || location.href.split('#')[0].split('?')[0];
    if (!tags.length || !H.isBlog()) { setTimeout(drop, 0); return; }
    Promise.all(tags.map(function (t) { return H.feed(t, 8); })).then(function (lists) {
      var seen = {}, items = [];
      lists.forEach(function (l) { l.forEach(function (x) {
        if (seen[x.u] || x.u.split('?')[0] === selfUrl) return; seen[x.u] = 1; items.push(x);
      }); });
      if (!items.length) { drop(); return; }
      box.innerHTML = '<div class="hw-res-h">' + H.bi(RELATED) + '</div><ul class="hw-links">' + items.slice(0, 8).map(function (x) {
        return '<li><a href="' + H.esc(x.u) + '">' + H.bi(x.t) + '</a></li>'; }).join('') + '</ul>';
    });
  };

  /* ---------- one-time migrations of pre-v0.4 data (here so any page — even the log page — migrates) ---------- */
  /* pre-v0.4: hawi:case:<id> {best, attempts, last:{inv,mgmt,score}} + hawi:case-log {id:{u,t,sp,lv,miss[],bad[],at}} */
  H.migrate('case-v04', function () {
    var old = H.store.get('case-log', {}) || {}, ids = {};
    H.store.keys('case:').forEach(function (k) { var id = k.slice(5); if (id && !/^preview-/.test(id) && !/^(prog|log)$/.test(id)) ids[id] = 1; });
    Object.keys(old).forEach(function (id) { ids[id] = 1; });
    Object.keys(ids).forEach(function (id) {
      var sv = H.store.get('case:' + id, null) || {}, lg = old[id] || {}, at = lg.at || Date.now(), u = H.path();
      try { if (lg.u) u = new URL(lg.u, location.href).pathname; } catch (e) {}
      if (sv.best == null && lg.best == null) return;
      var x = { best: sv.best != null ? sv.best : lg.best, n: sv.attempts || lg.n || 1, last: sv.last ? sv.last.score : lg.last,
        ans: sv.last ? { inv: sv.last.inv || [], mgmt: sv.last.mgmt || [] } : null, t: lg.t || id, sp: lg.sp || null, lv: lg.lv || 0, u: u };
      H.prog('case').set(id, x);
      var list = (lg.miss || []).map(function (t, i) { return { k: 'miss', ref: 'old-m' + i, x: t }; })
        .concat((lg.bad || []).map(function (t, i) { return { k: 'bad', ref: 'old-b' + i, x: t }; }));
      if (list.length) H.log.put('case', id, list, { t: x.t, sp: x.sp, lv: x.lv, u: u });
    });
  });

  /* ---------- auto-init: <div data-hawi-app="case" data-src="json-id"> ---------- */
  H.boot = function (scope) {
    (scope || d).querySelectorAll('[data-hawi-app]:not([data-hawi-ready])').forEach(function (el) {
      var name = el.getAttribute('data-hawi-app'), app = H.apps[name];
      if (!app) return;
      var src = el.getAttribute('data-src'), node = src ? d.getElementById(src) : el.querySelector('script[type="text/hawi"],script[type="application/json"]');
      var data = null;
      try { data = node ? H.decode(node.textContent) : null; } catch (e) { el.setAttribute('data-hawi-error', 'data'); return; }
      el.setAttribute('data-hawi-ready', '');
      app(el, data);
    });
  };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { H.boot(); });
  else setTimeout(function () { H.boot(); }, 0);
})(window, document);
