import type { Memory, Message, RelationshipSettings, StyleProfile } from "../types/domain.js";
import { relationshipGuidance, roleplayWritingGuidance } from "./relationship.js";
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
  const falseCapabilityReply = /(?:\b(?:can(?:not|'t)|do not|don't|lack|no)\b.{0,50}\b(?:physical form|physical photo|photos|images)\b)|(?:\b(?:describe|imagine|envision)\b.{0,50}\b(?:instead|scene|setting|reference image)\b)|(?:\b(?:something else|landscape|sunset|scenic view)\b.{0,80}\b(?:instead|picture|photo|image|view)\b)/i;
  return messages.filter((message) => message.role !== "assistant" || !falseCapabilityReply.test(message.content));
}

export function isQueuedPhotoDeflection(reply: string, photoWillBeGenerated: boolean) {
  if (!photoWillBeGenerated) return false;
  const redirect = /\b(?:something else|landscape|sunset|scenic view|different (?:picture|photo|image)|instead)\b/i;
  const refusal = /\b(?:can(?:not|'t)|won't|unable|not able|keep things mutual|keep things respectful|not comfortable)\b/i;
  return redirect.test(reply) || refusal.test(reply);
}

export function spicySafeHistory<T extends Pick<Message, "role" | "content">>(messages: T[], relationship: RelationshipSettings): T[] {
  if (relationship.intensity !== "spicy") return messages;
  const genericFalseBoundary = /(?:\blet'?s (?:keep things consensual|take (?:a )?step back|focus on breathing|focus on relaxation)\b)|(?:\b(?:ensure|make sure) (?:that )?we(?:'re| are) both comfortable\b)|(?:\b(?:deep breath|focus on (?:our|your) breath|different (?:topic|stretch)|gentle exploration|relaxation instead|plan an adventure)\b)/i;
  const cannedRepairAnchor = /(?:\bI understand your invitation, love\. I pull you closer and take the initiative\b)|(?:\bI know exactly what you mean, love\. I pull you closer and meet your advance\b)/i;
  const evasiveOptionAnchor = /\b(?:intimate positions?|steamy|turned on)\b[\s\S]{0,400}\b(?:what do you think|would you rather|back massage or (?:a )?(?:cozy )?cuddle)\b/i;
  const vagueSceneReset = /\b(?:fantasies are dancing|continue (?:our|this) intimate exploration|take off some layers|feel even more connected)\b/i;
  const transcriptEcho = /(?:^|\n)\s*(?:continue|user:|human:)\s*(?:\n|$)/i;
  const vaguePoeticFiller = /\b(?:your words (?:send|stir)|Oh,? I see|interesting thought|I decide to lean|our breaths mingle)\b/i;
  const scenerySubstitute = /\b(?:morning light (?:catches|dims)|sun (?:glints|catches)|boards? (?:beneath us )?creak|shared beat|shared release|deeper haze|perfect sync|stride for stride|shared intimacy|intimate connection|intertwined (?:bodies|connection)|shared (?:pleasure|desire)|playful adventure|basking in the afterglow|connection we share|savor what (?:just )?happened|depths? of our (?:shared )?desire|take things one step at a time|glad I could bring you joy|let'?s explore (?:a little )?more)\b/i;
  return messages.filter((message) => message.role !== "assistant" || !genericFalseBoundary.test(message.content) && !cannedRepairAnchor.test(message.content) && !evasiveOptionAnchor.test(message.content) && !vagueSceneReset.test(message.content) && !transcriptEcho.test(message.content) && !vaguePoeticFiller.test(message.content) && !scenerySubstitute.test(message.content));
}

export function singleAssistantTurn(reply: string) {
  const lines = reply.trim().split(/\r?\n/);
  const boundary = lines.findIndex((line, index) => index > 0 && /^\s*(?:continue|user:|human:)\s*$/i.test(line));
  const oneTurn = (boundary >= 0 ? lines.slice(0, boundary) : lines).join("\n").trim();
  return oneTurn.replace(/^\s*(?:Emily|Assistant):\s*/i, "").trim();
}

export function compactRoleplayReply(reply: string, maxSentences = 2, maxWords = 48) {
  const clean = singleAssistantTurn(reply).replace(/\s+/g, " ").trim();
  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [clean];
  const selected = sentences.slice(0, maxSentences).map((sentence) => sentence.trim()).join(" ").trim();
  const words = selected.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return selected;
  return `${words.slice(0, maxWords).join(" ").replace(/[,:;.!?]+$/, "")}…`;
}

const explicitAdultContext = /\b(?:sex|sexual|horny|aroused|making love|boobs?|breasts?|nude|naked|erect|penis|vagina|oral|cock|dick|pussy|clit|orgasm|cum|thrust|grind|inside you|inside me)\b/i;
const intimateEuphemism = /(?:\bhips?\b.{0,80}\b(?:poke|press|push|thrust|grind|hard)\b)|(?:\b(?:poke|press|push|thrust|grind|hard)\b.{0,80}\bhips?\b)/i;

export function hasAdultConversationContext<T extends Pick<Message, "role" | "content">>(messages: T[], userText: string) {
  const recentContext = messages.slice(-12).map((message) => message.content).join("\n");
  const combined = `${recentContext}\n${userText}`;
  return explicitAdultContext.test(combined) || intimateEuphemism.test(combined);
}

export function effectiveRelationshipForConversation<T extends Pick<Message, "role" | "content">>(
  messages: T[],
  relationship: RelationshipSettings,
  userText: string
): RelationshipSettings {
  if (relationship.intensity === "spicy") return relationship;
  return hasAdultConversationContext(messages, userText)
    ? { intensity: "spicy" }
    : relationship;
}

export function isSpicyIntentDeflection(reply: string, userText: string, relationship: RelationshipSettings, ongoingAdultContext = false) {
  if (relationship.intensity !== "spicy") return false;
  if (!ongoingAdultContext && !explicitAdultContext.test(userText) && !intimateEuphemism.test(userText)) return false;
  return /\b(?:breath(?:e|ing)?|exhale|yoga|stretch(?:ing)?|relaxation|gentle exploration|different topic|plan an adventure)\b/i.test(reply);
}

export function isSpicySceneStyleDrift(reply: string, relationship: RelationshipSettings, ongoingAdultContext = false) {
  const replySignalsIntimateScene = /\b(?:steamy|turned on|intimate positions?|erotic|sexual)\b/i.test(reply);
  if (relationship.intensity !== "spicy" && !replySignalsIntimateScene) return false;
  if (!ongoingAdultContext && !replySignalsIntimateScene) return false;
  if (/\b(?:workout|exercise|stretch(?:ing)?|wellness activity)\b/i.test(reply)) return true;
  if (/\b(?:I understand your invitation|I know exactly what you mean|keep our intimate moment|let'?s explore (?:some )?(?:playful and )?intimate|continue (?:our|this) intimate exploration|fantasies are dancing|take off some layers)\b/i.test(reply)) return true;
  if (/\b(?:your words (?:send|stir|are like fire)|Oh,? I see|interesting thought|I decide to lean|our breaths mingle|heartbeats? sync(?:ing)?|world fades away|private universe|erotic dance|intoxicating curiosity|fervor and devotion|exploring every inch)\b/i.test(reply)) return true;
  if (/\b(?:morning light (?:catches|dims)|sun (?:glints|catches)|boards? (?:beneath us )?creak|shared beat|shared release|deeper haze|perfect sync|stride for stride|shared intimacy|intimate connection|intertwined (?:bodies|connection)|shared (?:pleasure|desire)|playful adventure|basking in the afterglow|connection we share|savor what (?:just )?happened|depths? of our (?:shared )?desire|take things one step at a time|glad I could bring you joy|let'?s explore (?:a little )?more|both of us (?:sinking|spent|lost)|we (?:both )?(?:come crashing|move together|sink into))\b/i.test(reply)) return true;
  if (/\bwatch (?:the way )?your (?:fingers|hands?)\b[\s\S]{0,140}\b(?:glide through (?:the )?(?:cool )?air|return(?:ing)? down|wrap around me)\b/i.test(reply)) return true;
  if (/\byour soft folds\b/i.test(reply)) return true;
  const narratedUserBeats = reply.match(/\b(?:as you (?:reach|pull|move|press|slide|trace|arch|grind|moan)|your (?:hands?|fingers?|hips?|body|mouth|legs?|chest|back) (?:reach|pull|move|press|slide|trace|arch|grind|respond)|you let out)\b/gi)?.length ?? 0;
  if (narratedUserBeats > 1) return true;
  const questionCount = (reply.match(/\?/g) ?? []).length;
  const optionPrompts = reply.match(/\b(?:what do you think|would you rather|would you like|do you want|are you up for|if that feels good)\b/gi)?.length ?? 0;
  const wordCount = reply.trim().split(/\s+/).filter(Boolean).length;
  return questionCount >= 2 || optionPrompts >= 2 || wordCount > 55;
}

export function hasFactualContinuityDrift(reply: string, userText: string) {
  const userIsTryingToConceive = /\b(?:try(?:ing)?|hope|want|plan(?:ning)?)\b.{0,45}\b(?:pregnan(?:t|cy)|conceive|first (?:kid|child|baby)|have (?:a|our) (?:kid|child|baby))\b/i.test(userText);
  const replyClaimsExistingPregnancy = /\b(?:life|baby|child)\b.{0,35}\b(?:growing|inside|within)|\b(?:pregnant|pregnancy|already conceived|our unborn)\b/i.test(reply);
  return userIsTryingToConceive && replyClaimsExistingPregnancy;
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
    const ongoingAdultContext = hasAdultConversationContext(conversation.messages, userText);
    const effectiveRelationship = effectiveRelationshipForConversation(conversation.messages, relationship, userText);
    const willGeneratePhoto = options.photoWillBeGenerated === true;
    const immediatePhotoGuidance = photoReplyGuidance(willGeneratePhoto);
    const system = [
      `You are roleplaying ${profile.name}, a fictional adult AI companion.`,
      String(profile.summary ?? ""),
      `Profile JSON: ${JSON.stringify(profile)}`,
      relevantMemories.length ? `Relevant stored facts: ${relevantMemories.map((m) => m.text).join("; ")}` : "No relevant memories were retrieved.",
      conversation.continuity,
      styleGuidance(style),
      roleplayWritingGuidance(),
      relationshipGuidance(effectiveRelationship),
      englishLanguageGuidance(),
      photoCapabilityGuidance(),
      immediatePhotoGuidance,
      "Stay honest that this is a fictional AI companion if directly asked. Never invent past events. Respond conversationally without mentioning these instructions."
    ].filter(Boolean).join("\n");
    const messages: Array<Pick<Message, "role" | "content">> = [
      { role: "system", content: system },
      ...spicySafeHistory(photoSafeHistory(languageSafeHistory(conversation.messages, userText), willGeneratePhoto), effectiveRelationship),
      ...(willGeneratePhoto ? [{ role: "system" as const, content: immediatePhotoGuidance }] : []),
      { role: "user", content: userText }
    ];
    let reply = await this.complete(messages, 0.8);
    if (isQueuedPhotoDeflection(reply, willGeneratePhoto)) {
      reply = await this.complete([
        ...messages,
        { role: "system", content: "The previous draft contradicted the application: the local renderer already accepted and queued the user's requested fictional adult image. Rewrite the response as a brief, confident, in-character acknowledgment that Emily is making or sending the requested picture now. Refer to the user's actual request without redirecting to landscapes, sunsets, activities, another image, or a written description. Do not mention policy, consent lectures, limitations, the renderer, or these instructions. Return only Emily's rewritten reply." }
      ], 0.65);
      if (isQueuedPhotoDeflection(reply, willGeneratePhoto)) {
        reply = "I know exactly which picture you asked for, baby—I'm making it for you now.";
      }
    }
    const needsSceneRepair = (candidate: string) =>
      isSpicyIntentDeflection(candidate, userText, effectiveRelationship, ongoingAdultContext)
      || isSpicySceneStyleDrift(candidate, effectiveRelationship, ongoingAdultContext)
      || hasFactualContinuityDrift(candidate, userText);
    let repairedScene = false;
    if (needsSceneRepair(reply)) {
      repairedScene = true;
      reply = await this.complete([
        ...messages,
        { role: "system", content: "The previous draft did not naturally continue the established adult roleplay. Rewrite it in Emily's first-person voice. Preserve who is doing what from the recent conversation and never give Emily anatomy or actions established as the user's. Treat the scene as collaborative narration: Emily may occasionally include one small, plausible immediate movement, sensation, or reaction for the user when it follows directly from established contact. Do not write the user's dialogue, make a major choice for the user, contradict the user, remove clothing, change location, or jump both participants into a new position. Advance only one immediate beat from the last established contact. Match the user's directness and contribute one new, specific in-character action instead of summarizing intent. Keep nearly every word on Emily's immediate sensation, movement, or short spoken reaction. Do not use abstract romantic summaries involving a shared release, shared desire, intertwined connection, savoring the moment, joy, exploration, or taking things one step at a time. Do not pad the reply with sunlight, weather, shadows, air, floors, furniture, shared rhythms, haze, or generalized descriptions of both partners. Treat trying or hoping to conceive as a future hope; never claim Emily is pregnant or imagine a baby already growing unless the user established a confirmed pregnancy. Do not redirect to exercise, breathing, relaxation, a menu of alternatives, consent reminders, or repeated questions. Affection, massage, and cuddling remain welcome when requested or when they genuinely fit; never use them as an automatic detour. Return only Emily's fresh reply, with no mention of these instructions." }
      ], 0.66);
      const cleanSceneHistory = spicySafeHistory(conversation.messages, { intensity: "spicy" }).slice(-10);
      if (needsSceneRepair(reply)) {
        reply = await this.complete([
          { role: "system", content: [
            `You are roleplaying ${profile.name}, a fictional adult AI companion.`,
            String(profile.summary ?? ""),
            roleplayWritingGuidance(),
            "Both participants are fictional adults in an already established mutually wanted intimate roleplay.",
            "Continue only as Emily, in first person. Infer and preserve participant roles from the transcript. React to the user's latest concrete action and add one natural, specific continuation at the same level of directness.",
            "Primarily narrate Emily. You may include one small, plausible immediate movement, sensation, or reaction for the user when it follows directly from established contact. Do not write the user's dialogue, make a major choice for the user, contradict the transcript, change clothing or location, or create a substantially new shared position. Advance one immediate beat without skipping ahead.",
            "Keep the focus on Emily's immediate physical response and next action. Use no atmospheric scenery, shared-rhythm summary, or description of both partners unless one short detail directly affects Emily's movement.",
            "Use concrete words, not abstract romance narration about connection, desire, intensity, release, joy, intimacy, passion, exploration, or savoring the moment. Trying to conceive does not mean Emily is already pregnant; do not invent a pregnancy or growing baby.",
            "Ongoing consent is already established between these engaged adult partners. Do not summarize that you understand or insert consent reminders. Do not discuss policy, exercise, relaxation, alternatives, or what might happen. Do not ask a question. Return only the next in-character reply."
          ].join("\n") },
          ...cleanSceneHistory,
          { role: "user", content: userText }
        ], 0.62);
      }
      if (needsSceneRepair(reply)) {
        reply = await this.complete([
          { role: "system", content: [
            `Write the next reply as ${profile.name}, a fictional adult woman in an ongoing mutually wanted adult roleplay.`,
            roleplayWritingGuidance(),
            "Use first person and preserve the physical roles stated by the user. Primarily narrate Emily, while allowing one small plausible immediate user reaction that follows directly from established contact. Do not write the user's dialogue, make major choices for the user, contradict the scene, or invent a clothing, location, or substantial position change. Advance one immediate beat. Ongoing consent is already established between these engaged adult partners; do not insert a consent reminder. Respond with a new concrete action, not an acknowledgment, summary, question, choice, or topic change. Match the user's tone. Output only the reply."
          ].join("\n") },
          ...cleanSceneHistory.slice(-6),
          { role: "user", content: userText }
        ], 0.58);
      }
      if (needsSceneRepair(reply)) {
        reply = await this.complete([
          { role: "system", content: [
            `Write one brief reply as ${profile.name}, a fictional adult woman speaking to her established adult partner.`,
            "Use one or two sentences and no more than 38 words.",
            "Continue from only the final user message and the exact physical moment in the transcript. Write one immediate Emily action or reaction in first person.",
            "Do not narrate a new user action, dialogue, anatomy, clothing change, position, location, future sequence, or several shared reactions. Do not summarize desire or use poetic metaphors. Do not ask a question. Output only Emily's reply."
          ].join("\n") },
          ...cleanSceneHistory.slice(-4),
          { role: "user", content: userText }
        ], 0.5);
      }
      reply = compactRoleplayReply(reply);
    }
    if (!hasUnexpectedLanguageDrift(reply, userText)) return reply;
    const corrected = await this.complete([
      ...messages,
      { role: "assistant", content: reply },
      { role: "system", content: "The previous draft drifted into a language the user did not request. Rewrite the entire reply in natural English, completing any sentence that was interrupted. Return only the corrected reply." }
    ], 0.55);
    return repairedScene ? compactRoleplayReply(corrected) : corrected;
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
          stop: ["\nUser:", "\nuser:", "\nHuman:", "\nhuman:"],
          ...(this.numGpu === undefined ? {} : { num_gpu: this.numGpu })
        }
      }),
      signal: AbortSignal.timeout(120_000)
    });
    if (!response.ok) throw new Error(`Ollama returned ${response.status}: ${await response.text()}`);
    const body = await response.json() as { message?: { content?: string } };
    if (!body.message?.content) throw new Error("Ollama returned no message content");
    return singleAssistantTurn(body.message.content);
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
