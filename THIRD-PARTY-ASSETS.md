# 第三方素材说明 / Third-Party Assets

本仓库的**代码**是原创的，以 MIT 许可开源。但 `assets/` 下的大部分**美术与音频素材并非原创**，
版权归各自权利人所有，**不包含在 MIT 授权范围内**。

把它们留在仓库里，是为了让这个项目「开箱能跑」、以及作为个人学习与技术演示的存档。
**如果你打算 Fork 后公开发布或商用，请务必替换掉这些素材**（替换方法见文末）。

---

## 一、角色立绘 · `assets/img/`

角色形象与立绘素材来自手机游戏 **《明日方舟》（Arknights）**，版权归 **上海鹰角网络科技有限公司**
及其关联方所有。本仓库中出现的角色包括但不限于：

| 文件 | 角色 |
|---|---|
| `logos-idle.png` | 逻各斯 |
| `andoain-idle.png` | 安多恩 |
| `emperor-idle.png` | 皇帝的利刃 |
| `lien-idle.png` | 里恩 |
| `centurion-idle.png` | 萨卡兹宿主卫巢百夫长 |
| `avenger-idle.png` | 复仇者 |
| `phantom-idle.png` | 幽影 |
| `maskless-idle.png` | 铁络无面者 |
| `talulah-idle.png` | 塔露拉 |
| `piercer-idle.png` | 萨卡兹穿刺手组长 |
| `jesselton-idle.png` | 杰斯顿 |
| `adamsmasher-idle.png` | 亚当重锤 |
| `saint-idle.png` | 圣徒 |
| `quilon-idle.png` | 奎隆 |
| `slug-idle.png` / `hunterpro-idle.png` | 源石虫 / 猎狗pro |

另有 `plate-*-holo.png`、`endfield-texture.png` 等取自官方视觉素材的图版与贴图。

## 二、背景音乐 · `assets/audio/`

| 文件 | 曲目 | 权利人 |
|---|---|---|
| `sakujo.mp3` | ShadyShady | 削除 |
| `shady-sunset.mp3` / `shady-chamber.mp3` | — | 削除 |
| `martyr.mp3` | 殉道之人 | 塞壬唱片-MSR / Erik Castro |
| `lastjudge.mp3` | Last Judge | Christopher Larkin |
| `saikai.mp3` | SAIKAI | Mili |
| `rebel-path.mp3` / `boss-talahla.mp3` / `battle-shoji.mp3` | — | 各原权利人 |
| `boss-saint.mp3` / `boss-quilon.mp3` / `phantom.mp3` | — | 各原权利人 |

`sfx-*.wav` / `sfx-*.mp3` 中的音效分别取自 Mixkit 等免费音效库（按其免费许可使用）。

## 三、字体 · `assets/fonts/`

HarmonyOS Sans SC、Novecento Wide、Gilroy、Space Grotesk、Roboto 等，均按其各自的许可协议
（SIL OFL / 免费商用等）使用。**分发前请自行复核每个字体文件的具体授权条款。**

## 四、引擎

`libs/phaser.min.js` —— [Phaser 3](https://phaser.io/)，MIT 许可，版权归 Phaser 及 Photon Storm Ltd.

---

## 五、如何替换成你自己的素材（合规 Fork 指南）

1. **立绘**：把 `assets/img/*-idle.png` 换成你自己的图（或占位图）。
   尺寸不必一致 —— 每个敌人的 `displayW` / `displayH` 都写在
   `src/config/constants.js` 对应敌人的定义里，改那里即可。
   带 `anim` / `lastFrame` 字段的敌人走的是 spritesheet，静态图则删掉这两个字段。
2. **音乐**：替换 `assets/audio/*.mp3`，路径与曲名写在两处 ——
   `src/config/constants.js` 里的 `Babel.BGM`（全局 BGM）和各敌人的 `bgm: { key, url, volume, title }`。
3. **字体**：替换 `assets/fonts/` 下的 woff2，并同步 `index.html` 里的 `@font-face` 声明。
4. 替换完跑一次 `npm run build` 确认没有 404。

> 如果找不到替代素材，最小可用方案是：全部换成纯色占位图 + 无 BGM，
> 游戏的**全部机制仍可正常运行**（立绘缺失时代码会自动回退到占位图）。

---

## 六、权利主张 / Takedown

如果你是上述任一素材的权利人，且不希望它出现在本仓库中，
请开一个 Issue 说明，我会在第一时间移除对应文件，无需任何法律程序。
