# PoC: Lumo using attribute selectors

A proof of concept using attributes selectors instead of hardcoded `vaadin-*` tag names.

```css
/* Before */
:where(vaadin-button,
       vaadin-menu-bar-button,
       vaadin-message-input-button) { … }

/* This PoC */
:where([vaadin-role~='button']) { … }
```

```html
<!-- Sets vaadin-role="button" -->
<vaadin-button>…</vaadin-button>

<!-- Link styled as button -->
<a vaadin-role="button">…</a>

<!-- Styled native button -->
<button vaadin-role="button">…</button>

<!-- Subclass with a custom tag name -->
<custom-button>…</custom-button>
```

## Related issues

- [#1803 — \[lumo\] Styling links as buttons](https://github.com/vaadin/web-components/issues/1803)
- [#7055 — Support renaming elements and using multiple tags on the same page without conflicts](https://github.com/vaadin/web-components/issues/7055)
- [#8237 — Utility classes that encapsulate common styling needs for native html elements](https://github.com/vaadin/web-components/issues/8237)
- [#11771 — feat: add aura-button class to style anchors as buttons](https://github.com/vaadin/web-components/pull/11771)

## Use cases

1. Styling links as buttons
2. Using native `<button>` elements instead of `vaadin-button`
3. Using arbitrary HTML elements as badges (replaces `theme="badge"`)
4. Extending `vaadin-button` and using a different tag name

## Structure

- Both `lumo.css` or `aura.css` are implemented using the same `[vaadin-role]` selectors
- Shared `base.css` with recipes that replicate component base styles for plain elements

## Why attributes?

- CSS class names are expected to be set by the user (e.g. Lumo utility classes)
- Inspired by Lea Verou's custom attributes [proposal](https://github.com/webplatformco/project-custom-attributes)

## To Do

- Prototype minimal set of CSS for `<input>` (text, checkbox)
