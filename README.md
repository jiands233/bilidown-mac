# Bilidown · Mac & Windows

![macOS 13+](https://img.shields.io/badge/macOS-13%2B-111827?logo=apple&logoColor=white)
![Windows 10/11 x64](https://img.shields.io/badge/Windows-10%2F11%20x64-0078D4?logo=windows&logoColor=white)
![Swift 5.9](https://img.shields.io/badge/Swift-5.9-F05138?logo=swift&logoColor=white)
![Apple Silicon + Intel](https://img.shields.io/badge/Mac-Apple%20Silicon%20%2B%20Intel-0A84FF)

一个本地 B 站视频下载工具。Mac 支持交互式 CLI、原生 SwiftUI App 和本地 Web；Windows 10/11 x64 支持解压即用的本地 Web 版。

[下载 Windows Web 预览版](https://github.com/jiands233/bilidown-mac/releases/download/windows-web-v0.1.0/BilidownWeb-Windows-x64.zip) · [版本说明](https://github.com/jiands233/bilidown-mac/releases/tag/windows-web-v0.1.0) · [Mac 快速开始](#mac-快速开始交互式-cli)

![Bilidown Mac 封面](Assets/Cover.png)

## 平台支持

| 平台 | 使用方式 | 启动要求 |
| --- | --- | --- |
| Windows 10/11 x64 | 本地 Web，解压即用 | 双击启动脚本；运行环境与下载工具随包提供 |
| Mac Apple Silicon / Intel | 本地 Web、交互式 CLI | 可使用打包 Web 文件夹或源码脚本 |
| macOS 13+ | 原生 SwiftUI App | 源码构建需要 Swift 5.9 工具链 |

Windows 首版为预览版：32 项自动化测试及包完整性检查通过，尚未完成 Windows 实机验收。详细情况见 [验证记录](docs/windows-web-validation.md)。

## 为什么是 Bilidown

- **一条命令启动**：安装后在任意目录输入 `bilidown`
- **交互式终端体验**：带 Logo、菜单和 Claude/Codex 风格输入框
- **自动清洗链接**：粘贴带 `spm_id_from`、`vd_source` 的长链接即可
- **常用画质齐全**：最佳、1080p、720p、仅音频
- **登录画质支持**：按需读取本机 Chrome Cookie；Windows 还支持本机 Netscape Cookie 文件
- **跨平台 Web**：Windows 与 Mac 使用相同页面；Mac 另有 CLI 和原生 App
- **依赖随包提供**：Windows ZIP 内置 Node.js、`yt-dlp`、`ffmpeg` 和 `ffprobe`；Mac 提供 Apple Silicon 与 Intel 下载工具

## Windows Web 版（免安装）

1. [下载 Windows x64 ZIP（约 122 MB）](https://github.com/jiands233/bilidown-mac/releases/download/windows-web-v0.1.0/BilidownWeb-Windows-x64.zip)。
2. 完整解压到本地目录，双击 `启动 Bilidown Web.cmd`。
3. 服务启动成功后，浏览器自动打开 `http://127.0.0.1:4789`，粘贴 B 站链接即可开始。

包内自带 Windows x64 Node.js、yt-dlp、ffmpeg 和 ffprobe，无需安装开发环境。请保持终端窗口打开，停止服务时按 `Ctrl+C`。服务只允许本机访问。

支持画质选择、仅音频、全部分 P / 合集、原生保存目录选择和环境检查。默认不使用 Cookie；需要登录资源时可选择 Chrome 自动读取或本机 Netscape 格式 `cookies.txt` 文件。

开发者可在 Mac 或 Windows 上制作 ZIP：

```bash
python3 script/package_web_windows.py
```

产物：`dist/BilidownWeb-Windows-x64.zip`。详细启动、Cookie、端口设置和故障排查见 [Windows 使用说明](docs/windows-web.md)。

运行自动化检查：

```bash
node --test web-bilidown/test/*.test.js
python3 -m unittest discover -s script -p 'test_package_web_windows.py'
```

Windows 实机验收状态见 [验证记录](docs/windows-web-validation.md)。

## Mac 快速开始：交互式 CLI

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

## Mac 命令模式

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

## 本地 Web 版（Mac）

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

- Windows Web 默认不读取 Cookie，可选择 Chrome 自动读取或本机 `cookies.txt` 文件；读取失败会报错，不会无提示地改为无登录下载
- Mac CLI 默认通过 `yt-dlp --cookies-from-browser chrome` 读取本机 Chrome Cookie
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

HTTP 412 可能是 B 站请求校验或风控导致，更新工具不保证解决。Windows 用户请先确认浏览器可以访问视频，按需使用 Cookie，并检查 [Releases](https://github.com/jiands233/bilidown-mac/releases) 中是否有更新。

Mac 用户可先使用不带追踪参数的标准视频链接，并更新项目内置依赖：

```bash
./mac-bilidown/scripts/fetch-vendor-deps.zsh
```

然后重新运行 `bilidown`。交互模式会自动清洗问号后的追踪参数。

### 想确认环境是否正常

```bash
bilidown doctor
```

### 依赖缺失或不可执行

Windows 用户请重新完整解压 ZIP，并点击页面的“检查环境”。Mac 用户运行：

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
├── script/                    # 构建、安装及 Mac / Windows 打包脚本
├── docs/                      # Windows 使用说明与验证记录
└── Assets/                    # 封面与 App 图标
```

更多文档：

- [中文 CLI 使用说明](mac-bilidown/使用说明.md)
- [English CLI README](mac-bilidown/README.md)
- [第三方依赖许可](mac-bilidown/THIRD_PARTY_LICENSES.md)

## 使用说明

下载能力基于 `yt-dlp` 的 Bilibili extractor 和内置 `ffmpeg`。请仅下载你有权访问和保存的内容，并遵守 B 站服务条款及当地法律。
