# PoC: attribute marker selectors for light-DOM Lumo

Proof of concept for replacing `vaadin-*` **tag-name selectors** in the light-DOM Lumo package
(`proto/lumo-light-dom` → `packages/lumo`) with a **component-stamped marker attribute**:

```css
/* before */                              /* after */
:where(vaadin-button,                     :where([vaadin-role~='button']) { … }
       vaadin-menu-bar-button,
       vaadin-message-input-button) { … }
```

```html
<vaadin-button>…</vaadin-button>
<!-- stamps vaadin-role="button" itself -->
<a vaadin-role="button" href="…">…</a>
<!-- plain element opts in (#1803) -->
<x-button>…</x-button>
<!-- subclass under any tag: inherits marker (#7055) -->
```

Run it:

```bash
npm install
npm start          # dev server (@web/dev-server, serves source with node-resolve)
npm run build      # static build to dist/ (rollup + @web/rollup-plugin-html, CSS @imports inlined)
npm run preview    # build + serve dist/
```

Pushing to GitHub deploys `dist/` to GitHub Pages automatically (`.github/workflows/deploy.yml`;
enable Pages with source "GitHub Actions" in the repo settings).

## Why move off tag names

Measured on `proto/lumo-light-dom:packages/lumo` (2026-08-21):

- **1,113 `vaadin-*` tag mentions** package-wide.
- `button.css` repeats its 3-tag family list ~30× (148 tag mentions in one file).
- `field.css` / `input-container.css` maintain hand-written **16-tag / 10-tag family lists**; every
  new field component means editing shared theme files.
