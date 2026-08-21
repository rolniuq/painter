# UI Redesign — Board + Tools Bar

Date: 2026-08-21

## Overview

Redesign the Auto Doodler UI from a stacked document layout into two vertical sections: a drawing **board** on top (canvas presented as a white paper sheet on a light gray workspace) and a single **tools bar** below it. The tools bar adds four new user-selectable options — cursor shape, ink color, pen size, and draw speed — alongside the existing upload, style, start, and download controls. The image-to-strokes pipeline is untouched.

## Goals

- tldraw-inspired look: floating white chrome, soft shadows, rounded corners, inline SVG icons, zero dependencies.
- All controls visible in one bar; no popovers, no hidden menus.
- New options (shape, color, size, speed) compose with the existing style presets without changing stage contracts.

## Non-Goals

- No undo/redo, playback controls, or hand-drawing with the mouse (unchanged from original spec).
- No persistence of tool options across reloads (no localStorage).
- No popover/panel UI system.
- Cursor shape is purely cosmetic: it does not alter stroke geometry, width, or character.

## Layout

### Board (top section)

- Fills all remaining viewport height above the toolbar (`flex` column on `body`).
- Workspace background `#f2f3f5`; canvas centered as a white sheet with 8px corner radius and a soft shadow.
- Canvas scales to fit the available area while preserving aspect ratio and never exceeding the loaded image's pixel size.
- Status messages render as a small badge pinned to the top edge of the board. Success messages auto-hide after a few seconds; errors stay until replaced.

### Tools bar (bottom section)

One white bar (~56px tall) attached to the bottom of the viewport, groups separated by 1px vertical dividers (`#e5e7eb`), left to right:

| Group   | Control                                                                                                                                                         | Behavior                                                           |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| File    | Upload button (styled label over hidden `<input type="file">`)                                                                                                  | Opens file picker; shows chosen filename in its tooltip            |
| Cursor  | 6 icon buttons: `pen`, `pencil`, `marker`, `brush`, `crayon`, `calligraphy`                                                                                     | Selects cursor sprite; selected state = accent-tinted background   |
| Style   | Segmented control: `doodle`, `cartoon`, `sketch`                                                                                                                | Same values as `BrushConfig.presets()` keys (existing contract)    |
| Color   | 8 swatches (`#000000`, `#ef4444`, `#f97316`, `#eab308`, `#22c55e`, `#3b82f6`, `#8b5cf6`, `#ec4899`) + one custom swatch opening a native `<input type="color">` | Sets ink color; default black                                      |
| Size    | 3 dot-size buttons: `thin`, `medium`, `thick`                                                                                                                   | Multiplies preset width by 0.6 / 1 / 1.8 via `BrushConfig.resolve` |
| Speed   | Range slider 40–300 px/s, default 120                                                                                                                           | Passed directly to `CursorPlayer` `speed` option                   |
| Actions | Start Drawing (primary accent), Download PNG (secondary outline)                                                                                                | Enable/disable rules unchanged                                     |

The bar uses `flex-wrap`: on narrow screens it wraps into multiple rows without dedicated breakpoints.

## Visual language

CSS custom properties defined once on `:root` (tldraw-ish palette): text `#1a1a1a`, muted text `#6b7280`, surface `#ffffff`, workspace `#f2f3f5`, border `#e5e7eb`, accent `#2563eb`, accent tint for selected tools. Icon buttons are 32×32 with hover background; icons are hand-drawn inline SVGs (no icon library).

## Architecture changes

### `index.html`

Restructured into `.workspace` (containing canvas + status badge) and `.toolbar` (tool groups). All icons inline SVG. Hidden file input retained with its current id.

### `styles.css`

Rewritten using the CSS variables above. No framework, no new files served beyond the existing two.

### `src/App.js`

- Holds `_options = { shape, color, size, speed }` updated by control listeners; changing options never interrupts an active drawing session.
- On start, composes the final brush via `BrushConfig.resolve(styleSelectValue, _options.size)` and passes `{ brush, color, cursorShape, speed }` to `CursorPlayer`.
- Status text moves to the board badge via a `_setStatus(text, { sticky })` helper.

### `src/CursorPlayer.js`

- Accepts new options: `color` (ink color, default black) and `cursorShape`.
- Adds an exported `CURSOR_SHAPES` registry mapping shape ids to sprite draw functions (Path2D-based). Unknown shape id falls back to `pen`. Shape rendering remains internal to this module — no cross-stage imports.

### `src/BrushConfig.js`

- Adds static `resolve(style, size)` returning `{ ...preset, width }` with width multiplied by the size factor (0.6/1/1.8, rounded). Unknown style falls back to `cartoon`; unknown size falls back to `medium`. Pure and unit-testable.

### Unchanged

`ImageLoader`, `EdgeDetector`, `ContourBuilder`, `StrokePlanner`, all inter-stage contracts, white-backed PNG export via `_onDownload`.

## Data flow (UI additions only)

```
User picks shape/color/size/speed
   │
   ▼
App._options  ──(on Start)──►  BrushConfig.resolve(style, size) → brush
   │
   ▼
CursorPlayer({ ctx, inkCtx, brush, color, cursorShape, speed })
```

## Error handling

No new error paths. Invalid colors cannot come from `<input type="color">`; slider bounds are enforced by the input itself; unknown shape/style/size values fall back defensively inside `CursorPlayer`/`BrushConfig.resolve`. All messages still funnel through the status badge.

## Testing

Node `node:test` + `node:assert`, one file per module, existing 24 tests must pass unchanged:

- **BrushConfig** — `resolve` returns correct multipliers per size key; unknown style → cartoon base; unknown size → medium factor; original presets object not mutated.
- **CursorPlayer** — custom `color` produces ink pixels of that color; unknown `cursorShape` falls back without throwing; `done` still fires exactly once (existing coverage extended).
- Visual layout verified manually in the browser (unchanged policy: no browser automation).

## Final Approval

Design presented in three sections (Layout & Visual, Tools & Architecture, Edge Cases & Scope) and approved by the user on 2026-08-21.
