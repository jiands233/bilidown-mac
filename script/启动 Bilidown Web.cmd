@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
pushd "%~dp0"
if errorlevel 1 goto directory_error
if not exist "runtime\win32-x64\node.exe" goto missing_runtime
echo Bilidown Web 正在启动，请保持此窗口打开。
echo 关闭服务请按 Ctrl+C。
"runtime\win32-x64\node.exe" "web-bilidown\server.js" --open
set "BILIDOWN_EXIT=%ERRORLEVEL%"
if not "%BILIDOWN_EXIT%"=="0" pause
popd
exit /b %BILIDOWN_EXIT%
:missing_runtime
echo 找不到内置 Node.js，请完整解压 ZIP 后再运行，不要只复制启动文件。
pause
popd
exit /b 1
:directory_error
echo 无法进入程序目录，请将整个文件夹解压到本地可访问的位置。
pause
exit /b 1
