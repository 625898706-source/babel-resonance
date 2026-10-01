/* ============================================================================
 * BootScene.js —— 启动场景
 * ----------------------------------------------------------------------------
 * 【本文件作用】
 *   1) 设置背景色（深色图书馆底色）。
 *   2) 生成两张"立绘占位图"（逻各斯 / 敌人），这样战斗、地图都能用同一张贴图，
 *      后面替换成真正的立绘时只改这里。占位图是一张"披风人形"简图。
 *   3) 等网页字体加载完成（避免文字用一种字体、后来又跳成另一种）。
 *   4) 进入地图场景 Map。
 * ----------------------------------------------------------------------------
 * 【为什么先做这个场景】
 * Phaser 需要一个场景来"准备资源/贴图"，再切到真正的游戏内容；Boot 就是干这个的。
 * ========================================================================== */

window.Babel = window.Babel || {};

/* 生成一张"人形立绘"占位贴图：圆头 + 长袍 + 描边 */
function makePortrait(scene, key, bodyColor, accent) {
  const w = 120, h = 170;
  const g = scene.make.graphics({ add: false });

  // 长袍（下身）
  g.fillStyle(bodyColor, 1);
  g.fillRoundedRect(10, 62, w - 20, h - 74, 26);
  // 头（上身）
  g.fillStyle(bodyColor, 1);
  g.fillCircle(w / 2, 46, 28);
  // 头巾/兜帽高光
  g.fillStyle(accent, 0.35);
  g.fillCircle(w / 2, 40, 20);

  // 描边
  g.lineStyle(3, accent, 1);
  g.strokeRoundedRect(6, 58, w - 12, h - 66, 22);

  g.generateTexture(key, w, h);
  g.destroy();
}

