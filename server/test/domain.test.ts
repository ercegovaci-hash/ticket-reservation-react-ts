import { beforeEach, describe, expect, it } from "vitest";
import { DomainError, TicketService } from "../src/domain";

const ana = {
  firstName: "Ana",
  lastName: "Petrović",
  username: "ana",
  email: "ana@example.com",
  password: "correct-horse",
};

function expectCode(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    expect((e as DomainError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}`);
}

describe("TicketService", () => {
  let service: TicketService;
  let anaId: string;

  beforeEach(() => {
    service = new TicketService(5);
    anaId = service.register(ana).id;
  });

  it("never returns or stores the plain password", () => {
    const { token, user } = service.login("ana", "correct-horse");
    expect(token).toHaveLength(64);
    expect(JSON.stringify(user)).not.toContain("correct-horse");
    expect(user).not.toHaveProperty("passwordHash");
  });

  it("rejects duplicate usernames regardless of case", () => {
    expectCode(() => service.register({ ...ana, username: "ANA" }), "USERNAME_TAKEN");
  });

  it("gives the same error for unknown user and wrong password", () => {
    expectCode(() => service.login("ana", "wrong-password"), "INVALID_CREDENTIALS");
    expectCode(() => service.login("nobody", "correct-horse"), "INVALID_CREDENTIALS");
  });

  it("limits each user to 4 tickets", () => {
    const big = new TicketService(20);
    const id = big.register(ana).id;
    big.reserve(id, 3);
    expectCode(() => big.reserve(id, 2), "LIMIT_REACHED");
    expect(big.reserve(id, 1).mine).toBe(4);
  });

  it("never sells more tickets than the capacity", () => {
    const ben = service.register({ ...ana, username: "ben" }).id;
    service.reserve(anaId, 4);
    expectCode(() => service.reserve(ben, 2), "SOLD_OUT");
    expect(service.reserve(ben, 1).available).toBe(0);
  });

  it("returns cancelled tickets to the pool", () => {
    service.reserve(anaId, 2);
    const after = service.cancel(anaId, 1);
    expect(after).toMatchObject({ available: 4, mine: 1 });
    expectCode(() => service.cancel(anaId, 2), "NOTHING_TO_CANCEL");
  });
});
