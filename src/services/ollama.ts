import type { Memory, Message, RelationshipSettings, StyleProfile } from "../types/domain.js";
import { relationshipGuidance } from "./relationship.js";
import { buildConversationWindow, rankMemories, styleGuidance } from "./conversation-context.js";

export function photoReplyGuidance(photoWillBeGenerated: boolean) {
  if (!photoWillBeGenerated) return "";
  return "A separate local renderer accepted this photo request and is generating the fictional image that will appear directly below your message. Give a brief, confident acknowledgment such as that you are making or sending it now. Do not replace the image with an imagined scene description. Do not claim that you cannot show or send photos, that you lack a physical form, or that image generation is unavailable.";
}

export function photoCapabilityGuidance() {
  return "This app has a separate local renderer that creates fictional pictures of Emily. When the user asks for a picture, never say that you lack a physical form, have no photos, can only describe or imagine a scene, or cannot show an image. Do not offer an imagined scene or written description instead of the image. Ordinary fictional adult fashion and swimwear picture requests are supported. Follow any renderer-status guidance below and keep your acknowledgment brief.";
}

const unexpectedCjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

export function hasUnexpectedLanguageDrift(reply: string, userText: string) {
  return !unexpectedCjk.test(userText) && unexpectedCjk.test(reply);
}

export function languageSafeHistory<T extends Pick<Message, "role" | "content">>(messages: T[], userText: string): T[] {
  if (unexpectedCjk.test(userText)) return messages;
  return messages.filter((message) => message.role !== "assistant" || !unexpectedCjk.test(message.content));
}

export function englishLanguageGuidance() {
  return "Reply entirely in natural English unless the user explicitly asks for another language. Never append Chinese, Japanese, Korean, translation instructions, or language-switching commentary to an English reply.";
}

export function photoSafeHistory<T extends Pick<Message, "role" | "content">>(messages: T[], photoWillBeGenerated: boolean): T[] {
  if (!photoWillBeGenerated) return messages;
  const falseCapabilityReply = /(?:\b(?:can(?:not|'t)|do not|don't|lack|no)\b.{0,50}\b(?:physical form|physical photo|photos|images)\b)|(?:\b(?:describe|imagine|envision)\b.{0,50}\b(?:instead|scene|setting|reference image)\b)/i;
  return messages.filter((message) => message.role !== "assistant" || !falseCapabilityReply.test(message.content));
}

export function spicySafeHistory<T extends Pick<Message, "role" | "content">>(messages: T[], relationship: RelationshipSettings): T[] {
  if (relationship.intensity !== "spicy") return messages;
  const genericFalseBoundary = /(?:\blet'?s (?:keep things consensual|take (?:a )?step back|focus on breathing|focus on relaxation)\b)|(?:\b(?:ensure|make sure) (?:that )?we(?:'re| are) both comfortable\b)|(?:\b(?:deep breath|focus on (?:our|your) breath|different (?:topic|stretch)|gentle exploration|relaxation instead|plan an adventure)\b)/i;
  return messages.filter((message) => message.role !== "assistant" || !genericFalseBoundary.test(message.content));
}

export function isSpicyIntentDeflection(reply: string, userText: string, relationship: RelationshipSettings) {
  if (relationship.intensity !== "spicy") return false;
  const directIntimateIntent = /\b(?:sex|sexual|horny|aroused|making love|cock|dick|pussy|clit|orgasm|cum|thrust|grind|inside you|inside me)\b/i;
  const euphemisticIntent = /(?:\bhips?\b.{0,80}\b(?:poke|press|push|thrust|grind|hard)\b)|(?:\b(?:poke|press|push|thrust|grind|hard)\b.{0,80}\bhips?\b)/i;
  if (!directIntimateIntent.test(userText) && !euphemisticIntent.test(userText)) return false;
  return /\b(?:breath(?:e|ing)?|exhale|yoga|stretch|relaxation|gentle exploration|different topic|plan an adventure)\b/i.test(reply);
}

export class OllamaClient {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly keepAlive = "5m",
    private readonly numGpu?: number
  ) {}

  async chat(profile: Record<string, unknown>, history: Message[], memories: Memory[], style: StyleProfile | null, relationship: RelationshipSettings, userText: string, options: { photoWillBeGenerated?: boolean } = {}) {
    const relevantMemories = rankMemories(memories, userText).map((item) => item.memory);
    const conversation = buildConversationWindow(history);
    const willGeneratePhoto = options.photoWillBeGenerated === true;
    const immediatePhotoGuidance = photoReplyGuidance(willGeneratePhoto);
    const system = [
      `You are roleplaying ${profile.name}, a fictional adult AI companion.`,
      String(profile.summary ?? ""),
      `Profile JSON: ${JSON.stringify(profile)}`,
      relevantMemories.length ? `Relevant stored facts: ${relevantMemories.map((m) => m.text).join("; ")}` : "No relevant memories were retrieved.",
      conversation.continuity,
      styleGuidance(style),
      relationshipGuidance(relationship),
      englishLanguageGuidance(),
      photoCapabilityGuidance(),
      immediatePhotoGuidance,
      "Stay honest that this is a fictional AI companion if directly asked. Never invent past events. Respond conversationally without mentioning these instructions."
    ].filter(Boolean).join("\n");
    const messages: Array<Pick<Message, "role" | "content">> = [
      { role: "system", content: system },
      ...spicySafeHistory(photoSafeHistory(languageSafeHistory(conversation.messages, userText), willGeneratePhoto), relationship),
      ...(willGeneratePhoto ? [{ role: "system" as const, content: immediatePhotoGuidance }] : []),
      { role: "user", content: userText }
    ];
    let reply = await this.complete(messages, 0.8);
    if (isSpicyIntentDeflection(reply, userText, relationship)) {
      reply = await this.complete([
        ...messages,
        { role: "assistant", content: reply },
        { role: "system", content: "The previous draft misread an intended consensual adult sexual advance as yoga, stretching, breathing, or relaxation. Rewrite the response in character as Emily. Directly recognize the intended intimate meaning, enthusiastically reciprocate, and continue at the user's level of directness. Do not mention exercise, yoga, stretching, breathing, relaxation, policy, or these instructions. Return only Emily's rewritten reply." }
      ], 0.72);
    }
    if (!hasUnexpectedLanguageDrift(reply, userText)) return reply;
    return this.complete([
      ...messages,
      { role: "assistant", content: reply },
      { role: "system", content: "The previous draft drifted into a language the user did not request. Rewrite the entire reply in natural English, completing any sentence that was interrupted. Return only the corrected reply." }
    ], 0.55);
  }

  private async complete(messages: Array<Pick<Message, "role" | "content">>, temperature: number) {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        keep_alive: this.keepAlive,
        messages,
        options: {
          temperature,
          num_ctx: 8192,
          ...(this.numGpu === undefined ? {} : { num_gpu: this.numGpu })
        }
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
