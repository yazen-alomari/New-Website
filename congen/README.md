# Consultative Genomics

Internal operations portal at `/consultative-genomics`, deliberately absent from the public navigation and excluded from indexing. The existing website, MAPIT, tracker and Deen Garden routes remain independent.

## Workspaces

- Test economics: the original v3 molecular calculator, owner-supplied October 16, 2026 rates, panel-specific overrides, repeat runs, labor, overhead, custom costs, saved scenarios, comparisons, JSON import/export, CSV and print reports. Blank costs remain unknown and are excluded from the known subtotal. Planning estimates are not reimbursement guarantees.
- Client onboarding: separate laboratory and clinic pathways, seven stages, gated final approval, hold/resume, archive/restore, internal notes, activity history, document links/uploads, and editable follow-up drafts. Sending a draft does not automatically complete a milestone.
- Materials: team-only PDF, DOCX, PNG and JPEG attachments up to 2 MB or HTTPS document links. Approved forms and agreements must be supplied by the organization; none are fabricated.
- Settings: team identity, external ordering/results portal URL, and JSON workspace export. This is not a LIS or a patient ordering/results system.

## Run and Test

```sh
pnpm install
pnpm dev:congen-api
# In another terminal:
pnpm dev:congen
pnpm test:congen
pnpm build
```

Local preview: `http://127.0.0.1:5176/consultative-genomics/`. Development key: `local-preview-only`. Development storage is isolated in `/tmp/congen-development`, never the production Blob store. Production functions cannot enable the local-storage path when `VERCEL` is present.

## Hosting and Storage

Vite builds into `dist/consultative-genomics`. Vercel routes `/consultative-genomics/api/*` to the functions in `api/congen`. Workspace data is stored privately at `congen/workspace.json` in the project's private Vercel Blob store; documents have random, immutable paths. Reads bypass the Blob cache, and writes compare revisions and Blob ETags. A stale save returns 409 instead of overwriting a teammate's change. Refresh before retrying; export an unsaved cost draft first if needed.

Server environment variables:

- `BLOB_READ_WRITE_TOKEN`: project-scoped private Blob token supplied by Vercel.
- `CONGEN_ACCESS_KEY`: randomly generated team access key.
- `CONGEN_SESSION_SECRET`: independent high-entropy cookie signing secret.

None are client-side Vite variables. Do not commit `.env*`, access files or credentials. The owner's access instructions are outside this repository at `~/Documents/Consultative Genomics Portal Access.txt`.

## Access and Data Boundaries

All team-key holders can read and edit all workspace records. Names are self-reported activity labels, not verified individual identities or role-based approvals. Sessions expire after eight hours and use signed, HttpOnly, Secure-in-production, SameSite=Strict cookies. Rotate both access and signing secrets, then redeploy, to revoke existing sessions.

This workspace is for organization onboarding and business planning only. Do not enter patient information or PHI. Do not treat this deployment as a HIPAA-compliant clinical system, an e-signature service, or a compliance audit trail. Before requirements expand to individual roles, client access or patient data, implement appropriate identity, access, retention and service arrangements.

Uploaded files require an authenticated session to download and are forced to attachments. A private download link is not an external client share link. Download the approved file and attach it to a separately reviewed email, or provide an organization-approved external HTTPS link. The portal never sends email automatically.

JSON workspace exports contain document references, not file bytes. Download documents separately for a complete backup. Removing a library entry hides the reference but does not immediately purge its underlying private Blob. Blob retention and permanent deletion are administrative operations. Archived client records remain retained and recoverable.

## Verification

`pnpm test:congen` includes the original 26 calculator regression tests plus workflow, session, URL and upload checks. Verify the production gate, authenticated save/reload, stale-write conflict, attachment authorization, and existing public routes after deployment. Browser testing should cover desktop, tablet and mobile, including the cost settings and client detail views.
