# Evyta — Component Inventory

Faithful inventory of every reusable component in the approved prototype.
Exact values live in `styles.css`. Glyphs in the prototype are Unicode
placeholders — replace with your icon set (1.5px stroke, rounded), keeping
the same color roles.

| # | Component | Where used | States | Notes |
|---|-----------|------------|--------|-------|
| 1 | **App shell / device frame** | All screens | — | 390px content width. Status bar (top) + screen area (scroll) + bottom nav. On desktop, center the 390px app in the espresso canvas; do **not** widen the layout. |
| 2 | **Top header** | Profile, Thread, Settings, Chats, Explore, etc. | back / title / action | 38px circular icon buttons with `--ev-line` border. Title is 14px `--ev-text-2` 600, or a serif wordmark on home/feed surfaces. |
| 3 | **Bottom nav** | Home, Explore, Chats, Profile, Events, Empty | active / inactive | 5 slots: Home · Explore · center **FAB(+)** · Chats · You. Active item = `--ev-text` + 600 weight. `.ev-bottomnav` fades over content; never opaque. |
| 4 | **FAB (center +)** | Bottom nav | default | Gold circle, 52px, `--ev-shadow-gold`. Opens the composer bottom sheet. |
| 5 | **Buttons** | Everywhere | default / pressed / sent | `.ev-btn-primary` (gold, one per view), `.ev-btn-secondary` (outline), `.ev-btn-gold-outline` (Buddy/connect), `.ev-btn-sent` (sage "Requested/Request sent"). |
| 6 | **Inputs / textarea** | Auth, Composer, Settings, Buddy req, reply bars | default / focus / placeholder | `.ev-input` / `.ev-textarea`. Calm, low-contrast, no heavy focus rings. |
| 7 | **Chips** | Intentions, filters, audience, reactions | default / selected | `.ev-chip` → `.ev-chip-on` (gold) when active. |
| 8 | **Card + trust rail** | Feed, Explore, Events | — | `.ev-card`; signal/plan cards add a 4px left rail: sage (people/intent), gold (plans), rose (Single of the Week), neutral (connected-only). |
| 9 | **Trust badges** | Profile, feed, chats, thread, requests | Verified / Buddy / Connected | Seal/pill. **Order when together: Verified → Buddy → Connected.** Buddy is the gold filled seal — rare and special, but visually must not overpower Verified. See `styles.css` `.ev-badge-*`. |
| 10 | **Profile card (hero)** | Profile, Single of the Week | — | 104px avatar + active dot, serif name (30px), meta line, badge row, then primary/secondary action pair. The locked PNG is the bar. |
| 11 | **Signal / post card** | Home, Thread | reacted / connect→requested | Avatar + name + badges + meta + a small `INTENT`/`PLAN` tag; body; footer with reaction + Reply + Connect. |
| 12 | **Composer bottom sheet** | Home, Events (center +) | open / close / audience-cycle | Opens from FAB. Direct typing, prompt placeholder, intention chips, audience selector, Share. Closes via X or scrim — toggles, no separate collapse button. |
| 13 | **Reaction controls** | Thread, feed | per-reaction on/off + count | Gentle set: **Resonate · Support · Join · Curious**. Pill toggles to gold when active and bumps its count. No like-race styling. |
| 14 | **Thread / comment** | Thread | — | Original post expanded, then comment bubbles (asymmetric radius `4px 16px 16px 16px`), nested reply indented, per-comment Resonate/Reply, sticky reply bar. |
| 15 | **Chat components** | Chats, Conversation, Buddy chat | unread / active | List rows (avatar + name + badge + preview + time + unread pill); message bubbles — incoming `--ev-surface`, outgoing gold; Buddy chat uses gold-tinted borders. |
| 16 | **Consent sheet** | Conversation (media + video) | media / video variant | Bottom sheet explaining the gate before private media or video; confirm reveals/approves. Honest copy only (see COPY.md). |
| 17 | **Private media states** | Profile, Conversation | locked-blur → consented-reveal | Locked = `.ev-tile-locked` + lock glyph; revealed = avatar fill + caption "Shared only inside this conversation". Reveal is mutual + revocable. |
| 18 | **Video approval entry** | Conversation | locked → mutually approved | Header ▶ icon + in-thread banner. Locked until both approve; copy: "Opens only after you both approve." |
| 19 | **Locked / gated state** | Locked screen, Settings, inline | — | Calm explanation + the action that unlocks it. Striped `.ev-card-locked` texture. Reasons: verify email, phone verification, consent, mutual video approval. |
| 20 | **Empty state** | Chats (and reusable) | — | Concentric-circle motif + calm line + one primary action. |
| 21 | **Loading state** | Feed / any list | — | `.ev-skeleton` blocks mirroring the card layout + `.ev-spinner` + reassuring line ("Gathering your circle…"). |
| 22 | **Error / success state** | Status screen, inline toasts | success / error | Success = sage; error = rose. Full-card version + slim inline banner version. |
| 23 | **Single of the Week spotlight** | Discover, home card | — | Rose-accented feature card: badge, large avatar, serif quote, prompt cards, "Send a quiet hello". |
| 24 | **Admin shell (preview only)** | Admin | — | Internal stats + verification queue + reports + Single-of-Week picker. Clearly labeled "ADMIN · INTERNAL"; **not** shipped in the member app. |

## Iconography & imagery
- Glyphs are Unicode placeholders. Swap for a consistent line-icon set.
- Avatars/photos are `--ev-avatar` gradient placeholders — wire to real media.
- No decorative SVG illustration; the concentric-circle motif (splash/empty) is the only "graphic" and is built from plain bordered circles.
