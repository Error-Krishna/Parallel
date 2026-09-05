# Parallel — User Flows

> **Purpose:** Step-by-step flows for every MVP feature in `FEATURE.md`, including entry points, decision branches, and edge/error states. This is the input for `UI_DESIGN.md` and the Figma file — every screen listed there should trace back to a step here.
>
> **Source:** `FEATURE.md`, `PARALLEL_master_blueprint_final.md`

---

## Flow-notation key

Each flow uses this shape:

```
Entry point → step → step → ... → exit state
  ⤷ branch: condition → alternate path
  ⚠ error/edge state
```

---

## 1. Sign Up / Login (§2.1)

```
App opens (no session) → Landing screen → [Sign Up | Log In]

Sign Up:
  Landing → Sign Up form (email, username, password) → Submit
    ⚠ email/username already taken → inline error, stay on form
    ⚠ password too weak → inline error, stay on form
  → Account created → session token issued → Onboarding (Flow 2)

Log In:
  Landing → Log In form (email, password) → Submit
    ⚠ invalid credentials → inline error, stay on form
  → session token issued
    ⤷ onboarding not completed → Onboarding (Flow 2)
    ⤷ onboarding completed → Parallel Map (Flow 3)

Logout:
  Any authenticated screen → Profile → Log Out → confirm → session cleared → Landing
```

**Edge states:** expired/invalid token anywhere in the app → silent redirect to Landing, no error toast (avoid alarming the user for a routine expiry).

---

## 2. Onboarding (§2.2)

```
First login after Sign Up → Onboarding intro screen ("quick, fun, no wrong answers")
  → Question 1 (Friday night preference) → answer → persisted immediately
  → Question 2 (learn vs make) → answer → persisted
  → Question 3 (plan vs improvise) → answer → persisted
  → Question 4 (naturally chosen activities, multi-select) → answer → persisted
  → Loading state: "Building your map..." (Identity Engine runs a first-pass rules-based score)
  → Parallel Map reveal (Flow 3) — this is the first "aha" moment (blueprint §27)

⚠ user backgrounds/closes app mid-onboarding → resume at last unanswered question on return, never restart
⚠ Identity Engine first-pass takes >2s → keep the loading state playful (not a bare spinner), never expose a hard timeout error — always resolve to at least a minimal, rules-based map
```

**Non-negotiable:** onboarding cannot be skipped — no Parallel Map exists without at least first-pass signal (blueprint §4/§19, cold start).

---

## 3. View Parallel Map (§2.3)

```
Authenticated + onboarded → Parallel Map (default landing screen)
  Shows: each discovered Parallel, strength %, momentum indicator, streak badge if active
  ⤷ tap a Parallel → Enter a Parallel (Flow 4)
  ⤷ tap "Evolution" → Identity Evolution view (Flow 8)
  ⤷ pull to refresh → re-fetch current strengths (does not force recompute; recompute is a background job, blueprint §16 Phase 6)
  ⤷ new Parallel discovered since last visit → non-blocking banner: "We noticed something new about you" → tap → New Parallel Discovered reveal (Flow 3a)

⚠ user has zero non-ghost Parallels (rare, only right after onboarding with very sparse answers) → show an encouraging empty-ish state pointing at "Enter a Parallel" using the strongest available signal rather than a blank screen
```

### 3a. New Parallel Discovered (reveal)

```
Banner tap (from Map) or in-app notification → New Parallel Discovered screen
  Shows: parallel name/icon, plain-language "why" (required, blueprint §22), is currently in Ghost Mode
  → [Explore | Make Public | Hide | Reject]
    Explore → Ghost Mode "What If?" world (Flow 3b), still private
    Make Public → confirm → Parallel now appears on public map, is_ghost = false
    Hide → confirm → is_hidden = true, removed from active suggestions, reversible any time from Profile > My Parallels (Flow 14)
    Reject → confirm ("we won't suggest this again") → dismissedAt = now(), permanent — distinct from Hide: this is a soft delete, not a toggle, and the Identity Engine must not re-suggest the same Parallel type for this user afterward (see DATABASE.md §2.3)
```

