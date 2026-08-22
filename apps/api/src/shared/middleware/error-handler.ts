import type { ErrorHandler } from "hono";
import type { AppEnv } from "../../config/env";

export class HttpError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 422 | 500,
    message: string,
  ) {
    super(message);
  }
}

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof HttpError) {
    return c.json({ error: err.message }, err.status);
  }

  console.error(err);
  return c.json({ error: "internal_server_error" }, 500);
};
