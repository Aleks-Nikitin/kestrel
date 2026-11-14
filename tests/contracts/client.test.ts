import { describe, expect, it, vi } from "vitest";
import { createApiClient, isCurrentResponse } from "@/lib/contracts/client";
import * as f from "../fixtures/contracts";
const transport = (data: unknown, status = 200) =>
  vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify(data), { status }));
describe("browser-safe contract client", () => {
  it("accepts a valid property detail keyed by its own id", async () => {
    const result = await createApiClient(transport(f.success(f.property)))
      .getProperty(f.propertyId);
    expect(result.ok).toBe(true);
  });
  it("validates successful canonical responses", async () => {
    const fetcher = transport(f.success(f.comparison));
    expect((await createApiClient(fetcher).compare(f.f01)).ok).toBe(true);
    expect(fetcher.mock.calls[0][0]).toBe("/api/v1/scenarios/compare");
  });
  it("converts malformed responses to CONTRACT_MISMATCH", async () => {
    const result = await createApiClient(
      transport({ ok: true, data: {} }),
    ).compare(f.f01);
    expect(result.ok ? null : result.error.code).toBe("CONTRACT_MISMATCH");
  });
  it("rejects a different property returned by a detail route", async () => {
    const x = structuredClone(f.property);
    x.id = "other";
    x.evidence = x.evidence.map((e) => ({ ...e, propertyId: "other" }));
    const result = await createApiClient(transport(f.success(x))).getProperty(
      f.propertyId,
    );
    expect(result.ok ? null : result.error.code).toBe("CONTRACT_MISMATCH");
  });
  it("rejects stale revisions and changed property IDs", async () => {
    const x = structuredClone(f.comparison);
    x.inputRevision = x.comparison.inputRevision = 2;
    const result = await createApiClient(transport(f.success(x))).compare(
      f.f01,
    );
    expect(result.ok ? null : result.error.code).toBe("CONTRACT_MISMATCH");
    expect(
      isCurrentResponse(
        { propertyId: "a", inputRevision: 1 },
        { propertyId: "b", inputRevision: 1 },
      ),
    ).toBe(false);
  });
  it("preserves validated retryability for upstream errors", async () => {
    const result = await createApiClient(
      transport(f.errors.TIMEOUT, 504),
    ).compare(f.f01);
    expect(result.ok ? null : result.error.code).toBe("TIMEOUT");
  });
  it("rejects error envelopes with successful HTTP status", async () => {
    const result = await createApiClient(transport(f.errors.TIMEOUT)).compare(
      f.f01,
    );
    expect(result.ok ? null : result.error.code).toBe("CONTRACT_MISMATCH");
  });
  it("propagates cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new DOMException("Aborted", "AbortError"));
    await expect(
      createApiClient(fetcher).compare(f.f01, controller.signal),
    ).rejects.toThrow("Aborted");
  });
  it("rejects forged requests before any network call", async () => {
    const fetcher = transport({});
    expect(() => createApiClient(fetcher).compare(f.originForgery)).toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
