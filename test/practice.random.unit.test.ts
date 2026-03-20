import { describe, it, expect } from "vitest";
import { stringToSeed, seededShuffle } from "../src/modules/services/practiceRandom.service.js";

describe("seed helpers", () => {
  it("stringToSeed produces stable number for same string", () => {
    const a = stringToSeed("hello-world");
    const b = stringToSeed("hello-world");
    expect(a).toBe(b);
  });

  it("seededShuffle is deterministic for same seed", () => {
    const arr = [1,2,3,4,5,6,7,8,9,10];
    const s1 = seededShuffle(arr, "seed-123");
    const s2 = seededShuffle(arr, "seed-123");
    expect(s1).toEqual(s2);
    expect(s1.length).toBe(arr.length);
  });

  it("seededShuffle differs for different seeds", () => {
    const arr = [1,2,3,4,5,6,7,8,9,10];
    const s1 = seededShuffle(arr, "seed-a");
    const s2 = seededShuffle(arr, "seed-b");
    expect(s1).not.toEqual(s2);
  });
});
