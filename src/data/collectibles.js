/* ============================================================================
 * collectibles.js —— 藏品库（Collectibles）
 * ----------------------------------------------------------------------------
 * 【本文件作用】
 * 定义本作《巴别残响》的藏品。藏品是局内一次性获得的收藏品，会改变战斗机制。
 *
 * 【规则】
 *   1) 每件藏品**每局只能获得一次**；获得后暂时踢出"可用池"，本局不再掉落。
 *   2) 获取途径：紧急作战 / 残响之隙（胜利掉落）、商店（每店随机卖 3 件）、
 *      得偿所愿（可随机获得）、失与得（交换；被换出的藏品**放回池子**，后续可再获得）。
 *   3) 稀有度：越强越稀有、获得概率越小（用 weight 加权，权重越小越难出）。
 *      epic 传说 > rare 稀有 > common 普通。
 *
 * 【效果字段】effect = { type, value }，由战斗/状态逻辑读取。
 * ========================================================================== */

window.Babel = window.Babel || {};

Babel.COLLECTIBLES = [
  {
    id: 'giantpage', name: '巨力之页', rarity: 'epic', weight: 1,
    // ★ 2026-09-14 修正：原写"（每答对扣敌 2 点）"是错的。
    //   规则：**每答对的基础伤害恒为 1（不随层数变化）**，伤害成长**只来自藏品叠加** ——
    //   实际伤害 = 基础 1 + 所有 correctDamage 类藏品求和（TotalEffect）。
    //   只带这一件时正好是 2，但再带「慢火 +0.2」「晨读羽笔 +0.3」就不止 2 了。
    desc: '答对造成伤害 +1（可与其它藏品叠加）',
    effect: { type: 'correctDamage', value: 1 },
  },
  {
    id: 'toughspine', name: '坚韧之脊', rarity: 'rare', weight: 2,
    desc: '本局目标生命上限 +5，并回复 5 点',
    effect: { type: 'maxHp', value: 5 },
  },
  {
    id: 'swiftfeather', name: '迅捷之羽', rarity: 'epic', weight: 1,
    desc: '每词倒计时 +4 秒',
    effect: { type: 'timeLimit', value: 4 },
  },
  {
    id: 'silentshield', name: '静默之盾', rarity: 'common', weight: 4,
    desc: '获得 2 点临时生命（优先于目标生命被消耗）',
    effect: { type: 'tempHp', value: 2 },
  },
  {
    id: 'calmseal', name: '从容之印', rarity: 'common', weight: 4,
    desc: '倒计时归零后有 1.5 秒缓冲，不立刻判错',
    effect: { type: 'buffer', value: 1.5 },
  },
  {
    id: 'lifespring', name: '生命之泉', rarity: 'common', weight: 4,
    desc: '每层开始时回复 1 点目标生命',
    effect: { type: 'healFloor', value: 1 },
  },
  {
    id: 'streakflame', name: '连胜之焰', rarity: 'rare', weight: 2,
    desc: '连续答对第 3 次起，每次伤害 +0.5',
    effect: { type: 'combo', value: 0.5, threshold: 3 },
  },
  // ---- 弱藏品池（common，用来稀释强力藏品） ----
  { id: 'qingshi',        name: '轻拾残页', rarity: 'common', weight: 4, desc: '每场战斗胜利额外 +1 残页', effect: { type: 'winCurrency', value: 1 } },
  { id: 'manyipai',       name: '慢一拍',   rarity: 'common', weight: 4, desc: '每词倒计时 +1 秒', effect: { type: 'timeLimit', value: 1 } },
  { id: 'songyikou',      name: '松一口气', rarity: 'common', weight: 4, desc: '目标生命上限 +1（回复 1）', effect: { type: 'maxHp', value: 1 } },
  { id: 'kongbaifeiye',   name: '空白扉页', rarity: 'common', weight: 4, desc: '获得时立即 +5 残页', effect: { type: 'grantCurrency', value: 5 } },
  { id: 'yamashuji',      name: '亚麻书脊', rarity: 'common', weight: 4, desc: '每次购买藏品返还 1 残页', effect: { type: 'buyRefund', value: 1 } },
  { id: 'manhuo',         name: '慢火',     rarity: 'common', weight: 4, desc: '每次答对，对敌伤害 +0.2', effect: { type: 'correctDamage', value: 0.2 } },
  { id: 'qingtaishijie',  name: '轻苔石阶', rarity: 'common', weight: 4, desc: '每层结束 +1 残页', effect: { type: 'floorCurrency', value: 1 } },
  { id: 'zhemo',          name: '赭墨',     rarity: 'common', weight: 4, desc: '连续答对第 5 次起，伤害 +0.1', effect: { type: 'combo', value: 0.1, threshold: 5 } },
  { id: 'fanhuangyejiao', name: '泛黄页角', rarity: 'common', weight: 4, desc: '目标生命上限 +2（回复 2）', effect: { type: 'maxHp', value: 2 } },
  { id: 'qingyuxia',      name: '轻语匣',   rarity: 'common', weight: 4, desc: '胜利后 10% 概率额外 +2 残页', effect: { type: 'winCurrencyChance', value: 2, chance: 0.1 } },
  { id: 'wentangchi',     name: '温汤匙',   rarity: 'common', weight: 4, desc: '点「完成」离开节点时 +1 残页', effect: { type: 'leaveCurrency', value: 1 } },
  { id: 'yangpibianjiao', name: '羊皮边角', rarity: 'common', weight: 4, desc: '目标生命上限 +1（回复 1）', effect: { type: 'maxHp', value: 1 } },
  { id: 'maitanren',      name: '卖炭人',   rarity: 'common', weight: 4, desc: '每个商店额外多卖 1 件藏品', effect: { type: 'shopExtra', value: 1 } },
  { id: 'jingzhi',        name: '静枝',     rarity: 'common', weight: 4, desc: '每场战斗胜利后回复 1 点生命', effect: { type: 'winHeal', value: 1 } },
  // ---- 新增弱藏品（效果渐弱，用来进一步稀释强力藏品） ----
  { id: 'huantuqi',        name: '缓吐气',   rarity: 'common', weight: 4, desc: '每词倒计时 +0.5 秒', effect: { type: 'timeLimit', value: 0.5 } },
  { id: 'xianshengduoren', name: '先声夺人', rarity: 'common', weight: 4, desc: '每场战斗第 1 次答对伤害 +1', effect: { type: 'firstCorrect', value: 1 } },
  { id: 'bifengoufeng',    name: '笔锋偶锋', rarity: 'common', weight: 4, desc: '每次答对 12% 概率额外 +1 伤害', effect: { type: 'critChance', value: 0.12, bonus: 1 } },
  { id: 'huangshen',       name: '恍神',     rarity: 'common', weight: 4, desc: '每场战斗首次受击免疫一次伤害', effect: { type: 'dodgeFirst', value: 1 } },
  // ---- 新增 common（可与同类型藏品叠加；TotalEffect 求和） ----
  { id: 'chenduyubi',      name: '晨读羽笔', rarity: 'common', weight: 4, desc: '答对造成伤害 +0.3', effect: { type: 'correctDamage', value: 0.3 } },
  { id: 'tangjinshuji',    name: '烫金书脊', rarity: 'common', weight: 4, desc: '目标生命上限 +2（回复 2）', effect: { type: 'maxHp', value: 2 } },
  { id: 'yangpizhideng',   name: '羊皮纸灯', rarity: 'common', weight: 4, desc: '获得 1 点临时生命', effect: { type: 'tempHp', value: 1 } },
  { id: 'huixinzhiye',     name: '会心之页', rarity: 'common', weight: 4, desc: '每场战斗第 1 次答对伤害 +0.7', effect: { type: 'firstCorrect', value: 0.7 } },
  { id: 'yaxiangjiuxin',   name: '压箱旧信', rarity: 'common', weight: 4, desc: '每场战斗胜利后回复 1.5 点生命', effect: { type: 'winHeal', value: 1.5 } },
  { id: 'tengxiegong',     name: '誊写工',   rarity: 'common', weight: 4, desc: '每次答对 15% 概率额外 +1 伤害', effect: { type: 'critChance', value: 0.15, bonus: 1 } },
  // ---- 2026-09-18 用户指定的 A 组新增 18 件（rare 10 / epic 8 ✓ 全部走已有 effect 类型 ✓）----
  { id: 'canyezhangben',   name: '残页账本',   rarity: 'rare', weight: 2, desc: '每层结束 +3 残页', effect: { type: 'floorCurrency', value: 3 } },
  { id: 'changmingdeng',   name: '长明灯',     rarity: 'rare', weight: 2, desc: '每词倒计时 +2 秒', effect: { type: 'timeLimit', value: 2 } },
  { id: 'shuangcengji',    name: '双层脊',     rarity: 'rare', weight: 2, desc: '本局目标生命上限 +3，并回复 3 点', effect: { type: 'maxHp', value: 3 } },
  { id: 'hufeng',          name: '护封',       rarity: 'rare', weight: 2, desc: '获得 3 点临时生命', effect: { type: 'tempHp', value: 3 } },
  { id: 'qianzi',          name: '铅字',       rarity: 'rare', weight: 2, desc: '答对造成伤害 +0.6', effect: { type: 'correctDamage', value: 0.6 } },
  { id: 'shudu',           name: '熟读',       rarity: 'rare', weight: 2, desc: '每场战斗第 1 次答对伤害 +2', effect: { type: 'firstCorrect', value: 2 } },
  { id: 'suoyinka',        name: '索引卡',     rarity: 'rare', weight: 2, desc: '连续答对第 2 次起，每次伤害 +0.3', effect: { type: 'combo', value: 0.3, threshold: 2 } },
  { id: 'tengben',         name: '誊本',       rarity: 'rare', weight: 2, desc: '每次答对 15% 概率额外 +2 伤害', effect: { type: 'critChance', value: 0.15, bonus: 2 } },
  { id: 'anjingfangjian',  name: '安静的房间', rarity: 'rare', weight: 2, desc: '倒计时归零后有 3 秒缓冲，不立刻判错', effect: { type: 'buffer', value: 3 } },
  { id: 'zhuangdingxian',  name: '装订线',     rarity: 'rare', weight: 2, desc: '每次购买藏品返还 3 残页', effect: { type: 'buyRefund', value: 3 } },
  { id: 'mosunshuji',      name: '磨损书脊',   rarity: 'epic', weight: 1, desc: '每场战斗胜利 +4 残页', effect: { type: 'winCurrency', value: 4 } },
  /* ★ 2026-09-26 用户："不灭之页太强了直接删掉" → **已删除** ✗
   *   原条目：{ id:'bumiezhiye', name:'不灭之页', rarity:'epic', weight:1,
   *             desc:'答对造成伤害 +2（可与其它藏品叠加）', effect:{ type:'correctDamage', value:2 } }
   *   ★ 为什么它确实过强 ✗：`correctDamage` 是**最直白的固定增伤**，且**每层都生效** ✓
   *     一场 30 题就是 +60 额外伤害 ✓ 而三层 BOSS 才 45 血 ✓ 拿到它≈整局难度塌一半 ✓
   *     （对照：同档的『巨力之页』是 +1 → 30 ✓ 本件是它的**两倍** ✓ 却没任何代价 ✓）
   *   ★ 删除要**两处一起** ✗ —— 这里 + `COLLECTIBLE_SHORT` 里的 `bumiezhiye` ✓
   *     （只删这里会留下半边表 ✓ 项目注释里点名过这个坑 ✓）
   *   ★ 若日后想复刻它的强度 ✓ 请给**代价**（如"答错清零"／"每场限 N 次"）✗
   *     而不是把 +2 加回来 ✓ */
  { id: 'chaojingren',     name: '抄经人',     rarity: 'epic', weight: 1, desc: '连续答对第 2 次起，每次伤害 +0.8', effect: { type: 'combo', value: 0.8, threshold: 2 } },
  { id: 'houshu',          name: '厚书',       rarity: 'epic', weight: 1, desc: '本局目标生命上限 +8，并回复 8 点', effect: { type: 'maxHp', value: 8 } },
  { id: 'jingzhitishen',   name: '静枝的替身', rarity: 'epic', weight: 1, desc: '每场战斗胜利后回复 3 点生命', effect: { type: 'winHeal', value: 3 } },
  { id: 'huyezhi',         name: '护页纸',     rarity: 'epic', weight: 1, desc: '获得 8 点临时生命（优先于目标生命被消耗）', effect: { type: 'tempHp', value: 8 } },
  { id: 'dingyinchui',     name: '定音锤',     rarity: 'epic', weight: 1, desc: '每次答对 30% 概率额外 +2 伤害', effect: { type: 'critChance', value: 0.3, bonus: 2 } },
  { id: 'wuzibei',         name: '无字碑',     rarity: 'epic', weight: 1, desc: '每层结束 +10 残页', effect: { type: 'floorCurrency', value: 10 } },
  // ---- 2026-09-18 用户点名的 B 组 6 件（各自带新 effect 类型 ✓ 消费点已同步接好 ✓）----
  { id: 'jinyiciben',      name: '近义词本',   rarity: 'rare', weight: 2, desc: '在失与得答对时，额外获得 2 残页', effect: { type: 'exchangeBonus', value: 2 } },
  { id: 'pinxieben',       name: '拼写本',     rarity: 'rare', weight: 2, desc: '拼词战斗中，答对伤害 +1', effect: { type: 'anagramDamage', value: 1 } },
  { id: 'suduzhe',         name: '速读者',     rarity: 'rare', weight: 2, desc: '倒计时剩余一半以上时答对，伤害 +1', effect: { type: 'fastAnswerDamage', value: 1 } },
  { id: 'huixiangcanpian', name: '回响残片',   rarity: 'rare', weight: 2, desc: '在残响之隙取得胜利时，额外获得 5 残页', effect: { type: 'rareNodeCurrency', value: 5 } },
  { id: 'jiuyaoshi',       name: '旧钥匙',     rarity: 'rare', weight: 2, desc: '进入 BOSS 战时，获得 2 点临时生命', effect: { type: 'bossStartTempHp', value: 2 } },
  { id: 'kongye',          name: '空页',       rarity: 'epic', weight: 1, desc: '每场战斗的第 1 题，倒计时翻倍', effect: { type: 'firstWordTimeMul', value: 2 } },
  // ---- 2026-09-18 稀释用 common 15 件（用户选定 ✓ 全部复用已有 effect 类型 ✓ 零新机制 ✓）----
  { id: 'maobianzhi',  name: '毛边纸',   rarity: 'common', weight: 4, desc: '答对造成伤害 +0.1', effect: { type: 'correctDamage', value: 0.1 } },
  { id: 'zhejiao',     name: '折角',     rarity: 'common', weight: 4, desc: '答对造成伤害 +0.15', effect: { type: 'correctDamage', value: 0.15 } },
  { id: 'qianbihen',   name: '铅笔痕',   rarity: 'common', weight: 4, desc: '每场战斗第 1 次答对伤害 +0.5', effect: { type: 'firstCorrect', value: 0.5 } },
  { id: 'monian',      name: '默念',     rarity: 'common', weight: 4, desc: '连续答对第 4 次起，每次伤害 +0.1', effect: { type: 'combo', value: 0.1, threshold: 4 } },
  { id: 'ganmo',       name: '干墨',     rarity: 'common', weight: 4, desc: '每次答对 8% 概率额外 +1 伤害', effect: { type: 'critChance', value: 0.08, bonus: 1 } },
  { id: 'danzitie',    name: '单字帖',   rarity: 'common', weight: 4, desc: '连续答对第 3 次起，每次伤害 +0.15', effect: { type: 'combo', value: 0.15, threshold: 3 } },
  { id: 'miaohong',    name: '描红',     rarity: 'common', weight: 4, desc: '每次答对 10% 概率额外 +0.5 伤害', effect: { type: 'critChance', value: 0.10, bonus: 0.5 } },
  { id: 'baozhichen',  name: '薄纸衬',   rarity: 'common', weight: 4, desc: '获得 1 点临时生命', effect: { type: 'tempHp', value: 1 } },
  { id: 'duanjian',    name: '短笺',     rarity: 'common', weight: 4, desc: '每场战斗胜利后回复 0.5 点生命', effect: { type: 'winHeal', value: 0.5 } },
  { id: 'buye',        name: '补页',     rarity: 'common', weight: 4, desc: '目标生命上限 +1（回复 1）', effect: { type: 'maxHp', value: 1 } },
  { id: 'rouguangzhi', name: '柔光纸',   rarity: 'common', weight: 4, desc: '获得 2 点临时生命', effect: { type: 'tempHp', value: 2 } },
  { id: 'suye',        name: '碎页',     rarity: 'common', weight: 4, desc: '每场战斗胜利额外 +1 残页', effect: { type: 'winCurrency', value: 1 } },
  { id: 'qianhui',     name: '铅灰',     rarity: 'common', weight: 4, desc: '每层结束 +1 残页', effect: { type: 'floorCurrency', value: 1 } },
  { id: 'yinni',       name: '印泥',     rarity: 'common', weight: 4, desc: '获得时立即 +3 残页', effect: { type: 'grantCurrency', value: 3 } },
  { id: 'bianqian',    name: '便签',     rarity: 'common', weight: 4, desc: '胜利后 8% 概率额外 +1 残页', effect: { type: 'winCurrencyChance', value: 1, chance: 0.08 } },
];

