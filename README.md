# PoC: Lumo using attribute selectors

A proof of concept using attributes selectors instead of hardcoded `vaadin-*` tag names.

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

- [#1803 — \[lumo\] Styling links as buttons](https://github.com/vaadin/web-components/issues/1803)
- [#7055 — Support renaming elements and using multiple tags on the same page without conflicts](https://github.com/vaadin/web-components/issues/7055)**
- [#8237 — Utility classes that encapsulate common styling needs for native html elements](https://github.com/vaadin/web-components/issues/8237)**
- [PR #11771 — feat: add aura-button class to style anchors as buttons](https://github.com/vaadin/web-components/pull/11771)

## Use cases

1. Styling links as buttons
2. Using native `<button>` elements instead of `vaadin-button`
3. Using arbitrary HTML elements as badges (replaces `theme="badge"`)
4. Extending `vaadin-button` and using a different tag name

## Why attributes?

- CSS class names are expected to be set by the user (e.g. Lumo utility classes)
- Inspired by Lea Verou's custom attributes [proposal](https://github.com/webplatformco/project-custom-attributes)
