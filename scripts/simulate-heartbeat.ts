/**
 * Heartbeat Lifecycle Simulator
 *
 * Runs through 8 phases of a user relationship lifecycle:
 *   1. First Contact — brand new user, < 5 memories
 *   2. Learning — building relationship, only facts/preferences
 *   3. Active Work — plans + activities in flight
 *   4. Active Work + LLM — same state with analyze=true (full pipeline)
 *   5. Interrupted Session — user went quiet mid-work
 *   6. Sentiment Decline — user getting frustrated
 *   7. Contradiction — conflicting preferences detected
 *   8. Deadline Pressure + LLM — urgent deadline, full pipeline
 *
 * For each phase it shows:
 *   - Raw engine result (what the Go heartbeat returns)
 *   - LLM analysis (when enabled — what the LLM thinks)
 *   - Formatted context (exactly what OpenClaw injects into the AI prompt)
 *
 * Usage:
 *   cd keyoku && npx tsx scripts/simulate-heartbeat.ts [base_url]
 *
 * Requires: keyoku-server running at base_url (default: http://localhost:8100)
 */

import { formatHeartbeatContext, formatMemoryContext } from '../packages/openclaw/dist/context.js';
import type { HeartbeatContextResult } from '../packages/types/dist/memory.js';

const BASE_URL = process.argv[2] || 'http://localhost:8100';
const AUTH_TOKEN = process.env.KEYOKU_SESSION_TOKEN || 'test';
const AGENT_ID = 'kumo';

// ── Helpers ──────────────────────────────────────────────────────────────────

function iso(offsetMs: number = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

const HOUR = 3600_000;
const DAY = 86400_000;

interface SeedMemory {
  entity_id: string;
  agent_id: string;
  content: string;
  type: string;
  importance: number;
  tags?: string[];
  expires_at?: string;
  sentiment?: number;
  confidence_factors?: string[];
  created_at?: string;
}

async function api(method: string, path: string, body?: unknown): Promise<unknown> {
  const resp = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${method} ${path} → ${resp.status}: ${text}`);
  }
  return resp.json();
}

async function seed(memories: SeedMemory[]): Promise<void> {
  const result = await api('POST', '/api/v1/seed', { memories });
  const r = result as { created: number };
  console.log(`  [seeded ${r.created} memories]`);
}

async function heartbeat(entityId: string, options: {
  analyze?: boolean;
  query?: string;
  autonomy?: string;
} = {}): Promise<HeartbeatContextResult> {
  return api('POST', '/api/v1/heartbeat/context', {
    entity_id: entityId,
    agent_id: AGENT_ID,
    query: options.query || 'what should I tell this user',
    top_k: 10,
    max_results: 10,
    analyze: options.analyze ?? false,
    autonomy: options.autonomy || 'suggest',
  }) as Promise<HeartbeatContextResult>;
}

// ── Display helpers ──────────────────────────────────────────────────────────

function divider(title: string): void {
  console.log('\n' + '═'.repeat(72));
  console.log(`  ${title}`);
  console.log('═'.repeat(72));
}

function section(title: string): void {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 64 - title.length))}`);
}

