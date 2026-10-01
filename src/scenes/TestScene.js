/* ============================================================================
 * TestScene.js —— 战斗测试界面（E3「美术馆展签」风格 · **全量按 s 缩放**）
 * ----------------------------------------------------------------------------
 * ★ 缩放纪律（本文件必须遵守，否则窗口放大后整页错位）：
 *   const s = Math.max(1, Math.min(this.width / 1280, this.height / 720));
 *   const fs = (n) => Math.round(n * s) + 'px';
 *   ——【所有】坐标、尺寸、字号都必须乘 s 或走 fs()，不允许出现裸像素值。
 *
 * 语言：纸 #fff · 墨 #111 · 灰 #6f6f6f · 线 #e6e6e6 · 唯一红 #e2231a
 *   结构只用细线 + 留白；大字/拉丁 Gilroy，小标签 Novecento 大写，数字等宽
 * ========================================================================== */

window.Babel = window.Babel || {};

const T_INK = 0x111111, T_MUTED = 0x6f6f6f, T_RULE = 0xe6e6e6, T_RED = 0xe2231a, T_WHITE = 0xffffff;
const T_INK_S = '#111111', T_MUTED_S = '#6f6f6f', T_RED_S = '#e2231a';

class TestScene extends Phaser.Scene {
  constructor() { super('Test'); }

  /* 当前缩放系数（所有排版都用它） */
  _s() { return Math.max(1, Math.min(this.width / 1280, this.height / 720)); }

  _collectEnemies() {
    const list = [];
    (Babel.FLOORS || []).forEach(f => {
      const types = f.combat && f.combat.types;
      if (!types) return;
      Object.keys(types).forEach(type => {
        const tc = types[type];
        if (!tc || typeof tc !== 'object') return;
        // testOnly：NODE_TYPES 上带该标记的类型（如"待定"暂存区）→ 测试菜单里单独成组，且**永不进地图**
        const nt = Babel.NODE_TYPES[type] || {};
        const testOnly = !!nt.testOnly;
        if (tc.enemies && tc.enemies.length) {
          tc.enemies.forEach((e, idx) => list.push({ floor: f.id, type: type, idx: idx, name: e.name, testOnly: testOnly }));
        } else if (tc.enemy) {
          list.push({ floor: f.id, type: type, idx: 0, name: tc.enemy.name, testOnly: testOnly });
        }
      });
    });
    return list;
  }

  _typeLabel(type) {
    const map = {
      ordinary: '普通', emergency: '紧急', rare: '残响之隙', boss: 'BOSS',
      anagram: '乱序拼词', avenger: '乱序拼词', maskless: '语境拼词', rail: '轨道接字母',
      tbd: '待定',
    };
    return map[type] || type;
  }

  _mechTag(t) {
    const map = {
      // 残响之隙 的敌人已从里恩换成幽影（第二层），小标随之从 LIEN 改为中性的 ECHO（按节点类型而非敌人）
      ordinary: 'BATTLE', emergency: 'BATTLE', rare: 'ECHO', boss: 'BOSS',
      anagram: 'ANAGRAM', avenger: 'ANAGRAM', maskless: 'MASKLESS', rail: 'RAIL',
      tbd: 'TBD',
    };
    return map[t] || '';
  }

  /* 藏品模态的数据源：**专属排最前，其余按稀有度**（史诗 → 稀有 → 普通）
   * 用户 2026-09-14 定：专属是 boss 掉落、测试时最常要试，所以放最前。 */
  _allCollectibles() {
    const rank = { boss: 0, epic: 1, rare: 2, common: 3 };
    const list = (Babel.COLLECTIBLES || []).slice();
    (Babel.BOSS_COLLECTIBLES || []).forEach(c => list.push(c));
    list.sort((a, b) => (rank[a.rarity] == null ? 9 : rank[a.rarity]) - (rank[b.rarity] == null ? 9 : rank[b.rarity]));
    return list;
  }

