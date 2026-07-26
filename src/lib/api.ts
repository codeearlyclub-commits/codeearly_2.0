/**
 * Route handler plumbing.
 *
 * Every API route wraps its body in `apiHandler` so that error handling is
 * uniform and impossible to forget. V4 handled errors ad hoc per route, which
 * is why some failures returned 200 with an empty body and others leaked an
 * exception message to the client.
 */
import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

import { errors, isAppError, toErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

type Handler<Ctx> = (req: Request, ctx: Ctx) => Promise<unknown>;

/**
 * Wrap a route handler.
 *
 * - An `AppError` becomes its declared status and public message.
 * - A `ZodError` becomes a 422 listing which fields failed.
 * - Anything else is logged in full and returned as a generic 500. Unexpected
 *   exceptions never reach the client, because their messages can contain
 *   connection strings, another tenant's ids, or a stack trace.
 */
export function apiHandler<Ctx = unknown>(handler: Handler<Ctx>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      const result = await handler(req, ctx);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION",
              message: "Some of those details aren't right.",
              fields: err.flatten().fieldErrors,
            },
          },
          { status: 422 }
        );
      }

      if (isAppError(err)) {
        // Expected, handled outcomes — warn with context, don't page anyone.
        logger.warn({ code: err.code, ...err.context }, err.message);
      } else {
        logger.error({ err, path: req.url }, "Unhandled error in API route");
      }

      const { status, body } = toErrorResponse(err);
      return NextResponse.json(body, { status });
    }
  };
}

/** Parse and validate a JSON body, throwing a 422 on malformed input. */
export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw errors.validation("Expected a JSON body.");
  }
  return schema.parse(raw);
}

/**
 * Caller IP for rate limiting. Behind Caddy the socket address is always the
 * proxy, so the forwarded header is the only real signal — and we take the
 * FIRST entry, since anything after it can be spoofed by the client.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
