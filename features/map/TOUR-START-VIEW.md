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

## Optional protected starting view

`model.showcase.startView` is optional in the shared strict spatial contract:

```ts
startView?: { ss: string; sr?: string }
```

The protected `modelMapping.showcase` runtime configuration supplies it alongside the matching SID and dated publication proof. Only the existing verified property/model binding enables the viewer. The provider passes the configured values unchanged, and the client reads the typed response; it never hardcodes a sponsor model or derives a location from room dimensions.

`ss` is a bounded numeric scan position. `sr` is a bounded comma-separated rotation pair, allowing either component to be empty. Invalid protected configuration is rejected. URL parameters select an initial location only; the standard hosted iframe remains unchanged. Without configuration, Matterport's default start is used. Schema acceptance alone does not verify that a sweep exists: check the selected model and view in a real browser before treating that location as verified.

See Matterport's official [deep-link guidance](https://support.matterport.com/s/article/How-to-Connect-Two-or-More-Spaces-with-Mattertags-and-Deep-Links?language=en_US).