/* ---- 池 / 抽取 / 生效 工具 ---- */

// 当前"可用"藏品（去掉本局已获得的）
Babel.AvailableCollectibles = function () {
  const owned = (Babel.RunState && Babel.RunState.ownedCollectibles) || [];
  return Babel.COLLECTIBLES.filter(c => owned.indexOf(c.id) < 0);
};

// 从可用池按稀有度加权随机抽一件（权重越小越难出）
Babel.PickCollectible = function () {
  const avail = Babel.AvailableCollectibles();
  if (!avail.length) return null;
  const total = avail.reduce((s, c) => s + c.weight, 0);
  let r = Math.random() * total;
  for (const c of avail) { r -= c.weight; if (r <= 0) return c; }
  return avail[avail.length - 1];
};

// 按 weight **不放回**抽 n 件（2026-09-18 新增：商店要用 ✓）
//   ★ 与 PickCollectible 同一套权重 ✓ —— 商店原来用「等概率洗牌」✗ 导致每店 40% 出 epic ✗
//     （用户："商店 epic 概率太高" ✓ 现在每店 ≈14.8% ✓ 与战斗掉落口径一致 ✓）
Babel.PickCollectibles = function (n) {
  const pool = Babel.AvailableCollectibles().slice();
  const out = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce(function (s, x) { return s + x.weight; }, 0);
    let r = Math.random() * total, idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) { r -= pool[i].weight; if (r <= 0) { idx = i; break; } }
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
};

