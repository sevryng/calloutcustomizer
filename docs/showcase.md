# Callout Customizer — showcase

Screenshot source for the README. Import the three SVGs from `showcase-icons/`
first (**Custom SVG…** in the icon picker → choose from vault), then screenshot
each section below in Reading view.

---

## 1. Hero — custom icons, colors, titles

Screenshot this block for the top of the README.

> [!tip|i:svg-corgi c:d598e1] Henry has reviewed this release
> A custom SVG icon, a custom color, and a custom title all stored inline in
> the note. Nothing was added to a CSS file to make this callout look this way.

> [!note|i:telescope c:dd8508] Field notes, 14 March
> Any of the 1,900+ Lucide icons your Obsidian build ships. Searchable by name
> *and* by Lucide's own tag metadata, so typing `favorite` finds `star`.

> [!warning|i:svg-surgical-light c:47a971] Sterile field compromised
> Custom icons work everywhere Lucide icons do, including in the fold marker
> and in Reading view.

---

## 2. One type, many looks

Screenshot this to show that styling is per-callout, not per-type. Every
callout below is `[!note]`.

> [!note|i:sprout c:08b94e] Growing
> Same type.

> [!note|i:flame c:ec7500] Hot
> Same type.

> [!note|i:snowflake c:00bfbc] Cold
> Same type.

> [!note|i:svg-surgical-light c:d53984] Experimental
> Same type, but with a custom icon!

---

## 3. Fold states

> [!abstract|i:archive c:7e7e7e]- Collapsed by default
> You only see this after clicking. Set from the **Fold** dropdown, or the
> **Collapse by default** item in the right-click menu.

> [!abstract|i:book-open c:086ddd]+ Collapsible, open by default
> Foldable, but starts expanded.

> [!abstract|i:lock] Not collapsible
> No fold marker at all.

---

## 4. Nested callouts

Nesting works, and each level keeps its own styling.

> [!question|i:git-branch c:7852ee] Which path do we take?
> Both are viable.
>
> > [!success|i:check-check c:08b94e] Option A
> > Ships this week.
>
> > [!failure|i:clock-alert c:e93147] Option B
> > Ships next quarter.

---

## 5. Saved callout types

These need the CSS snippet enabled. Save a look via **Save look… → Callout
type**, then use it anywhere with no metadata at all.

**Render:**
> [!corgi|i:svg-corgi c:a882ff] Corgi Approved!
> A saved type. The markdown is just `> [!corgi]`. The icon and color live
> in `.obsidian/snippets/callout-customizer.css`, so this keeps working even
> with the plugin disabled.

**Markdown**:
```

 > [!corgi|i:svg-corgi c:a882ff] Corgi Approved!
> A saved type. The markdown is just `> [!corgi]`. The icon and color live
> in `.obsidian/snippets/callout-customizer.css`, so this keeps working even
> with the plugin disabled.

```



> [!zoomies] Ship it
> Another saved type.

---

## 6. Existing metadata is preserved

If a theme or another plugin already uses callout metadata, it survives.

> [!info|left i:pin c:e0ac00] Third-party metadata intact
> This callout was written as `> [!info|left]` before it was styled. The
> `left` token is still there, untouched.

---

## Raw source

For anyone reading the README rather than the screenshots:

```markdown
> [!tip|i:svg-corgi c:e07b39] Doug has reviewed this release
> A custom SVG icon, a custom color, and a custom title.

> [!note|i:telescope c:7852ee] Field notes, 14 March
> Any Lucide icon, searchable by name or tag.

> [!abstract|i:archive c:7e7e7e]- Collapsed by default
> Hidden until clicked.

> [!corgi] Saved callout type
> No metadata needed — defined in a CSS snippet.
```
