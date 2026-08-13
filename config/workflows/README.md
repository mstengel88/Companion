# Generic ComfyUI workflow profiles

No model, checkpoint, or content-specific workflow is bundled. The application only knows about replaceable placeholders.

1. Build and test a workflow in ComfyUI.
2. Use **Save (API Format)** in ComfyUI's developer mode.
3. Put the JSON here as `local-workflow-api.json`.
4. Replace literal inputs in the graph with the placeholders listed in `comfyui-example.json`.
5. Set `COMFYUI_PROFILE=comfyui-example` in `.env`.

Pose and control hooks are optional. A workflow that does not use them may leave those placeholder values absent. Local workflow/model selection remains outside source control.
