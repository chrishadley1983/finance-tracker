# Registers the quarterly household-plan run in Windows Task Scheduler.
#   powershell -ExecutionPolicy Bypass -File scripts\register-plan-check-task.ps1
# Runs scripts\run-plan-check.cmd at 07:30 on the 1st of January, April, July and October,
# as the current user (interactive logon, like the FinanceTracker-BankSync tasks).
# Re-running replaces the task. Remove with: schtasks /Delete /TN FinanceTracker-PlanRun-Quarterly /F
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$cmd = Join-Path $root 'scripts\run-plan-check.cmd'
$name = 'FinanceTracker-PlanRun-Quarterly'
& schtasks.exe /Create /F /TN $name /SC MONTHLY /M JAN,APR,JUL,OCT /D 1 /ST 07:30 /TR "cmd.exe /c `"$cmd`"" | Out-Host
& schtasks.exe /Query /TN $name /FO LIST /V | Select-String 'TaskName|Next Run Time|Schedule Type|Months|Days|Start Time|Task To Run' | Out-Host
