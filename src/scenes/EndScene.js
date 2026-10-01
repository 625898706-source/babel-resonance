/* ============================================================================
 * EndScene.js —— 结算 / 结局场景
 * ----------------------------------------------------------------------------
 * 【本文件作用】
 *   1) 胜利（通关本局）：显示"巴别残响"通关画面，可再来一局。
 *   2) 失败（目标生命值归零）：显示本局失败，可再来一局。
 * 这里先用一个简单版本，后续换成真正的「结算 / 多结局」。
 * ========================================================================== */

window.Babel = window.Babel || {};

class EndScene extends Phaser.Scene {
  constructor() { super('End'); }

  init(data) { this.win = data && data.win; }

  create() {
    const C = Babel.COLORS.DARK;
    this.cameras.main.setBackgroundColor(C.bg);
    Babel.UI.atmosphere(this);   // 深色图书馆 + 烛光 + 暗角 + 纸纹
    this.width = this.scale.width;
    this.height = this.scale.height;

    // 标题与说明
    /* ★★★ 2026-09-26 更新：文案跟上"三层"口径 ✗✗
     *   原来写的 `你稳住了词之塔的法则。` —— "词之塔"是**早期概念** ✓
     *     而通关条件早已改成"打通第三层（残响层）"✓ 两层时代的说法留着就是错的 ✓
     *   ★ 用**三层递进**的说法 ✗：回声 → 回响 → 残响 ✓ 与三层 desc 的"初响/叠响/终响"同源 ✓
     *   ★ 失败侧也补上"停在哪一层" ✓ —— 三层跑了很久，玩家想知道自己倒在哪儿 ✓*/
    const _fl = (Babel.RunState && Babel.RunState.floor) || 1;
    const _fn = (() => {
      try { const f = (Babel.FLOORS || [])[_fl - 1]; return f ? f.name : ''; } catch (e) { return ''; }
    })();
    const title = this.win ? '巴别残响 · 通关' : '巴别残响 · 本局失败';
    const sub = this.win
      ? '回声、回响、残响——三个语域你都走到了尽头。'
      : '目标生命值耗尽。你停在第 ' + _fl + ' 层' + (_fn ? '「' + _fn + '」' : '') + '。';

    Babel.UI.text(this, this.width / 2, this.height / 2 - 60, title,
      { font: Babel.FONTS.heading, size: '42px', color: this.win ? '#0a0b0d' : C.RED, origin: [0.5, 0.5] });
    Babel.UI.text(this, this.width / 2, this.height / 2,
      sub, { size: '20px', color: C.fg, origin: [0.5, 0.5] });
    Babel.UI.text(this, this.width / 2, this.height / 2 + 40,
      '残页 ' + Babel.RunState.currency + '   藏品 ' + Babel.RunState.ownedCollectibles.length,
      { size: '16px', color: C.muted, origin: [0.5, 0.5] });

    /* ★★★ 两个出口并排 ✗✗（2026-09-30 用户："这里除了再来一局外加一个回到标题的选项"）
     *   ★ 为什么并排而不是上下堆 ✓：一屏只有这两个动作 ✓
     *     并排一眼看全 ✓ 也不会撑高版面 ✓（原来那颗居中在 `cy+120` ✓）
     *   ★ 「回到标题」必须 **先 `init()` 再进 Start** ✗✗ —— 顺序反了就错了 ✓
     *     · `init()` 会把 floor 归 1、残页归 15、藏品清空 ✓
     *     · 不 init 直接 Start → 标题界面背后的 `RunState` 还是**上一局的残局** ✓
     *       玩家点"开始探索"时虽然 Start 里也会 init ✓
     *       但标题界面若显示任何局内信息（层数/残页）就会**显示上一局的值** ✓
     *     · 判据：**凡是"退回入口"的动作，都要把一局的状态清干净** ✗
     *       不能指望"下一个场景会自己清" ✓（那是隐式依赖 ✓ 换个入口就漏 ✓）*/
    const BTN_W = 200, BTN_H = 56, BTN_GAP = 28;
    const btns = [
      { label: '再来一局', act: () => { Babel.RunState.init(); this.scene.start('Map'); } },
      { label: '回到标题', act: () => { Babel.RunState.init(); this.scene.start('Start'); } },
    ];
    const totalW = btns.length * BTN_W + (btns.length - 1) * BTN_GAP;
    btns.forEach((b, i) => {
      const bx = this.width / 2 - totalW / 2 + BTN_W / 2 + i * (BTN_W + BTN_GAP);
      Babel.UI.button(this, bx, this.height / 2 + 120, BTN_W, BTN_H, b.label, b.act,
        { font: Babel.FONTS.heading, size: '22px', primary: i === 0 });
    });
  }
}

Babel.Scenes = Babel.Scenes || {};
Babel.Scenes.EndScene = EndScene;