// 获得某件藏品（记录 + 即时生效：坚韧上限/回复、静默临时生命、空白扉页加残页）
Babel.GrantCollectible = function (c) {
  try { if (Babel.RunState && Babel.RunState.logGain) Babel.RunState.logGain(c && c.id); } catch (e) {}   // ★ 本局总结
  if (!c) return;
  const owned = Babel.RunState.ownedCollectibles;
  if (owned.indexOf(c.id) < 0) owned.push(c.id);
  if (c.effect.type === 'maxHp') { Babel.RunState.maxHP += c.effect.value; Babel.RunState.heal(c.effect.value); }
  if (c.effect.type === 'tempHp') { Babel.RunState.tempHP += c.effect.value; }
  if (c.effect.type === 'grantCurrency') { Babel.RunState.addCurrency(c.effect.value); }
};

// 换出（失与得）：从已拥有中移除 → 放回可用池，后续可再获得
Babel.ReturnCollectible = function (id) {
  try { if (Babel.RunState && Babel.RunState.logTradeOut) Babel.RunState.logTradeOut(id); } catch (e) {}   // ★ 本局总结
  const owned = Babel.RunState.ownedCollectibles;
  const i = owned.indexOf(id);
  if (i >= 0) owned.splice(i, 1);
};

// 汇总某类效果的数值加成（如 correctDamage 全部相加）
Babel.TotalEffect = function (type) {
  let sum = 0;
  const owned = (Babel.RunState && Babel.RunState.ownedCollectibles) || [];
  for (const id of owned) {
    const c = Babel.FindCollectible(id);
    if (c && c.effect && c.effect.type === type) sum += c.effect.value;
  }
  return sum;
};

