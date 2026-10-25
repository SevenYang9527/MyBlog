/* 详情页：已读状态（与首页共用同一个 localStorage） */

(function () {
  'use strict';

  var KEY = 'gpp-unity-progress-v1';
  var btn = document.getElementById('readBtn');
  if (!btn) return;

  var id = btn.getAttribute('data-id');
  var state = { done: {}, notes: {} };

  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        state.done = parsed.done || {};
        state.notes = parsed.notes || {};
      }
    }
  } catch (e) {}

  function paint() {
    var on = !!state.done[id];
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.textContent = on ? '已读 ✓ 点此取消' : '标记已读';
  }

  btn.addEventListener('click', function () {
    if (state.done[id]) { delete state.done[id]; } else { state.done[id] = true; }
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    paint();
  });

  paint();

  /* 从首页跳进来时带 #done 之类的锚点不用处理；返回时保持滚动位置交给浏览器 */
})();
