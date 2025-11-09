# 🚀 QueueCTL — Background Job Queue System (CLI-Based)

QueueCTL is a **CLI-based background job queue system** that manages asynchronous jobs using worker processes.  
It supports **parallel execution**, **retries with exponential backoff**, and a **Dead Letter Queue (DLQ)** for failed jobs.  
Built entirely using **Node.js**, this project mimics production-grade queue systems like RabbitMQ or Celery — but via a simple command-line interface.


## 🧠 **Overview**

QueueCTL lets you:
- Enqueue background jobs that execute shell commands.
- Run multiple worker processes to process jobs concurrently.
- Automatically retry failed jobs using exponential backoff.
- Persist all jobs between restarts using JSON storage.
- Handle permanently failed jobs with a **Dead Letter Queue (DLQ)**.
- Configure retries, backoff, and timeout settings from the CLI.


## ⚙️ **Tech Stack**

- **Language:** Node.js (v18+)
- **CLI Framework:** [commander](https://www.npmjs.com/package/commander)
- **Utilities:** [fs-extra](https://www.npmjs.com/package/fs-extra), [uuid](https://www.npmjs.com/package/uuid), [chalk](https://www.npmjs.com/package/chalk)
- **Storage:** JSON-based persistent storage (`jobs.json`, `config.json`)


## 🧩 **Project Structure**


queuectl/

├── cli.js              # Main CLI command entry

├── queue.js            # Job lifecycle management

├── worker.js           # Worker logic for executing jobs

├── config.json         # Configurable parameters

├── jobs.json           # Job + DLQ storage

├── utils/

│   └── lock.js         # File-level locking for concurrency safety

├── scripts/

│   ├── smoke.ps1       # PowerShell test script

│   └── smoke.sh        # Bash test script

└── logs/               # Auto-generated job logs


## 💻 **CLI Commands (All Working and Tested)**

All CLI commands have been implemented and verified successfully.  
Each command can be executed via Node.js:

| **Category** | **Command Example** | **Description** | **Status** |
|---------------|---------------------|-----------------|-------------|
| **Enqueue** | `node cli.js enqueue "echo Hello QueueCTL"` | Adds a new background job to the queue. Automatically assigns an ID and persists it. | ✅ Working |
| **Workers** | `node cli.js worker start --count 3` | Starts one or more workers to process jobs concurrently. | ✅ Working |
|  | `node cli.js worker stop` | Gracefully stops workers after finishing current jobs. | ✅ Working |
| **Status** | `node cli.js status` | Shows a summary of all job states and worker activity. | ✅ Working |
| **List Jobs** | `node cli.js list --state pending` | Lists jobs filtered by state (pending, completed, dead, etc.). | ✅ Working |
| **DLQ (Dead Letter Queue)** | `node cli.js dlq list` | Lists jobs that permanently failed. | ✅ Working |
|  | `node cli.js dlq retry <job_id>` | Moves a DLQ job back to pending for reprocessing. | ✅ Working |
| **Config** | `node cli.js config get` | Displays current configuration (retries, backoff, timeout). | ✅ Working |
|  | `node cli.js config set max_retries 3` | Updates configuration values dynamically. | ✅ Working |



## 🧪 **Demo Instructions**

You can demonstrate the system using **two terminals**:

### 🪟 **Terminal 1 (Worker)**

node cli.js worker start --count 1


### 🪟 **Terminal 2 (Controller)**

node cli.js enqueue "echo Hello QueueCTL"

node cli.js enqueue "not_a_real_command"

node cli.js enqueue "ping 127.0.0.1 -n 20 > nul"


Watch the worker handle:

* ✅ Successful job execution
* 🔁 Retry with exponential backoff
* ☠️ Move failed jobs to DLQ
* ⏰ Timeout handling for long jobs

Then run:

node cli.js status

node cli.js dlq list


## 📸 **Demonstration Screenshot**

Below is an example run showing multiple workers processing jobs concurrently.

![QueueCTL Multi-Worker Demo](assets/demo-screenshot.png)




## 🌟 **Bonus Features Implemented**

| Feature                       | Description                                                                     | Status     |
| ----------------------------- | ------------------------------------------------------------------------------- | ---------- |
| **Job Timeout Handling**      | Automatically stops jobs that exceed the configured timeout (`job_timeout_ms`). | ✅ Done     |
| **Job Output Logging**        | Saves job output or error messages in the `logs/` directory for debugging.      | ✅ Done     |
| **Scheduled/Delayed Jobs**    | Supports re-scheduling jobs internally via `next_run_at`.                       | ⚙️ Partial |
| **Metrics / Execution Stats** | Captures job duration and stores it in job metadata.                            | ⚙️ Partial |
| **Multiple Worker Support**   | Supports concurrent processing (`--count <n>`).                                 | ✅ Done     |


## 🧾 **Evaluation Checklist**

| **Requirement**                            | **Status** |
| ------------------------------------------ | ---------- |
| Working CLI (`queuectl`)                   | ✅          |
| Persistent job storage                     | ✅          |
| Multiple worker support                    | ✅          |
| Retry mechanism with exponential backoff   | ✅          |
| Dead Letter Queue                          | ✅          |
| Configuration management                   | ✅          |
| Clean CLI & documentation                  | ✅          |
| Code structure with separation of concerns | ✅          |
| Testing / smoke script                     | ✅          |
| Bonus Features (timeout + logging)         | ✅          |


## 🎥 **Demo Video**

🎬 Watch the working demonstration here:
👉 [**Google Drive Demo Video Link**](https://drive.google.com/your-demo-link)


## 📘 **Setup Instructions**

# 1️⃣ Clone the repository
git clone https://github.com/Shrestabg/queuectl.git

cd queuectl

# 2️⃣ Install dependencies
npm install

# 3️⃣ Start worker(s)
node cli.js worker start --count 1

# 4️⃣ Enqueue a job
node cli.js enqueue "echo Hello QueueCTL"

## 🧠 **Architecture Overview**

Each job flows through the following states:


pending → processing → completed
          ↘
           failed → retry (exponential backoff) → dead (DLQ)


**Core components:**

* `queue.js`: handles enqueueing, retries, and DLQ.
* `worker.js`: executes jobs and enforces timeouts.
* `utils/lock.js`: prevents duplicate access (file lock).
* `config.json`: stores user configuration.
* `jobs.json`: stores all jobs and their states persistently.


## 👨‍💻 **Author**

**Name:** *BG.Shresta*
**Institution:** Amrita Vishwa Vidyapeetham - blr 