- Tag-keyed selectors exclude three consumer groups entirely:
  1. **Renamed subclasses** ([#7055](https://github.com/vaadin/web-components/issues/7055)).
  2. **Plain HTML elements** ([#1803](https://github.com/vaadin/web-components/issues/1803), open since 2017 —
     links styled as buttons; [PR #11771](https://github.com/vaadin/web-components/pull/11771) closed 2026-06
     pending exactly this research).
  3. **Third-party components** that reuse Vaadin mixins/parts and could otherwise join a style family.

## Options considered

### A. Classes — `.v-button`, `.v-badge`, role classes `.v-field`

The Valo-era approach (V8 literally used `.v-button`), and what PR #11771 tried (`.aura-button`).

- **Pros:** familiar; fastest selector matching; trivial manual opt-in; composes (`class="v-button my-btn"`).
- **Cons (disqualifying as the _auto-stamped_ marker):** `class` is user-owned real estate. React
  `className=`, Lit `class=${…}`, Vue `:class`, and utility-CSS workflows **overwrite the whole attribute** —
  a component-stamped class is silently wiped and the component silently loses its theme (the exact failure
  mode light-DOM Lumo is trying to eliminate). Short `.v-*` names can also collide with app utility classes.
  Component code and user code fighting over one attribute needs observer-based re-stamping — fragile.

### B. Dedicated attribute — `vaadin-role~="button"` ← **recommended, this PoC**

A token-list attribute owned by Vaadin, mirroring the established `theme~="…"` idiom:

- The component stamps its own tokens in `connectedCallback` (constructors may not set attributes).
  Tokens compose along the inheritance/mixin chain: `TextField` → `vaadin-role="text-field field input"` —
  component token from the class, **role tokens** from the mixins (`field` = FieldMixin family,
  `input` = input-container family). The 16-tag and 10-tag lists collapse to
  `:where([vaadin-role~='field'])` / `:where([vaadin-role~='input'])`, and the family becomes _open_: any component
  stamping the role joins it.
- Frameworks **merge** attributes; nothing in normal app code rewrites an attribute it doesn't know.
  Stamping merges tokens and never clobbers user-authored ones.
- Plain elements opt in manually: `<a vaadin-role="button">` — works in static HTML and SSR.
- Subclasses inherit stamping under any tag name (fixes #7055); a subclass wanting _isolation_
  (the Copilot case in #7055) overrides the token contribution to opt out — the attribute gives a switch in
  both directions, where tags give neither.
- Specificity is identical to classes when wrapped in `:where()` (0,0,0) — the "users override with a bare
  tag/class selector" story of light-DOM Lumo is unchanged.

Variants:

- **`data-vaadin-role~="…"`** — HTML-validator-clean; more verbose. Vaadin already ships non-`data` attributes
  (`theme`, `has-label`, `focus-ring`), so plain `vaadin-role` follows existing practice — and becomes
  spec-legal anyway if WICG custom attributes land (see below). Team decision.
- **Per-component boolean attributes** (`vaadin-button` → `[vaadin-button]`) — no token composition in one
  attribute; role markers become N attributes; noisier DOM. But maps 1:1 onto the WICG custom-attributes
  proposal (see below), which is registration-per-attribute-name.
- **Avoid `v-*`**: Vue claims the `v-*` attribute namespace for directives — `<a v-button>` inside a Vue
  template is parsed as an unknown directive. `vaadin-*` is collision-free.

### Standards trajectory: WICG custom attributes ([WICG/webcomponents#1029](https://github.com/WICG/webcomponents/issues/1029))

Lea Verou's *custom attributes* proposal (2023, active — scoped-down explainer started 2025-12 at
[`webplatformco/project-custom-attributes`](https://github.com/webplatformco/project-custom-attributes)) is
the platform-level version of this exact pattern: an `Attribute` class with
`connectedCallback`/`disconnectedCallback`/`changedCallback`, registered per attribute name via
`HTMLElement.attributeRegistry.define(…)` — on built-ins and custom elements alike. Its "complex
enhancements" tier cites lume's `has="a b c"` token-list attribute (the same shape as `vaadin-role~="…"`) as
prior art. No browser implementation yet; treat as direction, not dependency.

How it bears on this design:

1. **It validates the mechanism.** Attributes as composable, element-type-independent behavior/identity
   carriers — applied to built-ins — is exactly the marker model. The proposal's htmx example even uses
   attribute selectors as the activation mechanism.
2. **It constrains naming — the one decision to make *now*.** The thread (2026-01) converges on the platform
   reserving **hyphenated attribute names** for custom attributes, mirroring custom-element naming. A bare,
   hyphen-less `vaadin` attribute sits *outside* that namespace forever: it could never be upgraded to a
   registered custom attribute, and stays spec-invalid with no path to legitimacy. A hyphenated name
   (`vaadin-role="button field input"`, or boolean `vaadin-button`) sits *inside* it: if the proposal ships,
   the marker becomes registrable and thereby spec-legal — retroactively killing the `data-` argument.
3. **It offers an upgrade path that closes the recipe gaps.** Today `<a vaadin-button>` is styling-only; the
   fidelity gaps (no `[active]` reflection, no `disabled` semantics, no `role` management) are hand-waved or
   approximated with `:active`. A registered `VaadinButtonAttribute` behavior could add exactly those on
   plain elements with lifecycle callbacks — turning the recipes layer from "CSS-only look-alike" into a real
   lightweight enhancement, without changing a single selector.
4. **Token list vs boolean attributes both survive**, if hyphenated. Registration is per attribute *name*,
   but an attribute's *value* syntax is author-defined — a single `vaadin-role` custom attribute can parse a
   token list and attach per-token behaviors (the proposal itself shows one attribute imperatively adding
   several behaviors). Boolean-per-component maps more directly (one name = one behavior class) at the cost
   of N attributes per element.
5. **What it does not change:** Vaadin components still stamp their own markers in `connectedCallback` —
   custom attributes fire behavior when *authors* write attributes; automatic component identity still comes
   from the component. And the proposal being pre-implementation means the marker must work today as an
   inert attribute + CSS selector — which it does.

**Net effect on the recommendation:** keep the token-list attribute, but name it hyphenated —
`vaadin-role~="button"` (or similar) instead of a bare, hyphen-less `vaadin~="button"` — so the marker is
forward-compatible with #1029, Vue-safe, and eventually spec-legal. This PoC uses `vaadin-role`.

### C. Hybrid — `:where(vaadin-button, [vaadin-role~='button'])`

Migration/coexistence strategy, not an end state: keeps pre-upgrade (FOUC-window) and no-JS styling while
markers roll out. Could be generated from one logical name by PostCSS. Reasonable for a transition release.

### D. Custom states — `:state(vaadin-button)`

`ElementInternals.states` is component-owned and can't be clobbered at all — but **plain HTML elements can
never opt in** (no HTML syntax, no ElementInternals on built-ins), it's invisible to SSR, and DevTools
discoverability is poor. Rejected as primary; could complement later for pure-state selectors.

### E. Keep tags + documented PostCSS rename transform

A supported build-time selector rewrite would let subclass consumers re-key the published CSS.
Cheap stopgap for 25.x; solves renaming only — no plain elements, no list reduction. Complement, not answer.

### Decision drivers (summary)

| Driver                           | Classes        | Attribute         | Custom states | Tags + codemod |
| -------------------------------- | -------------- | ----------------- | ------------- | -------------- |
| Survives user/framework code     | ✗ (class wipe) | ✓                 | ✓✓            | ✓              |
| Plain-element opt-in in HTML/SSR | ✓              | ✓                 | ✗             | ✗              |
| Subclass/re-tag support          | ✓ (if stamped) | ✓                 | ✓             | ✓ (build step) |
| Role tokens / open families      | ✓              | ✓ (one attr)      | ✓             | ✗              |
| Theme-agnostic naming (#11771)   | ✓              | ✓                 | ✓             | n/a            |
| No-JS / pre-upgrade styling      | ✗              | ✗ (SSR mitigates) | ✗             | ✓              |

## What this PoC contains

| Path                                                        | What it shows                                                                                                                                                                                                                      |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/button.css`                                 | 3-tag family list × ~30 → single `[vaadin-role~='button']`; NOTEd coexistence leftovers (`vaadin-icon`)                                                                                                                                 |
| `src/components/field.css`                                  | 16-tag list → `[vaadin-role~='field']` role + `group-field` sub-role; zero tag names                                                                                                                                                    |
| `src/components/input-container.css`                        | 10-tag list → `[vaadin-role~='input']` role                                                                                                                                                                                             |
| `src/components/text-area.css`, `checkbox.css`, `badge.css` | Straight tag→marker ports                                                                                                                                                                                                          |
| `src/recipes/button.css`, `badge.css`                       | Plain-element opt-in (#1803): light-DOM re-publication of the base `:host` block. **Should be build-generated from `*-base-styles.js`** — answers jouni's "copy-paste feels dirty" in #11771; theme-agnostic (Aura would reuse it) |
| `src/marker-stamp.js`                                       | PoC stand-in for native stamping (`instanceof`-based). Natively: one line in a base mixin's `connectedCallback`, tokens contributed per class/mixin, opt-out by override                                                           |
| `index.html`                                                | Side-by-side: component / `<a vaadin-role="button">` / re-tagged `<x-button>`; role-token fields; **"wipe classes" control proving attribute robustness**; color-scheme toggle                                                          |
| Token files (`src/*.css`)                                   | Verbatim from `packages/lumo` — selector-agnostic, untouched by this change                                                                                                                                                        |

## Results

Verified 2026-08-21 against `@vaadin/*@25.3.0-alpha9` (Playwright, Chromium): light and dark
(`color-scheme` flip on `light-dark()` tokens) — see `screenshots/demo-light.png` /
`screenshots/demo-dark.png`. Stamped attributes confirmed in the DOM
(`vaadin-text-field` → `vaadin-role="text-field field input"`, `x-button` → `vaadin-role="button"`); a
user-authored token (`vaadin-role="my-custom"`) is preserved through stamping (`"my-custom button"`);
wiping `class` on every marked element leaves computed styles unchanged.

- Ported component files contain **zero `vaadin-*` tag selectors** except two documented coexistence
  leftovers (`vaadin-icon`, `vaadin-password-field-button`), each marked `NOTE:`.
- The shared field/input files went from 26 hand-listed tags to **2 role tokens**.
- Re-tagged `Button` subclass renders pixel-identical to `vaadin-button`, including theme variants —
  today it renders base-only.
- `<a vaadin-role="button">` / `<span vaadin-role="badge">` get the full Lumo look with native anchor behavior,
  via ~45 recipe lines per component (generatable from base styles).
- Wiping `class` on every element changes nothing — the same action breaks the class-marker design.

## Open questions for the team

1. **Naming:** hyphenated `vaadin-role~=` (WICG #1029-compatible, Vue-safe — see "Standards trajectory")
   vs bare `vaadin~=` (shortest, matches `theme` precedent, but permanently outside the custom-attributes
   namespace) vs `data-vaadin-role~=` (validator-clean today; moot if #1029 lands)? Exact second half of the
   hyphenated name also open: `vaadin-role`, `vaadin-is`, `vaadin-style`, …
2. **Stamping mechanism:** which mixin owns it (`ElementMixin`? a new `MarkerMixin`?), the token
   contribution API (`static get markers()`?), and the opt-out story for isolation consumers (#7055).
3. **FOUC:** accept the `connectedCallback` window, hybrid tag+marker selectors during migration (option C),
   or Flow-side SSR stamping (server renders `vaadin-role="…"` upfront — kills the window entirely)?
4. **Recipes layer:** which components get plain-element recipes (button, badge — what else?), generated
   from base styles or hand-written, and where do they live — theme package or a utility package
   (rolfsmeds' point in #11771)? Plus a11y guidance for links-as-buttons.
5. **Token vocabulary:** component tokens = tag name minus prefix? Role tokens per mixin (`field`, `input`,
   `group-field`, `button-effects` for drawer-toggle)? Needs an authoritative list.
6. **Aura:** same markers, same day? (Aura's `button.css` repeats a 5-tag list ~20× — same win.)

## Relationship to existing work

- Builds on `proto/lumo-light-dom` (`packages/lumo`) branch.
- Continues [PR #11771](https://github.com/vaadin/web-components/pull/11771)'s closure note: "requires
  research and further work and should be scheduled explicitly after the open questions are resolved."
