/*! © 2026 Dr. Hassan Alduvayhi — All rights reserved. Unauthorized copying or reuse is prohibited.
    SHAM Cards: spaced repetition (FSRS-5) for every kind of content on the site | v0.1.0 (ar/en/tr) | requires hawi-core.js v0.5
    Page: <div data-hawi-app="cards"></div>   (tabs: review · mine · browse · stats; data-order works as in the other apps)

    ONE ENGINE, MANY SOURCES. A card is a reference 'source:key'. A source tells the engine what its cards are and how
    they look; the engine schedules them all the same way. Built in: gloss (glossary terms), ecg (32 rhythms, a new strip
    every time), deck (authored decks: hawi-cards-decks.json), log (every mistake in any app, added automatically).
    A future app joins with one call in its own file, and one line in PLUG below:
      Hawi.cards.source('qbank', {
        label: {ar,en,tr},
        need:  function () { return Promise },            // load its data (optional)
        decks: function () { return [{ id, t:{..}, desc:{..}, refs:['qbank:…'] }] },   // what Browse offers (optional)
        card:  function (key, rec) { return { f: html, b: html, u: link?, t: {..} title } or null }
      });
    Schedules live in H.prog('cards') (= account document apps/cards), mistake texts in H.prog('cardz') (apps/cardz);
    day counters in cards:train; settings in cards:pref (this device). */
