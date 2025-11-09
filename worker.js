const { exec } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const { reserveNextJob, completeJob, failOrRetryJob, getConfig } = require('./queue');

const CONTROL_DIR = path.join(__dirname, '.control'); 
const LOG_DIR = path.join(__dirname, 'logs'); 

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runWorker(workerId) {
  await fs.ensureDir(CONTROL_DIR);
  await fs.ensureDir(LOG_DIR);
  const stopFlag = path.join(CONTROL_DIR, 'stop.flag');

  console.log(`🧑‍🏭 Worker ${workerId} started`);
  while (true) {
    if (await fs.pathExists(stopFlag)) {
      console.log(`🧑‍🏭 Worker ${workerId} stopping (stop flag detected)`);
      break;
    }

    const cfg = await getConfig();
    const job = await reserveNextJob(workerId);
    if (!job) {
      await sleep(cfg.poll_interval_ms || 1000);
      continue;
    }

    console.log(`🚀 [${workerId}] Processing ${job.id}: ${job.command}`);

    const timeoutMs = cfg.job_timeout_ms || 15000;
    const logFile = path.join(LOG_DIR, `${job.id}.log`);
    const startTime = Date.now();

    await new Promise(res => {
      const proc = exec(job.command, { shell: true }, async (error, stdout, stderr) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

        await fs.writeFile(logFile, (stdout || '') + (stderr || ''), 'utf-8');

        if (!error) {
          await completeJob(job.id, { output: stdout, elapsed_sec: elapsed });
          console.log(`✅ [${workerId}] ${job.id} completed in ${elapsed}s`);
        } else {
          const newState = await failOrRetryJob(job, stderr || error.message, cfg);
          if (newState === 'pending') {
            console.log(`🔁 [${workerId}] ${job.id} failed → will retry (backoff)`);
          } else if (newState === 'dead') {
            console.log(`☠️ [${workerId}] ${job.id} moved to DLQ`);
          }
        }
        res();
      });

      const timer = setTimeout(() => {
        console.log(`⏰ [${workerId}] Job ${job.id} timed out after ${timeoutMs / 1000}s`);
        proc.kill('SIGTERM');
      }, timeoutMs);

      proc.on('exit', () => clearTimeout(timer));
    });
  }
}

if (require.main === module) {
  const workerId = process.argv[2] || `w-${Math.random().toString(16).slice(2,6)}`;
  runWorker(workerId).catch(e => {
    console.error('Worker crashed:', e);
    process.exit(1);
  });
}

module.exports = { runWorker };