function printRawResult(ctx: HeartbeatContextResult): void {
  section('1. Raw Engine Result');
  console.log(`  should_act:          ${ctx.should_act}`);
  console.log(`  decision_reason:     ${ctx.decision_reason ?? 'n/a'}`);
  console.log(`  highest_urgency:     ${ctx.highest_urgency_tier ?? 'n/a'}`);
  console.log(`  time_period:         ${ctx.time_period ?? 'n/a'}`);
  console.log(`  escalation_level:    ${ctx.escalation_level ?? 0}`);
  console.log(`  in_conversation:     ${ctx.in_conversation ?? false}`);
  console.log(`  confluence_score:    ${ctx.confluence_score ?? 0}`);
  console.log(`  response_rate:       ${ctx.response_rate?.toFixed(2) ?? 'n/a'}`);

  if (ctx.pending_work?.length)        console.log(`  pending_work:        ${ctx.pending_work.length} items`);
  if (ctx.deadlines?.length)           console.log(`  deadlines:           ${ctx.deadlines.length} items`);
  if (ctx.scheduled?.length)           console.log(`  scheduled:           ${ctx.scheduled.length} items`);
  if (ctx.conflicts?.length)           console.log(`  conflicts:           ${ctx.conflicts.length} items`);
  if (ctx.continuity?.was_interrupted) console.log(`  continuity:          interrupted ${ctx.continuity.session_age_hours?.toFixed(1)}h ago`);
  if (ctx.sentiment_trend)             console.log(`  sentiment:           ${ctx.sentiment_trend.direction} (Δ${ctx.sentiment_trend.delta?.toFixed(2)})`);
  if (ctx.goal_progress?.length)       console.log(`  goal_progress:       ${ctx.goal_progress.length} goals`);
  if (ctx.knowledge_gaps?.length)      console.log(`  knowledge_gaps:      ${ctx.knowledge_gaps.length} questions`);
  if (ctx.positive_deltas?.length)     console.log(`  positive_deltas:     ${ctx.positive_deltas.length} deltas`);
  if (ctx.relevant_memories?.length)   console.log(`  relevant_memories:   ${ctx.relevant_memories.length} found`);
  if (ctx.nudge_context)               console.log(`  nudge_context:       "${ctx.nudge_context.slice(0, 80)}..."`);
  if (ctx.recent_messages?.length)     console.log(`  recent_messages:     ${ctx.recent_messages.length} (for dedup)`);

  if (ctx.summary) {
    section('2. Engine Summary (raw signal dump)');
    console.log(ctx.summary);
  }
}

function printLLMAnalysis(ctx: HeartbeatContextResult): void {
  if (!ctx.analysis) {
    section('3. LLM Analysis');
    console.log('  (not requested or not available)');
    return;
  }
  section('3. LLM Analysis');
  const a = ctx.analysis;
  console.log(`  should_act:     ${a.should_act}`);
  console.log(`  autonomy:       ${a.autonomy}`);
  console.log(`  urgency:        ${a.urgency}`);
  if (a.action_brief) console.log(`  action_brief:   ${a.action_brief}`);
  if (a.user_facing)  console.log(`  user_facing:    ${a.user_facing}`);
  if (a.reasoning)    console.log(`  reasoning:      ${a.reasoning}`);
  if (a.recommended_actions?.length) {
    console.log('  recommended_actions:');
    for (const action of a.recommended_actions) {
      console.log(`    → ${action}`);
    }
  }
}

function printFormattedContext(ctx: HeartbeatContextResult): void {
  section('4. Formatted Context (EXACTLY what gets injected into the AI prompt)');
  console.log('  ┌─ This is what the AI agent sees as prepended context: ─┐');
  const formatted = formatHeartbeatContext(ctx);
  if (formatted) {
    // Indent each line for readability
    for (const line of formatted.split('\n')) {
      console.log(`  │ ${line}`);
    }
  } else {
    console.log('  │ (empty — nothing to inject, agent stays silent)');
  }
  console.log('  └──────────────────────────────────────────────────────────┘');

  // Also show memory context if relevant memories exist
  if (ctx.relevant_memories?.length) {
    section('5. Memory Context (auto-recall block, separate from heartbeat)');
    const memCtx = formatMemoryContext(ctx.relevant_memories);
    if (memCtx) {
      for (const line of memCtx.split('\n')) {
        console.log(`  │ ${line}`);
      }
    }
  }
}