class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  // 预加载：只加载贴图（不阻塞在音频上；BGM 改为点击开始时懒加载）
  preload() {
    this.load.image('tex-bg', 'assets/img/endfield-texture.png');   // 纸纹/氛围底
    // 逻各斯 - 默认正面 Idle 动画（webm → 精灵图，15×10 网格，帧 260×340 高清）
    this.load.spritesheet('logos-idle', 'assets/img/logos-idle.png', { frameWidth: 260, frameHeight: 340 });
    // 源石虫 - 默认战斗 Idle 动画（webm → 精灵图，6×10 网格，帧 400×258 高清）
    this.load.spritesheet('slug-idle', 'assets/img/slug-idle.png', { frameWidth: 400, frameHeight: 258 });
    // 萨卡兹宿主卫巢百夫长 - 默认战斗 Idle 动画（webm → 精灵图，6×5 网格，帧 360×467 高清）
    this.load.spritesheet('centurion-idle', 'assets/img/centurion-idle.png', { frameWidth: 360, frameHeight: 467 });
    // 殉道者·安多恩 - 默认战斗 Idle2 动画（webm → 精灵图，10×10 网格，帧 240×255 高清）
    this.load.spritesheet('andoain-idle', 'assets/img/andoain-idle.png', { frameWidth: 240, frameHeight: 255 });
    // 皇帝的利刃 - 默认战斗 Idle 动画（webm → 精灵图，10×5 网格，帧 260×324 高清）
    this.load.spritesheet('emperor-idle', 'assets/img/emperor-idle.png', { frameWidth: 260, frameHeight: 324 });
    // 里恩（残响之隙隐藏BOSS）- 静态立绘（webp 单帧 → 透明 PNG 163×472）
    this.load.image('lien-idle', 'assets/img/lien-idle.png');
    // 猎狗pro（拼词测试）- 战斗 Idle 动画（webm → 精灵图，6×10 网格，帧 240×240；alpha=亮度护层）
    this.load.spritesheet('hunterpro-idle', 'assets/img/hunterpro-idle.png', { frameWidth: 240, frameHeight: 240 });
    // 塔露拉（轨道接字母测试）- 战斗 Idle 动画（webm → 精灵图，10×18 网格，帧 200×200）
    this.load.spritesheet('talulah-idle', 'assets/img/talulah-idle.png', { frameWidth: 200, frameHeight: 200 });
    // 复仇者（乱序拼词测试）- 战斗 Idle 动画（webm → 精灵图，11×11 网格，帧 200×200）
    this.load.spritesheet('avenger-idle', 'assets/img/avenger-idle.png', { frameWidth: 200, frameHeight: 200 });
    this.load.image('skin-saint-bg', 'assets/skin-saint/bg.png');   // ★ 圣徒皮肤背景（众生行记 ✓ 2026-09-18）
    // ★ 圣徒答题演出素材（2026-09-21）：白鸽左/右向 ＋ 闪光（众生行记 / 月行水上 ✓）
    this.load.image('skin-saint-dove-l', 'assets/skin-saint/dove-l.png');
    this.load.image('skin-saint-dove-r', 'assets/skin-saint/dove-r.png');
    this.load.image('skin-saint-flash', 'assets/skin-saint/flash.png');
    // ★ 连线阶段「连错」用的碎玻璃（月行水上 ✓ 2026-09-21）
    this.load.image('skin-saint-glass-1', 'assets/skin-saint/glass-1.png');
    this.load.image('skin-saint-glass-2', 'assets/skin-saint/glass-2.png');
    this.load.image('skin-saint-glass-3', 'assets/skin-saint/glass-3.png');
    this.load.image('skin-saint-glass-4', 'assets/skin-saint/glass-4.png');
    // 圣徒（战斗测试·待定）—— 175 帧 → 8×22 拼图，单帧 180×180（已去黑底为透明 ✓）
    this.load.spritesheet('saint-idle', 'assets/img/saint-idle.png', { frameWidth: 180, frameHeight: 180 });   // 8列×22行 ✓ 175 帧全量 ✓
    // 奎隆（战斗测试·待定）—— 160 帧 → 10×16 拼图，单帧 180×180（源 webm 黑底已抠成透明 ✓）
    this.load.spritesheet('quilon-idle', 'assets/img/quilon-idle.png', { frameWidth: 180, frameHeight: 180 });   // 10列×16行 ✓ 160 帧 ✓
    // ★ 奎隆专属皮肤「授法」素材（只本场用 ✓ 见 src/scenes/skins/quilon.js）
    this.load.image('skin-quilon-bg', 'assets/skin-quilon/bg.png');
    this.load.image('skin-quilon-lotus', 'assets/skin-quilon/lotus.png');   // 环心莲花（D 案 · 跟着环转 ✓）
    // 铁络无面者（拼词怪物）- 静态立绘（透明 PNG 750×1000；镜像面向逻各斯）
    this.load.image('maskless-idle', 'assets/img/maskless-idle.png');
    // 幽影（第二层·残响敌人）- 静态立绘（B_Phantom.webp → 透明 PNG 270×222；不镜像）
    this.load.image('phantom-idle', 'assets/img/phantom-idle.png');
    // 亚当重锤（待定区）- 静态立绘（素材 4916…5b.webp → 透明 PNG 546×800；默认镜像面向逻各斯）
    this.load.image('adamsmasher-idle', 'assets/img/adamsmasher-idle.png');
    // 萨卡兹穿刺手组长（战斗测试·待定区）—— 72 帧 → 10×8 拼图，单帧 180×180（源 webm 黑底已抠透明 ✓）
    //   素材：素材\萨卡兹穿刺手组长-默认-战斗-Idle-x1.webm ✓ 2026-09-25
    this.load.spritesheet('piercer-idle', 'assets/img/piercer-idle.png', { frameWidth: 180, frameHeight: 180 });
    // 杰斯顿（战斗测试·待定区，乱序拼词）—— 86 帧 → 10×9 拼图，单帧 180×180（源 webm 黑底已抠透明 ✓）
    //   素材：素材\杰斯顿·威廉姆斯-默认-战斗-C1_Attack-x1.webm（只有攻击动画 ✓ 拿它当循环待机用 ✓）
    this.load.spritesheet('jesselton-idle', 'assets/img/jesselton-idle.png', { frameWidth: 180, frameHeight: 180 });
    // ★ NIGHT CITY 皮肤专用立绘牌（预合成的"黑底+立绘+全息辉光+扫描线+边框"成品图）
    //   只有 enemy.skin==='nightcity' 的战斗会用到它们；其它战斗完全不受影响。
    this.load.image('plate-logos-holo', 'assets/img/plate-logos-holo.png');
    this.load.image('plate-adam-holo', 'assets/img/plate-adam-holo.png');
    // 预载默认 BGM + 所有"敌人专属 BGM"：在启动阶段就载入并解码，
    // 避免战斗场景运行时再 scene.load.start()（易受场景生命周期/自动播放策略影响而静音）。
    this.load.audio(Babel.BGM.key, Babel.BGM.url);   // 默认 BGM（兜底）
    this.load.audio('sfx-lien-attack', 'assets/audio/sfx-lien-attack.mp3');   // 里恩 Furioso 攻击阶段：出题瞬间的打击音效（独立 SFX，不打断 BGM）
    this.load.audio('sfx-phantom-void', 'assets/audio/sfx-phantom-void.mp3'); // 幽影"静默回响"：字母全消那一刻的空响（独立 SFX）
    this.load.audio('sfx-click', 'assets/audio/sfx-click.wav');   // ★ 全局点击音效（2026-09-18 用户选定 mixkit-1125 ✓ 绑所有鼠标点击 ✓）
    (Babel.FLOORS || []).forEach(f => {
      // 预载每层 map BGM
      if (f && f.bgm && f.bgm.key && f.bgm.url) this.load.audio(f.bgm.key, f.bgm.url);
      const types = (f.combat && f.combat.types) || {};
      Object.keys(types).forEach(type => {
        const tc = types[type];
        if (!tc) return;
        const list = tc.enemies || (tc.enemy ? [tc.enemy] : []);
        (list || []).forEach(e => {
          if (e && e.bgm && e.bgm.key && e.bgm.url) this.load.audio(e.bgm.key, e.bgm.url);
        });
      });
    });
  }

  async create() {
    // 浅色编辑风底
    this.cameras.main.setBackgroundColor(Babel.COLORS.DARK.bg);

    // 占位立绘（深色剪影，浅底上可见；逻各斯=近黑+黄强调，敌人=暗红+红强调）
    makePortrait(this, 'portrait-logos', '#2a2b30', Babel.COLORS.YELLOW);
    makePortrait(this, 'portrait-foe', '#3a2626', Babel.COLORS.RED);

    // 等待网页字体准备好（加超时兜底，避免个别浏览器一直卡在字体加载上）
    if (document.fonts && document.fonts.ready) {
      // ★ 皮肤专用字体（得意黑）必须**显式预加载**：@font-face 只有被 DOM 元素用到才会真正下载，
      //   而本项目字体全用在 Phaser 的 canvas 文本上 → 不预加载就会在战斗里回落成默认中文字体。
      //   只影响启动耗时（一次性），不改变任何战斗的绘制。
      try {
        if (document.fonts.load) {
          await Promise.race([
            Promise.all([
              document.fonts.load('16px "Smiley Sans"'),
              document.fonts.load('16px "Orbitron"'),
              document.fonts.load('16px "Rajdhani"'),
            ]),
            new Promise(r => setTimeout(r, 2000)),
          ]);
        }
      } catch (e) {}
      try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
    }

    // 进入开始界面（点击「开始探索」后解锁音频并进入地图）
    this.scene.start('Start');
  }
}

// 注册到全局，供 main.js 引用
Babel.Scenes = Babel.Scenes || {};
Babel.Scenes.BootScene = BootScene;