// 按当前"连续答对次数"计算连击类伤害加成（连胜之焰≥3、赭墨≥5 各自触发）
Babel.ComboBonus = function (n) {
  let sum = 0;
  const owned = (Babel.RunState && Babel.RunState.ownedCollectibles) || [];
  for (const id of owned) {
    const c = Babel.FindCollectible(id);
    if (c && c.effect && c.effect.type === 'combo' && n >= (c.effect.threshold || 3)) sum += c.effect.value;
  }
  return sum;
};

// 暴击类藏品的**加成值**求和（critChance 的 value 是「触发概率」✓ bonus 是「额外伤害」✓）
//   ★ 原来战斗代码把加成写死 +1 ✗ → 新藏品（定音锤/誊本）只能改概率、改不了加成 ✗（2026-09-18 修）
//   ★ 缺 bonus 字段按 1 兜底 ✓（老条目不受影响 ✓）
Babel.CritBonus = function () {
  let sum = 0;
  const owned = (Babel.RunState && Babel.RunState.ownedCollectibles) || [];
  for (const id of owned) {
    const c = Babel.FindCollectible(id);
    if (c && c.effect && c.effect.type === 'critChance') sum += (c.effect.bonus != null ? c.effect.bonus : 1);
  }
  return sum;
};

// 暴击类：每件独立掷骰（2026-09-18 用户指出概率不可能叠加）
//   逐件 Math.random() < 该件概率；掷中就加它自己的加成；多件同时掷中则加成相加
//   返回本次实际获得的额外伤害（可能是 0，调用方直接相加即可）
//   切勿再把概率求和（曾求和成 72%，期望 +4.32，严重超模）
Babel.CritRoll = function () {
  let gain = 0;
  const owned = (Babel.RunState && Babel.RunState.ownedCollectibles) || [];
  for (const id of owned) {
    const c = Babel.FindCollectible(id);
    if (c && c.effect && c.effect.type === 'critChance' && Math.random() < c.effect.value) {
      gain += (c.effect.bonus != null ? c.effect.bonus : 1);
    }
  }
  return gain;
};

