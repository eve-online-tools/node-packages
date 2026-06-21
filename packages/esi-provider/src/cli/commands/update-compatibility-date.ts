import { mkdirSync } from "node:fs";

import {
  readCompatibilityDate,
  writeCompatibilityDate,
} from "../lib/compatibility-date-file";
import { fetchLatestCompatibilityDate } from "../lib/esi-fetch";

export type UpdateCompatibilityDateResult = {
  previous: string | null;
  current: string;
  changed: boolean;
};

export const updateCompatibilityDate = async (
  outputDir: string,
): Promise<UpdateCompatibilityDateResult> => {
  mkdirSync(outputDir, { recursive: true });

  const latestDate = await fetchLatestCompatibilityDate();
  const previous = readCompatibilityDate(outputDir);
  const changed = previous !== latestDate;

  if (!changed) {
    console.log(`Compatibility date is already up to date (${latestDate}).`);
    return { previous, current: latestDate, changed: false };
  }

  writeCompatibilityDate(outputDir, latestDate);

  const previousLabel = previous ?? "none";
  console.log(
    `Saved compatibility date ${latestDate} (was ${previousLabel}).`,
  );

  return { previous, current: latestDate, changed: true };
};
