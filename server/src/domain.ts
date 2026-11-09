/**
 * Domain logic, independent of HTTP. Express only translates requests into calls
 * to this class and its results into responses, so the business rules can be
 * unit-tested without a server.
 */
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import {
  MAX_TICKETS_PER_USER,
  TICKET_CAPACITY,
  type Availability,
  type ErrorCode,
  type FieldErrors,
  type PublicUser,
  type RegisterInput,
} from "@tickets/shared";

/** A rule violation with a machine-readable code. Mapped to an HTTP status in app.ts. */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fields?: FieldErrors,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

interface StoredUser extends PublicUser {
  passwordHash: string;
  salt: string;
}

// Passwords are never stored: scrypt (built into Node) with a random salt per user.
function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return { salt, passwordHash: scryptSync(password, salt, 64).toString("hex") };
}

function toPublic({ passwordHash: _hash, salt: _salt, ...user }: StoredUser): PublicUser {
  return user;
}

export class TicketService {
  private readonly users = new Map<string, StoredUser>(); // key: username (lower case)
  private readonly sessions = new Map<string, string>(); // token -> user id
  private readonly reservations = new Map<string, number>(); // user id -> tickets

  constructor(readonly capacity: number = TICKET_CAPACITY) {}

  register(input: RegisterInput): PublicUser {
    const key = input.username.toLowerCase();
    if (this.users.has(key)) {
      throw new DomainError("USERNAME_TAKEN", "This username is already taken.");
    }
    const { password, ...profile } = input;
    const user: StoredUser = { id: randomUUID(), ...profile, ...hashPassword(password) };
    this.users.set(key, user);
    return toPublic(user);
  }

  login(username: string, password: string): { token: string; user: PublicUser } {
    const user = this.users.get(username.toLowerCase());
    const valid =
      user !== undefined &&
      timingSafeEqual(
        Buffer.from(hashPassword(password, user.salt).passwordHash, "hex"),
        Buffer.from(user.passwordHash, "hex"),
      );
    if (!user || !valid) {
      // Same message for unknown user and wrong password: no username enumeration.
      throw new DomainError("INVALID_CREDENTIALS", "Wrong username or password.");
    }
    const token = randomBytes(32).toString("hex");
    this.sessions.set(token, user.id);
    return { token, user: toPublic(user) };
  }

  logout(token: string): void {
    this.sessions.delete(token);
  }

  /** Returns the user id for a valid session token, or undefined. */
  authenticate(token: string | undefined): string | undefined {
    return token ? this.sessions.get(token) : undefined;
  }

  get available(): number {
    let reserved = 0;
    for (const count of this.reservations.values()) reserved += count;
    return this.capacity - reserved;
  }

  availability(userId?: string): Availability {
    const base = { capacity: this.capacity, available: this.available, maxPerUser: MAX_TICKETS_PER_USER };
    return userId === undefined ? base : { ...base, mine: this.reservations.get(userId) ?? 0 };
  }

  reserve(userId: string, quantity: number): Availability {
    const mine = this.reservations.get(userId) ?? 0;
    if (mine + quantity > MAX_TICKETS_PER_USER) {
      throw new DomainError(
        "LIMIT_REACHED",
        `You can hold at most ${MAX_TICKETS_PER_USER} tickets (you have ${mine}).`,
      );
    }
    if (quantity > this.available) {
      throw new DomainError("SOLD_OUT", `Only ${this.available} ticket(s) left.`);
    }
    this.reservations.set(userId, mine + quantity);
    return this.availability(userId);
  }

  cancel(userId: string, quantity: number): Availability {
    const mine = this.reservations.get(userId) ?? 0;
    if (quantity > mine) {
      throw new DomainError("NOTHING_TO_CANCEL", `You only have ${mine} ticket(s) to cancel.`);
    }
    this.reservations.set(userId, mine - quantity);
    return this.availability(userId);
  }
}
