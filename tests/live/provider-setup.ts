import { config } from "dotenv";
import { CoStarDatasetProvider } from "@/lib/providers/costar/dataset";
import { readCommercialModelMapping } from "@/lib/providers/costar/mapping";
config({ quiet: true });
export function liveDatasetConfig() {
  if (process.env.SPONSOR_AGREEMENT_ACCEPTED !== "true")
    throw new Error(
      "Set SPONSOR_AGREEMENT_ACCEPTED=true only after the owner confirms agreement acceptance.",
    );
  if (!process.env.COSTAR_KIT_DIR)
    throw new Error("COSTAR_KIT_DIR is required for the real dataset test.");
  return {
    kitDir: process.env.COSTAR_KIT_DIR,
    indexPath: process.env.COSTAR_MODELS_INDEX_PATH || undefined,
    agreementAccepted: true,
    permissions: { display: false, modelProcessing: false, export: false },
  };
}
export async function selectLiveCommercial(signal: AbortSignal) {
  const config = liveDatasetConfig();
  const provider = new CoStarDatasetProvider(config);
  const matches = await readCommercialModelMapping(config, signal);
  if (process.env.COSTAR_DEMO_PROPERTY_ID)
    return {
      property: await provider.getProperty({
        propertyId: process.env.COSTAR_DEMO_PROPERTY_ID,
        signal,
      }),
      matches,
      config,
    };
  const catalog = await provider.listProperties({ limit: 20, signal });
  const property = catalog.find(
    (p) =>
      p.rentableAreaSqft.value !== null &&
      p.grossAreaSqft.value !== null &&
      p.location.value !== null &&
      matches.filter((m) => m.propertyId === p.id).length === 1 &&
      !matches.some(
        (m) =>
          m.modelId === matches.find((n) => n.propertyId === p.id)?.modelId &&
          m.propertyId !== p.id,
      ),
  );
  if (!property)
    throw new Error(
      "No unambiguous commercial candidate in the bounded catalog; provide a reviewed COSTAR_DEMO_PROPERTY_ID.",
    );
  return { property, matches, config };
}
