# Bilidown Mac

![Bilidown Mac 封面](Assets/Cover.png)

这是一个 macOS 版 B 站视频下载工具。可以直接打开图形 App 输入链接下载，也可以用命令行工作流调用。

当前版本已经内置专属 App 图标，并在图形界面中加入了轻量的 macOS 玻璃材质效果。图标包含默认、深色、透明三种外观，App 内可以选择“自动 / 默认 / 深色 / 透明”。

## 图形 App

运行：

```bash
./script/build_and_run.sh
```

App 功能：

- 输入 B 站视频链接
- 选择保存文件夹
- 选择清晰度：最佳、1080p、720p、仅音频
- 点击“下载视频”后输出到所选目录
- 默认不读取 Chrome Cookie；需要登录后高清资源时，勾选“使用 Chrome Cookie”

构建脚本会生成并启动：

```text
dist/BilidownMac.app
```

Codex 里也配置了 Run action，可以直接点 Run 启动。

## 独立双平台 App

新整合版 App 独立于上面的 `BilidownMac.app`，不会替换旧 App：

```bash
./script/build_and_run_videodown.sh
```

构建脚本会生成并启动：

```text
dist/VideoDownMac.app
```

功能：

- 自动识别 B 站和 YouTube 链接
- 选择清晰度：最佳、1080p、720p、仅音频
- 可选使用 Chrome Cookie
- 可选下载全部播放列表 / 合集
- B 站下载调用 `mac-bilidown/bin/bilidown`
- YouTube 下载调用 `youtube-down/bin/youtubedown`

Codex 里新增了 `Run Integrated` action，用于启动这个双平台 App；原来的 `Run` 仍然启动 `BilidownMac.app`。

## VideoSpeechAgent

`VideoSpeechAgent` 是独立的演讲学习包工作流：保留下载器能力，同时把 YouTube 演讲整理成中英学习文稿包。

运行 App：

```bash
./script/build_and_run_videospeech_agent.sh
```

CLI 入口：

```bash
bin/videospeech --help
bin/videospeech run --url "https://www.youtube.com/watch?v=..." --download-media --quality 720p
bin/videospeech build --project "$HOME/Documents/VideoSpeechAgent/data/VIDEO_ID"
bin/videospeech verify --project "$HOME/Documents/VideoSpeechAgent/data/VIDEO_ID"
```

第一次在其他设备使用 CLI 时：

```bash
./script/bootstrap_videospeech_env.sh
```

安装 Codex Skill：

```bash
./script/install_videospeech_skill.sh
```

Skill 名称是 `video-speech-agent`。它负责读取 `agent_task.md` 和 `segments.en.json`，补齐 `segments.zh.json` 与 `study_notes.json`，再调用 CLI 生成并验证 Word 文稿包。

## Web 版

运行：

```bash
./script/run_web.sh
```

打开：

```text
http://127.0.0.1:4789
```

Web 版功能：

- 输入 B 站视频链接
- 选择清晰度
- 勾选是否使用 Chrome Cookie
- 勾选是否下载全部分 P / 合集
- 点击“选择文件夹”打开 macOS 原生文件夹选择窗口
- 点击“下载视频”后由本机后端调用 `mac-bilidown/bin/bilidown`

说明：这个 Web 只绑定在 `127.0.0.1`，也就是只给本机访问。它不会把 Cookie 或链接上传到外部服务器。

### 打包 Web 版

生成一个可以直接发给别人的文件夹：

```bash
./script/package_web.sh
```

打包结果：

```text
dist/BilidownWeb
```

把整个 `dist/BilidownWeb` 文件夹发给别人。对方在 Mac 上双击：

```text
启动 Bilidown Web.command
```

即可打开本地 Web 页面。这个文件夹内置 Node.js、`yt-dlp` 和 `ffmpeg`，支持 Apple Silicon 和 Intel Mac。

App 图标资源位于：

```text
Assets/AppIcon.icns
Assets/AppIcon.png
Assets/AppIconDark.icns
Assets/AppIconDark.png
Assets/AppIconTransparent.icns
Assets/AppIconTransparent.png
```

预览：

![Bilidown Mac 图标变体](Assets/AppIconVariants.png)

需要重新生成图标资源时运行：

```bash
./script/generate_app_icons.py
```

## 命令行

首次安装全局命令：

```bash
./script/install_bilidown.sh
source ~/.zshrc
```

之后在任意目录输入即可打开交互式 CLI：

```bash
bilidown
```

菜单中可以选择快速下载、查看视频信息或环境检查。也可以继续使用参数模式：

交互模式会自动清洗粘贴的 B 站长链接，去掉 `?spm_id...`、`vd_source...` 等追踪参数，只保留视频地址本身。

```bash
./mac-bilidown/bin/bilidown doctor
./mac-bilidown/bin/bilidown download "https://www.bilibili.com/video/BV..."
```

默认输出目录：

```text
~/Downloads/Bilidown
```

完整说明见：

- [中文使用说明](./mac-bilidown/使用说明.md)
- [English README](./mac-bilidown/README.md)

核心 CLI 实现位于 [`mac-bilidown`](./mac-bilidown)：

- `bin/bilidown`：命令行入口
- `vendor/darwin-arm64`：Apple Silicon 依赖
- `vendor/darwin-x64`：Intel Mac 依赖
- `scripts/fetch-vendor-deps.zsh`：依赖修复/重拉脚本

## 说明

下载能力基于 `yt-dlp` 的 Bilibili extractor 和内置 macOS `ffmpeg`。
