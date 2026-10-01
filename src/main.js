/* ============================================================================
 * main.js —— 游戏主入口（ES Module 版，供 Vite 打包）
 * ----------------------------------------------------------------------------
 * 说明：为接入 Vite + Electron，把原来 index.html 里一串 <script> 改为在
 * 这里按依赖顺序统一 import。每个模块仍以全局 window.Babel 挂载（写法不变），
 * 这里只负责"按顺序执行它们"并启动 Phaser.Game。
 *
 * 依赖顺序：常量 → 数据(词库/楼层/状态/藏品) → UI工具 → 各场景 → 入口
 * ========================================================================== */

// 捕获渲染进程未捕获异常/错误，带完整 stack 写入日志（Electron console-message 会转发到 _renderer.log），便于定位 cut 崩溃
try {
  window.addEventListener('error', function (ev) {
    try { console.log('[window.error] ' + (ev && ev.message) + '\n' + ((ev && ev.error && ev.error.stack) || '')); } catch (e) {}
  });
  window.addEventListener('unhandledrejection', function (ev) { try { console.log('[unhandledrejection] ' + (ev && ev.reason)); } catch (e) {} });
} catch (e) {}

// 常量 / 数据
import './config/constants.js';
import './data/diagnostics.js';   // ★ 诊断监控（2026-09-26）：全局异常 + 手动打点 + 屏幕角标 + __babelDiag()
import './data/gaokaoWords.js';
import './data/wordbank.js';
import './data/synonyms.js';   // 失与得近义题库（2026-09-17）
import './data/sentenceRoles.js';   // 得偿所愿·拆句许愿的句子数据（2026-09-18）
import './data/emperorWords.js';
import './data/senseWords.js';   // ★ 高考熟词生义库（834 条 ✓ 圣徒二阶段连线用 ✓ 2026-09-21）
import './data/masklessWords.js';
import './data/fireWords.js';     // ★ 奎隆一阶段「尼卢火」词库（2026-09-24）
import './data/antonymWords.js';  // 反义词库（保留备用 ✓ 三阶段已改介词版不再引用 ✓ 2026-09-24）
import './data/prepWords.js';     // ★ 奎隆三阶段「无忧觉」介词搭配库（483 条 ✓ 2026-09-24 用户扩库）
import './data/encounterQuiz.js';  // ★ 不期而遇「辨析卡」专属题库（306 条 ✓ 每题带四条讲解 ✓ 2026-09-25）
import './data/floorConfig.js';
import './data/RunState.js';
import './data/collectibles.js';
import './data/affixes.js';

// UI 工具
import './scenes/ui.js';

// 皮肤（per-enemy 门控；目前只有亚当重锤用 'nightcity'，不影响任何其它战斗）
import './scenes/skins/nightcity.js';

// 敌人专属机制（per-enemy 门控；'barrage' 弹幕识别只挂在亚当重锤二阶段）
import './scenes/mechanics/barrage.js';

// 场景（按注册顺序）
import './scenes/BootScene.js';
import './scenes/SummaryScene.js';   // ★ 每局总结（2026-09-18）
import './scenes/skins/saint.js';    // ★ 圣徒专属战斗皮肤（2026-09-18）
import './scenes/skins/quilon.js';   // ★ 奎隆专属战斗皮肤「授法」（2026-09-24）
import './scenes/StartScene.js';
import './scenes/TestScene.js';
import './scenes/MapScene.js';
import './scenes/CombatScene.js';
import './scenes/NodeEventScene.js';
import './scenes/EndScene.js';

// 启动游戏（DOM 就绪后）
window.addEventListener('load', function () {
  // 开始新的一局（读常量里的初始数值）
  Babel.RunState.init();

  // 创建游戏实例（暴露到 window，便于诊断/调试）
  window.__GAME = new Phaser.Game({
    type: Phaser.AUTO,               // 自动选择 WebGL 或 Canvas
    parent: 'app',                   // 挂到 index.html 里 id="app" 的元素
    width: 1280,
    height: 720,
    backgroundColor: Babel.COLORS.DARK.bg,
    scale: {
      // 画布 = 窗口尺寸（缓冲区跟屏幕一致 → 文字最清晰），
      // 各场景统一用 s = max(1, min(w/1280, h/720)) 等比缩放内容：
      //   · 所有坐标/尺寸/字号都乘 s → 全屏后整页等比放大，绝不拉伸
      //   · 窗口比例不是 16:9 时，多出来的只是留白，内容永远保持比例
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1280,
      height: 720,
    },
    scene: [
      Babel.Scenes.BootScene,     // 启动（生成贴图/预载）
      Babel.Scenes.StartScene,    // 开始界面（点击解锁音频）
      Babel.Scenes.TestScene,     // 战斗测试（起始菜单进入）
      Babel.Scenes.MapScene,
      Babel.Scenes.CombatScene,
      Babel.Scenes.NodeEventScene,
      Babel.Scenes.SummaryScene,
      Babel.Scenes.EndScene,
    ],
  });
});