// 是否拥有某类效果的藏品（用于"概率触发"类，如轻语匣）
Babel.HasEffect = function (type) {
  const owned = (Babel.RunState && Babel.RunState.ownedCollectibles) || [];
  return owned.some(id => {
    const c = Babel.FindCollectible(id);
    return c && c.effect && c.effect.type === type;
  });
};

Babel.HasCollectible = function (id) {
  return ((Babel.RunState && Babel.RunState.ownedCollectibles) || []).indexOf(id) >= 0;
};

// 跨池按 id 查找藏品（主池 + BOSS 专属池，供背包/效果汇总使用）
Babel.FindCollectible = function (id) {
  return (Babel.COLLECTIBLES.find(c => c.id === id)) ||
         (Babel.BOSS_COLLECTIBLES.find(c => c.id === id)) || null;
};

// 藏品的简短效果标签（设计上给"背包小字"用；※当前 MapScene 的背包详情浮层实际读的是 name + desc，
//   本表属于备用数据 —— 但必须与藏品池**一一对应**，2026-09-14 补齐了后加的 6 件，避免出现半边表）
Babel.COLLECTIBLE_SHORT = {
  giantpage: '伤害+1',
  toughspine: '上限+5',
  swiftfeather: '时限+4s',
  silentshield: '盾+2',
  calmseal: '缓冲1.5s',
  lifespring: '每层回1',
  streakflame: '连击+0.5',
  qingshi: '胜+1残页', manyipai: '时限+1s', songyikou: '上限+1',
  kongbaifeiye: '得+5残页', yamashuji: '购返1', manhuo: '答对+0.2伤', qingtaishijie: '层末+1残页',
  zhemo: '连5+0.1伤', fanhuangyejiao: '上限+2', qingyuxia: '胜10%+2残页', wentangchi: '离+1残页',
  yangpibianjiao: '上限+1', maitanren: '商店+1件', jingzhi: '胜+1命', huantuqi: '时限+0.5s', xianshengduoren: '首击+1', bifengoufeng: '12%伤+1', huangshen: '首次免伤',
  chenduyubi: '答对+0.3伤', tangjinshuji: '上限+2', yangpizhideng: '盾+1',
  huixinzhiye: '首击+0.7', yaxiangjiuxin: '胜+1.5命', tengxiegong: '15%伤+1',
  /* ---- 2026-09-18 A 组新增 18 件的短标签（与藏品池必须一一对应 ✗）---- */
  canyezhangben: '层末+3残页', changmingdeng: '时限+2s', shuangcengji: '上限+3', hufeng: '盾+3',
  qianzi: '答对+0.6伤', shudu: '首击+2', suoyinka: '连2+0.3伤', tengben: '15%伤+2',
  anjingfangjian: '缓冲3s', zhuangdingxian: '购返3',
  mosunshuji: '胜+4残页', chaojingren: '连2+0.8伤', houshu: '上限+8',   // ★ bumiezhiye 已删（2026-09-26 ✓ 见上面注释 ✓）
  jingzhitishen: '胜+3命', huyezhi: '盾+8', dingyinchui: '30%伤+2', wuzibei: '层末+10残页',
  jinyiciben: '失与得+2残页', pinxieben: '拼词伤+1', suduzhe: '速答+1',
  huixiangcanpian: '残响+5残页', jiuyaoshi: 'BOSS开局盾+2', kongye: '首题时限×2',
  maobianzhi: '答对+0.1伤', zhejiao: '答对+0.15伤', qianbihen: '首击+0.5', monian: '连4+0.1伤',
  ganmo: '8%伤+1', danzitie: '连3+0.15伤', miaohong: '10%伤+0.5', baozhichen: '盾+1',
  duanjian: '胜+0.5命', buye: '上限+1', rouguangzhi: '盾+2', suye: '胜+1残页',
  qianhui: '层末+1残页', yinni: '得+3残页', bianqian: '胜8%+1残页',
  'boss-lien-command': '9题+2盾',
  'boss-andoain-break': '3倍数+2伤',
  'boss-emperor-clear': '≤50%伤×1.2',
  'boss-phantom-silence': '前3次免伤',   // ★ 2026-09-26 幽影专属（与上面的池子一一对应 ✓）
  'boss-maskless-seal': '错也有伤1.5',   // ★ 2026-09-26 铁络无面者专属
  'boss-talulah-ember': '连对攀升+2',    // ★ 2026-09-26 塔露拉专属
  'boss-adam-militech': '残血×1.5+3s',  // ★ 2026-09-26 亚当重锤专属（军用斯安威斯坦）
};

