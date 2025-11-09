# Run: powershell -ExecutionPolicy Bypass -File .\scripts\smoke.ps1
# for windows
node cli.js config set max_retries 2
node cli.js config set backoff_base 2

node cli.js enqueue "echo OK"
node cli.js enqueue "not_a_command"

# start 2 workers
start-process node -ArgumentList "cli.js","worker","start","--count","2"

Start-Sleep -Seconds 8
node cli.js status
node cli.js list --state completed
node cli.js list --state dead
node cli.js dlq list

# retry first dead job if exists
$dead = node cli.js dlq list --json | ConvertFrom-Json
if ($dead.Count -gt 0) {
  node cli.js dlq retry $($dead[0].id)
  Start-Sleep -Seconds 5
  node cli.js status
}

# stop workers
node cli.js worker stop
