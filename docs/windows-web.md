# Bilidown Web：Windows 便携版

适用于 Windows 10/11 x64。无需安装 Node.js、Python 或 FFmpeg；下载视频时需要联网。

## 启动和停止

1. 将 `BilidownWeb-Windows-x64.zip` 完整解压到本地目录，不能直接在 ZIP 预览中运行。
2. 双击 `启动 Bilidown Web.cmd`。服务启动成功后会自动打开默认浏览器。
3. 在页面中输入视频链接，选择画质、合集或全部分 P、保存目录，然后开始下载。

默认地址为 `http://127.0.0.1:4789`，仅供本机访问。终端窗口需要保持打开；关闭服务时回到终端按 `Ctrl+C`。若 Windows 询问是否终止批处理，输入 `Y`。

默认保存到当前用户的下载目录下。可以手动填写路径，或点击页面上的目录选择按钮；支持中文、空格和盘符路径。取消文件或目录对话框会保留原设置。

端口被占用时，在程序目录打开命令提示符，换一个端口启动：

```bat
set PORT=4790
call "启动 Bilidown Web.cmd"
```

启动失败会在终端显示原因并等待按键；端口冲突不会自动打开占用该端口的其他服务。

## 登录与 Cookie

默认“不使用 Cookie”。公开视频可以先按此方式尝试，受登录或清晰度限制的内容可选择以下方式：

- **Chrome 自动读取**：读取本机 Chrome 的登录信息。新版 Chrome 的加密和文件占用可能导致读取失败；关闭 Chrome 后可重试，仍失败则使用文件模式。
- **cookies.txt 文件**：选择本机 Netscape 格式的 Cookie 文件，或手动填写完整文件路径。文件首行通常为 `# Netscape HTTP Cookie File`。JSON、复制的 HTTP Cookie 请求头不适用。

Cookie 文件内容不会上传给本地 Web 页面，只把本机路径交给下载工具。yt-dlp 会在访问目标网站时使用对应 Cookie。读取失败会明确报错，不会自动改成无登录下载。Cookie 含登录凭据，请妥善保管，不要放进分享给别人的便携包。

## 常见问题

- **依赖缺失或无法启动**：点击“检查环境”，确认整个 ZIP 已解压、`runtime` 和 `vendor` 目录没有被删除；如安全软件提示风险，应核实文件来源和哈希。
- **目录不可写**：选择当前用户可写的目录，检查磁盘剩余空间及文件占用。
- **网络或下载失败**：检查链接和网络，确认浏览器中可以访问视频；需要登录的内容使用 Cookie。内置 yt-dlp 版本固定，网站接口变化时需要更新程序包。
- **未自动打开浏览器**：查看终端实际监听地址，在浏览器手动打开；终端已报错时先解决该错误。
- **Windows 提示不支持此应用**：本包只支持 x64，未提供 Windows ARM64 或 32 位包。

## 包内容与第三方来源

- `web-bilidown/`：页面及本地服务；`Assets/`：应用图标。
- `runtime/win32-x64/node.exe`：Node.js 24.21.0 LTS。
- `vendor/win32-x64/`：yt-dlp 2026.08.19、FFmpeg / ffprobe 9.0.1。
- `licenses/`：上游许可、FFmpeg 构建说明及 `sources.json` 固定版本下载来源、源码链接、SHA-256 与校验来源。
- `SHA256SUMS.txt`：包内各文件的 SHA-256。

FFmpeg 来自 [Gyan essentials 构建](https://www.gyan.dev/ffmpeg/builds/)，按随包许可发布；对应 [FFmpeg 9.0.1 源码](https://ffmpeg.org/releases/ffmpeg-9.0.1.tar.xz) 与构建来源见 `licenses/sources.json` 和 `FFmpeg-readme.txt`。Node.js 及 yt-dlp 的第三方许可随包提供。

## 从源码打包（开发者）

在 macOS 或 Windows 安装 Python 3.9+，于仓库根目录运行：

```sh
python3 script/package_web_windows.py
```

首次下载并校验固定依赖，后续复用 `.cache/windows-web/`，每次仍校验 SHA-256。下载失败不生成新包；缓存校验失败会报错，确认后删除对应缓存文件再重试。可以用 `--download-only` 仅准备依赖，或 `--verify dist/BilidownWeb-Windows-x64.zip` 校验产物。Windows 上如没有 `python3` 命令，使用 `py -3`。

输出为 `dist/BilidownWeb-Windows-x64.zip`。打包脚本仅使用 Python 标准库，按明确的 Web 文件类型复制，排除测试、Mac CLI 和其他项目。打包校验包含 ZIP CRC、文件清单、逐文件哈希及 Windows 可执行文件头；这些检查不能替代 Windows 实机运行验收。
