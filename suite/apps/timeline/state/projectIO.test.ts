import { describe, expect, it } from "vitest";
import { sampleDoc } from "../core/model/defaults";
import { referencedKeys } from "./projectIO";

describe("referencedKeys", () => {
  it("collects the logo and every font, without duplicates", () => {
    const doc = sampleDoc();
    const withUploads = {
      ...doc,
      day: { ...doc.day, logoKey: "logo-1" },
      fonts: [
        { family: "Ivy", blobKey: "font-1" },
        { family: "Ivy Italic", blobKey: "font-1" },
      ],
    };
    expect(referencedKeys(withUploads)).toEqual(["font-1", "logo-1"]);
    expect(referencedKeys(doc)).toEqual([]);
  });
});