// 稀有度颜色与中文标签
Babel.RARITY_COLOR = { epic: '#d4af37', rare: '#5cc5e8', common: '#6b6f76', boss: '#9d5cff' };
// 数值色（供 Phaser 图形填充/描边使用，避免字符串色渲染成黑）
Babel.RARITY_COLOR_NUM = { epic: 0xd4af37, rare: 0x5cc5e8, common: 0x9b9fa5, boss: 0x9d5cff };
Babel.RARITY_LABEL = { epic: '史诗', rare: '稀有', common: '普通', boss: '专属' };

/* ============================================================================
 * 独立 BOSS 藏品池（与主池 Babel.COLLECTIBLES 不共池）
 * ----------------------------------------------------------------------------
 * - 击败"特定 boss"必定掉落：每个条目带 boss 字段（对应敌人 def 的 bossKey，
 *   如 andoain / emperor / lien），只在击败该 boss 时被 Read 取到并掉落。
 * - 稀有度固定 'boss' → 紫色显示。
 * - 不参与主池随机掉落/商店（单独一个池）。
 * - 条目结构：{ id, name, rarity:'boss', boss:'<bossKey>', desc, effect }。
 *   逐条测试：往里加一条，击败对应 boss 即可看到必定掉落。
 * ========================================================================== */
