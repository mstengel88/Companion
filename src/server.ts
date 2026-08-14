import "dotenv/config";
import express from "express";
import multer from "multer";
import { createHash, randomInt } from "node:crypto";
import { mkdir, readFile, readdir, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { JsonStore } from "./store/json-store.js";
import { extractMemoryCandidates, extractStyle } from "./services/extraction.js";
import { importConversation } from "./services/importer.js";
import { routePhotoRequest } from "./services/photo-router.js";
import { OllamaClient } from "./services/ollama.js";
import { ImageService } from "./services/comfyui.js";
import { InferenceCoordinator } from "./services/inference-coordinator.js";
import { proactivePrompt, shouldSendProactive } from "./services/proactive.js";
import { parseCookies, PinAuth } from "./services/auth.js";
import { buildConversationWindow, rankMemories, styleGuidance } from "./services/conversation-context.js";
import { createBackup, mergeBackup, parseBackup } from "./services/backup.js";
import { clearConversation, clearMemories, clearStyle, photoVariation, removePhoto, removeReference, retryablePhoto } from "./services/data-controls.js";
import type { Message, PhotoRequest, ReferenceImage, WorkflowProfile } from "./types/domain.js";

const root = process.cwd();
const dataDir = path.resolve(root, process.env.DATA_DIR ?? "data");
const refsDir = path.join(dataDir, "references");
const photosDir = path.join(dataDir, "photos");
const importsDir = path.join(dataDir, "imports");
const workflowsDir = path.join(root, "config", "workflows");
const profilePath = path.join(root, "config", "characters", "emily.json");
const store = new JsonStore(dataDir);
const ollamaNumGpuText = process.env.OLLAMA_NUM_GPU?.trim();
const ollamaNumGpu = ollamaNumGpuText ? Number(ollamaNumGpuText) : undefined;
if (ollamaNumGpu !== undefined && (!Number.isInteger(ollamaNumGpu) || ollamaNumGpu < 0)) {
  throw new Error("OLLAMA_NUM_GPU must be a non-negative integer when set.");
}
const ollama = new OllamaClient(
  process.env.OLLAMA_URL ?? "http://127.0.0.1:11434",
  process.env.OLLAMA_MODEL ?? "qwen2.5:7b",
  process.env.OLLAMA_KEEP_ALIVE ?? "5m",
  ollamaNumGpu
);
const images = new ImageService(process.env.COMFYUI_URL ?? "http://127.0.0.1:8188", root, refsDir, photosDir);
const gpuHandoff = process.env.GPU_HANDOFF === "off" ? "off" : "auto";
const inference = new InferenceCoordinator(ollama, gpuHandoff);
const authMode = process.env.AUTH_MODE === "pin" ? "pin" : "off";
const appPin = process.env.APP_PIN ?? "";
const authSecret = process.env.AUTH_SECRET ?? "";
if (authMode === "pin" && (appPin.length < 4 || authSecret.length < 32)) {
  throw new Error("PIN authentication requires APP_PIN with at least 4 characters and AUTH_SECRET with at least 32 characters.");
}
const pinAuth = authMode === "pin" ? new PinAuth(appPin, authSecret) : null;
const loginAttempts = new Map<string, { failures: number; lockedUntil: number }>();
const upload = multer({ dest: path.join(dataDir, ".uploads"), limits: { fileSize: 50 * 1024 * 1024 } });

await Promise.all([store.init(), mkdir(refsDir, { recursive: true }), mkdir(photosDir, { recursive: true }), mkdir(importsDir, { recursive: true })]);
const character = JSON.parse(await readFile(profilePath, "utf8")) as Record<string, unknown>;

async function workflowProfiles() {
  const files = (await readdir(workflowsDir)).filter((x) => x.endsWith(".json") && !x.startsWith("local-workflow"));
  return Promise.all(files.map(async (file) => JSON.parse(await readFile(path.join(workflowsDir, file), "utf8")) as WorkflowProfile));
}

async function selectedWorkflow() {
  const profiles = await workflowProfiles();
  const wanted = process.env.COMFYUI_PROFILE ?? "mock";
  return profiles.find((x) => x.id === wanted) ?? profiles.find((x) => x.id === "mock")!;
}

const app = express();
const trustProxy = process.env.TRUST_PROXY ?? "false";
app.set("trust proxy", trustProxy === "true" ? true : trustProxy === "loopback" ? "loopback" : false);
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(root, "public")));

