@echo off
title TTMK TMS Platform Dev Server
cd /d "%~dp0"
echo ================================================================
echo  Starting TTMK TMS Platform Development Server...
echo ================================================================
node server.js
pause
