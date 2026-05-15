# Markthal HQ — Year-6000 Design System

Sci-fi token-laag die naast de bestaande Apple-tokens leeft. Components die meedoen met de redesign gebruiken deze laag; oude components blijven werken met de originele tokens.

## Tokens — waar wat staat

**CSS-variabelen** in `app/globals.css` (`--sf-*` prefix). **Tailwind utilities** in `tailwind.config.ts` (`sf-*` namespace).

| Categorie | CSS var | Tailwind |
|---|---|---|
| Background | `--sf-bg` | `bg-sf-bg` |
| Surface (cards) | `--sf-bg-surface` | `bg-sf-surface` |
| Elevated (modal) | `--sf-bg-elevated` | `bg-sf-elevated` |
| Text primary | `--sf-fg` | `text-sf-fg` |
| Text muted | `--sf-fg-muted` | `text-sf-fg-muted` |
| Accent (cyan) | `--sf-accent` | `text-sf-accent` `bg-sf-accent` |
| Glass material | `--sf-glass` | `bg-sf-glass` |
| Hairline | `--sf-hairline` | `border-sf-hairline` |
| Glow shadow | `--sf-glow-accent` | `shadow-sf-glow` |
| Spring easing | `--sf-spring-stiff` | `ease-sf-spring` |
| Backdrop blur | `--sf-blur` | `backdrop-blur-sf` |
| Radius 4/8/12 | `--sf-radius-sm/-/-lg` | `rounded-sf-sm` `rounded-sf` `rounded-sf-lg` |

## Typografie

- **Display**: Space Grotesk via `font-display` Tailwind class. Voor titels, hero-cijfers, statement-tekst.
- **Body**: standaard sans-stack (Apple system). Geen aparte body-font.
- **Mono**: JetBrains Mono via `font-mono` class. Voor numerieke readouts, timestamps, IDs.

Sizes: `text-sf-display | sf-h1 | sf-h2 | sf-h3 | sf-body | sf-small | sf-caps | sf-mono`.

```tsx
<h1 className="font-display text-sf-display text-sf-fg tracking-tight">
  €12.450,00
</h1>
<span className="font-mono text-sf-mono text-sf-accent">
  +23.4%
</span>
```

## Motion

Helper file: `lib/motion.ts`. Importeer presets, ga niet zelf transitions in-de-vlucht definiëren.

```tsx
import { motion } from "framer-motion";
import { fadeUp, springStiff, stagger } from "@/lib/motion";

// Eenvoudig
<motion.div {...fadeUp}>...</motion.div>

// Lijst met stagger
<motion.ul variants={stagger.container} initial="initial" animate="animate">
  {items.map((i) => <motion.li key={i.id} variants={stagger.item}>...</motion.li>)}
</motion.ul>
```

Voor performance: gebruik `LazyMotion` waar mogelijk om alleen de gebruikte features te bundelen.

```tsx
import { LazyMotion, domAnimation, m } from "framer-motion";
// Gebruik `m.div` ipv `motion.div`
```

## Reduced-motion

Globale `@media (prefers-reduced-motion: reduce)` in `globals.css` schakelt alle animaties uit. Components hoeven hier zelf niets voor te doen — Framer Motion respecteert dit automatisch via `useReducedMotion()`.

## Iconen

`lucide-react` ipv het oude `components/Icon.tsx`. Tree-shaken: alleen geïmporteerde iconen komen in de bundle.

```tsx
import { Bell, Calendar, Search } from "lucide-react";
<Bell size={18} strokeWidth={1.5} className="text-sf-accent" />
```

Behoud `strokeWidth={1.5}` als default voor de "thin sci-fi" look (default Lucide is 2).

## Discipline-regels

- ❌ Geen inline `style={{ color: "#..." }}` met hex
- ❌ Geen `text-slate-*`, `bg-slate-*` in nieuwe components
- ❌ Geen `text-[Npx]` arbitrary values — gebruik `text-sf-*` schaal
- ❌ Geen `rounded-[Npx]` — gebruik `rounded-sf-*` schaal
- ✅ Geef de `font-display` of `font-mono` class waar van toepassing
- ✅ Wikkel interactieve elementen in `motion.button` / `motion.div` met `tap` preset

## Bestaande componenten

`text-slate-*` / hardcoded hex blijven werken tot FASE 5 ze scherm-voor-scherm migreert. Geen big-bang refactor.
