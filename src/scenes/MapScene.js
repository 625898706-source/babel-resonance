/* ============================================================================
 * MapScene.js —— 地图（行进）场景
 * ----------------------------------------------------------------------------
 * 【本文件作用】
 * 把「当前这一层」的线路图画出来：入口 → 各种节点 → 层尾 BOSS。
 * 每个节点是一块"瓷砖"，旁边画上连向下一列节点的箭头。
 * 玩家只能点"高亮可走"的节点前进；点战斗节点进词战，点交互节点进事件弹窗。
 *
 * 【这段代码是在做什么】
 *   1) 读数据（Babel.FLOOR_GRAPHS[当前层]）拿到节点与连接；
 *   2) 按列（col）与行（row）把节点摆到屏幕合适位置（左→右）；
 *   3) 根据"当前所在节点"算出哪些节点是"下一步能走"的；
 *   4) 把"能走"的节点做成可点击，点击后就场景切换（战斗 / 事件）。
 * ========================================================================== */

window.Babel = window.Babel || {};

class MapScene extends Phaser.Scene {
  constructor() { super('Map'); }

  create() {
    const C = Babel.COLORS.DARK;
    this.cameras.main.setBackgroundColor(C.bg);
    Babel.UI.atmosphere(this);   // 浅色编辑风氛围（淡纸纹底）
    // 背景音乐：进入第一层立即尝试自动播放；若被浏览器"自动播放"策略拦截，则首次点击/按键补播
    Babel.PlayMusic(this);
    this.input.once('pointerdown', () => Babel.PlayMusic(this));
    this.input.once('keydown', () => Babel.PlayMusic(this));
    this.width = this.scale.width;
    this.height = this.scale.height;

    // 右上角"退出"按钮 → 回主菜单（下次点「开始探索」即开新局）
    // ★ 必须 setDepth：页眉（editorHeader）是后画的，同层级会把返回键压在下面
    Babel.UI.button(this, this.width - 76, 26, 104, 32, '退出',
      () => { Babel.UI.confirmQuit(this, () => { Babel.PlayMusic(this, Babel.LayerBGM()); this.scene.start('Start'); }); },
      { font: Babel.FONTS.body, size: '13px', fill: 0xffffff, stroke: Babel.COLORS.LINE_N, lineW: 1, hover: 0xfafafa, color: '#111111', marker: false }).setDepth(80);

    // 若当前处于"刚开局 / 刚进入本层"，重置本层进度
    if (Babel.RunState.currentNodeId === null) {
      Babel.RunState.enterFloor(Babel.RunState.floor);
      Babel.RunState.currentNodeId = Babel.RunState.getFloorGraph().startId;
    }

    this.graph = Babel.RunState.getFloorGraph();
    this.floorCfg = Babel.RunState.getFloorConfig();

    // 顶部编辑风头部（黄 pill + 标签 + 大标题 + 小标签）
    Babel.UI.editorHeader(this, this.floorCfg);

    // HUD：目标生命 + 残页（左上角小灰字）
    this.hudText = Babel.UI.text(this, 20, 62, '', { size: '14px', color: C.muted });
    this._refreshHud();

    // 画节点与连线
    this._renderGraph();

    // 底部：藏品背包（显示已获得藏品与效果）
    this._renderBackpack();

    // 底部提示
    Babel.UI.text(this, this.width / 2, this.height - 64 - 16,
      '点击高亮的节点前进（战斗 / 事件）', { color: C.muted, size: '14px', origin: [0.5, 0.5] });

    // 窗口/画布尺寸变化 → 重排（防止窗口放大后地图挤在左上角）
    Babel.UI.autoResize(this);
  }

  /* 刷新顶部状态栏 */
  _refreshHud() {
    this.hudText.setText(
      '目标生命 ' + Babel.fmt1(Babel.RunState.targetHP) +
      '   残页 ' + Babel.RunState.currency +
      '   藏品 ' + Babel.RunState.ownedCollectibles.length
    );
  }

