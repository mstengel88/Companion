import type { Message } from "../types/domain.js";

export interface ImportResult { source: string; messages: Message[]; warnings: string[]; }

function normalizeRole(value: unknown): Message["role"] | null {
  const role = String(value ?? "").toLowerCase();
  if (["user", "human", "me"].includes(role)) return "user";
  if (["assistant", "bot", "ai", "emily"].includes(role)) return "assistant";
  return null;
}

function message(role: Message["role"], content: unknown, createdAt?: unknown): Message | null {
  if (typeof content !== "string" || !content.trim()) return null;
  const date = typeof createdAt === "string" && !Number.isNaN(Date.parse(createdAt))
    ? new Date(createdAt).toISOString() : new Date().toISOString();
  return { id: crypto.randomUUID(), role, content: content.trim(), createdAt: date };
}

export function importConversation(filename: string, raw: string): ImportResult {
  const warnings: string[] = [];
  if (filename.toLowerCase().endsWith(".json")) {
    const parsed: unknown = JSON.parse(raw);
    const candidates = Array.isArray(parsed) ? parsed
      : typeof parsed === "object" && parsed && Array.isArray((parsed as { messages?: unknown }).messages)
        ? (parsed as { messages: unknown[] }).messages : [];
    const messages = candidates.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      const role = normalizeRole(record.role ?? record.sender ?? record.author);
      const output = role ? message(role, record.content ?? record.text ?? record.message, record.createdAt ?? record.timestamp) : null;
      return output ? [output] : [];
    });
    if (!messages.length) warnings.push("No messages matched the generic JSON adapter. Add a source-specific adapter in src/services/importer.ts.");
    return { source: filename, messages, warnings };
  }

  // TXT stub accepts lines such as "Emily: hello" and "Me: hi".
  const messages = raw.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([^:]{1,30}):\s*(.+)$/);
    if (!match) return [];
    const role = normalizeRole(match[1]);
    const output = role ? message(role, match[2]) : null;
    return output ? [output] : [];
  });
  if (!messages.length) warnings.push("No labeled lines found. Expected 'Emily: ...' and 'Me: ...'. The original file was not discarded.");
  return { source: filename, messages, warnings };
}