### 3b. Ghost Mode / "What If?" exploration

```
New Parallel Discovered → Explore → Ghost-mode discovery world (content/challenges for that Parallel, clearly marked private)
  → user can interact (view/like/save/challenge) same as any Parallel — signals still recorded
  → user decides later: Make Public (from the Parallel Map's ghost indicator) or leave as-is indefinitely
  ⚠ nothing about a Ghost Mode Parallel is ever shown to other users, in notifications, or in Wrapped, until explicitly made public
```

---

## 4. Enter a Parallel (§2.4)

```
Parallel Map → tap a Parallel card → transition animation (scene change, not a tab switch — blueprint §14) → Parallel-specific Feed (Flow 5)
  Header shows: active Parallel name/icon/accent color
  ⤷ tap a different Parallel chip in-context → switch directly to that Parallel's feed (same transition)
  ⤷ tap "back to Map" → return to Parallel Map
```

---

## 5. Parallel-Specific Discovery / Feed (§2.5)

```
Enter a Parallel → Feed (content items scoped to this parallel_type_id)
  ⤷ scroll → paginated content load
  ⤷ tap content item → detail view → [view logged as interest_signal]
  ⤷ like/save on an item → [like/save logged as interest_signal]
  ⤷ tap "Quests" tab (within this Parallel) → Quest list (Flow 7)
  ⤷ tap "People" tab (within this Parallel) → People Discovery scoped to this Parallel (Flow 9)

⚠ feed has no curated content yet for a very new/rare Parallel type → fall back to a "we're still finding your people" empty state, never a broken/blank feed
```

---

## 6. Basic Interactions (§2.6)

```
Any content item, anywhere in the app → [view | like | save | search | follow | challenge_complete]
  → each interaction writes an interest_signal row immediately (fire-and-forget from the client's perspective)
  → no visible UI change beyond the immediate interaction (e.g. like button fills in) — the Identity Engine effect is invisible/background
```

---

## 7. Identity Experiments & Quests (§4.1, §4.2)

```
Parallel feed → Quests tab → Quest list (scoped to this Parallel; season-tagged if applicable)
  → tap a Quest → Quest detail (steps, reward preview)
  → [Start Quest] → status: IN_PROGRESS, current_step = 0
  → complete step → current_step += 1 → interest_signal (QUEST_STEP) logged
    ⤷ all steps complete → status: COMPLETED → reward granted (badge / cosmetic frame / hidden-Parallel hint) → celebratory reveal screen → prompt to generate an Identity Card (Flow 11)
  ⚠ user abandons a Quest mid-way → progress persists indefinitely, resumable anytime, no penalty
```

### 7a. Streaks (§4.3)

```
Any Quest/challenge/content interaction on a Parallel → streak_count increments if streak_last_touched_at was within the last 24–48h window, otherwise resets to 1
  → 3+ days untouched → soft push notification: "Your {Parallel} streak is about to end"
  → streak breaks → streak_count resets to 0, no shaming copy, no blocking modal
```

---

## 8. Identity Evolution (§2.8)

```
Parallel Map → "Evolution" → monthly/yearly view
  Shows: strength_pct over time per Parallel (line/area visualization), highlighted callouts:
    - Newest Parallel
    - Biggest evolution (largest delta)
    - Most explored identity (highest interaction volume)
    - Most unexpected interest (lowest historical correlation to existing Parallels)
  ⤷ tap a callout → drill into that Parallel's history
  ⤷ if a monthly/annual Wrapped is available → prominent CTA into Wrapped (Flow 12)
```

---

## 9. People Discovery & Follows (§2.7, §5.1)

