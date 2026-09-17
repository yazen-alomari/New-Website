# MAP it on Alomari Associates

The MAP it interface is bundled with this website at `/Inventory/Mapit`.
It is not linked in the main navigation or sitemap, and requests carry `noindex`.
No ChatGPT account or sign-in is required. Anyone with the URL can read and edit
the shared inventory; an unlinked URL is not an access restriction.

## Build and preview

Run `pnpm install` and `pnpm build` at the repository root. The main website is
built first, followed by MAP it in `dist/Inventory/Mapit`. `pnpm dev:mapit` opens
the local app at `http://127.0.0.1:5174/Inventory/Mapit/`.

## Shared records

Vercel forwards `/Inventory/Mapit/api/*` to the existing MAP it backend at
`https://mapit-lab-inventory.yazinalomary.chatgpt.site/api/*`. The browser stays
on the Alomari domain. Inventory, workflow edits, orders, CSV imports and PDF
downloads use that backend and its existing D1 database. Local storage holds
only display preferences, not operational records.

This is a deployable frontend package with a hosted database dependency, not an
offline or standalone database package. Keep the MAP it backend published with
public access and its anonymous API enabled. Do not replace it with a static
export. Database migrations and backend changes belong in the original MAP it
project, which retains its `.openai/hosting.json` identity.

The API preserves revision checks for simultaneous edits and accepts browser
saves from the Alomari apex and `www` origins. API responses must remain
`Cache-Control: no-store` so different visitors see the latest saved data.

For testing against a local backend, set `MAPIT_API_ORIGIN=http://localhost:3000`
when starting `pnpm dev:mapit`. The preview proxy forwards only MAP it API routes.
