# Handoff: Evyta — Intentional Social Connection

## Overview
Evyta is a private, mobile-first social web app for discreet, trust-based
connection — a calm "private members' club," not a dating app, marketplace, or
noisy feed. Core loop: **Feed → Thread → Connect.** This package is the
**approved north-star design** for the full member experience (18 screens) plus
an internal admin preview, ready to implement in the real Next.js app.

Tagline: **"See the circle, not the noise."**

## About the design files
The files here are **design references created in HTML** — a prototype showing
the intended look and behavior, **not production code to copy directly**. The
task is to **recreate these designs inside the existing Evyta Next.js app**,
using its established patterns, components, and styling — not to ship the HTML.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radius, shadows, and
interactions. Recreate pixel-faithfully using the codebase's libraries. Exact
values are in `styles.css`; the locked Profile screen is the quality bar.

## What's in this package
| File | What it is |
|------|-----------|
| `index.html` | **Runnable prototype** — self-contained, opens offline in any browser. The visual + behavioral source of truth. Navigate via the left dev-nav. |
| `Evyta Complete.dc.html` + `support.js` | Editable prototype source (all screens + interaction logic). Open together. |
| `styles.css` | Design tokens (dark + future warm-light) and component classes — the system to map into the app's theme. |
| `COMPONENTS.md` | Component inventory: every reusable component, its states, and notes. |
| `SCREENS.md` | Screen map: purpose, key states, copy, and layout rules per screen. |
| `COPY.md` | Product copy rules — privacy honesty, KYC tiers, signup language, locked strings. |
| `IMPLEMENTATION.md` | Claude Code notes: guardrails, conversion batches, state model. |

## How to use it
1. Open `index.html` to explore every screen and interaction.
2. Map `styles.css` tokens into the app's theme (dark mode first).
3. Build shared primitives, then convert screens in the batches in
   `IMPLEMENTATION.md`, following `COMPONENTS.md` and `COPY.md`.

## Non-negotiables (full detail in IMPLEMENTATION.md)
- No backend / Prisma / auth-session refactor — wire UI to existing flows.
- Hide/disable **Verified (KYC/18+)** states until real KYC ships; **Connected**
  (email/phone) is the only live identity tier at launch.
- Respect feature flags; ship dark mode only.
- Prototype dev-nav, device frame, theme toggle, "Coming soon" and Admin preview
  are scaffolding — do **not** ship them.
- No new screens, no redesign.

## Design tokens (quick reference — see styles.css for all)
- **Surfaces:** canvas `#0c0a08`, screen `#15110e`, sheet `#1d1813`, card `#221d18`.
- **Text:** `#f0e8d8` / `#a99d8c` / `#8d8473`.
- **Gold** (primary + Buddy) `#c9a45c` · **Sage** (verified/trust) `#9bab74` ·
  **Rose** (intimate/social) `#c08aa0`.
- **Type:** Newsreader (serif, display/wordmark only) + Hanken Grotesk (UI/body).
- **Radius:** pill 20 / input 13 / card 18 / sheet 26. **Width:** 390px.

## Remaining product decisions
- Concrete split between **Connected** (email/phone) and **Verified** (KYC/18+),
  and which surfaces require which tier.
- Whether an email-code fallback ever ships (currently link-only).
- Buddy escalation / crisis policy given peer-support framing.
- Server-side behavior behind "reveal access can be revoked" (un-share semantics).
