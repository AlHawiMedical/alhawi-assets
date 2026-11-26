/*! © 2026 Dr. Hassan Alduvayhi — All rights reserved. Unauthorized copying or reuse is prohibited.
    Accounts: header sign-in icon (every page), sign-in window (Google + email, ar/en/tr),
    sync of progress + mistakes log with the account (Firestore) | v0.1.1 | uses hawi-core.js v0.4 (loaded on demand)
    Data: users/{uid} {name,email,photo,seen} (tier* is read, never written here) ·
          users/{uid}/apps/{app} {prog,log,train,data: JSON text, at, dev} — one document per app. */
(function (w, d) {
  'use strict';
  if (w.HawiAcct) return;
  var A = w.HawiAcct = { version: '0.1.1' };

  /* ---------- settings ---------- */
  var CFG = {
    apiKey: 'AIzaSyBZkfQFTd7kAyu_Es7CWkXZg6PRFavv_1A',
    authDomain: 'alhawi-medical.firebaseapp.com',
    projectId: 'alhawi-medical',
    storageBucket: 'alhawi-medical.firebasestorage.app',
    messagingSenderId: '576634573168',
    appId: '1:576634573168:web:ec47d164243dd6e4aeffb5'
  };
  var FB = 'https://www.gstatic.com/firebasejs/13.4.0/';
  var KINDS = ['prog', 'log', 'train', 'data'];
  var DELAY = 15000, RETRY = 60000, MAXDOC = 950000;
  var KEY = 'hawi:acct', RKEY = 'hawi:acct:redirect';

  /* where this file came from: core + css load from the same folder with the same ?v= */
  var me = d.currentScript && d.currentScript.src || '', mm = me.match(/^(.*\/)hawi-acct\.js(\?[^#]*)?/);
  var BASE = mm ? mm[1] : 'https://alhawimedical.github.io/alhawi-assets/', VER = mm && mm[2] || '';

  /* dynamic import without breaking old parsers; tests replace A._imp */
  A._imp = function (u) { return (A._import || (A._import = new Function('u', 'return import(u)')))(u); };

  /* ---------- texts (ar/en/tr) ---------- */
  var T = {
    title: { ar: 'حسابي', en: 'My account', tr: 'Hesabım' },
    signin: { ar: 'تسجيل الدخول', en: 'Sign in', tr: 'Giriş yap' },
    why: { ar: 'الدخول اختياري. يحفظ تقدّمك وسجل أخطائك في حسابك، فتجدهما على أي جهاز.', en: 'Signing in is optional. It saves your progress and mistakes log to your account, so you find them on any device.', tr: 'Giriş isteğe bağlıdır. İlerlemenizi ve hata kaydınızı hesabınıza kaydeder; onları her cihazda bulursunuz.' },
    google: { ar: 'المتابعة بحساب Google', en: 'Continue with Google', tr: 'Google ile devam et' },
    or: { ar: 'أو بالبريد الإلكتروني', en: 'or with email', tr: 'veya e-posta ile' },
    email: { ar: 'البريد الإلكتروني', en: 'Email', tr: 'E-posta' },
    pass: { ar: 'كلمة السر', en: 'Password', tr: 'Şifre' },
    login: { ar: 'دخول', en: 'Sign in', tr: 'Giriş' },
    create: { ar: 'إنشاء حساب', en: 'Create account', tr: 'Hesap oluştur' },
    forgot: { ar: 'نسيت كلمة السر؟', en: 'Forgot your password?', tr: 'Şifrenizi mi unuttunuz?' },
    resetSent: { ar: 'إن كان البريد مسجّلاً، فقد أرسلنا إليه رابط إعادة تعيين كلمة السر.', en: 'If this email is registered, we have sent it a password reset link.', tr: 'Bu e-posta kayıtlıysa, şifre sıfırlama bağlantısı gönderdik.' },
    needEmail: { ar: 'اكتب بريدك الإلكتروني أولاً.', en: 'Enter your email first.', tr: 'Önce e-postanızı yazın.' },
    needBoth: { ar: 'اكتب البريد الإلكتروني وكلمة السر.', en: 'Enter your email and password.', tr: 'E-postanızı ve şifrenizi yazın.' },
    verifyH: { ar: 'أكّد بريدك الإلكتروني', en: 'Verify your email', tr: 'E-postanızı doğrulayın' },
    verifyMsg: { ar: 'أرسلنا رابط تأكيد إلى بريدك. افتحه، ثم اضغط «أكّدت بريدي». لن يُحفظ تقدّمك في الحساب قبل التأكيد، ويبقى محفوظاً على هذا الجهاز.', en: 'We sent a verification link to your email. Open it, then press “I have verified”. Your progress is not saved to the account until then; it stays on this device.', tr: 'E-postanıza bir doğrulama bağlantısı gönderdik. Açın, ardından “Doğruladım”a basın. O zamana kadar ilerlemeniz hesaba kaydedilmez; bu cihazda kalır.' },
    spam: { ar: 'لم تجده؟ انظر في مجلد الرسائل غير المرغوب فيها (Spam).', en: 'Not there? Check your spam folder.', tr: 'Bulamadınız mı? İstenmeyen (spam) klasörüne bakın.' },
    resend: { ar: 'أعد إرسال الرابط', en: 'Resend the link', tr: 'Bağlantıyı tekrar gönder' },
    verified: { ar: 'أكّدت بريدي', en: 'I have verified', tr: 'Doğruladım' },
    notYet: { ar: 'لم يُؤكَّد البريد بعد. افتح الرابط في رسالتنا ثم حاول مرة أخرى.', en: 'The email is not verified yet. Open the link in our message, then try again.', tr: 'E-posta henüz doğrulanmadı. Mesajımızdaki bağlantıyı açın ve tekrar deneyin.' },
    sent: { ar: 'أُرسل الرابط.', en: 'Link sent.', tr: 'Bağlantı gönderildi.' },
    signout: { ar: 'تسجيل الخروج', en: 'Sign out', tr: 'Çıkış yap' },
    tier: { ar: 'نوع العضوية', en: 'Membership', tr: 'Üyelik' },
    free: { ar: 'مجانية', en: 'Free', tr: 'Ücretsiz' },
    saved: { ar: 'تقدّمك محفوظ في حسابك.', en: 'Your progress is saved to your account.', tr: 'İlerlemeniz hesabınıza kaydedildi.' },
    saving: { ar: 'جارٍ الحفظ…', en: 'Saving…', tr: 'Kaydediliyor…' },
    pending: { ar: 'سيُحفظ تقدّمك الجديد في حسابك بعد لحظات.', en: 'Your new progress will be saved to your account in a moment.', tr: 'Yeni ilerlemeniz birazdan hesabınıza kaydedilecek.' },
    syncErr: { ar: 'تعذّر الحفظ في الحساب الآن، وسنحاول مرة أخرى. تقدّمك محفوظ على هذا الجهاز.', en: 'Could not save to your account right now; we will try again. Your progress is safe on this device.', tr: 'Şu anda hesaba kaydedilemedi; tekrar deneyeceğiz. İlerlemeniz bu cihazda güvende.' },
    local: { ar: 'بعد الخروج يبقى تقدّمك على هذا الجهاز أيضاً.', en: 'After signing out, your progress also stays on this device.', tr: 'Çıkış yaptıktan sonra ilerlemeniz bu cihazda da kalır.' },
    welcome: { ar: 'تم تسجيل الدخول. تقدّمك يُحفظ في حسابك.', en: 'Signed in. Your progress is saved to your account.', tr: 'Giriş yapıldı. İlerlemeniz hesabınıza kaydediliyor.' },
    bye: { ar: 'تم تسجيل الخروج.', en: 'Signed out.', tr: 'Çıkış yapıldı.' },
    wait: { ar: 'لحظة…', en: 'One moment…', tr: 'Bir saniye…' },
    loadErr: { ar: 'تعذّر الاتصال. تحقّق من الإنترنت ثم حاول مرة أخرى.', en: 'Could not connect. Check your internet and try again.', tr: 'Bağlanılamadı. İnternetinizi kontrol edip tekrar deneyin.' },
    e_generic: { ar: 'حدث خطأ، حاول مرة أخرى.', en: 'Something went wrong, please try again.', tr: 'Bir hata oluştu, lütfen tekrar deneyin.' },
    e_cred: { ar: 'البريد الإلكتروني أو كلمة السر غير صحيحة.', en: 'The email or password is incorrect.', tr: 'E-posta veya şifre yanlış.' },
    e_inuse: { ar: 'هذا البريد مسجّل من قبل. اضغط «دخول»، أو «نسيت كلمة السر؟».', en: 'This email is already registered. Press “Sign in”, or “Forgot your password?”.', tr: 'Bu e-posta zaten kayıtlı. “Giriş”e veya “Şifrenizi mi unuttunuz?”a basın.' },
    e_weak: { ar: 'كلمة السر قصيرة: 6 أحرف على الأقل.', en: 'The password is too short: at least 6 characters.', tr: 'Şifre çok kısa: en az 6 karakter.' },
    e_email: { ar: 'البريد الإلكتروني غير صحيح.', en: 'The email address is not valid.', tr: 'E-posta adresi geçerli değil.' },
    e_many: { ar: 'محاولات كثيرة. انتظر قليلاً ثم حاول مرة أخرى.', en: 'Too many attempts. Wait a little, then try again.', tr: 'Çok fazla deneme. Biraz bekleyip tekrar deneyin.' },
    e_net: { ar: 'لا اتصال بالإنترنت. تحقّق منه ثم حاول مرة أخرى.', en: 'No internet connection. Check it and try again.', tr: 'İnternet bağlantısı yok. Kontrol edip tekrar deneyin.' },
    e_off: { ar: 'طريقة الدخول هذه غير مفعّلة بعد.', en: 'This sign-in method is not enabled yet.', tr: 'Bu giriş yöntemi henüz etkin değil.' },
    e_domain: { ar: 'الدخول غير مسموح من هذا العنوان بعد.', en: 'Signing in is not allowed from this address yet.', tr: 'Bu adresten giriş henüz izinli değil.' }
  };
  A.T = T;
  var ERR = {
    'auth/invalid-credential': 'e_cred', 'auth/wrong-password': 'e_cred', 'auth/user-not-found': 'e_cred', 'auth/invalid-login-credentials': 'e_cred',
    'auth/email-already-in-use': 'e_inuse', 'auth/weak-password': 'e_weak', 'auth/invalid-email': 'e_email', 'auth/missing-email': 'needEmail',
    'auth/missing-password': 'needBoth', 'auth/too-many-requests': 'e_many', 'auth/network-request-failed': 'e_net',
    'auth/operation-not-allowed': 'e_off', 'auth/unauthorized-domain': 'e_domain'
  };

  /* ---------- small helpers (work before core is loaded) ---------- */
  function lang() {
    if (w.hawiLang && w.hawiLang.get) return w.hawiLang.get();
    var l = d.documentElement.getAttribute('data-lang');
    return l === 'en' || l === 'tr' ? l : 'ar';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function txt(v) { return v[lang()] || v.ar; }
  /* one span per language, like H.bi (switching language needs no re-render) */
  function bi(v) { return '<span class="lng-ar" lang="ar">' + esc(v.ar) + '</span><span class="lng-en" lang="en">' + esc(v.en) + '</span><span class="lng-tr" lang="tr">' + esc(v.tr) + '</span>'; }
  function cache(v) {
    try {
      if (v === undefined) { var s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; }
      if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY);
    } catch (e) {}
    return v || null;
  }
  function num(x) { return typeof x === 'number' && isFinite(x) ? x : -Infinity; }
  function maxOf(a, b) { var m = Math.max(num(a), num(b)); return m === -Infinity ? (a != null ? a : b) : m; }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function parse(s) { if (s == null) return null; if (typeof s !== 'string') return s; try { return JSON.parse(s); } catch (e) { return null; } }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  /* ---------- merge (nothing is lost) ----------
     prog: per item best/n = the larger, everything else from the newer 'at'
     log : per item, the mistakes of the side whose progress for that item is newer (corrected mistakes stay gone);
           items without progress: union of entries, newer 'at' wins; capped like H.log.MAX
     train: per id [correct,count] the larger; best the larger; settings (g) from this device
     data / other: this device first */
  var M = A.merge = {
    prog: function (a, b) {
      if (!a || !a.r) return clone(b); if (!b || !b.r) return clone(a);
      var out = { v: a.v || b.v || 1, r: {} }, ids = {};
      Object.keys(a.r).forEach(function (k) { ids[k] = 1; }); Object.keys(b.r).forEach(function (k) { ids[k] = 1; });
      Object.keys(ids).forEach(function (id) {
        var x = a.r[id], y = b.r[id];
        if (!x || !y) { out.r[id] = clone(x || y); return; }
        var n = (x.at || 0) >= (y.at || 0) ? x : y, r = clone(n);
        if (x.best != null || y.best != null) r.best = maxOf(x.best, y.best);
        if (x.n != null || y.n != null) r.n = maxOf(x.n, y.n);
        out.r[id] = r;
      });
      return out;
    },
    log: function (a, b, pa, pb, max) {
      if (!a || !a.e) return clone(b); if (!b || !b.e) return clone(a);
      var out = { v: a.v || b.v || 1, e: {} }, items = {};
      function by(x) { var m = {}; Object.keys(x.e).forEach(function (id) { var e = x.e[id], it = e && e.it != null ? e.it : '\u0000' + id; (m[it] = m[it] || []).push(e); }); return m; }
      var ia = by(a), ib = by(b);
      Object.keys(ia).forEach(function (k) { items[k] = 1; }); Object.keys(ib).forEach(function (k) { items[k] = 1; });
      Object.keys(items).forEach(function (it) {
        var ta = pa && pa.r && pa.r[it] && pa.r[it].at, tb = pb && pb.r && pb.r[it] && pb.r[it].at, pick;
        if (ta != null || tb != null) pick = (ta || 0) >= (tb || 0) ? ia[it] || [] : ib[it] || [];
        else {
          var u = {}; (ia[it] || []).concat(ib[it] || []).forEach(function (e) { if (!u[e.id] || (e.at || 0) > (u[e.id].at || 0)) u[e.id] = e; });
          pick = Object.keys(u).map(function (k) { return u[k]; });
        }
        pick.forEach(function (e) { out.e[e.id] = clone(e); });
      });
      var ids = Object.keys(out.e), cap = max || 2000;
      if (ids.length > cap) ids.sort(function (x, y) { return (out.e[x].at || 0) - (out.e[y].at || 0); }).slice(0, ids.length - cap).forEach(function (id) { delete out.e[id]; });
      return out;
    },
    train: function (a, b) {
      if (!a || !a.s) return clone(b); if (!b || !b.s) return clone(a);
      var out = clone(a);
      out.best = maxOf(a.best, b.best);
      Object.keys(b.s).forEach(function (id) {
        var x = a.s[id], y = b.s[id];
        out.s[id] = !x ? clone(y) : [Math.max(x[0] || 0, y[0] || 0), Math.max(x[1] || 0, y[1] || 0)];
      });
      return out;
    },
    other: function (a, b) { return a != null ? clone(a) : clone(b); }
  };

  /* ---------- core + Firebase on demand ---------- */
  function core(cb) {
    if (w.Hawi && w.Hawi.store && w.Hawi.modal) { cb(w.Hawi); return; }
    if (!d.querySelector('script[src*="hawi-core.js"]')) {
      if (!d.querySelector('link[href*="hawi.css"]')) { var l = d.createElement('link'); l.rel = 'stylesheet'; l.href = BASE + 'hawi.css' + VER; d.head.appendChild(l); }
      var s = d.createElement('script'); s.src = BASE + 'hawi-core.js' + VER; (d.body || d.head).appendChild(s);
    }
    var t0 = Date.now();
    (function wait() {
      if (w.Hawi && w.Hawi.store && w.Hawi.modal) { cb(w.Hawi); return; }
      if (Date.now() - t0 < 20000) setTimeout(wait, 50);
    })();
  }
  function coreP() { return new Promise(function (res) { core(res); }); }

  var fbP = null;
  function fb() {
    if (fbP) return fbP;
    fbP = Promise.all([A._imp(FB + 'firebase-app.js'), A._imp(FB + 'firebase-auth.js'), A._imp(FB + 'firebase-firestore-lite.js')])
      .then(function (r) {
        var app = r[0].initializeApp(CFG, 'hawi');
        return { a: r[1], f: r[2], auth: r[1].getAuth(app), db: r[2].getFirestore(app) };
      });
    fbP.catch(function () { fbP = null; });
    return fbP;
  }
  /* Firebase + the first auth state (a remembered sign-in is restored before we continue) */
  var startP = null;
  function start() {
    if (startP) return startP;
    startP = Promise.all([fb(), coreP()]).then(function (r) {
      var F = r[0]; A.F = F;
      return new Promise(function (res) {
        var first = true;
        F.a.onAuthStateChanged(F.auth, function (u) { onUser(F, u); if (first) { first = false; res(F); } });
        try { if (sessionStorage.getItem(RKEY)) { sessionStorage.removeItem(RKEY); F.a.getRedirectResult(F.auth).catch(function (e) { A.lastError = e; }); } } catch (e) {}
      });
    });
    startP.catch(function () { startP = null; });
    return startP;
  }
  A.start = start;

  /* ---------- user state ---------- */
  function isVerified(u) {
    if (!u) return false;
    if (u.emailVerified) return true;
    return (u.providerData || []).some(function (p) { return p && p.providerId === 'google.com'; });
  }
  function onUser(F, u) {
    if (!u) { A.user = null; cache(null); S.stop(); paint(); render(); return; }
    var old = cache() || {};
    A.user = {
      uid: u.uid, name: u.displayName || '', email: u.email || '', photo: u.photoURL || '',
      ok: isVerified(u), tier: old.uid === u.uid && old.tier ? old.tier : 'free'
    };
    cache(A.user); paint(); render();
    if (A.user.ok) { profile(F, u); S.begin(F, u); } else S.stop();
  }
  /* users/{uid}: keep name/email/photo fresh; read tier (only Hassan changes it, in the Firebase console) */
  function profile(F, u) {
    var ref = F.f.doc(F.db, 'users', u.uid);
    F.f.getDoc(ref).then(function (ds) {
      var x = ds.exists() ? ds.data() : {};
      if (A.user && A.user.uid === u.uid) {
        A.user.tier = typeof x.tier === 'string' && x.tier ? x.tier : 'free';
        A.user.tierUntil = x.tierUntil || null;
        cache(A.user); render();
        try { w.dispatchEvent(new CustomEvent('hawi:user', { detail: A.user })); } catch (e) {}
      }
      var p = { name: u.displayName || '', email: u.email || '', photo: u.photoURL || '', seen: F.f.serverTimestamp() };
      if (!ds.exists()) p.created = F.f.serverTimestamp();
      return F.f.setDoc(ref, p, { merge: true });
    }).catch(function (e) { A.lastError = e; });
  }

  /* ---------- sync engine ---------- */
  var S = A.sync = {
    F: null, u: null, dirty: {}, t: 0, muted: false, state: 'idle', last: 0,
    apps: function () {
      var H = w.Hawi, out = {};
      H.store.keys('').forEach(function (k) { if (H.store.sync(k)) { var a = k.split(':')[0]; if (/^[a-z]{2,12}$/.test(a)) out[a] = 1; } });
      return Object.keys(out);
    },
    begin: function (F, u) {
      if (S.u && S.u.uid === u.uid && S.state !== 'idle') return S.ready;
      S.F = F; S.u = u; S.dirty = {}; S.state = 'busy'; render();
      S.ready = S.pull().then(function () { S.state = 'ok'; S.last = Date.now(); render(); })
        .catch(function (e) { A.lastError = e; S.state = 'err'; render(); S.later(RETRY); });
      return S.ready;
    },
    stop: function () { clearTimeout(S.t); S.F = null; S.u = null; S.dirty = {}; S.state = 'idle'; },
    col: function () { return S.F.f.collection(S.F.db, 'users', S.u.uid, 'apps'); },
    /* read every app document, merge with this device, write back what differs (both ways) */
    pull: function () {
      var H = w.Hawi, f = S.F.f, uid = S.u.uid;
      return f.getDocs(S.col()).then(function (qs) {
        if (!S.u || S.u.uid !== uid) return;
        var remote = {}, apps = {};
        qs.forEach(function (ds) { remote[ds.id] = ds.data() || {}; apps[ds.id] = 1; });
        S.apps().forEach(function (a) { apps[a] = 1; });
        var push = [];
        S.muted = true;
        try {
          Object.keys(apps).forEach(function (app) {
            if (!/^[a-z]{2,12}$/.test(app)) return;
            var r = remote[app] || {}, diff = false, val = {};
            KINDS.forEach(function (k) { val[k] = { loc: H.store.get(app + ':' + k, null), rem: parse(r[k]) }; });
            KINDS.forEach(function (k) {
              var v = val[k], m;
              if (v.loc == null && v.rem == null) return;
              if (k === 'prog') m = M.prog(v.loc, v.rem);
              else if (k === 'log') m = M.log(v.loc, v.rem, val.prog.loc, val.prog.rem, H.log && H.log.MAX);
              else if (k === 'train') m = M.train(v.loc, v.rem);
              else m = M.other(v.loc, v.rem);
              if (!same(m, v.loc)) H.store.set(app + ':' + k, m);
              if (!same(m, v.rem)) diff = true;
            });
            if (diff) push.push(app);
          });
        } finally { S.muted = false; }
        return S.push(push);
      });
    },
    doc: function (app) {
      var H = w.Hawi, x = { at: Date.now(), dev: H.meta && H.meta().dev || '' }, size = 0;
      KINDS.forEach(function (k) { var v = H.store.get(app + ':' + k, null); if (v != null) { x[k] = JSON.stringify(v); size += x[k].length; } });
      return size > MAXDOC ? null : x;
    },
    push: function (apps) {
      if (!apps.length || !S.u) return Promise.resolve();
      var f = S.F.f, uid = S.u.uid;
      return Promise.all(apps.map(function (app) {
        var x = S.doc(app); if (!x) return null;
        return f.setDoc(f.doc(S.F.db, 'users', uid, 'apps', app), x);
      }));
    },
    mark: function (key) {
      if (S.muted || !S.u || !w.Hawi || !w.Hawi.store.sync(key)) return;
      var app = key.split(':')[0]; if (!/^[a-z]{2,12}$/.test(app)) return;
      S.dirty[app] = 1; if (S.state === 'ok') S.state = 'pending';
      S.later(DELAY); render();
    },
    later: function (ms) { clearTimeout(S.t); S.t = setTimeout(S.flush, ms); },
    /* one write per changed app, batched */
    flush: function () {
      clearTimeout(S.t);
      if (!S.u) return Promise.resolve();
      if (S.state === 'err' && S.ready) { S.state = 'busy'; return (S.ready = S.pull().then(function () { S.state = 'ok'; S.last = Date.now(); render(); }, function (e) { A.lastError = e; S.state = 'err'; render(); S.later(RETRY); })); }
      var apps = Object.keys(S.dirty); if (!apps.length) return Promise.resolve();
      S.dirty = {}; S.state = 'busy'; render();
      return S.push(apps).then(function () { S.state = Object.keys(S.dirty).length ? 'pending' : 'ok'; S.last = Date.now(); render(); },
        function (e) { A.lastError = e; apps.forEach(function (a) { S.dirty[a] = 1; }); S.state = 'err'; render(); S.later(RETRY); });
    }
  };
  w.addEventListener('hawi:store', function (e) { S.mark(e.detail && e.detail.key || ''); });
  d.addEventListener('visibilitychange', function () { if (d.visibilityState === 'hidden') S.flush(); });
  w.addEventListener('pagehide', function () { S.flush(); });

  /* ---------- header icon ---------- */
  var SVG = '<svg class="line" viewBox="0 0 24 24"><path class="c" d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"></path><path d="M20.5899 22C20.5899 18.13 16.7399 15 11.9999 15C7.25991 15 3.40991 18.13 3.40991 22"></path></svg>';
  var GSVG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" class="hwA-gl"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"/></svg>';
  var CSS = '' +
    '.headIc .isPrf{display:none!important}' +
    '.isAcct [hidden]{display:none!important}' +
    '.hw-modal-x{display:inline-flex!important;align-items:center;justify-content:center;padding:0!important;line-height:1!important;flex-shrink:0}' +
    '.hw-modal-x svg{width:16px;height:16px;display:block}' +
    '.hwA-toast{position:fixed;inset-inline:16px;bottom:24px;z-index:10000;margin:0 auto;max-width:420px;padding:12px 16px;border-radius:12px;background:#10242e;color:#fff;font-size:15px;line-height:1.6;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.25);opacity:0;transform:translateY(8px);transition:opacity .2s,transform .2s;pointer-events:none}' +
    '.hwA-toast.on{opacity:1;transform:none}' +
    '.isAcct .hwAcct{background:none;border:0;padding:0;margin:0;color:inherit;font:inherit}' +
    '.isAcct .hwAv{width:26px;height:26px;border-radius:50%;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;background:var(--linkB,#0c9784);color:#fff;font-weight:700;font-size:13px;line-height:1}' +
    '.isAcct .hwAv img{width:100%;height:100%;object-fit:cover;display:block}' +
    '.isAcct.on .hwAcct>svg{display:none}' +
    '.isAcct .hwAdot{position:absolute;top:3px;inset-inline-end:2px;width:8px;height:8px;border-radius:50%;background:#e8a317;box-shadow:0 0 0 2px var(--headerB,#fff)}' +
    '.hwA{display:grid;gap:12px}' +
    '.hwA p{margin:0;line-height:1.7}' +
    '.hwA-why{opacity:.85;font-size:15px}' +
    '.hwA .hw-btn{width:100%}' +
    '.hwA-gl{flex-shrink:0}' +
    '.hwA-or{display:flex;align-items:center;gap:10px;font-size:13px;opacity:.7}' +
    '.hwA-or::before,.hwA-or::after{content:"";flex:1;border-top:1px solid var(--hw-line,rgba(127,127,127,.3))}' +
    '.hwA-f{display:grid;gap:10px;margin:0}' +
    '.hwA-f label{display:grid;gap:4px;font-size:14px;font-weight:600}' +
    '.hwA-f input{width:100%;box-sizing:border-box;min-height:44px;padding:10px 12px;border-radius:12px;border:1px solid var(--hw-line,rgba(127,127,127,.35));background:transparent;color:inherit;font:inherit;font-size:16px}' +
    '.hwA-f input:focus{outline:2px solid var(--hw-accent,#0c9784);outline-offset:1px}' +
    '.hwA-row{display:flex;gap:10px}' +
    '.hwA-row .hw-btn{flex:1}' +
    '.hwA-link{background:none;border:0;padding:4px 0;color:var(--hw-accent,#0c9784);font:inherit;font-size:14px;cursor:pointer;justify-self:start}' +
    '.hwA-msg:empty{display:none}' +
    '.hwA-msg{padding:10px 12px;border-radius:12px;font-size:14px;line-height:1.6;background:var(--hw-bg-soft,rgba(127,127,127,.1))}' +
    '.hwA-msg.bad{color:var(--hw-bad,#c0392b)}' +
    '.hwA-me{display:flex;align-items:center;gap:12px}' +
    '.hwA-me .hwAv{width:48px;height:48px;font-size:20px;flex-shrink:0;border-radius:50%;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;background:var(--linkB,#0c9784);color:#fff;font-weight:700}' +
    '.hwA-me .hwAv img{width:100%;height:100%;object-fit:cover}' +
    '.hwA-me>div{min-width:0}' +
    '.hwA-me b{display:block;font-size:16px;overflow-wrap:anywhere}' +
    '.hwA-me small{display:block;opacity:.75;direction:ltr;text-align:start;word-break:break-all}' +
    '.hwA-tier{font-size:14px;opacity:.85}' +
    '.hwA-box{padding:12px;border-radius:12px;border:1px solid var(--hw-line,rgba(127,127,127,.3));display:grid;gap:10px}' +
    '.hwA-box h4{margin:0;font-size:16px}' +
    '.hwA-st{font-size:14px;display:flex;align-items:center;gap:8px}' +
    '.hwA-st::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--hw-accent,#0c9784);flex-shrink:0}' +
    '.hwA-st.err::before{background:#e8a317}' +
    '.hwA-note{font-size:13px;opacity:.7}';
  function style() {
    if (d.getElementById('hwAcctCss')) return;
    var s = d.createElement('style'); s.id = 'hwAcctCss'; s.textContent = CSS; (d.head || d.documentElement).appendChild(s);
  }
  function avatar(u) {
    if (u.photo && /^https:\/\//.test(u.photo)) return '<img src="' + esc(u.photo) + '" alt="" referrerpolicy="no-referrer" loading="lazy">';
    var c = (u.name || u.email || '?').trim().charAt(0).toUpperCase();
    return esc(c || '?');
  }
  function icon() {
    var ul = d.querySelector('.headIc');
    if (!ul || ul.querySelector('.isAcct')) return;
    style();
    var li = d.createElement('li'); li.className = 'isAcct';
    li.innerHTML = '<button type="button" class="tIc hwAcct" aria-label="' + esc(T.title.ar + ' / ' + T.title.en + ' / ' + T.title.tr) + '">' + SVG +
      '<span class="hwAv" hidden></span><span class="hwAdot" hidden></span></button>';
    ul.insertBefore(li, ul.querySelector('.isLang'));
    li.querySelector('button').addEventListener('click', open);
    paint();
  }
  function paint() {
    var li = d.querySelector('.isAcct'); if (!li) return;
    var u = A.user || cache(), av = li.querySelector('.hwAv'), dot = li.querySelector('.hwAdot');
    var on = !!(u && u.uid);
    li.classList.toggle('on', on);
    av.hidden = !on; av.innerHTML = on ? avatar(u) : '';
    dot.hidden = !(on && u.ok === false);
  }
  A.paint = paint;

  /* ---------- window ---------- */
  var box = null, shut = null, toastT = 0;
  /* close the window (after signing in or out) and say what happened */
  function done(key) {
    if (box && d.body.contains(box) && shut) shut();
    box = null; shut = null;
    style();
    var t = d.querySelector('.hwA-toast');
    if (!t) { t = d.createElement('div'); t.className = 'hwA-toast'; t.setAttribute('role', 'status'); d.body.appendChild(t); }
    t.innerHTML = bi(T[key]); clearTimeout(toastT);
    requestAnimationFrame(function () { t.classList.add('on'); });
    toastT = setTimeout(function () { t.classList.remove('on'); }, 3500);
  }
  A.done = done;
  function open() {
    core(function (H) {
      style();
      if (box && d.body.contains(box)) return;
      shut = H.modal({ title: T.title, body: '<div class="hwA"><p class="hwA-why">' + bi(T.wait) + '</p></div>' });
      var ms = d.querySelectorAll('.hw-modal'), mod = ms[ms.length - 1], x = mod.querySelector('.hw-modal-x');
      box = mod.querySelector('.hwA');
      if (x) x.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      box.addEventListener('click', act);
      box.addEventListener('submit', function (e) { e.preventDefault(); act({ target: box.querySelector('[data-a="in"]') }); });
      render();
      start().then(render, function () { if (box) box.innerHTML = '<div class="hwA-msg bad">' + bi(T.loadErr) + '</div>'; });
    });
  }
  A.open = open;
  function render() {
    if (!box || !d.body.contains(box)) { box = null; return; }
    if (!startP && !A.user) return;
    var u = A.user;
    if (!u && A.F && box.querySelector('.hwA-f')) return; /* still signed out: keep the form (and what the student typed) */
    box.innerHTML = u ? signedIn(u) : signedOut();
  }
  function signedOut() {
    if (!A.F) return '<p class="hwA-why">' + bi(T.wait) + '</p>';
    return '<p class="hwA-why">' + bi(T.why) + '</p>' +
      '<button type="button" class="hw-btn" data-a="google">' + GSVG + bi(T.google) + '</button>' +
      '<div class="hwA-or">' + bi(T.or) + '</div>' +
      '<form class="hwA-f" novalidate>' +
      '<label>' + bi(T.email) + '<input type="email" name="email" autocomplete="email" dir="ltr" required></label>' +
      '<label>' + bi(T.pass) + '<input type="password" name="pass" autocomplete="current-password" dir="ltr" minlength="6" required></label>' +
      '<div class="hwA-msg" role="status" aria-live="polite"></div>' +
      '<div class="hwA-row"><button type="submit" class="hw-btn hw-btn--accent" data-a="in">' + bi(T.login) + '</button>' +
      '<button type="button" class="hw-btn" data-a="up">' + bi(T.create) + '</button></div>' +
      '<button type="button" class="hwA-link" data-a="reset">' + bi(T.forgot) + '</button>' +
      '</form>';
  }
  function signedIn(u) {
    var tier = !u.tier || u.tier === 'free' ? bi(T.free) : esc(u.tier);
    var h = '<div class="hwA-me"><span class="hwAv">' + avatar(u) + '</span><div><b>' + esc(u.name || u.email) + '</b>' +
      (u.name && u.email ? '<small>' + esc(u.email) + '</small>' : '') + '</div></div>' +
      '<div class="hwA-tier">' + bi(T.tier) + ': <b>' + tier + '</b></div>';
    if (!u.ok) {
      h += '<div class="hwA-box"><h4>' + bi(T.verifyH) + '</h4><p>' + bi(T.verifyMsg) + '</p><p class="hwA-note">' + bi(T.spam) + '</p>' +
        '<div class="hwA-msg" role="status" aria-live="polite"></div>' +
        '<button type="button" class="hw-btn hw-btn--accent" data-a="check">' + bi(T.verified) + '</button>' +
        '<button type="button" class="hw-btn" data-a="resend">' + bi(T.resend) + '</button></div>';
    } else {
      var st = S.state, k = st === 'err' ? 'syncErr' : st === 'busy' ? 'saving' : st === 'pending' ? 'pending' : 'saved';
      h += '<div class="hwA-st' + (st === 'err' ? ' err' : '') + '" role="status">' + bi(T[k]) + '</div>';
    }
    h += '<p class="hwA-note">' + bi(T.local) + '</p><button type="button" class="hw-btn" data-a="out">' + bi(T.signout) + '</button>';
    return h;
  }
  function msg(key, bad) {
    var m = box && box.querySelector('.hwA-msg'); if (!m) return;
    m.className = 'hwA-msg' + (bad ? ' bad' : ''); m.innerHTML = key ? bi(T[key] || T.e_generic) : '';
  }
  function fail(e) {
    A.lastError = e;
    var c = e && e.code || '';
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') { msg(''); return; }
    msg(ERR[c] || 'e_generic', true);
  }
  /* emails come back to this page; if the address is not authorized yet, send without the return link */
  function back() { return { url: location.href.split('#')[0] }; }
  function retryBare(fn) { return fn(back()).catch(function (e) { if (e && /continue-uri|invalid-continue|missing-continue/.test(e.code || '')) return fn(undefined); throw e; }); }
  function sendVerify(F, u) { return retryBare(function (o) { return F.a.sendEmailVerification(u, o); }); }
  function sendReset(F, email) { return retryBare(function (o) { return F.a.sendPasswordResetEmail(F.auth, email, o); }); }
  function busy(on) { if (box) box.querySelectorAll('button,input').forEach(function (b) { b.disabled = on; }); }
  function act(e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-a]') : null; if (!b || !box) return;
    var F = A.F; if (!F) return;
    var a = b.getAttribute('data-a'), em = box.querySelector('input[name=email]'), pw = box.querySelector('input[name=pass]');
    var email = em ? em.value.trim() : '', pass = pw ? pw.value : '';
    F.auth.languageCode = lang();
    function run(p, after) { busy(true); msg(''); return p.then(function (x) { busy(false); if (after) after(x); }, function (err) { busy(false); fail(err); }); }
    if (a === 'google') {
      var gp = new F.a.GoogleAuthProvider(); gp.setCustomParameters && gp.setCustomParameters({ prompt: 'select_account' });
      busy(true);
      F.a.signInWithPopup(F.auth, gp).then(function () { busy(false); if (isVerified(F.auth.currentUser)) done('welcome'); }, function (err) {
        busy(false);
        if (err && (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment')) {
          try { sessionStorage.setItem(RKEY, '1'); } catch (x) {}
          F.a.signInWithRedirect(F.auth, gp).catch(fail); return;
        }
        fail(err);
      });
    } else if (a === 'in' || a === 'up') {
      if (!email || !pass) { msg('needBoth', true); return; }
      if (a === 'in') run(F.a.signInWithEmailAndPassword(F.auth, email, pass), function () { if (isVerified(F.auth.currentUser)) done('welcome'); });
      else run(F.a.createUserWithEmailAndPassword(F.auth, email, pass).then(function (c) { return sendVerify(F, c.user); }), function () { msg('sent'); });
    } else if (a === 'reset') {
      if (!email) { msg('needEmail', true); if (em) em.focus(); return; }
      run(sendReset(F, email).catch(function (err) { if (err && (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential')) return; throw err; }), function () { msg('resetSent'); });
    } else if (a === 'resend') {
      if (F.auth.currentUser) run(sendVerify(F, F.auth.currentUser), function () { msg('sent'); });
    } else if (a === 'check') {
      var cu = F.auth.currentUser; if (!cu) return;
      /* reload the user, then refresh the token so the database sees email_verified */
      run(F.a.reload(cu).then(function () { return cu.getIdToken(true); }), function () {
        var u2 = F.auth.currentUser;
        if (isVerified(u2)) { onUser(F, u2); done('welcome'); } else msg('notYet', true);
      });
    } else if (a === 'out') {
      busy(true);
      S.flush().catch(function () {}).then(function () { return F.a.signOut(F.auth); }).then(function () { busy(false); done('bye'); }, function (err) { busy(false); fail(err); });
    }
  }

  /* ---------- boot ---------- */
  function boot() {
    icon();
    var c = cache(), redirect = false;
    try { redirect = !!sessionStorage.getItem(RKEY); } catch (e) {}
    /* signed in: sync where the student actually works (apps, mistakes log) — other pages only show the avatar */
    if (redirect || (c && c.uid && d.querySelector('[data-hawi-app]'))) start().catch(function (e) { A.lastError = e; });
  }
  A.boot = boot;
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})(window, document);
