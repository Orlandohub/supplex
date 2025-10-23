@echo off
REM Supplex Development Server Launcher for Command Prompt
echo Starting Supplex Development Servers...

REM Refresh environment variables
call refreshenv 2>nul

REM Start development servers
pnpm dev

