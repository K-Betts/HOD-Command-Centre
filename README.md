The Mission
To build a holistic Leadership Operating System that supports the Head of Department across three distinct domains:
    1. Outward Leadership: Driving strategy, developing staff, and fostering culture (The "Leader").
    2. Operational Administration: Efficiently managing the inevitable noise of budgets, emails, and tasks (The "Manager").
    3. Inward Development & Wellbeing: Protecting the user’s mental health, tracking personal growth, and preventing burnout (The "Human").

The Core Philosophy: The app must ruthlessly optimize Admin (speed) to create space for Leadership (depth), while acting as a guardrail for Wellbeing (sustainability).

The Four Strategic Pillars
Pillar 1: The People Engine (The "Coach")
    Goal: Shift from "Staff Records" to "Relationship & Wellbeing Monitoring."
    Philosophy: High Challenge, High Support (Andy Buck) + Psychological Safety (Sinek).
    Mechanism:
      Inference: Infers interaction types (Challenge vs. Support) from tasks/events.
     Proactivity: Nudges the user when relationships go cold or become unbalanced.
      Self-Care: Monitors the user's own "Support" balance—if you are giving too much support without recharging, the system warns you.

Pillar 2: The Execution Engine (Adaptive Focus)
    Goal: Balance "Weekly Big Rocks" with "Daily Admin Context."
    Philosophy: Situational Execution—matching work to energy and time.
    Mechanism:
        The Anchor: "Weekly Wins" remain visible to prevent getting lost in admin.
        Smart Context: A dynamic suggestion engine that surfaces low-energy Admin tasks during small gaps, keeping the schedule clear for Deep Work.

Pillar 3: The Strategy Engine (The "Mirror")
    Goal: Ensure daily actions align with long-term purpose.
    Philosophy: Start With Why (Sinek).
    Mechanism:
        The Heatmap: Retrospective analysis showing the split between "Operational Noise" vs. "Strategic Impact."
        Impact Awareness: Visual feedback that highlights neglected strategic goals.

Pillar 4: The Intelligence Engine (The "Reviewer")
    Goal: Curated intelligence over raw data ingestion.
    Philosophy: Data Integrity First.
    Mechanism:
        The Review Loop: Brain Dumps and Logs enter a "Staging Area." The user reviews the AI's interpretation before it enters the database.
        The Gatekeeper: Prevents the database from becoming a "Junk Drawer" of hallucinations.

UI/UX Implications (The Interface Upgrade)
The adoption of these pillars requires a fundamental UI shift from a "Static Dashboard" to a "Context-Aware Workspace."

Distinct Modes: The UI should visually distinguish between "Admin Mode" (High density, fast interaction, list-based) and "Leadership Mode" (Low density, reflective, visual/card-based).

Dynamic Visibility: "Plan Today" slots and "Weekly Wins" should dominate the view, while low-priority admin lists should recede until needed (Smart Context).

Human-Centric Data: Staff profiles should look less like database rows and more like "Player Cards" showing health, balance, and history.

The application must respect the cyclical nature of schools.
	•	Units of Time: The primary units of planning are Half-Terms, Terms, and Academic Years.
	•	The Yearly Reset: At the start of a new Academic Year, the system must support a Soft Reset:
	•	Archiving: All past-year data (tasks, priorities, plans, curriculum maps, events, etc.) is archived by default.
	•	Budget: Resets to the new allocation for the year.
	•	Priorities:
	•	Completed priorities are archived with the rest of the year.
	•	Only explicitly marked “ongoing” or “multi-year” priorities may be carried forward.
	•	Staff & Wellbeing Data (Not Archived):
	•	Staff profiles and all interactions with staff remain live and accumulate over time.
	•	Wellbeing trends for you (the HoD) persist across years so long-term patterns can be tracked, even though individual year artefacts are archived.
	•	Context: Default views focus on the current Academic Year and its current cycle (Term / Half-Term), with access to archived years when needed.

---

## Ops / Security Notes

- Firestore security rules live in [firestore.rules](firestore.rules). Deploy these via Firebase CLI (or your CI) so access control is enforced server-side.
- Access control uses RBAC documents in the top-level `roles` collection (keyed by UID).
    - A signed-in user is considered authorized if `roles/{uid}` exists with `role` in: `user | admin | superadmin`.
    - Admin features require `role` in: `admin | superadmin`.
    - Role management (create/update/delete) is restricted to `superadmin`.
- `whitelistedUsers/{emailLower}` is retained only as a legacy invite/bootstrap list for migrating existing users. It is not the primary authorization mechanism.
- Telemetry and crash/feedback are written to `artifacts/{appId}/telemetry` and `artifacts/{appId}/feedback` (admin-readable; client-writable for authorized roles).
    - Events include `sessionId` for correlation, and an `expiresAt` timestamp field you can hook up to Firestore TTL for automatic retention cleanup.
- Data classification / PII inventory: [docs/data-classification.md](docs/data-classification.md)

Local validation:
- `npm run test:rules` (runs Firestore rules tests against the emulator)
- `npm run verify` (lint + build + rules tests)

CI:
- GitHub Actions runs the same quality gate (`npm run verify`) on PRs via `.github/workflows/verify.yml`.
- Node version is pinned via `.nvmrc` (CI uses it via `actions/setup-node`).

## AI Proxy (Server-Side)

The app calls Gemini via a Firebase Cloud Function (`generateAIResponse`) so the Gemini API key is never shipped to the browser.

- Client code calls the function via `httpsCallable` (no `VITE_GEMINI_API_KEY` required).
- Server requires:
    - `GEMINI_API_KEY` (Gemini API key, set as a Functions Secret)
    - `SUPER_ADMIN_EMAIL` (super admin email used by functions auth)

Optional hardening knobs (Functions env vars):
- `AI_ALLOWED_MODELS` (comma-separated allowlist; defaults to the app's default model)
- `AI_MAX_PROMPT_CHARS` (defaults to 60000)
- `AI_MAX_OUTPUT_TOKENS` (defaults to 4096)
- `AI_QUOTA_PER_DAY` and `AI_QUOTA_PER_MINUTE` (defaults vary by role)
- `ARTIFACT_APP_ID` (defaults to `hod-production-v1`; should match `src/config/appConfig.js`)

Set the Functions secret:
- `firebase functions:secrets:set GEMINI_API_KEY`

Deploy (rules/indexes/functions):
- `firebase login`
- `firebase use --add` (bind to your Firebase project if you haven't already)
- `firebase deploy --only firestore:rules,firestore:indexes,functions`

Typical setup (Firebase CLI):
- `firebase login`
- `firebase init functions` (if you want to regenerate config; this repo already includes `firebase.json` + `functions/`)
- Set secrets/env for functions (choose your preferred approach: secrets or env vars)
- Deploy: `firebase deploy --only functions,firestore`