/**
 * Checkout — turning "I want this" into an invoice and a payment link.
 *
 * All pricing decisions happen HERE, on the server, from the database row. The
 * client sends only *what* and *for whom*, never how much. That is the whole
 * defence against someone paying ₦1 for a ₦75,000 program by editing a form.
 *
 * Free and membership-covered items skip payment entirely and grant access
 * immediately — sending someone to Paystack for a ₦0 charge is a broken
 * experience and Paystack rejects it anyway.
 */
import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/errors";
import { createInvoice } from "@/server/invoices/create";
import { initializeTransaction } from "@/server/payments/paystack";
import { hasActiveSubscription } from "@/server/payments/subscriptions";
import { enrolChild } from "@/server/courses/catalog";
import { registerForProgram, seatsRemaining } from "@/server/programs/programs";

export type CheckoutResult =
  | { kind: "granted"; message: string }
  | { kind: "payment"; authorizationUrl: string; invoiceNumber: string };

/** Buy (or claim) a course for a child. */
export async function checkoutCourse(
  parentId: string,
  parentEmail: string,
  childId: string,
  courseId: string
): Promise<CheckoutResult> {
  const child = await prisma.child.findFirst({
    where: { id: childId, parentId },
    select: { id: true, childName: true },
  });
  if (!child) throw errors.notFound("Child not found.");

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || course.status !== "PUBLISHED") throw errors.notFound("Course not found.");
  if (course.programOnly) {
    throw errors.forbidden("This course is part of a program and cannot be bought on its own.");
  }

  const already = await prisma.enrollment.findUnique({
    where: { childId_courseId: { childId, courseId } },
    select: { id: true },
  });
  if (already) {
    return { kind: "granted", message: `${child.childName} is already enrolled.` };
  }

  // Covered by an active membership, or simply free.
  const covered =
    course.requiresSubscription && (await hasActiveSubscription(parentId, childId));
  if (covered || course.priceKobo === 0) {
    await enrolChild(childId, parentId, courseId);
    return {
      kind: "granted",
      message: covered
        ? `Included in your membership — ${child.childName} is enrolled.`
        : `${child.childName} is enrolled.`,
    };
  }

  if (course.requiresSubscription) {
    throw errors.planLimit("A membership is needed for this course.");
  }

  const invoice = await createInvoice({
    parentId,
    childId,
    type: "course",
    description: `${course.title} — ${child.childName}`,
    // Price from the row, never the request.
    amountKobo: course.priceKobo,
    itemId: course.id,
  });

  const { authorizationUrl } = await initializeTransaction(invoice, parentEmail);
  return { kind: "payment", authorizationUrl, invoiceNumber: invoice.invoiceNumber };
}

/** Buy (or claim) a place on a program for a child. */
export async function checkoutProgram(
  parentId: string,
  parentEmail: string,
  childId: string,
  programId: string
): Promise<CheckoutResult> {
  const child = await prisma.child.findFirst({
    where: { id: childId, parentId },
    select: { id: true, childName: true },
  });
  if (!child) throw errors.notFound("Child not found.");

  const program = await prisma.program.findUnique({ where: { id: programId } });
  if (!program || program.status !== "PUBLISHED") throw errors.notFound("Program not found.");

  if (program.registrationDeadline && program.registrationDeadline < new Date()) {
    throw errors.conflict("Registration for this program has closed.");
  }

  const already = await prisma.programEnrollment.findUnique({
    where: { programId_childId: { programId, childId } },
  });
  if (already?.status === "active") {
    return { kind: "granted", message: `${child.childName} is already registered.` };
  }

  // Checked BEFORE taking money. Selling a seat that does not exist and
  // refunding afterwards is a worse failure than refusing the sale.
  const left = seatsRemaining(program, program.seatsTaken);
  if (left === 0) throw errors.conflict("This program is fully booked.");

  if (program.priceKobo === 0) {
    await registerForProgram(programId, childId, parentId);
    return { kind: "granted", message: `${child.childName} is registered.` };
  }

  const invoice = await createInvoice({
    parentId,
    childId,
    type: "program",
    description: `${program.title} — ${child.childName}`,
    amountKobo: program.priceKobo,
    itemId: program.id,
  });

  const { authorizationUrl } = await initializeTransaction(invoice, parentEmail);
  return { kind: "payment", authorizationUrl, invoiceNumber: invoice.invoiceNumber };
}
