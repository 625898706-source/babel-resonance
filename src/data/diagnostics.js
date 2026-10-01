/* ============================================================================
 * 诊断监控（2026-09-26 用户："你直接加一个监控机制，下次卡死你就能直接检测到了"）
 * ----------------------------------------------------------------------------
 * 装了什么：
 *   ① `window.onerror` + `unhandledrejection` → 全局兜底，任何未捕获异常都记下来
 *   ② 接管 `console.error` → 连被 try/catch 吞掉的异常也记
 *   ③ 手动打点 `Babel.Diag.mark(标签)` → 关键流程各留一个脚印（含场景切换）
 *   ④ **每条都往 console 写一份** → Electron 自动追加进 `_renderer.log` ✓✓
 *   ⑤ `window.__babelDiag()` → 控制台里随时 dump
 * ★★ 日志是**全自动落盘**的 ✗✗（2026-09-26 用户："如果出问题你自己调取日志，不要让我点"）
 *    玩家什么也不用做 ✓ 出问题我直接读 `_renderer.log` ✓
 * ★ 屏幕上**不显示任何东西** ✗（原来那个"点我复制"的角标已被用户否掉 ✓ 已删 ✓）
 * ========================================================================== */
(function () {
  if (!window.Babel) window.Babel = {};
  if (Babel.Diag) return;                       // 幂等：重复 import 不重装

  const MAX = 120;
  const log = [];
  let errCount = 0;      // ★ 屏幕角标已删 ✗ 所以不再需要 badge / badgeTxt 变量 ✓

  function stamp() {
    const d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) +
           ':' + ('0' + d.getSeconds()).slice(-2) + '.' + ('00' + d.getMilliseconds()).slice(-3);
  }
  function sceneNow() {
    try {
      /* ★ 项目里游戏实例挂在 `window.__GAME` ✗（不是 `Babel.__game` ✓ 2026-09-26 核对过 ✓）*/
      const g = window.__GAME || Babel.__game;
      const ss = (g && g.scene && g.scene.scenes) || [];
      for (let i = 0; i < ss.length; i++) {
        const s = ss[i];
        if (s && s.sys && s.sys.settings && s.sys.settings.active) return s.sys.settings.key;
      }
    } catch (e) {}
    return '?';
  }
  function push(kind, text) {
    const line = '[' + stamp() + '] [' + kind + '] [' + sceneNow() + '] ' + text;
    log.push(line);
    if (log.length > MAX) log.shift();
    /* ★★★ 自动落盘 ✗✗（2026-09-26 用户："如果出问题你自己调取日志，不要让我点"）
     *   `electron/main.js` 把渲染进程的**每一条 console 消息**都追加进 `_renderer.log` ✓
     *   —— 包括 `console.log` ✓（level 1 ✓）不只是 error ✓
     *   ⇒ 所以只要在这里往 console 写一份，日志就**自动进了文件** ✓
     *   ★ 前缀用 `[Babel:Diag]` ✗ —— 便于我在几千行日志里一眼 grep ✓ */
    try {
      if (kind === 'ERR') console.error('[Babel:Diag] ' + line);
      else console.log('[Babel:Diag] ' + line);
    } catch (e) {}
    if (kind === 'ERR') { errCount++; paint(true); }
    else paint(false);
  }

  Babel.Diag = {
    mark: function (tag, extra) {
      try { push('·', String(tag) + (extra ? ('  ' + extra) : '')); } catch (e) {}
    },
    error: function (where, err) {
      try {
        push('ERR', String(where) + ' → ' + ((err && (err.stack || err.message)) || err));
      } catch (e) {}
    },
    dump: function () {
      const head = '=== 巴别残响 · 诊断日志（' + log.length + ' 条，异常 ' + errCount + ' 个）===' + '\n' +
        ' UA: ' + (navigator && navigator.userAgent) + '\n' +
        ' 画布: ' + (function () { try { return window.innerWidth + '×' + window.innerHeight; } catch (e) { return '?'; } })() + '\n' +
        ' 层/节点: ' + (function () {
          try {
            const r = Babel.RunState;
            return 'floor=' + r.floor + ' node=' + r.currentNodeId + ' HP=' + r.targetHP + '/' + r.maxHP +
                   ' 残页=' + r.currency + ' 藏品=' + (r.ownedCollectibles || []).length +
                   ' outcome=' + ((r.runLog || {}).outcome || '-');
          } catch (e) { return '?'; }
        })() + '\n' +
        '-------------------------------------------';
      return head + '\n' + log.join('\n');
    },
    copy: function () {
      const txt = Babel.Diag.dump();
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt);
          return '已复制到剪贴板 ✓';
        }
      } catch (e) {}
      try {
        const ta = document.createElement('textarea');
        ta.value = txt; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
        return '已复制到剪贴板 ✓';
      } catch (e2) { return '复制失败 —— 请在控制台用 __babelDiag()'; }
    },
    raw: function () { return log.slice(); },
    clear: function () { log.length = 0; errCount = 0; paint(false); },
  };

  /* ---- ① 全局兜底 ---- */
  window.addEventListener('error', function (ev) {
    try {
      const m = ev && (ev.message || (ev.error && ev.error.message)) || 'unknown';
      const src = ev && ev.filename ? (' @' + String(ev.filename).split('/').pop() + ':' + ev.lineno) : '';
      push('ERR', 'window.onerror: ' + m + src + (ev.error && ev.error.stack ? ('\n    ' + ev.error.stack.split('\n').slice(1, 4).join('\n    ')) : ''));
    } catch (e) {}
  });
  window.addEventListener('unhandledrejection', function (ev) {
    try {
      const r = ev && ev.reason;
      push('ERR', 'unhandledrejection: ' + ((r && (r.stack || r.message)) || r));
    } catch (e) {}
  });

  /* ---- ①b 接管 console.error ✗✗（2026-09-26）
   *   项目里有大量 `try{…}catch(e){ console.error('[Combat] xxx', e) }` 的兜底 ✗
   *   那些异常**不会**触发 window.onerror ✓（被 catch 了 ✓）→ 只写进 console ✓
   *   接管后它们也进诊断日志 ✓ 于是"被吞掉的异常"也能被我看到 ✓
   *   ★ 保留原函数 ✗ 照常转发 ✓ 不改变 Electron 那边的行为 ✓ 只多记一份 ✓ */
  (function wrapConsoleError() {
    if (console.__babelWrapped) return;
    const orig = console.error;
    console.error = function () {
      try {
        const parts = [];
        for (let i = 0; i < arguments.length; i++) {
          const a = arguments[i];
          if (a && (a.stack || a.message)) parts.push(String(a.stack || a.message));
          else parts.push(String(a));
        }
        push('ERR', 'console.error: ' + parts.join(' | ').slice(0, 900));
      } catch (e) {}
      try { if (orig) orig.apply(console, arguments); } catch (e) {}
    };
    console.__babelWrapped = true;
  })();

  /* ---- ③ 屏幕角标：**已按用户要求删除** ✗（2026-09-26："这个不要"）
   *   原来左下角会浮一个「· N 条脚印 ｜ 点我复制」的小条 ✓
   *   用户不要它 ✓ —— 而且**已经不需要**了：日志现在自动写进 `_renderer.log` ✓
   *   我直接读文件就行 ✗ 不用玩家点任何东西 ✓
   *   ⇒ 保留一个**空操作** `paint()` ✗ 免得 `push()` 里的调用点要改 ✓（零风险 ✓）
   *   ★ 也**不再往 DOM 里插任何元素** ✗ —— 屏幕上干干净净 ✓ */
  function paint() { /* 已停用：不创建、不显示任何屏幕元素 ✓ */ }

  /* 控制台便捷入口 */
  window.__babelDiag = function () {
    const t = Babel.Diag.dump();
    try { console.log(t); } catch (e) {}
    return t;
  };
  window.__babelDiagClear = function () { Babel.Diag.clear(); return 'cleared'; };

  /* ---- ⑤ 场景切换留痕 ✗✗（2026-09-26）
   *   卡死时最想知道"**最后停在哪一屏**" ✓
   *   `window.__GAME` 是 main.js 在**本模块之后**才建的 ✗ → 轮询等它出现 ✓
   *   挂上 `Phaser.Scenes.Events.START` ✓ 每次进场景记一条 ✓
   *   ★ 幂等：用 `_diagHooked` 保证只挂一次 ✓（否则会重复订阅 ✓）*/
  (function hookScenes() {
    let tries = 0;
    const tick = setInterval(function () {
      tries++;
      const g = window.__GAME;
      const evName = (window.Phaser && Phaser.Scenes && Phaser.Scenes.Events && Phaser.Scenes.Events.START) || 'start';
      if (g && g.scene && !g.scene._diagHooked) {
        try {
          g.scene._diagHooked = true;
          g.scene.events.on(evName, function (sys) {
            try { Babel.Diag.mark('场景 → ' + ((sys && sys.settings && sys.settings.key) || '?')); } catch (e) {}
          });
          Babel.Diag.mark('场景监控已挂上');
        } catch (e) {}
      }
      if ((g && g.scene && g.scene._diagHooked) || tries > 120) clearInterval(tick);   // 最多试 60s
    }, 500);
  })();

  push('·', '诊断监控已装载');
})();
