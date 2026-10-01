/* ============================================================================
 * nightcity.js —— 「NIGHT CITY / 夜之城」战斗皮肤（**亚当重锤专属**）
 * ----------------------------------------------------------------------------
 * ★★ 红线（用户反复强调）：**绝不影响其他任何战斗**。本文件遵守三条铁律：
 *    1) 只在 `enemy.skin === 'nightcity'` 时被 CombatScene 调用；其它战斗的代码路径一行都不变。
 *    2) 不修改 `Babel.COLORS` / `Babel.UI` / `Babel.FONTS` 的任何默认值（只在本场内对
 *       "本场自己的对象"重上色、加图层）。
 *    3) 立绘素材（logos-idle.png 等）一个字节都不改；全息效果由**皮肤自己的立绘牌贴图**实现：
 *       assets/img/plate-logos-holo.png（青色全息 · 逻各斯）
 *       assets/img/plate-adam-holo.png （红色全息 · 亚当重锤）
 *    这两张图是"纯黑底 + 立绘 + 辉光 + 扫描线 + 边框角标"的预合成成品，直接当图片贴上去，
 *    避免运行时用 clip-path / 混合模式做效果（浏览器与 canvas 上都不稳）。
 *
 * 视觉对应（与 HTML 预览稿一一对应）：
 *   背景 网格/扫描线/扫掠/暗角 ｜ 页眉 黄切角层号 + 青色数据 ｜ 词条 Orbitron 74 + 色差 + 间歇故障闪烁
 *   选项 320×84 深面板 + 左青边 + hover 右移 ｜ 倒计时条 黄 ｜ 反馈 青红全屏闪 + ACCESS GRANTED/DENIED + 震屏 + 立绘 glitch
 * ========================================================================== */