  /* E3 无框条目（自包含，不动 Babel.UI）
   * 全部尺寸由调用方按 s 传入
   * opts 可选：
   *   desc     —— 第二行完整效果描述（给了就变"两行条目"：名称上移、描述在下，专供藏品模态）
   *   src      —— 描述后追加的紫色来源注记（专属藏品："击败〈里恩〉必定获得"）
   *   barColor —— 行右缘的稀有度色条（数值色） */
  _row(x, y, w, h, label, tag, onClick, opts) {
    const o = opts || {};
    const s = o.s || 1, fs = o.fs || ((n) => Math.round(n * s) + 'px');
    const c = this.add.container(x, y);
    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
    const two = !!o.desc;                       // 两行模式（藏品模态）
    const nameY = two ? -11 * s : 0;
    const t = this.add.text(-w / 2 + 12 * s, nameY, label, {
      fontFamily: Babel.FONTS.body, fontSize: o.size || fs(19), color: o.color || T_INK_S,
    }).setOrigin(0, 0.5);
    const tg = tag ? this.add.text(w / 2 - 14 * s, nameY, tag, {
      fontFamily: Babel.FONTS.display, fontSize: fs(10), color: T_MUTED_S,
    }).setOrigin(1, 0.5) : null;
    const items = [hit, t];
    if (tg) items.push(tg);
    if (two) {
      // 第二行：完整描述（灰）＋来源注记（紫）。**截断时必须把来源注记的宽度一起算进去**，
      // 否则长描述 + "· 击败〈…〉必定获得"会撞到右侧的稀有度标签（实测最长那条就会）。
      const ds = this.add.text(-w / 2 + 12 * s, 11 * s, o.desc, {
        fontFamily: Babel.FONTS.body, fontSize: fs(11.5), color: T_MUTED_S,
      }).setOrigin(0, 0.5);
      const srcObj = o.src ? this.add.text(0, 11 * s, o.src, {
        fontFamily: Babel.FONTS.body, fontSize: fs(11), color: (Babel.RARITY_COLOR && Babel.RARITY_COLOR.boss) || T_RED_S,
      }).setOrigin(0, 0.5) : null;
      const maxW = w - 24 * s - (tg ? 56 * s : 0);          // 右侧给稀有度标签留位
      const gap = 8 * s;
      let srcW = srcObj ? srcObj.width + gap : 0;
      const fit = (txt, avail) => {                          // 按实测宽度逐字截断
        if (avail <= 12 * s || txt.width <= avail) return;
        let str = String(txt.text);
        while (str.length > 2 && txt.width > avail) { str = str.slice(0, -1); txt.setText(str + '…'); }
      };
      if (srcW > maxW * 0.55) { fit(srcObj, Math.max(40 * s, maxW * 0.55)); srcW = srcObj.width + gap; }
      fit(ds, maxW - srcW);
      items.push(ds);
      if (srcObj) { srcObj.x = ds.x + ds.width + gap; items.push(srcObj); }
    }
    if (o.barColor != null) {
      items.push(this.add.rectangle(w / 2 - 2 * s, nameY, Math.max(3, Math.round(4 * s)), Math.max(10, Math.round(16 * s)), o.barColor).setOrigin(0.5, 0.5));
    }
    const rule = this.add.rectangle(0, h / 2 - Math.max(1, Math.round(1 * s)) / 2, w, Math.max(1, Math.round(1 * s)), T_RULE).setOrigin(0.5, 0.5);
    items.push(rule);
    c.add(items);
    hit.on('pointerover', () => rule.setFillStyle(T_RED));
    hit.on('pointerout', () => rule.setFillStyle(T_RULE));
    hit.on('pointerup', () => { if (onClick) onClick(); });
    if (o.locked) { hit.disableInteractive(); c.setAlpha(0.45); }
    return c;
  }

  _btn(x, y, w, h, label, onClick, opts) {
    const o = opts || {};
    return Babel.UI.button(this, x, y, w, h, label, onClick, {
      font: Babel.FONTS.body, size: o.size || '13px', fill: T_WHITE,
      stroke: o.stroke == null ? T_RULE : o.stroke, lineW: 1,
      hover: 0xfafafa, color: o.color || T_INK_S, marker: false,
    });
  }

  _setMainInteractive(on) {
    (this._mainButtons || []).forEach(c => {
      const r = c && c.list && c.list[0];
      if (!r) return;
      if (on) { if (r.setInteractive) r.setInteractive({ useHandCursor: true }); }
      else if (r.disableInteractive) r.disableInteractive();
    });
  }

