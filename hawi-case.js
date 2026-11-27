/*! Clinical Case app (Play / Review / Discussion) | v0.5.0 (ar/en/tr) | requires hawi-core.js v0.4
    v0.3: investigation results (r) + media, meta (level, tags), discussion links + related posts by tag,
          personal log of mistakes (data-view="progress")
    v0.3.1: no platform name in code; related posts work on any domain
    v0.4: progress + mistakes through the shared H.prog / H.log (hawi-core v0.4): tags, short texts, relative retry
          links, read by the general log page; pre-v0.4 data migrated once (old keys kept)
    v0.5.0: as in the source app — investigations are tap rows (no checkbox) that show their finding (r) at once;
          infant age in months (patient.months); submit always asks to confirm; performance index bar + "Missed:";
          Review lists every option numbered with a verdict badge (option v, or derived from w) + Retry;
          Discussion: authored investigation/management bullets (discussion.inv / .mgmt), summary paragraphs,
          "Finish Session" (to the cases hub) instead of "Back to Top" (the theme has its own); favourite heart
          (stored in case:data → synced with the account) */
(function (w, d) {
  'use strict';
  var H = w.Hawi; if (!H || !H.prog) return; /* needs hawi-core v0.4 */
  var bi = H.bi, icon = H.icon;
  function B(ar, en, tr) { var o = { ar: ar, en: en }; if (tr) o.tr = tr; return o; }

  var L = {
    play: B('الحالة', 'Play', 'Vaka'), review: B('المراجعة', 'Review', 'Değerlendirme'), disc: B('المناقشة', 'Discussion', 'Tartışma'),
    history: B('القصة المرضية', 'History', 'Anamnez'), exam: B('الفحص السريري', 'Examination', 'Fizik Muayene'),
    inv: B('الاستقصاءات', 'Investigations', 'Tetkikler'), mgmt: B('خطة التدبير', 'Management Plan', 'Tedavi Planı'),
    submit: B('أرسل إجاباتك', 'Submit Responses', 'Yanıtları Gönder'), selected: B('مختار', 'selected', 'seçildi'),
    yrs: B('سنة', 'years', 'yaş'), m: B('ذكر', 'Male', 'Erkek'), f: B('أنثى', 'Female', 'Kadın'),
    emptyT: B('لم تختر شيئاً', 'Nothing Selected', 'Seçim Yapılmadı'),
    emptyB: B('لم تحدد أي استقصاء أو خطة علاج. هل تريد إرسال خطة فارغة؟', "You haven't made any choices. Submit an empty plan anyway?", 'Hiçbir tetkik veya tedavi seçmediniz. Boş plan yine de gönderilsin mi?'),
    back: B('رجوع', 'Back', 'Geri'), anyway: B('أرسل على أي حال', 'Submit Anyway', 'Yine de Gönder'),
    perfT: B('أداؤك', 'Your Performance', 'Performansınız'),
    perfNote: B('تعتمد الدرجة على دقة اختياراتك ومباشرتها؛ الاختيارات الضارة تُنقص الدرجة.', 'Marks depend on clinical accuracy and directness; harmful choices cost marks.', 'Puan, seçimlerinizin klinik doğruluğuna ve isabetine bağlıdır; zararlı seçimler puan kaybettirir.'),
    toReview: B('إلى المراجعة', 'Go to Review', 'Değerlendirmeye Geç'), close: B('إغلاق', 'Close', 'Kapat'),
    chosenOk: B('اختيار صحيح', 'Correct', 'Doğru'), chosenBad: B('اختيار غير مناسب', 'Not indicated', 'Endike değil'),
    missed: B('فاتك', 'Missed', 'Atlandı'), neutral: B('محايد', 'Neutral', 'Nötr'), none: B('لم تختر شيئاً.', 'None selected.', 'Seçim yapılmadı.'),
    lockedMsg: B('أرسل إجاباتك في تبويب الحالة أولاً لفتح هذا القسم.', 'Submit your responses in Play first to unlock this section.', 'Bu bölümü açmak için önce Vaka sekmesinde yanıtlarınızı gönderin.'),
    problem: B('المشكلة الحالية', 'Presenting Problem', 'Başvuru Sorunu'), ddx: B('التشخيص التفريقي', 'Differential Diagnosis', 'Ayırıcı Tanı'),
    yourResult: B('نتيجتك', 'Your Result', 'Sonucunuz'), best: B('الأفضل', 'Best', 'En İyi'), attempts: B('المحاولات', 'Attempts', 'Deneme'),
    lHigh: B('الأرجح', 'Most likely', 'En olası'), lMid: B('ممكن', 'Possible', 'Olası'), lLow: B('أقل احتمالاً', 'Less likely', 'Daha az olası'),
    finalDx: B('التشخيص النهائي', 'Final Diagnosis', 'Kesin Tanı'),
    summary: B('الخلاصة السريرية والمحاكمة', 'Clinical Summary & Reasoning', 'Klinik Özet ve Akıl Yürütme'),
    invExp: B('الاستقصاءات: لماذا؟', 'Investigations: Why?', 'Tetkikler: Neden?'), mgmtExp: B('التدبير: لماذا؟', 'Management: Why?', 'Tedavi: Neden?'),
    keys: B('نقاط أساسية', 'Key Points', 'Anahtar Noktalar'), refs: B('المراجع', 'References', 'Kaynaklar'),
    retry: B('أعد الحالة', 'Retry Case', 'Vakayı Tekrarla'), top: B('إلى الأعلى', 'Back to Top', 'Başa Dön'),
    result: B('النتيجة', 'Result', 'Sonuç'), yourInv: B('نتائج استقصاءاتك', 'Your Investigation Results', 'Tetkik Sonuçlarınız'),
    noInv: B('لم تطلب أي استقصاء.', 'You ordered no investigations.', 'Hiç tetkik istemediniz.'),
    zoom: B('اضغط للتكبير', 'Tap to enlarge', 'Büyütmek için dokunun'),
    lv1: B('مبتدئ', 'Beginner', 'Başlangıç'), lv2: B('متوسط', 'Intermediate', 'Orta'), lv3: B('متقدم', 'Advanced', 'İleri'),
    more: B('للتعمّق', 'Learn More', 'Daha Fazlası'), related: B('مواد ذات صلة', 'Related Content', 'İlgili İçerik'),
    myLog: B('سجلّ أخطائي', 'My Mistakes Log', 'Hata Kaydım'),
    logEmpty: B('لم تحلّ أي حالة بعد على هذا الجهاز.', 'No cases solved on this device yet.', 'Bu cihazda henüz vaka çözülmedi.'),
    logIntro: B('الحالات التي حللتها على هذا الجهاز، مرتبة من الأضعف إلى الأقوى. أعد الحالات ذات الدرجة المنخفضة.', 'Cases you solved on this device, weakest first. Retry the low-scoring ones.', 'Bu cihazda çözdüğünüz vakalar, en zayıftan başlayarak. Düşük puanlıları tekrarlayın.'),
    solved: B('حالة محلولة', 'cases solved', 'çözülen vaka'), avg: B('متوسط أفضل درجة', 'average best score', 'ortalama en iyi puan'),
    missedEss: B('أساسيات فاتتك', 'Essentials you missed', 'Atladığınız temel adımlar'),
    wrongPicks: B('اختيارات ضارة أو غير مناسبة', 'Harmful or unneeded picks', 'Zararlı veya gereksiz seçimler'),
    open: B('افتح الحالة', 'Open case', 'Vakayı aç'), clearLog: B('امسح السجل', 'Clear log', 'Kaydı temizle'),
    clearQ: B('سيُحذف سجل الحالات والدرجات من هذا الجهاز. متابعة؟', 'This deletes your case log and scores on this device. Continue?', 'Bu cihazdaki vaka kaydınız ve puanlarınız silinecek. Devam edilsin mi?'),
    eduNote: B('محتوى تعليمي للطلاب والأطباء، لا يغني عن الدليل العلاجي المحلي ولا عن تقييم المريض.', 'Educational content; it does not replace local guidelines or patient assessment.', 'Öğrenciler ve hekimler için eğitim içeriğidir; yerel kılavuzların ve hasta değerlendirmesinin yerini tutmaz.'),
    /* v0.5 */
    mos: B('شهراً', 'months', 'aylık'),
    confT: B('إرسال اختياراتك؟', 'Submit Selections?', 'Seçimler Gönderilsin mi?'),
    confB: B('هل أنت مستعد لتقييم استقصاءاتك وخطة التدبير التي اخترتها؟', 'Are you ready to evaluate your clinical investigations and management plan?', 'Tetkik ve tedavi planınızın değerlendirilmesine hazır mısınız?'),
    yesSubmit: B('نعم، أرسل', 'Yes, Submit', 'Evet, Gönder'),
    perfIdx: B('مؤشر الأداء', 'Performance Index', 'Performans Endeksi'),
    nOk: B('صحيح', 'Correct', 'Doğru'), nBad: B('خطأ', 'Incorrect', 'Yanlış'), nMiss: B('فاتك', 'Missed', 'Atlandı'),
    missedP: B('فاتك:', 'Missed:', 'Atlandı:'),
    feedback: B('عرض تفاصيل التقييم', 'View Feedback Details', 'Geri Bildirim Ayrıntıları'),
    invRev: B('الاستقصاءات', 'Investigations', 'Tetkikler'), mgmtRev: B('التدبير', 'Management', 'Tedavi'),
    youPicked: B('اخترته', 'You chose this', 'Seçtiniz'),
    takeHome: B('رسائل للحفظ', 'Key Take-Home Messages', 'Akılda Kalması Gerekenler'),
    finish: B('إنهاء الجلسة', 'Finish Session', 'Oturumu Bitir'),
    favAdd: B('أضف إلى المفضلة', 'Add to favourites', 'Favorilere ekle'), favDel: B('أزل من المفضلة', 'Remove from favourites', 'Favorilerden çıkar'),
    /* verdict badges (Review): option v, or derived from w */
    v_rec: B('موصى به', 'Recommended', 'Önerilir'), v_low: B('مردود ضعيف', 'Low Yield', 'Düşük Verim'),
    v_nfl: B('ليس الخيار الأول', 'Not First-Line', 'İlk Basamak Değil'), v_lim: B('دور محدود', 'Limited Role', 'Sınırlı Rol'),
    v_nrn: B('ليس روتينياً الآن', 'Not Routine Now', 'Şu An Rutin Değil'), v_ni: B('غير مستطب', 'Not Indicated', 'Endike Değil'),
    v_nin: B('غير مستطب الآن', 'Not Indicated Now', 'Şu An Endike Değil'), v_na: B('غير مناسب', 'Not Appropriate', 'Uygun Değil'), v_nr: B('غير موصى به', 'Not Recommended', 'Önerilmez'),
    v_harm: B('ضار', 'Harmful', 'Zararlı'),
    nextT: B('الخطوة التالية', 'Next Steps', 'Sonraki Adım'),
    nextB: B('هل تريد دراسة المناقشة السريرية أولاً، أم إعادة الحالة الآن؟', 'Would you like to study the clinical discussion first, or restart the case now?', 'Önce klinik tartışmayı incelemek mi, yoksa vakayı şimdi yeniden başlatmak mı istersiniz?'),
    viewDisc: B('عرض المناقشة', 'View Discussion', 'Tartışmayı Gör'),
    startAgain: B('ابدأ من جديد', 'Start Again', 'Yeniden Başla')
  };

  /* verdict code -> colour class; the order also sorts the Review lists (recommended first) */
  var VERD = { rec: 'ok', low: 'mid', nfl: 'mid', lim: 'mid', nrn: 'mid', ni: 'bad', nin: 'bad', na: 'bad', nr: 'bad', harm: 'harm' };
  var VORD = ['rec', 'low', 'nfl', 'lim', 'nrn', 'nin', 'ni', 'na', 'nr', 'harm'];
  function verdict(o) { return VERD[o.v] ? o.v : o.w > 0 ? 'rec' : o.w === 0 ? 'low' : o.w === -1 ? 'ni' : 'harm'; }
  /* age: infants by months when given (patient.months), otherwise years */
  function ageHtml(p) {
    var mo = p && p.months;
    return typeof mo === 'number' && mo >= 0 && (!(p.age > 2)) ? H.esc(mo) + ' ' + bi(L.mos) : H.esc(p && p.age) + ' ' + bi(L.yrs);
  }
  var CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4.5h14A1.5 1.5 0 0 1 20.5 6v9a1.5 1.5 0 0 1-1.5 1.5H10l-5 4v-4H5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5z"/></svg>';
  var EXIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M10 16l-4-4 4-4M6 12h10"/></svg>';
  var HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.4C1.4 7.6 3.7 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.3 0 5.6 3.1 4.3 6.6-1.8 4.8-9.3 9.4-9.3 9.4z"/></svg>';
  /* favourites: case:data {v, fav:{<post path>:{t, at}}} — the 'data' kind syncs with the account; the hub reads it */
  var FAV = {
    all: function () { var x = H.store.get('case:data', null); return x && x.fav ? x.fav : {}; },
    has: function (u) { return !!FAV.all()[u]; },
    toggle: function (u, t) {
      var x = H.store.get('case:data', null) || { v: 1 }; x.fav = x.fav || {};
      if (x.fav[u]) delete x.fav[u]; else x.fav[u] = { t: t || null, at: Date.now() };
      H.store.set('case:data', x); return !!x.fav[u];
    }
  };

  /* original, neutral avatar (replace with the case image via data.image) */
  var AVA = '<svg viewBox="0 0 72 72" aria-hidden="true"><rect width="72" height="72" fill="#dff2ee"/><circle cx="36" cy="28" r="13" fill="#f2c9a0"/><path d="M23 25c0-9 6-14 13-14s13 5 13 13c-3-4-8-5-13-5s-10 2-13 6z" fill="#5b3a29"/><path d="M12 72c2-14 12-21 24-21s22 7 24 21z" fill="#0c9784" style="fill:var(--hw-accent,#0c9784)"/><path d="M29 51l7 8 7-8" fill="none" stroke="#fff" stroke-width="2"/></svg>';

  function safeUrl(u) { return /^https:\/\//i.test(String(u || '')) ? String(u) : ''; }
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9-]/g, ''); }

  /* investigation result (+ optional image: ECG strip, X-ray…) */
  function mediaHtml(m) {
    var src = m && safeUrl(m.src); if (!src) return '';
    return '<span class="hw-media" role="button" tabindex="0" data-src="' + H.esc(src) + '" data-cap="' + H.esc(H.t(m.cap)) + '">' +
      '<img loading="lazy" alt="' + H.esc(H.t(m.cap)) + '" src="' + H.esc(src) + '">' +
      '<span class="hw-media-c">' + (m.cap ? bi(m.cap) + ' · ' : '') + bi(L.zoom) + '</span></span>';
  }
  function resultHtml(o) {
    if (!o || (!o.r && !(o.media && o.media.src))) return '';
    return '<span class="hw-r">' + (o.r ? '<b>' + bi(L.result) + ':</b> ' + bi(o.r) : '') + mediaHtml(o.media) + '</span>';
  }
  /* one delegated handler per mount: open media in a modal */
  function bindMedia(root) {
    function open(el) {
      H.modal({ title: el.getAttribute('data-cap') || L.result, body: '<img class="hw-zoom" alt="" src="' + H.esc(el.getAttribute('data-src')) + '">', actions: [{ label: L.close }] });
    }
    root.addEventListener('click', function (e) {
      var el = e.target.closest && e.target.closest('.hw-media'); if (!el) return;
      e.preventDefault(); e.stopPropagation(); open(el);
    }, true);
    root.addEventListener('keydown', function (e) {
      var el = e.target.closest && e.target.closest('.hw-media');
      if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(el); }
    });
  }

  /* ---------- progress + mistakes (shared layer: H.prog('case') + H.log, app 'case') ---------- */
  var P = H.prog('case');
  function info(data) {
    var meta = data.meta || {};
    return { t: data.title, sp: data.specialty, lv: meta.level || 0, tags: (meta.tags || []).map(H.slug).filter(Boolean), u: H.path() };
  }
  function logPut(data, r) {
    var ess = r.inv.miss.concat(r.mgmt.miss).filter(function (o) { return o.w === 2; }), bad = r.inv.bad.concat(r.mgmt.bad);
    H.log.put('case', data.id,
      ess.map(function (o) { return { k: 'miss', ref: o.id, x: o.t }; }).concat(bad.map(function (o) { return { k: 'bad', ref: o.id, x: o.t }; })),
      info(data));
  }
  function caseLog() {
    var all = P.all(), out = {};
    Object.keys(all).forEach(function (id) {
      var r = all[id], es = H.log.list({ app: 'case', it: id });
      out[id] = { u: r.u, t: r.t || id, sp: r.sp, lv: r.lv, best: r.best, last: r.last, n: r.n, at: r.at,
        miss: es.filter(function (e) { return e.k === 'miss'; }).map(function (e) { return e.x; }).slice(0, 6),
        bad: es.filter(function (e) { return e.k === 'bad'; }).map(function (e) { return e.x; }).slice(0, 6) };
    });
    return out;
  }
  function renderLog(mount) {
    function draw() {
      var log = caseLog(), ids = Object.keys(log);
      if (!ids.length) { mount.innerHTML = '<div class="hw-case"><section class="hw-card"><h3>' + bi(L.myLog) + '</h3><p>' + bi(L.logEmpty) + '</p></section></div>'; return; }
      ids.sort(function (a, b) { return (log[a].last || 0) - (log[b].last || 0); });
      var avg = Math.round(ids.reduce(function (s, id) { return s + (log[id].best || 0); }, 0) / ids.length);
      var li = function (arr) { return arr.map(function (t) { return '<li>' + bi(t) + '</li>'; }).join(''); };
      mount.innerHTML = '<div class="hw-case"><section class="hw-card"><h3>' + bi(L.myLog) + '</h3><p class="hw-sub">' + bi(L.logIntro) + '</p>' +
        '<div class="hw-stats"><div><b>' + ids.length + '</b>' + bi(L.solved) + '</div><div><b>' + avg + '</b>' + bi(L.avg) + '</div></div></section>' +
        ids.map(function (id) {
          var x = log[id], sc = x.last || 0, c = sc >= 75 ? 'var(--hw-ok)' : sc >= 40 ? 'var(--hw-warn)' : 'var(--hw-bad)';
          return '<section class="hw-card hw-log">' +
            '<div class="hw-log-h"><div class="hw-ring hw-ring--sm" style="--p:' + sc + ';--c:' + c + '"><span>' + sc + '</span></div>' +
            '<div><small>' + bi(x.sp) + '</small><b>' + bi(x.t) + '</b><small>' + bi(L.best) + ': ' + x.best + ' · ' + bi(L.attempts) + ': ' + x.n + '</small></div></div>' +
            (x.miss && x.miss.length ? '<div class="hw-res-h">' + bi(L.missedEss) + '</div><ul class="hw-log-l l-miss">' + li(x.miss) + '</ul>' : '') +
            (x.bad && x.bad.length ? '<div class="hw-res-h">' + bi(L.wrongPicks) + '</div><ul class="hw-log-l l-bad">' + li(x.bad) + '</ul>' : '') +
            (safeUrl(x.u) || /^\/[^\/]/.test(x.u || '') ? '<div class="hw-acts"><a class="hw-btn hw-btn--accent" href="' + H.esc(x.u) + '">' + icon('redo') + bi(L.open) + '</a></div>' : '') +
            '</section>';
        }).join('') +
        '<div class="hw-acts"><button type="button" class="hw-btn js-clear">' + icon('x') + bi(L.clearLog) + '</button></div></div>';
      mount.querySelector('.js-clear').addEventListener('click', function () {
        H.modal({ icon: 'alert', title: L.clearLog, body: '<p>' + bi(L.clearQ) + '</p>', actions: [
          { label: L.back },
          { label: L.clearLog, kind: 'danger', onClick: function (c) {
            Object.keys(H.store.get('case-log', {}) || {}).forEach(function (id) { H.store.del('case:' + id); });
            H.store.del('case-log'); P.clear(); H.log.clear('case'); c(); draw(); } }] });
      });
    }
    draw();
  }

  /* ---------- related posts by tag (Blogger label feed, same origin) ---------- */
  function related(box, tags, selfUrl) {
    function drop() { var det = box.closest('details'); box.remove(); if (det && !det.querySelector('a')) det.remove(); }
    tags = (tags || []).map(slug).filter(Boolean).slice(0, 3);
    if (!tags.length || !d.querySelector('link[type="application/atom+xml"]')) { setTimeout(drop, 0); return; }
    var seen = {}, items = [], left = tags.length;
    tags.forEach(function (tag) {
      fetch('/feeds/posts/summary/-/' + encodeURIComponent(tag) + '?alt=json&max-results=8')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          ((j && j.feed && j.feed.entry) || []).forEach(function (e) {
            var lk = (e.link || []).filter(function (l) { return l.rel === 'alternate'; })[0];
            if (!lk || seen[lk.href] || lk.href.split('?')[0] === selfUrl) return;
            seen[lk.href] = 1;
            var parts = String((e.title && e.title.$t) || '').split(' | ');
            items.push({ u: lk.href, t: { ar: parts[0], en: parts[1] || parts[0], tr: parts[2] || '' } });
          });
        })
        .catch(function () {})
        .then(function () {
          if (--left) return;
          if (!items.length) { drop(); return; }
          box.innerHTML = '<div class="hw-res-h">' + bi(L.related) + '</div><ul class="hw-links">' + items.slice(0, 8).map(function (x) {
            return '<li><a href="' + H.esc(x.u) + '">' + bi(x.t) + '</a></li>'; }).join('') + '</ul>';
        });
    });
  }

  H.apps['case'] = function (mount, data) {
    if (mount.getAttribute('data-view') === 'progress') { renderLog(mount); return; }
    if (!data) return;
    /* previews (encoder tool) keep a device-only record and never reach the progress/log */
    var pv = /^preview-/.test(data.id), key = 'case:' + data.id, rec = pv ? null : P.get(data.id);
    /* the cases hub ("Finish Session"); a relative path, so no domain is written in the code */
    var HUB = mount.getAttribute('data-hub') || '/p/clinical-cases.html';
    var saved = pv ? H.store.get(key, { best: null, attempts: 0, last: null }) :
      { best: rec ? rec.best : null, attempts: rec ? rec.n : 0, last: rec && rec.ans ? { inv: rec.ans.inv || [], mgmt: rec.ans.mgmt || [], score: rec.last } : null };
    function save(score) {
      if (pv) { H.store.set(key, saved); return; }
      var x = info(data), extra = { ans: saved.last ? { inv: saved.last.inv, mgmt: saved.last.mgmt } : null, t: x.t, sp: x.sp, lv: x.lv, u: x.u };
      if (score != null) P.score(data.id, score, extra);
      else { var r = P.get(data.id); if (r) { for (var k in extra) r[k] = extra[k]; P.set(data.id, r); } }
    }
    var st = { inv: {}, mgmt: {}, graded: false, result: null };
    if (saved.last) {
      (saved.last.inv || []).forEach(function (id) { st.inv[id] = 1; });
      (saved.last.mgmt || []).forEach(function (id) { st.mgmt[id] = 1; });
      st.graded = true; st.result = grade();
    }

    var p = data.patient || {}, meta = data.meta || {};
    var lvl = [1, 2, 3].indexOf(meta.level) > -1 ? meta.level : 0;
    mount.innerHTML =
      '<article class="hw-case">' +
        '<header class="hw-hero">' +
          '<div class="hw-ava">' + (data.image ? '<img alt="" src="' + H.esc(data.image) + '">' : AVA) + '</div>' +
          '<div class="hw-hero-t"><div class="hw-hero-spec">' + bi(data.specialty) + '</div>' +
            '<h2>' + bi(data.title) + '</h2>' +
            '<div class="hw-hero-meta">' + ageHtml(p) + ' · ' + bi(p.sex === 'f' ? L.f : L.m) +
              (lvl ? ' <span class="hw-lvl lv-' + lvl + '">' + bi(L['lv' + lvl]) + '</span>' : '') + '</div>' +
            '<div class="hw-hero-cc">' + bi(data.complaint) + '</div></div>' +
          '<div class="hw-best"><b class="js-best">' + (saved.best == null ? '—' : saved.best) + '</b>' + bi(L.best) + '</div>' +
          '<button type="button" class="hw-fav js-fav" aria-pressed="false">' + HEART + '</button>' +
        '</header>' +
        '<div class="js-steps"></div>' +
      '</article>';
    bindMedia(mount);

    /* favourite heart (previews: on screen only) */
    (function () {
      var b = mount.querySelector('.js-fav'), u = H.path(), on = !pv && FAV.has(u);
      function show() {
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.setAttribute('aria-label', H.t(on ? L.favDel : L.favAdd)); b.title = H.t(on ? L.favDel : L.favAdd);
      }
      show();
      b.addEventListener('click', function () { on = pv ? !on : FAV.toggle(u, data.title); show(); });
      d.addEventListener('hawi:lang', show);
    })();

    var tabs = H.tabs(mount.querySelector('.js-steps'), {
      id: 'case-' + data.id, variant: 'steps', numbered: true, hash: !!data.hash,
      tabs: [
        { id: 'play', label: L.play, render: renderPlay, done: st.graded },
        { id: 'review', label: L.review, render: renderReview, locked: !st.graded },
        { id: 'discussion', label: L.disc, render: renderDiscussion, locked: !st.graded }
      ],
      onLocked: function () {
        H.modal({ icon: 'lock', title: L.review, body: '<p>' + bi(L.lockedMsg) + '</p>', actions: [{ label: L.close, kind: 'primary' }] });
      }
    });

    /* ---------- PLAY ---------- */
    function renderPlay(panel) {
      panel.innerHTML =
        '<section class="hw-card"><h3>' + bi(data.presentation) + '</h3>' +
          '<div class="hw-sub">' + ageHtml(p) + ' · ' + bi(p.sex === 'f' ? L.f : L.m) + '</div>' +
          '<div class="hw-stem">' + bi(data.stem) + '</div></section>' +
        '<section class="hw-card" style="padding:0;overflow:hidden"><table class="hw-vitals"><tbody>' +
          (data.vitals || []).map(function (v) { return '<tr><th scope="row">' + bi(v.k) + '</th><td>' + H.esc(v.v) + '</td></tr>'; }).join('') +
        '</tbody></table></section>' +
        '<div class="js-acc"></div>' +
        /* the submit bar lives inside the choices block (investigations + management) only: being sticky, it shows
           at the bottom of the screen while the student is among the choices, never over the story, vitals or exam */
        '<div class="hw-choose"><div class="js-acc2"></div>' +
        '<div class="hw-submit"><button type="button" class="hw-btn hw-btn--primary js-submit">' + icon('bolt') + bi(L.submit) + '</button></div></div>';

      var acc = H.accordion(panel.querySelector('.js-acc'), [
        { id: 'h', title: L.history, html: '<p>' + bi(data.history) + '</p>' },
        { id: 'e', title: L.exam, html: '<ul>' + (data.exam || []).map(function (x) { return '<li>' + bi(x) + '</li>'; }).join('') + '</ul>' }
      ]);
      var acc2 = H.accordion(panel.querySelector('.js-acc2'), [
        { id: 'i', title: L.inv, render: function (b) { optList(b, 'inv', data.investigations.options); } },
        { id: 'm', title: L.mgmt, render: function (b) { optList(b, 'mgmt', data.management.options); } }
      ]);
      acc.i = acc2.i; acc.m = acc2.m;

      function counts() {
        var ni = Object.keys(st.inv).length, nm = Object.keys(st.mgmt).length;
        acc.i.count(ni ? ni + ' ' + bi(L.selected) : ''); acc.m.count(nm ? nm + ' ' + bi(L.selected) : '');
      }
      counts();
      panel._counts = counts;

      var btn = panel.querySelector('.js-submit');
      btn.disabled = st.graded;
      if (st.graded) panel.querySelector('.hw-submit').hidden = true;
      btn.addEventListener('click', function () {
        var ni = Object.keys(st.inv).length, nm = Object.keys(st.mgmt).length;
        if (!ni && !nm) {
          H.modal({ icon: 'alert', title: L.emptyT, body: '<p>' + bi(L.emptyB) + '</p>', actions: [
            { label: L.back },
            { label: L.anyway, kind: 'danger', onClick: function (c) { c(); submit(); } }] });
        } else {
          /* as in the source app: always confirm before grading */
          H.modal({ title: L.confT, body: '<p>' + bi(L.confB) + '</p><p class="hw-conf-n">' + bi(L.inv) + ': <b>' + ni + '</b> · ' + bi(L.mgmt) + ': <b>' + nm + '</b></p>',
            actions: [
              { label: L.back },
              { label: L.yesSubmit, kind: 'primary', onClick: function (c) { c(); submit(); } }] });
        }
      });
    }

    /* investigations (as in the source app): a tap row without a checkbox; once ordered it shows a side bar, a tick
       and its finding (r / media) at once — the finding never says right or wrong. Management keeps its checkboxes. */
    function invFinding(o) {
      var m = mediaHtml(o.media);
      return o.r || m ? '<span class="hw-opt-res">' + (o.r ? '<span class="hw-opt-rt">' + bi(o.r) + '</span>' : '') + m + '</span>' : '';
    }
    function optList(box, group, opts) {
      var inv = group === 'inv';
      box.innerHTML = '<div class="hw-opts' + (inv ? ' hw-opts--inv' : '') + (st.graded ? ' is-graded' : '') + '"></div>';
      var wrap = box.firstChild;
      opts.forEach(function (o) {
        var b = d.createElement('div');
        b.className = 'hw-opt'; b.setAttribute('role', 'checkbox'); b.tabIndex = 0;
        b.setAttribute('aria-checked', st[group][o.id] ? 'true' : 'false');
        b.dataset.id = o.id;
        b.innerHTML = '<span class="hw-box">' + icon('check') + '</span><span class="hw-opt-b"><span class="hw-opt-t">' + bi(o.t) +
          '</span><span class="hw-opt-tag"></span><span class="hw-opt-why">' + bi(o.why) + '</span>' +
          (inv ? '<span class="js-res">' + (st.inv[o.id] ? invFinding(o) : '') + '</span>' : '') + '</span>' +
          (inv ? '<span class="hw-tick">' + icon('check') + '</span>' : '');
        if (st.graded) gradeOpt(b, o, !!st[group][o.id]);
        function toggle(e) {
          if (st.graded) return;
          if (e && e.target.closest && e.target.closest('.hw-media,.hw-tt')) return; /* image zoom / glossary word */
          var on = !st[group][o.id];
          if (on) st[group][o.id] = 1; else delete st[group][o.id];
          b.setAttribute('aria-checked', on ? 'true' : 'false');
          if (inv) b.querySelector('.js-res').innerHTML = on ? invFinding(o) : '';
          var pl = tabs.panel('play'); if (pl && pl._counts) pl._counts();
        }
        b.addEventListener('click', toggle);
        b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); } });
        wrap.appendChild(b);
      });
    }

    function gradeOpt(b, o, sel) {
      var tag = b.querySelector('.hw-opt-tag'), cls, lab;
      if (sel && o.w > 0) { cls = 'g-ok'; lab = L.chosenOk; }
      else if (sel && o.w < 0) { cls = 'g-bad'; lab = L.chosenBad; }
      else if (sel) { cls = 'g-neutral'; lab = L.neutral; }
      else if (o.w > 0) { cls = 'g-miss'; lab = L.missed; }
      else cls = 'g-skip';
      b.classList.add(cls); if (lab) tag.innerHTML = bi(lab);
      b.disabled = false; b.setAttribute('aria-disabled', 'true');
    }

    function grade() {
      var all = [['inv', data.investigations.options], ['mgmt', data.management.options]];
      var max = 0, got = 0, r = { inv: { ok: [], bad: [], miss: [] }, mgmt: { ok: [], bad: [], miss: [] } };
      all.forEach(function (g) {
        g[1].forEach(function (o) {
          var sel = !!st[g[0]][o.id];
          if (o.w > 0) max += o.w;
          if (sel) got += o.w;
          if (sel && o.w > 0) r[g[0]].ok.push(o);
          else if (sel && o.w < 0) r[g[0]].bad.push(o);
          else if (!sel && o.w > 0) r[g[0]].miss.push(o);
        });
      });
      r.score = max ? Math.max(0, Math.min(100, Math.round(got / max * 100))) : 0;
      return r;
    }

    function submit() {
      st.graded = true; st.result = grade();
      saved.attempts = (saved.attempts || 0) + 1;
      saved.best = saved.best == null ? st.result.score : Math.max(saved.best, st.result.score);
      saved.last = { inv: Object.keys(st.inv), mgmt: Object.keys(st.mgmt), score: st.result.score };
      save(st.result.score);
      if (!pv) logPut(data, st.result);
      mount.querySelector('.js-best').textContent = saved.best;
      tabs.unlock('review'); tabs.unlock('discussion'); tabs.done('play');
      tabs.rerender('play'); tabs.rerender('review');
      showPerf();
    }

    function resList(items, cls, ic, withWhy, pre) {
      if (!items.length) return '';
      return items.map(function (o) {
        return '<li class="' + cls + '">' + icon(ic) + '<span>' + (pre ? '<b class="hw-res-p">' + bi(pre) + '</b> ' : '') + bi(o.t) + (withWhy ? '<br><small>' + bi(o.why) + '</small>' : '') + '</span></li>';
      }).join('');
    }
    function groupRes(title, g) {
      var body = resList(g.ok, 'r-ok', 'check') + resList(g.bad, 'r-bad', 'x', true) + resList(g.miss, 'r-miss', 'alert', false, L.missedP);
      return '<div class="hw-res-h">' + bi(title) + '</div><ul class="hw-res">' + (body || '<li>' + bi(L.none) + '</li>') + '</ul>';
    }
    /* performance index: one bar split into correct / incorrect / missed (counts of options) */
    function perfIndex(r) {
      var ok = r.inv.ok.length + r.mgmt.ok.length, bad = r.inv.bad.length + r.mgmt.bad.length, miss = r.inv.miss.length + r.mgmt.miss.length, n = ok + bad + miss;
      function seg(c, k) { return c ? '<i class="pi-' + k + '" style="flex:' + c + '"></i>' : ''; }
      return '<div class="hw-pi"><div class="hw-pi-h"><span>' + bi(L.perfIdx) + '</span><b>' + r.score + ' / 100</b></div>' +
        '<div class="hw-pi-bar" role="img" aria-label="' + H.esc(H.t(L.nOk) + ' ' + ok + ', ' + H.t(L.nBad) + ' ' + bad + ', ' + H.t(L.nMiss) + ' ' + miss) + '">' +
          (n ? seg(ok, 'ok') + seg(bad, 'bad') + seg(miss, 'miss') : '') + '</div>' +
        '<div class="hw-pi-l"><span class="pi-ok">' + bi(L.nOk) + ' <b>' + ok + '</b></span><span class="pi-bad">' + bi(L.nBad) + ' <b>' + bad + '</b></span>' +
          '<span class="pi-miss">' + bi(L.nMiss) + ' <b>' + miss + '</b></span></div></div>';
    }
    function ring(score) {
      var c = score >= 75 ? 'var(--hw-ok)' : score >= 40 ? 'var(--hw-warn)' : 'var(--hw-bad)';
      return '<div class="hw-ring" style="--p:' + score + ';--c:' + c + '"><span>' + score + '</span></div>';
    }
    function showPerf() {
      var r = st.result;
      H.modal({
        title: L.perfT,
        body: '<div class="hw-score">' + ring(r.score) + '<p>' + bi(L.perfNote) + '</p></div>' + perfIndex(r) + groupRes(L.inv, r.inv) + groupRes(L.mgmt, r.mgmt),
        actions: [
          { label: L.close },
          { label: L.feedback, kind: 'accent', onClick: function (c) { c(); tabs.select('review', { focus: true }); } }]
      });
    }

    /* ---------- REVIEW ---------- */
    function renderReview(panel) {
      var rv = data.review || {}, r = st.result;
      var lv = { high: L.lHigh, mid: L.lMid, low: L.lLow };
      panel.innerHTML =
        (r ? '<section class="hw-card"><div class="hw-score" style="margin:0">' + ring(r.score) +
          '<p><b>' + bi(L.yourResult) + '</b><br>' + bi(L.best) + ': ' + saved.best + ' · ' + bi(L.attempts) + ': ' + saved.attempts + '</p></div></section>' : '') +
        '<div class="js-acc"></div>' +
        '<div class="hw-acts"><button type="button" class="hw-btn hw-btn--primary js-retry">' + icon('redo') + bi(L.retry) + '</button></div>';
      /* as in the source app: before restarting from Review, offer the discussion first */
      panel.querySelector('.js-retry').addEventListener('click', function () {
        H.modal({ icon: 'redo', title: L.nextT, body: '<p>' + bi(L.nextB) + '</p>', actions: [
          { label: L.viewDisc, kind: 'primary', onClick: function (c) { c(); tabs.select('discussion', { focus: true }); mount.scrollIntoView({ behavior: 'smooth', block: 'start' }); } },
          { label: L.startAgain, icon: 'redo', onClick: function (c) { c(); retry(); } }] });
        var m = d.querySelectorAll('.hw-modal'); m = m[m.length - 1];
        if (m) { m.classList.add('hw-modal--stack'); var b1 = m.querySelector('.hw-modal-acts .hw-btn--primary'); if (b1) b1.insertAdjacentHTML('afterbegin', CHAT); }
      });
      var invOpts = data.investigations.options, hasRes = invOpts.some(function (o) { return o.r || (o.media && o.media.src); });
      var mine = invOpts.filter(function (o) { return st.inv[o.id]; });
      H.accordion(panel.querySelector('.js-acc'), (hasRes ? [
        { id: 'res', title: L.yourInv, open: true, html: mine.length ? '<ul class="hw-invres">' + mine.map(function (o) {
            return '<li><b>' + bi(o.t) + '</b>' + (resultHtml(o) || '') + '</li>'; }).join('') + '</ul>' : '<p>' + bi(L.noInv) + '</p>' }
      ] : []).concat([
        { id: 'p', title: L.problem, open: true, html: '<p>' + bi(rv.problem) + '</p>' },
        { id: 'd', title: L.ddx, open: true, html: '<div class="hw-ddx">' + (rv.ddx || []).map(function (x) {
            return '<div class="hw-ddx-i l-' + (x.l || 'low') + '"><b>' + bi(x.n) + '<small>' + bi(lv[x.l] || L.lLow) + '</small></b><p>' + bi(x.f) + '</p></div>';
          }).join('') + '</div>' },
        { id: 'vi', title: L.invRev, open: true, html: verdictList('inv', invOpts) },
        { id: 'vm', title: L.mgmtRev, open: true, html: verdictList('mgmt', data.management.options) }
      ]));
    }
    /* every option, numbered, recommended first, with its verdict badge and one-line reason; the student's picks marked */
    function verdictList(group, opts) {
      var list = opts.map(function (o, i) { return { o: o, v: verdict(o), i: i }; }).sort(function (a, b) {
        return (b.o.w - a.o.w) || (VORD.indexOf(a.v) - VORD.indexOf(b.v)) || (a.i - b.i);
      });
      return '<ol class="hw-vl">' + list.map(function (x) {
        var o = x.o, mine = !!st[group][o.id], ok = mine && (o.w > 0 ? 'ok' : o.w < 0 ? 'bad' : 'mid');
        return '<li class="hw-vl-i">' +
          '<div class="hw-vl-h"><b>' + bi(o.t) + '</b><span class="hw-vb vb-' + VERD[x.v] + '">' + bi(L['v_' + x.v]) + '</span>' +
            (mine ? '<span class="hw-vmine vm-' + ok + '">' + icon(o.w < 0 ? 'x' : 'check') + bi(L.youPicked) + '</span>' : '') + '</div>' +
          '<p>' + bi(o.why) + '</p></li>';
      }).join('') + '</ol>';
    }

    /* ---------- DISCUSSION ---------- */
    function why(opts) {
      return '<div class="hw-opts is-graded">' + opts.slice().sort(function (a, b) { return b.w - a.w; }).map(function (o) {
        var cls = o.w > 0 ? 'g-ok' : o.w < 0 ? 'g-bad' : 'g-neutral';
        return '<div class="hw-opt ' + cls + '"><span class="hw-box">' + icon(o.w > 0 ? 'check' : 'x') + '</span><span class="hw-opt-b"><span class="hw-opt-t">' + bi(o.t) + '</span><span class="hw-opt-why">' + bi(o.why) + '</span>' + resultHtml(o) + '</span></div>';
      }).join('') + '</div>';
    }
    /* a text that may hold several paragraphs (blank line between them) in each language */
    function paras(v) {
      if (v == null) return '';
      if (typeof v !== 'object') v = { ar: v, en: v };
      var parts = {}, n = 0;
      H.LANGS.forEach(function (l) { if (v[l] != null) { parts[l] = String(v[l]).split(/\n\s*\n/); n = Math.max(n, parts[l].length); } });
      if (n < 2) return '<p>' + bi(v) + '</p>';
      var out = '';
      for (var i = 0; i < n; i++) {
        var o = {}; H.LANGS.forEach(function (l) { if (parts[l]) o[l] = parts[l][i] || ''; });
        out += '<p>' + bi(o) + '</p>';
      }
      return out;
    }
    function bullets(arr) { return '<ul class="hw-dl">' + arr.map(function (k) { return '<li>' + bi(k) + '</li>'; }).join('') + '</ul>'; }
    function renderDiscussion(panel) {
      var ds = data.discussion || {};
      var dInv = Array.isArray(ds.inv) && ds.inv.length, dMgmt = Array.isArray(ds.mgmt) && ds.mgmt.length;
      /* one way up only: the theme already has its own back-to-top circle; the session ends at the cases hub */
      panel.innerHTML = '<div class="hw-dx"><small>' + bi(L.finalDx) + '</small>' + bi(ds.dx) + '</div><div class="js-acc"></div>' +
        '<div class="hw-acts"><button type="button" class="hw-btn js-retry">' + icon('redo') + bi(L.retry) + '</button>' +
        '<a class="hw-btn hw-btn--primary js-finish" href="' + H.esc(HUB) + '">' + EXIT + bi(L.finish) + '</a></div>' +
        '<p class="hw-note">' + bi(L.eduNote) + '</p>';
      H.accordion(panel.querySelector('.js-acc'), [
        { id: 's', title: L.summary, open: true, html: paras(ds.summary) },
        /* authored teaching bullets when the case has them (v2.2), otherwise the options with their reasons (older cases) */
        { id: 'i', title: dInv ? L.invRev : L.invExp, open: !!dInv, html: dInv ? bullets(ds.inv) : why(data.investigations.options) },
        { id: 'm', title: dMgmt ? L.mgmtRev : L.mgmtExp, open: !!dMgmt, html: dMgmt ? bullets(ds.mgmt) : why(data.management.options) },
        { id: 'k', title: dInv || dMgmt ? L.takeHome : L.keys, open: !!(dInv || dMgmt), html: '<ul>' + (ds.keypoints || []).map(function (k) { return '<li>' + bi(k) + '</li>'; }).join('') + '</ul>' },
        { id: 'r', title: L.refs, html: '<ol class="hw-refs">' + (ds.refs || []).map(function (r) {
            return '<li>' + (r.u ? '<a href="' + H.esc(r.u) + '" target="_blank" rel="noopener">' + H.esc(r.t) + '</a>' : H.esc(r.t)) + '</li>';
          }).join('') + '</ol>' }
      ].concat((function () {
        var links = (ds.links || []).filter(function (x) { return x && safeUrl(x.u); });
        var tags = meta.tags || [];
        if (!links.length && !tags.length) return [];
        return [{ id: 'l', title: L.more, open: true, render: function (b) {
          b.innerHTML = (links.length ? '<ul class="hw-links">' + links.map(function (x) {
              return '<li><a href="' + H.esc(x.u) + '">' + bi(x.t) + '</a></li>'; }).join('') + '</ul>' : '') + '<div class="js-rel"></div>';
          related(b.querySelector('.js-rel'), tags, location.href.split('#')[0].split('?')[0]);
        } }];
      })()), { soft: true });
      panel.querySelector('.js-retry').addEventListener('click', retry);
      /* outside Blogger (encoder preview) there is no hub page: just go back to the top of the case */
      panel.querySelector('.js-finish').addEventListener('click', function (e) {
        if (H.isBlog && H.isBlog()) return;
        e.preventDefault(); mount.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    function retry() {
      st.inv = {}; st.mgmt = {}; st.graded = false; st.result = null;
      saved.last = null; save(null);
      tabs.done('play', false); tabs.lock('review'); tabs.lock('discussion');
      tabs.rerender('review'); tabs.rerender('discussion');
      tabs.select('play'); tabs.rerender('play');
      mount.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (H.boot) H.boot();
})(window, document);
