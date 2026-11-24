/*! ECG Academy: strip engine + Library + Cases + academy shell (tabs, deep links, related) | v0.4.1 (ar/en/tr) | requires hawi-core.js v0.3 */
(function (w, d) {
  'use strict';
  var H = w.Hawi; if (!H) return;
  var E = H.ecg = H.ecg || {};
  /* where this file was loaded from: data files sit next to it, with the same ?v= */
  var SELF = (d.currentScript && d.currentScript.src) || '';
  var BASE = SELF.replace(/[?#].*$/, '').replace(/[^\/]*$/, ''), VQ = (SELF.split('?')[1] ? '?' + SELF.split('?')[1] : '');

  /* =====================================================================
     1. ENGINE — rhythm generators produce timed events; the signal is a sum
        of smooth components (lead II, mV). Time in seconds.
     ===================================================================== */
  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function g(t, c, s, a) { var x = (t - c) / s; return x * x > 30 ? 0 : a * Math.exp(-0.5 * x * x); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* Each generator returns a function that, called repeatedly, yields the next
     chunk: { P:[{t}], Q:[{t, d, k, rr, p}], until } — k: 'n' narrow, 'v' ventricular/wide.
     q.p = time of the P wave that conducted this QRS (for PR), or null. */
  var GEN = {
    /* sinus family: normal, arrhythmia (ra), tachy/brady, 1st-degree block (pr), AT (pk), AVNRT (noP), LBBB/RBBB/WPW (k) */
    sinus: function (sp) {
      var t = 0.25, base = 60 / sp.rate, ra = sp.ra || 0, prev = base;
      return function () {
        var rr = base * (1 + ra * Math.sin(2 * Math.PI * t / 4.5));
        var q = { t: t + sp.pr, d: sp.qrs, k: kind(sp), rr: prev, p: t };
        var out = { P: sp.noP ? [] : [{ t: t }], Q: [q], until: t + rr };
        prev = rr; t += rr; return out;
      };
    },
    /* second-degree AV block: mode 'w' (Mobitz I), 'm2' (Mobitz II), '21' (2:1). n = P waves per group */
    avb2: function (sp) {
      var t = 0.25, pp = 60 / sp.rate, i = 0, n = sp.n || 4, lastQ = null;
      var prs = sp.prs || [0.18, 0.28, 0.33, 0.36, 0.38];
      if (sp.mode === '21') n = 2;
      return function () {
        var pos = i % n, conducted = pos < n - 1, pr;
        if (sp.mode === 'w') pr = prs[Math.min(pos, prs.length - 1)]; else pr = sp.pr || 0.16;
        var out = { P: [{ t: t }], Q: [], until: t + pp };
        if (conducted) {
          var qt = t + pr, q = { t: qt, d: sp.qrs, k: kind(sp), rr: lastQ == null ? pp : qt - lastQ, p: t };
          out.Q.push(q); lastQ = qt;
        }
        i++; t += pp; return out;
      };
    },
    /* complete heart block: independent atrial (rate) and escape (vrate) pacemakers */
    chb: function (sp, R) {
      var tp = 0.2, tq = 0.2 + 0.37 * (60 / sp.vrate), pp = 60 / sp.rate, rr = 60 / sp.vrate, until = 0;
      return function () {
        var out = { P: [], Q: [], until: 0 };
        until += 1.0;
        while (tp < until) { out.P.push({ t: tp }); tp += pp * (1 + (R() - 0.5) * 0.02); }
        while (tq < until) { out.Q.push({ t: tq, d: sp.qrs, k: kind(sp), rr: rr, p: null }); tq += rr; }
        out.until = until; return out;
      };
    },
    /* atrial fibrillation: no P, irregularly irregular RR around mean rate */
    af: function (sp, R) {
      var mean = 60 / sp.rate, t = 0.3, prev = mean;
      return function () {
        var rr = clamp(mean * (0.55 + 0.9 * R()), 0.32, 1.6);
        var out = { P: [], Q: [{ t: t, d: sp.qrs, k: 'n', rr: prev, p: null }], until: t + rr };
        prev = rr; t += rr; return out;
      };
    },
    /* sinus rhythm with a premature ventricular beat every `every` beats (compensatory pause) */
    pvc: function (sp) {
      var t = 0.25, rr = 60 / sp.rate, i = 0, every = sp.every || 4, cpl = sp.coupling || 0.6;
      return function () {
        var out = { P: [], Q: [], until: t + rr };
        if ((i + 1) % every === 0) {
          var prevQ = t - rr + sp.pr;
          out.Q.push({ t: prevQ + cpl * rr, d: sp.vqrs || 0.15, k: 'v', rr: cpl * rr, p: null });
        } else {
          out.P.push({ t: t });
          var after = i > 0 && i % every === 0;
          out.Q.push({ t: t + sp.pr, d: sp.qrs, k: 'n', rr: after ? (2 - cpl) * rr : rr, p: t });
        }
        i++; t += rr; return out;
      };
    },
    /* premature atrial / junctional beats (alt: alternate a, j), non-compensatory pause (sinus node reset) */
    pac: function (sp) {
      var t = 0.25, rr = 60 / sp.rate, i = 0, every = sp.every || 4, cpl = sp.coupling || 0.62, lastQ = null, nPrem = 0;
      return function () {
        var out = { P: [], Q: [], until: 0 };
        if (lastQ != null && (i + 1) % every === 0) {
          var typ = sp.alt ? (nPrem % 2 ? 'j' : 'a') : (sp.type || 'a'); nPrem++;
          var qt = lastQ + cpl * rr;
          if (typ === 'a') { out.P.push({ t: qt - 0.15, pk: 'abn' }); out.Q.push({ t: qt, d: sp.qrs, k: 'n', rr: cpl * rr, p: qt - 0.15 }); t = qt - 0.15 + rr; }
          else { out.P.push({ t: qt - 0.07, pk: 'inv' }); out.Q.push({ t: qt, d: sp.qrs, k: 'n', rr: cpl * rr, p: qt - 0.07 }); t = qt - 0.07 + rr; }
          lastQ = qt;
        } else {
          out.P.push({ t: t }); var q = t + sp.pr;
          out.Q.push({ t: q, d: sp.qrs, k: 'n', rr: lastQ == null ? rr : q - lastQ, p: t }); lastQ = q; t += rr;
        }
        i++; out.until = t - 0.05; return out;
      };
    },
    /* sinus beats, sinus arrest, then an escape rhythm (type a | j | v at erate) for m beats; repeats */
    esc: function (sp) {
      var rr = 60 / sp.rate, err = 60 / sp.erate, n = sp.n || 3, m = sp.m || 3, i = 0, t = 0.25, lastQ = null;
      return function () {
        var out = { P: [], Q: [], until: 0 }, pos = i % (n + m);
        if (pos < n) {
          if (pos === 0 && lastQ != null) t = lastQ + rr - sp.pr;
          out.P.push({ t: t }); var q = t + sp.pr;
          out.Q.push({ t: q, d: sp.qrs, k: 'n', rr: lastQ == null ? rr : q - lastQ, p: t }); lastQ = q; t += rr;
        } else {
          var qe = lastQ + err;
          if (sp.type === 'a') { out.P.push({ t: qe - 0.15, pk: 'abn' }); out.Q.push({ t: qe, d: sp.qrs, k: 'n', rr: err, p: qe - 0.15 }); }
          else if (sp.type === 'j') { out.P.push({ t: qe + sp.qrs + 0.03, pk: 'inv' }); out.Q.push({ t: qe, d: sp.qrs, k: 'n', rr: err, p: null }); }
          else out.Q.push({ t: qe, d: sp.vqrs || 0.15, k: 'v', rr: err, p: null });
          lastQ = qe;
        }
        i++; out.until = lastQ - 0.05; return out;
      };
    },
    /* regular beats with no conducted P: VT, ventricular escape, paced rhythm (k 'p') */
    vent: function (sp) {
      var t = 0.3, rr = 60 / sp.rate;
      return function () { var out = { P: [], Q: [{ t: t, d: sp.qrs, k: sp.k || 'v', rr: rr, p: null }], until: t + rr - 0.05 }; t += rr; return out; };
    },
    /* multifocal atrial tachycardia: ≥3 P morphologies, varying PR and RR */
    mat: function (sp, R) {
      var t = 0.25, mean = 60 / sp.rate, lastQ = null, shapes = ['n', 'abn', 'pul', 'inv', 'm'];
      return function () {
        var pk = shapes[Math.floor(R() * shapes.length)], pr = 0.12 + R() * 0.09, q = t + pr;
        var out = { P: [{ t: t, pk: pk }], Q: [{ t: q, d: sp.qrs, k: 'n', rr: lastQ == null ? mean : q - lastQ, p: t }], until: t };
        lastQ = q; t += clamp(mean * (0.72 + 0.56 * R()), 0.38, 0.85); out.until = t - 0.02; return out;
      };
    },
    /* atrial flutter: sawtooth F waves at frate, conducted ratio:1 */
    flut: function (sp) {
      var fp = 60 / (sp.frate || 300), k = 0, ratio = sp.ratio || 4;
      return function () {
        var q = 0.2 + k * ratio * fp + 0.27;
        var out = { P: [], Q: [{ t: q, d: sp.qrs, k: 'n', rr: ratio * fp, p: null }], until: q };
        k++; return out;
      };
    },
    /* continuous rhythms without discrete beats: vf, tdp, flat (asystole) */
    cont: function () { var t = 0; return function () { t += 1; return { P: [], Q: [], until: t }; }; }
  };
  function kind(sp) { return sp.k || (sp.qrs >= 0.12 ? 'v' : 'n'); }
  E.GEN = GEN;

  function Stream(spec, seed) {
    this.sp = spec; this.R = rng(seed || 20261122);
    this.P = []; this.Q = []; this.h = 0;
    this.next = GEN[spec.r](spec, this.R);
    var R = this.R; this.ph = [R() * 6.283, R() * 6.283, R() * 6.283];
    this.fib = spec.r === 'af';
  }
  Stream.prototype.ensure = function (t) {
    while (this.h < t + 2) {
      var c = this.next(), i;
      for (i = 0; i < c.P.length; i++) this.P.push(c.P[i]);
      for (i = 0; i < c.Q.length; i++) this.Q.push(c.Q[i]);
      this.h = c.until;
    }
    /* drop events that can no longer contribute (keeps memory flat for endless monitors) */
    var cut = t - 3;
    while (this.P.length && this.P[0].t < cut) this.P.shift();
    while (this.Q.length && this.Q[0].t < cut) this.Q.shift();
  };
  function sig(x) { return 1 / (1 + Math.exp(-x)); }
  function pwave(t, e, sp) {
    var c = e.t, k = e.pk || sp.pk || 'n', a = sp.pAmp || 0.15;
    if (k === 'inv') return g(t, c + 0.04, 0.018, -0.11);
    if (k === 'abn') return g(t, c + 0.035, 0.015, 0.09) + g(t, c + 0.075, 0.016, -0.06);
    if (k === 'pul') return g(t, c + 0.045, 0.019, 0.3);
    if (k === 'm') return g(t, c + 0.04, 0.022, 0.15) + g(t, c + 0.1, 0.024, 0.17);
    return g(t, c + 0.05, 0.022, a);
  }
  /* QRS + ST + T for one beat */
  function beat(t, e, sp) {
    var D = e.d, q0 = e.t, k = e.k, v = 0, tA, tW = 0.042;
    if (k === 'v') { v = g(t, q0 + 0.42 * D, 0.17 * D, 1.25) + g(t, q0 + 0.86 * D, 0.11 * D, -0.38); tA = -0.42; }
    else if (k === 'l' || k === 'p') {
      var o = 0;
      if (k === 'p') { v += g(t, q0, 0.0035, 1.4); o = 0.02; }
      v += g(t, q0 + o + 0.36 * D, 0.13 * D, 0.82) + g(t, q0 + o + 0.68 * D, 0.12 * D, 0.86); tA = -0.32;
    }
    else if (k === 'r') { v = g(t, q0 + 0.12 * D, 0.05 * D, 0.22) + g(t, q0 + 0.36 * D, 0.08 * D, -0.5) + g(t, q0 + 0.72 * D, 0.11 * D, 0.95); tA = -0.24; }
    else if (k === 'w') { v = g(t, q0 + 0.3 * D, 0.2 * D, 0.42) + g(t, q0 + 0.66 * D, 0.09 * D, 0.85) + g(t, q0 + 0.9 * D, 0.06 * D, -0.15); tA = 0.2; }
    else { v = g(t, q0 + 0.15 * D, 0.06 * D, -0.08) + g(t, q0 + 0.45 * D, 0.12 * D, 1.1) + g(t, q0 + 0.8 * D, 0.08 * D, -0.22); tA = 0.28; }
    var qt = clamp(0.4 * Math.sqrt(e.rr || 0.8), 0.26, 0.46) + (k === 'n' || k === 'w' ? 0 : 0.04);
    if (sp.qtx) qt *= sp.qtx;
    if (sp.tAmp != null && k === sp.tk) tA = sp.tAmp;
    if (sp.st && (k === 'n')) v += sp.st * (sig((t - q0 - D - 0.01) / 0.008) - sig((t - q0 - qt + 0.05) / 0.025));
    if (sp.dig && k === 'n') { v += g(t, q0 + D + 0.1, 0.055, -0.21); tA = 0.07; tW = 0.03; }
    return v + g(t, q0 + qt - 0.075, tW, tA);
  }
  /* signal at time t (mV) */
  Stream.prototype.v = function (t) {
    this.ensure(t);
    var sp = this.sp, v = 0, i, e;
    if (sp.r === 'cont') return this.cv(t);
    for (i = 0; i < this.P.length; i++) {
      e = this.P[i]; if (e.t > t + 0.3) break; if (e.t < t - 0.3) continue;
      v += pwave(t, e, sp);
    }
    for (i = 0; i < this.Q.length; i++) {
      e = this.Q[i]; if (e.t > t + 0.3) break; if (e.t < t - 0.8) continue;
      v += beat(t, e, sp);
    }
    var ph = this.ph;
    if (this.fib) v += 0.035 * Math.sin(6.283 * 5.3 * t + ph[0]) + 0.025 * Math.sin(6.283 * 7.4 * t + ph[1]) + 0.02 * Math.sin(6.283 * 3.9 * t + ph[2]) * Math.sin(6.283 * 0.4 * t);
    if (sp.r === 'flut') { /* negative sawtooth in II: brisk downstroke, slow return */
      var x = ((t - 0.2) * (sp.frate || 300) / 60) % 1; if (x < 0) x += 1;
      var A = 0.22, f = x < 0.22 ? -A * (x / 0.22) : -A * (1 - (x - 0.22) / 0.78);
      v += f + A / 2;
    }
    return v;
  };
  /* continuous waveforms */
  Stream.prototype.cv = function (t) {
    var ph = this.ph, sp = this.sp;
    if (sp.mode === 'tdp') { /* polymorphic VT twisting around the baseline */
      var env = Math.sin(Math.PI * t / 2.3 + ph[0]);
      return 0.92 * env * Math.sin(6.283 * 4.0 * t + 0.6 * Math.sin(6.283 * 0.7 * t)) + 0.08 * Math.sin(6.283 * 8.1 * t + ph[1]);
    }
    if (sp.mode === 'vf') {
      var a = 0.28 + 0.15 * Math.sin(6.283 * 0.31 * t + ph[0]) + 0.1 * Math.sin(6.283 * 0.83 * t + ph[1]);
      return a * (Math.sin(6.283 * 5.1 * t + ph[2]) + 0.6 * Math.sin(6.283 * 7.3 * t + 2 * Math.sin(6.283 * 0.5 * t)) + 0.35 * Math.sin(6.283 * 3.2 * t + ph[1]));
    }
    return 0.025 * Math.sin(6.283 * 0.25 * t + ph[0]) + 0.006 * Math.sin(6.283 * 9 * t);
  };
  /* QRS onset times in (a, b] — used for the optional beep */
  Stream.prototype.beatsIn = function (a, b) {
    this.ensure(b); var n = 0;
    for (var i = 0; i < this.Q.length; i++) { var x = this.Q[i].t + 0.02; if (x > a && x <= b) n++; }
    return n;
  };
  E.Stream = Stream;

  /* =====================================================================
     2. PAPER — static SVG strip, 25 mm/s, 10 mm/mV, 1 mm & 5 mm grid
     ===================================================================== */
  E.paper = function (spec, o) {
    o = o || {};
    var sec = o.seconds || 6, W = sec * 25 + 10, Hh = 30, base = 19, s = new Stream(spec, o.seed);
    var pts = [], x, t;
    /* calibration pulse 1 mV × 0.2 s */
    pts.push('M0,' + base, 'L1.5,' + base, 'L1.5,' + (base - 10), 'L6.5,' + (base - 10), 'L6.5,' + base, 'L10,' + base);
    for (x = 0; x <= sec * 25; x += 0.1) {
      t = 0.4 + x / 25;
      pts.push('L' + (10 + x).toFixed(1) + ',' + (base - 10 * s.v(t)).toFixed(2));
    }
    var id = 'hwg' + Math.random().toString(36).slice(2, 8);
    return '<div class="ecg-paper" dir="ltr"><svg viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="ECG">' +
      '<defs><pattern id="' + id + 's" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0V1H0" fill="none" class="ecg-g1"/></pattern>' +
      '<pattern id="' + id + 'b" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="url(#' + id + 's)"/><path d="M5 0V5H0" fill="none" class="ecg-g5"/></pattern></defs>' +
      '<rect width="' + W + '" height="' + Hh + '" class="ecg-pbg"/><rect width="' + W + '" height="' + Hh + '" fill="url(#' + id + 'b)"/>' +
      '<path d="' + pts.join('') + '" class="ecg-trace"/><text x="12" y="4" class="ecg-lead">' + H.esc(spec.lead || 'II') + '</text></svg></div>';
  };

  /* =====================================================================
     3. MONITOR — animated sweep on canvas (fading tail + erase gap)
     ===================================================================== */
  var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var actx = null;
  /* audio must be unlocked inside a user gesture (mobile browsers, sandboxed frames) */
  function unlockAudio() {
    try { actx = actx || new (w.AudioContext || w.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { actx = null; }
  }
  function beep() {
    try {
      if (!actx) return;
      var o = actx.createOscillator(), gn = actx.createGain();
      o.frequency.value = 880; gn.gain.value = 0.06;
      o.connect(gn); gn.connect(actx.destination);
      o.start(); gn.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.08); o.stop(actx.currentTime + 0.09);
    } catch (e) {}
  }

  function Monitor(box, spec, o) {
    o = o || {};
    var self = this;
    this.box = box; this.win = o.window || 5; /* seconds across the screen */
    this.cv = d.createElement('canvas'); this.cv.className = 'ecg-cv';
    this.cv.setAttribute('role', 'img'); this.cv.setAttribute('aria-label', 'ECG monitor');
    box.appendChild(this.cv);
    this.ctx = this.cv.getContext('2d');
    this.sound = false; this.playing = !reduce; this.visible = true; this.stats = { frames: 0, ms: 0 };
    this.set(spec);
    this.onResize = function () { self.resize(); };
    w.addEventListener('resize', this.onResize);
    if ('IntersectionObserver' in w) {
      this.io = new IntersectionObserver(function (en) { self.visible = en[0].isIntersecting; if (self.visible) self.kick(); });
      this.io.observe(box);
    }
    this.kick();
  }
  Monitor.prototype.set = function (spec) {
    this.s = new Stream(spec, 7); this.t = 0; this.last = null; this.resize();
    if (!this.playing) this.prefill();
  };
  Monitor.prototype.resize = function () {
    var r = this.box.getBoundingClientRect(), dpr = Math.min(w.devicePixelRatio || 1, 2);
    var cw = Math.max(200, Math.round(r.width)), ch = Math.round(cw < 520 ? 150 : 190);
    this.cv.style.height = ch + 'px';
    this.cv.width = Math.round(cw * dpr); this.cv.height = Math.round(ch * dpr);
    this.n = this.cv.width; this.ys = new Float32Array(this.n); this.has = new Uint8Array(this.n);
    this.x = 0; this.dpr = dpr;
    if (!this.playing) this.prefill(); else this.draw();
  };
  /* static full sweep (paused / reduced motion) */
  Monitor.prototype.prefill = function () {
    if (!this.ys) return;
    for (var x = 0; x < this.n; x++) { this.ys[x] = this.s.v(0.4 + x / this.n * this.win); this.has[x] = 1; }
    this.x = 0; this.full = true; this.draw();
  };
  Monitor.prototype.advance = function (dt) {
    var n = this.n, cols = dt / this.win * n, from = this.x, to = from + cols;
    var t0 = this.t;
    for (var c = Math.floor(from) + 1; c <= Math.floor(to); c++) {
      var tc = t0 + (c - from) / n * this.win, xi = c % n;
      this.ys[xi] = this.s.v(tc + 0.4); this.has[xi] = 1;
    }
    if (this.sound && this.s.beatsIn(t0 + 0.4, t0 + dt + 0.4)) beep();
    this.t = t0 + dt; this.x = to % n; this.full = false;
  };
  Monitor.prototype.draw = function () {
    var c = this.ctx, W = this.cv.width, Hh = this.cv.height, n = this.n, dpr = this.dpr;
    var t0 = performance.now();
    c.fillStyle = '#06161a'; c.fillRect(0, 0, W, Hh);
    /* faint grid: 0.2 s columns, 0.5 mV rows */
    var mm = Hh / 26; /* vertical: 26 "mm" visible, 10 mm per mV */
    c.strokeStyle = 'rgba(79,209,189,.07)'; c.lineWidth = 1;
    c.beginPath();
    for (var gx = 0; gx <= this.win / 0.2; gx++) { var px = Math.round(gx * 0.2 / this.win * W) + 0.5; c.moveTo(px, 0); c.lineTo(px, Hh); }
    for (var gy = 0; gy <= 26; gy += 5) { var py = Math.round(gy * mm) + 0.5; c.moveTo(0, py); c.lineTo(W, py); }
    c.stroke();
    var base = Hh * 0.66, sc = 10 * mm, gap = Math.round(n * 0.035), cur = Math.floor(this.x);
    c.lineWidth = 2 * dpr; c.lineJoin = 'round'; c.lineCap = 'round';
    var x;
    if (this.full) {
      c.beginPath();
      for (x = 0; x < n; x++) { var yf = base - this.ys[x] * sc; if (x) c.lineTo(x, yf); else c.moveTo(x, yf); }
      c.strokeStyle = 'rgba(79,209,189,1)'; c.stroke();
    } else {
      var LV = 14;
      for (var lv = 0; lv < LV; lv++) {
        c.beginPath(); var open = false;
        var k0 = Math.floor(lv / LV * n), k1 = Math.min(n - 1, Math.floor((lv + 1) / LV * n) + 1);
        for (var k = k0; k <= k1; k++) {
          x = cur - k; if (x < 0) x += n;
          if (!this.has[x] || (n - k) < gap) { open = false; continue; }
          if (x === n - 1 && k > 0) open = false; /* never join across the wrap seam */
          var y = base - this.ys[x] * sc;
          if (!open) { c.moveTo(x, y); open = true; } else c.lineTo(x, y);
        }
        c.strokeStyle = 'rgba(79,209,189,' + (1 - lv / LV * 0.82).toFixed(3) + ')';
        c.stroke();
      }
    }
    if (this.s.sp.lead) { c.fillStyle = 'rgba(201,255,245,.75)'; c.font = '700 ' + Math.round(12 * dpr) + 'px sans-serif'; c.fillText(this.s.sp.lead, 8 * dpr, 16 * dpr); }
    if (!this.full) { /* bright head dot */
      var hy = base - this.ys[cur] * sc;
      c.fillStyle = '#c9fff5'; c.beginPath(); c.arc(cur, hy, 2.6 * dpr, 0, 6.283); c.fill();
    }
    this.stats.frames++; this.stats.ms += performance.now() - t0;
  };
  Monitor.prototype.kick = function () {
    var self = this;
    if (this.raf || !this.playing || !this.visible) return;
    function loop(now) {
      self.raf = 0;
      if (!self.playing || !self.visible || !self.box.isConnected) { self.last = null; return; }
      if (self.last != null) self.advance(Math.min((now - self.last) / 1000, 0.1));
      self.last = now; self.draw();
      self.raf = w.requestAnimationFrame(loop);
    }
    this.raf = w.requestAnimationFrame(loop);
  };
  Monitor.prototype.play = function (v) {
    this.playing = v; this.last = null;
    if (v) { this.full = false; this.kick(); } else if (this.raf) { w.cancelAnimationFrame(this.raf); this.raf = 0; }
  };
  Monitor.prototype.destroy = function () {
    this.play(false); w.removeEventListener('resize', this.onResize); if (this.io) this.io.disconnect(); this.cv.remove();
  };
  E.Monitor = Monitor;

  /* =====================================================================
     4. LIBRARY UI
     ===================================================================== */
  function B(ar, en, tr) { return { ar: ar, en: en, tr: tr }; }
  var L = {
    rate: B('السرعة', 'Rate', 'Hız'), rhythm: B('النظم', 'Rhythm', 'Ritim'), p: B('الموجة P', 'P wave', 'P dalgası'),
    pr: B('فاصل PR', 'PR interval', 'PR aralığı'), qrs: B('مركّب QRS', 'QRS complex', 'QRS kompleksi'),
    rel: B('علاقة P بـ QRS', 'P–QRS relationship', 'P–QRS ilişkisi'),
    more: B('اقرأ المزيد', 'Read more', 'Devamını oku'), about: B('الشرح', 'Explanation', 'Açıklama'),
    monitor: B('مراقبة', 'Monitor', 'Monitör'), paper: B('تسجيل', 'Paper', 'Kâğıt'),
    play: B('تشغيل', 'Play', 'Oynat'), pause: B('إيقاف', 'Pause', 'Duraklat'),
    sound: B('الصوت', 'Sound', 'Ses'), lib: B('المكتبة', 'Library', 'Kütüphane'),
    title: B('أكاديمية تخطيط القلب', 'ECG Academy', 'EKG Akademisi'),
    sub: B('اقرأ الشريط خطوة بخطوة: السرعة والنظم والموجات والفواصل.', 'Read the strip step by step: rate, rhythm, waves and intervals.', 'Şeridi adım adım okuyun: hız, ritim, dalgalar ve aralıklar.'),
    cases: B('الحالات', 'Cases', 'Vakalar'), train: B('التدريب', 'Practice', 'Alıştırma'), lessons: B('الدروس', 'Lessons', 'Dersler'),
    soon: B('قريباً', 'Coming soon', 'Yakında'),
    trainSoon: B('شرائط عشوائية بلا نهاية من الزمر التي تختارها، مع فرجار رقمي للقياس.', 'Endless random strips from the groups you choose, with digital calipers.', 'Seçtiğiniz gruplardan sınırsız rastgele şeritler ve dijital pergel.'),
    lessonsSoon: B('دروس التخطيط تُنشر قريباً، وتظهر هنا تلقائياً.', 'ECG lessons are coming soon and will appear here automatically.', 'EKG dersleri yakında yayınlanacak ve burada otomatik olarak görünecek.'),
    loading: B('جارٍ التحميل…', 'Loading…', 'Yükleniyor…'),
    hint: B('ورق التخطيط: المربع الصغير 0.04 ثانية × 0.1 ملي فولط، والكبير 0.2 ثانية × 0.5 ملي فولط.', 'ECG paper: small square 0.04 s × 0.1 mV; large square 0.2 s × 0.5 mV.', 'EKG kâğıdı: küçük kare 0,04 sn × 0,1 mV; büyük kare 0,2 sn × 0,5 mV.')
  };
  E.L = L;
  var IC = {
    play: '<svg viewBox="0 0 24 24" class="ecg-i"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" class="ecg-i"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>',
    snd: '<svg viewBox="0 0 24 24" class="ecg-i"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    mute: '<svg viewBox="0 0 24 24" class="ecg-i"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
  };

  var CSS = '' +
    '.ecg-head{margin:0 0 14px}.ecg-head h2{margin:0 0 4px;font-size:1.35rem}.ecg-head p{margin:0;opacity:.7;font-size:14px;line-height:1.7}' +
    '.ecg-soon{padding:22px 18px;border:1px dashed var(--hw-line);border-radius:var(--hw-radius,14px);text-align:center;line-height:1.8}' +
    '.ecg-soon b{display:inline-block;margin-bottom:6px;padding:2px 10px;border-radius:99px;background:var(--hw-accent-soft);color:var(--hw-accent-ink);font-size:13px}' +
    '.ecg-rel:empty{display:none}.ecg-rel{margin-top:6px}' +
    '.ecg{--ecg-tr:#0c9784}' +
    '.ecg-view{border-radius:var(--hw-radius,14px);overflow:hidden;border:1px solid var(--hw-line);background:var(--hw-bg)}' +
    '.ecg-screen{position:relative;background:#06161a;line-height:0}' +
    '.ecg-cv{display:block;width:100%}' +
    '.ecg-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 8px;padding:10px 12px;background:#0a7a6b;color:#fff}' +
    '.ecg-bar h3{flex:1 1 100%;margin:0;font-size:16.5px;line-height:1.4;color:#fff;overflow-wrap:anywhere}' +
    '.ecg-ctl{display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
    '.ecg-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:40px;height:38px;padding:0 10px;border:1px solid rgba(255,255,255,.45);border-radius:10px;background:rgba(255,255,255,.12);color:#fff;font:inherit;font-size:13px;font-weight:700;cursor:pointer}' +
    '.ecg-btn:focus-visible{outline:2px solid #fff;outline-offset:2px}' +
    '.ecg-btn[aria-pressed=true]{background:#fff;color:var(--hw-accent-ink,#0a7a6b)}' +
    '.ecg-seg{display:inline-flex;border:1px solid rgba(255,255,255,.45);border-radius:10px;overflow:hidden}' +
    '.ecg-seg .ecg-btn{border:0;border-radius:0}' +
    '.ecg-i{width:18px;height:18px}' +
    '.ecg-paper{overflow-x:auto;-webkit-overflow-scrolling:touch;background:#fff7f6}' +
    '.ecg-paper svg{display:block;min-width:620px;width:100%;height:auto}' +
    '.ecg-pbg{fill:#fff7f6}.ecg-g1{stroke:#f6c9c4;stroke-width:.06}.ecg-g5{stroke:#ec9a92;stroke-width:.16}' +
    '.ecg-trace{fill:none;stroke:#14212b;stroke-width:.32;stroke-linejoin:round;stroke-linecap:round}' +
    '.ecg-lead{font:700 3px sans-serif;fill:#14212b}' +
    '.ecg-hint{margin:0;padding:6px 12px;font-size:12px;color:var(--hw-muted);border-top:1px solid var(--hw-line)}' +
    '.ecg-more{margin-top:10px}' +
    '.ecg-f{display:grid;grid-template-columns:minmax(96px,34%) 1fr;margin:0;border:1px solid var(--hw-line);border-radius:12px;overflow:hidden}' +
    '.ecg-f dt,.ecg-f dd{margin:0;padding:9px 12px;border-bottom:1px solid var(--hw-line);font-size:14.5px;line-height:1.6}' +
    '.ecg-f dt{font-weight:700;background:var(--hw-bg-soft);color:var(--hw-accent-ink)}' +
    '.ecg-f dt:nth-last-of-type(1),.ecg-f dd:last-of-type{border-bottom:0}' +
    '.ecg-txt{margin:12px 0 0;line-height:1.85}' +
    '.ecg-lib{margin-top:14px}' +
    '@media (hover:hover) and (pointer:fine){.ecg-lib>.hw-tablist{flex-wrap:wrap;overflow:visible;gap:8px}}' +
    '.ecg-list{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:8px}' +
    '.ecg-item{display:flex;align-items:center;gap:10px;width:100%;min-height:50px;padding:10px 14px;border:1px solid var(--hw-line);border-radius:12px;background:var(--hw-bg);color:var(--hw-ink);font:inherit;font-size:15px;font-weight:600;text-align:start;cursor:pointer}' +
    '.ecg-item:hover{border-color:var(--hw-accent)}' +
    '.ecg-item[aria-current=true]{background:var(--hw-accent-soft);border-color:var(--hw-accent);color:var(--hw-accent-ink)}' +
    '.ecg-item .ecg-dot{width:10px;height:10px;border-radius:50%;background:var(--hw-line);flex-shrink:0}' +
    '.ecg-item[aria-current=true] .ecg-dot{background:var(--hw-accent);box-shadow:0 0 0 4px rgba(12,151,132,.18)}' +
    '.ecg-item span:last-child{flex:1}';

  function injectCss() {
    if (d.getElementById('hawi-ecg-css')) return;
    var st = d.createElement('style'); st.id = 'hawi-ecg-css'; st.textContent = CSS; d.head.appendChild(st);
  }

  /* =====================================================================
     5. ACADEMY SHELL — tabs (library · cases · practice · lessons) + deep links
        #library/<id> · #cases[/<set>[/<n>]] · #train · #lessons
     ===================================================================== */
  function route() {
    var h = decodeURIComponent((location.hash || '').slice(1)).split('/');
    var tab = ['library', 'cases', 'train', 'lessons'].indexOf(h[0]) > -1 ? h[0] : null;
    return { tab: tab, a: h[1] || null, b: h[2] || null };
  }
  function setHash(h) { try { history.replaceState(null, '', '#' + h); } catch (e) {} }
  function soon(text) { return '<div class="ecg-soon"><b>' + H.bi(L.soon) + '</b><br>' + H.bi(text) + '</div>'; }
  function lessons(p) {
    p.innerHTML = '<p class="ecg-hint">' + H.bi(L.loading) + '</p>';
    H.feed('ECG', 150).then(function (list) {
      if (!list.length) { p.innerHTML = soon(L.lessonsSoon); return; }
      p.innerHTML = '<ul class="hw-links">' + list.map(function (x) { return '<li><a href="' + H.esc(x.u) + '">' + H.bi(x.t) + '</a></li>'; }).join('') + '</ul>';
    });
  }
  function shell(mount, data) {
    mount.classList.add('ecg-app');
    /* the page's own title (Blogger h1) already names the academy: show ours only when there is none */
    var own = d.querySelector('h1');
    mount.innerHTML = '<header class="ecg-head">' + (own ? '' : '<h2>' + H.bi(L.title) + '</h2>') + '<p>' + H.bi(L.sub) + '</p></header><div class="js-top"></div>';
    var r = route(), lib = null, cs = null;
    var top = H.tabs(mount.querySelector('.js-top'), { variant: 'line', tabs: [
      { id: 'library', label: L.lib, render: function (p) { var x = route(); lib = library(p, data, x.tab === 'library' ? x.a : null); } },
      { id: 'cases', label: L.cases, render: function (p) { var x = route(); cs = casesTab(p, data, x.tab === 'cases' ? x : null); } },
      { id: 'train', label: L.train, html: soon(L.trainSoon) },
      { id: 'lessons', label: L.lessons, render: lessons }
    ], onChange: function (id) { if (ready) setHash(id === 'library' && lib ? 'library/' + lib.cur() : id === 'cases' && cs ? cs.hash() : id); } });
    var ready = false;
    top.select(r.tab || 'library', { silent: true });
    ready = true;
    w.addEventListener('hashchange', function () {
      var x = route(); if (!x.tab) return;
      top.select(x.tab);
      if (x.tab === 'library' && x.a && lib) lib.go(x.a, true);
      if (x.tab === 'cases' && cs) cs.go(x.a, x.b);
    });
  }

  /* data: <script type="text/hawi"> in the page (old pages), else the data file next to this script */
  function withData(cb) {
    if (E.data) { cb(E.data); return; }
    var done = function () { try { E.data = H.decode(w.HawiEcgData || ''); } catch (e) { E.data = null; } cb(E.data); };
    if (w.HawiEcgData) { done(); return; }
    var s = d.createElement('script'); s.src = BASE + 'hawi-ecg-data.js' + VQ; s.onload = done; s.onerror = function () { cb(null); };
    d.body.appendChild(s);
  }

  H.apps.ecg = function (mount, data) {
    injectCss();
    /* inline strip inside a lesson post: <div data-hawi-app="ecg" data-strip='{"r":"af","rate":110,"qrs":0.08}'> */
    var inline = mount.getAttribute('data-strip');
    if (inline) {
      var spec; try { spec = JSON.parse(inline); } catch (e) { return; }
      mount.classList.add('ecg');
      mount.innerHTML = E.paper(spec, { seconds: +mount.getAttribute('data-seconds') || 6 });
      return;
    }
    if (data && data.items && data.items.length) { shell(mount, data); return; }
    mount.innerHTML = '<p class="ecg-hint">' + H.bi(L.loading) + '</p>';
    withData(function (x) { if (x && x.items && x.items.length) shell(mount, x); else mount.innerHTML = ''; });
  };

  /* library atlas inside a panel; returns { cur(), go(id, scroll) } */
  function library(mount, data, startId) {
    var items = data.items, groups = data.groups || [{ id: 'all', name: L.lib }];
    var key = 'ecg-lib';
    var pref = H.store.get(key, {});
    var cur = items.filter(function (x) { return x.id === (startId || pref.id); })[0] || items.filter(function (x) { return x.id === pref.id; })[0] || items[0];
    var mode = reduce ? 'paper' : (pref.mode || 'monitor');

    mount.classList.add('ecg');
    mount.innerHTML =
      '<section class="ecg-view">' +
        '<div class="ecg-bar"><h3 class="js-name"></h3><div class="ecg-ctl">' +
          '<span class="ecg-seg" role="group"><button type="button" class="ecg-btn js-mode" data-m="monitor">' + H.bi(L.monitor) + '</button>' +
          '<button type="button" class="ecg-btn js-mode" data-m="paper">' + H.bi(L.paper) + '</button></span>' +
          '<button type="button" class="ecg-btn js-play"></button>' +
          '<button type="button" class="ecg-btn js-snd" aria-pressed="false"></button>' +
        '</div></div>' +
        '<div class="js-stage"></div>' +
      '</section>' +
      '<div class="ecg-more js-more"></div>' +
      '<div class="ecg-rel js-relw"></div>' +
      '<div class="ecg-lib js-lib"></div>';

    var stage = mount.querySelector('.js-stage'), mon = null;
    var bPlay = mount.querySelector('.js-play'), bSnd = mount.querySelector('.js-snd');

    function syncButtons() {
      mount.querySelectorAll('.js-mode').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-m') === mode)); });
      var playing = mon && mon.playing;
      bPlay.innerHTML = playing ? IC.pause : IC.play;
      bPlay.setAttribute('aria-label', H.t(playing ? L.pause : L.play));
      bPlay.hidden = mode !== 'monitor'; bSnd.hidden = mode !== 'monitor';
      var on = !!(mon && mon.sound);
      bSnd.innerHTML = on ? IC.snd : IC.mute; bSnd.setAttribute('aria-pressed', String(on)); bSnd.setAttribute('aria-label', H.t(L.sound));
    }
    function renderStage() {
      var keepSound = mon && mon.sound;
      if (mon) { mon.destroy(); mon = null; }
      stage.innerHTML = '';
      if (mode === 'monitor') {
        var sc = d.createElement('div'); sc.className = 'ecg-screen'; sc.setAttribute('dir', 'ltr'); stage.appendChild(sc);
        mon = new Monitor(sc, cur.strip); mon.sound = !!keepSound;
      } else {
        stage.innerHTML = E.paper(cur.strip, { seconds: 8 }) + '<p class="ecg-hint">' + H.bi(L.hint) + '</p>';
      }
      syncButtons();
    }
    function renderMore() {
      var f = cur.f || {}, rows = ['rate', 'rhythm', 'p', 'pr', 'qrs', 'rel'].filter(function (k) { return f[k]; });
      var box = mount.querySelector('.js-more'); box.innerHTML = '';
      H.accordion(box, [{ id: 'm', title: L.more, open: !!pref.open, html:
        '<dl class="ecg-f">' + rows.map(function (k) { return '<dt>' + H.bi(L[k]) + '</dt><dd>' + H.bi(f[k]) + '</dd>'; }).join('') + '</dl>' +
        (cur.text ? '<p class="ecg-txt">' + H.bi(cur.text) + '</p>' : '') }], { soft: true });
      box.querySelector('details').addEventListener('toggle', function (e) { pref.open = e.target.open; H.store.set(key, pref); });
      var rw = mount.querySelector('.js-relw'); rw.innerHTML = '';
      if (H.related && cur.tags && cur.tags.length) { var rb = d.createElement('div'); rw.appendChild(rb); H.related(rb, cur.tags); }
    }
    function select(it, scroll) {
      cur = it; pref.id = it.id; H.store.set(key, pref); setHash('library/' + it.id);
      mount.querySelector('.js-name').innerHTML = H.bi(it.short || it.name);
      if (mon) mon.set(it.strip); else renderStage();
      renderMore();
      mount.querySelectorAll('.ecg-item').forEach(function (b) { b.setAttribute('aria-current', String(b.getAttribute('data-id') === it.id)); });
      if (scroll) mount.querySelector('.ecg-view').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }

    mount.querySelectorAll('.js-mode').forEach(function (b) {
      b.addEventListener('click', function () {
        var m = b.getAttribute('data-m'); if (m === mode) return;
        mode = m; pref.mode = m; H.store.set(key, pref); renderStage();
      });
    });
    bPlay.addEventListener('click', function () { if (!mon) return; mon.play(!mon.playing); if (!mon.playing) mon.draw(); syncButtons(); });
    bSnd.addEventListener('click', function () { if (!mon) return; mon.sound = !mon.sound; if (mon.sound) unlockAudio(); syncButtons(); });

    /* library list: one pill tab per group */
    var lib = mount.querySelector('.js-lib');
    function listHtml(gid) {
      return '<ul class="ecg-list">' + items.filter(function (x) { return gid === 'all' || x.group === gid; }).map(function (x) {
        return '<li><button type="button" class="ecg-item" data-id="' + H.esc(x.id) + '" aria-current="' + (x.id === cur.id) + '"><span class="ecg-dot"></span><span>' + H.bi(x.name) + '</span></button></li>';
      }).join('') + '</ul>';
    }
    var startGroup = (groups.filter(function (gr) { return gr.id === cur.group; })[0] || groups[0]).id;
    var tabs = H.tabs(lib, { variant: 'pills', tabs: groups.map(function (gr) { return { id: gr.id, label: gr.name, render: function (p) { p.innerHTML = listHtml(gr.id); } }; }) });
    tabs.select(startGroup);
    lib.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.ecg-item'); if (!b) return;
      var it = items.filter(function (x) { return x.id === b.getAttribute('data-id'); })[0];
      if (it) select(it, true);
    });

    mount.querySelector('.js-name').innerHTML = H.bi(cur.short || cur.name);
    renderStage(); renderMore();
    E.active = function () { return { mon: mon, mode: mode, cur: cur }; }; /* test/debug hook */
    return {
      cur: function () { return cur.id; },
      go: function (id, scroll) {
        var it = items.filter(function (x) { return x.id === id; })[0]; if (!it || it === cur) return;
        var gt = (groups.filter(function (gr) { return gr.id === it.group; })[0] || {}).id; if (gt) tabs.select(gt);
        select(it, scroll);
      }
    };
  }

  /* =====================================================================
     6. CASES — systematic reading: rate → rhythm → P → PR → QRS → diagnosis.
        The answers come from the strip itself (E.measure / E.derive), so a case
        can never contradict the trace it shows. Data: hawi-ecg-cases.js (HW1).
        Deep links: #cases · #cases/<set> · #cases/<set>/<n>
     ===================================================================== */
  var CASE_SEC = 10, SEED0 = 20261122;
  /* everything a reader can measure on the strip E.paper draws (t from 0.4 s, `sec` long) */
  E.measure = function (spec, seed, sec) {
    sec = sec || CASE_SEC;
    var s = new Stream(spec, seed || SEED0), t0 = 0.4, t1 = 0.4 + sec, P = [], Q = [], h = 0, c, i;
    while (h < t1 + 1) { c = s.next(); for (i = 0; i < c.P.length; i++) P.push(c.P[i]); for (i = 0; i < c.Q.length; i++) Q.push(c.Q[i]); h = c.until; }
    /* a beat counts when its R peak is on the paper; a P when its peak is */
    Q = Q.filter(function (e) { var pk = e.t + 0.45 * e.d; return pk >= t0 && pk <= t1; });
    P = P.filter(function (e) { var pk = e.t + 0.05; return pk >= t0 && pk <= t1; });
    var rr = [], prs = [], prN = [], pk = {}, wide = [], narrow = [];
    for (i = 1; i < Q.length; i++) rr.push(Q[i].t - Q[i - 1].t);
    P.forEach(function (e) { pk[e.t.toFixed(4)] = e.pk || ''; });
    Q.forEach(function (q) {
      if (q.p != null) { prs.push(q.t - q.p); if (!pk[q.p.toFixed(4)]) prN.push(q.t - q.p); }
      ((q.d >= 0.12 || q.k !== 'n') ? wide : narrow).push(q.d);
    });
    /* PR is read on the ordinary (sinus) beats when there are any */
    if (prN.length && (spec.r === 'pac' || spec.r === 'esc')) prs = prN;
    var mean = rr.length ? rr.reduce(function (a, b) { return a + b; }, 0) / rr.length : 0;
    function mn(a) { return a.length ? Math.min.apply(null, a) : 0; }
    function mx(a) { return a.length ? Math.max.apply(null, a) : 0; }
    return {
      sec: sec, n: Q.length, nP: P.length, n6: Math.round(Q.length * 60 / sec),
      rate: mean ? Math.round(60 / mean) : 0, rr: mean, rrMin: mn(rr), rrMax: mx(rr),
      prMin: mn(prs), prMax: mx(prs), prN: prs.length, qrs: spec.qrs || 0,
      nWide: wide.length, nNarrow: narrow.length, qrsW: mx(wide), qrsN: mx(narrow)
    };
  };
  function rateBucket(r) { return r < 60 ? 'lt60' : r <= 100 ? '60-100' : r <= 150 ? '101-150' : 'gt150'; }
  E.rateBucket = rateBucket;
  /* the expected answer for each reading step (null = step does not apply to this strip) */
  E.derive = function (spec, seed, sec) {
    var m = E.measure(spec, seed, sec), r = spec.r, a = {};
    if (r === 'cont') return { rate: null, rhythm: null, p: 'none', pr: 'na', qrs: null, m: m };
    a.rate = rateBucket(m.rate);
    a.rhythm = (r === 'af' || r === 'mat') ? 'irr-irr' : (m.rrMax - m.rrMin < 0.12 ? 'reg' : 'reg-irr');
    if (spec.noP || r === 'af' || r === 'vent') a.p = 'none';
    else if (r === 'flut') a.p = 'flutter';
    else if (r === 'avb2' || r === 'chb') a.p = 'more';
    else if (r === 'pac' || r === 'pvc' || r === 'esc') a.p = 'mixed';
    else if (spec.pk === 'inv') a.p = 'inv';
    else if (r === 'mat' || (spec.pk && spec.pk !== 'n')) a.p = 'abn';
    else a.p = 'normal';
    if (r === 'chb') a.pr = 'var';
    else if (r === 'avb2' && spec.mode === 'w') a.pr = 'prog';
    else if (!m.prN || a.p === 'none' || a.p === 'flutter') a.pr = 'na';
    else if (m.prMax - m.prMin > 0.03) a.pr = 'var';
    else if (m.prMax < 0.12) a.pr = 'short';
    else if (m.prMin > 0.2005) a.pr = 'long';
    else a.pr = 'normal';
    a.qrs = m.nWide && m.nNarrow ? 'mix' : m.nWide ? 'wide' : 'narrow';
    a.m = m;
    return a;
  };

  var OPT = {
    rate: [['lt60', B('أقل من 60', 'Under 60', '60\'ın altında')], ['60-100', '60–100'], ['101-150', '101–150'], ['gt150', B('أكثر من 150', 'Over 150', '150\'nin üzerinde')]],
    rhythm: [['reg', B('منتظم', 'Regular', 'Düzenli')],
      ['reg-irr', B('غير منتظم بنمط (يتكرّر أو يتدرّج)', 'Irregular with a pattern (repeating or gradual)', 'Belirli bir düzende düzensiz (tekrarlayan veya kademeli)')],
      ['irr-irr', B('غير منتظم بلا أي نمط', 'Irregularly irregular', 'Düzensiz olarak düzensiz')]],
    p: [['normal', B('طبيعية: موجبة ومتماثلة، واحدة قبل كل QRS', 'Normal: upright and uniform, one before each QRS', 'Normal: pozitif ve aynı şekilli, her QRS öncesi bir tane')],
      ['mixed', B('طبيعية، لكن بعض الضربات بلا P أو بـP مختلفة', 'Normal, but some beats have no P or a different P', 'Normal; ancak bazı atımlarda P yok veya farklı')],
      ['abn', B('بشكل غير طبيعي أو متغيّر', 'Abnormal or changing shape', 'Anormal veya değişken şekilli')],
      ['inv', B('مقلوبة (راجعة)', 'Inverted (retrograde)', 'Negatif (retrograd)')],
      ['more', B('موجات P أكثر من مركّبات QRS', 'More P waves than QRS complexes', 'P dalgaları QRS\'lerden fazla')],
      ['flutter', B('موجات F بشكل أسنان المنشار', 'Sawtooth F waves', 'Testere dişi F dalgaları')],
      ['none', B('غائبة (أو موجات رجفانية)', 'Absent (or fibrillatory waves)', 'Yok (veya fibrilasyon dalgaları)')]],
    pr: [['normal', B('طبيعي 0.12–0.20 ثانية وثابت', 'Normal, 0.12–0.20 s and constant', 'Normal, 0,12–0,20 sn ve sabit')],
      ['short', B('قصير (أقل من 0.12 ثانية)', 'Short (< 0.12 s)', 'Kısa (< 0,12 sn)')],
      ['long', B('طويل (أكثر من 0.20 ثانية) وثابت', 'Long (> 0.20 s) and constant', 'Uzun (> 0,20 sn) ve sabit')],
      ['prog', B('يطول تدريجياً ثم تُحجب P', 'Lengthens progressively until a P is blocked', 'Bir P bloke olana dek giderek uzar')],
      ['var', B('متغيّر بلا علاقة ثابتة', 'Varies with no fixed relationship', 'Sabit ilişki olmadan değişken')],
      ['na', B('غير قابل للقياس', 'Not measurable', 'Ölçülemez')]],
    qrs: [['narrow', B('ضيّق (أقل من 0.12 ثانية)', 'Narrow (< 0.12 s)', 'Dar (< 0,12 sn)')], ['wide', B('عريض (0.12 ثانية أو أكثر)', 'Wide (≥ 0.12 s)', 'Geniş (≥ 0,12 sn)')],
      ['mix', B('ضيّق، مع ضربات عريضة بينها', 'Narrow, with some wide beats among them', 'Dar; aralarında geniş atımlar var')]]
  };
  var STEPS = ['rate', 'rhythm', 'p', 'pr', 'qrs', 'dx'];
  var PTS = { rate: 1, rhythm: 1, p: 1, pr: 1, qrs: 1, dx: 2 };
  var CL = {
    dx: B('التفسير', 'Interpretation', 'Yorum'),
    q: {
      rate: B('كم سرعة البطينين في الدقيقة؟', 'What is the ventricular rate per minute?', 'Dakikadaki ventrikül hızı nedir?'),
      rhythm: B('هل النظم منتظم؟', 'Is the rhythm regular?', 'Ritim düzenli mi?'),
      p: B('كيف تبدو موجات P؟', 'What do the P waves look like?', 'P dalgaları nasıl görünüyor?'),
      pr: B('كم فاصل PR؟', 'What is the PR interval?', 'PR aralığı nedir?'),
      qrs: B('كم عرض مركّب QRS؟', 'How wide is the QRS complex?', 'QRS kompleksi ne genişlikte?'),
      dx: B('ما تفسير هذا الشريط؟', 'What is your interpretation of this strip?', 'Bu şeridi nasıl yorumlarsınız?')
    },
    tip: {
      rate: B('عُدّ مركّبات QRS في الشريط (10 ثوانٍ) واضربها × 6، أو اقسم 300 على عدد المربعات الكبيرة بين R وR.', 'Count the QRS complexes on this 10-s strip and multiply by 6, or divide 300 by the number of large squares between two R waves.', 'Bu 10 saniyelik şeritteki QRS\'leri sayıp 6 ile çarpın veya 300\'ü iki R arasındaki büyük kare sayısına bölün.'),
      rhythm: B('قارن مسافات R–R: فرق أكبر من 0.12 ثانية (3 مربعات صغيرة) يعني عدم انتظام.', 'Compare the R–R intervals: a difference over 0.12 s (3 small squares) means irregular.', 'R–R aralıklarını karşılaştırın: 0,12 sn\'den (3 küçük kare) fazla fark düzensizlik demektir.'),
      p: B('ابحث عن P قبل كل QRS: هل هي موجبة في II ومتماثلة؟ وهل عددها يساوي عدد QRS؟', 'Look for a P before every QRS: upright in II and uniform? As many P waves as QRS complexes?', 'Her QRS\'ten önce P arayın: DII\'de pozitif ve aynı şekilli mi? Sayısı QRS sayısına eşit mi?'),
      pr: B('من بداية P إلى بداية QRS. المربع الصغير 0.04 ثانية، والطبيعي 3–5 مربعات صغيرة.', 'From the start of P to the start of QRS. A small square is 0.04 s; normal is 3–5 small squares.', 'P başlangıcından QRS başlangıcına. Küçük kare 0,04 sn; normali 3–5 küçük karedir.'),
      qrs: B('من بداية Q إلى نهاية S. ثلاثة مربعات صغيرة = 0.12 ثانية.', 'From the start of Q to the end of S. Three small squares = 0.12 s.', 'Q başlangıcından S sonuna. Üç küçük kare = 0,12 sn.'),
      dx: B('اجمع ما وجدته في الخطوات الخمس.', 'Put together what you found in the five steps.', 'Beş adımda bulduklarınızı birleştirin.')
    },
    sets: B('مجموعات الحالات', 'Case sets', 'Vaka setleri'),
    caseN: B('الحالة', 'Case', 'Vaka'), setN: B('المجموعة', 'Set', 'Set'),
    lv: [null, B('سهلة', 'Easy', 'Kolay'), B('متوسطة', 'Medium', 'Orta'), B('صعبة', 'Hard', 'Zor')],
    step: B('الخطوة', 'Step', 'Adım'), of: B('من', 'of', '/'),
    next: B('التالي', 'Next', 'İleri'), finish: B('النتيجة', 'See result', 'Sonucu gör'),
    back: B('رجوع', 'Back', 'Geri'), retry: B('أعد الحالة', 'Retry case', 'Vakayı tekrarla'), nextCase: B('الحالة التالية', 'Next case', 'Sonraki vaka'),
    right: B('صحيح', 'Correct', 'Doğru'), yours: B('إجابتك', 'Your answer', 'Cevabınız'), correctIs: B('الصحيح', 'Correct', 'Doğrusu'),
    result: B('النتيجة', 'Result', 'Sonuç'), expl: B('الشرح', 'Explanation', 'Açıklama'),
    openLib: B('افتح هذا النظم في المكتبة', 'Open this rhythm in the Library', 'Bu ritmi kütüphanede aç'),
    solved: B('حالة محلولة', 'cases solved', 'çözülen vaka'), avg: B('متوسط أفضل درجة', 'average best score', 'ortalama en iyi puan'),
    best: B('الأفضل', 'Best', 'En iyi'),
    mist: B('سجلّ الأخطاء', 'Mistakes log', 'Hata kaydı'), noMist: B('لا أخطاء مسجّلة بعد.', 'No mistakes recorded yet.', 'Henüz kayıtlı hata yok.'),
    open: B('افتح', 'Open', 'Aç'),
    clear: B('مسح السجل', 'Clear log', 'Kaydı temizle'),
    clearQ: B('سيُحذف سجل حالات التخطيط ودرجاتها من هذا الجهاز. متابعة؟', 'This deletes your ECG case log and scores on this device. Continue?', 'Bu cihazdaki EKG vaka kaydınız ve puanlarınız silinecek. Devam edilsin mi?'),
    cancel: B('إلغاء', 'Cancel', 'İptal'), del: B('حذف', 'Delete', 'Sil'),
    unavailable: B('تعذّر تحميل الحالات. حدّث الصفحة.', 'Could not load the cases. Refresh the page.', 'Vakalar yüklenemedi. Sayfayı yenileyin.'),
    local: B('تُحفظ درجاتك وأخطاؤك على هذا الجهاز فقط.', 'Your scores and mistakes are kept on this device only.', 'Puanlarınız ve hatalarınız yalnızca bu cihazda saklanır.')
  };
  E.CL = CL; E.OPT = OPT;

  /* numbers in all three languages (Turkish uses a decimal comma) */
  function nb(x, dp) { var s = (+x).toFixed(dp == null ? 2 : dp); return { ar: s, en: s, tr: s.replace('.', ',') }; }
  function T(tpl, vals) { /* tpl: {ar,en,tr} with {k} slots; vals: k -> string | nb() */
    var o = {};
    ['ar', 'en', 'tr'].forEach(function (l) {
      o[l] = tpl[l].replace(/\{(\w+)\}/g, function (_, k) { var v = vals[k]; return v == null ? '' : (typeof v === 'object' ? (v[l] != null ? v[l] : v.en) : String(v)); });
    });
    return o;
  }
  function sq(sec) { var v = Math.round(sec / 0.04 * 2) / 2; return nb(v, v % 1 ? 1 : 0); }
  /* why the correct option is correct, with the numbers of this very strip */
  function why(step, ans, m, item) {
    var v = ans[step];
    if (step === 'rate') return T(B('في هذا الشريط (10 ثوانٍ) {n} مركّبات QRS، أي نحو {n6} في الدقيقة؛ ومتوسط R–R {rr} ثانية ← 60 ÷ {rr} ≈ {r}.',
      'This 10-s strip shows {n} QRS complexes, about {n6}/min; the mean R–R is {rr} s → 60 ÷ {rr} ≈ {r}.',
      'Bu 10 saniyelik şeritte {n} QRS var, yani dakikada yaklaşık {n6}; ortalama R–R {rr} sn → 60 ÷ {rr} ≈ {r}.'), { n: m.n, n6: m.n6, rr: nb(m.rr), r: m.rate });
    if (step === 'rhythm') {
      if (v === 'reg') return m.rrMax - m.rrMin < 0.005 ? T(B('كل مسافات R–R متساوية ({a} ثانية).', 'Every R–R interval is the same ({a} s).', 'Tüm R–R aralıkları aynı ({a} sn).'), { a: nb(m.rr) }) :
        T(B('مسافات R–R متساوية تقريباً ({a}–{b} ثانية).', 'The R–R intervals are essentially equal ({a}–{b} s).', 'R–R aralıkları neredeyse eşit ({a}–{b} sn).'), { a: nb(m.rrMin), b: nb(m.rrMax) });
      if (v === 'reg-irr') return T(B('تتراوح R–R بين {a} و{b} ثانية (فرق {d}، أكبر من 0.12)، وتتغيّر بتدرّج أو بنمط متكرر لا عشوائياً.', 'R–R ranges from {a} to {b} s (a {d} s difference, over 0.12), changing gradually or in a repeating pattern rather than at random.', 'R–R {a} ile {b} sn arasında değişir ({d} sn fark, 0,12\'den fazla); rastgele değil, kademeli veya tekrarlayan bir düzende.'), { a: nb(m.rrMin), b: nb(m.rrMax), d: nb(m.rrMax - m.rrMin) });
      return T(B('تتراوح R–R بين {a} و{b} ثانية دون أي نمط.', 'R–R ranges from {a} to {b} s with no pattern at all.', 'R–R hiçbir düzen olmadan {a} ile {b} sn arasında değişir.'), { a: nb(m.rrMin), b: nb(m.rrMax) });
    }
    if (step === 'p') {
      if (v === 'normal') return B('قبل كل QRS موجة P واحدة موجبة في II، وكلها بالشكل نفسه، ولا موجات P زائدة.', 'Every QRS has one P wave before it, upright in II and identical in shape, with no extra P waves.', 'Her QRS\'ten önce DII\'de pozitif, aynı şekilli tek bir P var; fazladan P dalgası yok.');
      if (v === 'more') return T(B('{n} موجة P مقابل {q} مركّباً فقط.', '{n} P waves against only {q} QRS complexes.', 'Yalnızca {q} QRS\'e karşı {n} P dalgası.'), { n: m.nP, q: m.n });
      return null;
    }
    if (step === 'pr') {
      if (v === 'na' || !m.prN) return null;
      if (m.prMax - m.prMin > 0.005) return T(B('يتراوح PR بين {a} و{b} ثانية.', 'PR ranges from {a} to {b} s.', 'PR {a} ile {b} sn arasında.'), { a: nb(m.prMin), b: nb(m.prMax) });
      return T(B('PR = {a} ثانية ({s} مربعات صغيرة)، وهو ثابت في كل الضربات.', 'PR = {a} s ({s} small squares), the same in every beat.', 'PR = {a} sn ({s} küçük kare), her atımda aynı.'), { a: nb(m.prMin), s: sq(m.prMin) });
    }
    if (step === 'qrs' && v === 'mix') return T(B('الضربات الضيّقة QRS = {a} ثانية، والعريضة {b} ثانية.', 'The narrow beats have QRS = {a} s; the wide ones {b} s.', 'Dar atımlarda QRS = {a} sn; geniş olanlarda {b} sn.'), { a: nb(m.qrsN), b: nb(m.qrsW) });
    if (step === 'qrs' && v === 'wide' && m.qrsW) return T(B('QRS = {a} ثانية ({s} مربعات صغيرة).', 'QRS = {a} s ({s} small squares).', 'QRS = {a} sn ({s} küçük kare).'), { a: nb(m.qrsW), s: sq(m.qrsW) });
    if (step === 'qrs') return T(B('QRS = {a} ثانية ({s} مربعات صغيرة).', 'QRS = {a} s ({s} small squares).', 'QRS = {a} sn ({s} küçük kare).'), { a: nb(m.qrs), s: sq(m.qrs) });
    if (step === 'dx' && item) return item.short || item.name;
    return null;
  }

  /* library facts quote the library strip ("(75 here)"); a case has its own strip, so drop those notes */
  var HERE = /\s*\([^()]*(هنا|\bhere\b|\bburada\b)[^()]*\)/gi;
  function noHere(v) { if (v == null || typeof v !== 'object') return typeof v === 'string' ? v.replace(HERE, '') : v; var o = {}; Object.keys(v).forEach(function (k) { o[k] = String(v[k]).replace(HERE, ''); }); return o; }
  E.noHere = noHere;
  function hashFor(st) { return 'cases' + (st.set ? '/' + st.set + (st.n ? '/' + st.n : '') : ''); }
  function seeded(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return rng(h >>> 0); }

  var CS_CSS = '' +
    /* the theme styles every li in a post (margins, padding, markers): our lists opt out */
    '.ecg-cs ul,.ecg-cs li,.ecg-list,.ecg-list>li{list-style:none!important;margin:0!important;padding:0!important;line-height:normal}' +
    '.ecg-cs li::before,.ecg-cs li::marker,.ecg-list>li::before,.ecg-list>li::marker{content:none!important;display:none!important}' +
    '.ecg-cs ul.ecg-sets,.ecg-cs ul.ecg-cgrid{margin:0 0 14px!important}' +
    '.ecg-cs .ecg-sum li{padding:9px 12px!important;line-height:1.6}.ecg-cs .ecg-mist li{padding:9px 0!important;line-height:1.7}' +
    '.ecg-list{margin-top:10px!important}' +
    '.ecg-cs .ecg-paper svg{min-width:1000px}' +
    '.ecg-cs-top{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;margin:0 0 12px;font-size:14px;color:var(--hw-muted)}' +
    '.ecg-cs-top b{color:var(--hw-ink);font-size:16px}' +
    '.ecg-sets,.ecg-cgrid{list-style:none;margin:0 0 14px;padding:0;display:grid;gap:8px}' +
    '.ecg-cgrid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}' +
    '.ecg-set,.ecg-cbtn{display:flex;align-items:center;gap:10px;width:100%;min-height:52px;padding:10px 14px;border:1px solid var(--hw-line);border-radius:12px;background:var(--hw-bg);color:var(--hw-ink);font:inherit;font-size:15px;font-weight:600;text-align:start;cursor:pointer}' +
    '.ecg-set:hover,.ecg-cbtn:hover{border-color:var(--hw-accent)}' +
    '.ecg-set[disabled]{cursor:default;opacity:.55}.ecg-set[disabled]:hover{border-color:var(--hw-line)}' +
    '.ecg-set .ecg-num{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--hw-accent-soft);color:var(--hw-accent-ink);font-size:13px;font-weight:800;flex-shrink:0}' +
    '.ecg-set .ecg-c{margin-inline-start:auto;font-size:12.5px;font-weight:700;color:var(--hw-muted);white-space:nowrap}' +
    '.ecg-cbtn{min-height:48px;padding:8px 12px}' +
    '.ecg-cbtn>span:first-child{white-space:nowrap}' +
    '.ecg-cbtn .hw-lvl{margin:0;margin-inline-start:auto}.ecg-cbtn small{font-size:12.5px;color:var(--hw-ok);font-weight:800;direction:ltr}' +
    '.ecg-cbtn.is-done{border-color:var(--hw-ok);background:var(--hw-ok-soft)}' +
    '.ecg-back{margin:0 0 12px;min-height:40px;padding:6px 14px;font-size:14px}' +
    '.ecg-ch{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 8px;font-size:16px}' +
    '.ecg-story{margin:0 0 12px;padding:12px 14px;border-radius:12px;background:var(--hw-bg-soft);line-height:1.8;font-size:15px}' +
    '.ecg-dots{display:flex;gap:6px;margin:12px 0 10px}' +
    '.ecg-dots i{flex:1;height:6px;border-radius:99px;background:var(--hw-line)}' +
    '.ecg-dots i.ok{background:var(--hw-ok)}.ecg-dots i.bad{background:var(--hw-bad)}.ecg-dots i.cur{background:var(--hw-accent)}' +
    '.ecg-q h3{margin:0 0 4px;font-size:17px}.ecg-q .ecg-stepn{font-size:12.5px;font-weight:800;color:var(--hw-accent-ink)}' +
    '.ecg-tip{margin:0 0 10px;font-size:13.5px;color:var(--hw-muted);line-height:1.7}' +
    '.ecg-q .hw-submit{margin-top:12px}' +
    '.ecg-sum{list-style:none;margin:10px 0;padding:0;border:1px solid var(--hw-line);border-radius:12px;overflow:hidden}' +
    '.ecg-sum li{display:grid;grid-template-columns:24px minmax(80px,30%) 1fr;gap:8px;align-items:start;padding:9px 12px;border-bottom:1px solid var(--hw-line);font-size:14px;line-height:1.6}' +
    '.ecg-sum li:last-child{border-bottom:0}.ecg-sum svg{width:18px;height:18px}' +
    '.ecg-sum .ok{color:var(--hw-ok)}.ecg-sum .bad{color:var(--hw-bad)}.ecg-sum b{font-weight:700}' +
    '.ecg-sum small{display:block;color:var(--hw-muted)}' +
    '.ecg-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.ecg-acts .hw-btn{flex:1 1 160px}' +
    '.ecg-mist{list-style:none;margin:0;padding:0}.ecg-mist li{padding:9px 0;border-bottom:1px solid var(--hw-line);font-size:14px;line-height:1.7}' +
    '.ecg-mist li:last-child{border-bottom:0}.ecg-mist button{margin-inline-start:6px;padding:2px 10px;min-height:30px;font-size:13px}' +
    '.ecg-note{margin:10px 0 0;font-size:12.5px;color:var(--hw-muted)}';

  /* cases data: window.HawiEcgCases (HW1) from hawi-ecg-cases.js next to this script */
  function withCases(cb) {
    if (E.cases) { cb(E.cases); return; }
    var done = function () { try { E.cases = H.decode(w.HawiEcgCases || ''); } catch (e) { E.cases = null; } cb(E.cases); };
    if (w.HawiEcgCases) { done(); return; }
    var s = d.createElement('script'); s.src = BASE + 'hawi-ecg-cases.js' + VQ; s.onload = done; s.onerror = function () { cb(null); };
    d.body.appendChild(s);
  }

  var LOGK = 'ecg-cases';
  function getLog() { var x = H.store.get(LOGK, null); return x && x.r ? x : { r: {}, m: [] }; }

  /* cases panel; returns { go(set, n), hash() } */
  function casesTab(panel, lib, start) {
    var byId = {}; lib.items.forEach(function (x) { byId[x.id] = x; });
    var api = { st: { set: null, n: null }, data: null, pend: start || {} };
    api.hash = function () { return hashFor(api.st); };
    api.go = function (set, n) { api.pend = { a: set, b: n }; if (api.data) open(); };
    panel.classList.add('ecg-cs');
    panel.innerHTML = '<p class="ecg-hint">' + H.bi(L.loading) + '</p>';
    if (!d.getElementById('hawi-ecg-cs-css')) { var st = d.createElement('style'); st.id = 'hawi-ecg-cs-css'; st.textContent = CS_CSS; d.head.appendChild(st); }
    withCases(function (x) {
      if (!x || !x.cases) { panel.innerHTML = '<p class="ecg-hint">' + H.bi(CL.unavailable) + '</p>'; return; }
      api.data = x; open();
    });

    function setOf(id) { return api.data.sets.filter(function (s) { return String(s.id) === String(id); })[0]; }
    function casesOf(id) { return api.data.cases.filter(function (c) { return String(c.set) === String(id); }).sort(function (a, b) { return a.n - b.n; }); }
    function open() {
      var p = api.pend || {}; api.pend = null;
      var s = p.a && setOf(p.a), list = s ? casesOf(s.id) : [], c = s && p.b ? list.filter(function (k) { return String(k.n) === String(p.b); })[0] : null;
      if (c) playCase(c); else if (s && list.length) showSet(s); else showList();
    }
    function nav(st) { api.st = st; setHash(hashFor(st)); }
    function top() { var r = panel.getBoundingClientRect(); if (r.top < 0) panel.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }
    function ring(score, sm) {
      var c = score >= 75 ? 'var(--hw-ok)' : score >= 40 ? 'var(--hw-warn)' : 'var(--hw-bad)';
      return '<div class="hw-ring' + (sm ? ' hw-ring--sm' : '') + '" style="--p:' + score + ';--c:' + c + '"><span>' + score + '</span></div>';
    }
    function lvl(c) { return c.level ? '<span class="hw-lvl lv-' + c.level + '">' + H.bi(CL.lv[c.level]) + '</span>' : ''; }
    function optLabel(step, v) {
      if (step === 'dx') { var it = byId[v]; return it ? (it.short || it.name) : v; }
      var o = (OPT[step] || []).filter(function (x) { return x[0] === v; })[0]; return o ? o[1] : v;
    }
    function caseName(c) { return T(B('{s} {a} · {c} {b}', '{s} {a} · {c} {b}', '{s} {a} · {c} {b}'), { s: CL.setN, a: c.set, c: CL.caseN, b: c.n }); }

    /* ---------- list of sets + mistakes log ---------- */
    function showList() {
      nav({ set: null, n: null });
      var log = getLog(), ids = Object.keys(log.r), all = api.data.cases.length, sum = 0;
      ids.forEach(function (k) { sum += log.r[k].best || 0; });
      panel.innerHTML =
        '<div class="ecg-cs-top"><span><b>' + ids.length + '</b> / ' + all + ' ' + H.bi(CL.solved) + '</span>' +
        (ids.length ? '<span><b>' + Math.round(sum / ids.length) + '%</b> ' + H.bi(CL.avg) + '</span>' : '') + '</div>' +
        '<ul class="ecg-sets">' + api.data.sets.map(function (s) {
          var list = casesOf(s.id), done = list.filter(function (c) { return log.r[c.id]; }).length;
          return '<li><button type="button" class="ecg-set" data-set="' + H.esc(s.id) + '"' + (list.length ? '' : ' disabled') + '>' +
            '<span class="ecg-num">' + H.esc(s.id) + '</span><span>' + H.bi(s.name) + '</span>' +
            '<span class="ecg-c">' + (list.length ? done + ' / ' + list.length : H.bi(L.soon)) + '</span></button></li>';
        }).join('') + '</ul><div class="js-mist"></div><p class="ecg-note">' + H.bi(CL.local) + '</p>';
      panel.querySelectorAll('.ecg-set[data-set]').forEach(function (b) {
        b.addEventListener('click', function () { var s = setOf(b.getAttribute('data-set')); if (s) { showSet(s); top(); } });
      });
      mistakes(panel.querySelector('.js-mist'), log);
    }
    function mistakes(box, log) {
      var acc = H.accordion(box, [{ id: 'm', title: CL.mist, render: function (body) {
        if (!log.m.length) { body.innerHTML = '<p class="ecg-hint" style="border:0;padding:0">' + H.bi(CL.noMist) + '</p>'; return; }
        body.innerHTML = '<ul class="ecg-mist">' + log.m.map(function (x, i) {
          var c = api.data.cases.filter(function (k) { return k.id === x.c; })[0]; if (!c) return '';
          return '<li><b>' + H.bi(caseName(c)) + '</b> — ' + H.bi(T(B('{s}: اخترت «{g}»، والصحيح «{a}»', '{s}: you chose “{g}”; correct: “{a}”', '{s}: seçiminiz “{g}”; doğrusu “{a}”'),
            { s: x.s === 'dx' ? CL.dx : L[x.s], g: optLabel(x.s, x.g), a: optLabel(x.s, x.a) })) +
            '<button type="button" class="hw-btn" data-i="' + i + '">' + H.bi(CL.open) + '</button></li>';
        }).join('') + '</ul><div class="ecg-acts"><button type="button" class="hw-btn js-clr">' + H.icon('x') + H.bi(CL.clear) + '</button></div>';
        body.querySelectorAll('button[data-i]').forEach(function (b) {
          b.addEventListener('click', function () { var x = log.m[+b.getAttribute('data-i')], c = x && api.data.cases.filter(function (k) { return k.id === x.c; })[0]; if (c) { playCase(c); top(); } });
        });
        body.querySelector('.js-clr').addEventListener('click', function () {
          H.modal({ icon: 'alert', title: CL.clear, body: '<p>' + H.bi(CL.clearQ) + '</p>', actions: [
            { label: CL.cancel },
            { label: CL.del, kind: 'danger', onClick: function (close) { H.store.del(LOGK); close(); showList(); } }] });
        });
      } }], { soft: true });
      acc.m.count(log.m.length ? '<span class="hw-lvl lv-3">' + log.m.length + '</span>' : '');
    }

    /* ---------- one set: its cases ---------- */
    function showSet(s) {
      nav({ set: s.id, n: null });
      var log = getLog();
      panel.innerHTML = '<button type="button" class="hw-btn ecg-back js-back">' + H.bi(CL.back) + '</button>' +
        '<div class="ecg-ch"><b>' + H.bi(CL.setN) + ' ' + H.esc(s.id) + ' — ' + H.bi(s.name) + '</b></div>' +
        '<ul class="ecg-cgrid">' + casesOf(s.id).map(function (c) {
          var r = log.r[c.id];
          return '<li><button type="button" class="ecg-cbtn' + (r ? ' is-done' : '') + '" data-id="' + H.esc(c.id) + '"' + (r ? ' title="' + H.esc(H.t(CL.best)) + ': ' + r.best + '%"' : '') + '>' +
            '<span>' + H.bi(CL.caseN) + ' ' + c.n + '</span>' + (r ? '<small>' + r.best + '%</small>' : '') + lvl(c) + '</button></li>';
        }).join('') + '</ul>';
      panel.querySelector('.js-back').addEventListener('click', function () { showList(); top(); });
      panel.querySelectorAll('.ecg-cbtn').forEach(function (b) {
        b.addEventListener('click', function () { var c = api.data.cases.filter(function (k) { return k.id === b.getAttribute('data-id'); })[0]; if (c) { playCase(c); top(); } });
      });
    }

    /* ---------- one case: six steps, then the result ---------- */
    function playCase(c) {
      nav({ set: c.set, n: c.n });
      var seed = c.seed || SEED0, m = E.measure(c.strip, seed, CASE_SEC), ans = c.ans || E.derive(c.strip, seed, CASE_SEC);
      var item = byId[ans.dx];
      var steps = STEPS.filter(function (k) { return ans[k] != null; }), i = 0, got = {};
      /* diagnosis options: the answer + distractors, in a stable per-case order */
      var R = seeded(c.id), dx = [ans.dx].concat((c.distract || []).filter(function (x) { return byId[x] && x !== ans.dx; }));
      for (var k = dx.length - 1; k > 0; k--) { var j = Math.floor(R() * (k + 1)), tmp = dx[k]; dx[k] = dx[j]; dx[j] = tmp; }
      panel.innerHTML = '<button type="button" class="hw-btn ecg-back js-back">' + H.bi(CL.back) + '</button>' +
        '<div class="ecg-ch"><b>' + H.bi(caseName(c)) + '</b>' + lvl(c) + '</div>' +
        (c.story ? '<p class="ecg-story">' + H.bi(c.story) + '</p>' : '') +
        '<section class="ecg-view">' + E.paper(c.strip, { seconds: CASE_SEC, seed: seed }) + '<p class="ecg-hint">' + H.bi(L.hint) + '</p></section>' +
        '<div class="ecg-dots" aria-hidden="true">' + steps.map(function () { return '<i></i>'; }).join('') + '</div>' +
        '<section class="hw-card ecg-q js-q" aria-live="polite"></section>';
      panel.querySelector('.js-back').addEventListener('click', function () { var s = setOf(c.set); if (s) showSet(s); else showList(); top(); });
      var qBox = panel.querySelector('.js-q'), dots = panel.querySelectorAll('.ecg-dots i');
      function paintDots() { dots.forEach(function (el, x) { var s = steps[x]; el.className = s in got ? (got[s] === ans[s] ? 'ok' : 'bad') : (x === i ? 'cur' : ''); }); }
      function ask() {
        var step = steps[i], opts = step === 'dx' ? dx.map(function (id) { return [id, byId[id].short || byId[id].name]; }) : OPT[step];
        paintDots();
        qBox.innerHTML = '<div class="ecg-stepn">' + H.bi(CL.step) + ' ' + (i + 1) + ' ' + H.bi(CL.of) + ' ' + steps.length + ' · ' + H.bi(step === 'dx' ? CL.dx : L[step]) + '</div>' +
          '<h3>' + H.bi(CL.q[step]) + '</h3><p class="ecg-tip">' + H.bi(CL.tip[step]) + '</p>' +
          '<div class="hw-opts" role="radiogroup">' + opts.map(function (o) {
            return '<button type="button" class="hw-opt" role="radio" aria-checked="false" data-v="' + H.esc(o[0]) + '"><span class="hw-box">' + H.icon('check') + '</span>' +
              '<span class="hw-opt-b"><span class="hw-opt-t">' + H.bi(o[1]) + '</span><span class="hw-opt-tag"></span><span class="hw-opt-why"></span></span></button>';
          }).join('') + '</div><div class="hw-submit" hidden><button type="button" class="hw-btn hw-btn--accent js-next">' + H.bi(i === steps.length - 1 ? CL.finish : CL.next) + '</button></div>';
        var group = qBox.querySelector('.hw-opts');
        group.querySelectorAll('.hw-opt').forEach(function (b) {
          b.addEventListener('click', function () {
            if (step in got) return;
            var v = b.getAttribute('data-v'); got[step] = v;
            group.classList.add('is-graded');
            group.querySelectorAll('.hw-opt').forEach(function (o) {
              var ov = o.getAttribute('data-v'), tag = o.querySelector('.hw-opt-tag');
              o.setAttribute('aria-checked', String(ov === v)); o.setAttribute('aria-disabled', 'true');
              if (ov === ans[step]) {
                o.classList.add('g-ok'); tag.innerHTML = H.bi(ov === v ? CL.right : CL.correctIs);
                var wy = why(step, ans, m, item); if (wy) o.querySelector('.hw-opt-why').innerHTML = H.bi(wy);
              } else if (ov === v) { o.classList.add('g-bad'); o.querySelector('.hw-box').innerHTML = H.icon('x'); tag.innerHTML = H.bi(CL.yours); }
              else o.classList.add('g-skip');
            });
            paintDots();
            var nx = qBox.querySelector('.hw-submit'); nx.hidden = false; nx.querySelector('button').focus({ preventScroll: true });
          });
        });
        qBox.querySelector('.js-next').addEventListener('click', function () { i++; if (i < steps.length) ask(); else result(); });
      }
      function result() {
        var pts = 0, max = 0, wrong = [];
        steps.forEach(function (s) { max += PTS[s]; if (got[s] === ans[s]) pts += PTS[s]; else wrong.push(s); });
        var score = max ? Math.round(pts / max * 100) : 0;
        /* log: best/last score per case; the mistakes list keeps this attempt's errors for the case */
        var log = getLog(), r = log.r[c.id] || { best: 0, n: 0 };
        r.best = Math.max(r.best || 0, score); r.last = score; r.n = (r.n || 0) + 1; r.at = Date.now(); log.r[c.id] = r;
        log.m = log.m.filter(function (x) { return x.c !== c.id; });
        log.m = wrong.map(function (s) { return { c: c.id, s: s, g: got[s], a: ans[s], at: Date.now() }; }).concat(log.m).slice(0, 80);
        H.store.set(LOGK, log);
        paintDots(); dots.forEach(function (el) { el.classList.remove('cur'); });
        var f = (item && item.f) || {};
        qBox.innerHTML = '<h3>' + H.bi(CL.result) + '</h3>' +
          '<div class="hw-score">' + ring(score) + '<p><b dir="ltr">' + pts + ' / ' + max + '</b></p></div>' +
          '<ul class="ecg-sum">' + steps.map(function (s) {
            var ok = got[s] === ans[s];
            return '<li><span class="' + (ok ? 'ok' : 'bad') + '">' + H.icon(ok ? 'check' : 'x') + '</span><b>' + H.bi(s === 'dx' ? CL.dx : L[s]) + '</b><span>' + H.bi(optLabel(s, ans[s])) +
              (ok ? '' : '<small>' + H.bi(CL.yours) + ': ' + H.bi(optLabel(s, got[s])) + '</small>') + '</span></li>';
          }).join('') + '</ul>' +
          (item ? '<div class="js-ex"></div>' : '') +
          '<div class="ecg-rel js-relc"></div>' +
          '<div class="ecg-acts"><button type="button" class="hw-btn js-retry">' + H.icon('redo') + H.bi(CL.retry) + '</button>' +
          (nextOf(c) ? '<button type="button" class="hw-btn hw-btn--accent js-nextc">' + H.bi(CL.nextCase) + '</button>' : '') + '</div>';
        if (item) {
          var rows = ['rate', 'rhythm', 'p', 'pr', 'qrs', 'rel'].filter(function (k) { return f[k]; });
          H.accordion(qBox.querySelector('.js-ex'), [{ id: 'x', title: T(B('{e}: {n}', '{e}: {n}', '{e}: {n}'), { e: CL.expl, n: item.short || item.name }), open: true, html:
            '<dl class="ecg-f">' + rows.map(function (k) { return '<dt>' + H.bi(L[k]) + '</dt><dd>' + H.bi(noHere(f[k])) + '</dd>'; }).join('') + '</dl>' +
            (item.text ? '<p class="ecg-txt">' + H.bi(noHere(item.text)) + '</p>' : '') +
            '<p class="ecg-txt"><a href="#library/' + H.esc(item.id) + '">' + H.bi(CL.openLib) + '</a></p>' }], { soft: true });
        }
        var tags = c.tags || (item && item.tags);
        if (H.related && tags && tags.length) { var rb = d.createElement('div'); qBox.querySelector('.js-relc').appendChild(rb); H.related(rb, tags); }
        qBox.querySelector('.js-retry').addEventListener('click', function () { playCase(c); top(); });
        var bn = qBox.querySelector('.js-nextc'); if (bn) bn.addEventListener('click', function () { playCase(nextOf(c)); top(); });
      }
      ask();
    }
    function nextOf(c) { var list = casesOf(c.set); return list[list.indexOf(c) + 1] || null; }
    return api;
  }

  /* loaded after hawi-core already booted (theme loader) → mount now; boot skips ready elements */
  if (d.readyState !== 'loading' && H.boot) H.boot();
})(window, document);
