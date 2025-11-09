const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // using uuid@8
const { withLock } = require('./utils/lock');

const JOBS_FILE = path.join(__dirname, 'jobs.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');

async function loadAll() {
  const [jobs, cfg] = await Promise.all([
    fs.readJson(JOBS_FILE),
    fs.readJson(CONFIG_FILE)
  ]);
  return { jobs, cfg };
}

async function saveJobs(jobs) {
  await fs.writeJson(JOBS_FILE, jobs, { spaces: 2 });
}

async function enqueueJob(command, maxRetries) {
  return withLock(async () => {
    const jobs = await fs.readJson(JOBS_FILE);
    const cfg = await fs.readJson(CONFIG_FILE);
    const job = {
      id: uuidv4(),
      command,
      state: 'pending',
      attempts: 0,
      max_retries: Number.isInteger(maxRetries) ? maxRetries : cfg.max_retries,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      next_run_at: new Date().toISOString()
    };
    jobs.jobs.push(job);
    await saveJobs(jobs);
    return job;
  });
}


async function reserveNextJob(workerId) {
  return withLock(async () => {
    const jobs = await fs.readJson(JOBS_FILE);
    const now = new Date().toISOString();
    const idx = jobs.jobs.findIndex(j => j.state === 'pending' && (!j.next_run_at || j.next_run_at <= now));
    if (idx === -1) return null;

    const job = jobs.jobs[idx];
    job.state = 'processing';
    job.locked_by = workerId;
    job.locked_at = now;
    job.updated_at = now;
    await saveJobs(jobs);
    return job;
  });
}

async function completeJob(id, extra = {}) {
  return withLock(async () => {
    const jobs = await fs.readJson(JOBS_FILE);
    const job = jobs.jobs.find(j => j.id === id);
    if (!job) return;
    Object.assign(job, extra);
    job.state = 'completed';
    job.locked_by = null;
    job.locked_at = null;
    job.updated_at = new Date().toISOString();
    await saveJobs(jobs);
  });
}

async function failOrRetryJob(job, errMsg, cfg) {
  return withLock(async () => {
    const data = await fs.readJson(JOBS_FILE);
    const j = data.jobs.find(x => x.id === job.id);
    if (!j) return;
    j.attempts = (j.attempts || 0) + 1;
    j.last_error = String(errMsg).slice(0, 4000);
    const now = new Date();
    if (j.attempts <= j.max_retries) {
      const delaySec = Math.pow(cfg.backoff_base, j.attempts);
      j.state = 'pending';
      j.next_run_at = new Date(now.getTime() + delaySec * 1000).toISOString();
      j.locked_by = null;
      j.locked_at = null;
    } else {
      j.state = 'dead';
      j.next_run_at = null;
      j.locked_by = null;
      j.locked_at = null;
      // maintain DLQ view as separate array too
      if (!data.dlq.find(d => d.id === j.id)) {
        data.dlq.push({ id: j.id, moved_at: new Date().toISOString(), last_error: j.last_error, command: j.command });
      }
    }
    j.updated_at = new Date().toISOString();
    await saveJobs(data);
    return j.state;
  });
}

async function moveDeadToPending(id) {
  return withLock(async () => {
    const data = await fs.readJson(JOBS_FILE);
    const job = data.jobs.find(j => j.id === id);
    if (!job) throw new Error('Job not found');
    job.state = 'pending';
    job.attempts = 0;
    job.next_run_at = new Date().toISOString();
    job.updated_at = new Date().toISOString();
    data.dlq = data.dlq.filter(d => d.id !== id);
    await saveJobs(data);
    return job;
  });
}

async function listByState(state) {
  const { jobs } = await fs.readJson(JOBS_FILE);
  return jobs.filter(j => j.state === state);
}

async function status() {
  const data = await fs.readJson(JOBS_FILE);
  const counts = {};
  for (const j of data.jobs) counts[j.state] = (counts[j.state] || 0) + 1;
  return { counts, workers: [] }; // workers list can be added later if you track PIDs
}

async function getConfig() {
  return fs.readJson(CONFIG_FILE);
}
async function setConfig(key, value) {
  return withLock(async () => {
    const cfg = await fs.readJson(CONFIG_FILE);
    if (!(key in cfg)) throw new Error(`Unknown config key: ${key}`);
    const num = Number(value);
    cfg[key] = Number.isFinite(num) ? num : value;
    await fs.writeJson(CONFIG_FILE, cfg, { spaces: 2 });
    return cfg;
  });
}

module.exports = {
  enqueueJob,
  reserveNextJob,
  completeJob,
  failOrRetryJob,
  moveDeadToPending,
  listByState,
  status,
  getConfig,
  setConfig
};
