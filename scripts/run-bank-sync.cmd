@echo off
rem Wrapper for Windows Task Scheduler — runs the local TrueLayer sync and logs
rem output to bank-sync.log in the project root. Scheduled weekly + 1st of month.
setlocal
cd /d "%~dp0.."
echo. >> bank-sync.log
echo ==== %DATE% %TIME% ==== >> bank-sync.log
call npm run sync:bank >> bank-sync.log 2>&1
