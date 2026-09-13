# Windows Web 版验证记录

验证环境：macOS / Node.js v24.15.0，2026-09-13。未在 Windows 系统上运行可执行文件。

## 已通过

- `node --test web-bilidown/test/*.test.js`：29 项测试通过。
- `python3 -m unittest discover -s script -p 'test_package_web_windows.py'`：3 项测试通过。
- 覆盖 HTTP 请求到 Windows 进程参数、四种画质、合集、中文/空格/特殊字符路径、Cookie 模式及旧接口兼容、缺失依赖、目录不可写、Cookie 解密警告、普通登录失败、取消选择、端口冲突不打开浏览器。
- Windows 平台使用模拟后端进行浏览器检查：默认不使用 Cookie、切换文件模式、空路径提示、取消保留输入、下载结果文件路径展示；这不代表真实 Windows 下载成功。
- Mac 页面显示原有 Chrome Cookie 开关与本机默认目录；通过真实 CLI 和 HTTP 环境检查，下载命令参数回归测试通过。
- 便携包构建：固定上游版本与 SHA-256；校验 ZIP CRC、所需文件、包内文件哈希和 Windows EXE 文件头。打包文件不包含 Mac CLI、测试或其他本地项目。
- 独立代码审查及 Cookie 边界问题修复后的复查通过。

## 外部服务限制

通过真实 Mac Web 后端，以不读取 Cookie 的模式请求公开视频 `BV1xx411c7mD`；B 站元数据接口返回 HTTP 412，后端按下载失败返回退出码 30。没有获得成功下载或音视频合并的实测证据。未改动既有 Mac 下载工具版本。

## 待 Windows 实机验收

- [ ] Windows 10/11 x64，无预装 Node.js/Python/FFmpeg，解压到含中文与空格的路径后双击启动。
- [ ] 自动打开默认浏览器；端口占用时不打开其他服务，设置 `PORT` 后可启动；Ctrl+C 停止。
- [ ] 原生目录与 Cookie 文件选择窗口可以打开，取消后保留路径。
- [ ] 公开单视频下载、最佳/1080p/720p、MP4 音视频合并、仅音频 M4A、全部分 P / 合集。
- [ ] 有效 Chrome Cookie、Chrome 解密失败、有效 Netscape Cookie 文件及失效登录的行为。
- [ ] 中文文件名、特殊字符目录、不可写目录、缺失依赖及中途网络错误。

测试命令可在仓库根目录重新运行；Windows 功能验收说明见 `docs/windows-web.md`。
