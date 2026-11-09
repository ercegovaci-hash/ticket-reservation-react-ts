import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { TicketService } from "../src/domain";

const ana = {
  firstName: "Ana",
  lastName: "Petrović",
  username: "ana",
  email: "ana@example.com",
  password: "correct-horse",
};

describe("REST API", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp(new TicketService(20));
  });

  async function loggedIn() {
    await request(app).post("/api/auth/register").send(ana).expect(201);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "ana", password: "correct-horse" })
      .expect(200);
    return `Bearer ${res.body.token as string}`;
  }

  it("validates the body with the shared schema and reports field errors", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...ana, email: "not-an-email" })
      .expect(400);
    expect(res.body.error).toMatchObject({
      code: "VALIDATION_FAILED",
      fields: { email: "Enter a valid e-mail address" },
    });
  });

  it("requires a session to reserve", async () => {
    const res = await request(app).post("/api/reservations").send({ quantity: 1 }).expect(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("runs the full reserve / cancel flow", async () => {
    const auth = await loggedIn();

    await request(app).post("/api/reservations").set("Authorization", auth).send({ quantity: 3 }).expect(201);
    const limit = await request(app)
      .post("/api/reservations")
      .set("Authorization", auth)
      .send({ quantity: 2 })
      .expect(409);
    expect(limit.body.error.code).toBe("LIMIT_REACHED");

    const cancelled = await request(app)
      .post("/api/reservations/cancel")
      .set("Authorization", auth)
      .send({ quantity: 1 })
      .expect(200);
    expect(cancelled.body).toEqual({ capacity: 20, available: 18, mine: 2, maxPerUser: 4 });
  });

  it("shows the caller's own tickets only when authenticated", async () => {
    const auth = await loggedIn();
    const anonymous = await request(app).get("/api/tickets").expect(200);
    expect(anonymous.body).not.toHaveProperty("mine");
    const mine = await request(app).get("/api/tickets").set("Authorization", auth).expect(200);
    expect(mine.body.mine).toBe(0);
  });

  it("invalidates the token on logout", async () => {
    const auth = await loggedIn();
    await request(app).post("/api/auth/logout").set("Authorization", auth).expect(204);
    await request(app).post("/api/reservations").set("Authorization", auth).send({ quantity: 1 }).expect(401);
  });

  it("answers malformed JSON with a 400 in the shared error format", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{not json")
      .expect(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });
});
