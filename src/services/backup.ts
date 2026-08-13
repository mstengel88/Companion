import { z } from "zod";
import type { AppState, Memory, Message } from "../types/domain.js";

const messageSchema = z.object({
  id: z.string().min(1), role: z.enum(["user", "assistant", "system"]), content: z.string(),
  createdAt: z.string(), photoId: z.string().optional()
});
const memorySchema = z.object({
  id: z.string().min(1), text: z.string().min(1), source: z.enum(["chat", "import", "manual"]),
  confidence: z.number().min(0).max(1), tags: z.array(z.string()), createdAt: z.string()
});
const backupSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  appVersion: z.string(),
  state: z.object({
    messages: z.array(messageSchema),
    memories: z.array(memorySchema),
    photos: z.array(z.unknown()).default([]),
    references: z.array(z.unknown()).default([]),
    style: z.unknown().nullable().optional(),
    relationship: z.unknown().optional(),
    proactive: z.unknown().optional()
  })
});

export type BackupEnvelope = z.infer<typeof backupSchema>;

export function createBackup(state: AppState, appVersion: string): BackupEnvelope {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion,
    state: {
      messages: state.messages,
      memories: state.memories,
      photos: state.photos,
      references: state.references,
      style: state.style,
      relationship: state.relationship,
      proactive: state.proactive
    }
  };
}

export function parseBackup(raw: string) {
  return backupSchema.parse(JSON.parse(raw));
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  const ids = new Set(current.map((item) => item.id));
  const added = incoming.filter((item) => !ids.has(item.id));
  return { merged: [...current, ...added], added: added.length, skipped: incoming.length - added.length };
}

export function mergeBackup(current: AppState, backup: BackupEnvelope) {
  const messages = mergeById<Message>(current.messages, backup.state.messages);
  const memories = mergeById<Memory>(current.memories, backup.state.memories);
  return {
    state: {
      ...current,
      messages: messages.merged,
      memories: memories.merged
    },
    report: {
      messagesAdded: messages.added,
      messagesSkipped: messages.skipped,
      memoriesAdded: memories.added,
      memoriesSkipped: memories.skipped,
      photoMetadataPresent: backup.state.photos.length,
      referenceMetadataPresent: backup.state.references.length,
      note: "Photo and reference metadata were inspected but not restored because their binary files are not part of JSON backups. Current settings were preserved."
    }
  };
}
