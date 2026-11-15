# Investigation panel: what is shown and what is deferred

`InvestigationPanel` renders only what `AnalysisResponse` (status `complete`) already returns:
`execution.completedTools` (name, toolCallId, evidenceIds), the evidence table, claim `kind`/`evidenceIds`/`metricRefs`,
`modelUsage`, `execution.{requestId, elapsedMs, dataMode}`. The tool list is shown in the order returned, not as a timeline,
and nothing is a model-reasoning record. "Cites support" is counted, never labelled verified. The panel is hidden for stale results.

## Deferred (no contract fields yet)
- VERIFIED / unsupported labels per claim
- A correction attempt, its reason, and independent revalidation result
- A limited-result state when verification fails

The panel currently states "Independent verification: not reported for this run" and claims no repair.

## Question for Codex: minimal metadata you intend to expose
Proposed shape, to be confirmed or replaced (nothing in the UI depends on it yet):

```
execution.verification: {
  status: "passed" | "failed" | "not_run",
  claims: [{ claimIndex: number, result: "verified" | "unsupported" }],   // only from the deterministic verifier
  correction: null | { attempted: true, reasonCode: string, revalidation: "passed" | "failed" }
}
```
Please tell us: the real field names, whether results are per claim index, whether a failed verification still returns
`status: "complete"`, and what `reasonCode` values exist (we'll map them to fixed copy; no free-form model text is rendered as a reason).

## Integration point
Extend only `buildInvestigation` in `features/analysis/investigation.ts` (replace `verification: null`) and the
"Independent verification" block in `investigation-panel.tsx`. `analysis-result.tsx` needs no further change.
