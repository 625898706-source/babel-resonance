/* ============================================================================
 * floorConfig.js —— 节点类型定义 + 每层线路图（左→右 分支网络）
 * ----------------------------------------------------------------------------
 * 【本文件作用】
 * 1) 定义「节点类型」：本作地图上会出现哪些节点（普通作战 / 紧急作战 / BOSS /
 *    得偿所愿 / 商店 / 失与得 / 残响之隙 / 入口）。
 *    每个节点类型有：英文 key、中文标签、主题色、类型（combat=战斗 / node=交互）。
 * 2) 定义「每层的线路图」：一张图（graph），由若干节点和"连接箭头"构成。
 *    玩家从入口进，沿箭头向右走，走到层尾 BOSS 就通关该层。
 * ----------------------------------------------------------------------------
 * 【数据结构】
 * node = {
 *   id: 唯一编号,
 *   col: 列（从左数，0 是入口列）, row: 行（同一列里上下的位置）,
 *   type: 节点类型 key, to: [能到达的下一个节点的 id],
 * }
 * graph = { nodes:[...], startId, bossId }
 * ========================================================================== */

window.Babel = window.Babel || {};

/* 节点类型定义 ------------------------------------------------------------ */
Babel.NODE_TYPES = {
  entry:     { key: 'entry',     label: '入', kind: 'node',   color: '#c9a962', desc: '入口/档案馆' },
  ordinary:  { key: 'ordinary',  label: '战', kind: 'combat', color: '#c9a962', desc: '普通作战' },
  emergency: { key: 'emergency', label: '急', kind: 'combat', color: '#d97706', desc: '紧急作战（倒计时更短、攻击更高）' },
  rare:      { key: 'rare',      label: '隙', kind: 'combat', color: '#8b2635', desc: '残响之隙（罕见战斗，隐藏敌人）' },
  boss:      { key: 'boss',      label: 'BOSS', kind: 'combat', color: '#8b2635', desc: '险路恶敌（层尾 BOSS，击败进入下一层）' },
  reward:    { key: 'reward',    label: '愿', kind: 'node',   color: '#c9a962', desc: '得偿所愿（事件库，给回复/藏品）', sceneTitle: '得偿所愿' },
  shop:      { key: 'shop',      label: '店', kind: 'node',   color: '#d97706', desc: '商店（残页买藏品）', sceneTitle: '残页留下之物' },   // sceneTitle 只改"进店后的场景标题"（回声口吻）；地图仍读 label/desc
  exchange:  { key: 'exchange',  label: '换', kind: 'node',   color: '#9c8b7a', desc: '失与得（藏品交换）', sceneTitle: '失与得' },
  // ★ 不期而遇（2026-09-17 用户要求）：占位实现 —— 进去领一个藏品，然后离开。
  //   场景标题用 sceneTitle；日后要扩成真正的"事件库"，只需在 _renderEncounter 里按事件表分发。
  encounter: { key: 'encounter', label: '遇', kind: 'node',   color: '#5b7f6a', desc: '不期而遇（遇见一件事，先领一份东西）', sceneTitle: '不期而遇' },
  anagram:   { key: 'anagram',   label: '词', kind: 'combat', color: '#8b2635', desc: '乱序拼词（测试）' },
  avenger:   { key: 'avenger',   label: '仇', kind: 'combat', color: '#8b2635', desc: '乱序拼词·复仇者（测试）' },
  maskless:  { key: 'maskless',  label: '妖', kind: 'combat', color: '#8b2635', desc: '词狱怪物·拼词（测试）' },
  rail:      { key: 'rail',      label: '轨', kind: 'combat', color: '#8b2635', desc: '轨道接字母（测试）' },
  /* 待定（暂存区）：**新怪物的临时落脚点** —— 只在「战斗测试」里单独成一组；
   *   带 `testOnly:true` 的类型永远不会被 generateFloor 生成（不在任何 layout.typePool 里），
   *   也不参与地图/进度的任何逻辑；等用户吩咐再把它挪到真正的层与节点类型上去。 */
  tbd:       { key: 'tbd',       label: '待', kind: 'combat', color: '#8b2635', desc: '待定（测试暂存，未接入游戏进程）', testOnly: true },
};

/* 每层线路图：由"随机生成器"生成（每次进层都不同） ----------------------------
 * 规则：
 *   1) 共 columns 列：第 0 列是入口，最后一列是 BOSS，中间是随机中转节点。
 *   2) 每列有 rows 条"车道"（纵向位置）。
 *   3) 边只朝右、且"目标车道 ≥ 源车道"（单调不反转）→ 保证曲线不交叉。
 *   4) 每列车道必连到下一列同车道（保证连通），并有一定概率额外向下多连一条。
 *   5) 最后一列中转全部连到 BOSS。
 * 返回：{ startId, bossId, nodes:[{id,col,row,type,to:[...]}] }
 * ----------------------------------------------------------------------------
 * 说明：col = 列（左→右），row = 车道（上→下）。*/
