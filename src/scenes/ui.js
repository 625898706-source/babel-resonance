/* ============================================================================
 * ui.js —— 通用 UI 工具（按钮 / 文字 / 面板），统一遵守设计系统
 * ----------------------------------------------------------------------------
 * 【本文件作用】
 * 封装几个常用的"画 UI"小函数，让所有场景都长得一致、写起来省事：
 *   Babel.UI.text  → 加一段文字（默认深色主题羊皮纸色）
 *   Babel.UI.panel → 画一块圆角面板（卡片）
 *   Babel.UI.button→ 做一个可点击的按钮（含按压反馈）
 * ----------------------------------------------------------------------------
 * 【统一风格】
 * 全部套用 UI 文档 v0.2 的配色与字体（Academia 深色 + 羊皮纸文字 + 黄铜描边）。
 * ========================================================================== */

window.Babel = window.Babel || {};

Babel.UI = {
  /* 加文字。opts: {font,size,color,align,origin:[x,y],bold} */
  text(scene, x, y, str, opts) {
    const o = opts || {};
    const t = scene.add.text(x, y, str, {
      fontFamily: o.font || Babel.FONTS.body,
      fontSize: o.size || '20px',
      color: o.color || Babel.COLORS.DARK.fg,
      align: o.align || 'left',
      fontStyle: o.bold ? 'bold' : 'normal',
    });
    if (o.origin) t.setOrigin(o.origin[0], o.origin[1]);
    return t;
  },

  /* 胶囊标签（可带数值）。左侧中点锚点；返回容器：c._label / c._val / c.setValue(s) / c._w
   * 单一字体（num）+ 单一文本行 → 不会出现多字体基线错位 */
  chip(scene, x, y, label, value, opts) {
    const o = opts || {};
    const h = o.h == null ? 26 : o.h;
    const padX = o.padX == null ? 10 : o.padX;
    const size = o.size || '13px';
    const col = o.color || '#1f2024';
    const lab = scene.add.text(padX, 0, label, { fontFamily: Babel.FONTS.num, fontSize: size, color: col, fontStyle: 'bold' }).setOrigin(0, 0.5);
    const val = (value == null) ? null : scene.add.text(padX + lab.width + 6, 0, String(value),
      { fontFamily: Babel.FONTS.num, fontSize: size, color: col }).setOrigin(0, 0.5);
    const w = o.w == null ? (padX * 2 + lab.width + (val ? 6 + val.width : 0)) : o.w;
    const bg = scene.add.rectangle(0, 0, w, h, o.fill == null ? Babel.COLORS.CARD_N : o.fill)
      .setOrigin(0, 0.5).setStrokeStyle(o.lineW == null ? 1 : o.lineW, o.stroke == null ? Babel.COLORS.INK_N : o.stroke);
    let bareLine = null;
    if (o.bare) {   // 展签式：无框，只留一条 1px 黑底线
      bg.setFillStyle(Babel.COLORS.CARD_N, 0);
      bg.isStroked = false;
      bareLine = scene.add.rectangle(0, h / 2, w, 1, Babel.COLORS.INK_N).setOrigin(0, 0.5);
    }
    const c = scene.add.container(x, y, (o.bare ? [bg, bareLine] : [bg]).concat([lab]).concat(val ? [val] : []));
    c._label = lab; c._val = val; c._w = w;
    c.setValue = function (s) { if (c._val) c._val.setText(String(s)); return c; };
    // 兼容层：原本对 Text 调用的 setText/链式写法，换成胶囊后依然可用
    c.setText = function (s) { lab.setText(String(s)); return c; };
    return c;
  },

  /* 圆点贴图：用 Canvas 画「抗锯齿的圆」（Phaser 的 add.circle 在 WebGL 下是多边形近似，边缘毛糙）。
   * 只在首次使用时生成一次，之后各战斗共用。 */
  _makeDot(scene, key, fillCss) {
    if (scene.textures.exists(key)) return;
    try {
      const S = 128;
      const ct = scene.textures.createCanvas(key, S, S);
      if (!ct) return;
      const g = ct.getContext();
      g.clearRect(0, 0, S, S);
      g.beginPath();
      g.arc(S / 2, S / 2, S / 2 - 5, 0, Math.PI * 2);
      g.fillStyle = fillCss;
      g.fill();
      g.lineWidth = 7;                 // 128px 贴图里的 7px ≈ 显示 18px 时的 1px 描边
      g.strokeStyle = '#1f2024';
      g.stroke();
      ct.refresh();
    } catch (e) {}
  },

  /* 指示器（默认方形；opts.round=true 用抗锯齿圆形贴图）。左侧中点锚点；返回 c.setOn(n)/c._w */
  pips(scene, x, y, max, on, opts) {
    const o = opts || {};
    const sz = o.size == null ? 14 : o.size, gap = o.gap == null ? 4 : o.gap;
    const onC = o.onColor == null ? 0xff625d : o.onColor;
    const round = !!o.round;
    const onKey = 'ui-dot-on', offKey = 'ui-dot-off';
    if (round) {
      const onCss = '#ff625d';                                  // 圆形贴图固定红/纸白两态
      this._makeDot(scene, onKey, onCss);
      this._makeDot(scene, offKey, '#fffdf9');
    }
    const c = scene.add.container(x, y);
    const cells = [];
    for (let i = 0; i < max; i++) {
      const filled = i < on;
      let r;
      if (round) {
        r = scene.add.image(i * (sz + gap) + sz / 2, 0, filled ? onKey : offKey).setDisplaySize(sz, sz);
      } else {
        r = scene.add.rectangle(i * (sz + gap), 0, sz, sz, filled ? onC : Babel.COLORS.CARD_N)
          .setOrigin(0, 0.5).setStrokeStyle(1, Babel.COLORS.INK_N);
      }
      c.add(r); cells.push(r);
    }
    c.cells = cells;
    c._w = max * (sz + gap) - gap;
    c.setOn = function (n) {
      cells.forEach(function (r, i) {
        if (round) { r.setTexture(i < n ? onKey : offKey); }
        else { r.setFillStyle(i < n ? onC : Babel.COLORS.CARD_N); }
      });
    };
    return c;
  },
  /* 编辑风"条目式选项"（无框：细底线 + 左侧序号）。
   * children 顺序恒为 [0]=可点矩形 [1]=文字（战斗逻辑依赖此顺序）；[2]=序号 [3]=底线 */
  row(scene, x, y, w, h, key, label, onClick, opts) {
    const o = opts || {};
    const accent = o.accent == null ? 0x8c1d1d : o.accent;
    const line = o.line == null ? Babel.COLORS.LINE_N : o.line;
    const c = scene.add.container(x, y);
    const hit = scene.add.rectangle(0, 0, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
    const noKey = !!o.noKey;
    const ctr = !!o.center;
    const t = scene.add.text(ctr ? 0 : (-w / 2 + (noKey ? 0 : 46)), 0, label, {
      fontFamily: o.font || Babel.FONTS.body, fontSize: o.size || '23px', color: o.color || '#141414',
    }).setOrigin(0, 0.5);
    if (ctr) t.setOrigin(0.5, 0.5);   // 居中版（选项文字居中）
    if (o.wrap) t.setWordWrapWidth(w - (ctr ? 12 : (noKey ? 8 : 58)), true);
    const idx = noKey ? null : scene.add.text(-w / 2 + 10, 0, key, {
      fontFamily: Babel.FONTS.display, fontSize: o.keySize || '13px', color: o.keyColor || '#8c1d1d',
    }).setOrigin(0, 0.5);
    const rule = scene.add.rectangle(0, h / 2 - 1, w, o.lineW == null ? 1 : o.lineW, line).setOrigin(0.5, 0.5);
    c.add(idx ? [hit, t, idx, rule] : [hit, t, rule]);
    hit.on('pointerover', () => rule.setFillStyle(accent));
    hit.on('pointerout', () => rule.setFillStyle(line));
    hit.on('pointerdown', () => c.setAlpha(0.55));
    hit.on('pointerup', () => { c.setAlpha(1); if (onClick) onClick(); });
    return c;
  },
  /* 藏品效果浮层（地图"藏品背包"与商店货架共用）
     · 显示：稀有度·名字（稀有度色，body 13px）+ 完整效果 desc（12px）
     · o.s：整体缩放（默认 1，与地图原实现完全一致）
     · o.note：可选第三行（商店用来放价格）
     · o.buttons：[{label,onClick}] → 有按钮时面板自动加高，按钮横排
     · o.depth：面板深度（默认 60，文字 +1）
     · 返回 { objs, close }：close() 会销毁全部对象，调用方负责在合适时机调用 */
  collectiblePopup(scene, c, x, y, o) {
    const q = o || {};
    const s = q.s == null ? 1 : q.s;
    const F = (v) => Math.round(v * s) + 'px';
    const depth = q.depth == null ? 60 : q.depth;
    const btns = q.buttons || [];
    const rc = Babel.RARITY_COLOR[c.rarity] || Babel.COLORS.MUTED;
    const descTxt = c.desc || '';
    const w = Math.min(scene.width - 16 * s, Math.max(240 * s, descTxt.length * 13 * s + 40 * s));
    const h = 60 * s + (q.note ? 26 * s : 0) + (btns.length ? 58 * s : 0);
    const tx = Math.min(Math.max(x, w / 2 + 8 * s), scene.width - w / 2 - 8 * s);
    const top = y - h / 2;
    const objs = [];
    const panel = Babel.UI.panel(scene, tx - w / 2, top, w, h, 0xffffff, 0x0a0b0d, 4);
    panel.setDepth(depth);
    objs.push(panel);
    const t1 = Babel.UI.text(scene, tx, top + 17 * s, (Babel.RARITY_LABEL[c.rarity] || '') + ' · ' + c.name,
      { font: Babel.FONTS.body, size: F(13), color: rc, origin: [0.5, 0.5], bold: true });
    t1.setDepth(depth + 1);
    objs.push(t1);
    const t2 = Babel.UI.text(scene, tx, top + 43 * s, descTxt,
      { size: F(12), color: '#24252a', origin: [0.5, 0.5] });
    t2.setDepth(depth + 1);
    objs.push(t2);
    if (q.note) {
      const t3 = Babel.UI.text(scene, tx, top + 69 * s, q.note,
        { size: F(12), color: '#e2231a', origin: [0.5, 0.5] });
      t3.setDepth(depth + 1);
      objs.push(t3);
    }
    if (btns.length) {
      const bw = Math.min(150 * s, (w - 24 * s) / btns.length - 8 * s);
      const byCenter = top + h - 29 * s;
      const totalW = btns.length * bw + (btns.length - 1) * 10 * s;
      btns.forEach((b, i) => {
        const bx = tx - totalW / 2 + bw / 2 + i * (bw + 10 * s);
        const o2 = Babel.UI.button(scene, bx, byCenter, bw, 38 * s, b.label, b.onClick,
          { color: b.primary ? undefined : Babel.COLORS.DARK.muted, size: F(14) });
        o2.setDepth(depth + 2);
        objs.push(o2);
      });
    }
    return {
      objs: objs,
      close: function () { objs.forEach(function (x2) { try { x2.destroy(); } catch (e) {} }); },
    };
  },

  /* 画一块圆角面板（不自动返回交互）。默认卡片色。 */
  panel(scene, x, y, w, h, fill, stroke, radius, alpha, lineW) {
    const g = scene.add.graphics();
    const r = (radius == null ? 10 : radius);
    // 硬阴影（印刷/工作台质感）：右下偏移的实心块，比模糊阴影更"纸"、且零性能开销
    try {
      g.fillStyle(Babel.COLORS.INK_N, 0.13);
      g.fillRoundedRect(x + 3, y + 3, w, h, r);
    } catch (e) {}
    g.fillStyle(fill || Babel.COLORS.DARK.card, alpha == null ? 1 : alpha);
    g.fillRoundedRect(x, y, w, h, r);
    if (stroke) {
      g.lineStyle(lineW == null ? 2 : lineW, stroke, 1);
      g.strokeRoundedRect(x, y, w, h, r);
    }
    return g;
  },

  /* 让场景在窗口/画布尺寸变化时自动重建，重新用正确的 this.scale 布局。
   * 作用：Electron/浏览器启动时画布可能先小后大，若场景只按"创建时尺寸"摆一次，
   *      窗口放大后内容会挤在左上角。绑定 resize 后尺寸真实变化即 restart 重排。
   * 注意：场景状态应存于 Babel.RunState（跨场景持久），重启才会安全。 */
  autoResize(scene) {
    let lastW = scene.scale.width, lastH = scene.scale.height;
    const handler = (gs) => {
      const w = gs && gs.width, h = gs && gs.height;
      if (w && h && (w !== lastW || h !== lastH)) {
        lastW = w; lastH = h;
        // 用延迟避免拖动窗口时连续多次触发
        clearTimeout(scene._resizeTimer);
        scene._resizeTimer = setTimeout(() => scene.scene.restart(), 120);
      }
    };
    scene.scale.on('resize', handler);
    scene.events.once('shutdown', () => {
      scene.scale.off('resize', handler);
      clearTimeout(scene._resizeTimer);
    });
  },

  /* 退出本局确认（2026-09-18 用户要求）：误点右上「返回」会直接退掉整局 ✗ → 必须二次确认 ✓
   * · 白底遮罩用 setInteractive() 挡住下层所有点击 ✓（否则背后的按钮还能点到 ✗）
   * · 用 Rectangle.setInteractive() —— 它自带形状 ✓ 不会踩"Container 无 hitArea 抛错"那个坑 ✗
   * · depth 900+ ：NIGHT CITY 皮肤的 HUD 在 depth 2~4 ✓ 一定盖得住 ✓
   * · 红字提示（唯一红 #e2231a）+「退出」/「继续」两个按钮 ✓ 点「退出」才真的走 ✓ */
  confirmQuit(scene, onYes) {
    if (scene._quitAsk) return;                       // 已弹出 → 不重复弹 ✓
    const W = scene.scale.width, H = scene.scale.height;
    const s = scene._sc || Math.max(1, Math.min(W / 1280, H / 720));
    const cx = W / 2, cy = H / 2;
    const P = (v) => Math.round(v * s) + "px";
    const objs = [];
    const add = (o) => { objs.push(o); return o; };
    scene._quitAsk = objs;
    const close = () => {
      (scene._quitAsk || []).forEach(function (o) { try { o.destroy(); } catch (e) {} });
      scene._quitAsk = null;
    };
    add(scene.add.rectangle(cx, cy, W, H, 0xffffff, 0.96).setDepth(900).setInteractive());
    add(Babel.UI.text(scene, cx, cy - 74 * s, "要退出本局游戏吗？",
      { font: Babel.FONTS.body, size: P(34), color: "#e2231a", origin: [0.5, 0.5], bold: true }).setDepth(901));
    add(Babel.UI.text(scene, cx, cy - 26 * s, "退出后本局进度不会保留。",
      { font: Babel.FONTS.body, size: P(15), color: "#6f6f6f", origin: [0.5, 0.5] }).setDepth(901));
    add(scene.add.rectangle(cx, cy + 14 * s, 420 * s, Math.max(1, Math.round(1 * s)), Babel.COLORS.LINE_N).setDepth(901));
    add(Babel.UI.button(scene, cx - 108 * s, cy + 76 * s, 190 * s, 48 * s, "退出",
      () => {
      close();
      /* ★★ 战斗测试局：**不记数据、不进每局总结**，直接回测试界面（2026-09-18 用户要求）
       *   注意：测试局的「战斗结算」本来就被 _endBattle 里的测试判定跳过了 ✓
       *        这里补的是**退出按钮**这条路 ✗（上一轮我漏了它 ✓） */
      try { if (scene && scene._isTest) { scene.scene.start('Test'); return; } } catch (e) {}
      try { if (Babel.RunState && Babel.RunState.finishRun) Babel.RunState.finishRun('quit'); } catch (e) {}
      /* ★ 正常局：中途退出也要有总结 ✓ 直接进总结 ✓ 不调用 onYes ✗
       *   → BGM 与各场景状态都不受影响 ✓ */
      try { if (scene && scene.scene && Babel.RunState && Babel.RunState.runLog && Babel.RunState.runLog.endedAt) { scene.scene.start('Summary'); return; } } catch (e) {}
      if (onYes) onYes();
    }, { primary: true, size: P(18) }).setDepth(902));   // ★ 本局总结：中途退出（测试局已排除 ✓）
    add(Babel.UI.button(scene, cx + 108 * s, cy + 76 * s, 190 * s, 48 * s, "继续",
      () => { close(); }, { size: P(18) }).setDepth(902));
  },

  /* 转阶段横幅：敌人上方的大字，停留 3 秒后淡出并销毁（后续所有敌人转阶段都可复用）。
   * opts: {size, color, font} */
  phaseBanner(scene, x, y, text, opts) {
    // 弹新台词前，先把上一条立即销毁（避免淡出未尽的台词重叠）
    if (scene._bannerText) {
      if (scene._bannerTween) scene._bannerTween.stop();
      scene._bannerText.destroy();
      scene._bannerText = null;
      scene._bannerTween = null;
    }
    const o = opts || {};
    const t = scene.add.text(x, y, text, {
      fontFamily: o.font || Babel.FONTS.heading,
      fontSize: o.size || '30px',
      color: o.color || '#ff625d',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0.5).setDepth(80);
    // 完全可见 2.5s，再 0.5s 淡出 → 总共约 3 秒
    const tw = scene.tweens.add({
      targets: t, alpha: 0, delay: 2500, duration: 500,
      onComplete: function () {
        if (scene._bannerText === t) { scene._bannerText = null; scene._bannerTween = null; }
        t.destroy();
      },
    });
    scene._bannerText = t;
    scene._bannerTween = tw;
    return t;
  },

  /* 做一个可点击按钮。opts: {fill,stroke,color,hover,font,size,key,wrap,lineW,marker}
   * opts.key    —— 传了就在左侧画键位帽（A/B/C/D），文字自动左对齐（选项按钮用）
   * opts.marker —— 悬停时左侧滑出标志黄标记条（默认开）
   * 容器 children 顺序恒为 [0]=可点矩形 [1]=文字：战斗逻辑依赖此顺序（勿改） */
  button(scene, x, y, w, h, label, onClick, opts) {
    const o = opts || {};
    const fill = o.fill || Babel.COLORS.CARD_N;   // 纸白卡
    const stroke = o.stroke || 0xfff44f;          // 标志黄描边
    const hover = o.hover || 0xfffbe0;            // 悬停：淡黄
    const hasKey = !!o.key;

    const c = scene.add.container(x, y);
    const r = scene.add.rectangle(0, 0, w, h, fill).setStrokeStyle(o.lineW == null ? 2 : o.lineW, stroke);
    const t = scene.add.text(hasKey ? (-w / 2 + 52) : 0, 0, label, {
      fontFamily: o.font || Babel.FONTS.body,
      fontSize: o.size || '20px',
      color: o.color || Babel.COLORS.DARK.fg,
    }).setOrigin(hasKey ? 0 : 0.5, 0.5);
    if (o.wrap) t.setWordWrapWidth(w - (hasKey ? 76 : 28), true);
    c.add([r, t]);   // 顺序：0=矩形 1=文字

    // 键位帽 A/B/C/D
    if (hasKey) {
      const ks = Math.min(28, h - 22);
      const kx = -w / 2 + 27;
      const kb = scene.add.rectangle(kx, 0, ks, ks, 0xffffff).setStrokeStyle(1, Babel.COLORS.INK_N);
      const kt = scene.add.text(kx, 0, o.key,
        { fontFamily: Babel.FONTS.num, fontSize: Math.round(ks * 0.5) + 'px', color: '#1f2024' }).setOrigin(0.5, 0.5);
      c.add([kb, kt]);
    }
    // 悬停标记条（印刷"选中"语汇）
    let bar = null;
    if (o.marker !== false) {
      bar = scene.add.rectangle(-w / 2 + 4, 0, 4, Math.max(10, h - 22), 0xfff44f).setVisible(false);
      c.add([bar]);
    }

    // 交互与按压反馈
    r.setInteractive({ useHandCursor: true });
    r.on('pointerover', () => { r.setFillStyle(hover); if (bar) bar.setVisible(true); });
    r.on('pointerout', () => { r.setFillStyle(fill); if (bar) bar.setVisible(false); });
    r.on('pointerdown', () => c.setScale(0.98));
    r.on('pointerup', () => { c.setScale(1); if (onClick) onClick(); });

    return c;
  },

  /* ==========================================================================
   * 地图/场景"氛围背景"：深色图书馆 + 烛光 + 暗角 + 纸纹。
   * 全部用 Canvas 程序化生成纹理，无需图片素材。每个场景 create() 里调用：
   *   Babel.UI.atmosphere(this);
   * ======================================================================== */

  // 确保三张程序化纹理已生成（只生成一次）
  _ensureAtmosphere(scene) {
    if (!scene.textures.exists('glow-candle')) this._makeGlow(scene, 'glow-candle');
    if (!scene.textures.exists('vignette')) this._makeVignette(scene, 'vignette');
    if (!scene.textures.exists('grain')) this._makeGrain(scene, 'grain');
  },

  // 往场景里铺氛围层：纸纹 + 极淡暗角（程序化生成，此前写好却从未启用）
  // 关键：全部放负 depth（-10/-9），永远在所有 UI/机制元素之下，不会干扰任何战斗机制的布局
  atmosphere(scene) {
    try {
      this._ensureAtmosphere(scene);
      const W = scene.scale.width, H = scene.scale.height;
      // 纸纹：用 tileSprite 保持颗粒原始尺度（拉伸会把噪点拉成条纹）
      const gr = scene.add.tileSprite(W / 2, H / 2, W, H, 'grain').setDepth(-10);
      gr.setAlpha(0.05);
      try { gr.setBlendMode(Phaser.BlendModes.MULTIPLY); } catch (e) {}
      scene.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setAlpha(0.55).setDepth(-9);
    } catch (e) { /* 纹理生成失败也不影响游戏 */ }
  },

  /* 顶部"编辑风"头部：黄色 pill + 标签 + 大标题 + 小标签（参照参考截图） */
  editorHeader(scene, floorCfg) {
    const C = Babel.COLORS;
    const W = scene.scale.width;

    // 顶部分隔条
    scene.add.rectangle(W / 2, 0, W, 44, 0xffffff).setOrigin(0.5, 0).setStrokeStyle(1, Babel.COLORS.LINE_N);

    // 左：黄色 pill "B1 / 01"
    scene.add.rectangle(30, 22, 84, 24, 0xfff44f).setOrigin(0, 0.5).setStrokeStyle(1, 0x0a0b0d);
    Babel.UI.text(scene, 72, 22, 'B' + floorCfg.id + ' / 01',
      { font: Babel.FONTS.display, size: '13px', color: '#0a0b0d', origin: [0.5, 0.5] });
    // 标签
    Babel.UI.text(scene, 126, 22, '// FLOOR  ·  ' + floorCfg.name,
      { font: Babel.FONTS.display, size: '12px', color: C.MUTED, origin: [0, 0.5] });

    // 大标题 + 小标签 + 说明（水平居中）
    // ★ 数据驱动（2026-09-18 用户：这行原来是写死的 '01 / 探索 / LEXICAL DOMAIN' ✗）
    //   层号取自 floorCfg.id ✓ 英文语域名取自 floorCfg.en ✓（加新层自动正确 ✓）
    Babel.UI.text(scene, W / 2, 100, String(floorCfg.id).padStart(2, '0') + ' / 探索 / ' + (floorCfg.en || ''),
      { font: Babel.FONTS.display, size: '11px', color: C.MUTED, origin: [0.5, 0.5] });
    // ★ 标题＝「罗马数字 + 名称」两段拼接、整体居中（2026-09-18 用户要求加层号 ✓）
    //   罗马数字用拉丁字母 I/V/X 拼 ✓ 与标题同字体(Heading)/同字号(56px)/同色(#c9c8c2) ✓ 视觉一致 ✓
    //   ★ 不用 Unicode 的 Ⅰ Ⅱ（CJK 码位 ✓ Novecento 没有字形 → 会换字体 ✗）
    const _tt = { font: Babel.FONTS.heading, size: '56px', color: '#c9c8c2', origin: [0, 0.5] };
    const _tNum = Babel.UI.text(scene, 0, 146, Babel.UI._roman(floorCfg.id), _tt);
    // ★ 中间加点（2026-09-18 用户要求）：同字体/字号/颜色 ✓ Novecento 的中点字形本身很小 ✓ 不突兀 ✓
    const _tDot = Babel.UI.text(scene, 0, 146, '·', _tt);
    const _tName = Babel.UI.text(scene, 0, 146, floorCfg.name, _tt);
    const _gap = 12;                       // 间距（中间多了一个点 → 由 22 收到 12 ✓ 免得松垮 ✗）
    const _total = _tNum.width + _gap * 2 + _tDot.width + _tName.width;
    _tNum.x = W / 2 - _total / 2;
    _tDot.x = _tNum.x + _tNum.width + _gap;
    _tName.x = _tDot.x + _tDot.width + _gap;
    // 说明行仍单独居中（不受上面两段影响 ✓）
    Babel.UI.text(scene, W / 2, 184, floorCfg.desc,
      { color: C.MUTED, size: '14px', origin: [0.5, 0.5] });
  },

  /* 罗马数字（层号用 ✓）：只用到 39 就够 ✓
   * ★ 必须用**拉丁字母** I/V/X 拼 ✗ 不要用 Unicode 的 Ⅰ Ⅱ Ⅲ（那是 CJK 码位 ✓
   *   `FONTS.heading`(Novecento) 没有那些字形 → 会掉字形/换字体 ✓ 就不"与标题一致"了 ✗） */
  _roman(n) {
    const T = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let s = '', v = Math.max(1, Math.floor(n || 1));
    T.forEach(function (p) { while (v >= p[0]) { s += p[1]; v -= p[0]; } });
    return s;
  },

  // 生成一张径向渐变纹理（中心亮、四周透）——用于中性柔光
  _makeGlow(scene, key) {
    const size = 256;
    const ct = scene.textures.createCanvas(key, size, size);
    const ctx = ct.getContext();
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(246,247,243,0.10)');   // 中性柔白
    g.addColorStop(0.5, 'rgba(255,255,255,0.04)');
    g.addColorStop(1, 'rgba(0,0,0,0)');            // 边透
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    ct.refresh();
  },

  // 生成暗角纹理：中心透、四周渐暗
  _makeVignette(scene, key) {
    const W = 1280, H = 720;
    const ct = scene.textures.createCanvas(key, W, H);
    const ctx = ct.getContext();
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.68);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.65, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(8,5,3,0.9)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ct.refresh();
  },

  // 生成纸纹噪点纹理（细微颗粒）
  _makeGrain(scene, key) {
    const size = 256;
    const ct = scene.textures.createCanvas(key, size, size);
    const ctx = ct.getContext();
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(Math.random() * 255);
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v;
      img.data[i + 3] = Math.floor(Math.random() * 60); // 很低的透明度
    }
    ctx.putImageData(img, 0, 0);
    ct.refresh();
  },
};

