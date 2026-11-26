/*! © 2026 Dr. Hassan Alduvayhi — All rights reserved. Unauthorized copying or reuse is prohibited.
    Mind maps: collapsible tree (map + list views), touch pan / pinch zoom, RTL mirroring, notes with [[…]] tooltips,
    related content by tag, favourites | v0.1.0 (ar/en/tr) | requires hawi-core.js v0.5
    Post: <div data-hawi-app="mindmap"><script type="text/hawi">HW1.…</script></div>
    Data: { v:1, id, sp:{ar,en,tr}, t:{ar,en,tr}, root: NODE }
          NODE { n:{ar,en,tr} name, note?:{ar,en,tr} (supports **bold** and [[…]]), tag?: blogger label (related content),
                 red?: 1 life-threatening (rule out first), c?: [NODE…] children } */
(function (w, d) {
  'use strict';
  var H = w.Hawi; if (!H || !H.tabs) return;
  var bi = H.bi, esc = H.esc, icon = H.icon;
  function B(ar, en, tr) { return { ar: ar, en: en, tr: tr }; }
  var L = {
    map: B('الخريطة', 'Map', 'Harita'),
    list: B('القائمة', 'List', 'Liste'),
    expand: B('توسيع الكل', 'Expand all', 'Tümünü aç'),
    collapse: B('طيّ الكل', 'Collapse all', 'Tümünü kapat'),
    fit: B('توسيط', 'Fit', 'Sığdır'),
    full: B('ملء الشاشة', 'Full screen', 'Tam ekran'),
    zin: B('تكبير', 'Zoom in', 'Yakınlaştır'),
    zout: B('تصغير', 'Zoom out', 'Uzaklaştır'),
    fav: B('المفضّلة', 'Favourite', 'Favori'),
    red: B('خطر على الحياة: استبعده أولاً', 'Life-threatening: rule out first', 'Hayatı tehdit eden: önce dışla'),
    hint: B('المس فرعاً لفتحه، واسحب للتنقّل، وقرّب بإصبعين.', 'Tap a branch to open it, drag to move, pinch to zoom.', 'Açmak için bir dala dokunun, gezinmek için sürükleyin, yakınlaştırmak için iki parmak kullanın.')
  };
  var IC = {
    heart: '<path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.6 3.1 4.4 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    fit: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
    full: '<path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/>',
    exp: '<path d="M7 8l5-5 5 5M7 16l5 5 5-5"/>', col: '<path d="M7 3l5 5 5-5M7 21l5-5 5 5"/>'
  };
  function ic(n) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[n] + '</svg>'; }
  function rtl() { return H.lang() === 'ar'; }

  /* ---------- styles (own file, nothing in the theme) ---------- */
  var CSS =
    '.hw-mm{margin:8px 0 18px;color:var(--hw-ink)}' +
    '.hw-mm svg[stroke],.hw-mm svg[stroke] *,.hw-mm-links,.hw-mm-links *{fill:none!important}' +
    '.hw-mm ul,.hw-mm li{list-style:none!important;margin:0;padding:0}.hw-mm li::before,.hw-mm li::after{content:none!important;display:none!important}' +
    '.hw-mm-top{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:8px}' +
    '.hw-mm-ib{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:40px;height:40px;padding:0 10px;border:1px solid var(--hw-line);border-radius:12px;background:var(--hw-bg);color:var(--hw-ink);font:inherit;font-size:13.5px;font-weight:600;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
    '.hw-mm-ib svg{width:19px;height:19px;flex:none}.hw-mm-ib:focus-visible{outline:2px solid var(--hw-accent);outline-offset:2px}' +
    '.hw-mm-ib[aria-pressed=true]{color:var(--hw-bad);border-color:color-mix(in srgb,var(--hw-bad) 40%,transparent)}.hw-mm-ib[aria-pressed=true] svg *{fill:currentColor!important}' +
    '.hw-mm-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:10px 0 8px}' +
    '.hw-mm-zoom{display:inline-flex;align-items:center;border:1px solid var(--hw-line);border-radius:12px;overflow:hidden;background:var(--hw-bg)}' +
    '.hw-mm-zoom button{width:38px;height:38px;border:0;background:none;color:var(--hw-ink);cursor:pointer;display:inline-flex;align-items:center;justify-content:center}.hw-mm-zoom svg{width:18px;height:18px}' +
    '.hw-mm-pc{min-width:52px;text-align:center;font-size:13.5px;font-weight:700;color:var(--hw-accent-ink);font-variant-numeric:tabular-nums}' +
    '.hw-mm-sp{flex:1}' +
    '.hw-mm-vp{position:relative;height:min(62vh,560px);min-height:340px;overflow:hidden;border:1px solid var(--hw-line);border-radius:var(--hw-radius);background:var(--hw-bg-soft);touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none}' +
    '.hw-mm-vp.is-drag{cursor:grabbing}' +
    '.hw-mm-st{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform}' +
    '.hw-mm-st.is-anim{transition:transform .25s ease}.hw-mm-links{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}' +
    '.hw-mm-links path{stroke:color-mix(in srgb,var(--hw-accent) 55%,var(--hw-line));stroke-width:2;stroke-linecap:round}' +
    '.hw-mm-n{position:absolute;left:0;top:0;display:inline-flex;align-items:center;gap:7px;width:max-content;max-width:230px;padding:6px 11px 6px 8px;border:1.5px solid transparent;border-radius:11px;background:none;color:var(--hw-ink);font:inherit;font-size:14px;font-weight:600;line-height:1.35;text-align:start;white-space:normal;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .15s,border-color .15s}' +
    '[dir=rtl] .hw-mm-n,.hw-mm-n:dir(rtl){padding:6px 8px 6px 11px}' +
    '.hw-mm-n:focus-visible{outline:2px solid var(--hw-accent);outline-offset:2px}' +
    '.hw-mm-n.is-br{background:var(--hw-bg);border-color:var(--hw-line)}' +
    '.hw-mm-n.is-open{background:var(--hw-accent-soft);border-color:color-mix(in srgb,var(--hw-accent) 45%,transparent);color:var(--hw-accent-ink)}' +
    '.hw-mm-n.is-root{padding:10px 16px;font-size:15.5px;font-weight:700;background:var(--hw-accent);border-color:var(--hw-accent);color:#fff;border-radius:13px}' +
    '.hw-mm-n.is-sel{box-shadow:0 0 0 3px color-mix(in srgb,var(--hw-accent) 30%,transparent)}' +
    '.hw-mm-d{flex:none;width:13px;height:13px;border-radius:50%;border:2px solid var(--hw-accent);background:var(--hw-bg);box-sizing:border-box}' +
    '.hw-mm-n.is-br .hw-mm-d{background:var(--hw-accent)}.hw-mm-n.is-open .hw-mm-d{background:var(--hw-bg)}.hw-mm-n.is-root .hw-mm-d{display:none}' +
    '.hw-mm-n.is-red .hw-mm-d{border-color:var(--hw-bad)}.hw-mm-n.is-red{color:var(--hw-bad)}' +
    '.hw-mm-c{flex:none;direction:ltr;unicode-bidi:isolate;font-size:11.5px;font-weight:700;padding:1px 7px;border-radius:999px;background:var(--hw-accent-soft);color:var(--hw-accent-ink)}.hw-mm-n.is-open .hw-mm-c{display:none}' +
    '.hw-mm-hint{position:absolute;inset-inline:10px;bottom:8px;font-size:12px;color:var(--hw-muted);text-align:center;pointer-events:none;transition:opacity .4s}' +
    '.hw-mm-leg{display:flex;align-items:center;gap:8px;margin:8px 2px 0;font-size:12.5px;color:var(--hw-muted)}.hw-mm-leg i{width:11px;height:11px;border-radius:50%;border:2px solid var(--hw-bad);flex:none}' +
    '.hw-mm-det{margin-top:12px;padding:14px 16px;border:1px solid var(--hw-line);border-radius:var(--hw-radius);background:var(--hw-bg)}' +
    '.hw-mm-det[hidden]{display:none}' +
    '.hw-mm-path{font-size:12.5px;color:var(--hw-muted);margin-bottom:4px}' +
    '.hw-mm-dt{font-size:16px;font-weight:700;margin:0 0 6px}.hw-mm-dt.is-red{color:var(--hw-bad)}' +
    '.hw-mm-dn{font-size:14.5px;line-height:1.8}.hw-mm-dn:empty{display:none}' +
    '.hw-mm-flag{display:inline-block;margin-top:8px;font-size:12.5px;font-weight:700;color:var(--hw-bad);background:var(--hw-bad-soft);padding:3px 10px;border-radius:999px}' +
    '.hw-mm-rel{margin-top:10px}' +
    /* full screen (phone) */
    '.hw-mm.is-full{position:fixed;inset:0;z-index:99990;margin:0;padding:10px;background:var(--bodyB,var(--hw-bg));display:flex;flex-direction:column;overflow:auto}' +
    '.hw-mm.is-full .hw-tabs{display:flex;flex-direction:column;flex:1;min-height:0}.hw-mm.is-full .hw-panels,.hw-mm.is-full .hw-panel:not([hidden]){flex:1;min-height:0;display:flex;flex-direction:column}' +
    '.hw-mm.is-full .hw-mm-vp{flex:1;height:auto;min-height:260px}' +
    'html.hw-mm-lock,html.hw-mm-lock body{overflow:hidden!important}' +
    /* list view */
    '.hw-mm-ol{font-size:14.5px;line-height:1.7}' +
    '.hw-mm-ol ul{padding-inline-start:18px!important;border-inline-start:2px solid var(--hw-line);margin-inline-start:7px!important}' +
    '.hw-mm-ol summary{display:flex;align-items:center;gap:8px;padding:6px 4px;font-weight:700;cursor:pointer;list-style:none}.hw-mm-ol summary::-webkit-details-marker{display:none}' +
    '.hw-mm-ol summary::before{content:"";width:8px;height:8px;border:solid var(--hw-accent);border-width:0 2px 2px 0;transform:rotate(-45deg);transition:transform .15s;flex:none}' +
    '[dir=rtl] .hw-mm-ol summary::before,.hw-mm-ol:dir(rtl) summary::before{transform:rotate(135deg)}' +
    '.hw-mm-ol details[open]>summary::before{transform:rotate(45deg)!important}' +
    '.hw-mm-lf{padding:5px 4px 5px 0}.hw-mm-lf b{font-weight:600}.hw-mm-lf.is-red b,.hw-mm-ol summary.is-red{color:var(--hw-bad)}' +
    '.hw-mm-lf p{margin:2px 0 0;font-size:13.5px;color:var(--hw-muted);line-height:1.7}' +
    '.hw-mm-lbar{display:flex;gap:6px;margin:10px 0}';
  function inject() { if (d.getElementById('hwmm-css')) return; var st = d.createElement('style'); st.id = 'hwmm-css'; st.textContent = CSS; d.head.appendChild(st); }

  /* ---------- tree model ---------- */
  function build(root) {
    var all = [];
    (function walk(x, parent, depth, id) {
      x.id = id; x.p = parent; x.dep = depth; x.c = x.c || []; all.push(x);
      x.c.forEach(function (ch, i) { walk(ch, x, depth + 1, id + '.' + i); });
    })(root, null, 0, 'n0');
    return all;
  }
  function pathOf(x) { var out = []; for (var y = x; y; y = y.p) out.unshift(y); return out; }

  /* ---------- the app ---------- */
  H.apps.mindmap = function (mount, data) {
    inject();
    if (!data || !data.root) { mount.setAttribute('data-hawi-error', 'data'); return; }
    var id = H.slug(data.id || H.path()), P = H.prog('mindmap');
    var nodes = build(data.root), byId = {};
    nodes.forEach(function (x) { byId[x.id] = x; });
    var open = {}; open[data.root.id] = 1; /* first level visible, like opening a book */

    /* progress record: seen count + favourite (+ title/link for a future hub "my maps") */
    var rec = P.get(id) || {};
    rec.n = (rec.n || 0) + 1; rec.t = data.t || null; rec.sp = data.sp || null; rec.u = H.path();
    P.set(id, rec);

    mount.classList.add('hw-mm');
    mount.innerHTML = '<div class="hw-mm-top"><button type="button" class="hw-mm-ib" data-a="full" title="' + esc(H.t(L.full)) + '" aria-label="' + esc(H.t(L.full)) + '">' + ic('full') + '</button><span class="hw-mm-sp"></span><button type="button" class="hw-mm-ib hw-mm-fav" aria-pressed="' + (rec.fav ? 'true' : 'false') + '">' + ic('heart') + bi(L.fav) + '</button></div><div class="hw-mm-tabs"></div>';
    var favB = mount.querySelector('.hw-mm-fav');
    favB.addEventListener('click', function () {
      var r = P.get(id) || {}; r.fav = r.fav ? 0 : 1; P.set(id, r); favB.setAttribute('aria-pressed', r.fav ? 'true' : 'false');
    });

    var map = null;
    H.tabs(mount.querySelector('.hw-mm-tabs'), {
      variant: 'line',
      tabs: [
        { id: 'map', label: L.map, render: function (p) { map = mapView(p); } },
        { id: 'list', label: L.list, render: listView }
      ],
      onChange: function (t) { if (t === 'map' && map) map.relayout(); }
    });

    /* ===== MAP VIEW ===== */
    function mapView(panel) {
      panel.innerHTML =
        '<div class="hw-mm-bar"><span class="hw-mm-zoom"><button type="button" data-z="-1" aria-label="' + esc(H.t(L.zout)) + '">' + ic('minus') + '</button>' +
        '<span class="hw-mm-pc">100%</span><button type="button" data-z="1" aria-label="' + esc(H.t(L.zin)) + '">' + ic('plus') + '</button></span>' +
        '<button type="button" class="hw-mm-ib" data-a="all"></button><span class="hw-mm-sp"></span>' +
        '<button type="button" class="hw-mm-ib" data-a="fit" title="' + esc(H.t(L.fit)) + '" aria-label="' + esc(H.t(L.fit)) + '">' + ic('fit') + '</button>' +
        '</div>' +
        '<div class="hw-mm-vp"><div class="hw-mm-st"><svg class="hw-mm-links" aria-hidden="true"></svg></div><div class="hw-mm-hint">' + bi(L.hint) + '</div></div>' +
        (nodes.some(function (x) { return x.red; }) ? '<div class="hw-mm-leg"><i></i>' + bi(L.red) + '</div>' : '') +
        '<div class="hw-mm-det" hidden aria-live="polite"></div>';
      var vp = panel.querySelector('.hw-mm-vp'), st = panel.querySelector('.hw-mm-st'), svg = panel.querySelector('.hw-mm-links'),
        pc = panel.querySelector('.hw-mm-pc'), allB = panel.querySelector('[data-a=all]'), det = panel.querySelector('.hw-mm-det'),
        hint = panel.querySelector('.hw-mm-hint');
      var els = {}, box = {}, s = 1, tx = 0, ty = 0, W = 0, Ht = 0, sel = null, first = true;

      function setT() { st.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')'; pc.textContent = Math.round(s * 100) + '%'; }
      function visible() { var out = []; (function walk(x) { out.push(x); if (open[x.id]) x.c.forEach(walk); })(data.root); return out; }
      function allOpen() { return nodes.every(function (x) { return !x.c.length || open[x.id]; }); }
      function setAllLabel() { var a = allOpen(); allB.innerHTML = ic(a ? 'col' : 'exp') + bi(a ? L.collapse : L.expand); }

      function el(x) {
        if (els[x.id]) return els[x.id];
        var b = d.createElement('button'); b.type = 'button'; b.className = 'hw-mm-n'; b.setAttribute('data-id', x.id);
        els[x.id] = b; st.appendChild(b); return b;
      }
      function paint(x, b) {
        var br = x.c.length > 0, isOpen = !!open[x.id];
        b.className = 'hw-mm-n' + (x.dep === 0 ? ' is-root' : '') + (br ? ' is-br' : '') + (br && isOpen ? ' is-open' : '') + (x.red ? ' is-red' : '') + (sel === x ? ' is-sel' : '');
        b.innerHTML = '<i class="hw-mm-d"></i><span>' + esc(H.t(x.n)) + '</span>' + (br && !isOpen ? '<span class="hw-mm-c">+' + x.c.length + '</span>' : '');
        if (br) b.setAttribute('aria-expanded', isOpen ? 'true' : 'false'); else b.removeAttribute('aria-expanded');
        if (x.red) b.title = H.t(L.red); else b.removeAttribute('title');
      }

      /* layout: columns by depth (width = widest visible node), rows by leaves; RTL mirrors x */
      var GX = 54, GY = 12;
      function layout() {
        var vis = visible(), keep = {};
        vis.forEach(function (x) { keep[x.id] = 1; paint(x, el(x)); });
        Object.keys(els).forEach(function (k) { if (!keep[k]) { els[k].remove(); delete els[k]; } });
        var colW = [];
        vis.forEach(function (x) { var b = els[x.id]; box[x.id] = { w: b.offsetWidth, h: b.offsetHeight }; colW[x.dep] = Math.max(colW[x.dep] || 0, box[x.id].w); });
        var colX = [0]; for (var i = 1; i < colW.length; i++) colX[i] = colX[i - 1] + colW[i - 1] + GX;
        W = colX[colW.length - 1] + colW[colW.length - 1];
        var y = 0;
        (function place(x) {
          var b = box[x.id], kids = open[x.id] ? x.c : [];
          if (kids.length) { kids.forEach(place); b.cy = (box[kids[0].id].cy + box[kids[kids.length - 1].id].cy) / 2; }
          else { b.cy = y + b.h / 2; y += b.h + GY; }
          /* a parent taller than its children block is rare; keep it simple */
        })(data.root);
        Ht = Math.max(y - GY, box[data.root.id].h);
        var R = rtl();
        vis.forEach(function (x) {
          var b = box[x.id]; b.x = R ? W - colX[x.dep] - b.w : colX[x.dep]; b.y = b.cy - b.h / 2;
          els[x.id].style.transform = 'translate(' + b.x + 'px,' + b.y + 'px)';
        });
        svg.setAttribute('width', W); svg.setAttribute('height', Ht); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + Ht);
        var dd = '';
        vis.forEach(function (x) {
          if (!open[x.id]) return; var a = box[x.id];
          x.c.forEach(function (ch) {
            var c = box[ch.id], x1 = R ? a.x : a.x + a.w, x2 = R ? c.x + c.w : c.x, m = (x1 + x2) / 2;
            dd += 'M' + x1 + ' ' + a.cy + 'C' + m + ' ' + a.cy + ' ' + m + ' ' + c.cy + ' ' + x2 + ' ' + c.cy;
          });
        });
        svg.innerHTML = '<path d="' + dd + '"/>';
        setAllLabel();
      }
      /* screen position of a node centre, to keep the touched node still while the tree grows around it */
      function scr(x) { var b = box[x.id]; return b && b.x != null ? { x: tx + s * (b.x + b.w / 2), y: ty + s * b.cy } : null; }
      function relayout(anchor) {
        if (!vp.offsetWidth) return;
        anchor = anchor || data.root; var before = scr(anchor);
        layout();
        if (first || !before) { first = false; fit(); return; }
        var b = box[anchor.id]; tx = before.x - s * (b.x + b.w / 2); ty = before.y - s * b.cy; setT();
      }
      /* fit the whole tree, but never below a readable size (min): a bigger tree starts at the root's side, top first */
      function fit(min) {
        var vw = vp.clientWidth, vh = vp.clientHeight, pad = 16;
        s = Math.min(1, Math.max(typeof min === 'number' ? min : 0.35, Math.min((vw - pad * 2) / W, (vh - pad * 2) / Ht)));
        tx = W * s > vw - pad * 2 ? (rtl() ? vw - pad - W * s : pad) : (vw - W * s) / 2;
        ty = Ht * s > vh - pad * 2 ? Math.min(pad, Math.max(vh - pad - Ht * s, vh / 2 - s * box[data.root.id].cy)) : (vh - Ht * s) / 2;
        setT();
      }
      function zoomAt(f, cx, cy) {
        var ns = Math.min(2.2, Math.max(0.3, s * f)); f = ns / s;
        tx = cx - (cx - tx) * f; ty = cy - (cy - ty) * f; s = ns; setT();
      }
      function show(x) {
        sel = x; Object.keys(els).forEach(function (k) { els[k].classList.toggle('is-sel', byId[k] === x); });
        if (!x.note && !x.red && !x.tag) { det.hidden = true; return; }
        var path = pathOf(x).slice(0, -1).map(function (y) { return bi(y.n); }).join(' ‹ ');
        if (!rtl()) path = pathOf(x).slice(0, -1).map(function (y) { return bi(y.n); }).join(' › ');
        det.innerHTML = (path ? '<div class="hw-mm-path">' + path + '</div>' : '') + '<h3 class="hw-mm-dt' + (x.red ? ' is-red' : '') + '">' + bi(x.n) + '</h3>' +
          '<div class="hw-mm-dn">' + (x.note ? bi(x.note) : '') + '</div>' + (x.red ? '<span class="hw-mm-flag">⚠ ' + bi(L.red) + '</span>' : '') +
          (x.tag ? '<div class="hw-mm-rel"></div>' : '');
        det.hidden = false;
        if (x.tag) H.related(det.querySelector('.hw-mm-rel'), [x.tag]);
      }
      /* after opening a branch, slide the view (no zoom change) so the branch and its children are on screen */
      function reveal(x) {
        var ids = [x].concat(open[x.id] ? x.c : []), a = Infinity, b = -Infinity, c = Infinity, e = -Infinity;
        ids.forEach(function (y) { var q = box[y.id]; if (!q) return; a = Math.min(a, q.x); b = Math.max(b, q.x + q.w); c = Math.min(c, q.y); e = Math.max(e, q.y + q.h); });
        var vw = vp.clientWidth, vh = vp.clientHeight, pad = 14, L0 = tx + s * a, R0 = tx + s * b, T0 = ty + s * c, B0 = ty + s * e;
        if (R0 - L0 > vw - 2 * pad) tx += rtl() ? pad - L0 : vw - pad - R0;
        else if (L0 < pad) tx += pad - L0; else if (R0 > vw - pad) tx += vw - pad - R0;
        if (B0 - T0 > vh - 2 * pad) ty += pad - T0;
        else if (T0 < pad) ty += pad - T0; else if (B0 > vh - pad) ty += vh - pad - B0;
        st.classList.add('is-anim'); setT(); setTimeout(function () { st.classList.remove('is-anim'); }, 260);
      }
      function toggle(x) {
        if (x.c.length) { if (open[x.id]) { (function shut(y) { delete open[y.id]; y.c.forEach(shut); })(x); relayout(x); } else { open[x.id] = 1; relayout(x); reveal(x); } }
        show(x);
      }

      /* clicks (tap / Enter) on nodes; a drag never counts as a tap */
      var dragged = false;
      st.addEventListener('click', function (e) {
        var b = e.target.closest('.hw-mm-n'); if (!b) return;
        if (dragged) { dragged = false; return; }
        toggle(byId[b.getAttribute('data-id')]);
      });
      /* pan (one finger / mouse) + pinch (two fingers) */
      var pts = {}, start = null;
      function cnt() { return Object.keys(pts).length; }
      function two() { var k = Object.keys(pts), a = pts[k[0]], b = pts[k[1]]; return { dx: a.x - b.x, dy: a.y - b.y, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }
      function local(e) { var r = vp.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
      vp.addEventListener('pointerdown', function (e) {
        if (e.button > 0) return;
        pts[e.pointerId] = local(e); dragged = false;
        if (cnt() === 1) start = { x: pts[e.pointerId].x, y: pts[e.pointerId].y, tx: tx, ty: ty, cap: false };
        else if (cnt() === 2) { var t = two(); start = { pinch: Math.hypot(t.dx, t.dy) || 1, s: s, mx: t.mx, my: t.my, tx: tx, ty: ty }; dragged = true; }
        hint.style.opacity = 0;
      });
      vp.addEventListener('pointermove', function (e) {
        if (!pts[e.pointerId] || !start) return;
        pts[e.pointerId] = local(e);
        if (cnt() >= 2 && start.pinch) {
          var t = two(), f = Math.min(2.2, Math.max(0.3, start.s * Math.hypot(t.dx, t.dy) / start.pinch)) / start.s;
          s = start.s * f; tx = t.mx - (start.mx - start.tx) * f; ty = t.my - (start.my - start.ty) * f; setT(); return;
        }
        if (cnt() !== 1 || start.pinch) return;
        var p = pts[e.pointerId], dx = p.x - start.x, dy = p.y - start.y;
        if (!start.cap && Math.hypot(dx, dy) < 6) return;
        if (!start.cap) { start.cap = true; dragged = true; vp.classList.add('is-drag'); try { vp.setPointerCapture(e.pointerId); } catch (x) {} }
        tx = start.tx + dx; ty = start.ty + dy; setT();
      });
      function up(e) {
        delete pts[e.pointerId]; vp.classList.remove('is-drag');
        if (cnt() === 1) { var k = Object.keys(pts)[0]; start = { x: pts[k].x, y: pts[k].y, tx: tx, ty: ty, cap: true }; }
        else if (!cnt()) { start = null; if (dragged) setTimeout(function () { dragged = false; }, 0); }
      }
      vp.addEventListener('pointerup', up); vp.addEventListener('pointercancel', up);
      /* ctrl + wheel / trackpad pinch zooms; a plain wheel keeps scrolling the page */
      vp.addEventListener('wheel', function (e) {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault(); var p = local(e); zoomAt(Math.exp(-e.deltaY / 300), p.x, p.y);
      }, { passive: false });

      panel.querySelectorAll('[data-z]').forEach(function (b) {
        b.addEventListener('click', function () { zoomAt(+b.getAttribute('data-z') > 0 ? 1.2 : 1 / 1.2, vp.clientWidth / 2, vp.clientHeight / 2); });
      });
      allB.addEventListener('click', function () {
        if (allOpen()) { open = {}; open[data.root.id] = 1; } else nodes.forEach(function (x) { if (x.c.length) open[x.id] = 1; });
        layout(); fit(0.6);
      });
      panel.querySelector('[data-a=fit]').addEventListener('click', function () { fit(); });
      mount.querySelector('[data-a=full]').addEventListener('click', function () {
        var on = !mount.classList.contains('is-full');
        mount.classList.toggle('is-full', on); d.documentElement.classList.toggle('hw-mm-lock', on);
        setTimeout(fit, 30);
      });
      d.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && mount.classList.contains('is-full')) { mount.classList.remove('is-full'); d.documentElement.classList.remove('hw-mm-lock'); setTimeout(fit, 30); }
      });
      /* phones fire resize while scrolling (address bar): refit only when the width really changes */
      var lastW = vp.clientWidth;
      w.addEventListener('resize', function () { clearTimeout(fit.t); fit.t = setTimeout(function () { if (vp.clientWidth && vp.clientWidth !== lastW) { lastW = vp.clientWidth; fit(); } }, 150); });

      /* language switch: names, widths and direction change -> lay out again around the root */
      var lastL = H.lang();
      new MutationObserver(function () {
        var l = H.lang(); if (l === lastL) return; lastL = l;
        mount.querySelectorAll('[aria-label]').forEach(function (b) {
          var k = b.getAttribute('data-z') ? (+b.getAttribute('data-z') > 0 ? L.zin : L.zout) : b.getAttribute('data-a') === 'fit' ? L.fit : b.getAttribute('data-a') === 'full' ? L.full : null;
          if (k) { b.setAttribute('aria-label', H.t(k)); if (b.title) b.title = H.t(k); }
        });
        layout(); fit(0.7); if (sel) show(sel);
      }).observe(d.documentElement, { attributes: true, attributeFilter: ['data-lang', 'dir', 'lang'] });

      setTimeout(function () { relayout(); show(data.root); }, 0);
      return { relayout: function () { setTimeout(function () { relayout(); }, 0); } };
    }

    /* ===== LIST VIEW ===== */
    function listView(panel) {
      function item(x) {
        if (!x.c.length) {
          return '<li class="hw-mm-lf' + (x.red ? ' is-red' : '') + '"><b>' + (x.red ? '⚠ ' : '') + bi(x.n) + '</b>' + (x.note ? '<p>' + bi(x.note) + '</p>' : '') + '</li>';
        }
        return '<li><details' + (x.dep < 1 ? ' open' : '') + '><summary' + (x.red ? ' class="is-red"' : '') + '>' + bi(x.n) + '</summary>' +
          (x.note ? '<div class="hw-mm-lf"><p>' + bi(x.note) + '</p></div>' : '') +
          '<ul>' + x.c.map(item).join('') + '</ul></details></li>';
      }
      panel.innerHTML = '<div class="hw-mm-lbar"><button type="button" class="hw-mm-ib" data-l="1">' + ic('exp') + bi(L.expand) + '</button>' +
        '<button type="button" class="hw-mm-ib" data-l="0">' + ic('col') + bi(L.collapse) + '</button></div>' +
        '<ul class="hw-mm-ol">' + item(data.root) + '</ul>';
      panel.querySelectorAll('[data-l]').forEach(function (b) {
        b.addEventListener('click', function () {
          var on = b.getAttribute('data-l') === '1';
          panel.querySelectorAll('.hw-mm-ol details').forEach(function (x, i) { x.open = on || i === 0; });
        });
      });
    }
  };

  if (d.readyState !== 'loading' && H.boot) H.boot();
})(window, document);
