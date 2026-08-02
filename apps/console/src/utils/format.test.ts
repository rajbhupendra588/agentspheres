import { describe, expect, it } from "vitest";
import { formatLatency, formatNumber } from "@/utils/format";

describe("formatLatency", () => {
  it("formats sub-millisecond as <1 ms", () => {
    expect(formatLatency(0.5)).toBe("<1 ms");
  });

  it("formats milliseconds", () => {
    expect(formatLatency(42)).toBe("42 ms");
  });

  it("formats seconds", () => {
    expect(formatLatency(1500)).toBe("1.50 s");
  });
});

describe("formatNumber", () => {
  it("formats integers with grouping", () => {
    expect(formatNumber(1234567)).toMatch(/1[,.\s]?234[,.\s]?567/);
  });

  it("respects options", () => {
    expect(formatNumber(0.456, { style: "percent", maximumFractionDigits: 0 })).toBe("46%");
  });
});
