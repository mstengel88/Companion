import type { Memory, Message, StyleProfile } from "../types/domain.js";

const memoryPatterns = [
  /\b(?:i (?:love|like|prefer|hate)|my favorite)\b[^.!?]*/gi,
  /\b(?:i work|i live|i grew up|my birthday|remember that)\b[^.!?]*/gi
];

export function extractMemoryCandidates(text: string, source: Memory["source"]): Memory[] {
  const seen = new Set<string>();
  const output: Memory[] = [];
  for (const pattern of memoryPatterns) {
    for (const match of text.matchAll(pattern)) {
      const value = match[0]?.trim();
      if (!value || value.length < 8 || seen.has(value.toLowerCase())) continue;
      seen.add(value.toLowerCase());
      output.push({
        id: crypto.randomUUID(), text: value, source, confidence: 0.65,
        tags: ["candidate"], createdAt: new Date().toISOString()
      });
    }
  }
  return output;
}

export function extractStyle(messages: Pick<Message, "content">[]): StyleProfile {
  const samples = messages.map((m) => m.content.trim()).filter(Boolean);
  const words = samples.reduce((n, s) => n + s.split(/\s+/).length, 0);
  const emoji = samples.filter((s) => /\p{Extended_Pictographic}/u.test(s)).length;
  const questions = samples.filter((s) => s.includes("?")).length;
  const openerCounts = new Map<string, number>();
  for (const sample of samples) {
    const opener = sample.split(/\s+/).slice(0, 2).join(" ").toLowerCase();
    if (opener) openerCounts.set(opener, (openerCounts.get(opener) ?? 0) + 1);
  }
  return {
    sampleCount: samples.length,
    averageWords: samples.length ? Number((words / samples.length).toFixed(1)) : 0,
    emojiRate: samples.length ? Number((emoji / samples.length).toFixed(2)) : 0,
    questionRate: samples.length ? Number((questions / samples.length).toFixed(2)) : 0,
    commonOpeners: [...openerCounts].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([x]) => x),
    updatedAt: new Date().toISOString()
  };
}

// Hook for a future semantic extractor. Keeping this interface stable lets a local
// LLM or embedding pipeline replace the deterministic implementation later.
export interface SemanticExtractor {
  memories(messages: Message[]): Promise<Memory[]>;
  style(messages: Message[]): Promise<StyleProfile>;
}
