# SSMSx Design System

A design system for **SSMSx** — *"a fast, cross-platform SQL Server Management Studio built for developers who are tired of waiting."*

SSMSx is a desktop SQL Server client and a modern alternative to SSMS (Windows-only) and Azure Data Studio (nearing end-of-life). It's built as a **Tauri v2 (Rust) shell + React 19 / TypeScript frontend + C# Native AOT sidecar**, talking to SQL Server via `Microsoft.Data.SqlClient` with SQL Server auth and SqlClient interactive Entra auth. The UI is deliberately compact, light-themed, keyboard-driven and information-dense — it has to feel instant.

This project distills SSMSx's real, shipping look-and-feel into reusable tokens, components, foundation cards and a full workbench UI kit, so new screens, marketing pages, docs and decks all look like SSMSx.

## Source of truth

Everything here was reverse-engineered from the product's own source code — not from screenshots:

- **GitHub:** https://github.com/GordonBeeming/ssmsx (branch `main`)
  - Colors + base styles: `src/index.css` (Tailwind v4 `@theme`)
  - Object Explorer icons: `src/features/explorer/components/NodeIcon.tsx`
  - Query workbench: `src/features/query/components/*`
  - Connection flow: `src/features/connection/components/*`

Explore the repo further to build higher-fidelity designs — the feature folders under `src/features/` (connection, explorer, query, diagram) are the canonical reference for behavior and layout.

> **Naming note:** the product wordmark is **SSMSx** — uppercase SSMS, lowercase trailing **x**. The GitHub repo slug is lowercase `ssmsx`; the other product referenced (Microsoft **SSMS**) is unrelated.

---

## Content fundamentals

How SSMSx writes copy. It's a developer tool, so the voice is terse, technical and confident — never chatty.

- **Tone:** plain, fast, factual. Short fragments over full sentences. The product README leads with *"developers who are tired of waiting"* and *"Neither feels fast. SSMSx fixes all three problems."* — direct, a little opinionated.
- **Voice / person:** mostly impersonal and imperative. UI copy addresses the user with verbs: *"Connect to a SQL Server to get started"*, *"Browse objects in the explorer, or press ⌘+N for a new query."* No "we", rarely "you".
- **Casing:** Sentence case for prose and prompts. **Title Case** for buttons and menu items (*New Connection*, *Close Others*, *Add Connection*). **UPPERCASE + wide tracking** for section eyebrows (*OBJECT EXPLORER*, *RECENT*).
- **Status language:** single words — *Ready*, *Executing…*, *Completed*, *Failed*, *Cancelled*. Counts are literal and pluralized: *"14,203 rows"*, *"(12 rows affected)"*. Times are precise: `00:00:00.214`.
- **Errors:** mirror SQL Server's own wording verbatim — *"Invalid object name 'dbo.Custmer'."*, *"Msg 208, Level 16"*. Don't soften or rewrite server errors.
- **Auth labels:** abbreviated chips — `SQL`, `CS`, `Entra`.
- **Emoji:** essentially none in the product UI. Avoid them. (One 🔒 glyph appears inside the security-folder icon in source — a rare exception, not a pattern.)
- **No marketing fluff** inside the app. Save persuasion for the README/landing context; in-app text is purely functional.

---

## Visual foundations

- **Theme & mood:** a single **light** theme. Layered cool grays (`#F8F9FA` app → `#E9ECEF` panels → `#DEE2E6` raised), near-black text, one confident blue accent (`#0063B2`). Utilitarian and calm — the data is the content; the chrome stays quiet.
- **Color usage:** accent blue is reserved for primary actions, focus, selection and SQL keywords. Status colors are semantic and consistent everywhere — green = success/run, red = error/destructive, amber = cancelled/warning, a bright `#4ade80` = "server online" dots. **Connection color-coding** is a signature: every saved connection carries a user-chosen dot (red prod, green local…) that follows it across the toolbar, tree, tabs and status bar.
- **Type:** the **native OS UI font** (`-apple-system, "Segoe UI", …`) so it feels native on every platform — no webfont ships. SQL, result grids and messages use the **platform monospace** stack. The scale is small and dense: 12px is the workhorse body size; 11px for chips; 14–18px only for dialogs and empty states.
- **Density & spacing:** a tight **4px grid**. Rows are ~26px tall, padding is measured in 2–12px steps. The app packs a lot on screen on purpose.
- **Borders over shadows:** structure comes from **1px solid borders** (`#DEE2E6`) dividing every panel, toolbar, tab and grid cell — not from elevation. The look is almost flat.
- **Elevation:** used sparingly and only for floating surfaces — a soft shadow on context menus/popovers, a slightly larger one on the dialog. No shadows on static cards or panels.
- **Radius:** restrained. 4px on buttons/inputs/tabs, 6px on grouped cards, 8px on the modal dialog, full-round only on the connection color dots. The **app icon** is the one place with generous rounding (~22% squircle).
- **Backgrounds:** flat solid fills only. **No gradients, no imagery, no textures, no patterns** anywhere in the product UI. (The app icon may carry a subtle tonal treatment, but the mark here is flat.)
- **Hover states:** fill with the next gray up (`#DEE2E6`) and/or promote text from secondary to primary ink; accent buttons shift to the slightly lighter `#0075A3`. Quick `~120ms` ease transitions.
- **Selection / active:** tree selection is accent at **15% tint** (`color-mix`), the active query tab takes the white app background, active result/dialog tabs get a 2px accent bottom-border.
- **Press / disabled:** no shrink or bounce. Disabled = `opacity: 0.5` + `not-allowed` cursor.
- **Motion:** minimal and functional only — short color/background fades on hover, a chevron rotate on tree expand, a spinner during async loads, a live execution timer ticking at 100ms. **No decorative or looping animation.** No bounces, no easing flourishes (the app uses the default `ease`).
- **Transparency / blur:** essentially none, beyond the dialog's `rgba(0,0,0,0.5)` scrim and the accent selection tint. No glassmorphism.
- **Cards:** "cards" here are bordered panels — 1px border, small radius, flat fill, no shadow. Information containers, not floating objects.
- **Imagery vibe:** N/A — SSMSx is pure UI chrome and tabular data. There is no photography or illustration in the product.

