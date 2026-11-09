/**
 * Shared contract between the React client and the Express API.
 *
 * Every request body is described once, as a zod schema. The TypeScript type is
 * derived from the schema (z.infer), so the runtime validation on the server, the
 * form validation in the browser and the compile-time types can never drift apart.
 */
import { z } from "zod";

// --- Business rules ----------------------------------------------------------

export const TICKET_CAPACITY = 20;
export const MAX_TICKETS_PER_USER = 4;

// --- Requests ------------------------------------------------------------------

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(50),
  lastName: z.string().trim().min(1, "Last name is required").max(50),
  username: z
    .string()
    .trim()
    .min(3, "Username must have at least 3 characters")
    .max(30)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Use letters, digits, dot, dash or underscore"),
  email: z.string().trim().email("Enter a valid e-mail address"),
  password: z.string().min(8, "Password must have at least 8 characters").max(100),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const quantitySchema = z.object({
  quantity: z.number().int().min(1).max(MAX_TICKETS_PER_USER),
});
export type QuantityInput = z.infer<typeof quantitySchema>;

// --- Responses -----------------------------------------------------------------

/** A user as the API exposes it: never contains the password hash. */
export interface PublicUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface Availability {
  capacity: number;
  available: number;
  /** Only present when the request is authenticated. */
  mine?: number;
  maxPerUser: number;
}

// --- Errors ----------------------------------------------------------------------

/** Every error the API can return. A union of literals, so `switch` is exhaustive. */
export type ErrorCode =
  | "VALIDATION_FAILED"
  | "USERNAME_TAKEN"
  | "INVALID_CREDENTIALS"
  | "UNAUTHORIZED"
  | "LIMIT_REACHED"
  | "SOLD_OUT"
  | "NOTHING_TO_CANCEL"
  | "NOT_FOUND"
  | "INTERNAL";

/** Field name -> first validation message. */
export type FieldErrors = Partial<Record<string, string>>;

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    /** Field-level messages for VALIDATION_FAILED. */
    fields?: FieldErrors;
  };
}

/** Turns a zod error into `{ field: firstMessage }` for forms and API responses. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}
