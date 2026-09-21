@echo off
rem Wrapper for Windows Task Scheduler — the quarterly household-plan run.
rem Collects live inputs, runs the engine, diffs against the last accepted run,
rem writes plan/runs/<date>/, notifies. Logs to plan-run.log in the project root.
rem Registered by scripts/register-plan-check-task.ps1 (1 Jan / 1 Apr / 1 Jul / 1 Oct 07:30).
setlocal
cd /d "%~dp0.."
echo. >> plan-run.log
echo ==== %DATE% %TIME% ==== >> plan-run.log
call npm run plan:run >> plan-run.log 2>&1
