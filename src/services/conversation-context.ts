import type { Memory, Message, StyleProfile } from "../types/domain.js";

const stopWords = new Set(["about", "after", "again", "also", "and", "are", "but", "for", "from", "have", "how", "into", "just", "like", "that", "the", "their", "them", "then", "there", "they", "this", "was", "what", "when", "where", "which", "who", "will", "with", "would", "you", "your"]);

function tokens(text: string) {
  return new Set((text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []).filter((word) => word.length > 2 && !stopWords.has(word)));
}

export interface RankedMemory { memory: Memory; score: number; matchedTerms: string[]; }

export interface ConversationWindow {
  messages: Array<Pick<Message, "role" | "content">>;
  totalMessages: number;
  omittedMessages: number;
  includedCharacters: number;
  continuity: string;
}

function compactExcerpt(text: string, limit = 220) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1).trimEnd()}…`;
}

export function buildConversationWindow(history: Message[], maxMessages = 16, maxCharacters = 12_000): ConversationWindow {
  const eligible = history.filter((message) => message.role === "user" || message.role === "assistant");
  const selected: Message[] = [];
  let characters = 0;
  for (let index = eligible.length - 1; index >= 0 && selected.length < maxMessages; index--) {
    const message = eligible[index]!;
    if (selected.length && characters + message.content.length > maxCharacters) break;
    selected.unshift(message);
    characters += message.content.length;
  }
  const omitted = eligible.slice(0, eligible.length - selected.length);
  const continuity = omitted.length
    ? `Earlier conversation (${omitted.length} messages omitted from the live context), latest excerpts:\n${omitted.slice(-4).map((message) => `${message.role === "user" ? "User" : "Emily"}: ${compactExcerpt(message.content)}`).join("\n")}`
    : "No earlier conversation was omitted from the live context.";
  return {
    messages: selected.map(({ role, content }) => ({ role, content })),
    totalMessages: eligible.length,
    omittedMessages: omitted.length,
    includedCharacters: characters,
    continuity
  };
}

export function rankMemories(memories: Memory[], query: string, limit = 8): RankedMemory[] {
  const queryTokens = tokens(query);
  const now = Date.now();
  const ranked = memories.map((memory) => {
    const memoryTokens = tokens(`${memory.text} ${memory.tags.join(" ")}`);
    const matchedTerms = [...queryTokens].filter((term) => memoryTokens.has(term));
    const overlap = queryTokens.size ? matchedTerms.length / queryTokens.size : 0;
    const ageDays = Math.max(0, (now - Date.parse(memory.createdAt)) / 86_400_000);
    const recency = 1 / (1 + ageDays / 30);
    const score = overlap * 0.7 + memory.confidence * 0.2 + recency * 0.1;
    return { memory, score: Number(score.toFixed(4)), matchedTerms };
  }).sort((a, b) => b.score - a.score);
  const relevant = ranked.filter((item) => item.matchedTerms.length > 0);
  return (relevant.length ? relevant : ranked).slice(0, limit);
}

export function styleGuidance(style: StyleProfile | null) {
  if (!style || style.sampleCount < 2) return "No imported style profile is available; use Emily's character voice.";
  const emoji = style.emojiRate < 0.15 ? "rarely" : style.emojiRate < 0.5 ? "occasionally" : "often";
  const questions = style.questionRate < 0.2 ? "infrequently" : style.questionRate < 0.55 ? "sometimes" : "frequently";
  const target = Math.max(4, Math.round(style.averageWords));
  const openers = style.commonOpeners.length ? `Natural opening tendencies from the import: ${style.commonOpeners.join(", ")}. Do not repeat one mechanically.` : "";
  return `Imported writing-style guidance: aim near ${target} words when context permits; use emoji ${emoji}; ask a question ${questions}. ${openers}`.trim();
}
