# Kestrel

See the potential in every property.

Kestrel screens commercial-property reuse scenarios using matched CoStar facts, Matterport spatial estimates, deterministic financial calculations and a bounded Deep Agents workflow. The judging demonstration runs on the presenter's Mac at **http://localhost:3000**. Public hosting is outside the current scope.

## Local demonstration

Use Node 24 and npm. Install dependencies with `npm ci`. Keep the existing root `.env` and reviewed `sponsor-data/runtime/demo-property.json` local; neither is distributed with this repository. The launcher requires `GOOGLE_API_KEY`, `MATTERPORT_API_KEY` and `MATTERPORT_API_TOKEN`. Do not overwrite an existing environment file.

Run `npm run demo` to build and start the local production application. On subsequent starts, use `npm run demo:start` with the verified build. Stop it with Control-C. Port 3000 must be available; the launcher binds to the local machine. Open **http://localhost:3000**, select the property, inspect the 2D map and verified 3D tour, enter disclosed scenario assumptions, calculate the comparison, change the budget, then run Analyze.

The local launcher enables the owner-authorized single-property demo without changing `.env`. Its property projection is labeled licensed cache; Matterport dimensions and Gemini tool execution are retrieved live. Internet access is still required for sponsor/model services, the hosted tour and basemap. Missing data remains unknown, and financial assumptions are not presented as sponsor market facts. Unsaved scenario drafts are lost on reload or property changes, so prepare the tab before presenting.

Gemini uses `gemini-3.1-flash-lite`. OpenRouter is optional and stays disabled unless configured and authorized for the relevant data. Its live fallback is not yet verified. A model outage must leave the direct deterministic comparison available; never describe a failed analysis as live success.

## Development and verification

The application uses root-level `app/`, shared `lib/`, `features/` and `components/`. Shared Zod contracts validate requests and responses. Decimal.js owns canonical financial calculations and rankings; components display server results. The agent executes native planning and typed property, scenario and comparison tools with request isolation and bounded attempts.

Use `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:integration` and `npm run build`. `npm run test:e2e` verifies mocked frontend behavior separately from live sponsor/model tests. Mocked fixtures do not establish real integration. Missing live prerequisites fail rather than silently skip.

Keep credentials, sponsor records, local authority documents and raw model indexes out of Git, browser static assets and build artifacts. Do not expose server credentials through `NEXT_PUBLIC_` variables. The development server (`npm run dev`) does not automatically enable the reviewed demo's permission flags; use the local demo launcher for judging.

## Framework credits

Kestrel uses Next.js, React, TypeScript, Tailwind CSS, shadcn/ui and Radix UI, Lucide, Recharts, MapLibre GL JS, Turf, Zod, Decimal.js, LangChain Deep Agents, Google's Gemini integration and OpenRouter's integration. Vitest and Playwright provide testing. These libraries supply infrastructure; Kestrel's contracts, integration logic, domain calculations and product workflow are project work.

## Basemap

The default MapLibre style is [OpenFreeMap Liberty](https://openfreemap.org/quick_start/). OpenFreeMap permits commercial use without an API key. MapLibre displays the supplied OpenFreeMap, OpenMapTiles and OpenStreetMap attribution. Retain it in the application and in screenshots or videos. Liberty's style code is BSD-3-Clause and its design is CC BY 4.0; see [the upstream licenses](https://github.com/hyperknot/openfreemap/blob/main/LICENSE.md). The public service is provided without an availability guarantee.

Set `NEXT_PUBLIC_MAP_STYLE_URL` to another properly licensed HTTPS style if needed. An explicitly empty value selects the labeled plain-background fallback. Repeatable browser tests use that fallback and synthetic records; live basemap verification is separate. Basemap tiles provide geographic context and do not count as matching sponsor evidence.