/* ============================================================================
 * ★ 全局点击音效（2026-09-18 用户要求：绑所有鼠标点击，空点也出声）
 *   绑定处：**canvas 的 DOM 事件**（不是 Phaser 的输入事件 ✗）
 *     —— 画布上任何一次按下都必然触发 ✓✓ 含"未命中任何对象"的空白点击 ✓
 *   播放处：**原生 Audio 元素**（不走 Phaser 的 SoundManager ✗）
 *     —— 原因：Phaser 那条路要等音频解码/解锁 ✓ 一旦 `sound.get()` 为 null 就会**静默失败** ✗
 *        表现就是"永远没声音" ✓（本文件第一版就踩了这个 ✗）
 *   · 每次点击 cloneNode ✓ → 连点可重叠 ✓
 *   · 50ms 节流 ✓；只响应左键与触摸 ✓（右键不响 ✗）
 *   · 原生失败则回退 Phaser `sfx-click`（BootScene 已预载 ✓）
 *   · 预留 `Babel.SfxMuted` 开关 ✓（项目当前无静音功能 ✓ 以后加设置直接读它 ✓）
 *   · 全程 try/catch ✓ 音频异常**绝不阻断点击本身** ✓
 * ========================================================================== */
(function installClickSfx() {
  const game = window.__GAME;
  const URL_SFX = 'assets/audio/sfx-click.wav';
  const VOL = 0.5;
  let base = null;
  try {
    base = new Audio(URL_SFX);
    base.preload = 'auto';
    base.volume = VOL;
    base.load();
  } catch (e) { base = null; }

  function playNative() {
    if (!base) return false;
    try {
      const a = base.cloneNode(true);   // 克隆 → 连点互不打断 ✓
      a.volume = VOL;
      const pr = a.play();
      if (pr && pr.catch) pr.catch(function () {});   // 自动播放被拦 → 静默忽略 ✓
      return true;
    } catch (e) { return false; }
  }
  function playPhaser() {
    try {
      if (!game || !game.sound || !game.sound.play) return;
      if (game.cache && game.cache.audio && !game.cache.audio.exists('sfx-click')) return;
      game.sound.play('sfx-click', { volume: VOL });
    } catch (e) {}
  }

  const el = (game && game.canvas) || document.querySelector('canvas') || document.body;
  if (!el || !el.addEventListener) return;
  let lastAt = 0;
  el.addEventListener('pointerdown', function (e) {
    if (e && e.pointerType === 'mouse' && e.button !== 0) return;      // 只左键/触摸
    try {
      if (typeof Babel !== 'undefined' && Babel && Babel.SfxMuted) return;
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (now - lastAt < 50) return;                                    // 节流
      lastAt = now;
      if (!playNative()) playPhaser();                                  // 原生优先 ✓ 失败回退 ✓
    } catch (e2) { /* 吞掉一切异常 ✓ 绝不影响点击 ✓ */ }
  }, true);   // ★ 捕获阶段监听 ✓ 即使有别的元素 stopPropagation 也能收到 ✓
})();

/* ============================================================================
 * ★ 每局总结 · 记录包装器（2026-09-18）
 *   包装 _onAnswer / _doTimeout / NodeEventScene.create ✓
 *   —— **战斗与节点逻辑一行未改** ✓ 只在外层读结果并追加记录 ✓✓
 *   · 四选一与拼词都走 _onAnswer（拼词拼对时调用方先把 correctIndex 设为 0 ✓）
 *   · 答错 / 超时走 _doTimeout ✓
 *   · `was = this.answering` 保证「每题只记一条」✓（_onAnswer 可能被调用多次 ✓）
 *   · 全程 try/catch ✓ 记录出任何问题都不影响游戏 ✓
 * ========================================================================== */
(function installRunLogHooks() {
  try {
    const S = (window.Babel && window.Babel.Scenes) || {};
    const RS = window.Babel && window.Babel.RunState;
    if (!RS || !RS.logAnswer) return;

    /* ① 答题（四选一 / 拼词 / 轨道 / 无面者 全走这条 ✓） */
    const C = S.CombatScene;
    if (C && C.prototype && !C.prototype.__runLogWrapped) {
      C.prototype.__runLogWrapped = true;
      const a = C.prototype._onAnswer;
      if (typeof a === 'function') {
        C.prototype._onAnswer = function (index) {
          const was = this.answering;
          const ok = (index === this.correctIndex);
          const r = a.apply(this, arguments);
          try { if (was) RS.logAnswer(this, index, ok); } catch (e) {}
          return r;
        };
      }
      const t = C.prototype._doTimeout;
      if (typeof t === 'function') {
        C.prototype._doTimeout = function () {
          const was = this.answering;
          const r = t.apply(this, arguments);
          try { if (was) RS.logAnswer(this, -1, false); } catch (e) {}
          return r;
        };
      }
      /* ★ 轨道接字母（rail）的判错出口（2026-09-18 补 ✗ 之前漏了它 → 塔露拉的错题一条都没记 ✓）
       *   rail **没有倒计时** ✓ 漏掉字母时走的是 _onRailTimeout ✓ 不走 _onAnswer / _doTimeout ✗ */
      const rt = C.prototype._onRailTimeout;
      if (typeof rt === 'function') {
        C.prototype._onRailTimeout = function () {
          const was = this.answering;
          const r = rt.apply(this, arguments);
          try { if (was) RS.logAnswer(this, -1, false); } catch (e) {}
          return r;
        };
      }
    }

    /* ② 走到哪个节点（＝路线 ✓） */
    const N = S.NodeEventScene;
    if (N && N.prototype && !N.prototype.__runLogWrapped) {
      N.prototype.__runLogWrapped = true;
      const c = N.prototype.create;
      if (typeof c === 'function') {
        N.prototype.create = function () {
          try {
            const type = this.type;
            const nt = (window.Babel.NODE_TYPES && window.Babel.NODE_TYPES[type]) || {};
            if (RS.logNode) RS.logNode(type, nt.sceneTitle || nt.desc || type);
          } catch (e) {}
          return c.apply(this, arguments);
        };
      }
    }
  } catch (e) {}
})();
