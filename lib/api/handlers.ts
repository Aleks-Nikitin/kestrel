import "server-only";
import { randomUUID } from "node:crypto";
import {
  CatalogResponse,
  Property,
  SpatialContext,
  ComparisonRequest,
  ComparisonResponse,
  Id,
  type PropertyProvider,
  type SpatialProvider,
} from "@/lib/contracts";
import { createComparisonService } from "@/lib/contracts/service";
import { ProviderError } from "@/lib/providers/errors";
import { readJSON, success, failure, HttpInputError } from "./http";
export function createHandlers(
  providers: () => { property: PropertyProvider; spatial: SpatialProvider },
) {
  return {
    async catalog(request: Request) {
      const id = randomUUID();
      try {
        const source = providers();
        const properties = await source.property.listProperties({
          limit: 20,
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
        });
        return success(
          CatalogResponse,
          {
            contractVersion: "1",
            properties: properties.map((p) => ({
              id: p.id,
              address: p.address,
              location: p.location,
              propertyType: p.propertyType,
              dataMode: p.dataMode,
              evidence: p.evidence,
            })),
            nextCursor: null,
          },
          id,
        );
      } catch (e) {
        return failure(e, id);
      }
    },
    async property(request: Request, propertyId: string) {
      const id = randomUUID();
      try {
        if (!Id.safeParse(propertyId).success)
          throw new HttpInputError("Invalid property identifier.");
        return success(
          Property,
          await providers().property.getProperty({
            propertyId,
            signal: AbortSignal.any([
              request.signal,
              AbortSignal.timeout(15000),
            ]),
          }),
          id,
        );
      } catch (e) {
        return failure(e, id);
      }
    },
    async spatial(request: Request, propertyId: string) {
      const id = randomUUID();
      try {
        if (!Id.safeParse(propertyId).success)
          throw new HttpInputError("Invalid property identifier.");
        const source = providers();
        const signal = AbortSignal.any([
          request.signal,
          AbortSignal.timeout(20000),
        ]);
        const property = await source.property.getProperty({
          propertyId,
          signal,
        });
        const spatial = await source.spatial.getSpatialContext({
          property,
          signal,
        });
        if (spatial.propertyId !== propertyId)
          throw new ProviderError(
            "DATA_MISMATCH",
            "Spatial evidence does not match the selected property.",
          );
        return success(SpatialContext, spatial, id);
      } catch (e) {
        return failure(e, id);
      }
    },
    async compare(request: Request) {
      const id = randomUUID();
      try {
        const input = await readJSON(request, ComparisonRequest);
        const result = await createComparisonService(providers()).compare(
          input,
          AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
        );
        return success(ComparisonResponse, result, id);
      } catch (e) {
        return failure(e, id);
      }
    },
  };
}
