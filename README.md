<div align="center">

  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/banner-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/banner-light.svg">
    <img alt="keyoku" src="assets/banner-light.svg" width="800">
  </picture>

  <p>
    <strong>Supercharge your OpenClaw assistant with persistent memory.</strong><br>
    <sub>Your agent remembers everything, learns from every conversation, and acts on what it knows — automatically.</sub>
  </p>

  <p>
    <a href="#get-started">Get Started</a> &bull;
    <a href="#what-your-agent-gets">What Your Agent Gets</a> &bull;
    <a href="#the-heartbeat">The Heartbeat</a> &bull;
    <a href="#autonomy-levels">Autonomy Levels</a>
  </p>

  [![npm](https://img.shields.io/npm/v/@keyoku/openclaw?label=%40keyoku%2Fopenclaw&style=flat-square&color=6366f1)](https://www.npmjs.com/package/@keyoku/openclaw)
  [![npm](https://img.shields.io/npm/v/@keyoku/memory?label=%40keyoku%2Fmemory&style=flat-square&color=6366f1)](https://www.npmjs.com/package/@keyoku/memory)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)](LICENSE)

</div>

<br>

## Why Keyoku?

Most AI assistants forget everything when the conversation ends. Keyoku changes that.

With Keyoku, your OpenClaw assistant **remembers who you are**, what you've talked about, what you care about, and what's coming up — across every conversation, forever. It doesn't just store text in a file. It understands the *meaning* behind your conversations, extracts the important parts automatically, and uses that knowledge to be genuinely helpful.

**No `.md` files. No manual memory management. No "remind me" prompts.** Your agent just *knows*.

### The difference

| Without Keyoku | With Keyoku |
|:---|:---|
| Agent forgets everything between sessions | Agent remembers preferences, facts, decisions, and context |
| You repeat yourself constantly | Agent recalls relevant details before every response |
| Agent is reactive — waits for you to ask | Agent is proactive — surfaces deadlines, follows up, checks in |
| Memory is a flat text file | Memory is semantic — understands meaning, detects conflicts, decays stale info |
| One agent, one memory | Multi-agent teams with shared and private memory scopes |

---

## Get Started

### 1. Install the plugin

```bash
npm install @keyoku/openclaw
```

### 2. Add it to your OpenClaw config

```typescript
import keyokuMemory from '@keyoku/openclaw';

const config = {
  plugins: {
    'keyoku-memory': keyokuMemory()  // that's it — all features are on by default
  },
  slots: {
    memory: 'keyoku-memory'
  }
};
```

That's all you need. Everything is enabled by default — auto-recall, auto-capture, heartbeat, incremental learning, and all 7 memory tools.

### 3. Make sure keyoku-engine is running

The plugin connects to [**keyoku-engine**](https://github.com/keyoku-ai/keyoku-engine), which runs locally on your machine. It stores everything in SQLite — no cloud databases, no API keys for storage, your data stays on your device.

```
Your Agent ──▶ @keyoku/openclaw ──▶ keyoku-engine ──▶ SQLite + HNSW
               (plugin)              (local server)     (your machine)
```

> [!NOTE]
> keyoku-engine defaults to `http://localhost:18900`. See the [keyoku-engine repo](https://github.com/keyoku-ai/keyoku-engine) for setup instructions.

---

## What Your Agent Gets

Once the plugin is registered, your agent gains these capabilities with **zero additional code**:

### Auto-Recall

Before every response, Keyoku searches your agent's memory for anything relevant to what you're talking about and silently injects it into the prompt. Your agent doesn't "look up" memories — it just *knows* things about you, like a person would.

> **Example:** You mentioned you prefer dark mode three weeks ago. Today you ask about UI settings — your agent already knows your preference without you saying anything.

### Auto-Capture

Every message you exchange is analyzed in real-time. Keyoku extracts the important parts — preferences, decisions, facts, relationships — and stores them as discrete memories. It captures the *pair* (what you said + what the agent responded) for full context.

The engine automatically:
- **Deduplicates** — won't store the same fact twice (checks by hash and meaning)
- **Detects conflicts** — if you change your mind, the old memory gets updated
- **Decays stale info** — old, unused memories fade over time so the freshest knowledge surfaces first

### 7 Memory Tools

Your agent can also *actively* use memory through these tools (registered automatically):

| Tool | What it does |
|------|-------------|
| `memory_search` | Find memories by meaning — "what does this user like?" |
| `memory_store` | Save something important for later |
| `memory_get` | Read a specific memory |
| `memory_forget` | Delete something that's no longer true |
| `memory_stats` | See how many memories exist, by type and state |
| `schedule_create` | Set a recurring reminder (daily, weekly, monthly, or custom cron) |
| `schedule_list` | View all active schedules |

---

## The Heartbeat

This is where Keyoku gets powerful.

Most memory systems are passive — they store things and retrieve them when asked. Keyoku's heartbeat is **active**. On every heartbeat tick, your agent doesn't just sit idle. It reviews everything it knows and decides if there's something it should do *right now*.

### How it works

1. **OpenClaw fires a heartbeat tick** (every few minutes by default)
2. **Keyoku scans all memory signals** — no LLM tokens spent on this initial check
3. **If something needs attention**, Keyoku runs an LLM analysis to understand the situation and generates an action brief
4. **The agent receives structured signals** telling it what to do, what to say, and how urgent it is

### What the heartbeat detects

The heartbeat doesn't just check one thing. It scans across **10 signal categories** simultaneously:

| Signal | What it catches |
|--------|----------------|
| **Scheduled tasks** | Recurring reminders that are due (daily standup, weekly report, etc.) |
| **Deadlines** | Memories with expiration dates that are approaching |
| **Pending work** | Unfinished tasks or commitments the agent made |
| **Conflicts** | Contradictory information that needs resolution |
| **Goal progress** | How far along tracked goals are, with time remaining |
| **Session continuity** | Interrupted conversations that should be resumed |
| **Sentiment trends** | Shifts in user mood across recent conversations |
| **Relationship alerts** | People or contacts the user hasn't engaged with in a while |
| **Knowledge gaps** | Questions the agent couldn't answer — flagged for follow-up |
| **Behavioral patterns** | Recurring habits or preferences detected over time |

### Why this is better than a `.md` file

A `HEARTBEAT.md` file is static. It tells the agent to "check in" but gives it no context, no data, and no idea what's actually going on. The agent has to guess.

Keyoku's heartbeat **injects real, structured signals** directly into the agent's context:

```
<heartbeat-signals>
## Action Brief
The user has a project deadline in 2 days and hasn't mentioned it recently.

## Suggested Actions
- Remind the user about the Friday deadline for the API migration
- Ask if they need help prioritizing remaining tasks

## Tell the User
Hey — just a heads up, your API migration deadline is this Friday.
Looks like there are still 3 open tasks. Want me to help prioritize?

Urgency: soon | Mode: suggest
</heartbeat-signals>
```

The agent gets **exactly what it needs** — what's happening, what to do about it, and what to say. No guessing.

### Idle check-ins

If nothing urgent is happening for a while, Keyoku notices the silence. After a few quiet heartbeat ticks, it triggers a friendly check-in — referencing things it knows about you to make the message personal, not generic.

---

## Autonomy Levels

You control how much freedom your agent has when the heartbeat detects something. Set the `autonomy` option to one of three levels:

### `observe` — Watch and log

The agent sees the signals but **does not act on them**. Heartbeat data is logged for debugging or review, but the agent won't message the user or take any action.

**Best for:** Testing, debugging, understanding what Keyoku detects before enabling actions.

### `suggest` — Recommend actions (default)

The agent receives the signals and **suggests actions to the user**. It will surface reminders, ask about deadlines, and flag conflicts — but it frames everything as a suggestion, not an instruction.

**Best for:** Most users. Your agent is helpful and proactive without being pushy. It says things like "Hey, your deadline is Friday — want me to help?" rather than just doing things.

### `act` — Take action immediately

The agent receives the signals and **executes recommended actions directly**. If a reminder is due, it sends it. If a task is overdue, it follows up. No waiting for permission.

**Best for:** Power users who want a fully autonomous assistant that handles things on its own.

```typescript
// Set autonomy in your config
keyokuMemory({
  autonomy: 'suggest',  // 'observe' | 'suggest' | 'act'
})
```

| Level | Agent sees signals | Agent messages user | Agent takes action |
|-------|:-:|:-:|:-:|
| `observe` | Yes | No | No |
| `suggest` | Yes | Yes (as suggestions) | No |
| `act` | Yes | Yes | Yes |

---

## Configuration

Everything works out of the box with defaults. Customize only what you need:

```typescript
keyokuMemory({
  keyokuUrl: 'http://localhost:18900',  // keyoku-engine server URL
  autoRecall: true,                     // inject memories into every prompt
  autoCapture: true,                    // extract facts from conversations
  heartbeat: true,                      // enable proactive heartbeat signals
  incrementalCapture: true,             // capture per-message (real-time)
  topK: 5,                              // max memories injected per prompt
  entityId: 'user-123',                 // memory namespace (default: agent name)
  agentId: 'agent-1',                   // agent identifier
  captureMaxChars: 2000,                // max input chars for capture
  autonomy: 'suggest',                  // 'observe' | 'suggest' | 'act'
})
```

| Option | Default | What it does |
|--------|---------|-------------|
| `autoRecall` | `true` | Before every response, search memory and inject relevant context |
| `autoCapture` | `true` | After every message, extract and store important facts |
| `heartbeat` | `true` | Enable the heartbeat system (proactive signals) |
| `incrementalCapture` | `true` | Capture in real-time per message, not just at session end |
| `topK` | `5` | How many memories to inject per prompt (higher = more context) |
| `entityId` | agent name | Isolate memories per user — each user gets their own memory space |
| `agentId` | agent name | Identify which agent stored a memory (useful for multi-agent setups) |
| `autonomy` | `'suggest'` | How the agent responds to heartbeat signals (see [Autonomy Levels](#autonomy-levels)) |
| `keyokuUrl` | `localhost:18900` | Where keyoku-engine is running |

---

## For Developers: Standalone Memory Client

Building a custom agent without OpenClaw? Use `@keyoku/memory` directly for full programmatic access to the memory engine.

```bash
npm install @keyoku/memory
```

```typescript
import { KeyokuClient } from '@keyoku/memory';

const keyoku = new KeyokuClient();

// Store a memory
await keyoku.remember('user-123', 'Prefers dark mode and TypeScript');

// Semantic search
const results = await keyoku.search('user-123', 'UI preferences');
// => [{ memory: { content: 'Prefers dark mode...' }, similarity: 0.91 }]

// Heartbeat check (zero tokens)
const heartbeat = await keyoku.heartbeatCheck('user-123');
if (heartbeat.should_act) {
  console.log(heartbeat.priority_action);
}

// Full heartbeat with LLM analysis
const ctx = await keyoku.heartbeatContext('user-123', {
  analyze: true,
  autonomy: 'suggest',
  activity_summary: 'User was working on API migration',
});

// Scheduling
await keyoku.createSchedule('user-123', 'my-agent', 'Weekly standup prep', 'weekly');
```

<details>
<summary><strong>Full Client API</strong></summary>

<br>

```typescript
const client = new KeyokuClient({ baseUrl?: string, timeout?: number });
```

| Method | Description |
|--------|-------------|
| `remember(entityId, content, options?)` | Store memories from content |
| `search(entityId, query, options?)` | Semantic search across memories |
| `listMemories(entityId, limit?)` | List all memories for entity |
| `getMemory(id)` | Get a single memory by ID |
| `deleteMemory(id)` | Delete a specific memory |
| `deleteAllMemories(entityId)` | Delete all memories for entity |
| `getStats(entityId)` | Get memory statistics |
| `heartbeatCheck(entityId, options?)` | Zero-token heartbeat check |
| `heartbeatContext(entityId, options?)` | Extended heartbeat with LLM analysis |
| `createSchedule(entityId, agentId, content, cronTag)` | Create a scheduled memory |
| `listSchedules(entityId, agentId?)` | List active schedules |
| `ackSchedule(memoryId)` | Acknowledge a schedule |
| `cancelSchedule(id)` | Cancel a schedule |

</details>

---

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| [`@keyoku/openclaw`](packages/openclaw) | **OpenClaw plugin** — the main package. Auto-recall, auto-capture, heartbeat, tools, CLI | [![npm](https://img.shields.io/npm/v/@keyoku/openclaw?style=flat-square&color=6366f1)](https://www.npmjs.com/package/@keyoku/openclaw) |
| [`@keyoku/memory`](packages/memory) | Standalone HTTP client for developers building custom agents | [![npm](https://img.shields.io/npm/v/@keyoku/memory?style=flat-square&color=6366f1)](https://www.npmjs.com/package/@keyoku/memory) |
| [`@keyoku/types`](packages/types) | Shared TypeScript type definitions | [![npm](https://img.shields.io/npm/v/@keyoku/types?style=flat-square&color=6366f1)](https://www.npmjs.com/package/@keyoku/types) |

## How It Works

```
Your OpenClaw Assistant
    │
    ▼
@keyoku/openclaw (plugin)
    │  Every message:
    │    1. Recall — search memory, inject relevant context
    │    2. Respond — agent replies with full memory awareness
    │    3. Capture — extract facts from the exchange
    │  Every heartbeat tick:
    │    4. Scan — check all 10 signal categories
    │    5. Analyze — LLM evaluates what needs attention
    │    6. Act — agent responds based on autonomy level
    ▼
keyoku-engine (runs locally)
    │  extraction, semantic search, dedup, decay, consolidation
    ▼
SQLite + HNSW Vector Index (your machine, your data)
```

## Development

```bash
npm install   # install dependencies
npm run build # build all packages
npm test      # run tests
npm run clean # clean build artifacts
```

Requires Node.js 20+.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT — see [LICENSE](LICENSE) for details.

<br>
<div align="center">
  <sub>Built by <a href="https://github.com/keyoku-ai">Keyoku</a></sub>
</div>
