# Bilidown Mac

![macOS 13+](https://img.shields.io/badge/macOS-13%2B-111827?logo=apple&logoColor=white)
![Swift 5.9](https://img.shields.io/badge/Swift-5.9-F05138?logo=swift&logoColor=white)
![Apple Silicon + Intel](https://img.shields.io/badge/Mac-Apple%20Silicon%20%2B%20Intel-0A84FF)

一个专为 macOS 制作的本地 B 站视频下载工具。既可以在终端输入 `bilidown` 使用交互式 CLI，也可以运行原生 SwiftUI App 或本地 Web 页面。

![Bilidown Mac 封面](Assets/Cover.png)

## 为什么是 Bilidown

- **一条命令启动**：安装后在任意目录输入 `bilidown`
- **交互式终端体验**：带 Logo、菜单和 Claude/Codex 风格输入框
- **自动清洗链接**：粘贴带 `spm_id_from`、`vd_source` 的长链接即可
- **常用画质齐全**：最佳、1080p、720p、仅音频
- **登录画质支持**：按需读取本机 Chrome Cookie
- **三种使用方式**：CLI、原生 macOS App、本地 Web
- **依赖随项目提供**：内置 Apple Silicon 与 Intel 版 `yt-dlp`、`ffmpeg`

## 快速开始：交互式 CLI

### 1. 下载项目

```bash
git clone https://github.com/jiands233/bilidown-mac.git
cd bilidown-mac
```

### 2. 安装 `bilidown` 命令

```bash
./script/install_bilidown.sh
source ~/.zshrc
```

### 3. 开始使用

```bash
bilidown
```

启动后可以直接选择：

```text
1  快速下载
2  查看视频信息
3  环境检查
4  退出
```

快速下载会依次询问 B 站链接、清晰度和 Chrome Cookie。默认保存到：

```text
~/Downloads/Bilidown
```

> 安装命令会在 `~/bin` 创建指向当前项目的符号链接，并在需要时把 `~/bin` 加入 `~/.zshrc`。安装后请保留项目目录；如果移动项目，请重新运行安装脚本。

## 命令模式

交互模式之外，也可以直接传入参数，适合脚本、Raycast 和快捷指令。

```bash
# 检查运行环境
bilidown doctor

# 查看视频信息
bilidown info "https://www.bilibili.com/video/BV..."

# 下载最佳画质
bilidown download "https://www.bilibili.com/video/BV..."

# 下载 720p，不读取 Cookie
bilidown download "https://www.bilibili.com/video/BV..." \
  --quality 720p \
  --no-cookies

# 下载整个多 P / 合集
bilidown download "https://www.bilibili.com/video/BV..." \
  --playlist all
```

### 常用参数

| 参数 | 可选值 | 默认值 |
| --- | --- | --- |
| `--quality` | `best`、`1080p`、`720p`、`audio` | `best` |
| `--output` | 任意本地目录 | `~/Downloads/Bilidown` |
| `--playlist` | `current`、`all` | `current` |
| `--no-cookies` | 不读取浏览器 Cookie | 默认读取 Chrome Cookie |
| `--cookies-from-browser` | 浏览器名称 | `chrome` |

完整命令说明：

```bash
bilidown help
```

## 原生 macOS App

需要 macOS 13 或更高版本，以及可用的 Swift 5.9 工具链。

```bash
./script/build_and_run.sh
```

构建完成后会生成并打开：

```text
dist/BilidownMac.app
```

App 支持链接输入、保存目录选择、画质选择、Chrome Cookie 开关，以及自动、默认、深色、透明四种图标外观策略。

## 本地 Web 版

```bash
./script/run_web.sh
```

浏览器打开：

```text
http://127.0.0.1:4789
```

Web 服务仅绑定 `127.0.0.1`，链接和 Cookie 不会提交到项目自己的远程服务器。

需要制作可分发文件夹时运行：

```bash
./script/package_web.sh
```

输出目录为 `dist/BilidownWeb`。对方可以在 Mac 上双击其中的 `启动 Bilidown Web.command`。

## Cookie 与隐私

- CLI 默认通过 `yt-dlp --cookies-from-browser chrome` 读取本机 Chrome Cookie
- Cookie 只由本机下载进程使用，不会写入仓库或上传到 Bilidown 服务
- 首次读取时，macOS 可能询问是否允许访问 Chrome Safe Storage
- 只下载公开视频时，可以在交互菜单选择“不使用”，或添加 `--no-cookies`

如果 Keychain 授权等待超时，可以先运行：

```bash
bilidown download "https://www.bilibili.com/video/BV..." --no-cookies
```

## 常见问题

### `zsh: command not found: bilidown`

回到项目目录重新安装并刷新终端环境：

```bash
./script/install_bilidown.sh
source ~/.zshrc
```

### B 站返回 HTTP 412

先使用不带追踪参数的标准视频链接，并更新项目内置依赖：

```bash
./mac-bilidown/scripts/fetch-vendor-deps.zsh
```

然后重新运行 `bilidown`。交互模式会自动清洗问号后的追踪参数。

### 想确认环境是否正常

```bash
bilidown doctor
```

### 依赖缺失或不可执行

```bash
./mac-bilidown/scripts/fetch-vendor-deps.zsh
```

需要同时准备 Apple Silicon 和 Intel 依赖：

```bash
./mac-bilidown/scripts/fetch-vendor-deps.zsh --all-arch
```

## 项目结构

```text
BilidownMac/
├── Sources/BilidownMac/       # SwiftUI macOS App
├── mac-bilidown/              # 核心 CLI 与内置依赖
│   ├── bin/bilidown
│   ├── scripts/
│   └── vendor/
├── web-bilidown/              # 本地 Web 界面与 Node.js 服务
├── script/                    # 构建、安装和打包脚本
└── Assets/                    # 封面与 App 图标
```

更多文档：

- [中文 CLI 使用说明](mac-bilidown/使用说明.md)
- [English CLI README](mac-bilidown/README.md)
- [第三方依赖许可](mac-bilidown/THIRD_PARTY_LICENSES.md)

## 使用说明

下载能力基于 `yt-dlp` 的 Bilibili extractor 和内置 `ffmpeg`。请仅下载你有权访问和保存的内容，并遵守 B 站服务条款及当地法律。
