# Evyta — Screen Map

18 member screens + 1 internal admin preview, plus shared overlay sheets and
system states. In the prototype, navigate via the left dev-nav (Splash → Admin)
or the in-screen buttons. All screens share the app shell, palette, type, and
bottom nav.

Prototype state key (in the logic class): `screen` selects the view; overlays are
separate booleans (`composerOpen`, `sheetOpen`, `convoSheet`, `connectSheetOpen`).

## Entry
| Screen | Purpose | Key states / copy |
|--------|---------|-------------------|
| **Splash** | Public entry. Wordmark, tagline, 1-line promise, one primary CTA. | "See the circle, not the noise." · primary **I Want In** · "Already inside? Sign in". |
| **Auth (Join / Sign in)** | Request access or sign in. Feels like joining a private circle. | Segmented **Request access / Sign in**. Register adds name field. CTA: "Request access" / "Continue". Controlled-alpha note. |
| **Email verification** | Secure-link confirmation (NOT a code). | "Check your inbox" · "We sent a secure link…" · waiting spinner · **Open email app** · **Resend verification link** · **Use another email**. Email verified ⇒ **Connected** tier. |
| **First action** | Set first intention right after verify. | Prompt placeholder + intention chips + audience ("Trusted members") + Share / later. |

## Core loop (Feed → Thread → Connect)
| Screen | Purpose | Key states |
|--------|---------|-----------|
| **Home feed** | Calm "signals" feed, not noise. Tabs: For you / Plans / People. | Composer entry, post variants (intent / plan / Single of the Week / connected), reactions, connect→requested, bell→notifications. |
| **Composer** (sheet) | Compose a signal from the FAB. | open/close (toggle/X), intention chips, audience cycle, Share. |
| **Thread** | Post detail + gentle reactions + comments + reply. | 4 reaction toggles with counts, comment bubbles, nested reply, sticky reply bar, "Request to connect". |
| **Explore / Search** | Discover people & plans. | Search field, filter chips, people grid, quiet plans. Bottom nav: Explore active. |
| **Profile** | Member profile — the locked visual quality bar. | Hero + badges (Verified→Buddy→Connected), connect/message, OPEN TO chips, trust facts, Buddy surface, private photos (locked→reveal sheet). |
| **Settings / Edit** | Edit profile + privacy + trust. | Fields, Discreet mode toggle, audience ("Trusted"), read receipts, **Verify phone** (gated), blocked/reported, sign out. |

## Connect (trust-sensitive)
| Screen | Purpose | Key states |
|--------|---------|-----------|
| **Chat requests** | Private inbound connection requests. | Accept / Decline. "They can't message you until you accept." |
| **Chat list** | Conversations + requests entry + Buddy. | Unread pills, requests banner with count, Buddy row. |
| **Conversation** | 1:1 chat with gated media + video. | Message bubbles; private photo (locked→consent sheet→revealed); video entry (locked→approval sheet→unlocked). |
| **Buddy overview** | Explain + manage the Buddy program (rare, gold). | Current approved Buddy card, how-it-works steps, request CTA. |
| **Buddy request** | Calm, consent-first request flow. | Presence chips, optional note, **understanding checkbox gates submit**, consent-first note. |
| **Buddy chat** | Supportive-presence conversation. | Gold-tinted, "no pressure to reply" framing. |

## Discover
| Screen | Purpose | Key states |
|--------|---------|-----------|
| **Single of the Week** | Rose-accented weekly spotlight. | Feature card, quote, prompt cards, "Send a quiet hello", limited-time note. |
| **Events / Plans** | Quiet plans surface. | Tonight / this week / full; join → requested; "Open a plan" via composer. |
| **Notifications** | Calm activity, grouped Today / Earlier. | Connection request, resonate, Buddy check-in, plan reminder, new Single. Each routes to its surface. |

## System states (reusable patterns, not standalone routes in production)
| State | Purpose |
|-------|---------|
| **Locked / gated** | Why an action is locked + how to unlock (verify email, phone, consent, mutual video). |
| **Empty** | Calm zero-state with one action. |
| **Loading** | Skeletons + spinner + reassuring line. |
| **Error / Success** | Sage success / rose error, full-card + inline banner. |
| **Coming soon** | Honest placeholder for unfinished surfaces. |

## Internal
| Screen | Purpose |
|--------|---------|
| **Admin shell (preview)** | Internal-only: verification queue, reports, Single-of-Week picker. Clearly labeled, **excluded from the member app**. |

## Layout rules (all screens)
- 390px content width; no horizontal overflow.
- Touch targets ≥ 44px; icon buttons 38px circular.
- Bottom nav must never cover meaningful content (content padding-bottom ≈ 96–110px).
- Sheets animate up (`ev-up`), backdrop fades (`ev-fade`); close on scrim tap or X.
- One gold primary action per view. Serif for display/wordmark only.
