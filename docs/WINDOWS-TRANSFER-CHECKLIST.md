# Move Emily from this Mac to the Windows RTX PC

The private Windows transfer archive includes the application, `.env`, conversation state, reference images, completed photo library, retained imports, and the locally selected ComfyUI API workflow. Keep that archive private because it contains the app PIN/session secret and personal companion data.

## On the Windows PC

1. Install the latest NVIDIA driver and restart Windows.
2. Extract the private transfer archive to a stable folder such as `C:\Emily`.
3. Open PowerShell in that folder and run:

   ```powershell
   Set-ExecutionPolicy -Scope Process Bypass
   .\scripts\setup-windows.ps1
   ```

4. If Node or Ollama was installed by that command, close PowerShell, reopen it in `C:\Emily`, and run:

   ```powershell
   Set-ExecutionPolicy -Scope Process Bypass
   .\scripts\setup-windows.ps1 -SkipSoftwareInstall
   ```

5. Install ComfyUI Desktop for NVIDIA and start it once.
6. Copy `sd_xl_base_1.0.safetensors` into the Windows ComfyUI `models\checkpoints` folder. The 6.5 GB checkpoint is intentionally not duplicated inside the transfer zip.
7. Copy Emily's two canonical references into ComfyUI's input folder:

   ```powershell
   .\scripts\prepare-windows-data.ps1 -ComfyInputPath "C:\path\to\ComfyUI\input"
   ```

8. Confirm the transferred local workflow opens and queues successfully in ComfyUI. Its API graph is at `config\workflows\local-workflow-api.json` and `.env` already selects `comfyui-example`.
9. Verify the host, then start Emily:

   ```powershell
   .\scripts\test-host.ps1
   .\scripts\start-windows.ps1
   ```

10. Open `http://127.0.0.1:3000` on the PC. For phone access, install Tailscale on Windows and use private Tailscale Serve; do not expose ports 3000 or 8188 publicly.

## Expected transferred data

- `data\state.json`: conversation, settings, memories, and photo metadata
- `data\references`: Emily identity/reference images
- `data\photos`: completed local photo library
- `data\imports`: retained conversation imports
- `.env`: runtime selection, PIN authentication, and private secret
- `config\workflows\local-workflow-api.json`: locally selected ComfyUI API graph

The Mac's `node_modules`, compiled output, logs, ComfyUI installation, and model checkpoint are not included. Windows recreates dependencies and compiled output during setup.
