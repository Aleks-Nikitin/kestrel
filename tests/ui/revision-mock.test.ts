import { describe, expect, it } from "vitest";
import { AnalysisResponse, ComparisonResponse } from "@/lib/contracts";
import { createApiClient } from "@/lib/contracts/client";
import { analysis, comparison, errors, needsInput, propertyId, success, f01 } from "../fixtures/contracts";
import { answeringRevision } from "../../e2e/helpers/revision";

const sent = { inputRevision: 3 };
const transport = (body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch;

describe("e2e answeringRevision mock helper", () => {
  it("produces comparison responses that satisfy the frozen contract at the sent revision", () => {
    const body = answeringRevision(success(comparison), sent);
    const parsed = ComparisonResponse.parse(body.data);
    expect(parsed.inputRevision).toBe(3);
    expect(parsed.comparison.inputRevision).toBe(3);
    expect(parsed.propertyId).toBe(propertyId);
  });
  it("produces complete and needs_input analysis responses at the sent revision", () => {
    for (const fixture of [analysis, needsInput]) {
      const body = answeringRevision(success(fixture), sent);
      expect(AnalysisResponse.parse(body.data).inputRevision).toBe(3);
    }
  });
  it("does not mutate the shared fixtures", () => {
    answeringRevision(success(comparison), sent);
    expect(comparison.inputRevision).toBe(1);
    expect(comparison.comparison.inputRevision).toBe(1);
  });
  it("leaves error envelopes unchanged", () => {
    expect(answeringRevision(errors.TIMEOUT, sent)).toEqual(errors.TIMEOUT);
  });
  it("is accepted by the validated client at the request revision, rejected when deliberately off", async () => {
    const request = { ...f01, inputRevision: 3 };
    const ok = await createApiClient(transport(answeringRevision(success(comparison), request))).compare(request);
    expect(ok.ok).toBe(true);
    const stale = await createApiClient(transport(answeringRevision(success(comparison), request, 7))).compare(request);
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.code).toBe("CONTRACT_MISMATCH");
  });
});