function authenticated(req: express.Request) {
  if (!pinAuth) return true;
  return pinAuth.verifySession(parseCookies(req.headers.cookie).emily_session);
}

app.get("/api/auth/status", (req, res) => {
  res.json({ required: Boolean(pinAuth), authenticated: authenticated(req) });
});

const loginSchema = z.object({ pin: z.string().min(1).max(128) });
app.post("/api/auth/login", (req, res) => {
  if (!pinAuth) return res.json({ authenticated: true });
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const attempt = loginAttempts.get(key) ?? { failures: 0, lockedUntil: 0 };
  if (attempt.lockedUntil > Date.now()) return res.status(429).json({ error: "Too many attempts. Try again in five minutes." });
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success || !pinAuth.verifyPin(parsed.data.pin)) {
    attempt.failures += 1;
    if (attempt.failures >= 5) { attempt.failures = 0; attempt.lockedUntil = Date.now() + 5 * 60_000; }
    loginAttempts.set(key, attempt);
    return res.status(401).json({ error: "Incorrect PIN." });
  }
  loginAttempts.delete(key);
  const secure = req.secure ? "; Secure" : "";
  res.setHeader("Set-Cookie", `emily_session=${encodeURIComponent(pinAuth.issueSession())}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${secure}`);
  res.json({ authenticated: true });
});

app.post("/api/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", "emily_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
  res.status(204).end();
});

app.use(["/api", "/photos"], (req, res, next) => {
  if (authenticated(req)) return next();
  res.status(401).json({ error: "PIN required." });
});
app.use("/photos", express.static(photosDir));

app.get("/api/bootstrap", async (_req, res) => {
  const state = await store.read();
  res.json({ character, state, workflows: await workflowProfiles(), selectedWorkflow: (await selectedWorkflow()).id });
});

app.get("/api/health", async (_req, res) => {
  res.json({ app: { ok: true, version: "5.6.1" }, ollama: await ollama.health(), comfyui: await images.health(), workflow: (await selectedWorkflow()).id, inference: inference.status(), authentication: { mode: authMode } });
});

app.get("/api/diagnostics", async (_req, res) => {
  const workflow = await selectedWorkflow();
  res.json({
    app: { ok: true, version: "5.6.1" },
    ollama: await ollama.health(),
    comfyui: await images.health(),
    workflow: await images.profileDiagnostics(workflow),
    inference: inference.status()
  });
});

async function generatePhoto(request: PhotoRequest, requestedProfile = request.workflowProfile) {
  const profiles = await workflowProfiles();
  const workflow = requestedProfile
    ? profiles.find((profile) => profile.id === requestedProfile) ?? await selectedWorkflow()
    : request.pose
      ? profiles.find((profile) => profile.routingHints?.namedPose) ?? await selectedWorkflow()
      : await selectedWorkflow();
  return inference.runImage(workflow, () => images.generate(request, workflow));
}

const chatSchema = z.object({ message: z.string().trim().min(1).max(4000) });
app.post("/api/chat", async (req, res, next) => {
  try {
    const { message: text } = chatSchema.parse(req.body);
    const before = await store.read();
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: text, createdAt: new Date().toISOString() };
    const routing = routePhotoRequest(text, {
      enabled: (process.env.PHOTO_ROUTING ?? "auto") === "auto",
      lastPhotoAt: before.lastAutoPhotoAt,
      cooldownMinutes: Number(process.env.AUTO_PHOTO_COOLDOWN_MINUTES ?? 30)
    });
    let reply: string;
    try { reply = await inference.runChat(() => ollama.chat(character, before.messages, before.memories, before.style, before.relationship, text, { photoWillBeGenerated: routing.route })); }
    catch (error) {
      reply = `I’m here, but my local language model isn’t responding yet. Check Ollama in Settings. (${String(error).slice(0, 180)})`;
    }
    const assistantMessage: Message = { id: crypto.randomUUID(), role: "assistant", content: reply, createdAt: new Date().toISOString() };
    const candidates = extractMemoryCandidates(text, "chat");
    let photo = null;
    if (routing.route && routing.request) {
      try { photo = await generatePhoto(routing.request); }
      catch (error) { photo = { id: crypto.randomUUID(), filename: "", createdAt: new Date().toISOString(), status: "failed" as const, workflowProfile: (await selectedWorkflow()).id, prompt: routing.request.scene, request: routing.request, error: String(error) }; }
    }
    await store.update((state) => {
      state.messages.push(userMessage, assistantMessage);
      state.memories.push(...candidates);
      if (photo) { state.photos.push(photo); state.lastAutoPhotoAt = new Date().toISOString(); assistantMessage.photoId = photo.id; }
    });
    res.json({ userMessage, assistantMessage, memoryCandidates: candidates, photo, routing });
  } catch (error) { next(error); }
});

