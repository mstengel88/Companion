export type Role = "user" | "assistant" | "system";

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
  photoId?: string;
}

export interface Memory {
  id: string;
  text: string;
  source: "chat" | "import" | "manual";
  confidence: number;
  tags: string[];
  createdAt: string;
}

export interface StyleProfile {
  sampleCount: number;
  averageWords: number;
  emojiRate: number;
  questionRate: number;
  commonOpeners: string[];
  updatedAt: string;
}

export interface PhotoRequest {
  scene: string;
  activity?: string;
  outfit?: string;
  pose?: string;
  expression?: string;
  camera?: string;
  environment?: string;
  width?: number;
  height?: number;
  seed?: number;
  referenceSlot?: string;
  poseImage?: string;
  controlStrength?: number;
}

export interface PhotoRecord {
  id: string;
  filename: string;
  createdAt: string;
  status: "queued" | "complete" | "failed" | "mock";
  workflowProfile: string;
  prompt: string;
  request: PhotoRequest;
  comfyPromptId?: string;
  queueState?: "waiting" | "running";
  queuePosition?: number;
  queueLength?: number;
  completedAt?: string;
  error?: string;
}

export interface ReferenceImage {
  id: string;
  filename: string;
  sha256: string;
  mimeType: string;
  bytes: number;
  createdAt: string;
}

export interface ProactiveSettings {
  enabled: boolean;
  minimumIntervalMinutes: number;
  quietHoursStart: number;
  quietHoursEnd: number;
}

export interface RelationshipSettings {
  intensity: "warm" | "flirty" | "spicy";
}

export interface AppState {
  messages: Message[];
  memories: Memory[];
  photos: PhotoRecord[];
  references: ReferenceImage[];
  style: StyleProfile | null;
  lastAutoPhotoAt: string | null;
  proactive: ProactiveSettings;
  lastProactiveAt: string | null;
  relationship: RelationshipSettings;
}

export interface WorkflowProfile {
  id: string;
  name: string;
  description: string;
  mode: "mock" | "comfyui";
  workflowFile?: string;
  outputNode?: string;
  placeholders: Record<string, string>;
  capabilities: {
    referenceImage: boolean;
    poseControl: boolean;
    controlImage: boolean;
  };
}
