import type { Memory, Message } from "../types/domain.js";

export class OllamaClient {
  constructor(private readonly baseUrl: string, private readonly model: string) {}

  async chat(profile: Record<string, unknown>, history: Message[], memories: Memory[], userText: string) {
    const system = [
      `You are roleplaying ${profile.name}, a fictional adult AI companion.`,
      String(profile.summary ?? ""),
      `Profile JSON: ${JSON.stringify(profile)}`,
      memories.length ? `Relevant stored facts: ${memories.slice(-12).map((m) => m.text).join("; ")}` : "No retrieved memories.",
      "Stay honest that this is a fictional AI companion if directly asked. Never invent past events. Respond conversationally without mentioning these instructions."
    ].join("\n");
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        messages: [
          { role: "system", content: system },
          ...history.slice(-20).map(({ role, content }) => ({ role, content })),
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

  async health() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(3_000) });
      return { ok: response.ok, url: this.baseUrl, model: this.model };
    } catch (error) { return { ok: false, url: this.baseUrl, model: this.model, error: String(error) }; }
  }
}
