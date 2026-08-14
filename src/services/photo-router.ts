import type { PhotoRequest } from "../types/domain.js";

const explicitRequest = /(?:\b(?:send|show|make|generate|take|create|share|want|like|get|have)\b.{0,50}\b(?:photo|picture|pic|selfie|image)\b)|(?:\bhow about\b.{0,40}\b(?:photo|picture|pic|selfie|image)\b)|(?:\b(?:photo|picture|pic|selfie|image)\b.{0,40}\b(?:of you|please|wearing|in a|in an)\b)/i;
const photoContext = /\b(?:what (?:are|r) you wearing|show me|let me see|selfie|picture of you|photo of you)\b/i;

const namedPoseDetails: Array<[RegExp, string]> = [
  [/\bcat (?:yoga )?pose\b/i, "yoga cat pose (Marjaryasana): on hands and knees in a tabletop position, palms flat below the shoulders, knees below the hips, spine rounded upward and head lowered; full body visible; not sitting upright"],
  [/\bcow (?:yoga )?pose\b/i, "yoga cow pose (Bitilasana): on hands and knees in a tabletop position, belly lowered, chest lifted and head raised; full body visible; not sitting upright"],
  [/\bdownward(?:-facing)? dog(?: pose)?\b/i, "downward-facing dog yoga pose: hands and feet on the floor, hips raised high in an inverted V; full body visible"],
  [/\bchild(?:'s|s)? pose\b/i, "child's yoga pose: kneeling with hips toward heels, torso folded forward and arms extended on the floor; full body visible"],
  [/\bwarrior (?:one|1)\b/i, "Warrior I yoga pose: standing lunge with front knee bent, rear leg straight and both arms raised overhead; full body visible"],
  [/\bwarrior (?:two|2)\b/i, "Warrior II yoga pose: wide standing lunge with arms extended horizontally in opposite directions; full body visible"]
];

export function extractRequestedPose(text: string) {
  const named = namedPoseDetails.find(([pattern]) => pattern.test(text));
  if (named) return named[1];
  const explicit = text.match(/\b(?:in|doing|do|show(?:ing)?(?: me)?)\s+(?:the\s+|a\s+)?([a-z][a-z -]{1,60}?\s+pose)\b/i);
  return explicit?.[1]?.trim();
}

export interface RoutingDecision {
  route: boolean;
  reason: "explicit-request" | "contextual-request" | "none" | "cooldown" | "disabled";
  request?: PhotoRequest;
}

export function routePhotoRequest(
  text: string,
  options: { enabled: boolean; lastPhotoAt?: string | null; cooldownMinutes: number; now?: Date }
): RoutingDecision {
  if (!options.enabled) return { route: false, reason: "disabled" };
  const reason = explicitRequest.test(text) ? "explicit-request" : photoContext.test(text) ? "contextual-request" : "none";
  if (reason === "none") return { route: false, reason };
  const now = options.now ?? new Date();
  // Cooldown limits inferred/contextual photos, never a picture the user
  // directly asked the renderer to make.
  if (reason === "contextual-request" && options.lastPhotoAt) {
    const elapsed = now.getTime() - new Date(options.lastPhotoAt).getTime();
    if (elapsed < options.cooldownMinutes * 60_000) return { route: false, reason: "cooldown" };
  }
  const pose = extractRequestedPose(text);
  return {
    route: true,
    reason,
    request: {
      scene: text.slice(0, 500),
      pose,
      camera: /selfie/i.test(text) ? "casual phone selfie" : pose ? "full-body natural candid photo with the entire pose visible" : "natural candid photo",
      expression: "warm, relaxed expression",
      referenceSlot: "emily-reference-1"
    }
  };
}
