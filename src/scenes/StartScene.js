/* ============================================================================
 * StartScene.js —— 开始界面（E3「美术馆展签」风格 · V3 单列长签）
 * ----------------------------------------------------------------------------
 * 【为什么要有这个界面】
 * 浏览器禁止"无用户操作自动出声"。我们把"那一次点击"做成
 * 「开始探索」这一行：玩家点一下 → 解锁音频并循环播放 BGM → 进入第一层。
 *
 * ★ 缩放纪律：所有坐标/尺寸/字号一律 × s（或走 fs()），不允许裸像素，
 *   否则窗口放大后整页不会跟着放大（曾因此把测试菜单做坏）。
 *
 * 版式（1280×720 基准）：
 *   左上：中文小题头「巴别残响」→ 巨号拉丁标题 Babel Resonance → 红色 3px 短横线
 *   中段：单列长签 4 条（左编号 / 中名称 / 右英文 / 末端箭头），每条只有一条顶线
 *   底部：左 build 号 · 中 BGM 曲名 · 一句世界观提示
 * ========================================================================== */

window.Babel = window.Babel || {};

const S_INK = 0x111111, S_RULE = 0xe6e6e6, S_RED = 0xe2231a, S_WHITE = 0xffffff;
const S_INK_S = '#111111', S_MUTED_S = '#6f6f6f', S_RED_S = '#e2231a';

class StartScene extends Phaser.Scene {
  constructor() { super('Start'); }