function pause(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Phases ────────────────────────────────────────────────────────────────────

async function phase1_firstContact(entityId: string): Promise<void> {
  divider('PHASE 1: FIRST CONTACT');
  console.log('  User just connected. Only 2 memories exist (< 5 threshold).');
  console.log('  → Engine triggers first_contact mode');
  console.log('  → Context tells agent to introduce itself\n');

  await seed([
    { entity_id: entityId, agent_id: AGENT_ID, content: 'New user connected via Telegram', type: 'CONTEXT', importance: 0.3 },
    { entity_id: entityId, agent_id: AGENT_ID, content: "User's display name is Taiki", type: 'IDENTITY', importance: 0.5 },
  ]);

  const ctx = await heartbeat(entityId);
  printRawResult(ctx);
  printFormattedContext(ctx);
}

async function phase2_learningAboutUser(entityId: string): Promise<void> {
  divider('PHASE 2: LEARNING ABOUT USER');
  console.log('  Agent has had several conversations. Knows facts and preferences.');
  console.log('  No active plans or tasks — just relationship-building.');
  console.log('  → If no other signals, engine may nudge with an interesting memory');
  console.log('  → Or stay quiet (no_signals) if nothing compelling\n');

  await seed([
    { entity_id: entityId, agent_id: AGENT_ID, content: 'Taiki is a software engineer building AI agent infrastructure', type: 'IDENTITY', importance: 0.7 },
    { entity_id: entityId, agent_id: AGENT_ID, content: 'Prefers direct, concise communication — dislikes verbose explanations', type: 'PREFERENCE', importance: 0.6 },
    { entity_id: entityId, agent_id: AGENT_ID, content: 'Drinks matcha lattes every morning, codes best between 10pm and 2am', type: 'PREFERENCE', importance: 0.4 },
    { entity_id: entityId, agent_id: AGENT_ID, content: 'Training for a half marathon in April', type: 'IDENTITY', importance: 0.5 },
    { entity_id: entityId, agent_id: AGENT_ID, content: 'Recently adopted a golden retriever puppy named Mochi', type: 'IDENTITY', importance: 0.6 },
    { entity_id: entityId, agent_id: AGENT_ID, content: 'Enjoys reading science fiction — Asimov and Le Guin are favorites', type: 'PREFERENCE', importance: 0.4 },
    { entity_id: entityId, agent_id: AGENT_ID, content: 'Works remotely from Portland, Oregon', type: 'IDENTITY', importance: 0.4 },
  ]);

  const ctx = await heartbeat(entityId);
  printRawResult(ctx);
  printFormattedContext(ctx);
}

async function phase3_activeWork(entityId: string): Promise<void> {
  divider('PHASE 3: ACTIVE WORK (no LLM)');
  console.log('  User has active plans with deadline pressure, recent activities,');
  console.log('  and a stale monitor. This is the busiest signal state.');
  console.log('  → PendingWork, Deadlines, GoalProgress, StaleMonitors all fire');
  console.log('  → Engine decides should_act=true\n');

  await seed([
    { entity_id: entityId, agent_id: AGENT_ID, content: 'Ship the Keyoku v2 release — heartbeat rewrite, content rotation, escalation tracking', type: 'PLAN', importance: 0.8, expires_at: iso(DAY) },
    { entity_id: entityId, agent_id: AGENT_ID, content: 'Prepare investor pitch deck for Tuesday meeting', type: 'PLAN', importance: 0.9, expires_at: iso(DAY * 2) },
    { entity_id: entityId, agent_id: AGENT_ID, content: 'Implemented time-of-day tiers for the heartbeat algorithm rewrite', type: 'ACTIVITY', importance: 0.5, created_at: iso(-HOUR * 3) },
    { entity_id: entityId, agent_id: AGENT_ID, content: 'Added escalation tracking with topic_surfacings table for heartbeat', type: 'ACTIVITY', importance: 0.5, created_at: iso(-HOUR * 2) },
    { entity_id: entityId, agent_id: AGENT_ID, content: 'Built the seed endpoint to test heartbeat scenarios without LLM extraction', type: 'ACTIVITY', importance: 0.5, created_at: iso(-HOUR) },
    { entity_id: entityId, agent_id: AGENT_ID, content: 'Monitor CI pipeline — heartbeat test suite had flaky tests', type: 'PLAN', importance: 0.6, tags: ['monitor'], created_at: iso(-DAY * 2) },
  ]);

  const ctx = await heartbeat(entityId);
  printRawResult(ctx);
  printFormattedContext(ctx);
}

async function phase4_activeWorkWithLLM(entityId: string): Promise<void> {
  divider('PHASE 4: ACTIVE WORK + LLM ANALYSIS');
  console.log('  Same memory state as Phase 3, but analyze=true.');
  console.log('  → LLM receives all signals and produces action_brief + user_facing');
  console.log('  → OpenClaw formats the LLM analysis instead of raw signals');
  console.log('  → This is the FULL production pipeline\n');

  const ctx = await heartbeat(entityId, { analyze: true, autonomy: 'suggest' });
  printRawResult(ctx);
  printLLMAnalysis(ctx);
  printFormattedContext(ctx);
}

async function phase5_interruptedSession(entityId: string): Promise<void> {
  divider('PHASE 5: INTERRUPTED SESSION');
  console.log('  User was actively coding 1-2h ago, then went silent.');
  console.log('  Recent ACTIVITY memories within the 12h/2h session window.');
  console.log('  → Continuity signal fires: "You were working on: ..."');
  console.log('  → Elevated urgency tier\n');

  await seed([
    { entity_id: entityId, agent_id: AGENT_ID, content: 'Was debugging the signal fingerprint calculation in evaluateShouldAct', type: 'ACTIVITY', importance: 0.5, created_at: iso(-HOUR * 1.5) },
    { entity_id: entityId, agent_id: AGENT_ID, content: 'Started writing snapshot tests for the heartbeat v3 changes', type: 'ACTIVITY', importance: 0.5, created_at: iso(-HOUR) },
  ]);

  const ctx = await heartbeat(entityId);
  printRawResult(ctx);
  printFormattedContext(ctx);
}

async function phase6_sentimentDecline(entityId: string): Promise<void> {
  divider('PHASE 6: SENTIMENT DECLINE');
  console.log('  Older memories are positive. Recent ones are negative.');
  console.log('  Needs 6+ memories with clear sentiment shift (Δ > 0.3).');
  console.log('  → Sentiment.Direction=declining');
  console.log('  → Context adds: "Their tone has been more negative recently"\n');

  await seed([
    { entity_id: entityId, agent_id: AGENT_ID, content: 'Excited about the new agent architecture — coming together nicely', type: 'CONTEXT', importance: 0.4, sentiment: 0.8, created_at: iso(-DAY * 10) },
    { entity_id: entityId, agent_id: AGENT_ID, content: 'Made great progress on the orchestrator today', type: 'CONTEXT', importance: 0.4, sentiment: 0.7, created_at: iso(-DAY * 9) },
    { entity_id: entityId, agent_id: AGENT_ID, content: 'Happy with how the capability pack system turned out', type: 'CONTEXT', importance: 0.4, sentiment: 0.6, created_at: iso(-DAY * 8) },
    { entity_id: entityId, agent_id: AGENT_ID, content: 'Frustrated that heartbeats are not firing at all overnight', type: 'CONTEXT', importance: 0.5, sentiment: -0.6, created_at: iso(-HOUR * 4) },
    { entity_id: entityId, agent_id: AGENT_ID, content: '221 heartbeat ticks and zero messages sent — completely broken', type: 'CONTEXT', importance: 0.5, sentiment: -0.8, created_at: iso(-HOUR * 2) },
    { entity_id: entityId, agent_id: AGENT_ID, content: 'GoalProgress noise drowning out real signals, nothing works', type: 'CONTEXT', importance: 0.5, sentiment: -0.7, created_at: iso(-HOUR) },
  ]);

  const ctx = await heartbeat(entityId);
  printRawResult(ctx);
  printFormattedContext(ctx);
}

async function phase7_conflictDetected(entityId: string): Promise<void> {
  divider('PHASE 7: CONTRADICTION DETECTED');
  console.log('  User said conflicting things about their database preference.');
  console.log('  One memory has confidence_factors=["conflict_flagged: ..."].');
  console.log('  → Conflicts signal fires (TierElevated)');
  console.log('  → Context shows: "Conflict: contradicts earlier preference"\n');

  await seed([
    { entity_id: entityId, agent_id: AGENT_ID, content: 'User wants to use PostgreSQL for the production database', type: 'PREFERENCE', importance: 0.7, confidence_factors: ['conflict_flagged: contradicts earlier preference for SQLite-only architecture'] },
    { entity_id: entityId, agent_id: AGENT_ID, content: 'User strongly prefers SQLite for everything to keep deployment simple', type: 'PREFERENCE', importance: 0.6 },
  ]);

  const ctx = await heartbeat(entityId);
  printRawResult(ctx);
  printFormattedContext(ctx);
}

async function phase8_deadlinePressure(entityId: string): Promise<void> {
  divider('PHASE 8: DEADLINE PRESSURE + LLM (autonomy=act)');
  console.log('  Investor meeting in 14 hours. Pitch deck not finished.');
  console.log('  autonomy=act — agent is empowered to take initiative.');
  console.log('  → Immediate urgency tier (deadline within 24h)');
  console.log('  → LLM analysis should flag high urgency');
  console.log('  → Context formatted for maximum impact\n');

  await seed([
    { entity_id: entityId, agent_id: AGENT_ID, content: 'Has been stressed about the investor pitch', type: 'CONTEXT', importance: 0.5, sentiment: -0.4 },
    { entity_id: entityId, agent_id: AGENT_ID, content: 'Investor pitch deck must be finished — meeting is tomorrow morning at 9am', type: 'PLAN', importance: 0.95, expires_at: iso(HOUR * 14) },
    { entity_id: entityId, agent_id: AGENT_ID, content: 'Started working on the pitch deck slides about architecture', type: 'ACTIVITY', importance: 0.5, created_at: iso(-HOUR * 6) },
    { entity_id: entityId, agent_id: AGENT_ID, content: 'Still needs revenue projections and competitive analysis slides', type: 'PLAN', importance: 0.7 },
  ]);

  const ctx = await heartbeat(entityId, { analyze: true, autonomy: 'act' });
  printRawResult(ctx);
  printLLMAnalysis(ctx);
  printFormattedContext(ctx);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║              HEARTBEAT LIFECYCLE SIMULATOR                          ║');
  console.log('║  Traces the full pipeline: seed → engine → LLM → OpenClaw format   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(`\n  Server:   ${BASE_URL}`);
  console.log(`  Agent:    ${AGENT_ID}`);
  console.log(`  Phases:   8 lifecycle stages\n`);

  const ts = Date.now();

  try {
    // ── Phase 1: First Contact ──
    await phase1_firstContact(`sim-p1-${ts}`);
    await pause(500);

    // ── Phase 2: Learning ──
    await phase2_learningAboutUser(`sim-p2-${ts}`);
    await pause(500);

    // ── Phase 3 & 4: Active Work (no LLM, then with LLM) ──
    const workEntity = `sim-p3-${ts}`;
    // Base memories to avoid first-contact
    await seed([
      { entity_id: workEntity, agent_id: AGENT_ID, content: 'Taiki is a software engineer', type: 'IDENTITY', importance: 0.7 },
      { entity_id: workEntity, agent_id: AGENT_ID, content: 'Prefers concise communication', type: 'PREFERENCE', importance: 0.5 },
      { entity_id: workEntity, agent_id: AGENT_ID, content: 'Works remotely from Portland', type: 'IDENTITY', importance: 0.4 },
      { entity_id: workEntity, agent_id: AGENT_ID, content: 'Building Sentai v2 framework', type: 'IDENTITY', importance: 0.6 },
      { entity_id: workEntity, agent_id: AGENT_ID, content: 'Adopted a puppy named Mochi', type: 'IDENTITY', importance: 0.5 },
    ]);
    await phase3_activeWork(workEntity);
    await pause(500);
    await phase4_activeWorkWithLLM(workEntity);
    await pause(500);

    // ── Phase 5: Interrupted ──
    await phase5_interruptedSession(workEntity);
    await pause(500);

    // ── Phase 6: Sentiment ──
    const sentimentEntity = `sim-p6-${ts}`;
    await seed([
      { entity_id: sentimentEntity, agent_id: AGENT_ID, content: 'Taiki is a developer', type: 'IDENTITY', importance: 0.6 },
      { entity_id: sentimentEntity, agent_id: AGENT_ID, content: 'Works on AI systems', type: 'IDENTITY', importance: 0.5 },
      { entity_id: sentimentEntity, agent_id: AGENT_ID, content: 'Based in Portland', type: 'IDENTITY', importance: 0.4 },
      { entity_id: sentimentEntity, agent_id: AGENT_ID, content: 'Likes matcha lattes', type: 'PREFERENCE', importance: 0.3 },
      { entity_id: sentimentEntity, agent_id: AGENT_ID, content: 'Has a puppy named Mochi', type: 'IDENTITY', importance: 0.4 },
    ]);
    await phase6_sentimentDecline(sentimentEntity);
    await pause(500);

    // ── Phase 7: Conflict ──
    const conflictEntity = `sim-p7-${ts}`;
    await seed([
      { entity_id: conflictEntity, agent_id: AGENT_ID, content: 'Taiki builds database systems', type: 'IDENTITY', importance: 0.6 },
      { entity_id: conflictEntity, agent_id: AGENT_ID, content: 'Values simplicity', type: 'PREFERENCE', importance: 0.5 },
      { entity_id: conflictEntity, agent_id: AGENT_ID, content: 'Working on Keyoku engine', type: 'IDENTITY', importance: 0.5 },
      { entity_id: conflictEntity, agent_id: AGENT_ID, content: 'Prefers Go for backend', type: 'PREFERENCE', importance: 0.4 },
      { entity_id: conflictEntity, agent_id: AGENT_ID, content: 'Lives in Portland', type: 'IDENTITY', importance: 0.3 },
    ]);
    await phase7_conflictDetected(conflictEntity);
    await pause(500);

    // ── Phase 8: Deadline + LLM ──
    const deadlineEntity = `sim-p8-${ts}`;
    await seed([
      { entity_id: deadlineEntity, agent_id: AGENT_ID, content: 'Taiki is a software engineer building Sentai v2', type: 'IDENTITY', importance: 0.7 },
      { entity_id: deadlineEntity, agent_id: AGENT_ID, content: 'Prefers direct communication', type: 'PREFERENCE', importance: 0.5 },
      { entity_id: deadlineEntity, agent_id: AGENT_ID, content: 'Works remotely', type: 'IDENTITY', importance: 0.4 },
      { entity_id: deadlineEntity, agent_id: AGENT_ID, content: 'Building AI agent platform', type: 'IDENTITY', importance: 0.5 },
      { entity_id: deadlineEntity, agent_id: AGENT_ID, content: 'Has a dog named Mochi', type: 'IDENTITY', importance: 0.4 },
    ]);
    await phase8_deadlinePressure(deadlineEntity);

  } catch (err) {
    console.error('\n  ERROR:', err);
    console.error(`\n  Is keyoku-server running at ${BASE_URL}?`);
    process.exit(1);
  }

  divider('SIMULATION COMPLETE');
  console.log(`
  Summary of what each phase demonstrates:

  Phase 1  First Contact     → should_act=true, reason=first_contact
  Phase 2  Learning          → nudge or no_signals (relationship building)
  Phase 3  Active Work       → act with PendingWork + Deadlines + GoalProgress
  Phase 4  Work + LLM        → Full pipeline: action_brief + recommended_actions
  Phase 5  Interrupted       → Continuity signal: "you were working on..."
  Phase 6  Sentiment         → declining mood detected, supportive context
  Phase 7  Conflict          → contradiction flagged, elevated urgency
  Phase 8  Deadline + LLM    → immediate urgency, LLM-analyzed with autonomy=act

  Each phase used a unique entity ID (sim-p*-${ts}).
  Re-run individual phases by modifying the script.
`);
}

main();