  /* 画整张线路图：先连线，再摆节点 */
  /* ★ 残响之隙「撕裂的纸」多边形：直接抄自 设计预览\残响之隙-B-撕裂纸.html 的 clip-path（25 个点，百分比） */
  _renderGraph() {
    const C = Babel.COLORS.DARK;
    const nodes = this.graph.nodes;

    // 计算每个节点的屏幕坐标（左→右、整体水平居中）
    const pos = {};
    // 节点宽自适应：始终给列间留出最小空隙，避免拥挤/重叠；宽屏可更大一些
    // ★★ 2026-09-17 用户要求：节点做大、地图做成"可拖动的宽地图"（明日方舟集成战略那种手感）
    //    节点尺寸**不再**为了"塞进一屏"而反推（那会让节点小、上下留白浪费）→ 给固定大尺寸；
    //    地图比屏幕宽也没关系 → 用"按住左键拖动"来看（见 _setupMapPan）。
    const cols = Math.max.apply(null, nodes.map(n => n.col)) + 1;  // 列数
    const _s = Math.max(1, Math.min(this.width / 1280, this.height / 720));
    this.nodeW = Math.round(180 * _s);               // 原上限 215 → 现在约 ×1.4
    this.nodeH = Math.round(this.nodeW * 0.53);      // 节点高
    this.fontL = Math.round(this.nodeW * 0.18);      // 节点大字
    this.fontS = Math.round(this.nodeW * 0.085);     // 说明小字
    this.framePad = Math.round(this.nodeW * 0.12);   // 呼吸黑框留白
    this.labelDy = Math.round(this.nodeW * 0.095);   // 大字相对中心上移量
    this.descDy = Math.round(this.nodeW * 0.20);     // 说明相对中心下移量
    const colGap = Math.round(this.nodeW * 1.75);    // 列距随节点宽（保证不挤）
    const rowGap = Math.round(this.nodeH * 1.5);     // 行距随节点高（竖向也用起来）
    const leftPad = Math.round(120 * _s);            // 地图左起留白
    const centerY = Math.round((150 * _s + (this.height - 84 * _s)) / 2);
    nodes.forEach(n => {
      const x = leftPad + this.nodeW / 2 + n.col * colGap;
      const y = centerY + n.row * rowGap;   // row 已是"相对中线的偏移"，入口/BOSS=0 → 正居中
      pos[n.id] = { x: x, y: y };
    });
    this._nodePos = pos;                             // 供"初始视角对准当前位置"用
    this._mapExtent = { left: leftPad, right: leftPad + (cols - 1) * colGap + this.nodeW, rows: 2, rowGap: rowGap, nodeH: this.nodeH, centerY: centerY };
    this._mapBase = this.children.list.length;       // ★ 基线：此后新建的对象都属于"地图"，收进容器可拖动

    // 1) 先画连线（节点之间的平滑曲线 + 箭头）
    const g = this.add.graphics();
    nodes.forEach(n => {
      n.to.forEach(tid => {
        const a = pos[n.id], b = pos[tid];
        this._drawEdge(g, a, b, C.muted);
      });
    });

    // 2) 当前节点与可走节点
    const currentId = Babel.RunState.currentNodeId;
    const curNode = nodes.find(n => n.id === currentId);
    const selectable = curNode ? curNode.to : [];

    // 3) 逐节点摆瓷砖
    nodes.forEach(n => {
      this._drawNode(n, pos[n.id], currentId, selectable);
    });

    // ★ 把本函数新建的**所有地图对象**收进一个容器：拖动时只动它，页眉/底栏等 UI 不受影响
    const mapObjs = this.children.list.slice(this._mapBase);
    this.mapLayer = this.add.container(0, 0);
    mapObjs.forEach(function (o) { if (o && o !== this.mapLayer) { try { this.mapLayer.add(o); } catch (e) {} } }, this);
    this._setupMapPan();
  }

