import type { AppState, Message, ProactiveSettings } from "../types/domain.js";

export function isQuietHour(hour: number, settings: ProactiveSettings) {
  const { quietHoursStart: start, quietHoursEnd: end } = settings;
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

export function shouldSendProactive(state: AppState, now = new Date()) {
  if (!state.proactive.enabled || isQuietHour(now.getHours(), state.proactive)) return false;
  const anchor = state.lastProactiveAt ?? state.messages.at(-1)?.createdAt;
  if (!anchor) return true;
  const elapsed = now.getTime() - new Date(anchor).getTime();
  return elapsed >= state.proactive.minimumIntervalMinutes * 60_000;
}

export function proactivePrompt(history: Message[]) {
  const recent = history.slice(-6).map((message) => `${message.role}: ${message.content}`).join("\n");
  return [
    "Initiate one natural, low-pressure check-in with the user.",
    "Keep it brief and consistent with Emily's personality and the recent conversation.",
    "Do not pretend a real-world event occurred unless it exists in memory. Do not mention scheduling or automation.",
    recent ? `Recent conversation:\n${recent}` : "There is no recent conversation, so use a simple friendly greeting."
  ].join("\n");
}
