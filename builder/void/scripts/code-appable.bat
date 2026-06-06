@echo off
setlocal EnableDelayedExpansion

title Void + Appable Builder

pushd %~dp0\..

:: Load void/.env.local into this shell (Electron inherits these)
if exist ".env.local" (
  for /f "delims=" %%a in ('node scripts\load-appable-env.cjs --emit-bat 2^>nul') do %%a
  echo [appable] loaded .env.local
) else (
  echo [appable] no .env.local found — running in mock mode
)

:: --reuse-window: don't spawn a second window if one is already open
call scripts\code.bat --reuse-window %*

popd
endlocal
