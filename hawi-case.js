/*! Al-Hawi Medical — Clinical Case app (Play / Review / Discussion) | v0.1 | requires hawi-core.js */
(function (w, d) {
  'use strict';
  var H = w.Hawi; if (!H) return;
  var bi = H.bi, icon = H.icon;
  function B(ar, en) { return { ar: ar, en: en }; }

  var L = {
    play: B('الحالة', 'Play'), review: B('المراجعة', 'Review'), disc: B('المناقشة', 'Discussion'),
    history: B('القصة المرضية', 'History'), exam: B('الفحص السريري', 'Examination'),
    inv: B('الاستقصاءات', 'Investigations'), mgmt: B('خطة التدبير', 'Management Plan'),
    submit: B('أرسل إجاباتك', 'Submit Responses'), selected: B('مختار', 'selected'),
    yrs: B('سنة', 'years'), m: B('ذكر', 'Male'), f: B('أنثى', 'Female'),
    emptyT: B('لم تختر شيئاً', 'Nothing Selected'),
    emptyB: B('لم تحدد أي استقصاء أو خطة علاج. هل تريد إرسال خطة فارغة؟', "You haven't made any choices. Submit an empty plan anyway?"),
    back: B('رجوع', 'Back'), anyway: B('أرسل على أي حال', 'Submit Anyway'),
    perfT: B('أداؤك', 'Your Performance'),
    perfNote: B('تعتمد الدرجة على دقة اختياراتك ومباشرتها؛ الاختيارات الضارة تُنقص الدرجة.', 'Marks depend on clinical accuracy and directness; harmful choices cost marks.'),
    toReview: B('إلى المراجعة', 'Go to Review'), close: B('إغلاق', 'Close'),
    chosenOk: B('اختيار صحيح', 'Correct'), chosenBad: B('اختيار غير مناسب', 'Not indicated'),
    missed: B('فاتك', 'Missed'), neutral: B('محايد', 'Neutral'), none: B('لم تختر شيئاً.', 'None selected.'),
    lockedMsg: B('أرسل إجاباتك في تبويب الحالة أولاً لفتح هذا القسم.', 'Submit your responses in Play first to unlock this section.'),
    problem: B('المشكلة الحالية', 'Presenting Problem'), ddx: B('التشخيص التفريقي', 'Differential Diagnosis'),
    yourResult: B('نتيجتك', 'Your Result'), best: B('الأفضل', 'Best'), attempts: B('المحاولات', 'Attempts'),
    lHigh: B('الأرجح', 'Most likely'), lMid: B('ممكن', 'Possible'), lLow: B('أقل احتمالاً', 'Less likely'),
    finalDx: B('التشخيص النهائي', 'Final Diagnosis'),
    summary: B('الخلاصة السريرية والمحاكمة', 'Clinical Summary & Reasoning'),
    invExp: B('الاستقصاءات: لماذا؟', 'Investigations: Why?'), mgmtExp: B('التدبير: لماذا؟', 'Management: Why?'),
    keys: B('نقاط أساسية', 'Key Points'), refs: B('المراجع', 'References'),
    retry: B('أعد الحالة', 'Retry Case'), top: B('إلى الأعلى', 'Back to Top'),
    eduNote: B('محتوى تعليمي للطلاب والأطباء، لا يغني عن الدليل العلاجي المحلي ولا عن تقييم المريض.', 'Educational content; it does not replace local guidelines or patient assessment.')
  };

  /* original, neutral avatar (replace with the case image via data.image) */
  var AVA = '<svg viewBox="0 0 72 72" aria-hidden="true"><rect width="72" height="72" fill="#dff2ee"/><circle cx="36" cy="28" r="13" fill="#f2c9a0"/><path d="M23 25c0-9 6-14 13-14s13 5 13 13c-3-4-8-5-13-5s-10 2-13 6z" fill="#5b3a29"/><path d="M12 72c2-14 12-21 24-21s22 7 24 21z" fill="#0c9784"/><path d="M29 51l7 8 7-8" fill="none" stroke="#fff" stroke-width="2"/></svg>';

  H.apps['case'] = function (mount, data) {
    if (!data) return;
    var key = 'case:' + data.id;
    var saved = H.store.get(key, { best: null, attempts: 0, last: null });
    var st = { inv: {}, mgmt: {}, graded: false, result: null };
    if (saved.last) {
      (saved.last.inv || []).forEach(function (id) { st.inv[id] = 1; });
      (saved.last.mgmt || []).forEach(function (id) { st.mgmt[id] = 1; });
      st.graded = true; st.result = grade();
    }

    var p = data.patient || {};
    mount.innerHTML =
      '<article class="hw-case">' +
        '<header class="hw-hero">' +
          '<div class="hw-ava">' + (data.image ? '<img alt="" src="' + H.esc(data.image) + '">' : AVA) + '</div>' +
          '<div class="hw-hero-t"><div class="hw-hero-spec">' + bi(data.specialty) + '</div>' +
            '<h2>' + bi(data.title) + '</h2>' +
            '<div class="hw-hero-meta">' + H.esc(p.age) + ' ' + bi(L.yrs) + ' · ' + bi(p.sex === 'f' ? L.f : L.m) + '</div>' +
            '<div class="hw-hero-cc">' + bi(data.complaint) + '</div></div>' +
          '<div class="hw-best"><b class="js-best">' + (saved.best == null ? '—' : saved.best) + '</b>' + bi(L.best) + '</div>' +
        '</header>' +
        '<div class="js-steps"></div>' +
      '</article>';

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
          '<div class="hw-sub">' + H.esc(p.age) + ' ' + bi(L.yrs) + ' · ' + bi(p.sex === 'f' ? L.f : L.m) + '</div>' +
          '<div class="hw-stem">' + bi(data.stem) + '</div></section>' +
        '<section class="hw-card" style="padding:0;overflow:hidden"><table class="hw-vitals"><tbody>' +
          (data.vitals || []).map(function (v) { return '<tr><th scope="row">' + bi(v.k) + '</th><td>' + H.esc(v.v) + '</td></tr>'; }).join('') +
        '</tbody></table></section>' +
        '<div class="js-acc"></div>' +
        '<div class="hw-submit"><button type="button" class="hw-btn hw-btn--primary js-submit">' + icon('bolt') + bi(L.submit) + '</button></div>';

      var acc = H.accordion(panel.querySelector('.js-acc'), [
        { id: 'h', title: L.history, html: '<p>' + bi(data.history) + '</p>' },
        { id: 'e', title: L.exam, html: '<ul>' + (data.exam || []).map(function (x) { return '<li>' + bi(x) + '</li>'; }).join('') + '</ul>' },
        { id: 'i', title: L.inv, render: function (b) { optList(b, 'inv', data.investigations.options); } },
        { id: 'm', title: L.mgmt, render: function (b) { optList(b, 'mgmt', data.management.options); } }
      ]);

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
        if (!Object.keys(st.inv).length && !Object.keys(st.mgmt).length) {
          H.modal({ icon: 'alert', title: L.emptyT, body: '<p>' + bi(L.emptyB) + '</p>', actions: [
            { label: L.back },
            { label: L.anyway, kind: 'danger', onClick: function (c) { c(); submit(); } }] });
        } else submit();
      });
    }

    function optList(box, group, opts) {
      box.innerHTML = '<div class="hw-opts' + (st.graded ? ' is-graded' : '') + '"></div>';
      var wrap = box.firstChild;
      opts.forEach(function (o) {
        var b = d.createElement('button');
        b.type = 'button'; b.className = 'hw-opt'; b.setAttribute('role', 'checkbox');
        b.setAttribute('aria-checked', st[group][o.id] ? 'true' : 'false');
        b.dataset.id = o.id;
        b.innerHTML = '<span class="hw-box">' + icon('check') + '</span><span class="hw-opt-b"><span class="hw-opt-t">' + bi(o.t) +
          '</span><span class="hw-opt-tag"></span><span class="hw-opt-why">' + bi(o.why) + '</span></span>';
        if (st.graded) gradeOpt(b, o, !!st[group][o.id]);
        b.addEventListener('click', function () {
          if (st.graded) return;
          var on = !st[group][o.id];
          if (on) st[group][o.id] = 1; else delete st[group][o.id];
          b.setAttribute('aria-checked', on ? 'true' : 'false');
          var pl = tabs.panel('play'); if (pl && pl._counts) pl._counts();
        });
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
      H.store.set(key, saved);
      mount.querySelector('.js-best').textContent = saved.best;
      tabs.unlock('review'); tabs.unlock('discussion'); tabs.done('play');
      tabs.rerender('play'); tabs.rerender('review');
      showPerf();
    }

    function resList(items, cls, ic, withWhy) {
      if (!items.length) return '';
      return items.map(function (o) {
        return '<li class="' + cls + '">' + icon(ic) + '<span>' + bi(o.t) + (withWhy ? '<br><small>' + bi(o.why) + '</small>' : '') + '</span></li>';
      }).join('');
    }
    function groupRes(title, g) {
      var body = resList(g.ok, 'r-ok', 'check') + resList(g.bad, 'r-bad', 'x', true) + resList(g.miss, 'r-miss', 'alert');
      return '<div class="hw-res-h">' + bi(title) + '</div><ul class="hw-res">' + (body || '<li>' + bi(L.none) + '</li>') + '</ul>';
    }
    function ring(score) {
      var c = score >= 75 ? 'var(--hw-ok)' : score >= 40 ? 'var(--hw-warn)' : 'var(--hw-bad)';
      return '<div class="hw-ring" style="--p:' + score + ';--c:' + c + '"><span>' + score + '</span></div>';
    }
    function showPerf() {
      var r = st.result;
      H.modal({
        title: L.perfT,
        body: '<div class="hw-score">' + ring(r.score) + '<p>' + bi(L.perfNote) + '</p></div>' + groupRes(L.inv, r.inv) + groupRes(L.mgmt, r.mgmt),
        actions: [
          { label: L.close },
          { label: L.toReview, kind: 'accent', onClick: function (c) { c(); tabs.select('review', { focus: true }); } }]
      });
    }

    /* ---------- REVIEW ---------- */
    function renderReview(panel) {
      var rv = data.review || {}, r = st.result;
      var lv = { high: L.lHigh, mid: L.lMid, low: L.lLow };
      panel.innerHTML =
        (r ? '<section class="hw-card"><div class="hw-score" style="margin:0">' + ring(r.score) +
          '<p><b>' + bi(L.yourResult) + '</b><br>' + bi(L.best) + ': ' + saved.best + ' · ' + bi(L.attempts) + ': ' + saved.attempts + '</p></div></section>' : '') +
        '<div class="js-acc"></div>';
      H.accordion(panel.querySelector('.js-acc'), [
        { id: 'p', title: L.problem, open: true, html: '<p>' + bi(rv.problem) + '</p>' },
        { id: 'd', title: L.ddx, open: true, html: '<div class="hw-ddx">' + (rv.ddx || []).map(function (x) {
            return '<div class="hw-ddx-i l-' + (x.l || 'low') + '"><b>' + bi(x.n) + '<small>' + bi(lv[x.l] || L.lLow) + '</small></b><p>' + bi(x.f) + '</p></div>';
          }).join('') + '</div>' }
      ]);
    }

    /* ---------- DISCUSSION ---------- */
    function why(opts) {
      return '<div class="hw-opts is-graded">' + opts.slice().sort(function (a, b) { return b.w - a.w; }).map(function (o) {
        var cls = o.w > 0 ? 'g-ok' : o.w < 0 ? 'g-bad' : 'g-neutral';
        return '<div class="hw-opt ' + cls + '"><span class="hw-box">' + icon(o.w > 0 ? 'check' : 'x') + '</span><span class="hw-opt-b"><span class="hw-opt-t">' + bi(o.t) + '</span><span class="hw-opt-why">' + bi(o.why) + '</span></span></div>';
      }).join('') + '</div>';
    }
    function renderDiscussion(panel) {
      var ds = data.discussion || {};
      panel.innerHTML = '<div class="hw-dx"><small>' + bi(L.finalDx) + '</small>' + bi(ds.dx) + '</div><div class="js-acc"></div>' +
        '<div class="hw-acts"><button type="button" class="hw-btn js-retry">' + icon('redo') + bi(L.retry) + '</button>' +
        '<button type="button" class="hw-btn hw-btn--primary js-top">' + icon('up') + bi(L.top) + '</button></div>' +
        '<p class="hw-note">' + bi(L.eduNote) + '</p>';
      H.accordion(panel.querySelector('.js-acc'), [
        { id: 's', title: L.summary, open: true, html: '<p>' + bi(ds.summary) + '</p>' },
        { id: 'i', title: L.invExp, html: why(data.investigations.options) },
        { id: 'm', title: L.mgmtExp, html: why(data.management.options) },
        { id: 'k', title: L.keys, html: '<ul>' + (ds.keypoints || []).map(function (k) { return '<li>' + bi(k) + '</li>'; }).join('') + '</ul>' },
        { id: 'r', title: L.refs, html: '<ol class="hw-refs">' + (ds.refs || []).map(function (r) {
            return '<li>' + (r.u ? '<a href="' + H.esc(r.u) + '" target="_blank" rel="noopener">' + H.esc(r.t) + '</a>' : H.esc(r.t)) + '</li>';
          }).join('') + '</ol>' }
      ], { soft: true });
      panel.querySelector('.js-retry').addEventListener('click', retry);
      panel.querySelector('.js-top').addEventListener('click', function () { mount.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    }

    function retry() {
      st.inv = {}; st.mgmt = {}; st.graded = false; st.result = null;
      saved.last = null; H.store.set(key, saved);
      tabs.done('play', false); tabs.lock('review'); tabs.lock('discussion');
      tabs.rerender('review'); tabs.rerender('discussion');
      tabs.select('play'); tabs.rerender('play');
      mount.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (H.boot) H.boot();
})(window, document);