---

## Iconography

- **Object Explorer** uses a **bespoke inline-SVG icon set** (in `NodeIcon.tsx`), one glyph per SQL object type: `server` (stacked bars + green online dots), `database` (cylinder), `table`, `view` (eye), `column`, `key`, `index`, `procedure`, `function` (italic *fx*), `user`, `diagram`, `folder`. They're drawn in **`currentColor`** at 16px so they inherit the row's text color, with a 1.2 stroke weight for outlined glyphs. **This is the brand's most distinctive iconography** — recreated exactly as the `NodeIcon` component (`components/explorer/`). Use it; don't redraw these.
- **General UI icons:** the app uses **`lucide-react`** (per `package.json`). For new designs, pull Lucide icons (CDN: `https://unpkg.com/lucide-static`) at a matching ~1.5px stroke weight to stay consistent. A few one-off controls in source use tiny hand-rolled SVGs (the connection delete "×", the expand chevron) — keep those simple and monochrome.
- **Status as iconography:** small **colored dots** carry a lot of meaning — green = online server, and the per-connection color dots. Unicode glyphs stand in for toolbar affordances: `▶` execute, `▶|` execute-selection, `■` cancel, `•` dirty/unsaved, `×` close.
- **Emoji:** not used as iconography (the lone 🔒 in the security folder glyph aside). Don't introduce emoji.
- **App icon:** see `assets/` — the primary mark is the **data-stack** (the Object Explorer's own server glyph, elevated): three white rounded bars on accent blue with two green online dots. Alternates (`icon-alt-cylinder.svg`, `icon-alt-x.svg`) and a monochrome mark (`icon-mono.svg`) are provided. **Pick the final direction in `assets/icon-directions.html`.**

---

## What's in here (index)

**Foundations**
- `styles.css` — the single entry point consumers link; `@import`s every token file.
- `tokens/colors.css` · `typography.css` · `spacing.css` · `radius.css` · `motion.css` — all CSS custom properties.

**Brand & assets** (`assets/`)
- `icon.svg`, `icon-1024.png`, `icon-256.png` — primary app mark (data-stack).
- `icon-mono.svg` — monochrome mark for small/menu-bar use.
- `logo-lockup.svg` — mark + SSMSx wordmark.
- `icon-alt-cylinder.svg`, `icon-alt-x.svg` — alternate directions.
- `icon-directions.html` — the four explored directions, for picking the final.

**Components** (`components/`) — reusable React primitives, namespace `window.SSMSxDesignSystem_453330`
- `core/` — `Button`, `Input`
- `data/` — `Badge`, `ConnectionItem`
- `explorer/` — `NodeIcon`, `TreeRow`
- `navigation/` — `QueryTab`
- `overlay/` — `ContextMenu`

**UI kit** (`ui_kits/ssmsx-desktop/`)
- `index.html` — the full, interactive workbench: empty state → connection dialog → object explorer + query editor + results grid + status bar. Composes the components above.

**Specimen cards** (`guidelines/`) — the cards rendered in the Design System tab (Colors, Type, Spacing, Brand).

**Skill** — `SKILL.md` makes this folder usable as an Agent Skill in Claude Code.

---

## Using it

Consumers link one file and read components off the namespace:

```html
<link rel="stylesheet" href="styles.css" />
<script src="_ds_bundle.js"></script>
<script type="text/babel">
  const { Button, TreeRow, NodeIcon } = window.SSMSxDesignSystem_453330;
</script>
```

All styling flows through the CSS custom properties in `tokens/` — reference `var(--accent)`, `var(--surface-panel)`, `var(--text-secondary)`, etc., rather than hard-coding hex values, so everything stays in sync.
