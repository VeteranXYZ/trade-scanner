# VegaRank Visual Hierarchy

VegaRank should feel like a compact professional crypto research terminal. The UI is desktop-first, table-first, and built for repeated scanning rather than marketing presentation.

## Design Goals

- Prioritize ranked research decisions over decorative content.
- Keep page headers, summaries, and filters compact enough that rows are visible early.
- Use calm, low-saturation status color with readable contrast.
- Keep primary actions visible and keyboard-accessible.
- Preserve existing scoring, API, storage, schema, export, and route behavior.

## Information Priority

P0 data must be immediately visible in rows or the active decision header: symbol, research group, action, rank score, risk context, and updated time.

P1 data supports the decision and should remain close to P0: confidence, setup, evidence quality, timeframe, run status, and agreement.

P2 data provides operational context and should be compact: summary counts, universe size, active filters, validation readiness, and snapshot metadata.

P3 data is diagnostic and should be muted, collapsed, or lower on the page: raw codes, version fields, long explanations, internal source notes, and deep diagnostics.

## Page Hierarchy

Primary app pages should use this order:

1. Compact command/header strip.
2. Short purpose copy only when needed.
3. Summary strip.
4. Filter bar or active controls.
5. Main table, chart, or selected research workspace.
6. Secondary detail panels and diagnostics.

Do not use hero layouts on app pages. Do not redesign the home page as a landing page during visual polish phases.

## Summary Strips

Summary cells use small uppercase labels, tabular numeric values, and optional low-saturation tone accents. They should remain one or two compact rows on desktop and wrap safely on smaller widths.

Use summary strips for run status, universe size, visible rows, selected counts, validation readiness, and snapshot freshness. Avoid large stat cards unless the page has no table-first workflow.

## Filter Bars

Filters should fit a single row on desktop where practical and wrap cleanly at smaller widths. Controls should stay around 32px high or less when the existing component system allows it.

Clear Filters, Refresh, Open Research, Add/Remove Watchlist, and major row actions must remain visible or keyboard-accessible. Essential actions must not be hover-only.

## Tables

Tables are the core VegaRank surface. Use compact readable row heights, sticky headers where useful, tabular numeric cells, visible text labels inside badges, and contained horizontal scrolling on small screens.

Scores use a consistent decimal style. Percentages use a consistent decimal style. Counts are integer-formatted. Timestamps use the VegaRank date/time format. Do not expose camelCase metric names in visible UI.

## Badges And Status

Badges always include text labels; color is secondary. Research categories use low-saturation tones:

- High priority and general emphasis: muted blue.
- Research eligible and completed states: muted green.
- Watch and pending states: muted amber or observation tone.
- Risk states: muted rose.
- Overheated states: muted orange.
- Missing, unavailable, and insufficient history: gray.

Colors describe research category and risk context. They must not imply trading instructions.

## Detail Panels

Detail panels should group label/value rows, metric grids, evidence quality, risk context, and version diagnostics. Diagnostics belong in details sections or lower-priority panels where possible.

Avoid long unstructured paragraphs, repeated headings, nested cards, and large empty blocks.

## Mobile Baseline

Mobile does not need a custom table system in this phase. The baseline is:

- No root or main horizontal overflow.
- No overlapping major content.
- Controls wrap or stack safely.
- Tables scroll horizontally inside their own containers.
- Primary actions remain visible or keyboard-accessible.

Desktop density should not be sacrificed for mobile perfection.

## Intentionally Unchanged

Visual polish must not change quant scoring formulas, code registry semantics, API routes, API response shape, database schema, storage filters, production scripts, CSV/export schemas, or route names.
