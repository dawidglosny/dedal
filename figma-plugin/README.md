# The Dedal Figma plugin

Builds pages from Dedal templates in the open Figma file, from its own library components — sent by `dedal-figma build` or by an agent through `dedal-mcp` (`template_to_figma`). It runs in Figma desktop as a development plugin: no publishing, no call limits.

1. **Import it once:** Figma desktop → Plugins → Development → Import plugin from manifest → `figma-plugin/manifest.json` (in the package: `node_modules/dedal/figma-plugin/manifest.json`).
2. **Run it** in the file whose library the template uses: Plugins → Development → Dedal. Keep its window open — it connects to the local bridge (`http://localhost:7377`) and waits.
3. **Build:** `dedal-figma build <file> --template templates/home.json --mapping ./figma.mapping.mjs` (or ask an agent). The plugin creates a frame next to the existing content: one instance per section, its properties set, its slots filled; images are fetched through the bridge from the project's `public/`.

The plugin only builds what the bridge sends; the plan — which library component, which property, which slot — is made by Dedal (`templateToFigma`), and parts without a counterpart are reported before anything is built.
