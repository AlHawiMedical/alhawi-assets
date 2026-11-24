/*! ECG Academy: strip engine + Library | v0.2.3 (ar/en/tr) | requires hawi-core.js */
(function (w, d) {
  'use strict';
  var H = w.Hawi; if (!H) return;
  var E = H.ecg = H.ecg || {};

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
    if (!data || !data.items || !data.items.length) return;
    var items = data.items, groups = data.groups || [{ id: 'all', name: L.lib }];
    var key = 'ecg-lib';
    var pref = H.store.get(key, {});
    var cur = items.filter(function (x) { return x.id === pref.id; })[0] || items[0];
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
    }
    function select(it, scroll) {
      cur = it; pref.id = it.id; H.store.set(key, pref);
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
  };

  /* loaded after hawi-core already booted (theme loader) → mount now; boot skips ready elements */
  if (d.readyState !== 'loading' && H.boot) H.boot();
})(window, document);