(function () {
  const SK = {
    cy: 0x5ef6ff, ye: 0xfcee0a, rd: 0xff2b4e, bg: 0x04070c, panel: 0x08111a,
    dim: '#68809a', txt: '#cfeef7', cyan: '#5ef6ff', yellow: '#fcee0a', red: '#ff2b4e',
    num: '"Orbitron", "Space Grotesk", sans-serif',
    body: '"Rajdhani", "HarmonyOS Sans SC", sans-serif',
    cn: '"Smiley Sans", "HarmonyOS Sans SC", sans-serif',   // 中文＝得意黑（斜体、紧凑、赛博感）
    GLYPH: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#%&*<>',
  };

  /* 选项按钮面板贴图：真切角（canvas 现画一张）。
     ★ 目前**未使用**：选项已按 E3 改成"无框（文字 + 细下划线）"——填色面板在深色底上会让
       四块面板连成一大片，用户反馈看着像一块大板。保留此函数以备以后做"选中态面板"复用。 */
  function texOptPanel(scene, key, fillTop, fillBot, border, bar) {
    if (scene.textures.exists(key)) return key;
    const W = 320, H = 84, cut = 10;
    const t = scene.textures.createCanvas(key, W, H);
    const g = t.getContext();
    g.clearRect(0, 0, W, H);
    const path = function () {
      g.beginPath();
      g.moveTo(cut, 0); g.lineTo(W, 0); g.lineTo(W, H - cut);
      g.lineTo(W - cut, H); g.lineTo(0, H); g.lineTo(0, cut); g.closePath();
    };
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, fillTop); grd.addColorStop(1, fillBot);
    path(); g.fillStyle = grd; g.fill();
    path(); g.lineWidth = 2; g.strokeStyle = border; g.stroke();
    g.fillStyle = bar; g.fillRect(0, cut, 4, H - cut * 2);
    t.refresh();
    return key;
  }

  /* ---------- 工具：生成皮肤自用的贴图（网格/扫描线/扫掠/暗角/闪光） ---------- */
  function texGrid(scene) {
    const k = 'cyber-grid';
    if (scene.textures.exists(k)) return k;
    const t = scene.textures.createCanvas(k, 46, 46);
    const g = t.getContext();
    g.clearRect(0, 0, 46, 46);
    g.fillStyle = 'rgba(94,246,255,0.055)';
    g.fillRect(0, 0, 46, 1); g.fillRect(0, 0, 1, 46);
    t.refresh();
    return k;
  }
  function texScan(scene) {
    const k = 'cyber-scan';
    if (scene.textures.exists(k)) return k;
    const t = scene.textures.createCanvas(k, 1, 3);
    const g = t.getContext();
    g.clearRect(0, 0, 1, 3);
    g.fillStyle = 'rgba(0,0,0,0.30)';
    g.fillRect(0, 0, 1, 1);
    t.refresh();
    return k;
  }
  function texSweep(scene) {
    const k = 'cyber-sweep';
    if (scene.textures.exists(k)) return k;
    const t = scene.textures.createCanvas(k, 1, 180);
    const g = t.getContext();
    const grd = g.createLinearGradient(0, 0, 0, 180);
    grd.addColorStop(0, 'rgba(94,246,255,0)');
    grd.addColorStop(0.5, 'rgba(94,246,255,0.075)');
    grd.addColorStop(1, 'rgba(94,246,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 1, 180);
    t.refresh();
    return k;
  }
  function texVignette(scene) {
    const k = 'cyber-vig';
    if (scene.textures.exists(k)) return k;
    // ★ 必须 **16:9**（与舞台同比例）：以前用 256×256，被非等比拉到 1280×720 后
    //   上下先变暗、中间留一条亮带，看起来像"屏幕上有一块巨大的横条"（用户反馈的现象就是这么来的）。
    const VW = 256, VH = 144;
    const t = scene.textures.createCanvas(k, VW, VH);
    const g = t.getContext();
    const grd = g.createRadialGradient(VW / 2, VH / 2, VH * 0.42, VW / 2, VH / 2, VW * 0.62);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.62)');
    g.fillStyle = grd;
    g.fillRect(0, 0, VW, VH);
    t.refresh();
    return k;
  }
  function texSlash(scene) {
    const k = 'cyber-slash';
    if (scene.textures.exists(k)) return k;
    const t = scene.textures.createCanvas(k, 64, 64);
    const g = t.getContext();
    const grd = g.createLinearGradient(0, 0, 64, 0);
    grd.addColorStop(0, 'rgba(255,43,78,0.55)');
    grd.addColorStop(1, 'rgba(94,246,255,0.55)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    t.refresh();
    return k;
  }

  /* 皮肤主体 */
  const Skin = {
    key: 'nightcity',
    /* 缩放系数（与 CombatScene 一致；调用方不给就自己算） */
    _s(scene, s) { return s || Math.max(1, Math.min(scene.width / 1280, scene.height / 720)); },

    /* ============ ① 背景 + 页眉重上色 + 底栏 + 反馈层 ============ */
    build(scene, geo) {
      const s = geo.s, W = geo.W, H = geo.H, cx = geo.cx, cy = geo.cy;
      const hudH = geo.hudH;                 // ★ 必须在任何使用之前声明（曾因声明在后 → 进战斗就 ReferenceError 崩）
      const layers = [];
      scene._nc = { timers: [], tweens: [], objs: layers, enemyDef: geo.enemyDef || null };
      /* 选项按钮的四态切角贴图（idle / hover / ok / bad） */
      // （已改为无框选项，不再需要切角面板贴图）




      /* ★★ 关掉 E3 自带的**整屏贴图**：`ui.js` 的背景会给每场战斗铺 `grain`（纸纹）
         与 `vignette`（暗角，alpha 0.55、depth -9）。它们是给"白纸底"配的，铺到深色皮肤上
         就变成屏幕上一条巨大的暗带（用户 2026-09-15 反复反馈的"巨带"就是这个）。
         这里**按纹理名精确匹配**关闭，不按深度猜（之前用 depth -8 想盖住它并不可靠），
         且只影响本场（E3 战斗不经过这段代码）。 */
      try {
        (scene.children && scene.children.list ? scene.children.list : []).forEach(function (o) {
          const k = o && o.texture && o.texture.key;
          if ((k === 'vignette' || k === 'grain') && o.setVisible) o.setVisible(false);
        });
      } catch (e) { /* 找不到就算了，不影响本体 */ }

      /* 背景：整块深底（盖住 E3 白底） */
      layers.push(scene.add.rectangle(0, 0, W, H, SK.bg).setOrigin(0, 0).setDepth(-8));   // ★ 必须高于 E3 自己的背景层（它在 -10/-9，一张 alpha 0.55 的亮色贴图会把皮肤深底洗白 —— 踩过）
      // ★ 原来这里还有"扫掠光带"（铺满宽度的 180px 渐变）与"暗角"（铺满屏幕的径向渐变）：
      //   两者都是全屏渐变贴图，一旦被非等比拉伸就会在屏幕上留下"一条横带"的伪影
      //   （用户 2026-09-15 连续两次反馈的"巨带"）。为彻底消除该可能，**这一版把它们去掉了**——
      //   深底 + 网格 + 扫描线已经足够，视觉损失很小。
      layers.push(scene.add.tileSprite(0, 0, W, H, texGrid(scene)).setOrigin(0, 0).setAlpha(0.9).setDepth(-7));
      layers.push(scene.add.tileSprite(0, 0, W, H, texScan(scene)).setOrigin(0, 0).setAlpha(0.55).setDepth(-6));

      /* 页眉：**先藏掉 E3 的白底与墨线**（否则白条会盖在皮肤深底上——踩过），
         再"只重上色"地复用 E3 的文字对象（不动它们的文案与刷新逻辑）。
         数值改成预览稿的"小标签 + 大数值"两行：标签是静态文字，数值仍用 E3 的对象（刷新逻辑照旧）。 */
      const hud = scene._hud || {};
      if (hud.bg && hud.bg.setVisible) hud.bg.setVisible(false);
      if (hud.rule && hud.rule.setVisible) hud.rule.setVisible(false);
      if (hud.pill) hud.pill.setFillStyle(SK.ye).setStrokeStyle(0);
      if (hud.pillText) hud.pillText.setFontFamily('Orbitron').setColor('#04121a');
      if (hud.stageText) {
        hud.stageText.setFontFamily('Smiley Sans').setFontSize(Math.round(12.5 * s) + 'px').setColor(SK.dim);
        // 预览稿的副标题更干净：// 层名 · 节点  |  普通作战 · 选择正确的中文释义
        try {
          const fc = Babel.RunState.getFloorConfig();
          const nt = (Babel.NODE_TYPES && Babel.NODE_TYPES[scene.type]) || {};
          const nm = (fc && fc.name) ? fc.name : '';
          hud.stageText.setText('// ' + nm + ' · ' + (nt.label || '') + '   |   普通作战 · 选择正确的中文释义');
        } catch (e) { /* 拿不到就保留 E3 文案 */ }
      }
      const hpX = W - 386 * s, curX = W - 244 * s;
      if (hud.curText) {
        hud.curText.setFontFamily('Orbitron').setColor(SK.cyan)
          .setFontSize(Math.round(15 * s) + 'px').setPosition(curX, hudH / 2 + 11 * s);
        hud.curText.setText(String(Babel.RunState.currency));   // 去掉 E3 的"残页 "前缀（标签由皮肤单独画）
      }
      if (scene._hudHP) {
        scene._hudHP.setFontFamily('Orbitron').setColor(SK.yellow)
          .setFontSize(Math.round(15 * s) + 'px').setPosition(hpX, hudH / 2 + 11 * s);
      }
      Babel.UI.text(scene, hpX, hudH / 2 - 9 * s, '目标生命',
        { font: SK.cn, size: Math.round(11 * s) + 'px', color: '#4a6178', origin: [1, 0.5] }).setDepth(4);
      Babel.UI.text(scene, curX, hudH / 2 - 9 * s, '残页',
        { font: SK.cn, size: Math.round(11 * s) + 'px', color: '#4a6178', origin: [1, 0.5] }).setDepth(4);
      if (scene._backBtn && scene._backBtn.setVisible) scene._backBtn.setVisible(false);
      layers.push(scene.add.rectangle(0, hudH - Math.max(1, Math.round(1 * s)), W, Math.max(1, Math.round(1 * s)), 0x1b3b46).setOrigin(0, 0).setDepth(2));
      layers.push(scene.add.rectangle(20 * s, hudH - Math.max(2, Math.round(2 * s)), 130 * s, Math.max(2, Math.round(2 * s)), SK.ye).setOrigin(0, 0).setDepth(3));
      this._hudButton(scene, W - 66 * s, hudH / 2, 104 * s, 34 * s, s, '退出', function () {
        Babel.UI.confirmQuit(scene, function () {
          Babel.PlayMusic(scene, Babel.LayerBGM());
          scene.scene.start(scene._isTest ? 'Test' : 'Start');
        });
      });

      /* 词条带：分隔线 → 青色发丝（E3 的灰色细线在深底上看不见） */
      if (scene._cardRule) scene._cardRule.setFillStyle(0x1b3b46);
      if (scene._cardBotRule) scene._cardBotRule.setFillStyle(0x1b3b46);
      // 中文统一换得意黑（斜体、紧凑、有赛博感）；英文照旧 Orbitron/Rajdhani
      if (scene._answerHint) scene._answerHint.setFontFamily('Smiley Sans').setColor('#7fe9ff').setFontSize(Math.round(14 * s) + 'px');
      if (scene.comboText) scene.comboText.setFontFamily('Orbitron').setColor(SK.dim);

      /* 倒计时：黄条 + 深底（E3 条是浅底，深色皮肤上会刺眼） */
      if (scene.cdBar) {
        if (scene.cdBar.setBg) scene.cdBar.setBg(0x0b131c, 0x1b3b46);
        if (scene.cdBar.setColor) scene.cdBar.setColor(SK.ye);
      }
      if (scene.cdText) scene.cdText.setFontFamily('Orbitron').setColor(SK.yellow);

      /* 连击：预览稿是常显的「COMBO 小标签 + 大数字」，E3 那个只在 ≥2 显示"连击 ×N"——
         所以藏掉 E3 的、由皮肤自己画（数值仍由 CombatScene 的 _refreshCombo 推给皮肤）。 */
      if (scene.comboText) scene.comboText.setVisible(false);
      const comboX = cx + 318 * s;
      Babel.UI.text(scene, comboX, cy - 132 * s, 'COMBO',
        { font: SK.cn, size: Math.round(11 * s) + 'px', color: '#4a6178', origin: [1, 0.5] }).setDepth(5);
      scene._nc.comboNum = Babel.UI.text(scene, comboX, cy - 114 * s, '0',
        { font: SK.num, size: Math.round(26 * s) + 'px', color: SK.cyan, origin: [1, 0.5], bold: true }).setDepth(5);

      /* 底栏：隐藏 E3 浅色内容，画赛博版（同样的藏品数据） */
      (scene._footObjs || []).forEach(function (o) { if (o && o.setVisible) o.setVisible(false); });
      const footY = cy + 296 * s;
      layers.push(scene.add.rectangle(cx, footY, geo.cardW, Math.max(1, Math.round(1 * s)), 0x1b3b46).setDepth(4));
      // （原来底栏右端还有一段 130px 的红色强调段，照原型加的；用户 2026-09-15 觉得"后面突然变红"很怪 → 去掉）
      Babel.UI.text(scene, cx - geo.cardW / 2, footY + 22 * s, '藏品',
        { font: SK.cn, size: Math.round(11.5 * s) + 'px', color: '#41586e', origin: [0, 0.5] }).setDepth(4);
      let ox = cx - geo.cardW / 2 + 44 * s;
      (Babel.RunState.ownedCollectibles || []).slice(0, 6).forEach(function (id) {
        const it = Babel.FindCollectible(id);
        const nm = (it && it.name) ? it.name : String(id);
        const chip = Babel.UI.text(scene, ox + 10 * s, footY + 22 * s, nm,
          { font: SK.cn, size: Math.round(14 * s) + 'px', color: SK.cyan, origin: [0, 0.5] }).setDepth(5);
        // 胶囊边框（预览稿是有框的 chip）
        layers.push(scene.add.rectangle(ox, footY + 22 * s, chip.width + 20 * s, 24 * s, 0x0a1620, 0.85)
          .setOrigin(0, 0.5).setStrokeStyle(1, 0x2a5f6e).setDepth(4));
        ox += chip.width + 28 * s;
      });

      /* 反馈层：全屏闪 + 立绘 glitch 叠层 + **赛博警示条**（横幅 + 角标 + 扫描线 + 主副两行字） */
      scene._nc.flash = scene.add.rectangle(0, 0, W, H, SK.cy, 0).setOrigin(0, 0).setDepth(60);
      scene._nc.flashOk = scene.add.rectangle(0, 0, W, H, SK.cy, 0).setOrigin(0, 0).setDepth(60);
      scene._nc.flashBad = scene.add.rectangle(0, 0, W, H, SK.rd, 0).setOrigin(0, 0).setDepth(60);
      const tY = cy - 60 * s, tW = 880 * s, tH = 96 * s;
      const band = scene.add.rectangle(cx, tY, tW, tH, 0x04070c, 0.93).setStrokeStyle(2, SK.cy).setDepth(70);
      const lineT = scene.add.rectangle(cx, tY - tH / 2, tW, Math.max(2, Math.round(3 * s)), SK.cy, 0.85).setDepth(71);
      const lineB = scene.add.rectangle(cx, tY + tH / 2, tW, Math.max(2, Math.round(3 * s)), SK.cy, 0.85).setDepth(71);
      const tickW = 26 * s, tickH = Math.max(3, Math.round(5 * s));
      const ticks = [
        scene.add.rectangle(cx - tW / 2, tY - tH / 2, tickW, tickH, SK.cy).setOrigin(0, 0.5).setDepth(72),
        scene.add.rectangle(cx + tW / 2, tY - tH / 2, tickW, tickH, SK.cy).setOrigin(1, 0.5).setDepth(72),
        scene.add.rectangle(cx - tW / 2, tY + tH / 2, tickW, tickH, SK.cy).setOrigin(0, 0.5).setDepth(72),
        scene.add.rectangle(cx + tW / 2, tY + tH / 2, tickW, tickH, SK.cy).setOrigin(1, 0.5).setDepth(72),
      ];
      const scan = scene.add.rectangle(cx - tW / 2, tY, Math.max(2, Math.round(3 * s)), tH, SK.cy, 0.35).setOrigin(0, 0.5).setDepth(72);
      const main = Babel.UI.text(scene, cx, tY - 12 * s, '',
        { font: SK.num, size: Math.round(42 * s) + 'px', color: '#eafcff', origin: [0.5, 0.5], bold: true }).setDepth(73);
      if (main.setShadow) main.setShadow(0, 0, '#5ef6ff', Math.max(8, Math.round(16 * s)), false, true);
      const sub = Babel.UI.text(scene, cx, tY + 27 * s, '',
        { font: SK.cn, size: Math.round(14 * s) + 'px', color: SK.cyan, origin: [0.5, 0.5] }).setDepth(73);
      Object.assign(scene._nc, {
        tY: tY, tW: tW, tH: tH, toastBand: band, toastLineT: lineT, toastLineB: lineB, toastTicks: ticks,
        toastScan: scan, toastMain: main, toastSub: sub,
        toastGroup: [band, lineT, lineB, scan, main, sub].concat(ticks),
      });
      // ★ 警示条创建后必须**立刻藏起来**：否则一进战斗就空着挂在屏幕中间（踩过——只设了 _toast 里的 alpha，
      //   忘了初值）。这里统一 alpha=0 + setVisible(false)，答题时再由 _toast 显示。
      scene._nc.toastGroup.forEach(function (o) { o.setAlpha(0); if (o.setVisible) o.setVisible(false); });
      const slashKey = texSlash(scene);
      const plateTop = cy - 200 * s, colW = 272 * s, plateH = 264 * s;
      scene._nc.glL = scene.add.image(cx - 490 * s - colW / 2, plateTop, slashKey)
        .setOrigin(0, 0).setDisplaySize(colW, plateH).setDepth(20).setAlpha(0);
      scene._nc.glR = scene.add.image(cx + 490 * s - colW / 2, plateTop, slashKey)
        .setOrigin(0, 0).setDisplaySize(colW, plateH).setDepth(20).setAlpha(0);
    },

    /* ============ ② 立绘牌：直接贴预合成的全息成品图 ============ */
    portrait(scene, side, cfg, cx, cy, s) {
      const px = (side === 'left') ? cx - 490 * s : cx + 490 * s;
      const colW = 272 * s, plateH = 264 * s, plateTop = cy - 200 * s;
      const isEnemy = (side === 'right');
      const key = isEnemy ? 'plate-adam-holo' : 'plate-logos-holo';
      // 贴图缺失时兜底：退回 E3 立绘（不至于空白）
      if (scene.textures.exists(key)) {
        scene.add.image(px - colW / 2, plateTop, key).setOrigin(0, 0).setDisplaySize(colW, plateH).setDepth(3);
      } else if (scene.textures.exists(cfg.spriteKey)) {
        scene.add.image(px, plateTop + plateH / 2, cfg.spriteKey).setDisplaySize(cfg.displayW * s, cfg.displayH * s).setDepth(3);
      }
      const nameColor = isEnemy ? SK.red : SK.cyan;
      Babel.UI.text(scene, px - colW / 2, cy + 84 * s, cfg.name,
        { font: SK.cn, size: Math.round(19 * s) + 'px', color: nameColor, origin: [0, 0.5] }).setDepth(5);
      // （按要求：名字下方那条英文小标签已删除，不再显示）
      // 血条（皮肤版：深底 + 单色填充 + 百分比）；标签删掉后整体上移一点、不留空档
      const barW = colW, barH = 11 * s, barY = cy + 106 * s;
      const bg = scene.add.rectangle(px - barW / 2, barY, barW, barH, 0x0b131c).setOrigin(0, 0.5).setStrokeStyle(1, 0x1b3b46).setDepth(5);
      const fill = scene.add.rectangle(px - barW / 2, barY, barW, barH, isEnemy ? 0xff625d : SK.cy).setOrigin(0, 0.5).setDepth(6);
      const pct = Babel.UI.text(scene, px + barW / 2 - 6 * s, barY, '100%',
        { font: SK.num, size: Math.round(8 * s) + 'px', color: '#cfeef7', origin: [1, 0.5] }).setDepth(7);
      const bar = {
        setRatio: function (r) {
          const v = Math.max(0, Math.min(1, r));
          fill.scaleX = v; fill.setOrigin(0, 0.5);
          pct.setText(Math.round(v * 100) + '%');
        },
      };
      const hpText = Babel.UI.text(scene, px - colW / 2, cy + 128 * s, '',
        { font: SK.num, size: Math.round(18 * s) + 'px', color: nameColor, origin: [0, 0.5] }).setDepth(5);
      Babel.UI.text(scene, px + colW / 2, cy + 128 * s + Math.round(2 * s), isEnemy ? 'ENEMY HP' : '目标生命',
        { font: SK.cn, size: Math.round(11 * s) + 'px', color: '#4a6178', origin: [1, 0.5] }).setDepth(5);
      return { bar: bar, hpText: hpText };
    },

    /* 皮肤版按钮（页眉返回）：切角感用矩形 + 青边 */
    _hudButton(scene, x, y, w, h, s, label, onClick) {
      const c = scene.add.container(x, y).setDepth(8);
      const hit = scene.add.rectangle(0, 0, w, h, 0x0a1620, 0.9).setStrokeStyle(1, 0x1b3b46)
        .setInteractive({ useHandCursor: true });
      const t = Babel.UI.text(scene, 0, 0, label, { font: SK.cn, size: Math.round(14 * s) + 'px', color: SK.cyan, origin: [0.5, 0.5] });
      c.add([hit, t]);
      hit.on('pointerover', function () { hit.setFillStyle(SK.cy, 0.9); t.setColor('#04121a'); });
      hit.on('pointerout', function () { hit.setFillStyle(0x0a1620, 0.9); t.setColor(SK.cyan); });
      hit.on('pointerup', function () { if (onClick) onClick(); });
      return c;
    },

    /* ============ ③ 词条：Orbitron + 色差幽灵层 + 间歇故障闪烁 ============ */
    styleWord(scene, s) {
      const w = scene.wordText;
      if (!w) return;
      const size = Math.round(74 * s);
      const px = size + 'px';
      if (w.setFontFamily) w.setFontFamily('Orbitron'); else w.style.fontFamily = 'Orbitron, sans-serif';
      w.setFontSize(px).setColor('#eafcff');
      try { w.setWordWrapWidth(0, false); } catch (e) {}   // 关掉换行（长词由"整体缩放"处理，绝不折行）
      /* ★ 色差＝**单对象 + 零偏移模糊投影**（方案③ 纯外发光，用户 2026-09-15 选定）：
         不用 setStroke、不用红/青错位 —— 长时间看不累眼；故障感交给"模糊半径骤增 + 横向抖动 + 切片撕裂"。
         （Phaser Text 只有一个 shadow，所以用一层较大的模糊近似 CSS 的双层 glow。） */
      if (w.setStroke) w.setStroke();                                   // 明确不描边
      const glow = Math.max(4, Math.round(10 * s));
      if (w.setShadow) w.setShadow(0, 0, '#5ef6ff', glow, false, true);
      scene._nc.wordPx = size;
      scene._nc.wordGlow = glow;
      /* 切片撕裂层：只在故障瞬间出现 3 帧，字号与主词**固定同一值**（74*s）并跟随同一缩放 */
      const tear = Babel.UI.text(scene, w.x, w.y, '',
        { font: SK.num, size: px, color: SK.cyan, origin: [0.5, 0.5], bold: true });
      tear.setDepth(7).setVisible(false);
      if (tear.setShadow) tear.setShadow(0, 0, '#5ef6ff', glow, false, true);
      scene._nc.gwT = tear;
      w.setDepth(6);
      const self = this;
      /* ① 每 4.6s 一次色差抽搐 */
      scene._nc.timers.push(scene.time.addEvent({
        delay: 4600, loop: true, callback: function () { self._jitter(scene, s); },
      }));
      /* ② 随机「切片撕裂」：间隔 3.2~7s */
      const loopTear = function () {
        const delay = 3200 + Math.random() * 3800;
        scene._nc.timers.push(scene.time.delayedCall(delay, function () { self._tear(scene, s); loopTear(); }));
      };
      loopTear();
    },
    /* 切片撕裂层与主词保持完全一致（文字/缩放/位置） */
    _syncGhost(scene) {
      const w = scene.wordText, g = scene._nc;
      if (!w || !g || !g.gwT) return;
      g.gwT.setText(w.text).setPosition(w.x, w.y).setScale(w.scaleX || 1, w.scaleY || 1);
    },
    _jitter(scene, s) {
      const g = scene._nc, w = scene.wordText;
      if (!g || !w || !w.visible) return;
      // 故障瞬间：光环骤然放大（10*s → 24*s）+ 横向抖一下，160ms 后回到常态；不引入任何红/青错位
      if (w.setShadow) w.setShadow(0, 0, '#5ef6ff', Math.max(8, Math.round(24 * s)), false, true);
      scene.tweens.add({
        targets: [w], x: w.x - 4 * s, duration: 60, yoyo: true, repeat: 1,
        onComplete: function () {
          w.x = scene.width / 2;
          if (w.setShadow) w.setShadow(0, 0, '#5ef6ff', g.wordGlow || Math.round(10 * s), false, true);
        },
      });
    },
    _tear(scene, s) {
      const g = scene._nc, w = scene.wordText;
      if (!g || !g.gwT || !w || !w.text || !w.visible) return;
      g.gwT.setText(w.text).setPosition(w.x, w.y).setVisible(true).setColor(Math.random() < 0.5 ? SK.red : SK.cyan);
      let n = 0;
      const iv = scene.time.addEvent({
        delay: 45, repeat: 3, callback: function () {
          const top = Math.random() * 0.55, hh = 0.06 + Math.random() * 0.2;
          try { g.gwT.setCrop(0, w.height * top, w.width, Math.max(6, w.height * hh)); } catch (e) {}
          g.gwT.x = w.x + (Math.random() * 2 - 1) * 9 * s;
          if (++n > 3) { try { g.gwT.setCrop(); } catch (e) {} g.gwT.setVisible(false); }
        },
      });
      g.timers.push(iv);
    },
    /* 每题：逐字解码（原型 scramble 420ms）
       ★ 长词处理：E3 词卡有换行限制 → 一律**关掉换行**，再按"实测渲染宽度"**整体缩放**（不换字号，
         因为换字号就必须同步所有附加层，一漏就出重影）。缩放上限 1（短词不放大）。
       ★ 顺带把显示统一成大写（预览稿观感，仅本场、仅显示）。 */
    onWord(scene, s) {
      s = this._s(scene, s);
      const w = scene.wordText;
      if (!w) return;
      w.setText(String(w.text || '').toUpperCase());
      const target = w.text || '';
      if (!target) return;
      try { w.setWordWrapWidth(0, false); } catch (e) {}
      if (w.setFontSize) w.setFontSize((scene._nc.wordPx || Math.round(74 * s)) + 'px');
      // 整体缩放：放进 cardW - 40*s（词卡左右各留 20*s）
      const avail = 640 * s;
      const k = Math.min(1, avail / Math.max(1, w.width));
      w.setScale(k);
      this._syncGhost(scene);
      let i = 0;
      const n = target.length, ticks = Math.max(6, Math.round(420 / 45));
      const ev = scene.time.addEvent({
        delay: 45, repeat: ticks - 1, callback: function () {
          i++;
          const p = i / ticks;
          let out = '';
          for (let k = 0; k < n; k++) {
            out += (k / n < p) ? target[k] : SK.GLYPH[(Math.random() * SK.GLYPH.length) | 0];
          }
          w.setText(out);
          if (i >= ticks) { w.setText(target); Skin._syncGhost(scene); }
        },
      });
      scene._nc.timers.push(ev);
    },

    /* ============ ④ 反馈：全屏闪 + ACCESS 警示条 + 震屏 + 立绘 glitch ============ */
    _flash(scene, kind) {
      const g = scene._nc; if (!g) return;
      const r = (kind === 'ok') ? g.flashOk : g.flashBad;
      r.setAlpha(kind === 'ok' ? 0.30 : 0.34);
      scene.tweens.add({ targets: r, alpha: 0, duration: 260, ease: 'Quad.easeOut' });
    },
    /* 赛博警示条：横幅（切角感＝角标+上下亮线）+ 扫描线划过 + 主字逐字解码 + 副行小字 + 抖动故障 */
    _toast(scene, text, kind, s, sub) {
      const g = scene._nc;
      if (!g || !g.toastBand) return;
      const ok = (kind === 'ok');
      const col = ok ? SK.cy : SK.rd;
      const grp = g.toastGroup;
      // 连答很快时，先把上一条的补间杀掉，避免"上一条的淡出"把这一条中途抹掉
      try { scene.tweens.killTweensOf(grp); } catch (e) {}
      g.toastBand.setStrokeStyle(2, col);
      g.toastLineT.setFillStyle(col, 0.85);
      g.toastLineB.setFillStyle(col, 0.85);
      g.toastTicks.forEach(function (c) { c.setFillStyle(col, 1); });
      g.toastScan.setFillStyle(col, 0.3);
      g.toastMain.setColor(ok ? '#eafcff' : '#ffe3e8');
      // 警示条主字同样走"纯外发光"（与词条一致，不用红/青错位）
      if (g.toastMain.setStroke) g.toastMain.setStroke();
      if (g.toastMain.setShadow) g.toastMain.setShadow(0, 0, ok ? '#5ef6ff' : '#ff2b4e', Math.max(8, Math.round(16 * s)), false, true);
      g.toastSub.setText(sub || (ok ? '// 认证通过 · 数据写入完成' : '// 认证失败 · 连接被切断')).setColor(ok ? '#5ff6ff' : '#ff7d93');
      // ★ 传入自定义副行时（弹幕命中：`// 英文词 · 中文`）把字号放大，让词与释义更醒目；
      //   一阶段不传 sub → 仍是原来的小字，外观一字未变。
      if (g.toastSub.setFontSize) g.toastSub.setFontSize(Math.round((sub ? 24 : 14) * s) + 'px');
      // 入场：横幅从 0.62 横向展开 + 整体淡入
      grp.forEach(function (o) { o.setAlpha(0); o.setVisible(true); });
      g.toastBand.setScale(0.62, 1);
      scene.tweens.add({ targets: g.toastBand, scaleX: 1, duration: 150, ease: 'Back.easeOut' });
      scene.tweens.add({ targets: grp, alpha: 1, duration: 110 });
      // 扫描线划过
      g.toastScan.x = scene.width / 2 - g.tW / 2;
      scene.tweens.add({ targets: g.toastScan, x: scene.width / 2 + g.tW / 2, duration: 420, ease: 'Quad.easeOut' });
      // 主字逐字解码（赛博感的关键：字是"解"出来的，不是淡入的）
      const target = String(text || '');
      g.toastMain.setText(target);
      let i = 0; const ticks = 6;
      const ev = scene.time.addEvent({
        delay: 34, repeat: ticks - 1, callback: function () {
          i++;
          const p = i / ticks;
          let out = '';
          for (let k = 0; k < target.length; k++) out += (k / target.length < p) ? target[k] : SK.GLYPH[(Math.random() * SK.GLYPH.length) | 0];
          g.toastMain.setText(out);
          if (i >= ticks) g.toastMain.setText(target);
        },
      });
      g.timers.push(ev);
      // 故障抖动：整条横向错位两次（yoyo 自动回位）
      [0, 1].forEach(function (n) {
        const ev2 = scene.time.delayedCall(200 + n * 170, function () {
          const dx = (n % 2 === 0 ? -7 : 6) * s;
          scene.tweens.add({ targets: grp, x: '+=' + dx, duration: 45, yoyo: true });
        });
        g.timers.push(ev2);
      });
      // 保持后淡出
      scene.tweens.add({ targets: grp, alpha: 0, delay: 780, duration: 260, onComplete: function () { grp.forEach(function (o) { o.setVisible(false); }); } });
    },
    _glitch(side, scene) {
      const g = scene._nc; if (!g) return;
      const r = (side === 'right') ? g.glR : g.glL;
      if (!r) return;
      r.setAlpha(0.75);
      scene.tweens.add({ targets: r, alpha: 0, duration: 340, ease: 'Quad.easeOut' });
    },
    /* 选项配色（**无框**版）：只改"文字色 + 下划线色"，不画任何面板 */
    _paintOption(scene, i, state, s) {
      const btn = scene.optionButtons && scene.optionButtons[i];
      if (!btn || !btn.list || !btn.list[0]) return;
      const label = btn.list[1];
      const rule = btn._rule;
      if (state === 'correct') {
        if (label) label.setColor('#eafcff');
        if (rule && rule.setFillStyle) rule.setFillStyle(SK.cy, 1);
        scene.tweens.add({ targets: btn, scale: 1.03, duration: 140, yoyo: true });
      } else if (state === 'wrong') {
        if (label) label.setColor('#ffd9e0');
        if (rule && rule.setFillStyle) rule.setFillStyle(SK.rd, 1);
        const x0 = btn.x;
        scene.tweens.add({ targets: btn, x: x0 - 9 * s, duration: 60, yoyo: true, repeat: 3, onComplete: function () { btn.x = x0; } });
      } else {
        if (label) label.setColor(SK.txt);
        if (rule && rule.setFillStyle) rule.setFillStyle(0x1b3b46, 1);
      }
    },
    /* 清掉 E3 的**通用**「正确！/错了！」文字（本场已有 ACCESS 提示条表达对错，不必再来一行）。
       ★ 用严格匹配：藏品加成类提示（"破环之诫！伤害 +2" / "清偿！…" / "正确！指令机 +2 盾"）
         与"缓冲中…"必须保留，所以只在文本正好是通用那几句时清空。
       ★ 只在皮肤内调用 → 其他战斗的 feedback 完全不受影响。 */
    _clearGenericFeedback(scene) {
      const fb = scene.feedback;
      if (!fb || !fb.text) return;
      const t = String(fb.text);
      // 只清"通用对错/超时"；藏品加成（破环之诫/清偿/指令机）与"缓冲中…"保留
      if (t === '正确！' || t === '错了！' || t === '错了！但恍神·未受伤'
        || t === '超时！' || t === '超时！但恍神·未受伤') fb.setText('');
    },
    onCorrect(scene, idx) {
      const s = this._s(scene);
      this._clearGenericFeedback(scene);
      this._flash(scene, 'ok');
      this._toast(scene, 'ACCESS GRANTED', 'ok', s);
      if (typeof idx === 'number') this._paintOption(scene, idx, 'correct', s);
      this._glitch('right', scene);
      // 连击数字弹一下（复用 E3 的 comboText，只在本场做缩放）
      if (scene.comboText && scene.comboText.text) {
        scene.tweens.add({ targets: scene.comboText, scale: 1.6, duration: 140, yoyo: true });
      }
      // ★ 二阶段：HP 降到阈值 → 进入「弹幕识别」（机制模块 src/scenes/mechanics/barrage.js）
      //   配置与阈值都在敌人定义里（`enemyDef.barrage.phase2Hp`），这里只做"到点就切"。
      const ed = scene._nc && scene._nc.enemyDef;
      const bc = ed && ed.barrage;
      if (bc && Babel.MECH_Barrage) {
        if (!scene._barrageOn) {
          // 二阶段：HP ≤ phase2Hp（默认 20）→ 进入弹幕识别
          const th = (bc.phase2Hp != null) ? bc.phase2Hp : 20;
          if (scene.enemyHP <= th) Babel.MECH_Barrage.enter(scene, ed);
        } else if ((scene._barragePhase || 2) < 3) {
          // 三阶段：HP ≤ phase3Hp（默认 10）→ 弹幕速度再 ×speed3Factor（默认 2 → 600 px/s），只触发一次
          const th3 = (bc.phase3Hp != null) ? bc.phase3Hp : 10;
          if (scene.enemyHP <= th3) Babel.MECH_Barrage.speedUp(scene, bc.speed3Factor || 2);
        }
      }
    },
    onWrong(scene, idx, isTimeout) {
      const s = this._s(scene);
      this._clearGenericFeedback(scene);
      this._flash(scene, 'bad');
      this._toast(scene, 'ACCESS DENIED', 'bad', s);
      if (typeof idx === 'number') this._paintOption(scene, idx, 'wrong', s);
      if (typeof scene.correctIndex === 'number') this._paintOption(scene, scene.correctIndex, 'correct', s);
      try { scene.cameras.main.shake(300, 0.008); } catch (e) {}
      this._glitch('left', scene);
    },
    /* 连击数字更新（CombatScene 的 _refreshCombo 推过来；E3 的 comboText 已被藏掉） */
    onCombo(scene, combo) {
      const g = scene._nc;
      if (!g || !g.comboNum) return;
      const v = String(combo || 0);
      if (g.comboNum.text === v) return;
      g.comboNum.setText(v);
      scene.tweens.add({ targets: g.comboNum, scale: 1.5, duration: 130, yoyo: true });
    },
    /* 每题重置选项外观（否则上一题的绿/红会留到下一题） */
    resetOptions(scene, s) {
      s = this._s(scene, s);
      (scene.optionButtons || []).forEach(function (btn) {
        if (btn && btn._rule && btn._rule.setFillStyle) btn._rule.setFillStyle(0x1b3b46, 1);
        const label = btn && btn.list && btn.list[1];
        if (label && label.setColor) label.setColor(SK.txt);
        if (btn) btn.setScale(1);
      });
    },

    /* ============ ⑤ 收尾：清定时器/补间（_endBattle 调用） ============ */
    clear(scene) {
      // 先收二阶段机制（弹幕识别）：它自己注册了 input/update 监听与一堆对象
      try { if (Babel.MECH_Barrage) Babel.MECH_Barrage.clear(scene); } catch (e) {}
      const g = scene._nc;
      if (!g) return;
      (g.timers || []).forEach(function (t) { try { t.remove(); } catch (e) {} });
      (g.tweens || []).forEach(function (t) { try { t.stop(); } catch (e) {} });
      scene._nc = null;
    },
  };

  /* 皮肤版选项：**与 Babel.UI.row 同构**（list[0]=可交互命中区，list[1]=文字），
     这样 CombatScene 里 _newWord/_layoutOptions/_onAnswer 的既有代码一行都不用改。
     ★ 形态参照 E3：**无框**（只有文字 + 一条细下划线）。之前做"填色切角面板"时，
       四块深色面板在深色底上会连成一大片、看着像屏幕上有一块大板（用户 2026-09-15 反馈）。
     文字＝得意黑 + 拉字距 + 青发光，右下角带编号水印；下划线＝状态色（hover/对/错）。 */
  Babel.SKIN_OptionButton = function (scene, x, y, wIn, hIn, s, onClick, idxNo) {
    const w = wIn, h = hIn;
    const c = scene.add.container(x, y).setDepth(4);
    // 命中区：透明矩形（只在输入层存在，不画任何框）
    const hit = scene.add.rectangle(0, 0, w, h, 0x000000, 0.001).setInteractive({ useHandCursor: true });
    const label = scene.add.text(0, -4 * s, '', {
      fontFamily: SK.cn, fontSize: Math.round(21 * s) + 'px', color: SK.txt,
      align: 'center', wordWrap: { width: w - 40 * s, useAdvancedWrap: true },
      letterSpacing: Math.round(1.8 * s),
    }).setOrigin(0.5, 0.5);
    const rule = scene.add.rectangle(0, h / 2 - Math.max(1, Math.round(2 * s)), w - 40 * s, Math.max(1, Math.round(1 * s)), 0x1b3b46)
      .setOrigin(0.5, 0.5);
    const idx = scene.add.text(w / 2 - 12 * s, h / 2 - 13 * s, idxNo != null ? ('0' + (idxNo + 1)) : '',
      { fontFamily: SK.num, fontSize: Math.round(9 * s) + 'px', color: 'rgba(94,246,255,0.38)' }).setOrigin(1, 0.5);
    c.add([hit, label, rule, idx]);      // ★ 顺序：hit 在前、label 第二 → list[0]/list[1] 语义与 E3 一致
    c._panel = null; c._rule = rule; c._idx = idx;
    hit.on('pointerover', function () { rule.setFillStyle(SK.cy, 1); c.x = x + 3 * s; });
    hit.on('pointerout', function () { rule.setFillStyle(0x1b3b46, 1); c.x = x; });
    hit.on('pointerup', function () { if (onClick) onClick(); });
    return c;
  };

  Babel.SKIN_NightCity = Skin;
})();
