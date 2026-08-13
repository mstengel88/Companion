import "dotenv/config";
import express from "express";
import multer from "multer";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { JsonStore } from "./store/json-store.js";
import { extractMemoryCandidates, extractStyle } from "./services/extraction.js";
import { importConversation } from "./services/importer.js";
import { routePhotoRequest } from "./services/photo-router.js";
import { OllamaClient } from "./services/ollama.js";
import { ImageService } from "./services/comfyui.js";
import type { Message, PhotoRequest, ReferenceImage, WorkflowProfile } from "./types/domain.js";

const root = process.cwd();
const dataDir = path.resolve(root, process.env.DATA_DIR ?? "data");
const refsDir = path.join(dataDir, "references");
const photosDir = path.join(dataDir, "photos");
const importsDir = path.join(dataDir, "imports");
const workflowsDir = path.join(root, "config", "workflows");
const profilePath = path.join(root, "config", "characters", "emily.json");
const store = new JsonStore(dataDir);
const ollama = new OllamaClient(process.env.OLLAMA_URL ?? "http://127.0.0.1:11434", process.env.OLLAMA_MODEL ?? "qwen2.5:7b");
const images = new ImageService(process.env.COMFYUI_URL ?? "http://127.0.0.1:8188", root, refsDir, photosDir);
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
app.set("trust proxy", process.env.TRUST_PROXY === "true");
app.use(express.json({ limit: "2mb" }));
app.use("/photos", express.static(photosDir));
app.use(express.static(path.join(root, "public")));

app.get("/api/bootstrap", async (_req, res) => {
  const state = await store.read();
  res.json({ character, state, workflows: await workflowProfiles(), selectedWorkflow: (await selectedWorkflow()).id });
});

app.get("/api/health", async (_req, res) => {
  res.json({ app: { ok: true, version: "4.0.0" }, ollama: await ollama.health(), comfyui: await images.health(), workflow: (await selectedWorkflow()).id });
});

const chatSchema = z.object({ message: z.string().trim().min(1).max(4000) });
app.post("/api/chat", async (req, res, next) => {
  try {
    const { message: text } = chatSchema.parse(req.body);
    const before = await store.read();
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: text, createdAt: new Date().toISOString() };
    let reply: string;
    try { reply = await ollama.chat(character, before.messages, before.memories, text); }
    catch (error) {
      reply = `I’m here, but my local language model isn’t responding yet. Check Ollama in Settings. (${String(error).slice(0, 180)})`;
    }
    const assistantMessage: Message = { id: crypto.randomUUID(), role: "assistant", content: reply, createdAt: new Date().toISOString() };
    const candidates = extractMemoryCandidates(text, "chat");
    const routing = routePhotoRequest(text, {
      enabled: (process.env.PHOTO_ROUTING ?? "auto") === "auto",
      lastPhotoAt: before.lastAutoPhotoAt,
      cooldownMinutes: Number(process.env.AUTO_PHOTO_COOLDOWN_MINUTES ?? 30)
    });
    let photo = null;
    if (routing.route && routing.request) {
      try { photo = await images.generate(routing.request, await selectedWorkflow()); }
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
  poseImage: z.string().optional(), controlStrength: z.number().min(0).max(2).optional()
});
app.post("/api/photos", async (req, res, next) => {
  try {
    const request = photoSchema.parse(req.body) as PhotoRequest;
    const record = await images.generate(request, await selectedWorkflow());
    await store.update((state) => { state.photos.push(record); });
    res.status(202).json(record);
  } catch (error) { next(error); }
});

app.get("/api/photos", async (_req, res) => {
  const state = await store.read();
  const refreshed = await Promise.all(state.photos.map(async (photo) => {
    try { return await images.refresh(photo); } catch { return photo; }
  }));
  await store.update((current) => { current.photos = refreshed; });
  res.json(refreshed);
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

app.post("/api/imports", upload.single("conversation"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Attach a JSON or TXT export." });
    const original = path.join(importsDir, `${Date.now()}-${path.basename(req.file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_")}`);
    await rename(req.file.path, original);
    const raw = await readFile(original, "utf8");
    const result = importConversation(req.file.originalname, raw);
    const emilyMessages = result.messages.filter((m) => m.role === "assistant");
    const userMessages = result.messages.filter((m) => m.role === "user");
    const style = extractStyle(emilyMessages);
    const memories = userMessages.flatMap((m) => extractMemoryCandidates(m.content, "import"));
    await store.update((state) => { state.messages.push(...result.messages); state.style = style; state.memories.push(...memories); });
    res.status(201).json({ ...result, messageCount: result.messages.length, messages: undefined, style, memoryCandidates: memories.length, savedOriginal: path.basename(original) });
  } catch (error) { next(error); }
});

app.delete("/api/memories/:id", async (req, res) => {
  await store.update((state) => { state.memories = state.memories.filter((x) => x.id !== req.params.id); });
  res.status(204).end();
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request", details: error.flatten() });
  console.error(error);
  res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
app.listen(port, host, () => console.log(`Emily v4 is ready at http://${host}:${port}`));
