# Explicit illustrative investment example: UI handoff

`createIllustrativeInvestmentExample(property, year)` is a pure draft adapter. It returns `{ ok: true, model: EditorModel }` or `{ ok: false, reason, message }`. It does not submit, calculate canonical results, change state, access a provider or read local data. It uses the current selected property's positive `source_data` rentable area and preserves its exact source string. Unknown or assumed area is rejected; room dimensions never substitute for it.

Import from `@/lib/scenarios/illustrative-example`:
- `createIllustrativeInvestmentExample`
- `ILLUSTRATIVE_EXAMPLE_LABEL` — “Load illustrative investment example”
- `ILLUSTRATIVE_EXAMPLE_DISCLOSURE` — display beside the action and retain after loading.

Minimal integration in Claude's scenario workspace:
1. Add one editor action `{ type: "replace_model"; model: EditorModel }`; its reducer case returns `action.model`. This adapter does not edit the reducer or any component.
2. On the explicit button click, call the factory with the **current selected property and existing `model.year`**. On failure, show `message` and keep the current drafts unchanged.
3. On success, call the existing `edit({ type: "replace_model", model: result.model })` once. That wrapper must still call `onEdited()` exactly once so the dashboard advances `inputRevision`, cancels obsolete loading state and marks earlier comparison/analysis stale. Do not mutate model state or reset the revision directly.
4. Select the `baseline` tab and clear the previous submission-attempt flag. Keep the disclosed hypothetical-input notice visible and make clear that this action replaces all existing scenario drafts and constraints. If a draft replacement confirmation is used, apply only after confirmation.
5. Keep all fields editable. Keep Calculate/Analyze as separate user actions; loading must never submit or call a model. Do not call the adapter from `initialModel`, an effect, property selection or a default fallback.

The result contains the reviewed baseline and two alternatives, gross annual rent notes, owner-paid expense scope, all five upfront cost categories, deliberate exclusions/zeros, hypothetical existing-property cost basis, a $2M budget, ten-year simple-payback limit and moderate risk. Financial fields use `accepted: true` because the explicit load action accepts hypothetical assumptions for editing; they must not be described as verified sponsor inputs. Source rentable area remains `accepted: false`, with original source provenance. Financial calculations and ranking remain server-owned.

The selected approved local property has been checked through the existing comparison API: $2M conditionally prefers `alternative-b`; changing only budget to $1M excludes B and conditionally prefers `alternative-a`. The outcome is not hardcoded and is not guaranteed for arbitrary properties. No actual sponsor ID, recorded area, mapping or dataset is embedded here. Use names from the current response in the UI rather than hardcoding a recommendation.

Before accepting the button: verify a single revision bump, stale summaries disappearing, late responses being rejected, successful edits/recalculation, failure preserving drafts and no automatic `/analysis` request. Rehearsal remains a separate human verification gate.
