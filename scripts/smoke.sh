#!/usr/bin/env bash
# for linux/OS

set -e
node cli.js config set max_retries 2
node cli.js config set backoff_base 2

node cli.js enqueue "echo OK"
node cli.js enqueue "not_a_command"

node cli.js worker start --count 2 >/dev/null 2>&1 &

sleep 8
node cli.js status
node cli.js list --state completed
node cli.js list --state dead
DLQ=$(node cli.js dlq list --json)
FIRST_ID=$(echo "$DLQ" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{let j=JSON.parse(s);console.log((j[0]||{}).id||'')}})")
if [ -n "$FIRST_ID" ]; then
  node cli.js dlq retry "$FIRST_ID"
  sleep 5
  node cli.js status
fi

node cli.js worker stop
