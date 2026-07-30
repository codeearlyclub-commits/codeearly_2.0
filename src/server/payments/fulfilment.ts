/**
 * Fulfilment — what a payment actually BUYS.
 *
 * This closes a hole that mattered: recording a payment marked the invoice PAID
 * and sent a receipt, but granted nothing. A parent could pay for a course and
 * receive no access, with the money taken and the ledger looking correct.
 *
 * Two rules govern everything here:
 *
 *  1. **Idempotent.** The webhook and the payment callback both land here, and
 *     Paystack retries. Granting twice must be harmless.
 *  2. **Never throws away the payment.** If fulfilment fails, the payment stays
 *     recorded and the failure is logged loudly. Money received with access
 *     pending is a support ticket; money received and forgotten is a refund and
 *     a lost family.
 */
import type { Invoice } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { activateSubscription } from "@/server/payments/subscriptions";
import { activateOrgPlan } from "@/server/orgs/plans";

export type FulfilmentResult = {
  granted: string;
  detail?: string;
};

/**
 * Grant whatever `invoice` was for. Safe to call more than once.
 *
 * `itemId` carries which course/program/plan the invoice refers to — set when
 * the invoice was created, so fulfilment never has to guess from a description.
 */
export async function fulfilInvoice(invoice: Invoice): Promise<FulfilmentResult> {
  const log = logger.child({ invoice: invoice.invoiceNumber, type: invoice.type });

  switch (invoice.type) {
    case "course": {
      if (!invoice.itemId || !invoice.childId) {
        log.error("course invoice missing itemId or childId — cannot fulfil");
        return { granted: "nothing", detail: "missing course or child reference" };
      }
      // upsert: a retried webhook must not fail on the unique constraint.
      await prisma.enrollment.upsert({
        where: { childId_courseId: { childId: invoice.childId, courseId: invoice.itemId } },
        create: { childId: invoice.childId, courseId: invoice.itemId },
        update: {},
      });
      log.info({ childId: invoice.childId, courseId: invoice.itemId }, "course access granted");
      return { granted: "course" };
    }

    case "program": {
      if (!invoice.itemId || !invoice.childId) {
        log.error("program invoice missing itemId or childId — cannot fulfil");
        return { granted: "nothing", detail: "missing program or child reference" };
      }

      const existing = await prisma.programEnrollment.findUnique({
        where: { programId_childId: { programId: invoice.itemId, childId: invoice.childId } },
      });

      if (existing?.status === "active") {
        return { granted: "program", detail: "already registered" };
      }

      // A paid registration claims its seat even if the program has since
      // filled — refusing here would mean taking money and denying entry, which
      // is far worse than one extra child. The overselling guard exists to stop
      // that happening at registration time, not to punish someone who paid.
      await prisma.$transaction(async (tx) => {
        await tx.programEnrollment.upsert({
          where: { programId_childId: { programId: invoice.itemId!, childId: invoice.childId! } },
          create: { programId: invoice.itemId!, childId: invoice.childId!, status: "active" },
          update: { status: "active" },
        });
        if (!existing) {
          await tx.program.update({
            where: { id: invoice.itemId! },
            data: { seatsTaken: { increment: 1 } },
          });
        }
      });

      log.info({ childId: invoice.childId, programId: invoice.itemId }, "program place granted");
      return { granted: "program" };
    }

    case "subscription": {
      if (!invoice.parentId) {
        log.error("subscription invoice has no parent — cannot fulfil");
        return { granted: "nothing" };
      }
      await activateSubscription({
        parentId: invoice.parentId,
        childId: invoice.childId,
        planName: invoice.description,
        durationMonths: 1,
        priceKobo: invoice.amountKobo,
        paystackReference: invoice.paystackReference,
      });
      log.info({ parentId: invoice.parentId }, "membership activated");
      return { granted: "subscription" };
    }

    case "quiz_plan": {
      if (!invoice.organizationId || !invoice.itemId) {
        log.error("quiz plan invoice missing org or plan key — cannot fulfil");
        return { granted: "nothing" };
      }
      await activateOrgPlan(invoice.organizationId, invoice.itemId, {
        paystackReference: invoice.paystackReference,
      });
      log.info({ organizationId: invoice.organizationId }, "quiz plan activated");
      return { granted: "quiz_plan" };
    }

    // Custom invoices are just money owed — an admin chasing a fee. There is
    // nothing to unlock, and that is not a failure.
    case "custom":
      return { granted: "nothing", detail: "custom invoice — nothing to unlock" };

    default:
      log.warn({ type: invoice.type }, "unknown invoice type — nothing fulfilled");
      return { granted: "nothing", detail: `unknown type ${invoice.type}` };
  }
}
