# How I used AI to build this prototype

> **Draft for my review.** An AI agent wrote this walkthrough from its own working log during the build. Everything below happened as described. I've left a few `[ADD]` notes where only I can add my own review notes before I submit.

## TL;DR

* **Tooling:** I used **Grok Bot**, an AI assistant with a coding agent that has its own Linux sandbox (shell, Node 24, a headless Chrome). It wrote the code, ran it, tested it and took the screenshots. My role was product owner and reviewer: I set the goal and constraints, and I decided what "done" means.
* **Time:** about 25 minutes of agent wall-clock time on 11 Nov 2026 (roughly 2:15–2:35 PM IST), from an empty folder to tested code, Docker files, docs and screenshots.
* **Where AI paid off:** scaffolding a layered Express + React/TS project, writing the SQL schema and seed data, and producing a broad test suite quickly. In particular, it drove a real two-browser check of the WebSocket flow.
* **Where it went wrong:** 9 real issues, listed below. Most were caught by running the app, reading output carefully, or deliberately breaking the code to check that the tests would notice. None were caught by the generated code "looking right".

## 1. The brief

The job posting asks for a working React + Node prototype and a write-up of the AI-assisted process. It doesn't give a problem statement, so I picked one that fits AbhiBus's core business: **bus search + seat selection with live seat locking**. It shows off what the role lists: React hooks, state and performance, Node REST, JWT, a SQL database, real-time over WebSockets, low-level design around concurrency, and testing.

My own instruction to the assistant was short: *"Write it for me."* The assistant then turned the posting into a concrete spec, and I'm including it because getting the spec right was the most valuable prompt in the process. Paraphrased:

> Build a bus search + seat booking app. **Frontend:** React + TypeScript (Vite): search from/to/date, results (operator, times, fare, amenities), a sleeper/seater seat-layout picker, live seat-hold status, simple login. **Backend:** Node + Express + TypeScript REST API: search, trip details, hold seats (temporary lock, TTL ~5 min), confirm, cancel. JWT auth. Real-time seat availability over WebSockets so two browser tabs see holds and bookings instantly. **Concurrent holds must be atomic (no double booking).** **Data:** zero-setup store (SQLite or in-memory Mongo) seeded with realistic Indian routes, layered routes/controllers/services/repositories. **Tests:** backend tests for holds and bookings including a concurrency test, plus a few frontend component tests. Make them pass. One-command run, Dockerfile, README with an architecture diagram, API docs and trade-offs. **Actually run it and verify.** Keep a truthful running log; do not invent incidents.

The last two sentences shaped everything that followed. "Actually run it and verify" is the reason most of the bugs below were found.

## 2. Plan the agent proposed (and I accepted)

1. npm workspaces (`server/`, `client/`) so `npm install && npm run dev` works from the root.
2. SQLite via better-sqlite3 rather than an in-memory Mongo. Real transactions and constraints make "no double booking" provable at the storage layer, not just in application code.
3. Locking model: a `seat_holds` table with `PRIMARY KEY (trip_id, seat_no)`, all-or-nothing holds in one transaction, and a partial unique index on active booked seats as a second line of defence.
4. A domain event bus between the services and Socket.IO, so the realtime transport can later change (Redis or Kafka) without touching business logic.
5. An injectable clock in the composition root, so the TTL tests don't need to sleep.

## 3. How the build actually went

