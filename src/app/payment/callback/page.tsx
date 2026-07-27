/**
 * Where Paystack returns the payer after checkout.
 *
 * This page does NOT trust the redirect. It calls Paystack's verify endpoint
 * server-side and records from that answer — which is authenticated, unlike the
 * query string, where anyone can type `?reference=…&status=success`.
 *
 * Recording here is belt-and-braces alongside the webhook: whichever arrives
 * first wins and the other is a no-op, because recording is idempotent on the
 * reference. That matters because webhooks can be delayed by minutes, and a
 * parent staring at "pending" after paying will email you about it.
 */
import Link from "next/link";

import { verifyTransaction, recordSuccessfulPayment } from "@/server/payments/paystack";
import { formatNaira } from "@/lib/money";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ reference?: string; trxref?: string }> };

export default async function PaymentCallbackPage({ searchParams }: Props) {
  const params = await searchParams;
  // Paystack sends both; they are the same value.
  const reference = params.reference || params.trxref;

  if (!reference) {
    return (
      <main className="auth-card">
        <h1>We couldn&apos;t find that payment</h1>
        <p>No payment reference was provided.</p>
        <Link href="/portal">Back to your portal</Link>
      </main>
    );
  }

  let paid = false;
  let amount = "";
  let failure: string | null = null;

  try {
    const data = await verifyTransaction(reference);
    if (data.status === "success") {
      await recordSuccessfulPayment({
        reference,
        amountKobo: Number(data.amount ?? 0),
        currency: data.currency ?? "NGN",
        customerEmail: data.customer?.email ?? "",
        paidAt: data.paid_at ? new Date(data.paid_at) : new Date(),
      });
      paid = true;
      amount = formatNaira(Number(data.amount ?? 0));
    } else {
      failure = "That payment didn't go through.";
    }
  } catch (err) {
    logger.error({ err, reference }, "payment callback verification failed");
    // Never tell a payer their money is gone on our error. The webhook is still
    // coming, and the payment may well be fine.
    failure =
      "We couldn't confirm this straight away. If your bank shows a charge, it will appear in your portal shortly.";
  }

  return (
    <main className="auth-card">
      {paid ? (
        <>
          <h1>Payment received</h1>
          <p>
            Thank you — we&apos;ve received <b>{amount}</b>. A receipt is on its
            way to your email.
          </p>
        </>
      ) : (
        <>
          <h1>Payment not confirmed</h1>
          <p>{failure}</p>
        </>
      )}
      <p className="muted">Reference: {reference}</p>
      <Link href="/portal">Back to your portal</Link>
    </main>
  );
}
