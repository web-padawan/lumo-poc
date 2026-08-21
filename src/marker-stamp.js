/**
 * PoC stand-in for native marker stamping.
 *
 * In a real implementation each component contributes its marker tokens from a base
 * mixin's `connectedCallback` (the spec forbids attribute mutation in constructors),
 * roughly:
 *
 *   static get markers() { return [...super.markers, 'button']; }
 *   connectedCallback() { super.connectedCallback(); addTokens(this, this.constructor.markers); }
 *
 * — component tokens come from the component class, role tokens (field, input,
 * group-field) from the mixins (FieldMixin, InputControlMixin, …), and the list
 * composes automatically along the inheritance chain. Subclasses under any tag name
 * inherit it for free; an isolation-seeking subclass (vaadin/web-components#7055)
 * opts out by overriding `markers` to [].
 *
 * Since published components don't stamp yet, this PoC registers class→tokens pairs
 * and stamps existing + future elements via `instanceof` — which is exactly the
 * semantics inheritance-based stamping would produce (re-tagged subclasses match).
 */

const registry = [];

/** Merge tokens into the element's `vaadin-role` attribute without clobbering user tokens. */
function addTokens(el, tokens) {
  const current = new Set((el.getAttribute('vaadin-role') || '').split(/\s+/).filter(Boolean));
  const before = current.size;
  tokens.forEach((t) => current.add(t));
  if (current.size !== before) {
    el.setAttribute('vaadin-role', [...current].join(' '));
  }
}

function stamp(el) {
  for (const [ctor, tokens] of registry) {
    if (el instanceof ctor) {
      addTokens(el, tokens);
    }
  }
}

function stampTree(root) {
  if (root.nodeType === Node.ELEMENT_NODE) {
    stamp(root);
  }
  root.querySelectorAll?.('*').forEach(stamp);
}

/**
 * @param {CustomElementConstructor} ctor
 * @param {string[]} tokens
 */
export function registerMarker(ctor, tokens) {
  registry.push([ctor, tokens]);
  stampTree(document);
}

new MutationObserver((mutations) => {
  for (const { addedNodes } of mutations) {
    addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        stampTree(node);
      }
    });
  }
}).observe(document, { subtree: true, childList: true });

// Re-stamp when late definitions upgrade existing elements.
export function stampOnDefined(tagName) {
  customElements.whenDefined(tagName).then(() => stampTree(document));
}