Babel.generateFloor = function (floorId) {
  const layout = Babel.FLOORS[floorId - 1].layout;
  const columns = layout.columns;   // 总列数（含入口与 BOSS）
  const rows = layout.rows;         // 每列车道数
  const pool = layout.typePool;     // 中转节点类型池

  // 把车道号转成"相对中线的偏移"：中线车道 = 0，这样入口/ BOSS 正好居中
  const offsets = [];
  for (let i = 0; i < rows; i++) offsets.push(i - Math.floor(rows / 2)); // rows=3 → [-1,0,1]

  const startId = 's0';
  const bossId = 'boss';
  const nodes = [];
  const colNodes = {};              // 每列的车道节点 id 数组
  const byId = {};                  // id -> 节点对象

  // ① 入口（中线车道）
  nodes.push({ id: startId, col: 0, row: 0, type: 'entry', to: [] });

  // ② 中转列（col 1 .. columns-2）
  let counter = 0;
  const isCombat = (t) => Babel.NODE_TYPES[t] && Babel.NODE_TYPES[t].kind === 'combat';
  let rareUsed = false;   // ★ 每层最多只能出现一个残响之隙（用户 2026-09-17 要求）
  const pickWeighted = () => {
    const r = Math.random();
    // 残响之隙(rare) ≈2%：但**仅在该层确实定义了 rare 敌人时才生成**
    // （否则 rare 节点会退化成普通战配置 —— CombatScene 取不到 cfg.types.rare 会用 types.ordinary 兜底，
    //   玩家就会看到一个"残响之隙"节点打出普通怪，属于静默不一致。第二层删掉里恩后就属于这种情况。）
    // ★ 已出过一个残响之隙 → 本层不再抽（hasRare=false 时其余类型自动重新归一化，总量仍为 1）
    const hasRare = !rareUsed && !!(Babel.FLOORS[floorId - 1].combat &&
      Babel.FLOORS[floorId - 1].combat.types && Babel.FLOORS[floorId - 1].combat.types.rare);
    // ★ 权重表驱动（2026-09-17 用户要求调权重）：
    //   权重来自该层 layout.weights（相对值，这里自动归一化）；表里没写的类型按 1 计（保底）
    const layoutW = Babel.FLOORS[floorId - 1].layout.weights || null;
    const wOf = (t) => {
      if (t === 'rare') return hasRare ? ((layoutW && layoutW.rare != null) ? layoutW.rare : 2) : 0;
      return (layoutW && layoutW[t] != null) ? layoutW[t] : 1;
    };
    let total = 0;
    for (const t of pool) total += wOf(t);
    total += wOf('rare');
    if (total <= 0) return pool[0];
    let acc = 0;
    for (const t of (hasRare ? ['rare', ...pool] : pool.slice())) {
      acc += wOf(t);
      if (r < acc / total) { if (t === 'rare') rareUsed = true; return t; }
    }
    return pool[pool.length - 1];
  };
  const pickCombat = () => (Math.random() < 0.5 ? 'ordinary' : 'emergency'); // 强制战斗（避开低概率 rare）
  for (let c = 1; c <= columns - 2; c++) {
    colNodes[c] = [];
    const types = [];
    for (let r = 0; r < rows; r++) types.push(pickWeighted());
    // 第一列：强制至少 2 个战斗类节点
    if (c === 1) {
      let combatCount = types.filter(isCombat).length;
      for (let r = 0; r < rows && combatCount < 2; r++) {
        if (!isCombat(types[r])) { types[r] = pickCombat(); combatCount++; }
      }
    }
    for (let r = 0; r < rows; r++) {
      const id = 'n' + (counter++);
      nodes.push({ id: id, col: c, row: offsets[r], type: types[r], to: [] });
      colNodes[c].push(id);
    }
  }

  // ③ BOSS（中线车道，最后一列）
  nodes.push({ id: bossId, col: columns - 1, row: 0, type: 'boss', to: [] });

  nodes.forEach(n => { byId[n.id] = n; });

  // ④ 入口连到第一列所有车道
  byId[startId].to = colNodes[1].slice();

  // ⑤ 中间列之间：按"上中下三排"规则生成，同时保证不交叉 + 全连通。
  //    非交叉约束 = 上排目标 ≤ 中排目标 ≤ 下排目标（单调有序）。
  //    为保证连通：中排取一个**连续区间** [mMin..mMax]，上排连 {0,1}∩{≤mMin}，
  //    下排连 {1,2}∩{≥mMax}，三者并集恰好覆盖 0/1/2 → 每列每个节点都有入边。
  //    · 上排 row0：直行(0)/向下(1)，目标 ≤ mMin
  //    · 中排 row1：连续区间 [mMin..mMax] ⊆ {0,1,2}
  //    · 下排 row2：直行(2)/向上(1)，目标 ≥ mMax
  for (let c = 1; c <= columns - 3; c++) {
    const next = colNodes[c + 1];
    // 中排区间长度（偏向 2~3，分支更多、更灵活）
    const size = Math.random() < 0.3 ? 1 : (Math.random() < 0.6 ? 2 : 3);
    const mMin = Math.floor(Math.random() * (3 - size + 1)); // 起点随机（0..3-size）
    const mMax = mMin + size - 1;
    const s1 = [];
    for (let i = mMin; i <= mMax; i++) s1.push(i);
    const topSet = [0, 1].filter(t => t <= mMin);          // 必含 0 → 连通
    const botSet = [1, 2].filter(t => t >= mMax);          // 必含 2 → 连通
    byId[colNodes[c][0]].to = topSet.map(i => next[i]);
    byId[colNodes[c][1]].to = s1.map(i => next[i]);
    byId[colNodes[c][2]].to = botSet.map(i => next[i]);
  }

  // ⑥ 最后一列中转全部连到 BOSS
  const last = columns - 2;
  for (let r = 0; r < rows; r++) byId[colNodes[last][r]].to = [bossId];

  return { startId: startId, bossId: bossId, nodes: nodes };
};
