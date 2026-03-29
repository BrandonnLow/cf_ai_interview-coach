# AI Interview Coach

An AI-powered mock interview app built on the Cloudflare Developer Platform. Select a role, set your difficulty level, and get interviewed by an AI, with real-time feedback and persistent session memory.

**Live demo:** https://cf_ai_interview-coach.lssb2003.workers.dev

---

## Features

- **AI Interviewer** - Powered by Llama 3.1 via Workers AI. Asks questions, gives feedback, and adapts to your answers.
- **Session memory** - Full conversation history persists across messages using Durable Objects (SQLite-backed).
- **Role dropdown** - Pick from preset roles or type your own.
- **Company context** - Optionally specify a company to get tailored questions.
- **Difficulty levels** - Junior, Mid, or Senior changes the depth and style of questions.
- **Question tracker** - Live counter shows how many questions you've answered.
- **Edit answers** - Inline edit any previous answer and the AI re-responds from that point.
- **Restart** - Reset the session at any time without refreshing the page.

---

## Architecture

| Component | Cloudflare Product |
|---|---|
| LLM inference | Workers AI - `@cf/meta/llama-3.1-8b-instruct` |
| Session memory & state | Durable Objects with SQLite storage |
| API routing | Cloudflare Workers |
| Frontend | Static assets via Workers Assets |

---

## How it works

1. User picks a role, company, and difficulty, then clicks **Start Interview**
2. The frontend generates a unique `sessionId` and sends it with every request
3. The Worker routes each request to the correct **Durable Object** instance by `sessionId`
4. The Durable Object loads full conversation history from `ctx.storage`, appends the new message, calls Workers AI, saves the reply, and returns it
5. The frontend streams the reply into the chat and updates the question counter

---

## Running locally

### Prerequisites
- Node.js 18+
- A Cloudflare account (free tier works)

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/cf_ai_interview-coach.git
cd cf_ai_interview-coach
npm install
```

### Run

```bash
npx wrangler login   # only needed once
npx wrangler dev
```

Visit `http://localhost:8787`

> Note: Workers AI always calls Cloudflare's remote servers even in local dev, so you need to be logged in.

### Deploy

```bash
npx wrangler deploy
```

---

## Project structure

```
cf_ai_interview-coach/
├── src/
│   └── index.ts          # Worker entrypoint + Durable Object
├── public/
│   └── index.html        # Frontend chat UI
├── test/
│   └── index.spec.ts     # Vitest integration tests
└── wrangler.jsonc        # Cloudflare config (bindings, migrations)
```

---

## Tech stack

- **Runtime:** Cloudflare Workers (V8 isolates)
- **AI:** Workers AI - Meta Llama 3.1 8B Instruct
- **State:** Durable Objects + SQLite via `ctx.storage`
- **Language:** TypeScript
- **Testing:** Vitest + `cloudflare:test`