const photoSchema = z.object({
  scene: z.string().trim().min(1).max(1000), activity: z.string().max(300).optional(), outfit: z.string().max(300).optional(),
  pose: z.string().max(300).optional(), expression: z.string().max(300).optional(), camera: z.string().max(300).optional(),
  environment: z.string().max(300).optional(), width: z.number().int().min(256).max(2048).optional(),
  height: z.number().int().min(256).max(2048).optional(), seed: z.number().int().optional(), referenceSlot: z.string().optional(),
  poseImage: z.string().optional(), controlStrength: z.number().min(0).max(2).optional(),
  workflowProfile: z.string().max(100).optional()
});
app.post("/api/photos", async (req, res, next) => {
  try {
    const request = photoSchema.parse(req.body) as PhotoRequest;
    const record = await generatePhoto(request);
    await store.update((state) => { state.photos.push(record); });
    res.status(202).json(record);
  } catch (error) { next(error); }
});

app.get("/api/photos", async (_req, res) => {
  const state = await store.read();
  const queue = state.photos.some((photo) => photo.status === "queued") ? await images.queueSnapshot() : null;
  const refreshed = await Promise.all(state.photos.map(async (photo) => {
    try { return await images.refresh(photo, queue); } catch { return photo; }
  }));
  if (JSON.stringify(refreshed) !== JSON.stringify(state.photos)) {
    await store.update((current) => { current.photos = refreshed; });
  }
  res.json(refreshed);
});

app.post("/api/photos/:id/retry", async (req, res, next) => {
  try {
    const state = await store.read();
    const source = retryablePhoto(state, req.params.id);
    if (!source) return res.status(409).json({ error: "Only failed or mock photo requests can be retried." });
    const record = await generatePhoto(source.request);
    await store.update((current) => { current.photos.push(record); });
    res.status(202).json(record);
  } catch (error) { next(error); }
});

const variationSchema = z.object({ seed: z.number().int().min(1).max(2_147_483_646).optional() });
app.post("/api/photos/:id/variations", async (req, res, next) => {
  try {
    const input = variationSchema.parse(req.body ?? {});
    const state = await store.read();
    const request = photoVariation(state, req.params.id, input.seed ?? randomInt(1, 2_147_483_647));
    if (!request) return res.status(404).json({ error: "Photo request not found." });
    const record = await generatePhoto(request);
    await store.update((current) => { current.photos.push(record); });
    res.status(202).json(record);
  } catch (error) { next(error); }
});

app.delete("/api/photos/:id", async (req, res) => {
  let filename = "";
  let found = false;
  const updated = await store.update((state) => {
    const record = removePhoto(state, req.params.id);
    found = Boolean(record);
    filename = record?.filename ?? "";
  });
  if (!found) return res.status(404).json({ error: "Photo not found." });
  if (filename && path.basename(filename) === filename) await unlink(path.join(photosDir, filename)).catch(() => undefined);
  res.json({ removed: true, photos: updated.photos.length });
});

