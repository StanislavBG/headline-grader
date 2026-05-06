# HeadlineGrader

Standalone 4-framework headline grader. Built as a static-path sibling that gets served at **bilko.run/projects/headline-grader/** by the [bilko-run host](https://github.com/StanislavBG/bilko-run).

Calls `bilko.run/api/demos/headline-grader{,/compare,/generate}` same-origin — Clerk session cookie + JWT travel automatically.

## Build + sync

```bash
pnpm install
pnpm build              # emits dist/
pnpm sync               # copies dist/ to ../Bilko/public/projects/headline-grader/
```

Or, from a Claude session in this repo, use the `bilko-host` MCP — it'll register the project, copy the build output, commit, and push to both remotes for you.

## Architecture

- React 18 + Vite 6 + Tailwind v4. No router. Bundles `@clerk/clerk-react` for SignInButton + JWT bearer auth.
- Slim local kit (`src/kit.tsx`) for `track()`, `<ToolHero>`, `<ScoreCard>`, `<SectionBreakdown>`, `<CompareLayout>`, `<Rewrites>`, `<CrossPromo>`. Host's full kit lives at `~/Projects/Bilko/src/components/tool-page/`.
- `useToolApi` (3 endpoints: submit / compare / generate) hooks the standalone to `bilko.run/api` same-origin. Server route stays in the host.
- Vite `base: /projects/headline-grader/` so all assets resolve under that path.

## Modes

- **Score** — POST `/api/demos/headline-grader` (1 credit) — paste a headline, get a score + 4-framework breakdown + AI rewrites
- **A/B Compare** — POST `/api/demos/headline-grader/compare` (2 credits) — paste two headlines, get a winner with side-by-side breakdown
- **Generate** — POST `/api/demos/headline-grader/generate` (1 credit) — describe a product, get 5 framework-optimized headlines back

Frameworks scored: Masterson's Rule of One + 4 U's, Hormozi Value Equation, Readability, Proof+Promise+Plan.

## Files

- `src/HeadlineGraderPage.tsx` — the page (extracted from `~/Projects/Bilko/src/pages/HeadlineGraderPage.tsx`)
- `src/main.tsx` — mount point + ClerkProvider
- `src/index.css` — Tailwind + warm/fire/indigo/grade palette tokens + display utilities (`text-display-sm` is needed by `<CompareLayout>`)
- `src/kit.tsx` — slim `track()` + ToolHero/ScoreCard/SectionBreakdown/CompareLayout/Rewrites/CrossPromo (indigo hero baked in)
- `src/useToolApi.ts` — same hook as host, points to `https://bilko.run/api`
- `vite.config.ts` — base path + tailwind plugin
- `.mcp.json` — wires up `bilko-host` MCP for self-publish from a Claude session
