/**
 * Typed wrapper around fetch. Every endpoint returns a concrete type from the
 * shared package, and every failure becomes an ApiError with a known code.
 */
import type {
  ApiErrorBody,
  AuthResponse,
  Availability,
  ErrorCode,
  FieldErrors,
  LoginInput,
  PublicUser,
  RegisterInput,
} from "@tickets/shared";

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
    readonly fields: FieldErrors = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as ApiErrorBody).error?.code === "string"
  );
}

async function request<T>(path: string, init: RequestInit & { token?: string | null } = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  const response = await fetch(`/api${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (response.status === 204) return undefined as T;

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (isApiErrorBody(body)) {
      throw new ApiError(body.error.code, body.error.message, response.status, body.error.fields);
    }
    throw new ApiError("INTERNAL", `Request failed (${response.status})`, response.status);
  }
  return body as T;
}

const json = (data: unknown) => JSON.stringify(data);

export const api = {
  register: (input: RegisterInput) =>
    request<PublicUser>("/auth/register", { method: "POST", body: json(input) }),

  login: (input: LoginInput) => request<AuthResponse>("/auth/login", { method: "POST", body: json(input) }),

  logout: (token: string) => request<void>("/auth/logout", { method: "POST", token }),

  tickets: (token: string | null) => request<Availability>("/tickets", { token }),

  reserve: (token: string, quantity: number) =>
    request<Availability>("/reservations", { method: "POST", token, body: json({ quantity }) }),

  cancel: (token: string, quantity: number) =>
    request<Availability>("/reservations/cancel", { method: "POST", token, body: json({ quantity }) }),
};
