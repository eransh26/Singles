# Evyta — Product Copy Notes

Voice: private, calm, premium, mature, discreet, human, intentional, trust-first.
**Bold on visual polish, conservative on product promises.** Never claim a
capability the backend can't honor.

## Keep verbatim (locked)
- Tagline: **"See the circle, not the noise."**
- Splash primary CTA: **"I Want In"**
- Auth (controlled alpha): **"Request access"**
- "Already inside? Sign in"
- Email verify is a **secure link** flow — never a 6-digit code in production.

## Removed / avoid
- ~~"Prefer a code instead? Coming soon"~~ — removed from the verify screen.
  (If a code fallback ever ships, reintroduce only when it's real.)
- Do **not** reintroduce a 6-digit email-code input unless clearly a real, shipped option.

## Privacy language — honest, not legalistic
| ❌ Do not say | ✅ Use instead |
|---------------|----------------|
| "End-to-end encrypted" | "Private by design" |
| "Not downloadable" / "nothing is saved" | "Shared only inside this conversation" |
| "Screenshots prevented" | "Screenshots can't be fully prevented" |
| "Fully private forever" | "Reveal access can be revoked" |
| "Calls are never recorded" | "You can revoke access anytime" |

Current strings already in the prototype:
- Auth note: "Private by design. Your activity is never shown publicly."
- Chats header: "Private by design"
- Private photo (revealed) caption: "Shared only inside this conversation"
- Media consent sheet: "…reveal access can be revoked, and screenshots can't be fully prevented."
- Video consent sheet: "Video opens only when you both approve. You can revoke access anytime."

## Trust tiers — do not over-claim KYC
Three distinct meanings; keep the badge visuals but be honest about what's live.
| Tier | Meaning | Shown when |
|------|---------|-----------|
| **Connected** | Email or phone verified | Live at launch |
| **Verified** | Future KYC / 18+ identity verified | **Hidden/disabled until real KYC ships** |
| **Buddy** | Approved peer-support member | When approved |

Audience / gating copy — prefer:
- "Connected members", "Trusted members", "Requires verification"
- "Identity verification required" **only** where it's clearly a future/locked state.

Badge order when shown together: **Verified → Buddy → Connected.**
Buddy is rare and special but must not visually overpower Verified.

## Signup language
- Use: "Request access", "Create your access", "Join the circle quietly", "Already inside? Sign in".
- Avoid cold SaaS labels: "Register", "Submit", "Create user".
- Don't imply fully manual approval unless the screen says it's controlled alpha
  (current note: "Evyta is in a quiet, invitation-led alpha. Access opens gradually.").

## Tone for gated/incomplete features — be honest
- "Verify email to post", "Phone verification required", "Consent needed before private media",
  "Video opens only after mutual approval".
- "Requires verification", "Coming soon", "Not available yet" — never fake functionality.

## Reactions (gentle, not like-race)
Resonate · Support · Join · Curious. No counts framed as competition.
