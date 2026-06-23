---
name: ssmsx-design
description: Use this skill to generate well-branded interfaces and assets for SSMSx (a fast, cross-platform SQL Server Management Studio replacement), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `readme.md` file within this skill, and explore the other available files (`tokens/`, `components/`, `ui_kits/`, `assets/`, `guidelines/`).

SSMSx is a light-themed, information-dense desktop SQL Server client (Tauri + React + C# sidecar). The look is utilitarian: layered cool grays, one blue accent (`#0063B2`), 1px borders instead of shadows, native OS fonts, a tight 4px grid, and per-connection color dots. No gradients, no imagery, minimal motion, no emoji.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. Link `styles.css` for tokens and reference components via `window.SSMSxDesignSystem_453330` after loading `_ds_bundle.js`. The Object Explorer `NodeIcon` set is the brand's signature iconography — reuse it, don't redraw it.

If working on production code, copy assets and read the rules here to become an expert in designing with this brand. The real product source is at https://github.com/GordonBeeming/ssmsx — consult `src/features/` for canonical layout and behavior.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
