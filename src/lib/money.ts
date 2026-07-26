/**
 * Money. Every amount in this codebase is an integer number of **kobo**
 * (₦1 = 100 kobo) — never a float. Floats lose money: 0.1 + 0.2 !== 0.3, and
 * a payment ledger that disagrees with Paystack by a fraction of a naira is a
 * reconciliation problem you cannot fix after the fact.
 *
 * The only place naira appears is at the edges: parsing admin input, and
 * rendering to a screen or invoice.
 */

const KOBO_PER_NAIRA = 100;

/** Admin typed "5,000.50" → 500050 kobo. Throws on anything not a clean amount. */
export function nairaToKobo(input: string | number): number {
  const raw = typeof input === "number" ? String(input) : input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error(`Not a valid naira amount: "${input}"`);
  }
  const [whole, fraction = ""] = raw.split(".");
  const kobo = Number(whole) * KOBO_PER_NAIRA + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(kobo)) throw new Error(`Amount out of range: "${input}"`);
  return kobo;
}

/** 500050 → 5000.5 — for arithmetic-free display only, never for storage. */
export function koboToNaira(kobo: number): number {
  return kobo / KOBO_PER_NAIRA;
}

/** 500050 → "₦5,000.50". Whole amounts drop the decimals: 500000 → "₦5,000". */
export function formatNaira(kobo: number, opts: { alwaysDecimals?: boolean } = {}): string {
  const negative = kobo < 0;
  const abs = Math.abs(Math.round(kobo));
  const whole = Math.floor(abs / KOBO_PER_NAIRA);
  const fraction = abs % KOBO_PER_NAIRA;
  const grouped = whole.toLocaleString("en-NG");
  const showFraction = opts.alwaysDecimals || fraction !== 0;
  const body = showFraction ? `${grouped}.${String(fraction).padStart(2, "0")}` : grouped;
  return `${negative ? "-" : ""}₦${body}`;
}

/** "Free" instead of "₦0" — used across the pricing page and plan cards. */
export function formatPrice(kobo: number): string {
  return kobo === 0 ? "Free" : formatNaira(kobo);
}
