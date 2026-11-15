# Tour readiness and starting view

## What changed in the viewer
- A late iframe `load` event no longer produces a blocking error. After 12 s the viewer shows a small dismissible
  *"Still loading"* notice that clears itself if the tour loads, or as soon as focus moves into the iframe (the person
  is already using it). It never covers the scene. "Try again" and "Open tour in new tab" stay available, plus a
  permanent Full screen / Open tour toolbar above the viewer.
- Kestrel does not observe Matterport's network requests. Aborted analytics calls (e.g. `ERR_ABORTED`) are not treated
  as scene failures.
- The iframe is no longer `loading="lazy"`; it only mounts after the person opens 3D, so lazy loading could only delay
  its load event.
- The model id, SID source (`model.showcase.sid`) and matching rules are unchanged.

## Optional starting view (needs a server-controlled contract change: Codex)
The client already accepts a start view and appends it to the Showcase URL, but nothing supplies it yet.
`features/map/tour.ts` reads `model.showcase.startView` and validates it:

```
startView?: { ss: string /* digits, 1–4 */, sr?: string /* "x,y" numbers, either may be empty */ }
```
Values are passed through exactly as verified for the model (Copilot verified `ss=34&sr=,-1.04` on a direct share
link); Kestrel only checks their shape and never invents or hardcodes them.

Request for Codex:
1. Add the optional `startView` to `model.showcase` in `lib/schemas/property.ts` (the schema is a `strictObject`, so the
   API client rejects an unknown key until the schema allows it).
2. Supply it from protected/private configuration alongside the existing publication proof, keyed by the verified
   model, never in public source.
3. After the schema change, replace the untyped read in `startViewOf` with typed access (a one-line change).

Until then the tour opens at Matterport's default start view.
