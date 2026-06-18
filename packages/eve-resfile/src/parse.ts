import { RESFILE_INDEX_PATH } from "./constants";

export const parseFirstTwoColumns = (line: string): [string, string] | null => {
  const commaIndex = line.indexOf(",");
  if (commaIndex === -1) {
    return null;
  }

  const path = line.slice(0, commaIndex);
  const remainder = line.slice(commaIndex + 1);
  const secondComma = remainder.indexOf(",");
  const cdnPath = secondComma === -1 ? remainder : remainder.slice(0, secondComma);

  if (!path || !cdnPath) {
    return null;
  }
  return [path, cdnPath];
};

export const parseResfileIndex = (content: string): Map<string, string> => {
  const map = new Map<string, string>();

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const parsed = parseFirstTwoColumns(trimmed);
    if (!parsed) {
      continue;
    }

    const [resPath, cdnPath] = parsed;
    map.set(resPath, cdnPath);
  }

  return map;
};

export const findResfileIndexCdnPath = (buildIndex: string): string => {
  for (const line of buildIndex.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const parsed = parseFirstTwoColumns(trimmed);
    if (!parsed) {
      continue;
    }

    const [path, cdnPath] = parsed;
    if (path === RESFILE_INDEX_PATH) {
      return cdnPath;
    }
  }

  throw new Error(`${RESFILE_INDEX_PATH} not found in build index.`);
};
