import type { AppState, PhotoRecord, ReferenceImage } from "../types/domain.js";

export function clearConversation(state: AppState, clearedAt = new Date().toISOString()) {
  const removed = state.messages.length;
  state.messages = [];
  state.lastProactiveAt = clearedAt;
  return removed;
}

export function clearMemories(state: AppState) {
  const removed = state.memories.length;
  state.memories = [];
  return removed;
}

export function clearStyle(state: AppState) {
  const removed = state.style !== null;
  state.style = null;
  return removed;
}

export function removePhoto(state: AppState, id: string): PhotoRecord | undefined {
  const record = state.photos.find((photo) => photo.id === id);
  if (!record) return undefined;
  state.photos = state.photos.filter((photo) => photo.id !== id);
  for (const message of state.messages) {
    if (message.photoId === id) delete message.photoId;
  }
  return record;
}

export function removeReference(state: AppState, id: string): ReferenceImage | undefined {
  const record = state.references.find((reference) => reference.id === id);
  if (!record) return undefined;
  state.references = state.references.filter((reference) => reference.id !== id);
  return record;
}

export function retryablePhoto(state: AppState, id: string): PhotoRecord | undefined {
  const record = state.photos.find((photo) => photo.id === id);
  return record && (record.status === "failed" || record.status === "mock") ? record : undefined;
}

export function photoVariation(state: AppState, id: string, seed: number): PhotoRecord["request"] | undefined {
  const record = state.photos.find((photo) => photo.id === id);
  return record ? { ...record.request, seed } : undefined;
}
