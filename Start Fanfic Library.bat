@echo off
title Fanfic Library
cd /d "%~dp0"
start "" http://localhost:4321
node server.js
pause
