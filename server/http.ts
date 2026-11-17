import type { ErrorRequestHandler, Request } from "express";
import { z, type ZodType } from "zod";

/** An error that maps directly to an HTTP response. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: Record<string, string>,
  ) {
    super(message);
  }
}

export const notFound = (what = "Resource") => new HttpError(404, `${what} not found`);

/** Parses a request body with a zod schema, or throws a 400 with per-field messages. */
export function parseBody<T extends ZodType>(schema: T, req: Request): z.output<T> {
  const result = schema.safeParse(req.body ?? {});
  if (result.success) return result.data;

  const details: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join(".") || "_";
    details[field] ??= issue.message;
  }
  throw new HttpError(400, "Validation failed", details);
}

/** Parses a positive integer route parameter such as `:id`. */
export function parseId(raw: string | string[] | undefined): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid id");
  return id;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: "Malformed JSON body" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
};