(function (w, d) {
  'use strict';
  var H = w.Hawi; if (!H || !H.cards || !H.prog) return;
  var C = H.cards, bi = H.bi, icon = H.icon, MIN = 60000, DAY = 86400000;
  function B(ar, en, tr) { return { ar: ar, en: en, tr: tr }; }

  /* =====================================================================
     1. FSRS-5 (same formulas and defaults as ts-fsrs 4.x: retention 0.9, no fuzz, short-term steps)
     ===================================================================== */
  var F = H.fsrs = (function () {
    var W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
    var DECAY = -0.5, FACTOR = 19 / 81, SMIN = 0.01, SMAX = 36500, MAXI = 36500, RET = 0.9;
    function fx(v) { return +v.toFixed(8); }
    function cl(v, a, b) { return Math.min(Math.max(v, a), b); }
    var IM = fx((Math.pow(RET, 1 / DECAY) - 1) / FACTOR);
    function R(t, s) { return fx(Math.pow(1 + FACTOR * t / s, DECAY)); }
    function initS(g) { return Math.max(W[g - 1], 0.1); }
    function cd(x) { return Math.min(Math.max(fx(x), 1), 10); }
    function initD(g) { return cd(W[4] - Math.exp((g - 1) * W[5]) + 1); }
    function ivl(s) { return Math.min(Math.max(1, Math.round(s * IM)), MAXI); }
    function nextD(dd, g) { var nd = dd + fx(-W[6] * (g - 3) * (10 - dd) / 9); return cd(fx(W[7] * initD(4) + (1 - W[7]) * nd)); }
    function recallS(dd, s, r, g) {
      return fx(cl(s * (1 + Math.exp(W[8]) * (11 - dd) * Math.pow(s, -W[9]) * (Math.exp((1 - r) * W[10]) - 1) *
        (g === 2 ? W[15] : 1) * (g === 4 ? W[16] : 1)), SMIN, SMAX));
    }
    function forgetS(dd, s, r) { return fx(cl(W[11] * Math.pow(dd, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]), SMIN, SMAX)); }
    function shortS(s, g) { return fx(cl(s * Math.exp(W[17] * (g - 3 + W[18])), SMIN, SMAX)); }
    /* whole calendar days between two times (UTC dates, as ts-fsrs) */
    function days(a, b) { var x = new Date(a), y = new Date(b); return Math.floor((Date.UTC(y.getUTCFullYear(), y.getUTCMonth(), y.getUTCDate()) - Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate())) / DAY); }
    /* rec {st, s, df, due, lr, n, l} + grade 1..4 at time now -> new rec (copy) with iv = scheduled days (0 = minutes) */
    function next(rec, g, now) {
      var r = {}, k; for (k in rec) r[k] = rec[k];
      var st = rec.st || 0, so = rec.s, dfo = rec.df, t = st && rec.lr ? days(rec.lr, now) : 0;
      r.lr = now; r.n = (rec.n || 0) + 1; r.l = rec.l || 0;
      function at(m, isDay) { r.iv = isDay ? m : 0; r.due = now + m * (isDay ? DAY : MIN); }
      if (!st) {
        r.df = initD(g); r.s = initS(g);
        if (g === 4) { r.st = 2; at(ivl(r.s), 1); } else { r.st = 1; at(g === 1 ? 1 : g === 2 ? 5 : 10); }
      } else if (st === 1 || st === 3) {
        r.df = nextD(dfo, g); r.s = shortS(so, g);
        if (g === 1) at(5); else if (g === 2) at(10);
        else if (g === 3) { r.st = 2; at(ivl(r.s), 1); }
        else { r.st = 2; at(Math.max(ivl(r.s), ivl(shortS(so, 3)) + 1), 1); }
      } else {
        var rr = R(t, so);
        r.df = nextD(dfo, g);
        if (g === 1) {
          r.s = cl(fx(so / Math.exp(W[17] * W[18])), SMIN, forgetS(dfo, so, rr));
          r.st = 3; r.l++; at(5);
        } else {
          var hI = ivl(recallS(dfo, so, rr, 2)), gI = ivl(recallS(dfo, so, rr, 3));
          hI = Math.min(hI, gI); gI = Math.max(gI, hI + 1);
          var eI = Math.max(ivl(recallS(dfo, so, rr, 4)), gI + 1);
          r.s = recallS(dfo, so, rr, g); r.st = 2; at(g === 2 ? hI : g === 3 ? gI : eI, 1);
        }
      }
      return r;
    }
    return { next: next, R: R, days: days, W: W };
  })();

  /* =====================================================================
     2. SOURCES
     ===================================================================== */
  C.src = C.src || {};
  C.source = function (name, def) { def.name = name; C.src[name] = def; };
  /* future sources load their own file on this page: name -> file next to this one (same ?v=) */
  var PLUG = { ecg: 'hawi-ecg.js' };
  function script(file) {
    return new Promise(function (res) {
      var s = d.createElement('script'); s.src = H.base + file + H.ver; s.onload = function () { res(true); }; s.onerror = function () { res(false); };
      (d.body || d.head).appendChild(s);
    });
  }
  var loaded = {};
  function once(k, fn) { return loaded[k] || (loaded[k] = fn()); }
  function wait(test, ms) {
    return new Promise(function (res) { var t0 = Date.now(); (function go() { if (test()) res(true); else if (Date.now() - t0 > (ms || 15000)) res(false); else setTimeout(go, 40); })(); });
  }
  function need(name) { var s = C.src[name]; return s && s.need ? once('need:' + name, s.need) : Promise.resolve(); }
  function split(ref) { var i = ref.indexOf(':'); return i < 0 ? [ref, ''] : [ref.slice(0, i), ref.slice(i + 1)]; }

  var L = {
    title: B('بطاقات شام', 'SHAM Cards', 'SHAM Kartları'),
    sub: B('مراجعة متباعدة تعيد إليك كل بطاقة قبيل أن تنساها.', 'Spaced repetition that brings each card back just before you would forget it.', 'Her kartı unutmak üzereyken önünüze getiren aralıklı tekrar.'),
    review: B('مراجعة اليوم', "Today's review", 'Bugünün tekrarı'), mine: B('بطاقاتي', 'My cards', 'Kartlarım'),
    browse: B('أضف بطاقات', 'Add cards', 'Kart ekle'), stats: B('الإحصاء', 'Statistics', 'İstatistik'),
    loading: B('جارٍ التحميل…', 'Loading…', 'Yükleniyor…'),
    fresh: B('جديدة', 'New', 'Yeni'), learn: B('قيد التعلّم', 'Learning', 'Öğreniliyor'), rev: B('للمراجعة', 'To review', 'Tekrar'),
    show: B('أظهر الجواب', 'Show answer', 'Cevabı göster'),
    g1: B('مرة أخرى', 'Again', 'Tekrar'), g2: B('صعب', 'Hard', 'Zor'), g3: B('جيد', 'Good', 'İyi'), g4: B('سهل', 'Easy', 'Kolay'),
    keys: B('اختصارات: المسافة لإظهار الجواب، و1–4 للتقييم.', 'Shortcuts: Space shows the answer, 1–4 rate it.', 'Kısayollar: Boşluk cevabı gösterir, 1–4 değerlendirir.'),
    doneT: B('أنهيت مراجعة اليوم', "You're done for today", 'Bugünlük bitti'),
    doneP: B('أحسنت. البطاقة التالية مستحقة {w}.', 'Well done. The next card is due {w}.', 'Tebrikler. Sıradaki kart {w} zamanı gelecek.'),
    doneNone: B('أحسنت. لا بطاقات مستحقة الآن.', 'Well done. No cards are due right now.', 'Tebrikler. Şu an zamanı gelen kart yok.'),
    newLeft: B('بقيت {n} بطاقة جديدة لم يحن دورها اليوم (الحد اليومي {m}).', '{n} new cards wait for another day (daily limit {m}).', '{n} yeni kart başka bir günü bekliyor (günlük sınır {m}).'),
    emptyT: B('لا بطاقات بعد', 'No cards yet', 'Henüz kart yok'),
    emptyP: B('أضف رُزماً من تبويب «أضف بطاقات»، أو اضغط «أضف إلى بطاقاتي» في أي تلميح مصطلح. وكل خطأ في الحالات أو تمارين تخطيط القلب يصير بطاقة تلقائياً.',
      'Add decks from the “Add cards” tab, or press “Add to my cards” in any term tooltip. Every mistake in the cases or ECG exercises becomes a card automatically.',
      '“Kart ekle” sekmesinden desteler ekleyin ya da herhangi bir terim ipucunda “Kartlarıma ekle”ye basın. Vakalarda veya EKG alıştırmalarında yaptığınız her hata otomatik olarak karta dönüşür.'),
    goBrowse: B('أضف بطاقات', 'Add cards', 'Kart ekle'),
    in: B('بعد {t}', 'in {t}', '{t} sonra'), now: B('الآن', 'now', 'şimdi'),
    m: B('{n} د', '{n}m', '{n} dk'), h: B('{n} س', '{n}h', '{n} sa'), dd: B('{n} يوم', '{n}d', '{n} gün'),
    mo: B('{n} شهر', '{n}mo', '{n} ay'), y: B('{n} سنة', '{n}y', '{n} yıl'),
    tomorrow: B('غداً', 'tomorrow', 'yarın'),
    whatTerm: B('ما معنى هذا المصطلح؟', 'What does this term mean?', 'Bu terim ne anlama gelir?'),
    whatRhythm: B('ما هذا النظم؟', 'What is this rhythm?', 'Bu ritim nedir?'),
    newStrip: B('في كل مراجعة شريط جديد من النظم نفسه.', 'Each review shows a new strip of the same rhythm.', 'Her tekrarda aynı ritmin yeni bir şeridi gelir.'),
    qMiss: B('ما الخطوة الأساسية التي فاتتك هنا؟', 'Which essential step did you miss here?', 'Burada hangi temel adımı atladınız?'),
    qBad: B('اخترت هنا: «{x}». هل كان اختياراً صحيحاً؟', 'You chose here: “{x}”. Was it a correct choice?', 'Burada şunu seçtiniz: “{x}”. Doğru bir seçim miydi?'),
    aBad: B('لا، كان اختياراً خاطئاً في هذه الحالة. أعد الحالة لترى السبب.', 'No, it was a wrong choice in this case. Retry the case to see why.', 'Hayır, bu vakada yanlış bir seçimdi. Nedenini görmek için vakayı tekrarlayın.'),
    retry: B('أعد المحاولة', 'Try again', 'Tekrar dene'), open: B('افتح المصدر', 'Open the source', 'Kaynağı aç'),
    yourMist: B('من أخطائك', 'From your mistakes', 'Hatalarınızdan'),
    cards: B('بطاقة', 'cards', 'kart'), added: B('أُضيف {h} من {n}', '{h} of {n} added', '{n} karttan {h} eklendi'),
    addAll: B('أضف الرزمة', 'Add deck', 'Desteyi ekle'), addRest: B('أضف الباقي', 'Add the rest', 'Kalanları ekle'),
    removeAll: B('احذف الرزمة', 'Remove deck', 'Desteyi kaldır'),
    removeQ: B('ستُحذف بطاقات هذه الرزمة من مراجعتك (يبقى سجلها إن أضفتها لاحقاً). متابعة؟', 'This removes the deck’s cards from your reviews (their history is kept if you add them again). Continue?', 'Bu destenin kartları tekrarlarınızdan kaldırılır (yeniden eklerseniz geçmişleri korunur). Devam edilsin mi?'),
    cancel: B('إلغاء', 'Cancel', 'İptal'), remove: B('احذف', 'Remove', 'Kaldır'),
    autoDeck: B('أخطائي', 'My mistakes', 'Hatalarım'),
    autoDesc: B('تُضاف تلقائياً من كل الأقسام. الخطأ المتكرر يعود للمراجعة فوراً.', 'Added automatically from every section. A repeated mistake comes back for review at once.', 'Her bölümden otomatik eklenir. Tekrarlanan hata hemen tekrara döner.'),
    mineEmpty: B('لا بطاقات في هذا القسم.', 'No cards in this section.', 'Bu bölümde kart yok.'),
    more: B('اعرض المزيد', 'Show more', 'Daha fazla göster'),
    st0: B('جديدة', 'new', 'yeni'), st1: B('تعلّم', 'learning', 'öğrenme'),
    st2: B('مراجعة', 'review', 'tekrar'), st3: B('إعادة تعلّم', 'relearning', 'yeniden öğrenme'),
    today: B('اليوم', 'Today', 'Bugün'), reviewed: B('مراجعة', 'reviews', 'tekrar'),
    retention: B('نسبة التذكّر (30 يوماً)', 'Recall rate (30 days)', 'Hatırlama oranı (30 gün)'),
    streak: B('أيام متتالية', 'day streak', 'günlük seri'), bestStreak: B('أطول سلسلة', 'longest streak', 'en uzun seri'),
    total: B('كل البطاقات', 'All cards', 'Tüm kartlar'), mature: B('راسخة (21 يوماً فأكثر)', 'Mature (21+ days)', 'Oturmuş (21+ gün)'),
    forecast: B('المستحق في الأيام السبعة القادمة', 'Due in the next 7 days', 'Önümüzdeki 7 günde zamanı gelecek'),
    settings: B('الإعدادات', 'Settings', 'Ayarlar'),
    perDay: B('البطاقات الجديدة في اليوم', 'New cards per day', 'Günlük yeni kart'),
    auto: B('حوّل أخطائي إلى بطاقات تلقائياً', 'Turn my mistakes into cards automatically', 'Hatalarımı otomatik olarak karta dönüştür'),
    devNote: B('الإعدادات تخص هذا الجهاز؛ البطاقات ومواعيدها تُحفظ في حسابك إن سجّلت الدخول.', 'Settings apply to this device; your cards and their schedule are saved to your account when you sign in.', 'Ayarlar bu cihaza özeldir; giriş yaptığınızda kartlarınız ve takvimleri hesabınıza kaydedilir.'),
    days7: [B('اليوم', 'Today', 'Bugün'), B('غداً', 'Tomorrow', 'Yarın')],
    dayN: B('+{n}', '+{n}', '+{n}')
  };
  function T(v, o) { var s = H.t(v); if (o) for (var k in o) s = s.split('{' + k + '}').join(o[k]); return s; }
  /* text in a given language l (to build the three language spans of one value) */
  function Tl(v, l, o) { var s = v[l] != null && v[l] !== '' ? v[l] : v.en; if (o) for (var k in o) s = s.split('{' + k + '}').join(o[k]); return s; }
  function each(fn) { var o = {}; H.LANGS.forEach(function (l) { o[l] = fn(l); }); return o; }
  /* the same template in all three languages (one span per language) */
  function biF(v, o) {
    var out = {}; H.LANGS.forEach(function (l) { var s = v[l] != null ? v[l] : v.en; for (var k in o || {}) { var x = o[k]; s = s.split('{' + k + '}').join(typeof x === 'object' && x ? (x[l] != null ? x[l] : x.en) : x); } out[l] = s; });
    return bi(out);
  }

  /* ---------- gloss: glossary terms (hawi-tt.js loads the glossary) ---------- */
  var G = null;
  C.source('gloss', {
    label: B('المسرد', 'Glossary', 'Sözlük'),
    need: function () {
      H.needTT();
      return wait(function () { return !!H.gloss; }).then(function () { return H.gloss ? H.gloss() : { k: {} }; }).then(function (g) { G = g; });
    },
    decks: function () {
      var ks = Object.keys((G && G.k) || {});
      return ks.length ? [{ id: 'gloss', t: B('مصطلحات المسرد', 'Glossary terms', 'Sözlük terimleri'),
        desc: B('كل مصطلح في المسرد: الاسم في الوجه، والتعريف في الظهر.', 'Every glossary term: the name on the front, the definition on the back.', 'Sözlükteki her terim: önde adı, arkada tanımı.'),
        refs: ks.map(function (k) { return 'gloss:' + k; }) }] : [];
    },
    card: function (k) {
      var x = G && G.k[k]; if (!x) return null;
      return { t: x.n, f: '<div class="hwc-big">' + bi(x.n) + '</div><p class="hwc-q">' + bi(L.whatTerm) + '</p>',
        b: '<div class="hwc-big hwc-big--sm">' + bi(x.n) + '</div><p class="hwc-txt">' + bi(x.d) + '</p>' };
    }
  });

  /* ---------- ecg: the 32 library rhythms, a fresh valid variant at every review ---------- */
  var ED = null, EC = null, ECG_CSS = '.hwc .ecg-paper{overflow-x:auto;-webkit-overflow-scrolling:touch;background:#fff7f6;border-radius:10px;margin:0 0 12px}' +
    '.hwc .ecg-paper svg{display:block;min-width:620px;width:100%;height:auto}' +
    '.hwc .ecg-pbg{fill:#fff7f6}.hwc .ecg-g1{stroke:#f6c9c4;stroke-width:.06}.hwc .ecg-g5{stroke:#ec9a92;stroke-width:.16}' +
    '.hwc .ecg-paper .ecg-g1,.hwc .ecg-paper .ecg-g5,.hwc .ecg-paper .ecg-trace{fill:none!important}' +
    '.hwc .ecg-trace{fill:none;stroke:#14212b;stroke-width:.32;stroke-linejoin:round;stroke-linecap:round}' +
    '.hwc .ecg-lead{font:700 3px sans-serif;fill:#14212b}';
  function ecgLoad(cases) {
    return once('ecg:' + (cases ? 'c' : 'd'), function () {
      var jobs = [w.HawiEcgData ? Promise.resolve() : script('hawi-ecg-data.js'), H.ecg && H.ecg.paper ? Promise.resolve() : script(PLUG.ecg)];
      if (cases) jobs.push(w.HawiEcgCases ? Promise.resolve() : script('hawi-ecg-cases.js'));
      return Promise.all(jobs).then(function () {
        try { ED = ED || H.decode(w.HawiEcgData || ''); } catch (e) { ED = null; }
        if (cases) try { EC = EC || H.decode(w.HawiEcgCases || ''); } catch (e) { EC = null; }
      });
    });
  }
  function ecgItem(id) { return ED && ED.items.filter(function (x) { return x.id === id; })[0]; }
  function strip(spec, seed) { try { return H.ecg.paper(spec, { seconds: 6, seed: seed }); } catch (e) { return ''; } }
  C.source('ecg', {
    label: B('تخطيط القلب', 'ECG', 'EKG'),
    need: function () { return ecgLoad(false); },
    decks: function () {
      if (!ED) return [];
      return ED.groups.map(function (g) {
        return { id: 'ecg-' + g.id, t: biObj(B('نُظم: ', 'Rhythms: ', 'Ritimler: '), g.name),
          desc: B('شريط مولَّد جديد في الوجه، والنظم وصفاته في الظهر.', 'A newly generated strip on the front; the rhythm and its features on the back.', 'Önde yeni üretilmiş bir şerit; arkada ritim ve özellikleri.'),
          refs: ED.items.filter(function (x) { return x.group === g.id; }).map(function (x) { return 'ecg:' + x.id; }) };
      });
    },
    card: function (k) {
      var x = ecgItem(k); if (!x || !H.ecg) return null;
      var v = H.ecg.variant ? H.ecg.variant(x, Math.random) : { strip: x.strip }, f = x.f || {}, EL = H.ecg.L || {};
      return { t: x.name, f: strip(v.strip, v.seed) + '<p class="hwc-q">' + bi(L.whatRhythm) + '</p><p class="hwc-note">' + bi(L.newStrip) + '</p>',
        b: strip(v.strip, v.seed) + '<div class="hwc-big hwc-big--sm">' + bi(x.name) + '</div><dl class="hwc-dl">' + ['rate', 'rhythm', 'p', 'pr', 'qrs', 'rel'].filter(function (q) { return f[q]; }).map(function (q) {
          return '<dt>' + bi(EL[q] || q) + '</dt><dd>' + bi(f[q]) + '</dd>'; }).join('') + '</dl>',
        u: '/p/ecg-academy.html#library/' + encodeURIComponent(x.id) };
    }
  });
  function biObj(pre, name) { var o = {}; H.LANGS.forEach(function (l) { o[l] = (pre[l] || pre.en) + (name[l] || name.en); }); return o; }

  /* ---------- deck: authored decks, hawi-cards-decks.json {d:'HW1…'} -> {v, decks:[{id, t, desc, c:[{k, f, b}]}]} ---------- */
  var DK = null;
  C.source('deck', {
    label: B('الرُّزم', 'Decks', 'Desteler'),
    need: function () {
      return fetch(H.base + 'hawi-cards-decks.json' + H.ver).then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function (j) { DK = H.decode(j.d); }).catch(function () { DK = { decks: [] }; });
    },
    decks: function () {
      return ((DK && DK.decks) || []).map(function (k) { return { id: 'deck-' + k.id, t: k.t, desc: k.desc, refs: (k.c || []).map(function (c) { return 'deck:' + k.id + ':' + c.k; }) }; });
    },
    card: function (key) {
      var p = key.split(':'), dk = DK && DK.decks.filter(function (x) { return x.id === p[0]; })[0], c = dk && (dk.c || []).filter(function (x) { return x.k === p[1]; })[0];
      if (!c) return null;
      return { t: c.f, f: '<div class="hwc-mid">' + bi(c.f) + '</div>', b: '<div class="hwc-mid hwc-q">' + bi(c.f) + '</div><hr class="hwc-hr"><div class="hwc-txt">' + bi(c.b) + '</div>' };
    }
  });

  /* ---------- log: mistakes from any app (content is the snapshot kept in the card) ---------- */
  var APPN = { 'case': B('الحالات السريرية', 'Clinical Cases', 'Klinik Vakalar'), ecg: B('أكاديمية تخطيط القلب', 'ECG Academy', 'EKG Akademisi') };
  function okUrl(u) { u = String(u || ''); return /^https:\/\//i.test(u) || /^\/[^\/]/.test(u) ? u : ''; }
  C.source('log', {
    label: L.yourMist,
    need: function () {
      /* ECG mistakes show the case strip when the ECG files load */
      var all = C.p().all(), ecg = Object.keys(all).some(function (k) { return k.indexOf('log:ecg:') === 0 && !all[k].x; });
      return ecg ? ecgLoad(true) : Promise.resolve();
    },
    decks: function () {
      var all = C.p().all(), refs = Object.keys(all).filter(function (k) { return k.indexOf('log:') === 0; });
      return refs.length ? [{ id: 'log', auto: 1, t: L.autoDeck, desc: L.autoDesc, refs: refs }] : [];
    },
    card: function (key) {
      /* key = <app>:<item>:<ref> ; text from the snapshot, title and link from the app's own progress */
      var z = C.z('log:' + key); if (!z) return null;
      var ps = key.split(':'), app = ps[0], step = ps.pop(), it = ps.slice(1).join(':'), pr = H.prog(app).get(it) || {};
      z = { app: app, it: it, k: z.k, x: z.x, d: z.d, t: pr.t, u: pr.u };
      var head = '<p class="hwc-ctx"><span class="hwc-app">' + bi(APPN[z.app] || L.yourMist) + '</span>' + bi(z.t || z.it) + '</p>', f, b, sp = '';
      if (z.app === 'ecg' && EC && H.ecg) {
        var c = EC.cases.filter(function (x) { return x.id === z.it; })[0], cl = H.ecg.CL || {};
        if (c) sp = strip(c.strip, c.seed);
        f = head + sp + '<p class="hwc-q">' + bi((cl.q || {})[step] || L.qMiss) + '</p>';
        b = head + sp + '<p class="hwc-txt">' + bi(z.x) + '</p>';
      } else if (z.k === 'bad') {
        f = head + '<p class="hwc-q">' + biF(L.qBad, { x: z.x || '' }) + '</p>';
        b = head + '<p class="hwc-q">' + biF(L.qBad, { x: z.x || '' }) + '</p><p class="hwc-txt hwc-no">' + bi(L.aBad) + '</p>';
      } else {
        f = head + '<p class="hwc-q">' + bi(z.k === 'step' ? B('ما الخطوة التي أخطأت فيها؟', 'Which step did you get wrong?', 'Hangi adımda yanıldınız?') : L.qMiss) + '</p>';
        b = head + '<p class="hwc-txt">' + bi(z.x) + '</p>';
      }
      return { t: z.t || z.it, f: f, b: b, u: okUrl(z.u), retry: 1 };
    }
  });

  /* =====================================================================
     3. QUEUE, ANSWERS, DAY COUNTERS
     ===================================================================== */
  function dayKey(t) { var x = new Date((t || Date.now()) - 4 * 3600000); return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); }
  /* cards:train {s:{'YYYY-MM-DD':[good, total], 'n:YYYY-MM-DD':[new seen, 0]}, best: longest streak} (merge: per key the larger) */
  function tr() { var x = H.store.get('cards:train', null); return x && x.s ? x : { s: {}, best: 0 }; }
  function bump(rec, g) {
    var x = tr(), k = dayKey(), v = x.s[k] || [0, 0];
    if (rec.st) x.s[k] = [v[0] + (g > 1 ? 1 : 0), v[1] + 1]; else { var nk = 'n:' + k, n = x.s[nk] || [0, 0]; x.s[nk] = [n[0] + 1, 0]; x.s[k] = [v[0] + (g > 1 ? 1 : 0), v[1] + 1]; }
    x.best = Math.max(x.best || 0, streak(x));
    H.store.set('cards:train', x);
  }
  function streak(x) {
    var n = 0, t = Date.now();
    if (!(x.s[dayKey(t)] || [0, 0])[1]) t -= DAY; /* today not started yet: the streak still counts until tonight */
    while ((x.s[dayKey(t)] || [0, 0])[1] > 0) { n++; t -= DAY; }
    return n;
  }
  function newToday() { return (tr().s['n:' + dayKey()] || [0])[0]; }
  /* the queue: learning due now · reviews due today · new (daily limit) · learning a little ahead */
  function queue(now) {
    now = now || Date.now();
    var all = C.p().all(), end = C.dayEnd(now), lq = [], rq = [], nq = [], ahead = [];
    Object.keys(all).forEach(function (ref) {
      var r = all[ref]; if (!r || r.x || !C.src[split(ref)[0]]) return;
      if (!r.st) nq.push(ref);
      else if (r.st === 2) { if (r.due < end) rq.push(ref); }
      else if (r.due <= now) lq.push(ref); else if (r.due <= now + 20 * MIN) ahead.push(ref);
    });
    function by(f) { return function (a, b) { return all[a][f] - all[b][f]; }; }
    lq.sort(by('due')); rq.sort(by('due')); ahead.sort(by('due')); nq.sort(function (a, b) { return (all[a].add || 0) - (all[b].add || 0) || (a < b ? -1 : 1); });
    var left = Math.max(0, C.pref().perDay - newToday()), nShow = nq.slice(0, left);
    return { list: lq.concat(rq, nShow, ahead), n: { fresh: nShow.length, learn: lq.length + ahead.length, rev: rq.length }, waiting: nq.length - nShow.length };
  }
  C.queue = queue;
  C.answer = function (ref, g, now) {
    now = now || Date.now();
    var P = C.p(), r = P.get(ref); if (!r) return null;
    bump(r, g);
    var nx = F.next(r, g, now); delete nx.iv; delete nx.at;
    return P.set(ref, nx);
  };
  function span(ms, l) {
    var m = Math.round(ms / MIN);
    if (m < 1) return Tl(L.now, l);
    if (m < 60) return Tl(L.m, l, { n: m });
    if (m < 1440) return Tl(L.h, l, { n: Math.round(m / 60) });
    var dd = Math.round(ms / DAY);
    if (dd < 30) return Tl(L.dd, l, { n: dd });
    if (dd < 365) return Tl(L.mo, l, { n: +(dd / 30).toFixed(dd < 60 ? 1 : 0) });
    return Tl(L.y, l, { n: +(dd / 365).toFixed(1) });
  }
  function spanBi(ms) { return bi(each(function (l) { return span(ms, l); })); }
  /* when a card is due: now · tomorrow · in 3d */
  function whenObj(due) {
    var ms = due - Date.now(), tm = due >= C.dayEnd() && due < C.dayEnd() + DAY && ms > 3 * 3600000;
    return each(function (l) { return ms <= 0 ? Tl(L.now, l) : tm ? Tl(L.tomorrow, l) : Tl(L.in, l, { t: span(ms, l) }); });
  }
  function whenBi(due) { return bi(whenObj(due)); }

  /* =====================================================================
     4. UI
     ===================================================================== */
  var CSS = '.hwc{--hwc-new:#2f6fd0;--hwc-learn:#c4352b;--hwc-rev:#178a4c}.drK .hwc{--hwc-new:#7fb0ff;--hwc-learn:#ff8a80;--hwc-rev:#5fd39a}' +
    '.hwc .hw-card{margin:12px 0}' +
    '.hwc-head p{margin:4px 0 0;color:var(--hw-muted);font-size:14px;line-height:1.7}' +
    '.hwc-cnt{display:flex;justify-content:center;gap:18px;margin:4px 0 10px;font-size:14px;font-weight:700}' +
    '.hwc-cnt span{display:inline-flex;align-items:baseline;gap:5px}.hwc-cnt b{font-size:18px}' +
    '.hwc-cnt .c-n{color:var(--hwc-new)}.hwc-cnt .c-l{color:var(--hwc-learn)}.hwc-cnt .c-r{color:var(--hwc-rev)}' +
    '.hwc-cnt .is-cur{text-decoration:underline;text-underline-offset:4px}' +
    '.hwc-card{min-height:190px;display:flex;flex-direction:column;justify-content:center;text-align:center;padding:18px 16px;border:1px solid var(--hw-line);border-radius:var(--hw-radius,14px);background:var(--hw-bg)}' +
    '.hwc-card .ecg-paper{text-align:start}' +
    '.hwc-big{font-size:24px;font-weight:800;line-height:1.45;color:var(--hw-accent-ink)}.hwc-big--sm{font-size:19px;margin-bottom:6px}' +
    '.hwc-mid{font-size:18px;font-weight:700;line-height:1.7}' +
    '.hwc-q{margin:10px 0 0;font-size:15.5px;font-weight:700;line-height:1.7}' +
    '.hwc-txt{margin:10px 0 0;font-size:15.5px;line-height:1.85;text-align:start}' +
    '.hwc-no{color:var(--hw-bad)}' +
    '.hwc-note{margin:6px 0 0;font-size:12.5px;color:var(--hw-muted)}' +
    '.hwc-hr{border:0;border-top:1px solid var(--hw-line);margin:14px 0 4px}' +
    '.hwc-ctx{margin:0 0 10px;font-size:14px;font-weight:700;line-height:1.7}' +
    '.hwc-app{display:block;font-size:12.5px;font-weight:500;color:var(--hw-accent-ink);opacity:.8;margin:0 0 3px;line-height:1.5}' +
    '.hwc-src{display:inline-block;font-size:11.5px;font-weight:700;padding:1px 9px;border-radius:999px;background:var(--hw-accent-soft);color:var(--hw-accent-ink);margin-inline-end:6px;vertical-align:middle}' +
    '.hwc-top{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:0 0 8px;min-height:24px}' +
    '.hwc-top a{font-size:13px;font-weight:700;color:var(--hw-accent-ink)}' +
    '.hwc-dl{display:grid;grid-template-columns:minmax(92px,34%) 1fr;margin:10px 0 0;border:1px solid var(--hw-line);border-radius:12px;overflow:hidden;text-align:start}' +
    '.hwc-dl dt,.hwc-dl dd{margin:0;padding:8px 10px;border-bottom:1px solid var(--hw-line);font-size:14px;line-height:1.6}' +
    '.hwc-dl dt{font-weight:700;background:var(--hw-bg-soft);color:var(--hw-accent-ink)}.hwc-dl dt:last-of-type,.hwc-dl dd:last-of-type{border-bottom:0}' +
    '.hwc-acts{display:flex;justify-content:center;gap:8px;margin:14px 0 0;flex-wrap:wrap}' +
    '.hwc-show{min-width:220px;min-height:48px}' +
    '.hwc-gr{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0 0}' +
    '.hwc-g{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:58px;padding:6px 4px;border:1px solid var(--hw-line);border-radius:12px;background:var(--hw-bg);color:var(--hw-ink);font:inherit;font-size:14px;font-weight:800;cursor:pointer}' +
    '.hwc-g small{font-size:12px;font-weight:600;color:var(--hw-muted)}' +
    '.hwc-g:hover{border-color:currentColor}' +
    '.hwc-g1{color:var(--hw-bad)}.hwc-g2{color:var(--hw-warn)}.hwc-g3{color:var(--hw-ok)}.hwc-g4{color:var(--hwc-new)}' +
    '.hwc-keys{margin:10px 0 0;text-align:center;font-size:12px;color:var(--hw-muted)}' +
    '@media (hover:none){.hwc-keys{display:none}}' +
    '.hwc-done{text-align:center}.hwc-done h3{margin:0 0 6px}.hwc-done p{margin:4px 0;color:var(--hw-muted);line-height:1.7}' +
    '.hwc-decks{display:grid;gap:10px;margin:10px 0 0}' +
    '.hwc-deck{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--hw-line);border-radius:14px;background:var(--hw-bg)}' +
    '.hwc-deck>div{flex:1;min-width:0}.hwc-deck b{display:block;font-size:15px;line-height:1.5}' +
    '.hwc-deck p{margin:2px 0 0;font-size:13px;line-height:1.6;color:var(--hw-muted)}' +
    '.hwc-deck small{display:block;margin-top:4px;font-size:12.5px;font-weight:700;color:var(--hw-accent-ink)}' +
    '.hwc-deck .hw-btn{flex:0 0 auto;min-height:38px;padding:6px 14px;font-size:13.5px}' +
    '.hwc .hwc-sec,.hwc .hw-card .hwc-sec{margin:18px 0 6px;font-size:15px;line-height:1.5;font-weight:800}' +
    '.hwc-list{list-style:none;margin:0;padding:0}' +
    '.hwc-list li{display:flex;align-items:center;gap:10px;margin:0;padding:9px 2px;border-bottom:1px solid var(--hw-line);list-style:none;font-size:14px;line-height:1.5}' +
    '.hwc-list li::before,.hwc-list li::marker{content:none}' +
    '.hwc-list li>span{flex:1;min-width:0;overflow-wrap:anywhere}' +
    '.hwc-list small{color:var(--hw-muted);font-size:12px;white-space:nowrap}' +
    '.hwc-x{flex:0 0 auto;width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:50%;background:var(--hw-bg-soft);color:var(--hw-muted);cursor:pointer;padding:0}' +
    '.hwc-x svg{width:15px;height:15px;fill:none!important}' +
    '.hwc-st{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}' +
    '.hwc-st div{padding:12px 8px;border:1px solid var(--hw-line);border-radius:12px;text-align:center;font-size:12.5px;color:var(--hw-muted);line-height:1.4}' +
    '.hwc-st b{display:block;font-size:21px;color:var(--hw-ink)}' +
    '.hwc-fc{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;align-items:end;height:120px;margin:10px 0 0}' +
    '.hwc-fc div{display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;font-size:11.5px;color:var(--hw-muted)}' +
    '.hwc-fc i{display:block;width:100%;max-width:34px;min-height:2px;border-radius:6px 6px 2px 2px;background:var(--hw-accent)}' +
    '.hwc-fc b{font-size:12px;color:var(--hw-ink)}' +
    '.hwc-set{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--hw-line);font-size:14.5px}' +
    '.hwc-set select{font:inherit;padding:6px 10px;border:1px solid var(--hw-line);border-radius:10px;background:var(--hw-bg);color:var(--hw-ink)}' +
    '.hwc-set input{width:20px;height:20px;accent-color:var(--hw-accent)}' +
    '.hwc-small{font-size:12.5px;color:var(--hw-muted);margin:10px 0 0;line-height:1.6}' + ECG_CSS;
  function inject() { if (d.getElementById('hwc-css')) return; var st = d.createElement('style'); st.id = 'hwc-css'; st.textContent = CSS; d.head.appendChild(st); }

  function needAll() {
    var all = C.p().all(), want = {};
    Object.keys(all).forEach(function (r) { if (!all[r].x) want[split(r)[0]] = 1; });
    return Promise.all(Object.keys(want).filter(function (s) { return C.src[s]; }).map(need));
  }
  function render(ref, rec) {
    var p = split(ref), s = C.src[p[0]]; if (!s) return null;
    try { return s.card(p[1], rec || C.get(ref)); } catch (e) { return null; }
  }
  function plain(v) { return String(H.t(v) || '').replace(/\*\*/g, '').replace(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, '$1'); }

  /* ---------- review tab ---------- */
  function reviewTab(p, app) {
    var cur = null, shown = false, view = null;
    function counts(q) {
      var k = cur ? C.get(cur) : null, c = k ? (!k.st ? 'n' : k.st === 2 ? 'r' : 'l') : '';
      return '<div class="hwc-cnt" aria-live="polite"><span class="c-n' + (c === 'n' ? ' is-cur' : '') + '"><b>' + q.n.fresh + '</b>' + bi(L.fresh) + '</span>' +
        '<span class="c-l' + (c === 'l' ? ' is-cur' : '') + '"><b>' + q.n.learn + '</b>' + bi(L.learn) + '</span>' +
        '<span class="c-r' + (c === 'r' ? ' is-cur' : '') + '"><b>' + q.n.rev + '</b>' + bi(L.rev) + '</span></div>';
    }
    function draw() {
      var q = queue(), all = C.p().all(), active = Object.keys(all).filter(function (k) { return !all[k].x; });
      if (!active.length) {
        p.innerHTML = '<section class="hw-card hwc-done"><h3>' + bi(L.emptyT) + '</h3><p>' + bi(L.emptyP) + '</p><div class="hwc-acts"><button type="button" class="hw-btn hw-btn--accent js-go">' + bi(L.goBrowse) + '</button></div></section>';
        p.querySelector('.js-go').addEventListener('click', function () { app.go('browse'); });
        cur = null; return;
      }
      /* first card whose source can show it (skip ones whose source did not load) */
      cur = null; view = null;
      for (var i = 0; i < q.list.length; i++) { var v = render(q.list[i]); if (v) { cur = q.list[i]; view = v; break; } }
      if (!cur) {
        var nx = active.map(function (k) { return all[k]; }).filter(function (r) { return r.st; }).sort(function (a, b) { return a.due - b.due; })[0];
        p.innerHTML = '<section class="hw-card hwc-done"><h3>' + bi(L.doneT) + '</h3><p>' + (nx ? biF(L.doneP, { w: whenObj(nx.due) }) : bi(L.doneNone)) + '</p>' +
          (q.waiting ? '<p>' + biF(L.newLeft, { n: q.waiting, m: C.pref().perDay }) + '</p>' : '') +
          '<div class="hwc-acts"><button type="button" class="hw-btn js-go">' + bi(L.goBrowse) + '</button></div></section>';
        p.querySelector('.js-go').addEventListener('click', function () { app.go('browse'); });
        return;
      }
      shown = false; paint(q);
    }
    function paint(q) {
      var rec = C.get(cur), src = C.src[split(cur)[0]], now = Date.now();
      var link = view.u ? '<a href="' + H.esc(view.u) + '">' + bi(view.retry ? L.retry : L.open) + '</a>' : '';
      var html = counts(q) + '<section class="hwc-card">' +
        '<div class="hwc-top"><span class="hwc-src">' + bi(src.label) + '</span>' + (shown ? link : '') + '</div>' +
        '<div class="hwc-face">' + (shown ? view.b : view.f) + '</div></section>';
      if (!shown) html += '<div class="hwc-acts"><button type="button" class="hw-btn hw-btn--accent hwc-show js-show">' + bi(L.show) + '</button></div>';
      else html += '<div class="hwc-gr" role="group">' + [1, 2, 3, 4].map(function (g) {
        var nx = F.next(rec, g, now);
        return '<button type="button" class="hwc-g hwc-g' + g + '" data-g="' + g + '"><span>' + bi(L['g' + g]) + '</span><small>' + spanBi(nx.due - now) + '</small></button>';
      }).join('') + '</div>';
      html += '<p class="hwc-keys">' + bi(L.keys) + '</p>';
      p.innerHTML = html;
      var sb = p.querySelector('.js-show'); if (sb) sb.addEventListener('click', reveal);
      p.querySelectorAll('.hwc-g').forEach(function (b) { b.addEventListener('click', function () { rate(+b.getAttribute('data-g')); }); });
    }
    function reveal() { if (!cur || shown) return; shown = true; paint(queue()); var g = p.querySelector('.hwc-g3'); if (g) g.focus({ preventScroll: true }); }
    function rate(g) { if (!cur || !shown) return; C.answer(cur, g); app.dirty(); draw(); var t = p.querySelector('.js-show'); if (t) t.focus({ preventScroll: true }); }
    d.addEventListener('keydown', function (e) {
      if (p.hidden || !cur || e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (!shown && (e.key === ' ' || e.key === 'Enter') && (!t || !t.closest || !t.closest('a,button:not(.js-show)'))) { e.preventDefault(); reveal(); }
      else if (shown && /^[1-4]$/.test(e.key)) { e.preventDefault(); rate(+e.key); }
    });
    draw();
    return { draw: draw };
  }

  /* ---------- browse tab: decks of every source ---------- */
  function browseTab(p, app) {
    function draw() {
      var all = C.p().all(), html = '';
      Object.keys(C.src).forEach(function (name) {
        var s = C.src[name], ds = []; try { ds = s.decks ? s.decks() || [] : []; } catch (e) { ds = []; }
        if (!ds.length) return;
        /* one description for the whole source when all its decks share it (e.g. the 8 ECG groups) */
        var one = ds.length > 1 && ds.every(function (k) { return k.desc && ds[0].desc && H.t(k.desc) === H.t(ds[0].desc); }) ? ds[0].desc : null;
        html += '<h3 class="hwc-sec">' + bi(s.label) + '</h3>' + (one ? '<p class="hwc-small" style="margin:0">' + bi(one) + '</p>' : '') + '<div class="hwc-decks">' + ds.map(function (k) {
          var have = k.refs.filter(function (r) { return all[r] && !all[r].x; }).length, n = k.refs.length;
          var btn = k.auto ? '' : have < n
            ? '<button type="button" class="hw-btn hw-btn--accent js-add" data-s="' + name + '" data-k="' + H.esc(k.id) + '">' + bi(have ? L.addRest : L.addAll) + '</button>'
            : '<button type="button" class="hw-btn js-rm" data-s="' + name + '" data-k="' + H.esc(k.id) + '">' + bi(L.removeAll) + '</button>';
          return '<div class="hwc-deck"><div><b>' + bi(k.t) + '</b>' + (k.desc && !one ? '<p>' + bi(k.desc) + '</p>' : '') +
            '<small>' + (k.auto ? have + ' ' + bi(L.cards) : biF(L.added, { h: have, n: n })) + '</small></div>' + btn + '</div>';
        }).join('') + '</div>';
      });
      p.innerHTML = html || '<p class="hwc-small">' + bi(L.loading) + '</p>';
      function deck(b) { var s = C.src[b.getAttribute('data-s')], id = b.getAttribute('data-k'); return (s.decks() || []).filter(function (k) { return k.id === id; })[0]; }
      p.querySelectorAll('.js-add').forEach(function (b) { b.addEventListener('click', function () {
        var k = deck(b); if (!k) return; k.refs.forEach(function (r) { C.add(r, { how: 'deck' }); }); app.dirty(); draw();
      }); });
      p.querySelectorAll('.js-rm').forEach(function (b) { b.addEventListener('click', function () {
        var k = deck(b); if (!k) return;
        H.modal({ icon: 'alert', title: L.removeAll, body: '<p>' + bi(L.removeQ) + '</p>', actions: [{ label: L.cancel },
          { label: L.remove, kind: 'danger', onClick: function (c) { k.refs.forEach(function (r) { C.off(r); }); c(); app.dirty(); draw(); } }] });
      }); });
    }
    draw();
    return { draw: draw };
  }

  /* ---------- my cards: per source, with state, due time and remove ---------- */
  function mineTab(p, app) {
    var limit = {};
    function draw() {
      var all = C.p().all(), by = {};
      Object.keys(all).forEach(function (r) { if (all[r].x) return; var s = split(r)[0]; (by[s] = by[s] || []).push(r); });
      var names = Object.keys(C.src).filter(function (s) { return by[s]; });
      if (!names.length) { p.innerHTML = '<p class="hwc-small">' + bi(L.mineEmpty) + '</p>'; return; }
      p.innerHTML = names.map(function (s) {
        var refs = by[s].sort(function (a, b) { return (all[a].st ? all[a].due : 0) - (all[b].st ? all[b].due : 0); }), max = limit[s] || 40;
        return '<h3 class="hwc-sec">' + bi(C.src[s].label) + ' <small>(' + refs.length + ')</small></h3><ul class="hwc-list">' + refs.slice(0, max).map(function (r) {
          var rec = all[r], v = render(r, rec), t = v && v.t ? bi(v.t) : H.esc(split(r)[1]);
          return '<li><span>' + t + '</span><small>' + bi(L['st' + (rec.st || 0)]) + (rec.st ? ' · ' + whenBi(rec.due) : '') + '</small>' +
            '<button type="button" class="hwc-x" data-r="' + H.esc(r) + '" aria-label="' + H.esc(T(L.remove)) + '" title="' + H.esc(T(L.remove)) + '">' + icon('x') + '</button></li>';
        }).join('') + '</ul>' + (refs.length > max ? '<div class="hwc-acts"><button type="button" class="hw-btn js-more" data-s="' + s + '">' + bi(L.more) + '</button></div>' : '');
      }).join('');
      p.querySelectorAll('.hwc-x').forEach(function (b) { b.addEventListener('click', function () { C.off(b.getAttribute('data-r')); app.dirty(); draw(); }); });
      p.querySelectorAll('.js-more').forEach(function (b) { b.addEventListener('click', function () { var s = b.getAttribute('data-s'); limit[s] = (limit[s] || 40) + 100; draw(); }); });
    }
    draw();
    return { draw: draw };
  }

  /* ---------- stats + settings ---------- */
  function statsTab(p, app) {
    function draw() {
      var all = C.p().all(), x = tr(), today = x.s[dayKey()] || [0, 0], g30 = 0, n30 = 0, t = Date.now();
      for (var i = 0; i < 30; i++) { var v = x.s[dayKey(t - i * DAY)]; if (v) { g30 += v[0]; n30 += v[1]; } }
      var act = Object.keys(all).filter(function (k) { return !all[k].x; }), mat = act.filter(function (k) { return all[k].st === 2 && all[k].s >= 21; }).length;
      var fc = [], end = C.dayEnd(), q = C.due();
      for (var j = 0; j < 7; j++) fc.push(0);
      act.forEach(function (k) { var r = all[k]; if (!r.st) return; var dd = r.due < end ? 0 : Math.min(7, Math.floor((r.due - end) / DAY) + 1); if (dd < 7) fc[dd]++; });
      var top = Math.max.apply(null, fc.concat([1])), pr = C.pref();
      p.innerHTML = '<section class="hw-card"><div class="hwc-st">' +
        '<div><b>' + today[1] + '</b>' + bi(L.reviewed) + ' · ' + bi(L.today) + '</div>' +
        '<div><b>' + (n30 ? Math.round(100 * g30 / n30) + '%' : '–') + '</b>' + bi(L.retention) + '</div>' +
        '<div><b>' + streak(x) + '</b>' + bi(L.streak) + '</div>' +
        '<div><b>' + act.length + '</b>' + bi(L.total) + '</div>' +
        '<div><b>' + mat + '</b>' + bi(L.mature) + '</div>' +
        '<div><b>' + (x.best || 0) + '</b>' + bi(L.bestStreak) + '</div></div>' +
        '<h3 class="hwc-sec">' + bi(L.forecast) + '</h3><div class="hwc-fc" dir="ltr">' + fc.map(function (n, k) {
          return '<div><b>' + n + '</b><i style="height:' + Math.round(80 * n / top) + '%"></i><span>' + (k < 2 ? bi(L.days7[k]) : bi(L.dayN).split('{n}').join(k)) + '</span></div>';
        }).join('') + '</div><p class="hwc-small">' + bi(L.fresh) + ': ' + q.fresh + ' · ' + bi(L.learn) + ': ' + q.learn + ' · ' + bi(L.rev) + ': ' + q.rev + '</p></section>' +
        '<section class="hw-card"><h3 class="hwc-sec" style="margin-top:0">' + bi(L.settings) + '</h3>' +
        '<label class="hwc-set"><span>' + bi(L.perDay) + '</span><select class="js-pd">' + [5, 10, 20, 30, 50, 100].map(function (n) { return '<option' + (n === pr.perDay ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label>' +
        '<label class="hwc-set"><span>' + bi(L.auto) + '</span><input type="checkbox" class="js-auto"' + (pr.auto ? ' checked' : '') + '></label>' +
        '<p class="hwc-small">' + bi(L.devNote) + '</p></section>';
      function save(k, v) { var o = H.store.get('cards:pref', null) || {}; o[k] = v; H.store.set('cards:pref', o); app.dirty(); }
      p.querySelector('.js-pd').addEventListener('change', function (e) { save('perDay', +e.target.value); });
      p.querySelector('.js-auto').addEventListener('change', function (e) { save('auto', !!e.target.checked); });
    }
    draw();
    return { draw: draw };
  }

  /* ---------- page ---------- */
  H.apps.cards = function (mount) {
    inject();
    mount.classList.add('hw-case', 'hwc');
    var own = d.querySelector('h1');
    mount.innerHTML = '<header class="hwc-head">' + (own ? '' : '<h2>' + bi(L.title) + '</h2>') + '<p>' + bi(L.sub) + '</p></header><div class="js-top"><p class="hwc-small">' + bi(L.loading) + '</p></div>';
    var views = {}, top = null;
    var app = {
      go: function (id) { if (top) top.select(id); },
      /* any change: other tabs redraw when opened next */
      dirty: function () { Object.keys(views).forEach(function (k) { if (top && top.active !== k) views[k].stale = 1; }); }
    };
    function tab(id, fn) { return { id: id, label: L[id], render: function (p) { views[id] = fn(p, app); } }; }
    /* every source the student uses (plus the deck lists for Browse) loads before the first card */
    Promise.all([needAll(), need('gloss'), need('ecg'), need('deck')]).then(function () {
      var tabs = H.order([tab('review', reviewTab), tab('mine', mineTab), tab('browse', browseTab), tab('stats', statsTab)], mount.getAttribute('data-order'));
      top = H.tabs(mount.querySelector('.js-top'), { variant: 'line', hash: true, tabs: tabs, onChange: function (id) { var v = views[id]; if (v && v.stale) { v.stale = 0; v.draw(); } } });
    });
    /* account sync or another tab changed the cards: refresh what is not in the middle of a card */
    function ext() { Object.keys(views).forEach(function (k) { if (k === 'review' && top && top.active === 'review') return; if (top && top.active === k) views[k].draw(); else views[k].stale = 1; }); }
    w.addEventListener('storage', function (ev) { if (ev.key && /^hawi:cards?z?:/.test(ev.key)) ext(); });
    /* the account sync writes merged cards into this page (after sign-in): refresh once it settles */
    var et = 0; w.addEventListener('hawi:store', function (ev) { var k = ev.detail && ev.detail.key || ''; if (/^cardz?:(prog|train)$/.test(k)) { clearTimeout(et); et = setTimeout(ext, 400); } });
    C._ui = { views: views, get top() { return top; } }; /* test hook */
  };

  if (d.readyState !== 'loading' && H.boot) H.boot();
})(window, document);