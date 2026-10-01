# 巴别残响 · Babel Resonance

> **背单词，但是集成战略。**

一款「**英语词汇 × Roguelike 选路**」的网页游戏。你在随机生成的语域地图上选节点前进，
战斗的方式是**看英文词、选中文义**；击败层尾 BOSS，进入下一层语域。

![Phaser](https://img.shields.io/badge/Phaser-3.80.1-8b2635?style=flat-square)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square)
![Electron](https://img.shields.io/badge/Electron-31-47848F?style=flat-square)
![License](https://img.shields.io/badge/License-MIT%20(code%20only)-c9a962?style=flat-square)

---

## ⚠️ 版权声明（请先读这一节）

本仓库的**代码**以 MIT 许可开源。但 **`assets/` 下的美术与音乐素材绝大多数不是本项目原创**：

- **角色立绘**来自手机游戏《明日方舟》（版权归上海鹰角网络及其关联方）
- **BGM** 来自 Mili、Christopher Larkin、塞壬唱片、削除等商业音乐人的作品

这些素材**不在 MIT 授权范围内**，仅作为个人学习、研究与技术演示用途留存于本仓库。
如果你是权利人且希望移除，开个 Issue 说明即可，我会立刻处理，无需任何法律程序。

**Fork 或二次分发前请自行替换素材** —— 完整清单与替换方法见 **[THIRD-PARTY-ASSETS.md](THIRD-PARTY-ASSETS.md)**。

---

## 目录

- [一、这是什么](#一这是什么)
- [二、玩法](#二玩法)
- [三、三层结构](#三三层结构)
- [四、快速开始](#四快速开始)
- [五、技术栈与架构](#五技术栈与架构)
- [六、目录结构](#六目录结构)
- [七、设计文档](#七设计文档)
- [八、开发规范](#八开发规范)
- [九、许可与致谢](#九许可与致谢)

---

## 一、这是什么

你扮演罗德岛的**逻各斯**，被一本词典卷入「**词之塔**」。塔有若干层**语域**，
每一层是一张「左 → 右」的**分支线路图**，像《明日方舟》集成战略那样**选路前进**：

```
入口 ──┬── 普通作战 ──┬── 商店 ──────┬── BOSS
       ├── 紧急作战 ──┤              │
       └── 不期而遇 ──┴── 得偿所愿 ──┘
```

节点类型：**普通作战 / 紧急作战 / 残响之隙（罕见战斗）/ 商店 / 得偿所愿 / 不期而遇 / 失与得 / BOSS**。

**词战**是核心：屏幕上给一个英文词与 4 个中文选项，倒计时内选对则敌人掉血，
选错或超时则你掉血。伤害的成长**只来自藏品叠加**（基础伤害恒为 1）—— 这是刻意的设计，
让「构筑」而不是「数值」决定强度。

## 二、玩法

| 系统 | 说明 |
|---|---|
| **目标生命** | 全局共享，默认 10 点，归零则本局失败 |
| **残页** | 货币，开局 15 张，用于在商店购买藏品 |
| **藏品** | 局内构筑核心，支持 `correctDamage` / `timeLimit` / `maxHp` / `combo` / `critChance` / `dodgeFirst` 等 20 余种效果 |
| **连击** | 连续答对触发连击加成 |
| **同局去重** | 同一局内出过的词不会重复出现（跨层累积），词库耗尽才开启下一轮 |

**作答形式不止四选一**，不同敌人有各自的机制：

- **选中文义** —— 基础形式
- **乱序拼词** —— 给中文释义，用乱序字母块把英文词拼回来
- **语境拼词** —— 给一个挖空首字母的英文句子，据上下文拼词
- **静默回响** —— 单词只完整闪现一瞬，字母随后被黑暗逐个吃掉，靠记忆复原
- **义近/形近辨析** —— 4 个中文选项全是近义词，考的是细微差别
- **介词搭配** —— 给短语骨架，从 16 个介词里选出正确的那一个

## 三、三层结构

| 层 | 语域 | 主题 | 敌人 |
|---|---|---|---|
| **1** | **回声层** | 万物之名，尚存回声。—— 认识并说出飘荡的词之回响。 | 源石虫 · 猎狗pro · 里恩 · **BOSS：殉道者 · 安多恩 / 皇帝的利刃** |
| **2** | **回响层** | 词开始扭曲，外来之物混入。—— 辨清正在回响的每一句话。 | 萨卡兹宿主卫巢百夫长 · 复仇者 · 幽影 · **BOSS：铁络无面者 / 塔露拉** |
| **3** | **残响层** | 碎片不再成词，只剩音节。—— 趁湮灭之前，把它们重新拼回名字。 | 萨卡兹穿刺手组长 · 杰斯顿 · **BOSS：亚当重锤 / 圣徒 / 奎隆** |

每层的 BOSS 从一个**变体池**里随机抽取，各自带专属机制与专属 BGM：

- **殉道者 · 安多恩** —— 「圣环」：连续答对 3 题破环，破环 2 次进入二阶段
- **皇帝的利刃** —— 「审问」：二阶段切换为义近/形近辨析，答错后续题目降为二选一
- **幽影** —— 「静默回响」：字母被逐个吞噬，全消后靠记忆拼回
- **亚当重锤** —— 夜之城皮肤 + 弹幕识别
- **圣徒 / 奎隆** —— 各自有独立战斗皮肤；奎隆为三阶段机制，末段为介词搭配

## 四、快速开始

需要 **Node.js 18+**。

```bash
git clone <你的仓库地址>
cd 英语集成战略
npm install
```

> **注意**：仓库里包含约 90MB 的 `assets/`（立绘与 BGM），clone 会稍慢一些。

### 开发

```bash
npm run dev        # Vite 开发服务器（HMR），浏览器打开提示的地址
```

### 构建网页版

```bash
npm run build      # 产出 dist/
npm run preview    # 本地预览 dist/
```

### 构建桌面版（Electron）

```bash
npm run dist:dir   # 解包版 → release/win-unpacked/巴别残响.exe（快，日常自测用这个）
npm run dist       # 便携版单文件 EXE → release/BabelResonance-1.0.0.exe（慢，交付用）
```

> **国内网络提示**：下载 Electron 与打包二进制若卡住，先设镜像：
> ```powershell
> $env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
> $env:ELECTRON_BUILDER_BINARIES_MIRROR='https://npmmirror.com/mirrors/electron-builder-binaries/'
> ```
> npm 11 有 `allow-scripts` 安全策略，若 Electron 二进制没下载成功，执行 `npm rebuild electron esbuild`。

### 操作方式

- **地图**：点高亮的节点前进
- **词战**：鼠标点击选项 / 字母块；倒计时结束前没作答即算错
- **节点事件**：点按钮完成交互，再点「完成」回地图

## 五、技术栈与架构

| 层 | 选型 |
|---|---|
| 引擎 | **Phaser 3.80.1**（厂商化在 `libs/phaser.min.js`，经典 `<script>` 加载，**不是 npm 依赖**） |
| 构建 | **Vite 5** + `vite-plugin-static-copy`（`assets/` 与 `libs/` 原样拷贝到 `dist/`） |
| 桌面壳 | **Electron 31** + **electron-builder 24** |
| 语言 | 原生 JavaScript，**无框架、无 TypeScript** |

### 一个不太常见的设计：全局 `window.Babel`

`src/**` 下**没有 import / export**。每个文件都是一个**副作用模块**，往全局对象上挂东西：

```js
window.Babel = window.Babel || {};
Babel.Something = ...;
```

再由 `src/main.js` 作为唯一的 ES Module 入口，**按依赖顺序** import 它们：

```
常量 → 词库 → 词战 → 楼层 → 运行状态 → 藏品 → UI → 各场景 → 入口
```

这样做的理由：

1. **Phaser 的场景类天然需要一个全局注册表**，`Babel.Scenes.X` 正好充当
2. **跨文件共享状态不需要层层传递** —— 局内状态集中在 `Babel.RunState` 单例
3. **可以在纯 Node 沙箱里用伪 Phaser 桩直接跑逻辑**，项目里有大量这类一次性自测脚本

> 代价是**加载顺序即依赖顺序**，改 `main.js` 的 import 顺序要小心。

**关于 `autoResize`**：每个场景 `create()` 末尾都调用 `Babel.UI.autoResize(scene)`，
窗口尺寸变化时 `scene.restart()` 重排。之所以敢直接 restart，是因为**所有需要跨场景持久的状态都放在 `RunState` 里**，场景实例本身无状态。

## 六、目录结构

```
英语集成战略/
├── index.html                  入口页：@font-face 字体声明 + phaser（经典脚本）+ 模块入口
├── package.json                npm 脚本 + electron-builder 打包配置
├── vite.config.mjs             base './'，static-copy assets/libs → dist
├── electron/main.js            Electron 主进程（加载 dist/index.html）
├── libs/phaser.min.js          引擎（原样拷贝，不参与打包）
│
├── src/
│   ├── main.js                 唯一入口：按依赖顺序 import + new Phaser.Game
│   ├── config/
│   │   └── constants.js        ★ 所有数值的唯一真源：配色 / 字体 / BATTLE / BGM / FLOORS（含全部敌人定义）
│   ├── data/
│   │   ├── RunState.js         局内全局单例（血量 / 残页 / 藏品 / 已用词 / 地图图）
│   │   ├── gaokaoWords.js      高考词库（主词库）
│   │   ├── wordbank.js         出题器（抽词 + 干扰项 + 去重）
│   │   ├── floorConfig.js      节点类型定义 + 线路图随机生成器
│   │   ├── collectibles.js     藏品定义与效果汇总
│   │   ├── affixes.js          词缀库
│   │   ├── synonyms.js         失与得 · 近义题库
│   │   ├── antonymWords.js     反义词库
│   │   ├── emperorWords.js     皇帝的利刃 · 义近/形近专属库
│   │   ├── masklessWords.js    铁络无面者 · 语境拼词库
│   │   ├── prepWords.js        奎隆三阶段 · 介词搭配库
│   │   ├── senseWords.js       熟词生义库
│   │   ├── sentenceRoles.js    句子成分库
│   │   ├── encounterQuiz.js    不期而遇 · 事件题库
│   │   └── fireWords.js        奎隆一/二阶段 · 火上词库
│   └── scenes/
│       ├── ui.js               ★ 通用 UI 工具（Babel.UI：text / panel / button / row / chip / editorHeader / autoResize）
│       ├── BootScene.js        预载资源、注册 spritesheet、等字体
│       ├── StartScene.js       主菜单
│       ├── MapScene.js         地图行进：画线路图、点节点
│       ├── CombatScene.js      ★ 词战（约 4000 行，全部战斗机制的宿主）
│       ├── NodeEventScene.js   商店 / 得偿所愿 / 不期而遇 / 失与得
│       ├── SummaryScene.js     每局总结
│       ├── TestScene.js        战斗测试台（可单独打任意敌人）
│       ├── EndScene.js         结算 / 结局
│       ├── mechanics/
│       │   └── barrage.js      弹幕机制（亚当重锤）
│       └── skins/              敌人专属战斗皮肤（各约 1000~4000 行，独立文件）
│           ├── nightcity.js    亚当重锤 · 夜之城
│           ├── saint.js        圣徒
│           └── quilon.js       奎隆 · 授法
│
├── assets/
│   ├── img/                    立绘与图版（.png / spritesheet）
│   ├── audio/                  BGM 与音效
│   ├── fonts/                  woff2 网页字体（由 Vite 打包内联）
│   ├── skin-saint/             圣徒皮肤专用素材
│   └── skin-quilon/            奎隆皮肤专用素材
│
├── 设计预览/                    美术与机制的 HTML 探索稿（可直接用浏览器打开）
├── docs/                       设计规范文档
└── 巴别残响_*.md                剧情 / 玩法 / UI 三份设定文档
```

## 七、设计文档

| 文档 | 内容 |
|---|---|
| [巴别残响_剧情设定文档.md](巴别残响_剧情设定文档.md) | 世界观、词之塔、各层语域与角色设定 |
| [巴别残响_系统玩法设定.md](巴别残响_系统玩法设定.md) | 节点、数值、藏品、经济系统 |
| [巴别残响_UI设计文档.md](巴别残响_UI设计文档.md) | E3「美术馆展签」视觉体系与设计 token |
| [设计预览/](设计预览) | 各机制与皮肤的设计探索稿（纯 HTML，浏览器直接打开） |

## 八、开发规范

[docs/开发规范.md](docs/开发规范.md) 是本项目**唯一权威**的编写规范，涵盖：

- 命名与文件组织、`window.Babel` 副作用模块的写法
- 设计系统（色板 / 字体 / 组件）与 UI 工具用法
- 战斗机制的**作用域门控红线**：任何敌人专属的机制都必须门控在最窄作用域，
  严禁在通用代码里用三元分支，否则会污染所有战斗
- 加层 / 加敌人 / 加藏品 / 加素材的标准流程
- 构建、打包、BGM 与立绘排障
- 一份很长的**踩坑清单**（每一条都附了病因与判据）

> 规范里保留了大量「先写错、再修对」的记录 —— 那不是废话，是这个项目最贵的部分。

## 九、许可与致谢

- **源代码**：[MIT](LICENSE)
- **第三方素材**：版权归各权利人所有，**不在 MIT 范围内**，详见 [THIRD-PARTY-ASSETS.md](THIRD-PARTY-ASSETS.md)
- **引擎**：[Phaser 3](https://phaser.io/)（MIT）

致谢：《明日方舟》的世界观与美术、集成战略的玩法框架，以及本项目所用全部音乐的创作者。

---

<div align="center">

**《巴别残响》** —— 名字是这个世界最后的咒语。

</div>
