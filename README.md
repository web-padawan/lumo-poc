# Light-DOM Lumo: marker attributes instead of tag names

A proof of concept for the light-DOM Lumo theme (`proto/lumo-light-dom` → `packages/lumo`).

## TL;DR

Use token-list attribute selectors instead of hardcoded `vaadin-*` tag names.

```css
/* today */                               /* this PoC */
:where(vaadin-button,                     :where([vaadin-role~='button']) { … }
       vaadin-menu-bar-button,
       vaadin-message-input-button) { … }
```

```html
<vaadin-button>…</vaadin-button>          <!-- sets vaadin-role="button" -->
<a vaadin-role="button">…</a>             <!-- link styled as button -->
<button vaadin-role="button">…</button>   <!-- plain native button element -->
<custom-button>…</custom-button>          <!-- subclass with a custom tag name -->
```

## Related issues

- **[#1803 — \[lumo\] Styling links as buttons](https://github.com/vaadin/web-components/issues/1803)**
- **[#7055 — Support renaming elements and using multiple tags on the same page without conflicts](https://github.com/vaadin/web-components/issues/7055)**
- **[#8237 — Utility classes that encapsulate common styling needs for native html elements](https://github.com/vaadin/web-components/issues/8237)**
- **[PR #11771 — feat: add aura-button class to style anchors as buttons](https://github.com/vaadin/web-components/pull/11771)**

## Problems

| Problem                    | Today                                             | With the marker                    |
| -------------------------- | ------------------------------------------------- | ---------------------------------- |
| Links as buttons           | not supported — copy CSS by hand                  | `<a vaadin-role="button">`         |
| Divs as badges             | only via the legacy `theme="badge"` module        | `<div vaadin-role="badge">`        |
| Customizing tag names      | re-tagged subclass renders unstyled               | `<custom-button>` inherits Lumo    |
| Family lists in `:where()` | 16 hand-listed tags in `field.css`                | one `[vaadin-role~='field']` token |

## Selector benefits

Measured on `proto/lumo-light-dom:packages/lumo` (2026-08-21):

- **1,113** `vaadin-*` tag mentions package-wide.
- `button.css` repeats its 3-tag family list ~30 times — **148** tag mentions in a single file.
- `field.css` and `input-container.css` maintain hand-written **16-tag** and **10-tag** family lists.

Every new field component means editing shared theme files, and every list is one more place to forget
a tag. Role tokens replace the lists: `field.css` selects `[vaadin-role~='field']`,
`input-container.css` selects `[vaadin-role~='input']`, and the families become *open* — any component
that stamps the role joins, including third-party components that reuse Vaadin mixins and parts.

## How the marker works

- **The component stamps itself** in `connectedCallback` (the spec forbids attribute mutation in
  constructors). `src/marker-stamp.js` is the PoC stand-in; natively it is one line in a base mixin.
- **Tokens compose along the inheritance chain.** `TextField` ends up with
  `vaadin-role="text-field field input"`: the component token from the class, the role tokens from the
  mixins (`field` from FieldMixin, `input` from the input-container family).
- **Attributes survive user and framework code.** React `className=`, Lit `class=${…}`, Vue `:class`
  and utility-CSS workflows overwrite the whole `class` attribute; nothing rewrites an attribute it
  does not know about. Stamping merges tokens and never clobbers author-written ones.
- **Plain elements opt in by hand**, in static HTML and in SSR output — no JS required.
- **Specificity is unchanged.** Wrapped in `:where()` the marker scores (0,0,0), exactly like the
  current tag selectors, so light-DOM Lumo's "users override with a plain selector" story still holds.

## What is in the PoC

| Path                                 | What it shows                                                              |
| ------------------------------------ | -------------------------------------------------------------------------- |
| `src/components/button.css`          | 3-tag family list × ~30 → one `button` token; 2 coexistence leftovers      |
| `src/components/field.css`           | 16-tag list → `field` role + `group-field` sub-role; zero tag names        |
| `src/components/input-container.css` | 10-tag list → `input` role                                                 |
| `src/components/text-area.css`       | Straight tag → marker port                                                 |
| `src/components/checkbox.css`        | Straight tag → marker port                                                 |
| `src/components/badge.css`           | Straight tag → marker port; same file serves component and plain elements  |
| `src/recipes/button.css`             | `<a>` / `<button>` opt-in: the base `:host` block re-published, ~45 lines  |
| `src/recipes/badge.css`              | `<span>` / `<div>` / `<a>` opt-in, ~25 lines                               |
| `src/marker-stamp.js`                | PoC stand-in for native stamping (`instanceof`-based)                      |
| `index.html`                         | The six demo sections, including the "wipe all classes" control            |
| `src/*.css` (tokens)                 | Verbatim from `packages/lumo` — selector-agnostic, untouched                |

Two notes on the recipes layer:

- It should be **build-generated** from the components' `*-base-styles.js`, not hand-copied. That
  answers the "copy-paste feels dirty" objection raised in PR #11771.
- It is **theme-agnostic** — the structural base block is the same for Lumo and Aura, so Aura reuses it.

## Options considered

### A. Classes — `.v-button`, `.v-field`

The Valo-era approach (Vaadin 8 literally used `.v-button`), and what PR #11771 tried.

Familiar, fast to match, trivial to write by hand, and composable. Disqualifying flaw *as the
auto-stamped marker*: `class` is user-owned real estate. Frameworks replace the whole attribute, so a
component-stamped class is silently wiped and the component silently loses its theme — the exact
failure mode light-DOM Lumo exists to eliminate. Keeping it alive needs observer-based re-stamping,
and short `.v-*` names collide with app utility classes.

### B. Dedicated attribute — `[vaadin-role~='button']` ← recommended, this PoC

A token-list attribute owned by Vaadin, mirroring the established `theme~='…'` idiom. See
[How the marker works](#how-the-marker-works). Variants within this option:

- **`data-vaadin-role`** — HTML-validator-clean, more verbose. Vaadin already ships non-`data`
  attributes (`theme`, `has-label`, `focus-ring`), and a hyphenated name becomes spec-legal anyway if
  WICG custom attributes land. Team decision.
- **Per-component boolean attributes** (`[vaadin-button]`) — no token composition, so role markers
  become N attributes and the DOM gets noisier. But it maps 1:1 onto the WICG proposal, which
  registers per attribute *name*.
- **Avoid `v-*`** — Vue claims that namespace for directives; `<a v-button>` inside a Vue template
  parses as an unknown directive. `vaadin-*` is collision-free.

### C. Hybrid — `:where(vaadin-button, [vaadin-role~='button'])`

A migration strategy, not an end state. Keeps pre-upgrade (FOUC-window) and no-JS styling working
while markers roll out, and could be generated from one logical name by PostCSS. Reasonable for a
transition release.

### D. Custom states — `:state(vaadin-button)`

`ElementInternals.states` is component-owned and cannot be clobbered at all. But plain HTML elements
can never opt in (no HTML syntax, no `ElementInternals` on built-ins), it is invisible to SSR, and
DevTools discoverability is poor. Rejected as the primary mechanism; could complement it later for
pure-state selectors.

### E. Keep tags + a documented PostCSS rename transform

A supported build-time selector rewrite would let subclass consumers re-key the published CSS. A cheap
stopgap for 25.x, but it solves renaming only — no plain elements, no shorter family lists.

### Decision drivers

| Driver                           | Classes        | Attribute         | Custom states | Tags + codemod |
| -------------------------------- | -------------- | ----------------- | ------------- | -------------- |
| Survives user/framework code     | ✗ (class wipe) | ✓                 | ✓✓            | ✓              |
| Plain-element opt-in in HTML/SSR | ✓              | ✓                 | ✗             | ✗              |
| Subclass / re-tag support        | ✓ (if stamped) | ✓                 | ✓             | ✓ (build step) |
| Role tokens / open families      | ✓              | ✓ (one attribute) | ✓             | ✗              |
| Theme-agnostic naming (#11771)   | ✓              | ✓                 | ✓             | n/a            |
| No-JS / pre-upgrade styling      | ✗              | ✗ (SSR mitigates) | ✗             | ✓              |

## Standards trajectory: WICG custom attributes

Lea Verou's *custom attributes* proposal ([WICG/webcomponents#1029](https://github.com/WICG/webcomponents/issues/1029),
2023, active — scoped-down explainer started 2025-12 at
[`webplatformco/project-custom-attributes`](https://github.com/webplatformco/project-custom-attributes))
is the platform-level version of this pattern: an `Attribute` class with
`connectedCallback`/`disconnectedCallback`/`changedCallback`, registered per attribute name via
`HTMLElement.attributeRegistry.define(…)`, on built-ins and custom elements alike. Its "complex
enhancements" tier cites lume's `has="a b c"` token-list attribute — the same shape as `vaadin-role` —
as prior art. No browser implements it yet: treat it as direction, not dependency.

Three things follow for this design.

1. **It validates the mechanism.** Composable, element-type-independent attributes carrying identity
   and behavior — including on built-ins — is exactly the marker model. The proposal's own htmx
   example uses attribute selectors as the activation mechanism.
2. **It constrains naming, and that is the decision to make now.** The thread converges (2026-01) on
   the platform reserving **hyphenated** attribute names for custom attributes, mirroring
   custom-element naming. A bare `vaadin` attribute would sit outside that namespace forever: never
   upgradable, permanently spec-invalid. A hyphenated `vaadin-role` sits inside it and becomes
   registrable — retroactively killing the `data-` argument.
3. **It offers an upgrade path for the recipes layer.** Today `<a vaadin-role="button">` is
   styling-only; the fidelity gaps (no `[active]` reflection, no `disabled` semantics, no `role`
   management) are approximated with `:active`. A registered `VaadinButtonAttribute` could add exactly
   those to plain elements via lifecycle callbacks — turning recipes from "CSS look-alike" into a real
   lightweight enhancement, without changing a single selector.

What it does not change: components still stamp their own markers, because custom attributes fire when
*authors* write attributes, while automatic identity comes from the component. And since it is
pre-implementation, the marker must work today as an inert attribute plus a CSS selector — which it does.

**Net effect:** keep the token-list attribute, but name it hyphenated. This PoC uses `vaadin-role`.

### How #8237 maps onto markers

The [#8237](https://github.com/vaadin/web-components/issues/8237) epic asks for "utility classes that
encapsulate common styling needs for native html elements". Its use cases are the recipes layer of this
PoC, one marker token each:

| #8237 use case                                            | Marker form                                | In this PoC                                |
| --------------------------------------------------------- | ------------------------------------------ | ------------------------------------------ |
| Style a `<label>` / `NativeLabel` as a field label        | `<label vaadin-role="field-label">`        | not covered — no recipe yet                |
| Style a link as a Button (hover, focus, disabled, primary) | `<a vaadin-role="button">`                 | ✓ demo section 2                           |
| Style a link as a menu item (focus and hover styles)      | `<a vaadin-role="item">`                   | not covered — no item styles in this PoC   |
| Style a native `<input type="text">` (or a div) as a TextField | `vaadin-role="field"` / `"input"` roles | partly — role tokens exist, no recipe      |
| Refactor badges off `theme`-attribute styling             | `<span vaadin-role="badge">`               | ✓ demo section 4                           |

Two notes on the difference between the epic's framing and this proposal:

- **Classes are fine for hand-written opt-in** — the author owns the `class` attribute they type, so
  nothing clobbers it. The problem is that classes cannot be the *component's* marker (see option A),
  which leaves you maintaining two selector sets for every rule: utility classes for plain elements and
  tag names for components. One `vaadin-role` token serves both, from the same declaration block.
- **The epic's "move away from `theme`-based styling" applies to element identity, not variants.** This
  PoC replaces the identity selector and deliberately keeps `theme~='primary'` for variants. Whether
  variants should also move is a separate question.

## Open questions for the team

1. **Naming.** Hyphenated `vaadin-role~=` (WICG-compatible, Vue-safe) vs bare `vaadin~=` (shortest,
   matches the `theme` precedent, permanently outside the custom-attribute namespace) vs
   `data-vaadin-role~=` (validator-clean today, moot if #1029 lands)? The second half is open too:
   `vaadin-role`, `vaadin-is`, `vaadin-style`, …
2. **Stamping mechanism.** Which mixin owns it (`ElementMixin`, or a new `MarkerMixin`)? What is the
   token-contribution API (`static get markers()`)? What is the opt-out story for isolation
   consumers (#7055)?
3. **FOUC.** Accept the `connectedCallback` window, ship hybrid tag+marker selectors during migration
   (option C), or stamp server-side from Flow so the markup arrives already marked?
4. **Recipes layer.** Which components get plain-element recipes — the #8237 list is a good starting
   point. Generated from base styles or hand-written? Shipped in the theme package or a utility
   package? Plus a11y guidance for links-as-buttons.
5. **Token vocabulary.** Are component tokens just the tag name minus the prefix? Which mixins
   contribute role tokens (`field`, `input`, `group-field`, `button-effects` for drawer-toggle)? This
   needs an authoritative list.
6. **Aura.** Same markers, same release? Aura's `button.css` repeats a 5-tag list ~20 times — the same
   win is waiting there.

## Relationship to existing work

- Builds on the `proto/lumo-light-dom` branch (`packages/lumo`).
- Continues PR #11771's closing note: "requires research and further work and should be scheduled
  explicitly after the open questions are resolved."
