# Overnight runner: restarts Claude Code until the runbook is done or the deadline passes.
# Run from a PowerShell window inside the fresh clone (NOT your normal working copy).

$deadline = Get-Date "2026-10-31 20:00"
$prompt = @"
Follow IMPLEMENT_2.0.0.md exactly. Read PROGRESS.md first (section "Implementation 2.0.0") and continue from the next unfinished step; never redo finished steps.
Hard limits: never push, never edit the OpenAPI spec or any frontend code. Make no design decisions beyond the spec and docs/DECISIONS-2026-10-31.md; write questions to QUESTIONS.md instead. Check the current time with a shell command before starting each task.
"@

New-Item -ItemType Directory -Force logs | Out-Null
# keep logs out of git without touching .gitignore
if (-not (Select-String -Path .git/info/exclude -Pattern '^logs/' -Quiet)) { Add-Content .git/info/exclude 'logs/' }

while ((Get-Date) -lt $deadline) {
    if ((Test-Path PROGRESS.md) -and (Select-String -Path PROGRESS.md -Pattern 'IMPLEMENTATION COMPLETE' -Quiet)) {
        Write-Host "Run complete." ; break
    }

    $stamp = Get-Date -Format 'MMdd-HHmm'
    Write-Host "[$stamp] starting session"
    claude -p $prompt --permission-mode auto --output-format stream-json --verbose *>> "logs/impl-$stamp.log"

    if ($LASTEXITCODE -ne 0) {
        # error or usage limit: wait before retrying
        Write-Host "[$stamp] exited with $LASTEXITCODE, waiting 15 min"
        Start-Sleep -Seconds 900
    } else {
        Start-Sleep -Seconds 30
    }
}
Write-Host "Runner finished at $(Get-Date -Format 'HH:mm')."
