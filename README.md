# Kestrel

See the potential in every property.

Kestrel is a commercial-property screening application built during HackPrinceton. The current foundation supplies a Next.js dashboard entry, validated transport contracts and synthetic development fixtures. Real sponsor retrieval, financial services, AI execution and deployment are not yet verified.

## Development

Use Node 24 and npm. Run `npm ci`, copy `.env.example` to `.env` and supply credentials locally, then run `npm run dev`. Environment files and sponsor datasets must stay outside version control and deployment artifacts. No sponsor data is included in this repository.

Run `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:unit`. Integration, live and browser suites have separate scripts; missing live prerequisites are failures, not successful skipped tests.

The application uses root-level `app/`, `lib/`, `features/` and `components/`. Requests use decimal strings and explicit units; deterministic financial services will own calculations and rankings. AI analysis is server-side and remains disabled until configured and verified. Synthetic fixtures are fictional and do not establish live integration.

## Framework credits

Kestrel uses Next.js, React, TypeScript, Tailwind CSS, shadcn/ui and Radix UI, Lucide, Recharts, MapLibre GL JS, Turf, Zod, Decimal.js, LangChain Deep Agents, Google's Gemini integration and OpenRouter's integration. Vitest and Playwright provide testing. These libraries supply infrastructure; Kestrel's contracts, integration logic, domain calculations and product workflow are project work.

## Basemap

The default MapLibre style is [OpenFreeMap Liberty](https://openfreemap.org/quick_start/). OpenFreeMap permits commercial use without an API key. MapLibre displays the supplied OpenFreeMap, OpenMapTiles and OpenStreetMap attribution. Retain it in the application and in screenshots or videos. Liberty's style code is BSD-3-Clause and its design is CC BY 4.0; see [the upstream licenses](https://github.com/hyperknot/openfreemap/blob/main/LICENSE.md). The public service is provided without an availability guarantee.

Set `NEXT_PUBLIC_MAP_STYLE_URL` to another properly licensed HTTPS style if needed. An explicitly empty value selects the labeled plain-background fallback. Repeatable browser tests use that fallback and synthetic records; live basemap verification is separate. Basemap tiles provide geographic context and do not count as matching sponsor evidence.
