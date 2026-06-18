import { findResfileIndexCdnPath, parseFirstTwoColumns, parseResfileIndex } from "./parse";
import { RESFILE_INDEX_PATH } from "./constants";

describe("parse", () => {
  it("parses the first two CSV columns", () => {
    expect(parseFirstTwoColumns("res:/icons/icon.png,icons/icon.png,deadbeef")).toEqual([
      "res:/icons/icon.png",
      "icons/icon.png",
    ]);
    expect(parseFirstTwoColumns("invalid-line")).toBeNull();
    expect(parseFirstTwoColumns(",missing-path")).toBeNull();
  });

  it("parses resfile index lines into a map", () => {
    const content = [
      "res:/icons/64/icon.png,icons/icon_123.png,hash",
      "",
      "res:/ui/window.png,ui/window_456.png,hash2",
    ].join("\n");

    expect(parseResfileIndex(content)).toEqual(
      new Map([
        ["res:/icons/64/icon.png", "icons/icon_123.png"],
        ["res:/ui/window.png", "ui/window_456.png"],
      ]),
    );
  });

  it("finds the resfile index CDN path in a build index", () => {
    const buildIndex = [
      "other:/file.txt,other/file.txt,hash",
      `${RESFILE_INDEX_PATH},resindex/resfileindex_789.txt,hash`,
    ].join("\n");

    expect(findResfileIndexCdnPath(buildIndex)).toBe("resindex/resfileindex_789.txt");
  });

  it("throws when the resfile index path is missing", () => {
    expect(() => findResfileIndexCdnPath("other:/file.txt,other/file.txt,hash")).toThrow(
      `${RESFILE_INDEX_PATH} not found in build index.`,
    );
  });
});
