@echo off
cd /d "%~dp0.."
set NODE_ENV=production
set PORT=3100
set HOSTNAME=127.0.0.1
set DATABASE_URL=postgresql://love_next:love_next_dev_password@localhost:5432/love_next?schema=public
set UPLOAD_DIR=uploads

if not exist ".next\standalone\.next\static" mkdir ".next\standalone\.next\static"
robocopy ".next\static" ".next\standalone\.next\static" /MIR /NFL /NDL /NJH /NJS /NP >nul
if exist "public" robocopy "public" ".next\standalone\public" /MIR /NFL /NDL /NJH /NJS /NP >nul
if exist "uploads" robocopy "uploads" ".next\standalone\uploads" /MIR /NFL /NDL /NJH /NJS /NP >nul

cd /d ".next\standalone"
node server.js
