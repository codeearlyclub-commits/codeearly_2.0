/**
 * Typed application errors.
 *
 * V4's `tryDb` swallowed failures and returned empty data, which is how we
 * ended up chasing blank admin pages and wrong showcase counts — the bug was
 * invisible at the point it happened. Here, a service either returns its result
 * or throws an AppError carrying a machine-readable code. Route handlers
 * translate that code to a status; nothing is silently absorbed.
 */

export type AppErrorCode =
  | "UNAUTHENTICATED" // no valid session/token
  | "FORBIDDEN" // authenticated but not allowed (wrong org, wrong role)
  | "NOT_FOUND"
  | "VALIDATION" // input failed schema/business validation
  | "CONFLICT" // duplicate, or state machine violation
  | "RATE_LIMITED"
  | "PLAN_LIMIT" // org's quiz plan does not permit this
  | "PAYMENT_FAILED"
  | "INTERNAL";

const STATUS: Record<AppErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PLAN_LIMIT: 402, // Payment Required — the upgrade prompt is the product
  PAYMENT_FAILED: 402,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  /** Safe to show a user. Never include internals or another tenant's data. */
  readonly publicMessage: string;
  /** Structured context for logs — not serialised to clients. */
  readonly context?: Record<string, unknown>;

  constructor(
    code: AppErrorCode,
    publicMessage: string,
    context?: Record<string, unknown>
  ) {
    super(`${code}: ${publicMessage}`);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.publicMessage = publicMessage;
    this.context = context;
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

/** Shorthand constructors — keep service code readable. */
export const errors = {
  unauthenticated: (msg = "Please sign in to continue.") =>
    new AppError("UNAUTHENTICATED", msg),
  forbidden: (msg = "You do not have access to this.", ctx?: Record<string, unknown>) =>
    new AppError("FORBIDDEN", msg, ctx),
  notFound: (what = "That was not found.", ctx?: Record<string, unknown>) =>
    new AppError("NOT_FOUND", what, ctx),
  validation: (msg: string, ctx?: Record<string, unknown>) =>
    new AppError("VALIDATION", msg, ctx),
  conflict: (msg: string, ctx?: Record<string, unknown>) =>
    new AppError("CONFLICT", msg, ctx),
  rateLimited: (msg = "Too many attempts. Please wait and try again.") =>
    new AppError("RATE_LIMITED", msg),
  planLimit: (msg: string, ctx?: Record<string, unknown>) =>
    new AppError("PLAN_LIMIT", msg, ctx),
  paymentFailed: (msg: string, ctx?: Record<string, unknown>) =>
    new AppError("PAYMENT_FAILED", msg, ctx),
  internal: (msg = "Something went wrong on our side.", ctx?: Record<string, unknown>) =>
    new AppError("INTERNAL", msg, ctx),
};

/**
 * Body shape every API route returns on failure. Unknown errors collapse to a
 * generic INTERNAL — we never leak an exception message to a client.
 */
export function toErrorResponse(err: unknown): {
  status: number;
  body: { error: { code: AppErrorCode; message: string } };
} {
  if (isAppError(err)) {
    return {
      status: err.status,
      body: { error: { code: err.code, message: err.publicMessage } },
    };
  }
  return {
    status: 500,
    body: { error: { code: "INTERNAL", message: "Something went wrong on our side." } },
  };
}
