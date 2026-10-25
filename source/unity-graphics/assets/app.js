/* ===========================================================
   Unity × 图形学 · 站点脚本
   =========================================================== */
(function () {
  "use strict";

  var root = document.documentElement;

  /* ---------- 1. 主题 ---------- */
  var KEY = "ug-theme";
  var toggleBtn = document.getElementById("themeBtn");

  function applyTheme(t) {
    root.setAttribute("data-theme", t);
    if (toggleBtn) toggleBtn.textContent = t === "dark" ? "☀  浅色模式" : "☾  深色模式";
    try { localStorage.setItem(KEY, t); } catch (e) { /* file:// 下可能被拒 */ }
  }

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { saved = null; }
  if (saved === "dark" || saved === "light") {
    applyTheme(saved);
  } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    applyTheme("dark");
  } else {
    applyTheme("light");
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", function () {
      applyTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
    });
  }

  /* ---------- 2. 阅读进度 ---------- */
  var bar = document.getElementById("progress");
  var pctEl = document.getElementById("pct");
  var ticking = false;

  function updateProgress() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var p = h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
    if (bar) bar.style.transform = "scaleX(" + p + ")";
    if (pctEl) pctEl.textContent = Math.round(p * 100) + "%";
    ticking = false;
  }

  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(updateProgress); }
  }, { passive: true });
  window.addEventListener("resize", updateProgress);
  updateProgress();

  /* ---------- 3. 章节内滚动高亮 ---------- */
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll(".toc a[href^='#']"));
  if (tocLinks.length) {
    var heads = tocLinks
      .map(function (a) {
        var el = document.getElementById(a.getAttribute("href").slice(1));
        return el ? { link: a, el: el } : null;
      })
      .filter(Boolean);

    var spy = function () {
      var pos = window.scrollY + 110;
      var current = heads[0];
      for (var i = 0; i < heads.length; i++) {
        if (heads[i].el.offsetTop <= pos) current = heads[i];
      }
      heads.forEach(function (h) { h.link.classList.toggle("active", h === current); });
    };
    window.addEventListener("scroll", spy, { passive: true });
    spy();
  }

  /* ---------- 4. 移动端目录抽屉 ---------- */
  var side = document.getElementById("sidebar");
  var scrim = document.getElementById("scrim");
  var menuBtn = document.getElementById("menuBtn");

  function closeDrawer() {
    if (side) side.classList.remove("open");
    if (scrim) scrim.classList.remove("on");
  }

  if (menuBtn && side) {
    menuBtn.addEventListener("click", function () {
      side.classList.toggle("open");
      if (scrim) scrim.classList.toggle("on", side.classList.contains("open"));
    });
  }
  if (scrim) scrim.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeDrawer();
  });

  /* ---------- 5. 代码高亮 ---------- */
  var KW = "float|half|fixed|int|uint|bool|void|return|if|else|for|while|do|switch|case|break|continue|discard|struct|uniform|static|const|inline|sampler2D|samplerCUBE|sampler2D_float|sampler3D|Properties|SubShader|Pass|Tags|CGPROGRAM|ENDCG|HLSLPROGRAM|ENDHLSL|pragma|Shader|Fallback|Category";
  var TY = "float2|float3|float4|half2|half3|half4|fixed2|fixed3|fixed4|int2|int3|int4|float4x4|float3x3|float2x2|half4x4|uint|byte|Vector2|Vector3|Vector4|Quaternion|Matrix4x4|Color|Material|Camera|RenderTexture|Texture2D|Mesh|Renderer|TextureFormat|RenderTextureFormat|ScriptableRendererFeature|ScriptableRenderPass|RTHandle|CommandBuffer";
  var FN = "saturate|dot|normalize|cross|reflect|refract|lerp|clamp|pow|abs|min|max|floor|ceil|frac|step|smoothstep|length|distance|tex2D|tex2Dlod|texCUBE|mul|UnpackNormal|UnpackNormalScale|UnityObjectToClipPos|UnityObjectToWorldNormal|UnityWorldSpaceViewDir|UnityWorldSpaceLightDir|ComputeScreenPos|GetMainLight|TransformObjectToHClip|TransformObjectToWorldNormal|Blit|Blitter|Create|Release|SetGlobalTexture|GetTemporary|ReleaseTemporary|ConfigureInput|AddRenderPasses|OnRenderImage|new|this|base|using|namespace|public|private|static|class|override|virtual|get|set|void|var|true|false|null|Mathf|Debug|GetComponent|AddComponent|Screen|Graphics|GL";

  var RE = new RegExp(
    "(\\/\\/[^\\n]*)" +            // 1 行注释
    "|(\\/\\*[\\s\\S]*?\\*\\/)" +  // 2 块注释
    "|(\"(?:[^\"\\\\]|\\\\.)*\")" +// 3 字符串
    "|(#[a-z]+)" +                 // 4 预处理
    "|\\b(" + KW + ")\\b" +        // 5 关键字
    "|\\b(" + TY + ")\\b" +        // 6 类型
    "|\\b(" + FN + ")\\b",         // 7 函数/内置
    "g"
  );

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function highlight(text) {
    return esc(text).replace(RE, function (m, cm, cmb, str, pp, kw, ty, fn) {
      if (cm) return '<span class="c-cm">' + cm + "</span>";
      if (cmb) return '<span class="c-cm">' + cmb + "</span>";
      if (str) return '<span class="c-str">' + str + "</span>";
      if (pp) return '<span class="c-pp">' + pp + "</span>";
      if (kw) return '<span class="c-kw">' + kw + "</span>";
      if (ty) return '<span class="c-ty">' + ty + "</span>";
      if (fn) return '<span class="c-fn">' + fn + "</span>";
      return m;
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll(".code-block pre > code"), function (code) {
    var raw = code.getAttribute("data-raw");
    if (raw === null) {
      raw = code.textContent;
      code.setAttribute("data-raw", raw);
    }
    code.innerHTML = highlight(raw);

    var block = code.closest(".code-block");
    var btn = block ? block.querySelector(".copy-btn") : null;
    if (!btn) return;
    btn.addEventListener("click", function () {
      var done = function (ok) {
        btn.textContent = ok ? "已复制 ✓" : "复制失败";
        btn.classList.toggle("done", ok);
        setTimeout(function () {
          btn.textContent = "复制";
          btn.classList.remove("done");
        }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(raw).then(function () { done(true); }, function () { done(false); });
      } else {
        var ta = document.createElement("textarea");
        ta.value = raw;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        done(ok);
      }
    });
  });
})();
