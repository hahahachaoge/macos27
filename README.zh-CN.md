# macOS 27 —「Mammoth」· 浏览器里的液态玻璃

> 🌐 **语言 / Language：** [中文](README.zh-CN.md) · [English](README.md)

一个完全运行在浏览器里的 macOS 桌面复刻 —— 无框架、无素材、无构建步骤。每一块玻璃都是
实时计算出来的，内置的 **Intelligence** 智能助手由 **DeepSeek V4 Pro** 驱动。

## ✨ 里面有什么

**真正的 Liquid Glass（液态玻璃）** —— 本作的核心：
- **实时折射** —— 一个动态 SVG 位移场像真实透镜一样，把壁纸**扭曲折射**到每扇窗口下方
  （不只是模糊）；
- **自适应着色** —— 每扇窗口每秒多次采样身后壁纸的颜色，自动重新着色，所以玻璃在夕阳上
  会泛暖光；
- **背景模糊 + 饱和度 + 亮度**逐表面合成；
- **镜面发丝高光描边**与随焦点流动的光泽；
- 每一个材质参数都是活的 CSS 自定义属性 —— 系统设置里的滑块能让**整个操作系统实时重渲染**。

**系统外壳**
- 开机画面 → 锁定屏幕 → 桌面（带首次运行欢迎导览）
- 菜单栏：Apple 菜单、各应用菜单、实时时钟、控制中心
- 程序坞：放大效果、运行指示点、启动弹跳、废纸篓
- 窗口管理：拖动、缩放、吸附（左/右/顶部）、缩放、最小化到 Dock、真全屏、多桌面 Spaces
- Spotlight（`⌘Space`）—— 应用、文件、计算器、系统命令、网络搜索（还支持单位换算）
- 启动台、调度中心（窗口实时缩放）、`⌘Tab` 切换器
- 小组件（时钟/日历/天气）、通知中心、Toast、右键菜单、对话框
- 程序化 UI 音效（WebAudio）—— 开机音、嗖嗖声、叮咚声
- 5 张实时生成的壁纸（Tahoe / Mammoth / Aurora / Sequoia / Mono）

**原生应用**
- **Finder 访达** —— 真实虚拟文件系统（持久化）、网格/列表/分栏视图、重命名、新建文件夹、
  废纸篓、拖放、显示简介、快速查看、标签、最近使用、复制/剪切/粘贴、多选、全盘搜索
- **Intelligence** —— DeepSeek V4 Pro 流式对话（SSE）+ 离线演示大脑，多会话、停止生成
- **System Settings 系统设置** —— 外观、壁纸、Liquid Glass 工作室、DeepSeek 配置、
  声音、Wi-Fi、蓝牙、显示器、通知、键盘、触控板、电池、Apple 账户
- **Terminal 终端** —— `neofetch`、`ls`、`cat`、`open`、`deepseek <问题>`、多会话标签、
  管道与重定向、`grep/find/wc`…
- **Safari** —— 标签页、书签/历史/阅读列表、隐私模式、内嵌浏览（附「在新标签页打开」逃生口）
- **Notes / Mail / Messages / Calendar / Photos / Music**（Liquid Radio 生成式音乐，
  WebAudio 合成引擎）、**Calculator / TextEdit / Preview / About This Mac**

## 🚀 运行

任何静态服务器都可以，或者直接打开 `index.html`：

```bash
# 方式一 —— 双击 index.html（可以，无需服务器）

# 方式二 —— 自带的零依赖服务器（仅需 Node）
node serve.js            # → http://localhost:8080

# 方式三 —— 任何你已有的服务器
python -m http.server 8080
npx serve .
```

需要新版 **Chrome / Edge / Safari**（依赖 `backdrop-filter` 与 SVG 滤镜）。
Firefox 大部分可用，但个别玻璃路径缺少逐表面背板着色。

## 🧠 连接 DeepSeek V4 Pro

助手自带一个风趣的离线大脑，任何环境都能演示。解锁完整模型：

1. 打开 **System Settings → Intelligence**
2. 设置端点（默认 `https://api.deepseek.com`）、选择模型
   （公共旗舰用 `deepseek-chat`；若你的端点暴露了 `deepseek-v4-pro` 就选它），
   粘贴你的 API key
3. 点 **Test connection（测试连接）** —— 会显示延迟，然后就能畅聊

密钥绝不会离开你的浏览器（只存在 localStorage，请求只发往你配置的端点）。
没有 key 时，Messages 里的「Intelligence」联系人和终端的 `deepseek` 命令会自动
回退到离线大脑。

## ⌨️ 快捷键

| 按键 | 功能 |
| --- | --- |
| `⌘Space`（Windows 为 `Ctrl+Space`） | Spotlight（含单位换算 / 全文搜索 / 快捷操作 / 历史） |
| `⌘Tab` / `⌘⇧Tab` | 应用切换器 |
| `⌘W` `⌘M` `⌘N` `⌘,` | 关闭 / 最小化 / 新建窗口 / 系统设置 |
| `⌘H` / `⌥⌘H` | 隐藏应用 / 隐藏其他 |
| `⌘⇧3` | 截图并保存到桌面（真的会生成文件） |
| `F11`（mac 为 `⌃⌘F`） | 进入 / 退出全屏 |
| `Ctrl+←/→`、`Ctrl+1..9` | 切换桌面 Spaces |
| `Esc` | 退出全屏 / 关闭浮层 |

## 🗺️ 架构

```
macos27/
  index.html            单入口，经典脚本，无构建
  css/                  base（令牌）· glass（材质）· shell · apps
  js/
    util.js             DOM 构建器、事件总线、拖拽工具
    store.js            持久化设置 + 主题
    fs.js               虚拟文件系统（localStorage 后端）
    wallpaper.js        实时程序化壁纸
    glass.js            ★ Liquid Glass 引擎（折射、着色、令牌）
    wm.js               窗口管理器（拖动/缩放/吸附/最小化/全屏/Spaces）
    dock.js menubar.js overlays.js ui.js notifications.js sound.js shell.js
    assistant.js        DeepSeek V4 Pro 客户端 + Intelligence 应用
    apps/               finder, safari, notes, mail, messages, calendar,
                        photos, music, calculator, terminal, settings, about…
```

玻璃管线：`wallpaper.js` 每帧渲染场景 → `glass.js` 把它拷贝进一个按窗口矩形裁剪的
全屏画布，套上动态 `feDisplacementMap` 滤镜 → 窗口叠加 `backdrop-filter` + 从壁纸
采样的逐窗口着色 → 顶层再加颗粒质感与镜面高光描边。可以在 System Settings → Liquid Glass
关闭任意环节，或开启 **Reduce Transparency** 切换到扁平回退模式。

## 📝 备注

- 所有数据都保存在浏览器 localStorage（`macos27.*` 键）。Apple 菜单 → **Reset Demo Data…**
  可清空一切并重启。
- 字体：系统 UI 栈（Apple 设备用 SF Pro，其他平台用 Segoe UI）。
- Apple Logo 路径来自 Font Awesome（CC BY 4.0）。其余全部是原创代码。

由 DeepSeek V4 Pro 用 ❤️ 和过量模糊构建。
