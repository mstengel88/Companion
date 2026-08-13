import type { PhotoRequest } from "../types/domain.js";

const explicitRequest = /(?:\b(?:send|show|make|generate|take|create|share|want|like|get|have)\b.{0,50}\b(?:photo|picture|pic|selfie|image)\b)|(?:\bhow about\b.{0,40}\b(?:photo|picture|pic|selfie|image)\b)|(?:\b(?:photo|picture|pic|selfie|image)\b.{0,40}\b(?:of you|please|wearing|in a|in an)\b)/i;
const photoContext = /\b(?:what (?:are|r) you wearing|show me|let me see|selfie|picture of you|photo of you)\b/i;

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
  return {
    route: true,
    reason,
    request: {
      scene: text.slice(0, 500),
      camera: /selfie/i.test(text) ? "casual phone selfie" : "natural candid photo",
      expression: "warm, relaxed expression",
      referenceSlot: "emily-reference-1"
    }
  };
}