/* 显示用：最多保留 1 位小数（去掉浮点尾数；后台仍用完整精度） */
Babel.fmt1 = function (n) {
  const v = Math.round(n * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};

/* 播放背景音乐（循环、音量按配置）；若未加载则动态加载后播放；绝不影响游戏。
 * cfg 默认 Babel.BGM；可传 {key,url,volume} 播放"专属曲目"（如 BOSS 专属 BGM）。
 * 切换曲目时会自动停止旧曲、加载并播放新曲。内部用持久 sound 对象，可再次补播。 */
Babel.PlayMusic = function (scene, cfg) {
  // ★ 保险：除用户显式静音外，每次播放前都确保静音标志为 false。
  //   （sound.mute 是 game 级、跨场景持久的；一旦被置 true，后续所有场景都会静音且无人复位）
  try { if (!Babel._userMuted && scene && scene.sound) scene.sound.mute = false; } catch (e) {}
  // 兼容旧调用：PlayMusic(scene, true) 里的布尔 true 当"播放默认曲"处理，避免误判为切歌/加载 undefined
  cfg = (cfg && typeof cfg === 'object') ? cfg : Babel.LayerBGM();
  // 记录当前"想播放"的曲目与场景：加载完成后收敛到这个意图（避免切歌竞态/漏播）
  Babel._bgmIntent = cfg.key;
  Babel._bgmIntentCfg = cfg;
  Babel._bgmScene = scene;
  try {
    const cache = scene.cache && scene.cache.audio;
    const has = cache && cache.get ? !!cache.get(cfg.key)
      : (cache && cache.exists ? cache.exists(cfg.key) : false);
    // 若当前在播别的曲目 → 停掉，准备切歌
    if (Babel._bgmSound && Babel._bgmSound.key !== cfg.key) {
      try { Babel._bgmSound.stop(); Babel._bgmSound.destroy(); } catch (e) {}
      Babel._bgmSound = null;
    }
    if (has) {
      // 同曲已存在 → 保持原样（跨场景持续，避免每次切节点都重头放）
      if (Babel._bgmSound && Babel._bgmSound.key === cfg.key) return;
      // 切到另一首曲目（如 BOSS 专属曲）→ 停旧建新
      if (Babel._bgmSound) {
        try { Babel._bgmSound.stop(); Babel._bgmSound.destroy(); } catch (e) {}
        Babel._bgmSound = null;
      }
      Babel._bgmSound = scene.sound.add(cfg.key, { loop: true, volume: (cfg.volume == null ? Babel.BGM.volume : cfg.volume) });
      Babel._bgmSound.play();
      return;
    }
    // 音频还没加载 → 动态加载（带时间戳缓存戳，避免浏览器用旧音频缓存）
    if (Babel._loadingBgm) return;
    Babel._loadingBgm = true;
    const bust = (cfg.url.indexOf('?') >= 0 ? '&' : '?') + 'v=' + Date.now();
    scene.load.audio(cfg.key, cfg.url + bust);
    scene.load.once('complete', function () {
      Babel._loadingBgm = false;
      const want = Babel._bgmIntentCfg;
      if (want && Babel._bgmScene) Babel.PlayMusic(Babel._bgmScene, want);
    });
    scene.load.start();
  } catch (e) { /* 忽略音频错误，不影响游戏 */ }
};

// 返回"当前层默认 BGM"（每层各自的 map BGM）；回退到全局 Babel.BGM
Babel.LayerBGM = function () {
  try {
    const fc = Babel.RunState.getFloorConfig();
    if (fc && fc.bgm) return fc.bgm;
  } catch (e) {}
  return Babel.BGM;
};
