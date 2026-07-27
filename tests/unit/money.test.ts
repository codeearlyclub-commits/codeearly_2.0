/**
 * Money conversion. First on the list because money bugs are unrecoverable —
 * you cannot apologise your way out of having charged a parent the wrong amount.
 */
import { describe, it, expect } from "vitest";

import { nairaToKobo, koboToNaira, formatNaira, formatPrice } from "@/lib/money";

describe("nairaToKobo", () => {
  it("converts whole naira", () => {
    expect(nairaToKobo("5000")).toBe(500_000);
    expect(nairaToKobo(5000)).toBe(500_000);
  });

  it("converts kobo precisely", () => {
    expect(nairaToKobo("5000.50")).toBe(500_050);
    expect(nairaToKobo("0.01")).toBe(1);
  });

  it("treats a single decimal place as tenths, not hundredths", () => {
    // "5000.5" is five thousand naira fifty kobo, not five kobo.
    expect(nairaToKobo("5000.5")).toBe(500_050);
  });

  it("accepts the comma grouping an admin will actually type", () => {
    expect(nairaToKobo("1,250,000")).toBe(125_000_000);
  });

  it("rejects anything that is not a clean amount", () => {
    // Rejecting loudly matters more than being permissive: a silently coerced
    // "₦5,000" or "abc" becomes a wrong charge.
    for (const bad of ["", "abc", "5000.123", "-100", "5,00.0.0", "₦5000", "1e5"]) {
      expect(() => nairaToKobo(bad)).toThrow();
    }
  });

  it("survives a round trip", () => {
    for (const kobo of [0, 1, 99, 100, 500_050, 125_000_000]) {
      expect(nairaToKobo(String(koboToNaira(kobo)))).toBe(kobo);
    }
  });
});

describe("formatNaira", () => {
  it("drops decimals on whole amounts", () => {
    expect(formatNaira(500_000)).toBe("₦5,000");
  });

  it("shows kobo when present", () => {
    expect(formatNaira(500_050)).toBe("₦5,000.50");
    expect(formatNaira(1)).toBe("₦0.01");
  });

  it("pads kobo to two digits", () => {
    // 500,005 kobo is ₦5,000.05 — not ₦5,000.5, which would read as 50 kobo.
    expect(formatNaira(500_005)).toBe("₦5,000.05");
  });

  it("can be forced to always show decimals", () => {
    expect(formatNaira(500_000, { alwaysDecimals: true })).toBe("₦5,000.00");
  });

  it("handles negatives with the sign outside the symbol", () => {
    expect(formatNaira(-500_000)).toBe("-₦5,000");
  });
});

describe("formatPrice", () => {
  it("says Free rather than ₦0", () => {
    expect(formatPrice(0)).toBe("Free");
  });

  it("formats paid amounts normally", () => {
    expect(formatPrice(500_000)).toBe("₦5,000");
  });
});
