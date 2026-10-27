import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges class names and resolves the @/ alias", () => {
    expect(cn("px-2", "px-4", "py-1")).toBe("px-4 py-1");
  });

  it("handles conditional and falsy inputs", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });
});
