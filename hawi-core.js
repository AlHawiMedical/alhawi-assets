/*! Al-Hawi Medical — core: i18n helpers (ar/en/tr), tabs engine, accordion, modal, storage | v0.2 */
(function (w, d) {
  'use strict';
  var H = w.Hawi = w.Hawi || {};
  H.version = '0.2.0';
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

  /* ---------- storage (safe) ---------- */
  H.store = {
    get: function (k, def) { try { var v = localStorage.getItem('hawi:' + k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set: function (k, v) { try { localStorage.setItem('hawi:' + k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem('hawi:' + k); } catch (e) {} }
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
