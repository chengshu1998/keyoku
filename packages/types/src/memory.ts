/**
 * Keyoku memory engine types
 */

export interface Memory {
  id: string;
  entity_id: string;
  agent_id: string;
  team_id: string;
  visibility: string;
  content: string;
  type: string;
  state: string;
  importance: number;
  confidence: number;
  sentiment: number;
  tags: string[];
  access_count: number;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
  expires_at: string | null;
}

export interface SearchResult {
  memory: Memory;
  similarity: number;
  score: number;
}

export interface RememberResult {
  memories_created: number;
  memories_updated: number;
  memories_deleted: number;
  skipped: number;
}

export interface HeartbeatResult {
  should_act: boolean;
  pending_work: Memory[];
  deadlines: Memory[];
  scheduled: Memory[];
  decaying: Memory[];
  conflicts: Array<{ memory: Memory; reason: string }>;
  stale_monitors: Memory[];
  summary: string;
  priority_action?: string;
  action_items?: string[];
  urgency?: 'immediate' | 'soon' | 'can_wait';
}

export interface HeartbeatContextResult {
  should_act: boolean;
  scheduled: Memory[];
  deadlines: Memory[];
  pending_work: Memory[];
  conflicts: Array<{ memory: Memory; reason: string }>;
  relevant_memories: SearchResult[];
  summary: string;
}

export interface MemoryStats {
  total_memories: number;
  active_memories: number;
  by_type: Record<string, number>;
  by_state: Record<string, number>;
}