  create() {
    console.log('[Babel] build =', Babel.VERSION, '| BGM =', Babel.BGM.url);
    this.cameras.main.setBackgroundColor('#ffffff');
    Babel.UI.atmosphere(this);
    this.width = this.scale.width;
    this.height = this.scale.height;
    const W = this.width, H = this.height;
    const s = Math.max(1, Math.min(W / 1280, H / 720));
    const fs = (n) => Math.round(n * s) + 'px';
    const L = 80 * s, R = W - 80 * s, RW = R - L;

    /* ---------- 题头 + 巨号拉丁标题（双色）+ 红横线 ---------- */
    Babel.UI.text(this, L, 58 * s, '巴别残响',
      { font: Babel.FONTS.body, size: fs(14), color: S_INK_S, origin: [0, 0.5], bold: true });
    // 大标题 E7：Babel（墨）+ Resonance（红）。Phaser 单个 Text 无法双色 → 两个 Text 拼接；
    // 先建两个、设好字距，再按 tA.width 把第二个贴上去（顺序不可颠倒，否则位置会偏）。
    // 位置/字号与改动前完全一致（L, 92*s, 88px），只有颜色与字距变化。
    const titleY = 92 * s, titleFont = '"Gilroy", "HarmonyOS Sans SC", sans-serif', titleSize = fs(88);
    const tA = Babel.UI.text(this, L, titleY, 'Babel',
      { font: titleFont, size: titleSize, color: S_INK_S, origin: [0, 0] });
    const tB = Babel.UI.text(this, L, titleY, 'Resonance',
      { font: titleFont, size: titleSize, color: S_RED_S, origin: [0, 0] });
    try { if (tA.setLetterSpacing) { tA.setLetterSpacing(-2 * s); tB.setLetterSpacing(-2 * s); } } catch (e) {}
    tB.setX(L + tA.width + 22 * s);   // 22*s ≈ Gilroy 88px 的一个空格宽
    this.add.rectangle(L, 200 * s, 160 * s, Math.max(2, Math.round(3 * s)), S_RED).setOrigin(0, 0.5);

    /* ---------- 单列长签（4 条通栏） ---------- */
    const rowH = 76 * s;          // 5 条长签：76×5 = 380，不与底部信息行相撞
    let y = 248 * s;
    this._rows = [];

    /* 行工厂：左编号 / 中名称 / 右英文 / 末端箭头 / 顶线（悬停变红） */
    const row = (no, name, en, onPick, opts) => {
      const o = opts || {};
      const cyRow = y + rowH / 2;
      const c = this.add.container(0, 0);
      const hit = this.add.rectangle(L + RW / 2, cyRow, RW, rowH, 0x000000, 0).setInteractive({ useHandCursor: true });
      const line = this.add.rectangle(L, y, RW, Math.max(1, Math.round(1 * s)), S_RULE).setOrigin(0, 0.5);
      const bot = o.last ? this.add.rectangle(L, y + rowH, RW, Math.max(1, Math.round(1 * s)), S_RULE).setOrigin(0, 0.5) : null;
      const tNo = this.add.text(L + 16 * s, cyRow, no,
        { fontFamily: Babel.FONTS.num, fontSize: fs(15), color: S_RED_S }).setOrigin(0, 0.5);
      const tNm = this.add.text(L + 60 * s, cyRow, name,
        { fontFamily: Babel.FONTS.body, fontSize: fs(34), color: S_INK_S }).setOrigin(0, 0.5);
      const tEn = this.add.text(R - 44 * s, cyRow, en,
        { fontFamily: Babel.FONTS.display, fontSize: fs(10.5), color: S_MUTED_S }).setOrigin(1, 0.5);
      const tAr = this.add.text(R - 14 * s, cyRow, '→',
        { fontFamily: Babel.FONTS.num, fontSize: fs(18), color: S_MUTED_S }).setOrigin(1, 0.5);
      c.add([hit, line, tNo, tNm, tEn, tAr].concat(bot ? [bot] : []));
      hit.on('pointerover', () => line.setFillStyle(S_RED));
      hit.on('pointerout', () => line.setFillStyle(S_RULE));
      hit.on('pointerup', () => { if (onPick) onPick(); });
      this._rows.push({ c: c, line: line, name: tNm });
      y += rowH;
      return tNm;
    };

    /* 01 开始探索：解锁音频 + 新的一局 */
    row('01', '开始探索', 'NEW RUN', () => {
      Babel.RunState.init();
      Babel.PlayMusic(this);
      this.scene.start('Map');
    });

    /* 02 继续上次：读取存档（若无存档则等同新局） */
    row('02', '继续上次', 'CONTINUE', () => {
      const rs = Babel.RunState;
      if (rs && typeof rs.load === 'function') rs.load();
      Babel.PlayMusic(this);
      this.scene.start('Map');
    });

    /* 03 战斗测试 */
    row('03', '战斗测试', 'SANDBOX', () => { this.scene.start('Test'); });

    /* 04 声音开关（真实可用：静音/恢复；状态记在 Babel._userMuted 上，PlayMusic 会据此复位 mute） */
    const muteName = row('04', Babel._userMuted ? '声音：关' : '声音：开', 'SOUND', () => {
      Babel._userMuted = !Babel._userMuted;
      this.sound.mute = Babel._userMuted;
      muteName.setText(Babel._userMuted ? '声音：关' : '声音：开');
      if (!Babel._userMuted) Babel.PlayMusic(this);   // 重新打开时立刻恢复播放
    });

    /* 05 退出游戏（全屏/无边框窗口没有系统关闭键，必须给一个出口） */
    row('05', '退出游戏', 'QUIT', () => {
      try { window.close(); } catch (e) {}     // 关掉窗口 → Electron 主进程 window-all-closed 会退出
    }, { last: true });

    /* ---------- 底部信息 ---------- */
    const footY = H - 48 * s;
    Babel.UI.text(this, L, footY, 'build ' + Babel.VERSION,
      { font: Babel.FONTS.display, size: fs(11), color: S_MUTED_S, origin: [0, 0.5] });

    Babel.UI.text(this, R, footY, '词句即武器：把正确的义钉进对手的名字里。',
      { size: fs(11.5), color: S_MUTED_S, origin: [1, 0.5] });

    Babel.UI.autoResize(this);
  }
}

Babel.Scenes = Babel.Scenes || {};
Babel.Scenes.StartScene = StartScene;
