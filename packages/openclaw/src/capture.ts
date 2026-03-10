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
  /[\w.-]+@[\w.-]+\.\w+/,  // email
  /\+\d{10,}/,              // phone number
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
  if (text.includes('<keyoku-heartbeat>')) return false;
  if (text.startsWith('<') && text.includes('</')) return false;
  if (looksLikePromptInjection(text)) return false;
  return MEMORY_TRIGGERS.some((r) => r.test(text));
}

/**
 * Extract capturable text segments from conversation messages.
 * Only processes user messages to avoid self-poisoning.
 */
export function extractCapturableTexts(messages: unknown[], maxChars = 2000): string[] {
  const texts: string[] = [];

  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue;
    const msgObj = msg as Record<string, unknown>;

    // Only capture from user messages
    if (msgObj.role !== 'user') continue;

    const content = msgObj.content;
    if (typeof content === 'string') {
      if (shouldCapture(content, maxChars)) texts.push(content);
      continue;
    }

    if (Array.isArray(content)) {
      for (const block of content) {
        if (
          block &&
          typeof block === 'object' &&
          'type' in block &&
          (block as Record<string, unknown>).type === 'text' &&
          'text' in block &&
          typeof (block as Record<string, unknown>).text === 'string'
        ) {
          const text = (block as Record<string, unknown>).text as string;
          if (shouldCapture(text, maxChars)) texts.push(text);
        }
      }
    }
  }

  return texts;
}
