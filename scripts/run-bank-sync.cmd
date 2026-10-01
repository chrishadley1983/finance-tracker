@echo off
rem Wrapper for Windows Task Scheduler — runs the local TrueLayer sync and logs
rem output to bank-sync.log in the project root. Scheduled weekly + 1st of month.
setlocal
cd /d "%~dp0.."
echo. >> bank-sync.log
echo ==== %DATE% %TIME% ==== >> bank-sync.log
call npm run sync:bank >> bank-sync.log 2>&1
rem Business Stock: on the 1st only, value the Hadley Bricks inventory and save the month's snapshot
rem (listed at list less fees, other stock at cost, BrickLink parts at a share of list; rules in plan/assumptions.json).
echo. >> plan-check.log
echo ==== %DATE% %TIME% stock ==== >> plan-check.log
call npm run plan:stock-value -- --save --if-first >> plan-check.log 2>&1
rem Household plan: cheap live health check after every sync (assumptions vs the fresh
rem snapshots, run-rate and payslip age; dead-man on the last accepted run). Notifies on RED.
echo. >> plan-check.log
echo ==== %DATE% %TIME% ==== >> plan-check.log
call npm run plan:check -- --live --notify >> plan-check.log 2>&1
