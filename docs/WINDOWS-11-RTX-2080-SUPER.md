# Windows 11 deployment — RTX 2080 Super

This guide targets a Windows 11 PC with 32 GB RAM and an RTX 2080 Super (8 GB VRAM). Keep the app bound to `127.0.0.1` until you deliberately configure private remote access.

## 1. Update the NVIDIA driver

Install a current NVIDIA driver, restart, and confirm the card appears:

```powershell
nvidia-smi
```

Ollama supports NVIDIA compute capability 5.0 and newer; the RTX 2080 family is compute capability 7.5. Current requirements can change, so use the driver baseline on [Ollama's hardware support page](https://docs.ollama.com/gpu) rather than a version copied into this project.

## 2. Run the app setup

Open PowerShell in this project folder:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup-windows.ps1
```

This installs Node LTS and Ollama through Windows Package Manager, installs the app dependencies, builds the project, and pulls the default 7B chat model. Ollama runs natively on Windows and serves its local API at `http://localhost:11434`; see the [official Windows guide](https://docs.ollama.com/windows).

If software was installed during the first run, reopen PowerShell and run:

```powershell
.\scripts\setup-windows.ps1 -SkipSoftwareInstall
```

## 3. Install ComfyUI

Use [ComfyUI Desktop for Windows/NVIDIA](https://docs.comfy.org/installation/desktop/windows). Choose the NVIDIA option. Desktop is currently described as beta by its maintainers, so follow the current official screens if they differ from this guide.

Start ComfyUI and leave it listening on `127.0.0.1:8188`. Validate all three services:

```powershell
.\scripts\test-host.ps1
```

## 4. Configure a generic workflow

The code deliberately does not bundle or select any content-specific checkpoint or workflow.

1. Build and successfully queue your chosen workflow inside ComfyUI.
2. Enable developer mode in ComfyUI settings. This exposes API-save options; see [ComfyUI settings](https://docs.comfy.org/interface/settings/comfy).
3. Save the graph in API format. ComfyUI's API format uses node IDs with `class_type` and `inputs`; see its [workflow API overview](https://docs.comfy.org/development/cloud/overview).
4. Save it as `config\workflows\local-workflow-api.json`.
5. Substitute the generic placeholders documented in `config\workflows\README.md`.
6. Change `.env` to `COMFYUI_PROFILE=comfyui-example`.

The reference filenames must be visible to ComfyUI's `LoadImage` node. The simplest option is to copy the two files from `data\references` to ComfyUI's `input` folder whenever they change. A future sync adapter can automate this.

## 5. Run

```powershell
.\scripts\start-windows.ps1
```

Open `http://127.0.0.1:3000` on the Windows PC.

## RTX 2080 Super tuning

- Start with one 7B quantized Ollama model and an image workflow designed for 8 GB VRAM.
- Do not assume Ollama and the image model can remain fully loaded at once. If image generation runs out of memory, stop active chat generation and let Ollama unload before retrying.
- Leave `GPU_HANDOFF=auto` for the RTX 2080 Super. The app serializes inference and sends Ollama a `keep_alive: 0` unload request before it queues a real ComfyUI workflow. Settings → Runtime → Run diagnostics shows loaded-model VRAM and the last handoff result.
- Begin around 832×1216 or lower and add upscaling as a separate pass.
- Add reference conditioning and pose control one at a time so memory regressions are easy to identify.
- Keep ComfyUI on localhost. Do not open port 8188 directly to the internet.
