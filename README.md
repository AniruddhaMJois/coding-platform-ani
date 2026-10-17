# coding-platform

## About this project

coding-platform is an immersive, assessment-first coding environment built for learning, interviews, and secure timed evaluations. It blends a friendly editor experience with strict integrity controls so instructors and contest hosts can focus on evaluating skill — not chasing down accidental shortcuts.

Key ideas:
- Immersive assessments: during exam or contest mode the UI is intentionally locked down — copying and pasting is restricted, right-click/context menus and developer tools are disabled, and focus is maintained to discourage tab-switching and external lookups.
- Fairness by design: the platform records audit logs and enforces resource limits and per-job isolation so every submission runs in the same, reproducible environment.
- Fast feedback: testcases run inside lightweight language sandboxes and return rich structured results . so learners see useful, actionable feedback immediately.
- Multi-language and function-first: supports Python, Java, Node.js, C and C++ and includes helpers to accept function-only submissions and wrap them safely for execution.

This project aims to be practical for instructors and delightful for learners — combining robust sandboxing with a clean, distraction-minimizing UX.

## Quick start (local development)

1) Build judge images (from project root):

```powershell
docker build -t coding-judge-python judge/images/python
docker build -t coding-judge-java   judge/images/java
docker build -t coding-judge-node   judge/images/node
docker build -t coding-judge-c      judge/images/c
docker build -t coding-judge-cpp    judge/images/cpp
```

2) Start the backend (from project root):

```powershell
node server.js
```

3) Start the frontend (in a separate shell):

```powershell
cd coding-platform
npm install
npm start
```


## Running the backend tests

The `/execute` API is covered by Jest + Supertest tests in `server/tests/execute.test.js`. Docker is mocked, so you do not need Docker or the judge images to run them.

```bash
cd server
npm install
npm test
```

The suite covers passing and failing submissions, compile errors, runtime errors, an empty body, missing or malformed fields, unsupported languages and Docker being unavailable.

## Developer notes

- Frontend now calls the Docker-backed `/execute` endpoint and shows `compileError`, `stderr`, and non-zero exit statuses prominently.
- `REACT_APP_API_BASE_URL` is used for configuring the API base URL in different environments.

## Tech stack

- Backend: Node.js (Express)
- Frontend: React (Vite) and CodeMirror for the editor
- Sandboxing: Docker judge images (GCC for C/C++, Temurin JDK for Java, Python 3, Node.js)





