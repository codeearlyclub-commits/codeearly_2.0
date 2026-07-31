/**
 * Report cards: GET (preview figures) / POST (save) / PATCH (unpublish)
 *
 * The GET is what makes this usable: it returns what a report WOULD say for a
 * period, so staff edit real figures instead of typing them from memory.
 */
import { z } from "zod";

import { apiHandler, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import {
  computeReportFigures,
  saveReportCard,
  unpublishReportCard,
} from "@/server/records/reports";
import { errors } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const saveSchema = z.object({
  childId: z.string().min(1),
  period: z.string().trim().min(2).max(60),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  comment: z.string().trim().max(3000).optional().nullable(),
  overallGrade: z.string().trim().max(60).optional().nullable(),
  publish: z.boolean(),
});

function parseDate(value: string, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw errors.validation(`${label} is not a valid date.`);
  return date;
}

export const GET = apiHandler(async (req) => {
  await requireAdmin(req);
  const url = new URL(req.url);
  const childId = url.searchParams.get("childId");
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  if (!childId || !start || !end) {
    throw errors.validation("childId, start and end are all required.");
  }

  const figures = await computeReportFigures(
    childId,
    parseDate(start, "Start date"),
    parseDate(end, "End date")
  );
  return { figures };
});

export const POST = apiHandler(async (req) => {
  await requireAdmin(req);
  const body = await parseBody(req, saveSchema);

  const report = await saveReportCard({
    childId: body.childId,
    period: body.period,
    periodStart: parseDate(body.periodStart, "Start date"),
    periodEnd: parseDate(body.periodEnd, "End date"),
    comment: body.comment,
    overallGrade: body.overallGrade,
    publish: body.publish,
  });

  return { report: { id: report.id, period: report.period, status: report.status } };
});

export const PATCH = apiHandler(async (req) => {
  await requireAdmin(req);
  const body = await parseBody(req, z.object({ id: z.string().min(1) }));
  const report = await unpublishReportCard(body.id);
  return { report: { id: report.id, status: report.status } };
});
