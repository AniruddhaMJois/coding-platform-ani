# CodeJudge — Next-Generation Assessment Platform

An immersive, assessment-first coding evaluation and contest platform built with **Next.js 14 (App Router)**, **Monaco Editor**, **Prisma ORM**, and **Supabase (PostgreSQL)**, featuring decoupled cloud sandboxed execution and real-time proctoring.

---

## 🏛️ Architecture: Why the Previous Architecture Failed

The legacy implementation used a two-tier architecture consisting of a Create React App (CRA) frontend on port 3000 and an Express backend on port 3001 that spawned local Docker containers via `docker run`.

### Why the Legacy Architecture Failed:

1. **Host-Dependent Local Docker Requirement**:
   * The backend required Docker Desktop to be actively running on the host machine. If Docker was not installed or the daemon was inactive, the backend crashed immediately with:
     ```
     Error: spawn docker ENOENT
     ```
   * It required manual compilation of 5 distinct language images (`docker build -t coding-judge-python judge/images/python`, etc.), creating massive friction for setup and maintenance.

2. **Physically Incompatible with Vercel and Serverless Hosting**:
   * **Vercel executes code inside ephemeral serverless micro-functions (AWS Lambda / Firecracker micro-VMs)**.
   * Serverless runtimes are strictly sandboxed: **no background Docker daemon (`dockerd`)**, **no root access**, **no access to `/var/run/docker.sock`**, and nested virtualization (Docker-in-Docker) is completely prohibited.
   * Vercel serverless functions have a 10–15s execution timeout and a read-only filesystem (except a 512MB `/tmp`). Pulling or building multi-gigabyte Docker images inside a serverless lambda is fundamentally impossible.
   * As a result, the old architecture **could never be deployed to Vercel on any plan (Free or Paid)**.

3. **Single-Host Resource Saturation**:
   * Running `docker run` directly on the host server meant every participant submission consumed host CPU cores and memory. Under concurrent assessment conditions, multiple submissions saturated the server, causing timeouts and host crashes.

4. **Cross-Platform CRLF / Line-Ending Failures**:
   * On Windows machines, Git auto-converted line endings to CRLF, breaking the internal Linux bash execution scripts inside containers (`/bin/sh: 1: /usr/local/bin/compile: not found`).

5. **Security & State Leaks**:
   * The old architecture lacked persistent database user isolation and server-side test case masking. Test cases were often returned unmasked to the frontend, allowing participants to inspect hidden test inputs in browser developer tools.

---

## 🚀 The Modern Architecture

To solve these limitations, the platform was re-architected into a **unified, serverless-ready Next.js full-stack system**:

```
[ Participant / Admin Browser ]
              │
              ▼ (HTTPS)
┌─────────────────────────────────────────────────────────────┐
│          Next.js 14 Full-Stack Layer (Vercel)               │
│                                                             │
│  ├── Edge Middleware (src/middleware.js)                    │
│  │   └── Blocks unauthenticated access to all features      │
│  ├── Pages (App Router: /login, /problems, /admin)          │
│  │   └── Dynamic UI visibility based on user session        │
│  └── Serverless API Handlers (/api/run, /api/submit)        │
│      ├── Authenticates session cookies                      │
│      ├── Queries Supabase via Prisma ORM                    │
│      └── Sanitizes & masks hidden evaluation cases          │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
     (Outbound HTTPS JSON)            (Connection Pooler)
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│ Cloud Execution Sandbox      │ │ Supabase Cloud Database    │
│ (Judge0 CE / Remote Cluster) │ │ (PostgreSQL + Prisma)      │
│                              │ │                            │
│ • Containerized Compilers    │ │ • Isolated User Drafts     │
│ • Python, C, C++, Java, JS   │ │ • Hidden & Public Tests    │
│ • Zero host dependencies     │ │ • Submission Audit History │
│ • 100% OS & Vercel-ready     │ │ • User Credentials & Roles │
└──────────────────────────────┘ └────────────────────────────┘
```

### Key Architectural Pillars:

