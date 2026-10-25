/* ============================================================
   交互：卡片渲染 / 筛选 / 进度环 / 本地存储
   ============================================================ */

(function () {
  'use strict';

  var STORE_KEY = 'gpp-unity-progress-v1';
  var CARD_RING = 2 * Math.PI * 50;   // 大环 r=50
  var MINI_RING = 2 * Math.PI * 15;   // 小环 r=15

  var state = { done: {}, notes: {} };
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        state.done = parsed.done || {};
        state.notes = parsed.notes || {};
      }
    }
  } catch (e) { /* 隐私模式下忽略 */ }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var cardsHost = $('#cards');
  var emptyEl = $('#empty');
  var batchOrder = ['b1', 'b2', 'b3'];
  var currentBatch = 'all';
  var hideDone = false;
  var query = '';

  /* ---------------- 卡片 ---------------- */

  function cardHTML(p) {
    var chips = p.unity.map(function (u) { return '<li>' + u + '</li>'; }).join('');
    var mins = p.min + '′';
    return '' +
      '<article class="pcard' + (p.warn ? ' is-warn' : '') + '" data-id="' + p.id + '" data-batch="' + p.batch + '">' +
        '<button class="pcard-check" type="button" role="checkbox" aria-checked="false" aria-label="标记《' + p.name + '》已读">' +
          '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.4 4.6 9 10 3.4"/></svg>' +
        '</button>' +
        '<div class="pcard-head">' +
          '<span class="pcard-no">' + String(p.no).padStart(2, '0') + '</span>' +
          '<h3>' + p.name + '<em>' + p.en + '</em></h3>' +
          '<span class="pcard-min">' + mins + '</span>' +
        '</div>' +
        '<div class="pcard-glyph" aria-hidden="true"><svg viewBox="0 0 96 64">' + p.glyph + '</svg></div>' +
        '<ul class="chips">' + chips + '</ul>' +
        '<p class="pcard-q">' + p.q + '</p>' +
        '<p class="pcard-note">' + p.note + '</p>' +
        '<div class="pcard-links">' +
          '<a class="pcard-link" href="pattern/' + p.id + '.html">Unity 视角解读 →</a>' +
          '<a class="pcard-link pcard-link-alt" href="https://gpp.tkchu.me/' + p.id + '.html" target="_blank" rel="noopener">原书 ↗</a>' +
        '</div>' +
      '</article>';
  }

  function buildCards() {
    var html = '';
    batchOrder.forEach(function (b) {
      var list = PATTERNS.filter(function (p) { return p.batch === b; });
      if (!list.length) return;
      html += '<section class="batch-group" data-group="' + b + '">' +
        '<div class="batch-head">' +
          '<h3>' + BATCHES[b].label + '</h3>' +
          '<p>' + BATCHES[b].desc + '</p>' +
          '<span class="batch-rule"></span>' +
        '</div>' +
        '<div class="cards-grid">' + list.map(cardHTML).join('') + '</div>' +
      '</section>';
    });
    cardsHost.innerHTML = html;

    $$('.pcard', cardsHost).forEach(function (el) {
      var id = el.getAttribute('data-id');
      var btn = $('.pcard-check', el);
      btn.addEventListener('click', function () {
        setDone(id, !state.done[id]);
      });
      if (state.done[id]) {
        el.classList.add('is-done');
        btn.setAttribute('aria-checked', 'true');
      }
    });
  }

  function setDone(id, value) {
    if (value) { state.done[id] = true; } else { delete state.done[id]; }
    save();
    syncUI();
  }

  /* ---------------- 筛选 ---------------- */

  function applyFilter() {
    var q = query.trim().toLowerCase();
    var visible = 0;

    $$('.batch-group', cardsHost).forEach(function (group) {
      var groupShown = 0;
      var batch = group.getAttribute('data-group');

      $$('.pcard', group).forEach(function (card) {
        var id = card.getAttribute('data-id');
        var p = PATTERNS.find(function (x) { return x.id === id; });
        var hay = (p.name + ' ' + p.en + ' ' + p.unity.join(' ') + ' ' + p.q).toLowerCase();

        var okBatch = (currentBatch === 'all' || batch === currentBatch);
        var okQuery = (!q || hay.indexOf(q) !== -1);
        var okDone = (!hideDone || !state.done[id]);

        var show = okBatch && okQuery && okDone;
        card.hidden = !show;
        if (show) { groupShown++; }
      });

      group.hidden = groupShown === 0;
      visible += groupShown;
    });

    emptyEl.hidden = visible !== 0;
  }

  $$('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      $$('.tab').forEach(function (t) {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');
      currentBatch = tab.getAttribute('data-batch');
      applyFilter();
    });
  });

  var searchEl = $('#search');
  searchEl.addEventListener('input', function () {
    query = searchEl.value;
    applyFilter();
  });

  var hideEl = $('#hideDone');
  hideEl.addEventListener('change', function () {
    hideDone = hideEl.checked;
    applyFilter();
  });

  /* ---------------- 进度 ---------------- */

  function syncUI() {
    var total = PATTERNS.length;
    var doneCount = PATTERNS.filter(function (p) { return state.done[p.id]; }).length;
    var pct = Math.round((doneCount / total) * 100);

    $('#pct').textContent = pct + '%';
    $('#count').textContent = doneCount + ' / ' + total;
    $('#miniText').textContent = doneCount + ' / ' + total;

    var big = $('#bigRing');
    var mini = $('#miniRing');
    big.style.strokeDasharray = CARD_RING;
    big.style.strokeDashoffset = CARD_RING * (1 - doneCount / total);
    mini.style.strokeDasharray = MINI_RING;
    mini.style.strokeDashoffset = MINI_RING * (1 - doneCount / total);

    var pitch = $('#pitch');
    if (doneCount === 0) {
      pitch.textContent = '还没有开始。建议先读批次 1 的第一张卡——组件模式。';
    } else if (doneCount < 5) {
      pitch.textContent = '已读 ' + doneCount + ' / 19。批次 1 是理解其他一切的前提，别急着往后跳。';
    } else if (doneCount < 10) {
      pitch.textContent = '已读 ' + doneCount + ' / 19。进入批次 2 了，这时该回项目重构一处真实代码。';
    } else if (doneCount < total) {
      pitch.textContent = '已读 ' + doneCount + ' / 19。剩下的都是「按需查」，遇到具体问题再回来。';
    } else {
      pitch.textContent = '全部读完。接下来该做的事：回项目重构一处真实代码，并写下代价。';
    }

    $$('.pcard', cardsHost).forEach(function (card) {
      var id = card.getAttribute('data-id');
      var isDone = !!state.done[id];
      card.classList.toggle('is-done', isDone);
      var btn = $('.pcard-check', card);
      if (btn) { btn.setAttribute('aria-checked', isDone ? 'true' : 'false'); }
    });

    $$('#tbody tr').forEach(function (row) {
      var id = row.getAttribute('data-id');
      var isDone = !!state.done[id];
      row.classList.toggle('is-done', isDone);
      var box = $('input[type="checkbox"]', row);
      if (box) { box.checked = isDone; }
    });

    if (hideDone) { applyFilter(); }
  }

  /* ---------------- 表格 ---------------- */

  function buildTable() {
    var tbody = $('#tbody');
    tbody.innerHTML = PATTERNS.map(function (p) {
      return '<tr data-id="' + p.id + '">' +
        '<td class="t-no">' + String(p.no).padStart(2, '0') + '</td>' +
        '<td><a class="t-name" href="pattern/' + p.id + '.html">' + p.name + '</a><span class="t-en">' + p.en + '</span></td>' +
        '<td class="t-unity">' + p.unity.join(' · ') + '</td>' +
        '<td><input class="t-note" type="text" data-note="' + p.id + '" placeholder="例如：PlayerController 的移动 / 子弹生成…" value="' +
          (state.notes[p.id] ? String(state.notes[p.id]).replace(/"/g, '&quot;') : '') + '"></td>' +
        '<td><label class="cb"><input type="checkbox" data-check="' + p.id + '"><span></span></label></td>' +
      '</tr>';
    }).join('');

    $$('input[data-check]', tbody).forEach(function (box) {
      box.addEventListener('change', function () {
        setDone(box.getAttribute('data-check'), box.checked);
      });
    });

    var timer = null;
    $$('input[data-note]', tbody).forEach(function (input) {
      input.addEventListener('input', function () {
        var id = input.getAttribute('data-note');
        state.notes[id] = input.value;
        clearTimeout(timer);
        timer = setTimeout(save, 400);
      });
    });
  }

  /* ---------------- 分布图 ---------------- */

  function buildMap() {
    var host = $('#mapDots');
    if (!host) return;
    var NS = 'http://www.w3.org/2000/svg';

    PATTERNS.forEach(function (p) {
      var sx = 90 + p.pos[0] * 5.5;
      var sy = 380 - p.pos[1] * 3.4;
      var right = sx > 560;

      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', sx);
      c.setAttribute('cy', sy);
      c.setAttribute('r', 4.5);
      c.setAttribute('class', 'map-dot dot-' + p.batch);
      var t = document.createElementNS(NS, 'title');
      t.textContent = p.name + ' / ' + p.en + '（批次 ' + p.batch.slice(1) + '）';
      c.appendChild(t);

      var label = document.createElementNS(NS, 'text');
      label.setAttribute('x', right ? sx - 9 : sx + 9);
      label.setAttribute('y', sy + 4);
      label.setAttribute('text-anchor', right ? 'end' : 'start');
      label.setAttribute('class', 'map-dot-label');
      label.textContent = p.name;

      var link = document.createElementNS(NS, 'a');
      link.setAttribute('href', 'pattern/' + p.id + '.html');
      link.setAttribute('class', 'map-link');
      link.appendChild(c);
      link.appendChild(label);
      host.appendChild(link);
    });
  }

  /* ---------------- 重置 ---------------- */

  var resetBtn = $('#resetBtn');
  resetBtn.addEventListener('click', function () {
    if (!window.confirm('清空所有勾选和笔记？这个操作无法撤销。')) return;
    state.done = {};
    state.notes = {};
    save();
    $$('input[data-note]').forEach(function (i) { i.value = ''; });
    syncUI();
  });

  /* ---------------- 启动 ---------------- */

  buildCards();
  buildTable();
  buildMap();
  syncUI();
  applyFilter();
})();