  create() {
    this.cameras.main.setBackgroundColor('#ffffff');
    this.width = this.scale.width;
    this.height = this.scale.height;
    const W = this.width, H = this.height;
    const s = this._s();
    const fs = (n) => Math.round(n * s) + 'px';
    if (!Babel._testCollectibleIds) Babel._testCollectibleIds = [];
    this._mainButtons = [];

    /* ---------- 页眉 ---------- */
    const hudH = 52 * s;
    this.add.rectangle(0, 0, W, hudH, T_WHITE).setOrigin(0, 0);
    this.add.rectangle(0, hudH, W, Math.max(1, Math.round(1 * s)), T_RULE).setOrigin(0, 0);
    this.add.rectangle(30 * s, hudH / 2, 56 * s, 24 * s, T_WHITE).setOrigin(0, 0.5).setStrokeStyle(1, T_RED);
    Babel.UI.text(this, 58 * s, hudH / 2, 'TEST', { font: Babel.FONTS.display, size: fs(11), color: T_RED_S, origin: [0.5, 0.5] });
    Babel.UI.text(this, 100 * s, hudH / 2, '// 战斗测试 · 按层分组',
      { font: Babel.FONTS.display, size: fs(10.5), color: T_MUTED_S, origin: [0, 0.5] });
    Babel.UI.text(this, W - 150 * s, hudH / 2, '已选藏品 ' + Babel._testCollectibleIds.length,
      { font: Babel.FONTS.num, size: fs(14), color: T_INK_S, origin: [1, 0.5] });
    this._mainButtons.push(this._btn(W - 62 * s, hudH / 2, 84 * s, 30 * s, '退出',
      () => { Babel.RunState.init(); this.scene.start('Start'); }, { size: fs(13) }));

    /* ---------- 主体：按层分组；testOnly 类型（"待定"暂存区）单独成组放最后 ---------- */
    const enemies = this._collectEnemies();
    const L = 80 * s, RW = W - 160 * s, cols = 3, colGap = 30 * s, rowH = 46 * s;
    const colW = (RW - (cols - 1) * colGap) / cols;
    let y = 92 * s;

    const byFloor = {}, tbd = [];
    enemies.forEach(e => { if (e.testOnly) tbd.push(e); else (byFloor[e.floor] = byFloor[e.floor] || []).push(e); });
    const groups = Object.keys(byFloor).map(Number).sort((a, b) => a - b).map(fl => ({
      label: 'B' + fl, name: (Babel.FLOORS[fl - 1] || {}).name || ('第' + fl + '层'), note: '', items: byFloor[fl],
    }));
    if (tbd.length) {
      // 待定区：新怪物的暂存处 —— 测试能打，**地图永不生成**（类型未进 layout.typePool）
      // （组头原来的那行说明注记按用户要求去掉了；note 字段保留给以后复用）
      groups.push({ label: 'TBD', name: '待定', note: '', items: tbd });
    }

    groups.forEach(g => {
      const list = g.items;
      Babel.UI.text(this, L, y, g.label, { font: Babel.FONTS.display, size: fs(12), color: T_RED_S, origin: [0, 0.5] });
      Babel.UI.text(this, L + 40 * s, y, g.name,
        { font: Babel.FONTS.body, size: fs(20), color: T_INK_S, origin: [0, 0.5], bold: true });
      if (g.note) {
        Babel.UI.text(this, L + 40 * s + g.name.length * 20 * s + 14 * s, y + 1 * s, '// ' + g.note,
          { font: Babel.FONTS.display, size: fs(10), color: T_MUTED_S, origin: [0, 0.5] });
      }
      Babel.UI.text(this, L + RW, y, list.length + ' 个可测战斗',
        { font: Babel.FONTS.display, size: fs(10), color: T_MUTED_S, origin: [1, 0.5] });
      this.add.rectangle(L, y + 14 * s, RW, Math.max(2, Math.round(2 * s)), T_INK).setOrigin(0, 0.5);
      y += 34 * s;

      list.forEach((e, i) => {
        const cx = L + colW / 2 + (i % cols) * (colW + colGap);
        const ry = y + rowH / 2 + Math.floor(i / cols) * rowH;
        // 待定区里"类别"已在组头写明，条目只显示怪物名（否则会"待定 · 待定怪"重复）
        const label = e.testOnly ? e.name : (this._typeLabel(e.type) + ' · ' + e.name);
        this._mainButtons.push(this._row(cx, ry, colW, rowH,
          label, this._mechTag(e.type), () => {
            Babel.RunState.init();
            Babel.RunState.floor = e.floor;
            Babel.RunState.ownedCollectibles = (Babel._testCollectibleIds || []).slice();
            this.scene.start('Combat', { testType: e.type, enemyIndex: e.idx });
          }, { s: s, fs: fs }));
      });
      y += Math.ceil(list.length / cols) * rowH + 26 * s;
    });

    /* ---------- 底部 ---------- */
    this.add.rectangle(L, H - 74 * s, RW, Math.max(1, Math.round(1 * s)), T_RULE).setOrigin(0, 0.5);
    Babel.UI.text(this, L, H - 46 * s, '测试携带藏品只在本场测试战斗生效，不影响真实进度。',
      { size: fs(12), color: T_MUTED_S, origin: [0, 0.5] });
    this._mainButtons.push(this._btn(W - L - 90 * s, H - 46 * s, 180 * s, 34 * s,
      '选择测试藏品（' + Babel._testCollectibleIds.length + '）',
      () => this._openPicker(), { size: fs(13) }));

    Babel.UI.autoResize(this);
  }