```
Parallel feed → People tab → list of suggested people
  Each suggestion shows: shared/unusual Parallel intersection (not a bare "% match" framed as science)
  ⤷ tap a person → profile preview (shared Parallels, public map subset)
  ⤷ Follow / Unfollow → immediate, no confirmation needed
  ⤷ "Parallel Twin" badge if similarity_score crosses the twin threshold → tap → Twin comparison screen (shared interests, differences)
```

---

## 10. Collab Parallels (§5.4)

```
A friend's profile or a direct invite link → "Start a Collab" → picker: choose one of your Parallels
  → sends invite to friend with their own picker (choose one of their Parallels)
  → both accept → CollabSession status: ACTIVE → joint discovery world (shared challenge) opens for both
  → complete shared challenge → status: COMPLETED → shared Identity Card generated for both users (Flow 11)
  ⚠ invite not accepted within a reasonable window → session auto-expires to CANCELLED, no notification spam
```

---

## 11. Identity Cards (§7)

```
Trigger points: new Parallel made public, Quest completed, Twin matched, Wrapped generated, Collab completed
  → Generate Card (background job renders portrait image) → Card preview screen
  → [Share to Instagram/Snap/TikTok Story | Save to device | Dismiss]
  ⚠ render job fails/times out → retry silently once, then fall back to a simpler static template rather than blocking the moment entirely
```

---

## 12. Parallel Wrapped (§8)

```
Monthly/annual trigger (background job) → in-app notification: "Your {Month} Wrapped is ready"
  → tap → swipeable story-style card sequence (biggest evolution, most explored, weirdest intersection, streak, Twin)
  → final card: aggregate summary + [Share | Save all | Done]
  ⚠ insufficient activity that period for a meaningful Wrapped → shorter, honest recap ("a quieter month — here's what we saw") rather than a padded/fake-feeling one
```

---

## 13. Roulette (§5.5) — P3, post-MVP core

```
Parallel feed → "Roulette" entry point → pick a Parallel → [Find a match]
  → queued state (short, honest wait indicator)
  → matched → time-boxed chat (10–15 min) with countdown visible to both
  → session ends automatically at timeout → [Follow | Report | End]
  ⚠ user wants to leave early → always allowed, immediate, no guilt copy
  ⚠ safety: Report/Block always one tap away during the session, never buried
```

---

## 14. Profile & Privacy Controls (§11, §12)

```
Profile tab → sections: [Public Profile | My Parallels | Privacy & Data]

My Parallels:
  → per-Parallel: [Make Public/Ghost | Hide (reversible) | Remove (permanent — sets dismissedAt, same mechanism as "Reject" in Flow 3a)] with the plain-language "why" always visible
  → per-interest-signal-source: hide toggle (blueprint §22)

Privacy & Data:
  → visibility settings (per-Parallel public/friends/private)
  → "Why am I seeing this?" — explainability entry point, reachable from any suggestion
  → Export my data → async job → downloadable file, emailed/notified when ready
  → Delete my account → typed confirmation → irreversible, immediate session termination
```

---

## Flow → Screen traceability

Every numbered flow above must map to at least one entry in `UI_DESIGN.md`'s screen inventory. If a screen exists with no flow driving it, cut it; if a flow has no screen, that's a gap to fix before Figma work starts.

````////////////////////////////////////////////////////
// PARALLEL — MASTER USER FLOW
////////////////////////////////////////////////////


// ==================================================
// PHASE 1 — AUTHENTICATION
// ==================================================

auth [color: blue] {
    App Opens [shape: oval, color: blue]
    Landing [color: blue]

    Sign Up [color: blue]
    Sign Up Form [color: blue]
    Account Created [color: blue]

    Log In [color: blue]
    Log In Form [color: blue]
    Session Created [color: blue]

    Onboarding Completed? [shape: diamond, color: blue]

    Invalid Credentials [color: red]
}


// ==================================================
// PHASE 2 — ONBOARDING
// ==================================================

