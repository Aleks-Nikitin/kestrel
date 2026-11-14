import "server-only";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { Id, type PropertyDTO, type PropertyProvider } from "@/lib/contracts";
import { ProviderError } from "../errors";
import {
  CommercialRecord,
  isSupportedCommercial,
  normalizeCommercialProperty,
  type CommercialRecordDTO,
} from "./records";
export interface DatasetConfig {
  kitDir: string;
  agreementAccepted: boolean;
  permissions: { display: boolean; modelProcessing: boolean; export: boolean };
  now?: () => Date;
}
export class CoStarDatasetProvider implements PropertyProvider {
  constructor(private readonly config: DatasetConfig) {}
  private async *records(
    signal: AbortSignal,
  ): AsyncGenerator<CommercialRecordDTO> {
    if (!this.config.agreementAccepted)
      throw new ProviderError(
        "LICENSE_RESTRICTED",
        "Sponsor agreement acceptance is required for dataset access.",
      );
    signal.throwIfAborted();
    const path = resolve(
      this.config.kitDir,
      "data",
      "commercial-property.jsonl",
    );
    let size: number;
    try {
      size = (await stat(path)).size;
    } catch {
      throw new ProviderError(
        "UPSTREAM_UNAVAILABLE",
        "The configured commercial dataset is unavailable.",
      );
    }
    if (size > 256 * 1024 * 1024)
      throw new ProviderError(
        "DATA_MISMATCH",
        "The dataset exceeds the approved read limit.",
      );
    const stream = createReadStream(path, { encoding: "utf8", signal });
    const lines = createInterface({ input: stream, crlfDelay: Infinity });
    let lineCount = 0;
    const ids = new Set<number>();
    try {
      for await (const line of lines) {
        signal.throwIfAborted();
        if (!line.trim()) continue;
        if (++lineCount > 10000 || Buffer.byteLength(line) > 2 * 1024 * 1024)
          throw new ProviderError(
            "DATA_MISMATCH",
            "The dataset record limit was exceeded.",
          );
        let value: unknown;
        try {
          value = JSON.parse(line);
        } catch {
          throw new ProviderError(
            "DATA_MISMATCH",
            "A dataset record contains invalid JSON.",
          );
        }
        const parsed = CommercialRecord.safeParse(value);
        if (!parsed.success || ids.has(parsed.data.id))
          throw new ProviderError(
            "DATA_MISMATCH",
            "A commercial record is invalid or has a duplicate identifier.",
          );
        ids.add(parsed.data.id);
        yield parsed.data;
      }
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(
        "UPSTREAM_UNAVAILABLE",
        "The commercial dataset could not be read.",
      );
    } finally {
      lines.close();
      stream.destroy();
    }
  }
  async listProperties({
    limit,
    signal,
  }: {
    limit: number;
    signal: AbortSignal;
  }): Promise<PropertyDTO[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 20)
      throw new ProviderError(
        "INVALID_INPUT",
        "Catalog limit must be between 1 and 20.",
      );
    const properties: PropertyDTO[] = [];
    const at = (this.config.now?.() ?? new Date()).toISOString();
    for await (const record of this.records(signal)) {
      if (properties.length < limit && isSupportedCommercial(record))
        properties.push(
          normalizeCommercialProperty(record, at, this.config.permissions),
        );
    }
    return properties;
  }
  async getProperty({
    propertyId,
    signal,
  }: {
    propertyId: string;
    signal: AbortSignal;
  }): Promise<PropertyDTO> {
    if (!Id.safeParse(propertyId).success || !/^[1-9]\d{0,9}$/.test(propertyId))
      throw new ProviderError(
        "INVALID_INPUT",
        "A valid commercial property identifier is required.",
      );
    let found: CommercialRecordDTO | undefined;
    for await (const record of this.records(signal))
      if (String(record.id) === propertyId) found = record;
    if (!found || !isSupportedCommercial(found))
      throw new ProviderError(
        "NOT_FOUND",
        "The commercial property is not in the supported catalog.",
      );
    return normalizeCommercialProperty(
      found,
      (this.config.now?.() ?? new Date()).toISOString(),
      this.config.permissions,
    );
  }
}