  /* ============================ 藏品模态（E3 · 按 s 缩放） ============================ */
  _openPicker() {
    const all = this._allCollectibles();
    const sel = Babel._testCollectibleIds || (Babel._testCollectibleIds = []);
    const W = this.width, H = this.height;
    const s = this._s();
    const fs = (n) => Math.round(n * s) + 'px';
    this._setMainInteractive(false);
    this._pickerObjs = []; this._pickerRows = [];

    const scrim = this.add.rectangle(W / 2, H / 2, W, H, T_INK, 0.32).setDepth(90).setInteractive();
    this._pickerObjs.push(scrim);

    const pw = Math.min(1040 * s, W - 120 * s), ph = Math.min(620 * s, H - 80 * s);
    const pl = (W - pw) / 2, pt = (H - ph) / 2, pr = pl + pw, pb = pt + ph;
    this._pickerObjs.push(this.add.rectangle(pl, pt, pw, ph, T_WHITE).setOrigin(0, 0).setDepth(91));
    this.add.rectangle(pl, pt, pw, Math.max(2, Math.round(2 * s)), T_INK).setOrigin(0, 0).setDepth(92);
    this.add.rectangle(pl, pb, pw, Math.max(1, Math.round(1 * s)), T_RULE).setOrigin(0, 0).setDepth(92);

    this._pickerObjs.push(Babel.UI.text(this, pl + 30 * s, pt + 26 * s, '测试携带藏品',
      { font: Babel.FONTS.body, size: fs(20), color: T_INK_S, origin: [0, 0.5], bold: true }).setDepth(92));
    this._pickerObjs.push(Babel.UI.text(this, pl + 150 * s, pt + 27 * s, '// SANDBOX LOADOUT',
      { font: Babel.FONTS.display, size: fs(10), color: T_MUTED_S, origin: [0, 0.5] }).setDepth(92));
    this._pickerCountTxt = Babel.UI.text(this, pr - 130 * s, pt + 27 * s, '已选 ' + sel.length,
      { font: Babel.FONTS.num, size: fs(15), color: T_RED_S, origin: [1, 0.5] }).setDepth(92);
    this._pickerObjs.push(this._pickerCountTxt);
    const closeB = this._btn(pr - 62 * s, pt + 26 * s, 42 * s, 28 * s, '×', () => this._closePicker(), { size: fs(15) });
    closeB.setDepth(93); this._pickerObjs.push(closeB);

    // 两行条目（名称 + 完整效果描述）：行高 40 → 56；每页件数 22 → 16（34 件 = 3 页）
    const cols = 2, colGap = 40 * s, rowH = 56 * s;
    const gL = pl + 30 * s, gW = pw - 60 * s;
    const colW = (gW - colGap) / cols;
    const gT = pt + 74 * s;
    const rowsFit = Math.max(3, Math.floor((pb - 84 * s - gT) / rowH));
    const perPage = cols * rowsFit;
    const pages = Math.max(1, Math.ceil(all.length / perPage));
    let page = 0;

    const draw = () => {
      (this._pickerRows || []).forEach(o => o && o.destroy());
      this._pickerRows = [];
      const slice = all.slice(page * perPage, (page + 1) * perPage);
      slice.forEach((it, i) => {
        const cx = gL + colW / 2 + (i % cols) * (colW + colGap);
        const ry = gT + rowH / 2 + Math.floor(i / cols) * rowH;
        const on = sel.indexOf(it.id) >= 0;
        const rc = (Babel.RARITY_COLOR_NUM && Babel.RARITY_COLOR_NUM[it.rarity]) || 0x9b9fa5;
        const row = this._row(cx, ry, colW, rowH, it.name || it.id,
          (Babel.RARITY_LABEL && Babel.RARITY_LABEL[it.rarity]) || '', () => {
            const ix = sel.indexOf(it.id);
            if (ix >= 0) sel.splice(ix, 1); else sel.push(it.id);
            draw();
            if (this._pickerCountTxt) this._pickerCountTxt.setText('已选 ' + sel.length);
          }, {
            s: s, fs: fs, size: fs(19), color: on ? T_RED_S : T_INK_S,
            desc: it.desc || '',                                     // ★ 第二行：完整效果
            src: it.from ? ('· 击败〈' + it.from + '〉必定获得') : '',  // ★ 专属：来源注记（紫）
            barColor: rc,                                            // ★ 右缘稀有度色条
          });
        row.setDepth(93);
        // 勾选点对齐"名称"那一行（两行条目的名称上移 11*s）
        const dot = this.add.rectangle(cx - colW / 2 + 4 * s, ry - 11 * s, 8 * s, 8 * s, on ? T_RED : T_WHITE)
          .setOrigin(0.5, 0.5).setStrokeStyle(1, on ? T_RED : T_RULE).setDepth(94);
        this._pickerRows.push(row, dot);
      });

      const by = pb - 34 * s;
      const mk = (bx, w, label, fn, accent) => {
        const b = this._btn(bx, by, w, 30 * s, label, fn,
          { size: fs(13), stroke: accent ? T_RED : T_RULE, color: accent ? T_RED_S : T_INK_S });
        b.setDepth(94); this._pickerRows.push(b); return b;
      };
      mk(pr - 30 * s - 84 * s, 84 * s, '确定', () => this._closePicker(), true);
      mk(pr - 30 * s - 84 * s - 96 * s, 88 * s, '下一页', () => { if (page < pages - 1) { page++; draw(); } });
      mk(pr - 30 * s - 84 * s - 96 * s - 96 * s, 88 * s, '上一页', () => { if (page > 0) { page--; draw(); } });
      mk(pr - 30 * s - 84 * s - 96 * s - 96 * s - 96 * s, 88 * s, '清空', () => {
        sel.length = 0; draw();
        if (this._pickerCountTxt) this._pickerCountTxt.setText('已选 0');
      });
      const pgTxt = Babel.UI.text(this, pr - 30 * s - 84 * s - 96 * s - 96 * s - 96 * s - 60 * s, by,
        (page + 1) + ' / ' + pages,
        { font: Babel.FONTS.num, size: fs(13), color: T_MUTED_S, origin: [0.5, 0.5] }).setDepth(94);
      this._pickerRows.push(pgTxt);
    };

    this._closePicker = () => {
      (this._pickerRows || []).forEach(o => o && o.destroy());
      (this._pickerObjs || []).forEach(o => o && o.destroy());
      this._pickerRows = []; this._pickerObjs = []; this._pickerCountTxt = null;
      this._setMainInteractive(true);
      this.scene.restart();
    };

    draw();
  }
}

Babel.Scenes = Babel.Scenes || {};
Babel.Scenes.TestScene = TestScene;
