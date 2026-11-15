/** Synthetic model-script submission; callers choose expected IDs/values explicitly. */
export function verificationCall(propertyId: string, inputRevision: number, preferredScenarioId: string | null = "alternative-b", value = "195000") {
    return [{ name: "verifyAnalysis", args: { propertyId, inputRevision, preferredScenarioId, financialClaims: [{ scenarioId: "alternative-b", metric: "noi", value, unit: "USD/year" }], propertyClaims: [], spatialClaims: [], riskCodes: [] }, id: "verified-claims" }];
}
