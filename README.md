<div align="center">

  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/banner-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/banner-light.svg">
    <img alt="keyoku" src="assets/banner-light.svg" width="800">
  </picture>

  <p>
    <strong>Give your AI agents persistent memory.</strong><br>
    <sub>Drop-in OpenClaw plugin with auto-recall, auto-capture, heartbeat, and scheduling — or use the standalone client.</sub>
  </p>

  <p>
    <a href="#quick-start">Quick Start</a> &bull;
    <a href="#openclaw-plugin">OpenClaw Plugin</a> &bull;
    <a href="#memory-client">Memory Client</a> &bull;
    <a href="#api-reference">API Reference</a>
  </p>

  [![npm](https://img.shields.io/npm/v/@keyoku/openclaw?label=%40keyoku%2Fopenclaw&style=flat-square&color=6366f1)](https://www.npmjs.com/package/@keyoku/openclaw)
  [![npm](https://img.shields.io/npm/v/@keyoku/memory?label=%40keyoku%2Fmemory&style=flat-square&color=6366f1)](https://www.npmjs.com/package/@keyoku/memory)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)](LICENSE)

</div>

<br>

## What is Keyoku?

Keyoku gives AI agents **long-term memory** — they remember users, learn from conversations, and act proactively on what they know.

The fastest way to add memory is the **OpenClaw plugin** (`@keyoku/openclaw`). Register it once and your agent gets auto-recall, auto-capture, heartbeat, scheduling, and 7 memory tools — zero boilerplate.

If you're building a custom agent (not using OpenClaw), use `@keyoku/memory` directly — a typed HTTP client for the full memory API.

Both packages connect to [**keyoku-engine**](https://github.com/keyoku-ai/keyoku-engine), a Go-based memory engine that handles extraction, vector search, deduplication, decay, and consolidation locally with SQLite and HNSW. No external databases required.

```
Your Agent ──▶ @keyoku/openclaw ──▶ @keyoku/memory ──▶ keyoku-engine ──▶ SQLite + HNSW
               (plugin)              (HTTP client)      (Go server)
```

## Quick Start

### OpenClaw Plugin (recommended)

```bash
npm install @keyoku/openclaw
```

```typescript
import keyokuMemory from '@keyoku/openclaw';

// Add to your OpenClaw config — that's it
const config = {
  plugins: {
    'keyoku-memory': keyokuMemory({
      autoRecall: true,          // inject relevant memories into every prompt
      autoCapture: true,         // extract facts from every message
      heartbeat: true,           // proactive checks for deadlines, conflicts, decay
      incrementalCapture: true,  // capture per-message (not just end of session)
    })
  },
  slots: {
    memory: 'keyoku-memory'
  }
};
```

That's all the code you need. Once registered, your agent automatically:

1. **Recalls** relevant memories before every response (semantic search, top 5 by default)
2. **Captures** important facts from each message into long-term memory
3. **Checks heartbeat** for proactive signals — upcoming deadlines, decaying knowledge, conflicts
4. **Exposes 7 tools** the agent can call: `memory_search`, `memory_store`, `memory_get`, `memory_forget`, `memory_stats`, `schedule_create`, `schedule_list`

#### Full configuration

```typescript
keyokuMemory({
  keyokuUrl: 'http://localhost:18900',  // keyoku-engine URL
  autoRecall: true,                     // inject memories into prompts
  autoCapture: true,                    // extract facts from conversations
  heartbeat: true,                      // proactive heartbeat signals
  incrementalCapture: true,             // per-message capture (vs batch)
  topK: 5,                              // max memories per recall
  entityId: 'user-123',                 // memory namespace (default: agent name)
  agentId: 'agent-1',                   // agent identifier for attribution
  captureMaxChars: 2000,                // max input chars for capture
  autonomy: 'suggest',                  // 'observe' | 'suggest' | 'act'
})
```

| Option | Default | Description |
|--------|---------|-------------|
| `autoRecall` | `true` | Inject relevant memories into every prompt via semantic search |
| `autoCapture` | `true` | Extract and store facts from conversations automatically |
| `heartbeat` | `true` | Enable proactive heartbeat signals (deadlines, conflicts, decay) |
| `incrementalCapture` | `true` | Capture per-message instead of end-of-session batch |
| `topK` | `5` | Maximum memories injected per prompt |
| `entityId` | agent name | Memory namespace — isolate memories per user/entity |
| `agentId` | agent name | Agent identifier for memory attribution |
| `autonomy` | `'suggest'` | Heartbeat mode: `observe` (log only), `suggest` (recommend), `act` (execute) |
| `keyokuUrl` | `http://localhost:18900` | keyoku-engine server URL |

---

### Memory Client (standalone)

Use `@keyoku/memory` directly if you're building a custom agent or want full control.

```bash
npm install @keyoku/memory
```

```typescript
import { KeyokuClient } from '@keyoku/memory';

const keyoku = new KeyokuClient();

// Store a memory
await keyoku.remember('user-123', 'Prefers dark mode and TypeScript');

// Search by meaning
const results = await keyoku.search('user-123', 'UI preferences');
// => [{ memory: { content: 'Prefers dark mode...' }, similarity: 0.91 }]

// Heartbeat — check if the agent should act proactively
const heartbeat = await keyoku.heartbeatCheck('user-123');
if (heartbeat.should_act) {
  console.log(heartbeat.priority_action);
}

// Schedule a recurring reminder
await keyoku.createSchedule('user-123', 'my-agent', 'Weekly standup prep', 'weekly');
```

> [!NOTE]
> Both packages require [keyoku-engine](https://github.com/keyoku-ai/keyoku-engine) running locally (default: `http://localhost:18900`).

## Features

<table>
<tr>
<td align="center" width="33%">
  <strong>Auto-Recall</strong><br>
  <sub>Automatically injects relevant memories into agent prompts via semantic search</sub>
</td>
<td align="center" width="33%">
  <strong>Auto-Capture</strong><br>
  <sub>Extracts facts from every message — incrementally, not just at session end</sub>
</td>
<td align="center" width="33%">
  <strong>Heartbeat</strong><br>
  <sub>Zero-token proactive checks for deadlines, decay, conflicts, and idle check-ins</sub>
</td>
</tr>
<tr>
<td align="center" width="33%">
  <strong>7 Agent Tools</strong><br>
  <sub>Search, store, get, forget, stats, schedule create, schedule list — all registered automatically</sub>
</td>
<td align="center" width="33%">
  <strong>Scheduling</strong><br>
  <sub>Cron-tagged memories with daily/weekly/monthly or custom cron expressions</sub>
</td>
<td align="center" width="33%">
  <strong>Teams</strong><br>
  <sub>Multi-agent memory with private, team, and global visibility scopes</sub>
</td>
</tr>
</table>

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| [`@keyoku/openclaw`](packages/openclaw) | **OpenClaw plugin** — auto-recall, auto-capture, heartbeat, tools, CLI | [![npm](https://img.shields.io/npm/v/@keyoku/openclaw?style=flat-square&color=6366f1)](https://www.npmjs.com/package/@keyoku/openclaw) |
| [`@keyoku/memory`](packages/memory) | Standalone HTTP client for keyoku-engine | [![npm](https://img.shields.io/npm/v/@keyoku/memory?style=flat-square&color=6366f1)](https://www.npmjs.com/package/@keyoku/memory) |
| [`@keyoku/types`](packages/types) | Shared TypeScript type definitions | [![npm](https://img.shields.io/npm/v/@keyoku/types?style=flat-square&color=6366f1)](https://www.npmjs.com/package/@keyoku/types) |

## API Reference

<details>
<summary><strong>@keyoku/openclaw — Plugin Tools</strong></summary>

<br>

The plugin automatically registers these tools that your agent can call:

| Tool | Description |
|------|-------------|
| `memory_search` | Semantic search across stored memories. Params: `query`, `maxResults?`, `minScore?` |
| `memory_get` | Read a specific memory by ID (`mem:<id>`) or search by keyword |
| `memory_store` | Store important information in long-term memory |
| `memory_forget` | Delete a specific memory by ID |
| `memory_stats` | Get memory statistics (total, active, by type/state) |
| `schedule_create` | Create a recurring task/reminder. Tags: `daily`, `weekly`, `monthly`, or cron expression |
| `schedule_list` | List all active schedules |

**Lifecycle hooks** (automatic, no code needed):

| Hook | Trigger | What it does |
|------|---------|--------------|
| `before_prompt_build` | Every user message | Searches memories relevant to the prompt and injects them as context |
| `before_prompt_build` (heartbeat) | Heartbeat tick | Runs heartbeat context analysis, injects proactive signals |
| Incremental capture | Every message | Extracts and stores facts from user and assistant messages |

</details>

<details>
<summary><strong>@keyoku/memory — Client API</strong></summary>

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

## How It Works

```
Your Agent (OpenClaw / custom)
    │
    ▼
@keyoku/openclaw (plugin)
    │  auto-recall: injects memories before every prompt
    │  auto-capture: extracts facts from every message
    │  heartbeat: proactive signals on each tick
    │  tools: 7 memory/schedule tools for the agent
    ▼
@keyoku/memory (HTTP client)
    │  typed requests to keyoku-engine
    ▼
keyoku-engine (Go server)
    │  extraction, vector search, dedup, decay, consolidation
    ▼
SQLite + HNSW Vector Index
```

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Clean build artifacts
npm run clean
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