Babel.BOSS_COLLECTIBLES = [
  // 指令机·循环护盾：每累计答对 9 题 → 获得 2 点临时生命（计数不可跨战斗，单场可重复触发；临时生命保留至消耗）
  { id: 'boss-lien-command', name: '指令机', rarity: 'boss', boss: 'lien', from: '里恩',
    desc: '每累计答对 9 题，获得 2 点临时生命。（计数不可跨战斗）',
    effect: { type: 'cmdLoopHeal', value: 2, threshold: 9 } },
  // 破环之诫：连续答对达到 3 的倍数(3/6/9...)时，该题伤害 +2（对应圣环"破环"；计数每场重置）
  { id: 'boss-andoain-break', name: '破环之诫', rarity: 'boss', boss: 'andoain', from: '殉道者 · 安多恩',
    desc: '连续答对达到 3 的倍数时，该题伤害 +2。（每场重置）',
    effect: { type: 'breakLoop', value: 2, threshold: 3 } },
  // 清偿：敌人 HP ≤50% 时，你造成伤害 ×1.2
  { id: 'boss-emperor-clear', name: '清偿', rarity: 'boss', boss: 'emperor', from: '皇帝的利刃',
    desc: '若敌人 HP ≤50%，最终伤害 ×1.2',
    effect: { type: 'executeWarden', multiplier: 1.2, thresholdPct: 0.50 } },
  /* 缄口（2026-09-26 用户定稿）：幽影（二层残响之隙 bossKey='phantom'）的专属藏品
   *   ★ 用户原话："每场战斗前3次受到伤害时（不扣血）"、"要对所有类型战斗触发"
   *   ★★ 口径是**受到伤害**而不是"答错" ✗ —— 所以要挂在 `_playerHit()` 上 ✓ 它是
   *      **所有扣血路径的唯一出口**（已核实：CombatScene 里 3 处调用 =
   *        _onRailTimeout（轨道超时）／ _onAnswer 答错 ／ _doTimeoutReal（超时）
   *      另外奎隆火自爆、里恩攻击阶段、踩到假词也都汇到这里 ✓）
   *   ★ 计数**每场战斗重置**（`this._blocksLeft` 在 create() 里赋 3 ✓ 场景实例在 scene.start 间复用 ✗
   *     所以必须每场显式重置 —— 与 `_dodged` / `_breakLoopCount` 同一个纪律 ✓）
   *   ★ 与「恍神·dodgeFirst」的关系（2026-09-26 用户："缄口和恍神是加算（两个一起有就是四次）"）
   *     · 恍神是**每场 1 次**（`_dodged` 在 create() 里复位 ✓ 不是"整局一次" ✗ 我先前注释写错了 ✓）
   *     · 本件是**每场 3 次**
   *     · 两件**加算** → 同一场总计 **4 格** ✓ 且同一次受击**两件可同时生效**（各扣 1 格 ✓）
   *       ⇒ `_playerHit()` 里两件必须是**独立 `if`** ✗ 不能 `else if` ✓
   *   ★ 与临时生命的配合：`takeDamage` 是**先吃盾再扣命** ✓ 所以被缄口挡下的那次
   *     **连盾都不消耗** ✓（盾留给后面真正挨打的时候 ✓）
   *   ★ rarity 沿用 'boss'（与前三件专属一致 ✓ 紫色『专属』标签 ✓）*/
  { id: 'boss-phantom-silence', name: '缄口', rarity: 'boss', boss: 'phantom', from: '幽影',
    /* ★ 文案口径（2026-09-26 用户："太口语化"→ 改）：
     *   照主池「恍神」那句 "每场战斗首次受击免疫一次伤害" 的写法 ✓
     *   「受击／免疫伤害」是本作既有词汇 ✗ 不要自己造"受到伤害时不扣血"这种白话 ✓
     *   ★ 不加"（每场重置）"——「每场战斗」已经把重置说完了 ✗ 专属池另两件加那半句
     *     是因为它们的计数**不可跨战斗**需要强调 ✓ 本件不需要 ✓ */
    desc: '每场战斗前 3 次受击免疫伤害',
    effect: { type: 'blockFirst', value: 3 } },
  /* 铁络之印（2026-09-26 用户定稿）：铁络无面者（二层 BOSS，bossKey='maskless'）的专属藏品
   *   用户原话："答错题目（包括超时等）依然可以对敌人造成 1.5 点伤害
   *            （这个就不能和其他藏品叠加了，固定 1.5，目前只会被奎隆减伤稀释）"
   *            ＋ 追加确认：**火自爆也算** ✓ ／ **被恍神·缄口免伤的那次也算** ✓
   *            ＋ "要对所有类型战斗触发" ✓
   *   ★★ 口径拆解
   *     · "固定 1.5"     → `value: 1.5` ✓ 走 `_wrongStrike()` 走自己的路 ✗
   *                         **不读** correctDamage/连击/先声夺人/暴击/破环/速读/清偿 ✓
   *                         （答对与答错本来就是两条独立的代码路径 ✓ 天然不叠加 ✓）
   *     · "只被奎隆减伤稀释" → 复用同一段 `dmgMul` 减伤（1.5 × 0.70/0.60/0.50 = 1.05/0.90/0.75 ✓）
   *     · "所有类型战斗触发" → 挂在 `_playerHit()` 上 ✓ 它是**所有扣血路径的唯一出口**
   *                         （四选一答错／超时／轨道超时／拼词错／无面者二阶段／里恩攻击阶段／
   *                           **奎隆火自爆**（skins/quilon.js `_fireBoom` → `scene._playerHit()`）✓）
   *   ★ 时机：**在扣玩家血之前**先打敌人（用户 2026-09-26 选定 ✓）
   *     → 若这一下把敌人打死，本场立即结束、**你就不用挨这一下了** ✓（自带一点"守" ✓）
   *   ★ rarity 沿用 'boss'（与其余专属一致 ✓ 紫色『专属』标签 ✓）*/
  { id: 'boss-maskless-seal', name: '铁络之印', rarity: 'boss', boss: 'maskless', from: '铁络无面者',
    // ★ 文案口径同缄口：主句用本作既有词汇 ✓ 括号补必要的限定 ✓（2026-09-26）
    desc: '答错时仍对敌人造成 1.5 点固定伤害。（不受攻击力加成）',
    effect: { type: 'wrongStrike', value: 1.5 } },
  /* 烈焚灼息（2026-09-26 用户定稿）：塔露拉（二层 BOSS，bossKey='talulah'）的专属藏品
   *   ★ 取自她在《明日方舟》里的招牌技能 ——【烈焚灼息】
   *     官方原文："每秒受到固定值真实持续伤害，初始伤害量为 50/s，在 30s 内**线性提升**至 230/s"
   *     → 本件把"越烧越旺"搬成：**每次连对伤害往上爬** ✓
   *   ★★ 数值是**算过才定的** ✗（用户："太强了" → 我做了对照测算 ✓ 后面又实测收敛了一轮 ✓）
   *     测算基准：BOSS 30~45 血；一层 epic 顶级『巨力之页』= +1 固定 → 一场 30 题 ≈ 额外 30
   *     原案（+0.5 / 无上限）实测好玩家一场 **+105** ✗ —— 直接跳过战斗 ✓ 已否 ✗
   *     ★★ 第一版定的 `cap: 2` **实测偏强** ✗：封顶后还有 17 题吃满 2.0 → 好玩家 **47.6**
   *        （比巨力之页强 59% ✓ 我先前给的 29.4 是**模拟写错**得出的 ✓ 已更正 ✓）
   *     定稿（2026-09-26 用户选 B）：`gain: 0.15` / **`cap: 1.5`**
   *        → 好玩家 ≈ **33.9**（＝与『巨力之页』(30) 同档 ✓）／ 现实玩家 ≈ 12
   *   ★ **`cap` 是必须的** ✗ —— 无上限时伤害随连击长度**平方增长**
   *     （连对 20 次后每题 +9.5 ✓ 已是基础伤害的 10 倍 ✓）
   *   ★ 断连击**清零**（`_burnCount` 在 `_playerHit()` 里归零 ✓ 一处覆盖所有失败路径 ✓）
   *     ⇒ 这件藏品的真正代价是"你必须一直答对" ✓ 而不是数值大小 ✓
   *   ★★ **不能用 `TotalEffect()` 读** ✗✗ —— 它按 `effect.value` 求和 ✓ 本件没有 `value` ✓
   *     → 会算出 NaN → 藏品完全不生效 ✓（踩过 ✓ 已在 CombatScene 改成自己遍历 ✓）
   *   ★ 与『连胜之焰』/『抄经人』的区别：那两件是**固定档位**（连对 3 次起 +0.5 / 第 2 次起 +0.8）
   *     本件是**每连对一次就往上爬** ✗ 前期更弱、越打越猛 ✓ 手感不同 ✓
   *   ★ rarity 沿用 'boss'（与其余专属一致 ✓ 紫色『专属』标签 ✓）*/
  { id: 'boss-talulah-ember', name: '烈焚灼息', rarity: 'boss', boss: 'talulah', from: '塔露拉',
    desc: '每连对一次，伤害 +0.15（最多 +1.5）',
    effect: { type: 'burnStack', gain: 0.15, cap: 1.5 } },
  /* 军用斯安威斯坦（2026-09-26 用户定稿）：亚当重锤（三层残响之隙，bossKey='adamsmasher'）的专属藏品
   *   用户原话："叫军用斯安威斯坦吧，目标生命≤3时最终伤害*1.5，每题倒计时+3，
   *            且每场首次触发时 +2 临时生命"
   *   ★ 名字出处：《赛博朋克：边缘行者》的**军用级**斯安威斯坦植入体 ✓
   *     风味＝**残血才启动的极限加速**（大卫·马丁内斯那条线 ✓ 加速是用命换的 ✓）
   *   ★ 三条效果各自的挂载点（都在 CombatScene ✓ 见该处注释）：
   *     ① `×1.5`  → 挂在**最终乘算**那一段 ✓ 与奎隆减伤乘算（1.5×0.7/0.6/0.5 = 1.05/0.90/0.75 ✓）
   *     ② `+3 秒` → 加在 `this.timeLimit` 上 ✓（本场每题的总时长 ✓ 每题都多 3 秒 ✓）
   *     ③ `+2 盾` → 生命**真的掉到 ≤3 那一刻**给一次 ✓ `_milTempGiven` 保证每场只一次 ✓
   *   ★ 为什么 `value: 1.5` 而不是 1.05 之类 ✗ —— 它是"最终伤害 ×1.5"的**倍率** ✓
   *     与奎隆的减伤**乘算**后自然落到 1.05~0.75 ✓ 不用另算 ✓
   *   ★ 与「铁络之印」的关系：两者都吃"最终乘算" ✓ 所以残血时答错反打也会 ×1.5 ✓
   *     （1.5 × 1.5 = 2.25 ✓ 口径统一 ✓）*/
  { id: 'boss-adam-militech', name: '军用斯安威斯坦', rarity: 'boss', boss: 'adamsmasher', from: '亚当重锤',
    desc: '目标生命 ≤3 时，最终伤害 ×1.5，每题倒计时 +3；每场首次触发时 +2 临时生命',
    effect: { type: 'milBoost', value: 1.5 } },
];

// 取某 boss 目前可掉落的专属藏品（未拥有的；按 boss 过滤）
Babel.PickBossCollectible = function (bossKey) {
  const owned = (Babel.RunState && Babel.RunState.ownedCollectibles) || [];
  const pool = (Babel.BOSS_COLLECTIBLES || []).filter(c => c.boss === bossKey && owned.indexOf(c.id) < 0);
  return pool;
};