app.post("/api/references", upload.array("references", 2), async (req, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) return res.status(400).json({ error: "Attach one or two reference files." });
    const accepted = ["image/jpeg", "image/png", "image/webp"];
    const records: ReferenceImage[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      if (!accepted.includes(file.mimetype)) throw new Error(`Unsupported image type: ${file.mimetype}`);
      const ext = file.mimetype === "image/png" ? ".png" : file.mimetype === "image/webp" ? ".webp" : ".jpg";
      const id = `emily-reference-${i + 1}`;
      const destination = path.join(refsDir, `${id}${ext}`);
      const buffer = await readFile(file.path);
      await rename(file.path, destination);
      records.push({ id, filename: path.basename(destination), sha256: createHash("sha256").update(buffer).digest("hex"), mimeType: file.mimetype, bytes: buffer.length, createdAt: new Date().toISOString() });
    }
    await store.update((state) => { for (const record of records) { state.references = state.references.filter((x) => x.id !== record.id); state.references.push(record); } });
    res.status(201).json(records);
  } catch (error) { next(error); }
});

app.delete("/api/references/:id", async (req, res) => {
  let filename = "";
  const updated = await store.update((state) => { filename = removeReference(state, req.params.id)?.filename ?? ""; });
  if (!filename) return res.status(404).json({ error: "Reference image not found." });
  if (path.basename(filename) === filename) await unlink(path.join(refsDir, filename)).catch(() => undefined);
  res.json({ removed: true, references: updated.references.length });
});

app.post("/api/imports", upload.single("conversation"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Attach a JSON, HTML, or TXT export." });
    const original = path.join(importsDir, `${Date.now()}-${path.basename(req.file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_")}`);
    await rename(req.file.path, original);
    const raw = await readFile(original, "utf8");
    const result = importConversation(req.file.originalname, raw);
    const before = await store.read();
    const knownIds = new Set(before.messages.map((message) => message.id));
    const newMessages = result.messages.filter((message) => !knownIds.has(message.id));
    const emilyMessages = result.messages.filter((m) => m.role === "assistant");
    const userMessages = newMessages.filter((m) => m.role === "user");
    const style = extractStyle(emilyMessages);
    const existingMemoryText = new Set(before.memories.map((memory) => memory.text.trim().toLowerCase()));
    const memories = userMessages.flatMap((m) => extractMemoryCandidates(m.content, "import"))
      .filter((memory) => !existingMemoryText.has(memory.text.trim().toLowerCase()));
    await store.update((state) => {
      state.messages.push(...newMessages);
      if (emilyMessages.length) state.style = style;
      state.memories.push(...memories);
    });
    res.status(201).json({
      source: result.source,
      adapter: result.adapter,
      warnings: result.warnings,
      parsedMessages: result.messages.length,
      importedMessages: newMessages.length,
      duplicatesSkipped: result.messages.length - newMessages.length,
      style: emilyMessages.length ? style : before.style,
      memoryCandidates: memories.length,
      savedOriginal: path.basename(original)
    });
  } catch (error) { next(error); }
});

app.delete("/api/memories/:id", async (req, res) => {
  await store.update((state) => { state.memories = state.memories.filter((x) => x.id !== req.params.id); });
  res.status(204).end();
});

const confirmationSchema = z.object({ confirmation: z.literal("delete") });

app.delete("/api/conversation", async (req, res, next) => {
  try {
    confirmationSchema.parse(req.body);
    let removed = 0;
    await store.update((state) => { removed = clearConversation(state); });
    res.json({ removed });
  } catch (error) { next(error); }
});

app.delete("/api/memories", async (req, res, next) => {
  try {
    confirmationSchema.parse(req.body);
    let removed = 0;
    await store.update((state) => { removed = clearMemories(state); });
    res.json({ removed });
  } catch (error) { next(error); }
});

app.delete("/api/style", async (req, res, next) => {
  try {
    confirmationSchema.parse(req.body);
    let removed = false;
    await store.update((state) => { removed = clearStyle(state); });
    res.json({ removed });
  } catch (error) { next(error); }
});

const manualMemorySchema = z.object({ text: z.string().trim().min(3).max(1000), tags: z.array(z.string().trim().min(1).max(50)).max(10).default([]) });
app.post("/api/memories", async (req, res, next) => {
  try {
    const input = manualMemorySchema.parse(req.body);
    const memory = { id: crypto.randomUUID(), text: input.text, source: "manual" as const, confidence: 1, tags: input.tags, createdAt: new Date().toISOString() };
    await store.update((state) => { state.memories.push(memory); });
    res.status(201).json(memory);
  } catch (error) { next(error); }
});

