import { createHash } from "node:crypto";
import type { Message } from "../types/domain.js";

export interface ImportResult {
  source: string;
  adapter: "json" | "html" | "text";
  messages: Message[];
  warnings: string[];
}

function normalizeRole(value: unknown): Message["role"] | null {
  const candidate = value && typeof value === "object" ? (value as Record<string, unknown>).role ?? (value as Record<string, unknown>).name : value;
  const role = String(candidate ?? "").trim().toLowerCase();
  if (["user", "human", "me", "customer"].includes(role)) return "user";
  if (["assistant", "bot", "ai", "emily", "character"].includes(role)) return "assistant";
  return null;
}

function contentText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    const combined = value.map(contentText).filter(Boolean).join("\n").trim();
    return combined || null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return contentText(record.parts ?? record.text ?? record.content ?? record.value);
  }
  return null;
}

function normalizeDate(value: unknown, fallbackIndex: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value < 10_000_000_000 ? value * 1000 : value;
    return new Date(milliseconds).toISOString();
  }
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  // A deterministic fallback makes repeat imports deduplicable while preserving order.
  return new Date(fallbackIndex * 1000).toISOString();
}

function stableMessage(role: Message["role"], content: string, createdAt: string, occurrence: number): Message {
  const digest = createHash("sha256").update(`${role}\u0000${content}\u0000${createdAt}\u0000${occurrence}`).digest("hex").slice(0, 24);
  return { id: `import-${digest}`, role, content, createdAt };
}

function recordMessage(record: Record<string, unknown>, index: number): Message | null {
  // Wrapper nodes in mapping-based exports are traversed separately; parsing both
  // wrapper and nested message would duplicate every entry.
  if (record.message && typeof record.message === "object") return null;
  const role = normalizeRole(record.role ?? record.sender ?? record.author ?? record.from);
  const content = contentText(record.content ?? record.text ?? record.message ?? record.body);
  if (!role || !content) return null;
  const createdAt = normalizeDate(record.createdAt ?? record.create_time ?? record.timestamp ?? record.date, index);
  return stableMessage(role, content, createdAt, index);
}

function jsonMessages(parsed: unknown) {
  const records: Record<string, unknown>[] = [];
  const seen = new Set<object>();
  function visit(value: unknown) {
    if (!value || typeof value !== "object" || seen.has(value as object)) return;
    seen.add(value as object);
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const record = value as Record<string, unknown>;
    if (recordMessage(record, records.length)) records.push(record);
    Object.values(record).forEach(visit);
  }
  visit(parsed);
  return records.map((record, index) => recordMessage(record, index)).filter((message): message is Message => Boolean(message));
}

function decodeHtml(value: string) {
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (match, name) => entities[name.toLowerCase()] ?? match);
}

function labeledTextMessages(raw: string) {
  const messages: Message[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([^:]{1,40}):\s*(.+)$/);
    if (!match) continue;
    const role = normalizeRole(match[1]);
    const content = match[2]?.trim();
    if (role && content) messages.push(stableMessage(role, content, normalizeDate(undefined, messages.length), messages.length));
  }
  return messages;
}

function alternatingTextMessages(raw: string) {
  const blocks = raw.split(/\r?\n\s*\r?\n/).map((block) => block.trim()).filter(Boolean);
  if (blocks.length < 6 || blocks.some((block) => block.length > 4000)) return [];
  return blocks.map((content, index) => stableMessage(index % 2 === 0 ? "user" : "assistant", content, normalizeDate(undefined, index), index));
}

function htmlMessages(raw: string) {
  const messages: Message[] = [];
  const roleBlocks = /<([a-z][\w-]*)\b[^>]*(?:data-role|data-message-author-role)=["'](user|assistant|human|bot|me|emily)["'][^>]*>([\s\S]*?)<\/\1>/gi;
  for (const match of raw.matchAll(roleBlocks)) {
    const role = normalizeRole(match[2]);
    const content = decodeHtml((match[3] ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (role && content) messages.push(stableMessage(role, content, normalizeDate(undefined, messages.length), messages.length));
  }
  if (messages.length) return messages;
  const text = decodeHtml(raw.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<\/(?:p|div|li|article|section)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""));
  return labeledTextMessages(text);
}

export function importConversation(filename: string, raw: string): ImportResult {
  const lower = filename.toLowerCase();
  const warnings: string[] = [];
  let adapter: ImportResult["adapter"];
  let messages: Message[];
  if (lower.endsWith(".json")) {
    adapter = "json";
    messages = jsonMessages(JSON.parse(raw));
  } else if (lower.endsWith(".html") || lower.endsWith(".htm")) {
    adapter = "html";
    messages = htmlMessages(raw);
  } else {
    adapter = "text";
    messages = labeledTextMessages(raw);
    if (!messages.length) {
      messages = alternatingTextMessages(raw);
      if (messages.length) warnings.push("Parsed unlabeled paragraphs as alternating user and assistant turns, beginning with the user.");
    }
  }
  if (!messages.length) warnings.push("No supported messages were recognized. The original file was retained so a source-specific adapter can be added later.");
  return { source: filename, adapter, messages, warnings };
}
