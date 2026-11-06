# TrueMed LIS Tracker

Route: `/TrueMedLIStracker`. A separate React/Vite app with public read access and password-protected team editing for Congen, Aegis and True Med. This is not a patient-data system.

## Data and Attribution

Account, scope, status, workstream title, goal, owner, target date/week and completion date are editable. Notes can carry optional numeric progress. Unknown percentages, dates and owners remain unset; a target week is not silently converted into a single deadline.

The November 6, 2026 source report was imported separately into storage. It is not bundled into browser JavaScript or committed as source. Workstream titles and goal statements were drafted from the report; the account, scope, detailed status and ETA retain the supplied information. Import entries use a neutral Source badge, not a fabricated team editor. Future edits are attributed to the authenticated team, with original and revised content preserved in history. Optional editor names are self-reported, not individually verified identities.

All three teams may edit all workstreams. Archiving is reversible. A read-only HTML export embeds current workstreams, updates and audit history without needing a server; it is a point-in-time snapshot, not a live shared database. JSON export retains the complete workspace, including archived records.

While locked, only Unlock editing is active. Timeline checkpoints, Reopen, tabs, filters, exports and other workspace controls are disabled for both pointer and keyboard input. Lock editing closes open workspace controls and restores the full read-only timeline. Failed saves after session expiry request reauthentication while retaining the draft; canceling that prompt locks the workspace.

The interactive roadmap follows the weekly update call theme: a dark grid, green progress waves and clickable checkpoint boxes. The three most recent updates appear beside the target outcome; the drawer retains every update. Cards show the update sequence, not a calendar scale. Wave length reflects recorded numeric progress only. On phones, checkpoints stack along a vertical rail, and reduced-motion preferences disable the traveling highlight.

Completed goals have a Reopen action with a required new deadline and optional additional requirements. Reopening keeps each prior completion as a permanent milestone, records the team and a new update, and starts progress for the added work at zero. The timeline retains the previous completed segment and extends to the new target. Earlier notes remain editable but cannot override the new cycle's progress. Requirements can subsequently be edited with the workstream details.

## Local Development

```sh
pnpm dev:goals
pnpm test:goals
```

The server prints its loopback URL, beginning with port 6021, and generates team passwords once. Local storage and password hashes reside outside the repository in `~/.local/share/aa-goal-tracker-preview`. The local access sheet is `~/Documents/Goal Tracker Team Access.txt`. Optional initial data can be supplied in `goal-tracker/seed.json.local`; it is ignored by Git. Do not commit credentials or initial account records.

## Vercel

The root build includes this app under `dist/TrueMedLIStracker`. Functions in `api/goals` implement session access and workspace reads/mutations. The existing project's private Blob store holds `goals-tracker/workspace.json`, independently of the Consultative Genomics portal.

Required server variables:

- `BLOB_READ_WRITE_TOKEN`: existing private store credential.
- `GOALS_AUTH_CONFIG`: JSON containing independently salted scrypt password hashes for the three teams and a high-entropy session-signing secret. Never a `VITE_` variable.

Sessions use signed, HttpOnly, Secure, SameSite=Strict cookies and last eight hours. High-entropy passwords and per-instance failed-attempt throttling are used; distributed rate limiting and individual identity/RBAC are not implemented. Changing password hashes alone does not revoke active sessions: rotate the signing secret too and redeploy when revocation is needed.

Public viewing includes account names, notes and edit history. `noindex` is not access control. Do not enter patient data, PHI or information that should not be visible to anyone with the link. To require private viewing later, add server-side authentication to reads as well as writes.

Writes compare the workspace revision and the Blob ETag. Reads bypass caching and request uncompressed responses to retain a strong ETag. Stale writes are rejected instead of overwriting another team's changes. The client refreshes idle views periodically and preserves open drafts on conflicts. Preview file storage uses an atomic rename and an in-process write queue; use a single local server per data directory.

## Verification

Unit/integration tests cover missing values, import provenance, cross-team edits, audit preservation, progress calculations, deadline boundaries, archive/restore, session signing/expiry, origin validation, anonymous write denial, stale saves and persistence across server restarts. Browser QA covers all team unlock flows, editable fields/updates, timeline interaction, exports and responsive layouts.
