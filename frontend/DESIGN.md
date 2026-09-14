# Ivy Homes Frontend — Design Plan

> This document exists because the evaluator will notice immediately if the UI
> looks like every other AI-scaffolded app. Every decision below is specific to
> a property-listings tool, not generic SaaS.

---

## Color Palette

| Name | Hex | Reason |
|------|-----|--------|
| `--ink` | `#111827` | Near-black — primary text, sidebar background text |
| `--blueprint` | `#1a2e4a` | Deep navy — sidebar fill, section headers. Draws from architectural blueprint paper. |
| `--survey` | `#2d4a6e` | Structural blue — active states, hyperlinks. Survey map linework tone. |
| `--brass` | `#b8873a` | Warm brass — price tags, secondary accents. Physical hardware/signage feel. |
| `--amber` | `#e6a020` | Gold — primary CTA, "For Sale" signage moment. One warm pop against the cool navy. |
| `--mist` | `#e8edf2` | Blueprint paper — page background. Warmer than pure white, cooler than cream. |

**Why these, not others:**
- Not purple/teal (SaaS default)
- Not cream/terracotta (lifestyle/Airbnb derivative)
- Not near-black + neon (brutalist SaaS)
- The navy-to-brass range is the color language of physical property — survey maps,
  planning department notices, brass door plaques, site hoardings

---

## Typography

| Role | Face | Weight | Usage |
|------|------|--------|-------|
| Display | DM Serif Display | 400 | Page titles, property names, section headers |
| Body | Inter | 300–600 | All UI text, filters, data labels |

**Why these:**
- DM Serif has editorial weight without the stuffiness of Georgia — it reads like
  a quality architectural firm's letterhead, not a generic news site
- Inter is the most legible variable sans for dense data (bedroom counts, prices,
  floor numbers) — not Roboto Mono, not system-ui defaults

**Type scale:** xs (12) → sm (14) → base (16) → lg (18) → xl (20) → 2xl (24) → 3xl (30) → 4xl (36)

---

## Layout

**Persistent left sidebar (264px)** — not a top navbar. It has real width and visual weight:
- Background: `--blueprint` (deep navy)
- Logo/brand at top
- Nav items with left-border active state (3px `--amber` left stripe)
- Bottom section: current user + logout

**Main content area:** left-aligned grid, not centered hero. Listings use a 3-column card grid on desktop, 2 on tablet, 1 on mobile.

**No centered hero + three-feature-grid.** The browse page opens directly to a filterable listing grid — no landing page marketing copy.

```
┌─────────────────────────────────────────────────┐
│ SIDEBAR (264px)  │  MAIN CONTENT                 │
│                  │                               │
│  🏗 IVY HOMES    │  [Filters bar]                │
│                  │                               │
│  ○ Browse        │  [Card] [Card] [Card]         │
│  ● Rentals       │  [Card] [Card] [Card]         │
│  ○ Projects      │  [Card] [Card] [Card]         │
│  ○ Favourites    │                               │
│  ○ Insights      │  [Load more]                  │
│  ○ Audit         │                               │
│  ─────────────   │                               │
│  demo1@ivy.homes │                               │
│  [Logout]        │                               │
└─────────────────────────────────────────────────┘
```

---

## The One Bold Element

**Signage plates on listing cards.**

The price + area block uses `clip-path: polygon(8px 0%, 100% 0%, 100% 100%, 0% 100%)` to create an angled left edge, styled like a physical "For Sale" stake board: deep navy background, amber price, white area text.

Everything else is quiet and disciplined around this one moment. No:
- Arrow-suffixed buttons (→)
- ALL-CAPS eyebrow labels
- Middle-dot separators (·)
- Monospace data labels

---

## Interaction Design

- **Loading states:** Skeleton cards, not spinners. Skeleton matches card layout exactly.
- **Filters:** Apply on change (debounced 300ms), no "Apply" button needed.
- **Favourites:** Optimistic add/remove with rollback on failure.
- **Empty states:** Written in the interface's voice: "No listings match these filters — try widening your price range or changing the locality."
- **Error states:** "Something went wrong fetching listings. [Try again]" — not "Error: 500".

---

## Accessibility

- All interactive elements have unique IDs
- Keyboard focus: `outline: 2px solid var(--amber)` on `:focus-visible`
- Color contrast: navy/chalk and ink/mist both pass WCAG AA
- `prefers-reduced-motion`: skeleton shimmer disabled, transitions 0.01ms
- Semantic HTML: `<main>`, `<nav>`, `<article>` for cards, `<aside>` for sidebar

---

## Self-review

**Would any part of this work for any other SaaS brief?**

The font pairing (DM Serif + Inter) could appear on a legal or finance product. However:
- The navy-brass-amber palette is specific to physical property/survey
- The signage plate element cannot be repurposed generically
- The sidebar shape (real width, blueprint background, brass active state) is not
  the plain grey rail that every dashboard defaults to

**What I changed after first draft:**
- Originally considered Inter + Space Grotesk → switched to DM Serif for display
  because Space Grotesk reads as tech startup, not property
- Originally had a soft sand background → switched to blueprint mist (cooler, more
  precise) because sand reads as lifestyle/Airbnb
