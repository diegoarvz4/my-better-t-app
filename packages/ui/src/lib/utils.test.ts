import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("joins multiple class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("ignores falsy values", () => {
    expect(cn("px-2", false, null, undefined, "py-1")).toBe("px-2 py-1");
  });

  it("supports conditional object syntax", () => {
    expect(cn("base", { active: true, hidden: false })).toBe("base active");
  });

  it("dedupes conflicting Tailwind utilities, keeping the last", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("merges conflicting padding shorthands correctly", () => {
    expect(cn("p-2", "px-4")).toBe("p-2 px-4");
  });

  it("flattens nested arrays of classes", () => {
    expect(cn(["px-2", ["py-1", "text-sm"]])).toBe("px-2 py-1 text-sm");
  });
});
