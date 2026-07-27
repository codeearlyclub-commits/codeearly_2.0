/**
 * Proves a program cannot be oversold under concurrent registration.
 *
 * The naive implementation — count, compare, insert — is correct in testing and
 * wrong in production: several registrations arriving in the same moment all
 * read "19 of 20 taken" and all succeed. The failure only appears when a
 * popular program opens and several parents tap at once, which is exactly when
 * you cannot afford it. This fires simultaneous registrations at a program with
 * 2 seats and asserts exactly 2 win.
 *
 *   npx tsx scripts/check-program-capacity.ts
 *
 * Destructive: creates and removes its own fixtures. Local and CI only.
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { registerForProgram } from "@/server/programs/programs";
import { createChild } from "@/server/members/children";

const CAPACITY = 2;
const CONTENDERS = 6;
const PARENT_ID = "capacity-check-parent";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✔" : "  ✖"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  await cleanup();

  await prisma.user.create({
    data: {
      id: PARENT_ID,
      email: "capacity-check@example.com",
      name: "Capacity Check",
      emailVerified: true,
      updatedAt: new Date(),
    },
  });

  const program = await prisma.program.create({
    data: {
      title: "Capacity Check Program",
      status: "PUBLISHED",
      capacity: CAPACITY,
    },
  });

  const children = [];
  for (let i = 0; i < CONTENDERS; i++) {
    children.push(await createChild({ parentId: PARENT_ID, childName: `Child ${i + 1}` }));
  }

  // Fire them all at once. Promise.allSettled so losers reject without
  // aborting the rest — being turned away is the expected outcome here.
  const results = await Promise.allSettled(
    children.map((c) => registerForProgram(program.id, c.id, PARENT_ID))
  );
  const won = results.filter((r) => r.status === "fulfilled").length;
  const lost = results.filter((r) => r.status === "rejected").length;

  const active = await prisma.programEnrollment.count({
    where: { programId: program.id, status: "active" },
  });

  console.log(`${CONTENDERS} simultaneous registrations for ${CAPACITY} seats`);
  check("exactly capacity registrations succeeded", won === CAPACITY, `${won} succeeded`);
  check("the rest were turned away", lost === CONTENDERS - CAPACITY, `${lost} rejected`);
  check("database holds no more than capacity", active === CAPACITY, `${active} active rows`);

  // Re-registering an existing child returns their place rather than failing.
  const firstWinner = (
    await prisma.programEnrollment.findFirst({ where: { programId: program.id } })
  )!;
  const again = await registerForProgram(program.id, firstWinner.childId, PARENT_ID);
  check("re-registering is idempotent", again.id === firstWinner.id);

  const stillActive = await prisma.programEnrollment.count({
    where: { programId: program.id, status: "active" },
  });
  check("idempotent retry did not consume a seat", stillActive === CAPACITY, `${stillActive} active`);

  await cleanup();
  await prisma.$disconnect();
  console.log(failures === 0 ? "\nALL CAPACITY CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  if (failures > 0) process.exit(1);
}

async function cleanup() {
  await prisma.program.deleteMany({ where: { title: "Capacity Check Program" } });
  await prisma.user.deleteMany({ where: { id: PARENT_ID } });
}

main().catch(async (err) => {
  console.error("check failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
