import { mkdirSync } from "node:fs";

import { updateCompatibilityDate } from "./update-compatibility-date";
import { esiBaseUrl } from "../lib/constants";
import {
  compatibilityDateExists,
  readCompatibilityDate,
} from "../lib/compatibility-date-file";
import { fetchOpenApiSpec } from "../lib/esi-fetch";
import {
  ensureIndexTs,
  generateSchema,
  writeOpenApiSpec,
} from "../lib/output-files";
import { stripGlobalHeaders } from "../lib/spec";

export type DownloadSpecOptions = {
  outputDir: string;
  updateOnly?: boolean;
};

export const downloadSpec = async ({
  outputDir,
  updateOnly = false,
}: DownloadSpecOptions): Promise<void> => {
  mkdirSync(outputDir, { recursive: true });

  if (updateOnly) {
    const { changed, current } = await updateCompatibilityDate(outputDir);

    if (!changed) {
      console.log(
        `Compatibility date unchanged (${current}). Skipping spec download.`,
      );
      return;
    }
  } else if (!compatibilityDateExists(outputDir)) {
    await updateCompatibilityDate(outputDir);
  }

  const compatibilityDate = readCompatibilityDate(outputDir);

  if (!compatibilityDate) {
    throw new Error(
      `Missing compatibility date in ${outputDir}. Run update-compatibility-date first.`,
    );
  }

  const spec = (await fetchOpenApiSpec(compatibilityDate)) as Record<
    string,
    unknown
  >;
  stripGlobalHeaders(spec);

  const { changed, path } = writeOpenApiSpec(outputDir, spec);

  if (changed) {
    console.log(`Wrote OpenAPI spec to ${path}.`);
    const schemaPath = await generateSchema(outputDir);
    console.log(`Wrote schema to ${schemaPath}.`);
  } else {
    console.log(`OpenAPI spec is already up to date (${path}).`);
  }

  const { created, path: indexPath } = ensureIndexTs(
    outputDir,
    spec,
    esiBaseUrl,
  );

  if (created) {
    console.log(`Wrote index to ${indexPath}.`);
  }
};
