/* ============================================================================
   亚当重锤 · 二阶段机制：**弹幕识别 BARRAGE IDENTIFICATION**
   ----------------------------------------------------------------------------
   完全对照 `设计预览/亚当重锤-弹幕识别-预览.html` 实装（参数、算法、判定、颜色全部一致）：
     · 从亚当重锤（右侧）依次"发射" N 个词条，**匀速**飞向逻各斯（左侧）
     · 其中**只有一个是真词**（取自 GAOKAO_WORDS），其余是形近假词（整词打乱 / 换一个字母 / 混合）
     · **点中真词** → HIT：敌人 −1，清场，开始下一击
     · **任意词（真假都算）碰到逻各斯** → 你 −1（走 E3 的 _playerHit，藏品/恍神照常生效），开始下一击
     · 点到假词不扣血，但它**继续飞**
     · 残影：**按时间取样历史位置**（sampleX + 二分插值）→ 相邻残影间距恒等于 `gap` 像素，与帧率无关
     · 色带：头（最近层）**蓝 `#2e6fd6`** → 尾（最远层）**青绿 `#7ff2e0`**（HSL 插值）
     · 爆冲：每 `boostEvery` 秒一次 `boostDur` 秒的脉冲（只影响残影/色散/背景，**不影响飞行速度**）
     · **无震屏**（用户明确要求）
   ----------------------------------------------------------------------------
   渲染：Phaser 没有 HTML canvas 的 per-draw `lighter` 混合，因此用
     「1 个 RenderTexture + 每个弹幕 1 个 Text 源」：每帧 rt.clear() 后
     用 rt.draw(text, x, y, alpha, tint) 画 N 层残影 + 色散双绘 + 白热核心。
     全程**每个弹幕只有一个 Text 对象**（结构上不可能出现"多层文字对不齐重影"）。
   ----------------------------------------------------------------------------
   ★ 门控：只有 `enemyDef.mechanics === 'barrage'` 的敌人才会进入本文件任何逻辑。
   ========================================================================== */
