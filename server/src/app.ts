import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import type { ZodType } from "zod";
import {
  fieldErrors,
  loginSchema,
  quantitySchema,
  registerSchema,
  type ApiErrorBody,
  type AuthResponse,
  type ErrorCode,
} from "@tickets/shared";
import { DomainError, TicketService } from "./domain";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  USERNAME_TAKEN: 409,
  INVALID_CREDENTIALS: 401,
  UNAUTHORIZED: 401,
  LIMIT_REACHED: 409,
  SOLD_OUT: 409,
  NOTHING_TO_CANCEL: 409,
  NOT_FOUND: 404,
  INTERNAL: 500,
};

/** Validates req.body against a shared schema; the handler receives the typed value. */
function parseBody<T>(schema: ZodType<T>, req: Request): T {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    throw new DomainError("VALIDATION_FAILED", "Please correct the highlighted fields.", fieldErrors(result.error));
  }
  return result.data;
}

function bearerToken(req: Request): string | undefined {
  const header = req.header("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : undefined;
}

export function createApp(service = new TicketService()) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  /** Resolves the session or responds 401. */
  const requireUser = (req: Request): string => {
    const userId = service.authenticate(bearerToken(req));
    if (!userId) throw new DomainError("UNAUTHORIZED", "Please log in first.");
    return userId;
  };

  app.post("/api/auth/register", (req, res) => {
    const user = service.register(parseBody(registerSchema, req));
    res.status(201).json(user);
  });

  app.post("/api/auth/login", (req, res) => {
    const { username, password } = parseBody(loginSchema, req);
    const body: AuthResponse = service.login(username, password);
    res.json(body);
  });

  app.post("/api/auth/logout", (req, res) => {
    const token = bearerToken(req);
    if (token) service.logout(token);
    res.status(204).end();
  });

  // Public, but includes the caller's own count when a valid token is sent.
  app.get("/api/tickets", (req, res) => {
    res.json(service.availability(service.authenticate(bearerToken(req))));
  });

  app.post("/api/reservations", (req, res) => {
    const userId = requireUser(req);
    const { quantity } = parseBody(quantitySchema, req);
    res.status(201).json(service.reserve(userId, quantity));
  });

  app.post("/api/reservations/cancel", (req, res) => {
    const userId = requireUser(req);
    const { quantity } = parseBody(quantitySchema, req);
    res.json(service.cancel(userId, quantity));
  });

  app.use((_req, res) => {
    const body: ApiErrorBody = { error: { code: "NOT_FOUND", message: "Route not found." } };
    res.status(404).json(body);
  });

  // One place that turns thrown errors into the shared error format.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof DomainError) {
      const body: ApiErrorBody = {
        error: { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) },
      };
      res.status(STATUS[err.code]).json(body);
      return;
    }
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: { code: "VALIDATION_FAILED", message: "Malformed JSON." } } satisfies ApiErrorBody);
      return;
    }
    console.error(err);
    res.status(500).json({ error: { code: "INTERNAL", message: "Unexpected server error." } } satisfies ApiErrorBody);
  });

  return app;
}