| Step | What the AI did | How it was checked |
|---|---|---|
| Env check | Found Node 24, npm 11, **no Docker**, and Chrome available | Shell output |
| Server | Wrote schema, seed, 4 repositories, 4 services, controllers, routes, zod schemas and the Socket.IO adapter in one pass | `tsc` was clean the first time. A manual curl run (login → hold → confirm) worked, **but exposed a bug (#2)** |
| Server tests | 14 tests, **all green on the first run** | An all-green first run proves little, so the agent mutated the code and **found an untested path (#3)** |
| Concurrency | 30 parallel HTTP holds, overlapping multi-seat holds, and 8 worker threads with separate DB connections | Mutations: removing the PK → 7 failures. DEFERRED instead of IMMEDIATE → the multi-thread test fails (#4) |
| Client | Hook-based React app plus 12 tests | `tsc -b` + `vite build`, plus mutation of the two concurrency guards in the main hook |
| End-to-end | Headless Chrome, **two separate browser sessions on the same bus** | Tab B saw tab A's seats turn Held, then Booked, with no reload and zero console errors. **Reviewing the screenshots found #7 and #8** |
| Packaging | Production build, Docker files, curl smoke script, fresh-copy install | Dockerfile steps run by hand in a clean folder (no Docker daemon), plus `npm install && npm run dev && npm test` from a fresh copy |

Final state: **24 server tests + 13 client tests passing**, typecheck clean in both workspaces (test files included), and the production build serving the SPA and API on one port.

## 4. Where the AI went wrong, and how each issue was caught

1. **It nearly "approved" a native build it didn't need.** npm 11 now blocks dependency install scripts by default and warned about better-sqlite3 and esbuild. The obvious move was to approve both. Before doing that, the agent looked inside `node_modules` and found that better-sqlite3 v13 ships **prebuilt binaries** (`gypfile: false`). Approving the script would have *forced* a `node-gyp` compile, which fails on machines without build tools. It denied that one and approved only esbuild. *Caught by:* checking the package contents instead of trusting the warning.

2. **Search listed buses that had already left.** It was searching "today" at about 2:20 PM, and the results still included the 06:00 and 13:30 departures. The hold endpoint already refused departed trips, but search didn't filter them. *Caught by:* reading a manual curl response. *Fix:* filter `departure > now`, plus a regression test that I confirmed fails without the fix.

3. **A green test suite with a hole in it.** All 14 first-run tests passed. As a check, the agent deleted the line that clears *expired* holds during a new hold attempt, and **every test still passed**. The TTL test called the background sweeper before re-holding, so the "expired, but the sweeper hasn't run yet" path was never exercised. In production that bug would make a seat look "taken" for up to 5 seconds after its hold expired. *Fix:* a dedicated lazy-expiry test, which now fails under that mutation.

4. **The transaction mode really matters, and this proved it.** With better-sqlite3's default `DEFERRED` transactions, the multi-connection race test failed 3 out of 3 times. The losing threads got a raw SQLite busy error instead of a clean `409 SEAT_UNAVAILABLE`. `BEGIN IMMEDIATE` fixes it. This is now documented in the README and enforced by the test.

5. **A dependency install "succeeded" but saved nothing.** `npm i react react-dom socket.io-client`, run inside `client/`, printed success, but the packages never reached `client/package.json`. Only the dev-dependency install that followed was recorded. *Caught by:* reading the manifest back before writing any code. *Fix:* re-ran it as a workspace install from the root. *Lesson:* check the file, not the CLI message.

6. **A stale-state bug in the main React hook, caught in self-review before it ever ran.** The first draft computed the next seat selection from the last *server-confirmed* hold. Two quick clicks before the first response returned would both start from the same stale hold, so the second click would silently drop the first seat. *Fix:* an optimistic selection ref, updated synchronously, plus a request sequence number so a slow, out-of-date response can't overwrite a newer one. Both guards have a test, and each test fails if its guard is removed.

7. **It booked a ladies-only berth for a male passenger.** The seed marked ladies seats and the UI showed them with a pink border, but nothing enforced the rule. The automated browser script happened to choose that berth and enter a male name, and the booking went through. *Caught by:* reviewing the screenshots, not by any test. *Fix:* a server-side rule (`400 LADIES_SEAT`), client-side validation and a test on each side.

8. **Small UI defects in the screenshots.** The gender dropdown was clipped ("Femal"), and one seat looked washed out because a CSS transition was captured mid-way. *Fix:* widened the column, and the script now waits briefly before capturing.

9. **The agent's own running log had made-up timestamps.** While keeping its build notes, the agent wrote estimated times (for example "15:40") instead of reading the clock. When it checked the real time near the end, the whole build had taken about 15 minutes at that point. It removed the times rather than leave inaccurate ones. It's a small thing, but it's exactly the sort of confident-but-wrong detail that has to be checked in AI output.

One more honest limitation: **the Dockerfile has not been run with `docker build`**, because the sandbox had no Docker daemon. As a substitute, each Dockerfile step was run by hand in a clean folder, and the API smoke test passed against the result.

## 5. Where AI accelerated me

* **Boilerplate at senior quality:** layered Express structure, typed repositories, zod validation, a consistent error format and a composition root, in one pass with a clean compile.
* **Seed data with realism:** real corridors, sensible journey durations, night-heavy departures, lower berths priced higher, and partially sold buses. That's tedious to do by hand.
* **Test breadth:** 37 tests, including a `worker_threads` + `SharedArrayBuffer` race harness that I would not have written for a weekend prototype.
* **End-to-end verification:** driving two headless browser sessions to prove the WebSocket behaviour, rather than describing it.

## 6. How the AI output was validated

| Technique | What it caught or proved |
|---|---|
| Type checking (`tsc`, strict, test files included) | Contract drift between layers |
| Running the real server and reading curl output | #2, and the misleading "seat was just taken" wording for a seat that was only held |
| **Mutation checks** (break a guard on purpose, confirm a test fails) | #3. It also proved the PK, the IMMEDIATE transaction, the booked-seat check, the departed-bus filter and both React hook guards are each covered |
| Real concurrency (separate DB connections in separate threads) | #4. It also showed which concurrency tests really race and which only serialize |
| Two-browser end-to-end run + screenshot review | Real-time correctness; #7, #8 |
| Reading manifests and package contents instead of trusting tool messages | #1, #5 |
| Fresh-copy install (`npm install && npm run dev && npm test`) | One-command setup works on a clean checkout |

**My own review** `[ADD before submitting]`: e.g. "I read the hold/booking services and the useTripSeats hook line by line, ran it locally, and tried to double-book from two browsers", plus anything I changed.

## 7. What I'd do differently or next

* Make the spec even more explicit about domain rules (ladies seats, cancellation windows) up front. The AI implements what's asked and invents the rest. #7 happened because the rule existed in the data but not in the spec.
* Ask for mutation testing from the start instead of after the first all-green run. It found a real gap within minutes.
* Next steps for the product: payments with an idempotency key, Redis or Kafka fan-out for multiple instances, versioned socket deltas, rate limiting on holds, and httpOnly-cookie auth (see the README trade-offs).
