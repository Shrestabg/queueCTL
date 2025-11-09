const fs = require("fs");
const path = require("path");

const LOCKFILE = path.join(__dirname, "..", ".queue.lock");


async function withLock(fn, retryMs = 200, maxRetries = 25) {
  let retries = 0;

  while (true) {
    try {
      // If lock file already exists, check if it's stale (>15s old)
      if (fs.existsSync(LOCKFILE)) {
        const stat = fs.statSync(LOCKFILE);
        const age = Date.now() - stat.mtimeMs;
        if (age > 15000) {
          console.warn("⚠️ Removing stale lock file");
          fs.unlinkSync(LOCKFILE);
        } else {
          throw new Error("locked");
        }
      }

      fs.writeFileSync(LOCKFILE, String(Date.now()));

      const result = await fn();

      try {
        if (fs.existsSync(LOCKFILE)) fs.unlinkSync(LOCKFILE);
      }
      catch (err) {
        if (err.code !== 'ENOENT') console.warn('⚠️ Failed to delete lock file:', err.message);
      }

      return result;
    } 
    catch (e) {
      if (e.message === "locked") {
        retries++;
        if (retries > maxRetries) {
          throw new Error("❌ Could not acquire lock after multiple attempts. Try again later.");
        }
        await new Promise((r) => setTimeout(r, retryMs));
      } else if (e.code === "EEXIST") {
        // fallback for rare race conditions
        await new Promise((r) => setTimeout(r, retryMs));
      } else {
        throw e;
      }
    }
  }
}

module.exports = { withLock };
