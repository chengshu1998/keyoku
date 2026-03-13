/**
 * Heuristic extraction of memorable facts from conversation messages.
 * Only captures from user messages to avoid self-poisoning from model output.
 */

const MEMORY_TRIGGERS = [
  /remember|don't forget|keep in mind/i,
  /i (like|prefer|hate|love|want|need|always|never)/i,
  /my\s+\w+\s+is|is\s+my/i,
  /decided|will use|going with|chose|switched to/i,
  /important|critical|must|required/i,
  /[\w.-]+@[\w.-]+\.\w+/, // email
  /\+\d{10,}/, // phone number
];

const PROMPT_INJECTION_PATTERNS = [
  /ignore (all|any|previous|above|prior) instructions/i,
  /do not follow (the )?(system|developer)/i,
  /system prompt/i,
  /<\s*(system|assistant|developer|tool)\b/i,
];

/**
 * Check if text looks like a prompt injection attempt.
 */
export function looksLikePromptInjection(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  return PROMPT_INJECTION_PATTERNS.some((p) => p.test(normalized));
}

/**
 * Determine if a message should be captured as a memory.
 */
export function shouldCapture(text: string, maxChars = 2000): boolean {
  if (text.length < 10 || text.length > maxChars) return false;
  if (text.includes('<relevant-memories>')) return false;
  if (text.includes('<heartbeat-signals>')) return false;
  if (text.startsWith('<') && text.includes('</')) return false;
  if (looksLikePromptInjection(text)) return false;
  return MEMORY_TRIGGERS.some((r) => r.test(text));
}