onboarding [color: purple] {
    Onboarding [color: purple]
    Question 1 [color: purple]
    Question 2 [color: purple]
    Question 3 [color: purple]
    Question 4 [color: purple]

    Building Your Map [color: purple]
    Resume Onboarding [color: purple]
    Minimal Rules Based Map [color: purple]
}


// ==================================================
// PHASE 3 — CORE / PARALLEL MAP
// ==================================================

core [color: green] {
    Parallel Map [color: green]
    Enter Parallel [color: green]
    Parallel Feed [color: green]
    Content Detail [color: green]
}


// ==================================================
// PHASE 4 — IDENTITY DISCOVERY
// ==================================================

identity [color: orange] {
    New Parallel Discovered [color: orange]
    Explore [color: orange]
    Ghost Mode [color: orange]
    What If World [color: orange]

    Make Public [color: orange]
    Hide Parallel [color: orange]

    Public Parallel [color: orange]
    Hidden Parallel [color: orange]
}


// ==================================================
// PHASE 5A — QUESTS
// ==================================================

quests [color: yellow] {
    Quest List [color: yellow]
    Quest Detail [color: yellow]
    Start Quest [color: yellow]
    Quest In Progress [color: yellow]
    Complete Step [color: yellow]

    More Steps? [shape: diamond, color: yellow]

    Quest Completed [color: yellow]
    Reward Granted [color: yellow]
    Celebration [color: yellow]
}


// ==================================================
// PHASE 5B — PEOPLE & SOCIAL
// ==================================================

social [color: pink] {
    People Discovery [color: pink]
    Person Profile [color: pink]
    Follow / Unfollow [color: pink]

    Twin Match? [shape: diamond, color: pink]
    Twin Comparison [color: pink]

    Start Collab [color: pink]
    Choose Your Parallel [color: pink]
    Friend Chooses Parallel [color: pink]

    Both Accepted? [shape: diamond, color: pink]

    Collab Active [color: pink]
    Joint Discovery World [color: pink]
    Shared Challenge [color: pink]
    Collab Completed [color: pink]
}


// ==================================================
// PHASE 6 — EVOLUTION
// ==================================================

evolution [color: teal] {
    Identity Evolution [color: teal]
    Parallel History [color: teal]

    Wrapped Available? [shape: diamond, color: teal]
}


// ==================================================
// PHASE 7 — GROWTH & SHARING
// ==================================================

growth [color: purple] {
    Identity Card Trigger [color: purple]
    Generate Identity Card [color: purple]

    Render Successful? [shape: diamond, color: purple]

    Retry Render [color: red]
    Static Card Fallback [color: purple]
    Card Preview [color: purple]

    Wrapped Ready [color: teal]
    Parallel Wrapped [color: teal]
    Wrapped Summary [color: teal]
}


// ==================================================
// PHASE 8 — PROFILE & PRIVACY
// ==================================================

profile [color: gray] {
    Profile [color: gray]
    Public Profile [color: gray]
    My Parallels [color: gray]
    Privacy & Data [color: gray]

    Visibility Settings [color: gray]
    Why Am I Seeing This? [color: gray]
    Export My Data [color: gray]

    Delete Account [color: red]
    Delete Confirmation [shape: diamond, color: red]
    Account Deleted [color: red]

    Logout [color: gray]
    Confirm Logout [shape: diamond, color: gray]
    Session Cleared [color: gray]
}


// ==================================================
// MAIN JOURNEY
// ==================================================

App Opens > Landing

Landing > Sign Up
Landing > Log In

Sign Up > Sign Up Form
Sign Up Form > Account Created
Account Created > Onboarding

Log In > Log In Form
Log In Form > Session Created
Session Created > Onboarding Completed?

Onboarding Completed? > Onboarding : No
Onboarding Completed? > Parallel Map : Yes

Invalid Credentials > Log In Form