  /* ★ 按住左键拖动地图（只移动 mapLayer）+ 边界限制 + 初始视角对准"当前位置"
     · 位移 > 6px 视为拖动 → 松手不触发节点跳转（否则一拖就误进战斗）
     · 边界：地图边缘最多拖到"离屏幕边 60px"，不会拖到看不见 */
  _setupMapPan() {
    const self = this, L = this.mapLayer, ext = this._mapExtent;
    const PAD = 60;
    let down = false, px0 = 0, py0 = 0, lx0 = 0, ly0 = 0;
    const clamp = function () {
      const top = ext.centerY - ext.rowGap - ext.nodeH / 2;
      const bot = ext.centerY + ext.rowGap + ext.nodeH / 2;
      let minX = self.width - ext.right - PAD, maxX = PAD - ext.left;   // 内容比屏幕窄时两者会反转
      if (minX > maxX) { const c = (minX + maxX) / 2; minX = maxX = c; }
      let minY = self.height - bot - PAD, maxY = PAD - top;
      if (minY > maxY) { const c = (minY + maxY) / 2; minY = maxY = c; }
      L.x = Math.min(maxX, Math.max(minX, L.x));
      L.y = Math.min(maxY, Math.max(minY, L.y));
    };
    /* 初始：把"当前位置"摆到屏幕中间偏左一点（和方舟一样，一眼看到自己在哪） */
    const cur = this.graph.nodes.find(function (x) { return x.id === Babel.RunState.currentNodeId; });
    const anchor = cur && this._nodePos[cur.id] ? this._nodePos[cur.id] : { x: ext.left + this.nodeW / 2, y: ext.centerY };
    L.x = Math.round(this.width * 0.34) - anchor.x;
    L.y = Math.round(this.height / 2) - anchor.y;
    clamp();

    this.input.on('pointerdown', function (p) { down = true; px0 = p.x; py0 = p.y; lx0 = L.x; ly0 = L.y; self._mapDragged = false; });
    this.input.on('pointermove', function (p) {
      if (!down || !p.isDown) return;
      const dx = p.x - px0, dy = p.y - py0;
      if (Math.abs(dx) + Math.abs(dy) > 6) self._mapDragged = true;   // ★ 一旦超过阈值，松手也不触发节点
      L.x = lx0 + dx; L.y = ly0 + dy; clamp();
    });
    this.input.on('pointerup', function () { down = false; });
    this.input.on('pointerupoutside', function () { down = false; });
    this.cameras.main.setBackgroundColor(Babel.COLORS.DARK.bg);
  }

  /* 画一条从 a 到 b 的平滑曲线箭头（水平 S 形贝塞尔），贴近集成战略图的连线风格 */
  /* 底部：藏品背包条，只显示藏品名称；点击某件弹出其具体效果 */
  _renderBackpack() {
    const C = Babel.COLORS;
    const owned = (Babel.RunState.ownedCollectibles || [])
      .map(id => Babel.FindCollectible(id))
      .filter(Boolean);
    const barH = 64;
    const y = this.height - barH / 2;

    // 背包条背景
    this.add.rectangle(this.width / 2, y, this.width, barH, 0xffffff).setOrigin(0.5).setStrokeStyle(1, Babel.COLORS.LINE_N);
    Babel.UI.text(this, 20, y, '藏品背包（点击查看效果）', { font: Babel.FONTS.display, size: '14px', color: C.MUTED, origin: [0, 0.5] });

    if (!owned.length) {
      Babel.UI.text(this, 210, y, '暂无藏品（战斗 / 商店 / 得偿所愿可获得）',
        { size: '13px', color: '#c0c0bc', origin: [0, 0.5] });
      return;
    }
    const chipW = 118, gap = 8, startX = 210;
    let x = startX, row = 0;

    // 点击其它任意处关闭详情浮层
    this._closeTooltip = () => { if (this._tooltipObjs) { this._tooltipObjs.forEach(o => o && o.destroy()); this._tooltipObjs = null; } };
    this.input.on('pointerdown', () => this._closeTooltip());

    owned.forEach(c => {
      if (x + chipW > this.width - 12) { x = startX; row++; }
      const cy = y - row * 34;
      const rc = Babel.RARITY_COLOR_NUM[c.rarity] || 0x9b9fa5;   // 稀有度颜色（数值色）
      // 名称小卡（稀有度色边框 + 左侧稀有度色点；只显示名称）
      Babel.UI.panel(this, x + 4, cy - 15, chipW, 30, 0xf7f6f2, rc, 4);
      this.add.rectangle(x + 12, cy, 6, 20, rc);             // 稀有度色点
      Babel.UI.text(this, x + 22, cy, c.name, { size: '12px', color: '#24252a', origin: [0, 0.5] });
      // 可点击热区 → 弹出效果详情
      const cx = x + 4 + chipW / 2;
      const hit = this.add.rectangle(cx, cy, chipW, 30, 0x000000, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => this._showCollectibleInfo(c, cx, cy - 26));
      x += chipW + gap;
    });
  }

