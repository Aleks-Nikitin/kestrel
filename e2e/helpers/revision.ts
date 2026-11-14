/**
 * Mocked successful responses must answer the request actually sent: the
 * client rejects a response whose inputRevision differs (stale protection),
 * and the UI advances the revision on every edit. Derive it from the request
 * rather than hardcoding a number.
 *
 * Returns a copy; shared fixtures are never mutated. Error envelopes pass
 * through unchanged. `offset` deliberately mismatches the revision to test
 * rejection of a stale or wrong response.
 */
export function answeringRevision<T>(body: T, request: unknown, offset = 0): T {
  const copy = structuredClone(body) as {
    ok?: boolean;
    data?: { inputRevision?: number; comparison?: { inputRevision?: number } };
  };
  const revision = (request as { inputRevision?: number } | null)?.inputRevision;
  if (copy.ok !== true || !copy.data || typeof revision !== "number") return copy as T;
  copy.data.inputRevision = revision + offset;
  // The comparison policy block must agree with the envelope's revision.
  if (copy.data.comparison && "inputRevision" in copy.data.comparison)
    copy.data.comparison.inputRevision = revision + offset;
  return copy as T;
}
