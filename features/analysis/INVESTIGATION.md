# Investigation panel contract handoff

The panel reads actual completed tool receipts, cited-support counts, model usage and the optional successful deterministic receipt from `AnalysisResponse`.

Authoritative fields in `lib/schemas/results.ts`:

```ts
execution.verification?: {
  status: "verified";
  method: "bound_claims_v1";
  submissionAttempts: number; // integer 1–2
  correctionAttempts: number; // integer 0–1; equals submissionAttempts - 1
}
```

A complete response with this receipt includes a successful `verifyAnalysis` tool receipt. The view-model projects the actual fields without inferring correction from model attempts. Missing verification means not reported, never failed or passed. These checks establish consistency with retrieved authorized evidence and screening policy, not independent truth or legal/structural certification.

There are no per-claim verdicts, validation reason codes or failed correction traces in the public response. Do not fabricate them. Failed verification returns the existing `ANALYSIS_UNAVAILABLE` API error, not a complete response with a failed receipt; the separate comparison stays available. Missing financial inputs use the existing `needs_input` response. Stale analysis hides this panel.

The ordered tools are a list of completed calls, not a reasoning transcript or timing trace. Cited-support counts are not per-claim verification. Both frontend and server must rebuild against the same authoritative strict contract.