Onboarding > Question 1
Question 1 > Question 2
Question 2 > Question 3
Question 3 > Question 4
Question 4 > Building Your Map
Building Your Map > Parallel Map

Onboarding > Resume Onboarding : App closed
Resume Onboarding > Question 1 : Resume

Building Your Map > Minimal Rules Based Map : Slow
Minimal Rules Based Map > Parallel Map


// ==================================================
// CORE MAP
// ==================================================

Parallel Map > Enter Parallel : Tap Parallel
Enter Parallel > Parallel Feed

Parallel Feed > Content Detail : View

Parallel Map > Identity Evolution : Evolution
Parallel Map > New Parallel Discovered : New Parallel
Parallel Map > Profile : Profile

Parallel Feed > Quest List : Quests
Parallel Feed > People Discovery : People


// ==================================================
// IDENTITY DISCOVERY
// ==================================================

New Parallel Discovered > Explore
New Parallel Discovered > Make Public
New Parallel Discovered > Hide Parallel

Explore > Ghost Mode
Ghost Mode > What If World
What If World > Ghost Mode : Continue

Make Public > Public Parallel
Hide Parallel > Hidden Parallel

Public Parallel > Parallel Map
Hidden Parallel > Profile


// ==================================================
// QUESTS
// ==================================================

Quest List > Quest Detail
Quest Detail > Start Quest
Start Quest > Quest In Progress
Quest In Progress > Complete Step
Complete Step > More Steps?

More Steps? > Complete Step : Yes
More Steps? > Quest Completed : No

Quest Completed > Reward Granted
Reward Granted > Celebration
Celebration > Identity Card Trigger


// ==================================================
// PEOPLE
// ==================================================

People Discovery > Person Profile

Person Profile > Follow / Unfollow
Follow / Unfollow > Person Profile

Person Profile > Twin Match? : Twin badge
Twin Match? > Twin Comparison : Yes
Twin Match? > Person Profile : No

Person Profile > Start Collab

Start Collab > Choose Your Parallel
Choose Your Parallel > Friend Chooses Parallel
Friend Chooses Parallel > Both Accepted?

Both Accepted? > Collab Active : Yes
Both Accepted? > Start Collab : No

Collab Active > Joint Discovery World
Joint Discovery World > Shared Challenge
Shared Challenge > Collab Completed

Collab Completed > Identity Card Trigger


// ==================================================
// EVOLUTION
// ==================================================

Identity Evolution > Parallel History
Identity Evolution > Wrapped Available?

Wrapped Available? > Parallel Wrapped : Yes
Wrapped Available? > Identity Evolution : No

Parallel Wrapped > Wrapped Summary
Wrapped Summary > Parallel Map


// ==================================================
// IDENTITY CARDS
// ==================================================

Identity Card Trigger > Generate Identity Card
Generate Identity Card > Render Successful?

Render Successful? > Card Preview : Yes
Render Successful? > Retry Render : No

Retry Render > Card Preview : Retry succeeds
Retry Render > Static Card Fallback : Retry fails

Static Card Fallback > Card Preview
Card Preview > Parallel Map : Done


// ==================================================
// PROFILE
// ==================================================

Profile > Public Profile
Profile > My Parallels
Profile > Privacy & Data

My Parallels > Make Public
My Parallels > Hide Parallel

Privacy & Data > Visibility Settings
Privacy & Data > Why Am I Seeing This?
Privacy & Data > Export My Data
Privacy & Data > Delete Account

Delete Account > Delete Confirmation

Delete Confirmation > Account Deleted : Confirm
Delete Confirmation > Privacy & Data : Cancel

Account Deleted > Landing


// ==================================================
// LOGOUT
// ==================================================

Profile > Logout
Logout > Confirm Logout

Confirm Logout > Session Cleared : Confirm
Confirm Logout > Profile : Cancel

Session Cleared > Landing```
````