  /* 点击藏品 → 弹出浮层显示具体效果（含稀有度色） */
  _showCollectibleInfo(c, x, y) {
    this._closeTooltip();
    // ★ 走公共件（Babel.UI.collectiblePopup）：s=1、无 note/按钮 → 版式与原来逐值一致
    const pop = Babel.UI.collectiblePopup(this, c, x, y + 4, { s: 1 });
    this._tooltipObjs = pop.objs;
    this._tooltipClose = pop.close;
  }

  _drawEdge(g, a, b, color) {
    const sx = a.x + this.nodeW / 2 - 4;   // 起始：源节点右边缘
    const sy = a.y;
    const tx = b.x - this.nodeW / 2 + 4;   // 终点：目标节点左边缘
    const ty = b.y;
    // 两个"水平方向"控制点 → 形成 S 形曲线
    const cx1 = sx + (tx - sx) * 0.4, cy1 = sy;
    const cx2 = sx + (tx - sx) * 0.6, cy2 = ty;

    // 用多段折线近似贝塞尔曲线（采样 48 点，让曲线平滑不粗糙）
    g.lineStyle(3, color, 1);
    g.beginPath();
    g.moveTo(sx, sy);
    const steps = 48;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, mt = 1 - t;
      const x = mt * mt * mt * sx + 3 * mt * mt * t * cx1 + 3 * mt * t * t * cx2 + t * t * t * tx;
      const y = mt * mt * mt * sy + 3 * mt * mt * t * cy1 + 3 * mt * t * t * cy2 + t * t * t * ty;
      g.lineTo(x, y);
    }
    g.strokePath();

