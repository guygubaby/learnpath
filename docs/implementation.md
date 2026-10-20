# 学径 LearnPath

## Confirmed scope

React 19, TanStack Start, Vite 8, Tailwind CSS v4, shadcn/ui, Cytoscape.js.
Cloudflare Workers + Static Assets, D1 native SQL with versioned migrations, R2.
Better Auth owns accounts and opaque Cookie Sessions in D1. No Prisma, PostgreSQL or Redis.
AI SDK with user-configurable OpenAI-compatible or Anthropic-compatible endpoints.

The first release includes the real eight-subject taxonomy, child profiles, goal paths,
guided diagnosis, AI tutoring, quizzes, evidence-based progress, spaced review and reports.
No model-generated answer is treated as independent proof of mastery.

## Visual direction

An airy learning workspace with a quiet fixed sidebar and a generous knowledge canvas.
The graph is the focal point; content panels and learning routes remain readable and practical.

- Ink `#292b41`; muted ink `#73798b`; page `#f6f7fb`; surface `#ffffff`.
- Primary iris `#7161c8`; primary pale `#f0edfb`; border `#e6e8f1`.
- Subject colors: violet, blue, sage, amber, rose, cyan, orange and slate.
- System Chinese sans-serif for body; system Latin sans-serif for English topic names.
- Desktop: navigation rail / learning content / contextual panel. Mobile: compact header and reflowed panels.
- Native forms and dialogs, visible focus, readable touch targets, reduced-motion support.

## Verification

Domain tests cover prerequisite graph closure/order, mastery evidence, review scheduling,
provider URL validation and encrypted key storage. Worker integration checks cover authentication,
tenant isolation, persistence and both AI wire protocols. Browser checks exercise the main learning flow.