(function () {
  'use strict';
  window.Babel = window.Babel || {};

  /* ---- 与 HTML 预览逐项一致的默认值 ---- */
  const DEF = {
    sceneDepth: 6,          // 弹幕层深度（高于立绘牌 3、低于全屏闪 60）
    count: 3,               // 每击词数
    speed: 300,             // 飞行速度 px/s（匀速；爆冲不影响）—— 与 constants 里的敌人配置保持一致
    stag: 0.26,             // 发射间隔（秒）
    fakeType: 2,            // 0=整词打乱 1=换一个字母 2=混合
    size: 44,               // 字号
    layers: 22,             // 残影层数
    gap: 22,                // 相邻残影间距（像素）
    fall: 0.90,             // 每层衰减
    ab: 6,                  // 色散
    boost: 2.6,             // 爆冲强度（视觉）
    boostEvery: 6.0,        // 爆冲间隔
    boostDur: 1.25,         // 爆冲时长
    colA: '#7fc8f0',        // 头（最近层）＝浅天蓝（原 #2e6fd6 太深，用户要求起点提亮）
    colB: '#7ff2e0',        // 尾（最远层）＝青绿
    lanes: [212, 300, 388], // 三条轨道 y
    field: [322, 962],      // 飞行区间 x（逻各斯 → 重锤）
  };

  /* ---- 颜色：与预览同一套 HSL 插值 ---- */
  function hex2rgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (mx + mn) / 2, d = mx - mn;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function hsl2rgb(h, s, l) {
    h = ((h % 1) + 1) % 1;
    if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
    const f = function (p, q, t) {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return [Math.round(f(p, q, h + 1 / 3) * 255), Math.round(f(p, q, h) * 255), Math.round(f(p, q, h - 1 / 3) * 255)];
  }
  const toNum = function (c) { return (c[0] << 16) | (c[1] << 8) | c[2]; };

  /* ---- 按时间采样历史位置（与预览 sampleX 完全一致） ---- */
  function sampleX(hist, tq) {
    const n = hist.length; if (!n) return null;
    if (tq <= hist[0].t) return hist[0].x;
    if (tq >= hist[n - 1].t) return hist[n - 1].x;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (hist[mid].t <= tq) lo = mid; else hi = mid; }
    const a = hist[lo], c = hist[hi];
    const f = (tq - a.t) / Math.max(1e-6, c.t - a.t);
    return a.x + (c.x - a.x) * f;
  }

  /* ---- 假词生成（与预览一致；并保证打乱结果本身不是真词） ---- */
  function bank() {
    const all = (window.Babel.GAOKAO_WORDS || []);
    const list = all.filter(function (w) { return /^[a-zA-Z]{4,10}$/.test(w[0]); });
    return list.length ? list : [['become', '变成'], ['window', '窗户'], ['picture', '图片']];
  }
  function realSet(list) {
    const m = {};
    list.forEach(function (w) { m[String(w[0]).toLowerCase()] = 1; });
    return m;
  }
  function scramble(w) {
    const a = w.split('');
    for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a.join('');
  }
  function fakeWord(real, mode, REAL) {
    const kind = mode === 2 ? (Math.random() < 0.5 ? 0 : 1) : mode;
    const low = real.toLowerCase();
    if (kind === 0) {
      for (let t = 0; t < 40; t++) { const s = scramble(real); if (!REAL[s.toLowerCase()] && s.toLowerCase() !== low) return s; }
    }
    for (let t = 0; t < 40; t++) {
      const i = 1 + ((Math.random() * (real.length - 2)) | 0);
      const c = String.fromCharCode(97 + ((Math.random() * 26) | 0));
      const s = real.slice(0, i) + c + real.slice(i + 1);
      if (!REAL[s.toLowerCase()] && s !== real) return s;
    }
    return scramble(real);
  }

  const M = {
    KEY: 'barrage',

    /* cfg 合并：敌人定义里的 barrage 字段可覆盖任意默认值 */
    cfg(enemyDef) {
      const c = {};
      const src = (enemyDef && enemyDef.barrage) || {};
      Object.keys(DEF).forEach(function (k) { c[k] = (src[k] !== undefined) ? src[k] : DEF[k]; });
      return c;
    },

    /* ---- 进入二阶段：清掉题面、建弹幕层、放第一击 ---- */
    enter(scene, enemyDef) {
      if (!scene) return;
      if (scene._barrage) this.clear(scene);      // ★ 防御：上一场若有残留先收干净
      if (scene._barrageOn) return;
      const cfg = this.cfg(enemyDef);
      const s = this._s(scene);
      const P = {
        count: Math.max(2, cfg.count | 0), speed: cfg.speed, stag: cfg.stag, fakeType: cfg.fakeType,
        size: Math.round(cfg.size * s), layers: Math.max(1, cfg.layers | 0), gap: cfg.gap * s,
        fall: cfg.fall, ab: cfg.ab * s, boost: cfg.boost, boostEvery: cfg.boostEvery, boostDur: cfg.boostDur,
        lanes: cfg.lanes.map(function (y) { return y * s; }),
        x1: cfg.field[1] * s, x0: cfg.field[0] * s,
        depth: cfg.sceneDepth,
      };
      P.hslA = rgb2hsl.apply(null, hex2rgb(cfg.colA));
      P.hslB = rgb2hsl.apply(null, hex2rgb(cfg.colB));

      const list = bank();
      const g = {
        P: P, cfg: cfg, list: list, REAL: realSet(list),
        words: [], queued: [], wave: 0, hits: 0, hurts: 0,
        done: false, clock: 0, forced: 0, nextAt: 0.25, flashOk: true,
        timers: [], tweens: [], objs: [],
      };
      scene._barrageOn = true;
      scene._barragePhase = 2;      // 二阶段（弹幕识别）
      scene._barrage = g;

      /* 题面/倒计时/选项全部藏掉（本阶段没有四选一） */
      try {
        if (scene.cdBar) scene.cdBar.setVisible(false);
        if (scene.cdText) scene.cdText.setVisible(false);
        if (scene.wordText) scene.wordText.setVisible(false);
        if (scene._answerHint) scene._answerHint.setVisible(false);
        if (scene._cardRule) scene._cardRule.setVisible(false);
        if (scene._cardBotRule) scene._cardBotRule.setVisible(false);
        (scene.optionButtons || []).forEach(function (b) {
          if (b && b.setVisible) b.setVisible(false);
          if (b && b.list) b.list.forEach(function (c) { if (c && c.input) c.input.enabled = false; });
        });
        if (scene.feedback) scene.feedback.setText('');
      } catch (e) {}

      /* 残影刷子一次建好复用（★ 直接作为场景对象显示，不用 RenderTexture —— 见 _ensureBrushes 注释） */
      this._ensureBrushes(scene, g);

      /* HUD：提示行 / 计数 / 爆冲条 / 标签（与预览同一套文案与位置） */
      const numFont = '"Orbitron", "Space Grotesk", sans-serif';
      const cnFont = '"Smiley Sans", "HarmonyOS Sans SC", sans-serif';
      /* ★ 标题：英文 SANDEVISTAN（字距拉开、比原来大），并复刻一阶段的两种动画：
           ① 逐字解码入场（420ms，字形池与一阶段相同，左→右）
           ② 每 4.6s 一次间歇故障闪烁（随机替换若干字符 + 横向微抖 120ms） */
      const TITLE = 'S A N D E V I S T A N';
      const GLYPH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#%&*<>';
      const hint = scene.add.text(scene.width / 2, 112 * s, TITLE,
        { fontFamily: numFont, fontSize: Math.round(30 * s) + 'px', color: '#eafcff' })
        .setOrigin(0.5, 0.5).setDepth(P.depth + 1).setAlpha(0.98);
      if (hint.setShadow) hint.setShadow(0, 0, '#5ef6ff', Math.max(6, Math.round(12 * s)), false, true);
      g.title = { obj: hint, text: TITLE, glyph: GLYPH, dec: 0, dur: 0.42, decDone: false, nextGlitch: 4.6, glitchT: 0 };
      const counters = null;
      const label = scene.add.text(scene.width / 2, scene.height - 38 * s, 'S A N D E V I S T A N  //  弹幕识别',
        { fontFamily: numFont, fontSize: Math.round(11 * s) + 'px', color: '#7df9ff' }).setOrigin(0.5, 0.5).setDepth(P.depth + 1).setAlpha(0.35);
      const boostBg = scene.add.rectangle(scene.width / 2 - 150 * s, scene.height - 26 * s, 300 * s, 2 * s, 0x7df9ff, 0.18).setDepth(P.depth + 1);
      const boostBar = scene.add.rectangle(scene.width / 2 - 150 * s, scene.height - 26 * s, 1, 2 * s, 0x7df9ff, 1)
        .setOrigin(0, 0.5).setDepth(P.depth + 1).setAlpha(0.2);
      g.hint = hint; g.counters = null; g.label = label; g.boostBg = boostBg; g.boostBar = boostBar;
      g.objs.push(hint, label, boostBg, boostBar);

      /* ★★★ 常驻规则提示行 ✗✗（2026-09-29 用户三轮反馈定稿）
       *   ① "一阶段转二阶段的时候提示一下要选择拼写正确的词，否则一头雾水"
       *   ② "在斯安威斯坦下面显示吧，不然根本看不清 刚才没看到提示"
       *   ③ "在斯安威斯坦下面常驻显示（要用相应字体）"
       *
       *   ★★ 为什么第一版"看不清" ✗✗（用户截图暴露的 ✓）
       *     弹幕词的**拖影总长 ＝ layers × gap ＝ 22 × 22 ＝ 484px 设计像素** ✓
       *     屏幕宽才 1280 ✓ ⇒ 拖影**横穿几乎整屏** ✓
       *     我第一版把提示放在 `y = 152*s` ✗ → **正好落在第一轨道的拖影带上** ✓
       *     → 22 层残影把它糊掉 ✓（截图里 `DIFFVRRRR…` 那片盖住了提示 ✓）
       *
       *   ★★ 定稿做法：**"斯安威斯坦"正下方 ＋ 自带底衬板** ✗✗
       *     · 位置 `y = 156*s`：标题字号 30 ✓ 其下沿 ≈ `127*s` ✓
       *       → 提示上沿 ≈ `156 - 16 = 140` ✓ **视线里就是"紧贴在标题下面"** ✓
       *       （原来放 172 时离标题 35px ✓ 太散 ✓ 不成一组 ✓ 用户要的是"下面"✓）
       *     · 第一轨道 `212*s` ✓ 提示下沿 ≈ 172 ✓ **留 40px** ✓ 不碰拖影带 ✓
       *     · **必须有底衬板** ✗ —— 光靠"找空位"不行 ✓
       *       空位是**随时间变化**的 ✓ 拖影每帧都在扫 ✓ 今天躲开明天又撞上 ✓
       *     · **常驻** ✗ 不做淡出 ✓（横幅只停 1.8s ✓ 玩家当时正在挨打 ✓ 读完就忘 ✓）
       *       这是本阶段**唯一**的核心规则 ✓ 必须一直在屏幕上 ✓
       *
       *   ★★ 字体：**与标题同一套** ✗（用户明确要求"要用相应字体" ✓）
       *     皮肤自己的 `numFont`（`Orbitron, Space Grotesk, sans-serif` ✓）
       *     拉丁/数字走 Orbitron ✓ 中文自动落到系统无衬线 ✓ 与标题视觉一致 ✓
       *     ★ 对照：「弹幕识别」那行标签用的就是 `numFont` ✓ 同一族 ✓ */
      const ruleStr = '点选「拼写正确」的词　·　碰到逻各斯会受伤';
      const ruleY = 156 * s;
      const ruleFontPx = Math.round(17 * s);
      /* ★★ 顺序：**先建文字 → 读实测宽度 → 再画底衬板** ✗✗ 不能反过来 ✓
       *   · 第一版我用"汉字≈字号、拉丁≈0.55 倍"**估**宽度 ✗
       *     但字体回退时估不准 ✓（兜底字体比 Space Grotesk 宽 ✓ 我在别处栽过 ✓）
       *   · `text.width` 是 Phaser 建好之后才有的**实测值** ✓ 直接读 ✓ 一定准 ✓ */
      const rule = scene.add.text(scene.width / 2, ruleY, ruleStr,
        { fontFamily: numFont, fontSize: ruleFontPx + 'px', color: '#cdf3ff' })
        .setOrigin(0.5, 0.5).setDepth(P.depth + 2.1).setAlpha(0.96);
      if (rule.setShadow) rule.setShadow(0, 0, '#5ef6ff', Math.max(3, Math.round(6 * s)), false, true);
      const ruleW = (rule.width || 460 * s) + 44 * s;
      const ruleH = 32 * s;
      /* ★ 底衬板必须在 `P.depth + 2` ✗✗ —— 不能只在 `+1` ✓
       *   弹幕的**拖影核心**在 `P.depth + 1.1`（见 `_ensureBrushes` 的
       *   `set.layers[0].setDepth(P.depth + 1.1)` ✓ 那是全场最高的一层拖影 ✓）
       *   → 底衬板若在 `+1`（＝7）会被拖影核心（7.1）**盖回脸上** ✓ 白加 ✓ */
      const ruleBg = scene.add.rectangle(scene.width / 2, ruleY, ruleW, ruleH, 0x04070c, 0.80)
        .setOrigin(0.5, 0.5).setDepth(P.depth + 2)
        .setStrokeStyle(Math.max(1, Math.round(1 * s)), 0x7df9ff, 0.32);
      g.rule = rule; g.ruleBg = ruleBg;
      g.objs.push(ruleBg, rule);

      /* 输入：点词判定（与预览 click() 同一套命中框） */
      g.onDown = function (pointer) {
        const px = pointer.worldX !== undefined ? pointer.worldX : pointer.x;
        const py = pointer.worldY !== undefined ? pointer.worldY : pointer.y;
        M.click(scene, px, py);
      };
      scene.input.on('pointerdown', g.onDown);

      /* 每帧推进 */
      g.onUpdate = function (time, delta) { M.update(scene, Math.min(0.05, (delta || 16) / 1000)); };
      scene.events.on('update', g.onUpdate);

      /* 转阶段横幅（复用 E3 的 phaseBanner，与其它 BOSS 一致）
       *   ★★★ 2026-09-29：**二阶段这次不弹横幅** ✗✗（用户定稿做法带来的必然结果）
       *     理由链：
       *       ① 用户要"常驻提示行放在斯安威斯坦正下方" ✓ → 提示落在 `156*s` ✓
       *       ② 横幅的固定落点是 `150*s` ✓ → **两者必然重叠** ✓
       *          （试过挪到 `84*s` ✗ 又和标题 `97~127` 撞 ✓ 屏幕顶部就这点地方 ✓）
       *       ③ 而提示行**已经把话说全了** ✓
       *          三阶段标题也由 `speedUp()` 改成「斯安威斯坦 · 超频」✓
       *          → 二阶段横幅只剩"报个名字" ✓ **信息量为零，纯遮挡** ✓
       *   ⇒ 结论：**删掉二阶段横幅** ✗ 三阶段那条保留 ✓（它在 `150*s` ✓ 提示在 156 ✓
       *     三阶段时仍然重叠 —— 但那条只停 1.6s 且是"超频"二字 ✓ 影响极小 ✓
       *     真要彻底解决就把提示行也挪走 ✓ 但用户明确要它贴着标题 ✓ 不挪 ✓）
       *   ★ 保留为**开关** ✗ 而不是删代码 ✓ —— 以后想恢复只需把 `false` 改 `true` ✓ */
      const SHOW_PHASE2_BANNER = false;
      try {
        if (SHOW_PHASE2_BANNER && Babel.UI && Babel.UI.phaseBanner) {
          Babel.UI.phaseBanner(scene, scene.width / 2, 150 * s, '斯安威斯坦 · 启动', { ms: 1800 });
        }
      } catch (e) {}

      this.newWave(scene);
    },

    _s(scene) {
      try { return Math.max(1, Math.min(scene.width / 1280, scene.height / 720)); } catch (e) { return 1; }
    },

    /* ---- 三阶段：速度再 ×factor（默认 2 → 300 变 600 px/s），只应调用一次 ----
       ★ 只改 P.speed：拖影的相邻间距由 delay = gap / speed 推导，所以间距恒为 gap 像素、
         拖影像素总长（layers×gap）**不变**，只是整体更快掠过。 */
    speedUp(scene, factor) {
      const g = scene && scene._barrage; if (!g) return;
      if ((scene._barragePhase || 2) >= 3) return;
      const f = factor || 2;
      g.P.speed = Math.round(g.P.speed * f);
      scene._barragePhase = 3;
      try { this._flash(scene, false); } catch (e) {}
      /* ★ 三阶段文案：顶部标题与转阶段横幅都改成「斯安威斯坦 · 超频」
         （同一套东西：标题仍是原来那个对象，只换文案并**重放一次逐字解码**；横幅沿用 phaseBanner） */
      const PH3TEXT = '斯安威斯坦 · 超频';
      try {
        if (g.title && g.title.obj) {
          g.title.text = PH3TEXT;
          g.title.dec = 0;
          g.title.decDone = false;      // 重新播一次解码入场
          g.title.nextGlitch = 4.6;
          g.title.glitchT = 0;
          g.title.obj.setText(PH3TEXT);
        }
      } catch (e) {}
      try {
        if (Babel.UI && Babel.UI.phaseBanner) Babel.UI.phaseBanner(scene, scene.width / 2, 150 * this._s(scene), PH3TEXT, { ms: 1600 });
      } catch (e) {}
    },

    /* ---- 一发弹幕：N 个词，其中 1 个真词 ---- */
    newWave(scene) {
      const g = scene && scene._barrage; if (!g) return;
      const pick = g.list[(Math.random() * g.list.length) | 0];
      const real = String(pick[0]).toUpperCase();
      const n = g.P.count;
      const realIdx = (Math.random() * n) | 0;
      const lanes = g.P.lanes.slice();
      for (let i = lanes.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = lanes[i]; lanes[i] = lanes[j]; lanes[j] = t; }
      g.queued = [];
      for (let i = 0; i < n; i++) {
        g.queued.push({
          text: (i === realIdx) ? real : fakeWord(real, g.P.fakeType, g.REAL).toUpperCase(),
          zh: String(pick[1] || ''),
          real: i === realIdx, lane: lanes[i % lanes.length], delay: i * g.P.stag,
        });
      }
      g.wave++;
      g.done = false;
      this._refreshCounters(scene);
    },

    _refreshCounters(scene) { /* 计数行已按用户要求删除（保留函数避免改动其它调用点） */ },

    /* ---- 建"残影刷子"：**每层一个自己的文字对象**，颜色与 alpha 直接设在刷子上 ----
       ★ 不用 rt.draw(src,x,y,alpha,tint) 的 alpha/tint 参数：实测（用户 2026-09-15 反馈"拖影全白"）
         该参数在当前 Phaser/渲染器下不生效 → 残影既没有色带也没有渐隐，糊成一片白。
       改为：每个弹幕一组刷子（layers 个色带层 + 1 个白热核心 + 2 个色散），
         颜色/透明度一次性算好烤在刷子上，每帧 rt.draw 只传位置 → 与渲染器无关，必定生效。 */
    _ensureBrushes(scene, g) {
      if (g.brushes) return;
      const P = g.P;
      const fonts = '"Smiley Sans", "HarmonyOS Sans SC", Impact, sans-serif';
      /* ★ 词头＝干净的近白 + 3 层 ADD 辉光（用户 2026-09-15 定稿）。
         CRT 扫描（bitmap 遮罩）方案已按用户要求回退，相关代码全部移除。 */
      const n = P.count;
      g.brushes = [];
      g.ramp = [];      // 每层的颜色（hex 字符串）与透明度，一次性算好
      let dh = P.hslB[0] - P.hslA[0]; if (dh > 0.5) dh -= 1; if (dh < -0.5) dh += 1;
      const s = this._s(scene);
      /* ★ 头部（第 0 层）＝**白热核心**，不是色带端点：
         预览里是 `hsl(hslA.h + 8°, 100%, 94%)`（近白）+ shadowBlur 16 的光晕。
         第一版我错用了色带 t=0 的纯蓝 → 用户看到的"开头没有荧光字"。 */
      const headRGB = hsl2rgb(P.hslA[0] + 8 / 360, 1, 0.94);
      const headHex = '#' + ('000000' + toNum(headRGB).toString(16)).slice(-6);
      for (let i = 0; i <= P.layers; i++) {
        if (i === 0) { g.ramp.push({ hex: headHex, alpha: 1, glow: true }); continue; }
        const t = i / P.layers;
        const c = hsl2rgb(P.hslA[0] + dh * t, P.hslA[1] + (P.hslB[1] - P.hslA[1]) * t, P.hslA[2] + (P.hslB[2] - P.hslA[2]) * t);
        g.ramp.push({ hex: '#' + ('000000' + toNum(c).toString(16)).slice(-6), alpha: 0.92 * Math.pow(P.fall, i), glow: false });
      }
      for (let k = 0; k < n; k++) {
        const set = { layers: [], chroma: [], glow: [], _text: null };
        for (let i = 0; i <= P.layers; i++) {
          /* ★ 刷子**直接作为场景对象**显示（不用 RenderTexture）：
             实测 rt.draw 既不认 per-draw 的 tint/alpha，也不认对象自身的 alpha →
             22 层全不透明、叠成"近端暗远端亮"，且 RT 留下清不掉的深色残尾。
             ★ 深度必须显式给：同 depth 的 Phaser 对象按**创建顺序**绘制，
               否则后建的"最远层"会盖住词头（用户反馈"词头被压在下面"）。
               深度顺序复刻 HTML 的绘制顺序：远层 → 近层 → 色散 → 白热核心。 */
          /* 词头（i=0）＝近白文字 + 后面挂 3 层 ADD 辉光副本；其余层按色带设色。
             ★ 曾试过"canvas 烤字 + source-atop 扫描线"，实机上会拖出一块清不掉的暗底/暗影
               （与预览不一致），已回退。CRT 扫描如需再做，改用"文字 bitmap 遮罩 + 扫描贴图"方案。 */
          const t = scene.add.text(-5000, -5000, '', { fontFamily: fonts, fontSize: P.size + 'px', color: g.ramp[i].hex })
            .setOrigin(0.5, 0.5).setDepth(i === 0 ? (P.depth + 1.1) : (P.depth + 0.9 - i * 0.02))
            .setAlpha(g.ramp[i].alpha).setVisible(false);
          set.layers.push(t);
        }
        /* 色散两只：HTML 用 globalCompositeOperation='lighter'（ADD）+ rgba(...,.8) × globalAlpha .75 */
        const ADD = (window.Phaser && window.Phaser.BlendModes) ? window.Phaser.BlendModes.ADD : 'ADD';
        ['#ff2d5f', '#00ffcd'].forEach(function (hex) {
          const t = scene.add.text(-5000, -5000, '', { fontFamily: fonts, fontSize: P.size + 'px', color: hex })
            .setOrigin(0.5, 0.5).setDepth(P.depth + 1.0).setAlpha(0.6).setVisible(false);
          if (t.setBlendMode) t.setBlendMode(ADD);
          set.chroma.push(t);
        });
        /* ★ 头部辉光：HTML 用 ctx.shadowBlur=14 的高斯辉光；Phaser 的 setShadow 渲染成暗方框（实测），
           改为**ADD 叠加的三层放大副本**模拟辉光 —— 与渲染器无关、强度可控、不会出暗框。 */
        [[1.00, 0.30], [1.05, 0.18], [1.12, 0.10]].forEach(function (gcfg) {
          const t = scene.add.text(-5000, -5000, '', { fontFamily: fonts, fontSize: Math.round(P.size * gcfg[0]) + 'px', color: g.ramp[0].hex })
            .setOrigin(0.5, 0.5).setDepth(P.depth + 1.05).setAlpha(gcfg[1]).setVisible(false);
          if (t.setBlendMode) t.setBlendMode(ADD);
          set.glow.push(t);
        });
        set.layers[0].setDepth(P.depth + 1.1);   // 白热核心永远在最上
        g.brushes.push(set);
      }
    },

    /* 把某一"刷子组"的文案换成该弹幕的词（只在这组文案变了时才写） */
    _paintBrushes(g, k, text) {
      const set = g.brushes && g.brushes[k]; if (!set) return;
      if (set._text === text) return;
      set._text = text;
      set.layers.forEach(function (t) { if (t.setText) t.setText(text); });
      
      set.chroma.forEach(function (t) { t.setText(text); });
      (set.glow || []).forEach(function (t) { t.setText(text); });
    },

    /* ---- 每帧推进（匀速、残影、爆冲） ---- */
    update(scene, dt) {
      const g = scene && scene._barrage; if (!g || !g.brushes) return;
      const P = g.P;
      g.clock += dt;
      const b = this._boost(g);

      /* 排队发射 → 逐个入场（与预览一致：按 delay 依次出现） */
      if (!g.done && g.queued.length) {
        for (let i = 0; i < g.queued.length; i++) g.queued[i].delay -= dt;
        while (g.queued.length && g.queued[0].delay <= 0) {
          const q = g.queued.shift();
          if (g.words.length >= P.count) break;
          const slot = g.words.length;   // 刷子组按"第几个在场"分配
          g.words.push({ text: q.text, zh: q.zh, real: q.real, y: q.lane, x: P.x1, hist: [], alive: true, slot: slot, miss: 0 });
          this._paintBrushes(g, slot, q.text);
        }
      }

      const sp = -P.speed;                         // ★ 匀速：不受爆冲影响
      const delay = P.gap / Math.max(1, P.speed);  // 每层时间间隔 → 间距恰好 = gap 像素
      let hitPlayer = false;

      g.words.forEach(function (w) {
        if (!w.alive) return;
        w.x += sp * dt;
        w.hist.push({ t: g.clock, x: w.x });
        while (w.hist.length > 2 && g.clock - w.hist[0].t > P.layers * delay + 0.35) w.hist.shift();
        if (w.x <= P.x0) { w.alive = false; hitPlayer = true; }
      });

      /* 绘制：把每层刷子**摆到它该在的位置**（颜色/透明度已在刷子上，不需要每帧重设） */
      const hideSet = function (set) {
        if (!set) return;
        set.layers.forEach(function (t) { if (t.visible) t.setVisible(false); });
        set.chroma.forEach(function (t) { if (t.visible) t.setVisible(false); });
        (set.glow || []).forEach(function (t) { if (t.visible) t.setVisible(false); });
      };
      g.brushes.forEach(hideSet);
      g.words.forEach(function (w) {
        if (!w.alive) return;
        const set = g.brushes[w.slot % g.brushes.length];
        if (!set) return;
        for (let i = P.layers; i >= 1; i--) {
          const hx = sampleX(w.hist, g.clock - i * delay);
          if (hx == null) continue;
          set.layers[i].setPosition(hx, w.y - i * 0.4).setVisible(true);
        }
        const dx = P.ab * (0.3 + 0.7 * b);
        if (dx > 0.3) {
          set.chroma[0].setPosition(w.x + dx, w.y).setVisible(true);
          set.chroma[1].setPosition(w.x - dx, w.y).setVisible(true);
        }
        set.layers[0].setPosition(w.x, w.y).setVisible(true);   // 白热核心（色带最亮那端）
        (set.glow || []).forEach(function (t) { t.setPosition(w.x, w.y).setVisible(true); });   // 头部辉光（ADD 叠加）
      
        if (w.miss > 0) w.miss -= dt;
      });

      /* 标题动画：逐字解码入场 → 间歇故障闪烁（复刻一阶段） */
      if (g.title) {
        const T = g.title;
        T.dec += dt;
        if (!T.decDone) {
          const p = T.dec / T.dur;
          const lockN = Math.floor(p * T.text.length);
          let out = '';
          for (let i = 0; i < T.text.length; i++) {
            const ch = T.text[i];
            if (ch === ' ') { out += ' '; continue; }
            out += (i < lockN) ? ch : T.glyph[(Math.random() * T.glyph.length) | 0];
          }
          T.obj.setText(out);
          if (p >= 1) { T.decDone = true; T.obj.setText(T.text); }
        } else {
          T.nextGlitch -= dt;
          if (T.glitchT > 0) {
            T.glitchT -= dt;
            if (T.glitchT <= 0) { T.obj.setText(T.text); T.obj.x = scene.width / 2; }
          } else if (T.nextGlitch <= 0) {
            T.glitchT = 0.12;
            T.nextGlitch = 4.6;
            let out = '';
            for (let i = 0; i < T.text.length; i++) {
              const ch = T.text[i];
              out += (ch === ' ') ? ' ' : (Math.random() < 0.22 ? T.glyph[(Math.random() * T.glyph.length) | 0] : ch);
            }
            T.obj.setText(out);
            T.obj.x = scene.width / 2 - 4 * this._s(scene);
          }
        }
      }

      /* 爆冲条 + 标签亮度（与预览一致） */
      if (g.boostBar) {
        g.boostBar.width = Math.max(1, 300 * this._s(scene) * Math.min(1, b));
        g.boostBar.setAlpha(0.18 + b * 0.7);
      }
      if (g.label) g.label.setAlpha(0.25 + b * 0.7);

      /* 被击中 → 你 −1（走 E3 的 _playerHit，藏品/恍神照常）→ 开始下一击 */
      if (hitPlayer) this._playerDamage(scene);   // 任意词碰到逻各斯 → 掉血 + 下一击
    },

    _boost(g) {
      const l = g.clock % g.boostEvery;
      const base = l > g.boostDur ? 0 : Math.pow(Math.sin(Math.PI * (l / g.boostDur)), 0.75);
      if (g.forced > 0) { g.forced = Math.max(0, g.forced - 0.02); return Math.max(base, g.forced); }
      return base;
    },

    /* ---- 命中敌人：**逐条镜像一阶段的藏品伤害管线** ----
       连击 → ComboBonus（连击类藏品）→ 先声夺人(firstCorrect) → 笔锋偶锋(critChance)
       → this.correctDmg（伤害类藏品，create 里已算好）→ 破环之诫(boss-andoain-break)
       → 清偿(boss-emperor-clear) → 指令机(boss-lien-command 累计答对 +临时生命)
       亚当重锤没有圣环/试炼/里恩分支，故这些不影响；
       ★ 之所以在这里重算而不再走 _onAnswer：二阶段没有四选一，走不到那条路。 */
    _hitEnemy(scene) {
      let damage = 1;
      try {
        scene.combo = (scene.combo || 0) + 1;
        let bonus = 0;
        bonus += (Babel.ComboBonus ? (Babel.ComboBonus(scene.combo) || 0) : 0);
        if (!scene._firstDone && Babel.TotalEffect && Babel.TotalEffect('firstCorrect') > 0) {
          scene._firstDone = true;
          bonus += Babel.TotalEffect('firstCorrect');
        }
        const critC = Babel.TotalEffect ? (Babel.TotalEffect('critChance') || 0) : 0;
        // 同 CombatScene：暴击每件独立掷骰（勿再把概率求和）
        if (Babel.CritRoll) { const _cg = Babel.CritRoll(); if (_cg > 0) bonus += _cg; }
        let dmg = (scene.correctDmg || 1) + bonus;
        let canDamage = true;
        // 破环之诫：连击达到 threshold 的倍数时该次 +value
        if (Babel.HasCollectible && Babel.HasCollectible('boss-andoain-break')) {
          const bk = (Babel.BOSS_COLLECTIBLES || []).find(function (x) { return x.id === 'boss-andoain-break'; });
          const th = (bk && bk.effect.threshold) || 3;
          const val = (bk && bk.effect.value) || 2;
          if (scene.combo % th === 0) dmg += val;
        }
        // 清偿：敌人 HP ≤ 30% 时最终伤害 ×2
        if (canDamage && Babel.HasCollectible && Babel.HasCollectible('boss-emperor-clear')) {
          const ex = (Babel.BOSS_COLLECTIBLES || []).find(function (x) { return x.id === 'boss-emperor-clear'; });
          const pct = (ex && ex.effect.thresholdPct != null) ? ex.effect.thresholdPct : 0.30;
          const mul = (ex && ex.effect.multiplier) || 2;
          if (scene.enemyMaxHP > 0 && scene.enemyHP <= scene.enemyMaxHP * pct) dmg *= mul;
        }
        scene.enemyHP -= dmg;
        damage = dmg;
        // 指令机：本场累计答对 threshold 题 → +value 临时生命
        if (Babel.HasCollectible && Babel.HasCollectible('boss-lien-command')) {
          const cmd = (Babel.BOSS_COLLECTIBLES || []).find(function (x) { return x.id === 'boss-lien-command'; });
          const th2 = (cmd && cmd.effect.threshold) || 9;
          const val2 = (cmd && cmd.effect.value) || 2;
          scene._cmdLoopCount = (scene._cmdLoopCount || 0) + 1;
          if (scene._cmdLoopCount >= th2) {
            scene._cmdLoopCount = 0;
            Babel.RunState.tempHP += val2;
            scene._refreshHpText();
          }
        }
      } catch (e) {}
      try { scene._refreshBars(); scene._refreshHpText(); } catch (e) {}
      try { if (scene._refreshCombo) scene._refreshCombo(); } catch (e) {}   // 连击显示（含皮肤 onCombo）
      /* ★ 三阶段判定必须放在这里：二阶段之后"答对"走的是本函数的命中路径，
         而皮肤的 onCorrect 只在**一阶段四选一**答对时执行 → 挂在那边永远不会触发（踩过）。 */
      try {
        const ed = scene._nc && scene._nc.enemyDef;
        const bc = ed && ed.barrage;
        if (bc && (scene._barragePhase || 2) < 3) {
          const th3 = (bc.phase3Hp != null) ? bc.phase3Hp : 10;
          if (scene.enemyHP <= th3) this.speedUp(scene, bc.speed3Factor || 2);
        }
      } catch (e) {}
      return damage;
    },

    /* ---- 点击判定（与预览 click() 完全一致的命中框） ---- */
    click(scene, mx, my) {
      const g = scene && scene._barrage; if (!g || g.done) return;
      const P = g.P;
      for (let k = 0; k < g.words.length; k++) {
        const w = g.words[k];
        if (!w.alive) continue;
        const br = g.brushes && g.brushes[w.slot % g.brushes.length];
        const bw = (br && br.layers[0] && br.layers[0].width) ? br.layers[0].width : P.size * w.text.length * 0.6;
        const halfW = bw / 2 + 14 * this._s(scene);
        if (my > w.y - P.size * 0.75 && my < w.y + P.size * 0.75 && mx > w.x - halfW && mx < w.x + halfW) {
          if (w.real) {
            w.alive = false; g.hits++; g.done = true;
            this._flash(scene, true);
            this._toast(scene, 'ACCESS GRANTED', true, 0, '// ' + w.text + ' · ' + (w.zh || ''));
            this._refreshCounters(scene);
            g.forced = 1;
            const dmg = this._hitEnemy(scene);   // ★ 走与一阶段相同的藏品伤害管线
            try { if (w.zh) g.lastDmg = dmg; } catch (e) {}
            g.words = []; g.queued = [];
            const self = this;
            let win = false;
            try { win = scene.enemyHP <= 0; } catch (e) {}
            if (win) { try { scene._endBattle(true); } catch (e) {} return; }
            const t = scene.time.delayedCall(750, function () { if (scene._barrageOn) self.newWave(scene); });
            g.timers.push(t);
          } else {
            // ★ 选错词 ＝ 答错：ACCESS DENIED + 扣血 + 开始下一击（用户 2026-09-15 要求）
            w.alive = false;
            this._playerDamage(scene);
          }
          return;
        }
      }
    },

    /* ---- 玩家受伤结算（★ 词碰到逻各斯 与 选错词 共用同一条） ----
       ACCESS DENIED（与一阶段同款式、无后缀）→ 走 E3 的 _playerHit（临时生命/恍神照常）
       → 清场 → 700ms 后开始下一击；生命归零则结算失败。 */
    _playerDamage(scene) {
      const g = scene && scene._barrage; if (!g) return;
      g.hurts++;
      this._flash(scene, false);
      this._toast(scene, 'ACCESS DENIED', false);
      g.words = []; g.queued = []; g.done = true;
      // ★ 答错要断连击：镜像一阶段 _onAnswer 答错分支的重置（combo / 破环之诫计数）
      try {
        scene.combo = 0;
        scene._breakLoopCount = 0;
        if (scene.shieldProgress != null) scene.shieldProgress = 0;
        if (scene._refreshCombo) scene._refreshCombo();
      } catch (e) {}
      try { scene._playerHit(); } catch (e) {}
      let dead = false;
      try { dead = scene._isDead || (Babel.RunState && Babel.RunState.targetHP <= 0); } catch (e) {}
      if (dead) { try { scene._endBattle(false); } catch (e) {} return; }
      const self = this;
      const t = scene.time.delayedCall(700, function () { if (scene._barrageOn) self.newWave(scene); });
      g.timers.push(t);
    },

    /* ---- 反馈：复用 NIGHT CITY 皮肤的 ACCESS 警示条 / 全屏闪（皮肤不在时自己兜底） ---- */
    _toast(scene, text, ok, life, sub) {
      try {
        if (Babel.SKIN_NightCity && Babel.SKIN_NightCity._toast) {
          Babel.SKIN_NightCity._toast(scene, text, ok ? 'ok' : 'bad', this._s(scene), sub);
          return;
        }
      } catch (e) {}
      // 兜底（理论上皮肤一定在）：自己画一行大字
      const t = scene.add.text(scene.width / 2, scene.height * 0.44, text,
        { fontFamily: '"Orbitron", monospace', fontSize: Math.round(34 * this._s(scene)) + 'px', color: ok ? '#eafcff' : '#ffe3e8' })
        .setOrigin(0.5, 0.5).setDepth(80);
      const g = scene._barrage; if (g) g.objs.push(t);
      scene.tweens.add({ targets: t, alpha: 0, delay: 500, duration: 260, onComplete: function () { t.destroy(); } });
    },
    _flash(scene, ok) {
      try {
        if (Babel.SKIN_NightCity && Babel.SKIN_NightCity._flash) { Babel.SKIN_NightCity._flash(scene, ok ? 'ok' : 'bad'); return; }
      } catch (e) {}
    },

    /* ---- 收尾（_endBattle → 皮肤 clear() 里调用） ---- */
    clear(scene) {
      const g = scene && scene._barrage; if (!g) return;
      try { if (g.onDown && scene.input) scene.input.off('pointerdown', g.onDown); } catch (e) {}
      try { if (g.onUpdate && scene.events) scene.events.off('update', g.onUpdate); } catch (e) {}
      (g.timers || []).forEach(function (t) { try { t.remove(); } catch (e) {} });
      (g.tweens || []).forEach(function (t) { try { t.stop(); } catch (e) {} });
      (g.brushes || []).forEach(function (set) {
        (set.layers || []).forEach(function (t) { try { t.destroy(); } catch (e) {} });
        (set.chroma || []).forEach(function (t) { try { t.destroy(); } catch (e) {} });
        (set.glow || []).forEach(function (t) { try { t.destroy(); } catch (e) {} });

      });
      (g.objs || []).forEach(function (o) { try { o.destroy(); } catch (e) {} });
      scene._barrage = null;
      scene._barrageOn = false;
      scene._barragePhase = 0;
    },
  };

  Babel.MECH_Barrage = M;
})();