    // 箭头：终点处朝右的小三角
    g.fillStyle(color, 1);
    g.fillTriangle(tx, ty, tx - 10, ty - 5, tx - 10, ty + 5);
  }

  /* 画单个节点（浅色编辑风）：白卡 + 深字；
   *   当前位置 = 标志黄高亮 + "当前位置"；
   *   可去(selectable) = 白卡 + 一圈"留间隙"的黄色外框 + 忽亮忽暗呼吸动画；
   *   其它 = 白卡 + 细分隔线；已走过 = 变淡 */
  /* ★ 残响之隙专属：撕裂的纸卡片（逐值复刻 设计预览\残响之隙-B-撕裂纸.html）
     · 多边形点集＝预览 clip-path 的 25 个百分比点（按节点宽高换算）
     · 灰边＝同一多边形绕中心放大 1.012 后填 #e6e6e6（对应预览的 ::before scale(1.012)）
     · 红裂缝＝1px 宽、左侧 52%、上起 8%、高 84%、竖向渐变（transparent→红 20%→红 80%→transparent）、alpha .85
     · 返回一个"透明命中矩形"，并挂 setPolyFill() 供悬停重填多边形（点击/悬停逻辑与别的节点一致） */
  _drawRareTornCard(p, w, h, fill, alpha, isCurrent) {
    const K = MapScene.RARE_TORN_POINTS;      // 预览 clip-path 的原始百分比点
    const toXY = (k) => K.map(function (q) {
      return { x: p.x - w / 2 + w * q[0] / 100, y: p.y - h / 2 + h * q[1] / 100 };
    });
    // 灰边：把点相对节点中心放大 1.012（= CSS transform:scale(1.012)）
    const outer = toXY().map(function (q) {
      return { x: p.x + (q.x - p.x) * 1.012, y: p.y + (q.y - p.y) * 1.012 };
    });
    const inner = toXY();

    // 撕形投影（代替矩形投影，避免撕边外露方块）
    const sh2 = toXY().map(function (q) { return { x: q.x + 2, y: q.y + 3 }; });
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.06 * alpha);
    shadow.fillPoints(sh2, true);

    const EDGE = 0xc9c9c6;                    // ★ 撕边加深（原 #e6e6e6 在纸白上太淡 ✗）
    const g = this.add.graphics();
    g.fillStyle(EDGE, alpha);
    g.fillPoints(outer, true);
    g.fillStyle(fill, alpha);                 // 纸白（当前位置时＝标志黄）
    g.fillPoints(inner, true);

    // 红裂缝（竖向渐变贴图，1px 宽）
    // ★ 线芯 + 辉光烘焙成一张软边贴图（9×128）：横向高斯式衰减 × 纵向渐隐
    //   → 不再是"一条实心红条 + 一个硬边辉光矩形"（用户 2026-09-17 反馈"贴图感太重"）
    if (!this.textures.exists('rare-slit')) {
      const TW = 9, TH = 128, CXP = (TW - 1) / 2;
      const cv = this.textures.createCanvas('rare-slit', TW, TH);
      const ctx = cv.getContext();
      const img = ctx.createImageData(TW, TH);
      for (let y = 0; y < TH; y++) {
        const t = y / (TH - 1);
        // 纵向：上下各 14% 渐隐，中间满
        const vA = t < 0.14 ? t / 0.14 : (t > 0.86 ? (1 - t) / 0.14 : 1);
        for (let x = 0; x < TW; x++) {
          const d = Math.abs(x - CXP) / (CXP + 0.0001);      // 0 = 线芯，1 = 最外
          const hA = d < 0.12 ? 1 : Math.pow(1 - (d - 0.12) / 0.88, 2.1) * 0.85;  // 芯实、两侧二次衰减
          const a = Math.round(255 * Math.min(1, hA * vA) * 0.92);
          const i = (y * TW + x) * 4;
          img.data[i] = 226; img.data[i + 1] = 35; img.data[i + 2] = 26; img.data[i + 3] = a;
        }
      }
      ctx.putImageData(img, 0, 0);
      cv.refresh();
    }
    // ★ 一条软边红缝（线芯 + 辉光已在贴图里，无硬边）
    const k = w / 180;                                   // 与节点同比例
    const sw = Math.max(5, Math.round(9 * k));           // 贴图宽 9 设计像素（中间 1px 是芯）
    const sh = h * 0.84;
    const sx = p.x - w / 2 + w * 0.52;
    const syTop = p.y - h / 2 + h * 0.08;
    const slit = this.add.image(sx, syTop + sh / 2, 'rare-slit')
      .setDisplaySize(sw, sh).setAlpha(alpha);
    // ★ 动态（用户 2026-09-17 要求）—— 三层周期不同步，看起来"像活着"，但都不剧烈
    //   ① 呼吸：纸片 + 撕形投影（缝不参与，避免与②打架）
    this.tweens.add({ targets: [g, shadow], alpha: 0.9, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    //   ② 红缝微闪：独立周期，缝自己"眨"（与呼吸不同步 → 有生命感）
    this.tweens.add({ targets: slit, alpha: 0.6, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    //   ③ 撕裂抖动：每 4.2 秒一次极短横向抖（纸片+投影一起，缝跟着偏一点）
    const dj = Math.max(1, Math.round(2 * (w / 180)));
    this.time.addEvent({
      delay: 4200, loop: true,
      callback: () => {
        this.tweens.add({ targets: [g, shadow], x: dj, duration: 55, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: slit, x: slit.x + dj, duration: 55, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
      },
    });

    // 命中区：透明矩形（保持原有交互代码可用）
    const hit = this.add.rectangle(p.x, p.y, w, h, 0x000000, 0);
    hit.setPolyFill = function (c) { g.clear(); g.fillStyle(EDGE, alpha); g.fillPoints(outer, true); g.fillStyle(c, alpha); g.fillPoints(inner, true); };
    hit.rareParts = { poly: g, slit: slit, shadow: shadow };
    return hit;
  }

  _drawNode(node, p, currentId, selectable) {
    const nt = Babel.NODE_TYPES[node.type];
    const w = this.nodeW, h = this.nodeH;

    const isCurrent = (node.id === currentId);
    const isSel = selectable.indexOf(node.id) >= 0;
    const isVisited = Babel.RunState.isVisited(node.id);

    // 数值色（fill / stroke 用数值，避免字符串解析差异）
    const white = 0xffffff;
    const yellow = 0xfff44f;
    const darkLine = Babel.COLORS.LINE_N;
    const inkN = 0x0a0b0d;

    let alpha = 1;
    if (isVisited && !isCurrent) alpha = 0.45;
    else if (!isSel && !isCurrent) alpha = 0.9;

    // 当前位置 → 标志黄高亮；其它 → 白卡 + 细分隔线（可去用外框区分，不加卡边描边）
    const fill = isCurrent ? yellow : white;
    const cardBorder = isCurrent ? inkN : darkLine;
    const textColor = isCurrent ? '#0a0b0d' : '#24252a';
    const descColor = isCurrent ? '#5a5e66' : Babel.COLORS.MUTED;

    // 柔和投影（浅底上很淡）
    // ★ 残响之隙不画矩形投影：撕边之外会露出一圈方块底色（用户 2026-09-17 指出 ✗）
    //   它的投影改在 _drawRareTornCard 里按"撕形"画
    if (node.type !== 'rare') this.add.rectangle(p.x + 2, p.y + 3, w, h, 0x000000, 0.05 * alpha);

    // 卡片本体
    // ★ 残响之隙（rare）＝「撕裂的纸」（用户 2026-09-17 选定方案 B，要求与预览 100% 一致）
    //   其它所有节点仍走原来的矩形分支，一字未动
    let rect;
    if (node.type === 'rare') {
      rect = this._drawRareTornCard(p, w, h, fill, alpha, isCurrent);
    } else {
      rect = this.add.rectangle(p.x, p.y, w, h, fill, alpha).setStrokeStyle(1, cardBorder);
    }

    // 可去节点：一圈"加粗黑框"（比卡片大一圈、留有间隙）+ 明显的呼吸动画
    if (isSel) {
      const frame = this.add.rectangle(p.x, p.y, w + this.framePad * 2, h + this.framePad * 2, 0x000000, 0)
        .setStrokeStyle(4, 0x0a0b0d);
      this.tweens.add({
        targets: frame, alpha: 0.15, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    // 文字：大字（深）+ 说明（灰）
    Babel.UI.text(this, p.x, p.y - this.labelDy, nt.label,
      { font: Babel.FONTS.body, size: this.fontL + 'px', color: textColor, origin: [0.5, 0.5], bold: true }).setAlpha(alpha);
    // ★ 入口节点的说明按【本层】取（2026-09-18 用户：两层入口描述要不一样 ✓ 后续楼层同理 ✓）
    //   其它节点类型照旧读 nt.desc ✓ 完全不受影响 ✓
    const _nd = (node.type === 'entry')
      ? (((Babel.FLOORS[Babel.RunState.floor - 1] || {}).entryDesc) || nt.desc.split('（')[0])
      : nt.desc.split('（')[0];
    Babel.UI.text(this, p.x, p.y + this.descDy, _nd,
      { size: this.fontS + 'px', color: descColor, origin: [0.5, 0.5] }).setAlpha(alpha);

    // 当前位置：上方一行"当前位置"小标签
    if (isCurrent) {
      Babel.UI.text(this, p.x, p.y - h / 2 - Math.round(this.framePad * 0.6), '当前位置',
        { font: Babel.FONTS.display, size: Math.round(this.fontS * 1.1) + 'px', color: '#6b6f76', origin: [0.5, 0.5] });
    }

    // 可去 → 可点击
    if (isSel) {
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerover', () => { if (rect.setPolyFill) rect.setPolyFill(0xfffbe0); else rect.setFillStyle(0xfffbe0, alpha); });
      rect.on('pointerout', () => { if (rect.setPolyFill) rect.setPolyFill(fill); else rect.setFillStyle(fill, alpha); });
      rect.on('pointerup', () => { if (this._mapDragged) return; this._goTo(node); });   // ★ 拖动松手不误触发
    }
  }

  /* 点击某个可走节点：进入它，并按类型切换到对应场景 */
  _goTo(node) {
    Babel.RunState.enterNode(node.id);
    const nt = Babel.NODE_TYPES[node.type];
    if (nt.kind === 'combat') {
      this.scene.start('Combat', { nodeId: node.id });
    } else {
      this.scene.start('NodeEvent', { nodeId: node.id });
    }
  }
}

Babel.Scenes = Babel.Scenes || {};
Babel.Scenes.MapScene = MapScene;

/* ★ 残响之隙「撕裂的纸」多边形点集（百分比，抄自方案 B 预览的 clip-path） */
MapScene.RARE_TORN_POINTS = [[0,12],[4,4],[12,9],[26,2],[40,8],[55,1],[70,7],[84,2],[94,8],[100,16],[97,34],[100,52],[96,70],[100,86],[88,97],[72,92],[56,99],[40,93],[24,99],[10,93],[3,88],[0,70],[3,52],[0,34]];
