# Evyta — Implementation Notes for Claude Code

These HTML files are **design references**, not production code to paste in.
Recreate the designs inside the **existing Evyta Next.js app**, using its
established patterns, components, and styling approach. The prototype is the
visual + behavioral source of truth; `styles.css` is the token system to map in.

Fidelity: **high-fidelity.** Match colors, type, spacing, radius, and shadows
exactly (values in `styles.css`).

## Guardrails (do not violate)
- **No backend refactor.** No Prisma schema/migration changes.
- **Preserve existing auth/session logic.** The prototype's auth/verify screens
  are UI only — wire them to the real flows, don't replace them.
- **Respect feature flags.** Gate new surfaces behind flags; ship dark mode only.
- **Hide/disable Verified (KYC/18+) states until real KYC is implemented.**
  Connected (email/phone) is the only live identity tier at launch.
- **Prototype dev navigation must NOT ship.** The left dev-nav, the device frame,
  the theme toggle, and the "Coming soon"/Admin preview are prototype scaffolding.
- **No new screens, no redesign.** Build what's in the prototype.

## Suggested conversion batches
Convert in vertical slices so each batch is shippable behind a flag.

1. **Foundation** — map `styles.css` tokens into the app's theme (CSS vars or
   Tailwind theme). Build shared primitives: app shell, top header, bottom nav +
   FAB, buttons, inputs, chips, card, trust badges, bottom-sheet. Dark mode only.
2. **Entry & auth** — Splash, Auth (Request access / Sign in), Email verification
   (secure-link state), First action. Wire to existing auth/session; do not
   change session logic. Verify = link flow only.
3. **Core loop** — Home feed (tabs + signal cards), Composer sheet, Thread
   (gentle reactions + comments), Explore, Profile, Settings/Edit.
4. **Trust-sensitive** — Chat requests, Chat list, Conversation, private-media
   consent + reveal (mutual, revocable), video approval (mutual), Buddy overview/
   request/chat, Single of the Week. Each gated action behind consent + flags.
5. **Secondary states** — Notifications, Locked/gated, Empty, Loading, Error/
   Success. Implement as reusable components, not routes.
6. **Admin (optional, internal)** — only if/when prioritized; keep out of member bundle.

## State model (from the prototype logic class)
A single view selector + independent overlay/consent flags:
- `screen` — current view.
- Overlays: `composerOpen`, `sheetOpen` (profile reveal), `convoSheet`
  (`null | 'media' | 'video'`), `connectSheetOpen`.
- Trust/consent: `mediaConsent` (locked→revealed), `videoApproved`
  (locked→unlocked), `buddyConsent` (gates Buddy-request submit),
  `discreetMode`, per-post connect flags, reaction `{on, count}` maps.
- Transitions are all local UI state in the prototype — back them with real
  data/consent records in the app. Reveal/approval must be **mutual** and
  **revocable** server-side; UI copy already reflects this.

## Component → code mapping
Use `COMPONENTS.md` (inventory + states) and `styles.css` (exact values).
Glyphs are Unicode placeholders → use the app's icon set (rounded, ~1.5px).
Avatars/media are gradient placeholders → wire to real media with the same
locked/revealed treatment.

## Copy
Follow `COPY.md` strictly — privacy language is honest-only, KYC "Verified" is
hidden until backed by real verification, and the locked strings (tagline,
"I Want In", "Request access") stay verbatim.

## Files in this package
- `index.html` — runnable prototype (offline, self-contained) = the visual source of truth.
- `Evyta Complete.dc.html` — editable prototype source (all screens + logic).
- `styles.css` — design tokens (dark + future light) + component classes.
- `COMPONENTS.md`, `SCREENS.md`, `COPY.md`, this file.
