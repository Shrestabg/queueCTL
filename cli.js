#!/usr/bin/env node
const { program } = require('commander');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const {
  enqueueJob, listByState, status,
  getConfig, setConfig, moveDeadToPending
} = require('./queue');

const CONTROL_DIR = path.join(__dirname, '.control');

program
  .name('queuectl')
  .description('CLI background job queue')
  .version('1.0.0');

// -------------------- ENQUEUE --------------------
program
  .command('enqueue')
  .argument('<command...>', 'Shell command to execute')
  .option('--max-retries <n>', 'Override max retries for this job', (v) => parseInt(v, 10))
  .description('Add a new job to the queue')
  .action(async (cmdArr, opts) => {
    const command = cmdArr.join(' ');
    const job = await enqueueJob(command, opts.maxRetries);
    console.log(`✅ Enqueued job ${job.id}`);
  });

// -------------------- LIST --------------------
program
  .command('list')
  .option('--state <state>', 'Filter by state (pending|processing|completed|failed|dead)', 'pending')
  .description('List jobs by state')
  .action(async (opts) => {
    const rows = await listByState(opts.state);
    console.table(rows.map(r => ({
      id: r.id,
      state: r.state,
      attempts: r.attempts,
      next_run_at: r.next_run_at,
      command: r.command
    })));
  });

// -------------------- STATUS --------------------
program
  .command('status')
  .description('Show summary of job states')
  .action(async () => {
    const s = await status();
    console.log(chalk.blue('Job Status Summary:'));
    console.table(s.counts);
  });

// -------------------- WORKER COMMANDS --------------------
const worker = program.command('worker').description('Manage workers');

// worker start
worker
  .command('start')
  .option('--count <n>', 'Start N workers', (v) => parseInt(v, 10), 1)
  .description('Start one or more workers')
  .action(async (opts) => {
    await fs.ensureDir(CONTROL_DIR);
    const stopFlag = path.join(CONTROL_DIR, 'stop.flag');
    if (await fs.pathExists(stopFlag)) await fs.remove(stopFlag);

    const count = Math.max(1, opts.count | 0);
    console.log(chalk.green(`Starting ${count} worker(s)...`));
    for (let i = 0; i < count; i++) {
      const id = `w-${i + 1}`;
      const child = spawn('node', [path.join(__dirname, 'worker.js'), id], { stdio: 'inherit' });
      child.on('exit', (code) => {
        console.log(chalk.gray(`Worker ${id} exited with code ${code}`));
      });
    }
  });

// worker stop
worker
  .command('stop')
  .description('Stop all running workers gracefully')
  .action(async () => {
    await fs.ensureDir(CONTROL_DIR);
    await fs.writeFile(path.join(CONTROL_DIR, 'stop.flag'), '1');
    console.log(chalk.yellow('Stop signal written. Give workers a few seconds to exit.'));
  });

// -------------------- DLQ COMMANDS --------------------
const dlq = program.command('dlq').description('Dead Letter Queue operations');

dlq
  .command('list')
  .option('--json', 'Output JSON only', false)
  .description('List Dead Letter Queue jobs')
  .action(async (opts) => {
    const data = await fs.readJson(path.join(__dirname, 'jobs.json'));
    if (opts.json) {
      console.log(JSON.stringify(data.dlq, null, 2));
    } else {
      console.table(data.dlq);
    }
  });

dlq
  .command('retry')
  .argument('<id>', 'Job id to retry from DLQ')
  .description('Move a DLQ job back to pending and reset attempts')
  .action(async (id) => {
    const j = await moveDeadToPending(id);
    console.log(`🔁 Job ${j.id} moved back to pending`);
  });

// -------------------- CONFIG COMMANDS --------------------
const config = program.command('config').description('Manage configuration');

config
  .command('get')
  .description('Print current config')
  .action(async () => {
    console.log(await getConfig());
  });

config
  .command('set')
  .argument('<key>', 'max_retries|backoff_base|poll_interval_ms')
  .argument('<value>', 'New value')
  .description('Update configuration')
  .action(async (key, value) => {
    const cfg = await setConfig(key, value);
    console.log('✅ Updated config:', cfg);
  });

// -------------------- PARSE CLI --------------------
program.parse();