1. **Decoupled Cloud Sandbox Execution (Judge0 CE)**:
   * Execution is offloaded to containerized cloud sandboxes over secure REST APIs.
   * **Zero Host Dependencies**: Requires **no Docker**, **no local compilers**, and works uniformly across Windows, macOS, Linux, and Vercel Serverless Functions.
   * Automatic native compiler fallback is preserved for offline development.

2. **Persistent Cloud Database (Supabase + Prisma)**:
   * **User-Scoped Code Drafts**: Uniquely indexed by `(problemId, userId, language)` with a 64KB safety limit and deduplicated writes (`upsert`) to prevent database bloat.
   * **User Isolation**: Participant 1 and Participant 2 maintain separate drafts and submission histories with zero data bleed.

3. **Strict Hidden Test Case Protection**:
   * **Database Level**: Public problem APIs strictly query `where: { isHidden: false }`. Hidden evaluation cases never appear in the client network payload.
   * **Execution Level**: During "Submit", hidden cases are executed server-side.
   * **Exfiltration Defense**: All outputs (`input`, `expected`, `stdout`) for hidden test cases are strictly sanitized to `null` before sending responses back to the browser. Malicious attempts to dump inputs via `print(sys.stdin.read())` are completely neutralized.

4. **Global Edge Authentication Middleware (`src/middleware.js`)**:
   * All platform features (Contests, Problems, Editor, Submissions, Admin CMS) are **completely locked behind authentication**.
   * Unauthenticated visitors are immediately redirected (`307`) to `/login`.
   * Unauthenticated API calls return `401 Unauthorized`.
   * Non-admin participants attempting to access `/admin` or `/api/admin/*` are blocked with `403 Forbidden`.

5. **Comprehensive Proctoring & Anti-Cheat**:
   * **Zero Pre-existing Code**: Editor opens completely empty (`''`) unless an explicit saved draft exists.
   * **Copy & Paste Strictly Blocked**: Context menus disabled, clipboard events (`paste`, `copy`, `cut`) intercepted, keyboard shortcuts (`Ctrl+C`, `Ctrl+V`, `Cmd+C`, `Cmd+V`, `Ctrl+X`) blocked with live warning toasts.
   * **3-Strike Tab Switch Detection**: Document visibility loss triggers persistent violation warnings. The 3rd strike locks the editor and auto-submits the assessment.
   * **Active Session Countdown Timer**: Counts down exclusively while the participant is engaged in the problem editor (never depletes in the background).
   * **One-Time Problem Solving Lock**: Once a problem is evaluated as `Accepted` (100% score), it is permanently locked for that participant (`Solved ✓`), preventing re-attempts while other participants maintain an isolated fresh state.
   * **Unified Submissions & In-Progress Drafts (`/submissions`)**: Displays evaluated submissions alongside active in-progress drafts, complete with status tags (`Accepted`, `In-Progress Draft`, `Wrong Answer`, `Time Limit Exceeded`), a modal code inspector, and direct `Continue Solving →` buttons.

---

## 📚 Seeded Problems (Simple & Accessible)

The platform is pre-seeded with beginner-friendly arithmetic and logic challenges:

| Problem | Slug | Description | Function / Standard I/O |
| :--- | :--- | :--- | :--- |
| **Add Two Numbers** | `add-two-numbers` | Given integers $a$ and $b$, return $a + b$ | `add(a, b)` or `a + b` |
| **Multiply Two Numbers** | `multiply-two-numbers` | Given integers $a$ and $b$, return $a \times b$ | `multiply(a, b)` or `a * b` |
| **Even or Odd** | `even-or-odd` | Return `"Even"` or `"Odd"` for integer $n$ | `evenOrOdd(n)` or logic |
| **Maximum of Two Numbers** | `maximum-of-two-numbers` | Return the larger of $a$ and $b$ | `findMax(a, b)` or `max(a, b)` |
| **Square of a Number** | `square-of-number` | Return $n^2$ | `square(n)` or `n * n` |

---

## 🔑 Default Accounts & Credentials

The platform is pre-seeded with dedicated assessment roles in Supabase:

| Account | Username | Password | Role | Redirect Target | Permissions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Participant 1** | `1` | `1` | `participant` | `/problems` | Write code, save drafts, run & submit |
| **Participant 2** | `2` | `2` | `participant` | `/problems` | Separate isolated drafts & submissions |
| **Administrator** | `osl-vvce` | `OSL` | `admin` | `/admin` | Manage problems, test cases, and CMS |

> **Quick Login:** The `/login` page includes 1-click credential cards to instantly autofill and sign in as any of the three users.

---

## 💻 Quick Start (Local Development)

### Prerequisites:
* **Node.js** v18+ (tested with v20 and v24)
* **npm** v9+
* **Git**
* *(No Docker or local compilers required!)*

### 1. Clone the Repository
```bash
git clone https://github.com/AniruddhaMJois/coding-platform-ani.git
cd coding-platform-ani
git checkout ANI
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the project root:
```env
DATABASE_URL="postgresql://postgres.[YOUR_PROJECT]:[YOUR_PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[YOUR_PROJECT]:[YOUR_PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
```

### 4. Push Database Schema & Generate Prisma Client
```bash
npx prisma generate
npx prisma db push
```

### 5. Run the Application
* **Development mode:**
  ```bash
  npm run dev
  ```
* **Production mode:**
  ```bash
  npm run build
  npm start
  ```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Deployment to Vercel

1. Push your changes to GitHub on branch `ANI`.
2. Go to [Vercel](https://vercel.com) and import the repository `coding-platform-ani`.
3. In **Project Settings &rarr; Environment Variables**, add:
   * `DATABASE_URL`: Your Supabase transaction pooler connection string (port `6543`).
   * `DIRECT_URL`: Your Supabase direct connection string (port `5432`).
4. Click **Deploy**. Vercel will build the Next.js app and deploy serverless functions automatically.

---

## 📁 Project Structure

```
coding-platform-ani/
├── prisma/
│   └── schema.prisma              # Database models (User, Problem, TestCase, Submission, CodeDraft)
├── src/
│   ├── middleware.js              # Edge-level authentication & role routing guard
│   ├── lib/
│   │   ├── prisma.js              # Prisma Client singleton
│   │   ├── executor.js            # Two-tier execution (Judge0 cloud sandbox + native fallback)
│   │   └── realtime.js            # SSE and BroadcastChannel event dispatcher
│   └── app/
│       ├── layout.js              # Root layout with dynamic user badges and Logout button
│       ├── login/                 # Assessment login portal with quick-login cards
│       ├── problems/              # Problem catalog and practice environment
│       │   └── [slug]/            # Monaco editor, anti-cheat, persistent drafts, timer
│       ├── admin/                 # Instructor CMS with live test case management
│       ├── contests/              # Contests overview page
│       ├── submissions/           # User-scoped submission history
│       └── api/
│           ├── auth/              # Login, logout, session verification
│           ├── problems/          # Public problem catalog (hidden cases excluded)
│           ├── admin/             # Instructor problem and test case endpoints (role protected)
│           ├── drafts/            # User-isolated 64KB draft saving
│           ├── run/               # Sample case testing via cloud sandbox
│           ├── submit/            # Full test suite evaluation with masked outputs
│           └── submissions/       # Submission logs filtered by user
└── README.md
```

---

## 🛡️ Summary of Platform Safeguards

| Feature | Protection Mechanism |
| :--- | :--- |
| **Authentication Wall** | All features and API endpoints require login; unauthenticated traffic redirected to `/login`. |
| **Hidden Test Cases** | Masked at SQL query level; outputs (`input`, `expected`, `stdout`) sanitized to `null` on submit. |
| **Copy & Paste** | Context menu disabled; clipboard events and keyboard shortcuts blocked with warning toasts. |
| **Tab Switching** | Document visibility tracked with 3 strikes in sessionStorage; auto-submits on strike 3. |
| **Timer Integrity** | End timestamp stored in browser storage; surviving reloads and browser restarts. |
| **Database Bloat** | 64KB code draft cap with unique `(problemId, userId, language)` upsert deduplication. |
| **Cloud Compatibility** | Zero Docker dependency; runs natively on Vercel Serverless Functions. |
