/*! General mistakes log: every app's mistakes in one page (clinical cases, ECG, later cards / question banks)
    | v0.1.1 (ar/en/tr) | requires hawi-core.js v0.4
    Page: <div data-hawi-app="log"></div> ; one app only: <div data-hawi-app="log" data-app="ecg"></div> */
(function (w, d) {
  'use strict';
  var H = w.Hawi; if (!H || !H.log) return;
  var bi = H.bi, icon = H.icon;
  function B(ar, en, tr) { return { ar: ar, en: en, tr: tr }; }

  var APP = {
    'case': B('الحالات السريرية', 'Clinical Cases', 'Klinik Vakalar'),
    ecg: B('أكاديمية تخطيط القلب', 'ECG Academy', 'EKG Akademisi')
  };
  var L = {
    title: B('سجل أخطائي', 'My Mistakes Log', 'Hata Günlüğüm'),
    intro: B('أخطاؤك في آخر محاولة لكل حالة أو تمرين، من كل الأقسام، والأضعف أولاً. حين تعيد الحالة وتصحّح خطأك يختفي من هنا.',
      'Your mistakes from the latest attempt at each case or exercise, across all sections, weakest first. Retry and fix a mistake and it leaves this list.',
      'Tüm bölümlerde her vaka veya alıştırmanın son denemesindeki hatalarınız, en zayıftan başlayarak. Vakayı tekrarlayıp hatanızı düzeltince buradan kalkar.'),
    introOne: B('أخطاؤك في آخر محاولة لكل حالة أو تمرين، والأضعف أولاً. حين تعيد المحاولة وتصحّح خطأك يختفي من هنا.',
      'Your mistakes from the latest attempt at each case or exercise, weakest first. Retry and fix a mistake and it leaves this list.',
      'Her vaka veya alıştırmanın son denemesindeki hatalarınız, en zayıftan başlayarak. Tekrar deneyip hatanızı düzeltince buradan kalkar.'),
    all: B('الكل', 'All', 'Tümü'),
    solved: B('محلولة', 'solved', 'çözüldü'),
    withM: B('فيها أخطاء', 'with mistakes', 'hatalı'),
    mist: B('خطأ', 'mistakes', 'hata'),
    empty: B('لا أخطاء مسجّلة. حين تحلّ حالة أو تمريناً ستظهر أخطاؤك هنا لتراجعها.',
      'No mistakes recorded. When you solve a case or exercise, your mistakes appear here for review.',
      'Kayıtlı hata yok. Bir vaka veya alıştırma çözdüğünüzde hatalarınız incelemeniz için burada görünür.'),
    missed: B('فاتك', 'Missed', 'Atladığınız'),
    wrong: B('اختيار خاطئ', 'Wrong pick', 'Yanlış seçim'),
    step: B('خطأ في القراءة', 'Reading error', 'Okuma hatası'),
    times: B('مرات', 'times', 'kez'),
    last: B('آخر درجة', 'Last score', 'Son puan'),
    best: B('الأفضل', 'Best', 'En iyi'),
    attempts: B('المحاولات', 'Attempts', 'Deneme'),
    retry: B('أعد المحاولة', 'Try again', 'Tekrar dene'),
    clear: B('امسح الأخطاء', 'Clear mistakes', 'Hataları temizle'),
    clearQ: B('ستُحذف الأخطاء المسجّلة من هذا الجهاز (تبقى درجاتك). متابعة؟',
      'This deletes the recorded mistakes on this device (your scores stay). Continue?',
      'Bu cihazdaki kayıtlı hatalar silinecek (puanlarınız kalır). Devam edilsin mi?'),
    cancel: B('إلغاء', 'Cancel', 'İptal'),
    local: B('يُحفظ السجل على هذا الجهاز.', 'The log is kept on this device.', 'Günlük bu cihazda saklanır.')
  };
  var KIND = { miss: L.missed, bad: L.wrong, step: L.step };

  var CSS = '.hwl-chips{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 4px}' +
    '.hwl-chip{display:inline-flex;align-items:center;gap:7px;font:inherit;font-size:13.5px;padding:6px 14px;border-radius:999px;border:1px solid var(--hw-line);background:transparent;color:inherit;cursor:pointer}' +
    '.hwl-chip[aria-pressed=true]{background:var(--hw-accent);border-color:var(--hw-accent);color:#fff}' +
    '.hwl-chip b{font-weight:700}' +
    '.hwl-app{display:inline-block;font-size:11.5px;padding:1px 8px;border-radius:999px;background:var(--hw-accent-soft);color:var(--hw-accent-ink);margin-inline-end:6px}' +
    '.hwl-k{font-size:12px;color:var(--hw-muted);margin-inline-end:4px}' +
    '.hwl-c{font-size:11.5px;font-weight:700;color:var(--hw-bad);margin-inline-start:8px;white-space:nowrap}' +
    '.hwl .hw-log-l li.k-miss::marker{color:var(--hw-warn)}.hwl .hw-log-l li.k-bad::marker{color:var(--hw-bad)}' +
    '.hwl-intro{margin:6px 0 0;font-size:14px;line-height:1.7;color:var(--hw-muted);font-weight:400}' +
    '.hwl .hw-log .hw-acts{justify-content:flex-start}.hwl .hw-log .hw-acts .hw-btn{min-height:40px;padding:8px 16px;flex:0 0 auto}' +
    '.hwl-note{font-size:12.5px;color:var(--hw-muted);text-align:center;margin:12px 0 0}';
  function inject() {
    if (d.getElementById('hwl-css')) return;
    var st = d.createElement('style'); st.id = 'hwl-css'; st.textContent = CSS; d.head.appendChild(st);
  }
  function okUrl(u) { u = String(u || ''); return /^https:\/\//i.test(u) || /^\/[^\/]/.test(u) ? u : ''; }
  function ringC(sc) { return sc >= 75 ? 'var(--hw-ok)' : sc >= 40 ? 'var(--hw-warn)' : 'var(--hw-bad)'; }

  /* items with mistakes: [{app, it, rec (progress), es (entries)}], weakest first */
  function collect(only) {
    var apps = only ? [only] : H.log.APPS, items = [], solved = {};
    apps.forEach(function (a) {
      var pr = H.prog(a).all(), by = {};
      solved[a] = Object.keys(pr).length;
      H.log.list({ app: a }).forEach(function (e) { (by[e.it] = by[e.it] || []).push(e); });
      Object.keys(by).forEach(function (it) { items.push({ app: a, it: it, rec: pr[it] || null, es: by[it] }); });
    });
    items.sort(function (x, y) {
      var sx = x.rec && x.rec.last != null ? x.rec.last : 0, sy = y.rec && y.rec.last != null ? y.rec.last : 0;
      return sx - sy || y.es.length - x.es.length || y.es[0].at - x.es[0].at;
    });
    return { items: items, solved: solved };
  }

  H.apps.log = function (mount) {
    inject();
    var only = mount.getAttribute('data-app'), sel = only || '*';
    if (only && !APP[only]) only = null;
    function draw() {
      var all = collect(only), apps = only ? [only] : H.log.APPS;
      var items = all.items.filter(function (x) { return sel === '*' || x.app === sel; });
      var nSolved = apps.reduce(function (s, a) { return s + (all.solved[a] || 0); }, 0);
      var nMist = all.items.reduce(function (s, x) { return s + x.es.length; }, 0);
      /* inside a section page (data-app) the tab already names it: no title, section-only intro */
      var head = '<section class="hw-card">' + (only ? '<p class="hwl-intro" style="margin-top:0">' + bi(L.introOne) + '</p>' : '<h3>' + bi(L.title) + '</h3><p class="hwl-intro">' + bi(L.intro) + '</p>') +
        '<div class="hw-stats"><div><b>' + nSolved + '</b>' + bi(L.solved) + '</div><div><b>' + all.items.length + '</b>' + bi(L.withM) +
        '</div><div><b>' + nMist + '</b>' + bi(L.mist) + '</div></div>' +
        (only ? '' : '<div class="hwl-chips" role="group">' + ['*'].concat(apps).map(function (a) {
          var n = a === '*' ? all.items.length : all.items.filter(function (x) { return x.app === a; }).length;
          return '<button type="button" class="hwl-chip" data-a="' + a + '" aria-pressed="' + (sel === a) + '">' + bi(a === '*' ? L.all : APP[a]) + '<b>' + n + '</b></button>';
        }).join('') + '</div>') + '</section>';
      var body = items.length ? items.map(function (x) {
        var r = x.rec || {}, e0 = x.es[0], sc = r.last != null ? r.last : 0, u = okUrl(r.u || e0.u);
        return '<section class="hw-card hw-log">' +
          '<div class="hw-log-h"><div class="hw-ring hw-ring--sm" style="--p:' + sc + ';--c:' + ringC(sc) + '"><span>' + sc + '</span></div>' +
          '<div><small><span class="hwl-app">' + bi(APP[x.app] || x.app) + '</span>' + (e0.sp ? bi(e0.sp) : '') + '</small>' +
          '<b>' + bi(r.t || e0.t || x.it) + '</b>' +
          (x.rec ? '<small>' + bi(L.best) + ': ' + (r.best != null ? r.best : '–') + ' · ' + bi(L.attempts) + ': ' + (r.n || 0) + '</small>' : '') + '</div></div>' +
          '<ul class="hw-log-l">' + x.es.map(function (e) {
            return '<li class="' + (e.k === 'miss' ? 'k-miss' : 'k-bad') + '"><span class="hwl-k">' + bi(KIND[e.k] || KIND.bad) + ':</span>' + bi(e.x || e.ref) +
              (e.c > 1 ? '<bdi class="hwl-c" dir="ltr">×' + e.c + '</bdi>' : '') + '</li>';
          }).join('') + '</ul>' +
          (u ? '<div class="hw-acts"><a class="hw-btn hw-btn--accent" href="' + H.esc(u) + '">' + icon('redo') + bi(L.retry) + '</a></div>' : '') +
          '</section>';
      }).join('') : '<section class="hw-card"><p>' + bi(L.empty) + '</p></section>';
      mount.innerHTML = '<div class="hw-case hwl">' + head + body +
        (nMist ? '<div class="hw-acts"><button type="button" class="hw-btn js-clear">' + icon('x') + bi(L.clear) + '</button></div>' : '') +
        '<p class="hwl-note">' + bi(L.local) + '</p></div>';
      mount.querySelectorAll('.hwl-chip').forEach(function (b) {
        b.addEventListener('click', function () { sel = b.getAttribute('data-a'); draw(); });
      });
      var cb = mount.querySelector('.js-clear');
      if (cb) cb.addEventListener('click', function () {
        H.modal({ icon: 'alert', title: L.clear, body: '<p>' + bi(L.clearQ) + '</p>', actions: [
          { label: L.cancel },
          { label: L.clear, kind: 'danger', onClick: function (c) { apps.forEach(function (a) { if (sel === '*' || sel === a) H.log.clear(a); }); c(); draw(); } }] });
      });
    }
    draw();
    /* another tab of the site changed the log → refresh */
    w.addEventListener('storage', function (ev) { if (ev.key && /^hawi:[a-z0-9-]+:(log|prog)$/.test(ev.key)) draw(); });
  };

  if (d.readyState !== 'loading' && H.boot) H.boot();
})(window, document);