app.get("/api/backups/export", async (_req, res) => {
  const backup = createBackup(await store.read(), "5.6.1");
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("content-disposition", `attachment; filename="emily-backup-${date}.json"`);
  res.send(JSON.stringify(backup, null, 2));
});

app.post("/api/backups/restore", upload.single("backup"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Attach an Emily JSON backup." });
    const backup = parseBackup(await readFile(req.file.path, "utf8"));
    await unlink(req.file.path).catch(() => undefined);
    let report!: ReturnType<typeof mergeBackup>["report"];
    await store.update((state) => {
      const merged = mergeBackup(state, backup);
      Object.assign(state, merged.state);
      report = merged.report;
    });
    res.json({ sourceVersion: backup.appVersion, exportedAt: backup.exportedAt, ...report });
  } catch (error) { next(error); }
});

app.get("/api/context-preview", async (req, res, next) => {
  try {
    const query = z.string().trim().min(1).max(1000).parse(req.query.query);
    const state = await store.read();
    const conversation = buildConversationWindow(state.messages);
    res.json({
      query,
      memories: rankMemories(state.memories, query).map(({ memory, score, matchedTerms }) => ({ memory, score, matchedTerms })),
      styleGuidance: styleGuidance(state.style),
      relationship: state.relationship,
      conversation: {
        totalMessages: conversation.totalMessages,
        includedMessages: conversation.messages.length,
        omittedMessages: conversation.omittedMessages,
        includedCharacters: conversation.includedCharacters,
        maximumMessages: 16,
        maximumCharacters: 12_000
      }
    });
  } catch (error) { next(error); }
});

const proactiveSchema = z.object({
  enabled: z.boolean(),
  minimumIntervalMinutes: z.number().int().min(30).max(10_080),
  quietHoursStart: z.number().int().min(0).max(23),
  quietHoursEnd: z.number().int().min(0).max(23)
});
app.put("/api/settings/proactive", async (req, res, next) => {
  try {
    const settings = proactiveSchema.parse(req.body);
    const updated = await store.update((state) => {
      if (!state.proactive.enabled && settings.enabled) state.lastProactiveAt = new Date().toISOString();
      state.proactive = settings;
    });
    res.json({ proactive: updated.proactive, lastProactiveAt: updated.lastProactiveAt });
  } catch (error) { next(error); }
});

const relationshipSchema = z.object({ intensity: z.enum(["warm", "flirty", "spicy"]) });
app.put("/api/settings/relationship", async (req, res, next) => {
  try {
    const relationship = relationshipSchema.parse(req.body);
    const updated = await store.update((state) => { state.relationship = relationship; });
    res.json({ relationship: updated.relationship });
  } catch (error) { next(error); }
});

app.get("/api/updates", async (req, res) => {
  const state = await store.read();
  const after = typeof req.query.after === "string" ? Date.parse(req.query.after) : Number.NaN;
  const messages = Number.isNaN(after)
    ? state.messages.slice(-50)
    : state.messages.filter((message) => Date.parse(message.createdAt) > after);
  res.json({ messages, lastProactiveAt: state.lastProactiveAt });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request", details: error.flatten() });
  console.error(error);
  res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
app.listen(port, host, () => console.log(`Emily v5.6.1 is ready at http://${host}:${port}`));

let proactiveRunning = false;
async function runProactiveTick() {
  if (proactiveRunning) return;
  proactiveRunning = true;
  try {
    const state = await store.read();
    if (!shouldSendProactive(state)) return;
    const content = await inference.runChat(() => ollama.chat(
      character,
      state.messages,
      state.memories,
      state.style,
      state.relationship,
      proactivePrompt(state.messages)
    ));
    const message: Message = { id: crypto.randomUUID(), role: "assistant", content, createdAt: new Date().toISOString() };
    await store.update((current) => {
      // A manual chat may have arrived while the model was generating. Avoid an
      // unsolicited message immediately after that newer activity.
      if (!shouldSendProactive(current)) return;
      current.messages.push(message);
      current.lastProactiveAt = message.createdAt;
    });
  } catch (error) { console.error("Proactive check-in failed:", error); }
  finally { proactiveRunning = false; }
}

const proactiveTimer = setInterval(runProactiveTick, 60_000);
proactiveTimer.unref();
