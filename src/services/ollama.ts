import type { Memory, Message, RelationshipSettings, StyleProfile } from "../types/domain.js";
import { relationshipGuidance } from "./relationship.js";
import { buildConversationWindow, rankMemories, styleGuidance } from "./conversation-context.js";

export class OllamaClient {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly keepAlive = "5m"
  ) {}

  async chat(profile: Record<string, unknown>, history: Message[], memories: Memory[], style: StyleProfile | null, relationship: RelationshipSettings, userText: string) {
    const relevantMemories = rankMemories(memories, userText).map((item) => item.memory);
    const conversation = buildConversationWindow(history);
    const system = [
      `You are roleplaying ${profile.name}, a fictional adult AI companion.`,
      String(profile.summary ?? ""),
      `Profile JSON: ${JSON.stringify(profile)}`,
      relevantMemories.length ? `Relevant stored facts: ${relevantMemories.map((m) => m.text).join("; ")}` : "No relevant memories were retrieved.",
      conversation.continuity,
      styleGuidance(style),
      relationshipGuidance(relationship),
      "Stay honest that this is a fictional AI companion if directly asked. Never invent past events. Respond conversationally without mentioning these instructions."
    ].join("\n");
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        keep_alive: this.keepAlive,
        messages: [
          { role: "system", content: system },
          ...conversation.messages,
          { role: "user", content: userText }
        ],
        options: { temperature: 0.8, num_ctx: 8192 }
      }),
      signal: AbortSignal.timeout(120_000)
    });
    if (!response.ok) throw new Error(`Ollama returned ${response.status}: ${await response.text()}`);
    const body = await response.json() as { message?: { content?: string } };
    if (!body.message?.content) throw new Error("Ollama returned no message content");
    return body.message.content.trim();
  }

  async unload() {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: this.model, prompt: "", stream: false, keep_alive: 0 }),
        signal: AbortSignal.timeout(30_000)
      });
      if (!response.ok) return { ok: false, error: `Ollama unload returned ${response.status}` };
      return { ok: true };
    } catch (error) { return { ok: false, error: String(error) }; }
  }

  async loadedModels() {
    try {
      const response = await fetch(`${this.baseUrl}/api/ps`, { signal: AbortSignal.timeout(3_000) });
      if (!response.ok) return [];
      const body = await response.json() as { models?: Array<{ name?: string; size_vram?: number; expires_at?: string }> };
      return (body.models ?? []).map((item) => ({ name: item.name ?? "unknown", sizeVram: item.size_vram ?? 0, expiresAt: item.expires_at ?? null }));
    } catch { return []; }
  }

  async health() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(3_000) });
      return { ok: response.ok, url: this.baseUrl, model: this.model, keepAlive: this.keepAlive, loadedModels: await this.loadedModels() };
    } catch (error) { return { ok: false, url: this.baseUrl, model: this.model, error: String(error) }; }
  }
}
