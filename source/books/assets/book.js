// 书籍子站的交互：阅读进度、主题切换、当前章节高亮
(function () {
  var root = document.documentElement;
  var bar = document.querySelector('.progress span');

  // 主题
  var KEY = 'hub-book-theme';
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);
  var btn = document.querySelector('.theme-btn');
  if (btn) {
    var sync = function () {
      btn.textContent = root.getAttribute('data-theme') === 'dark' ? '☀ 浅色模式' : '☾ 深色模式';
    };
    sync();
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
      sync();
    });
  }

  // 阅读进度
  if (bar) {
    var update = function () {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var p = max > 0 ? (h.scrollTop || document.body.scrollTop) / max : 0;
      bar.style.width = Math.min(100, Math.max(0, p * 100)).toFixed(2) + '%';
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  // 当前章节高亮
  var links = document.querySelectorAll('.sidebar li a');
  if (links.length) {
    var here = location.pathname.split('/').pop() || 'index.html';
    for (var i = 0; i < links.length; i++) {
      var href = (links[i].getAttribute('href') || '').split('/').pop();
      if (href === here) links[i].classList.add('active');
    }
  }
})();
