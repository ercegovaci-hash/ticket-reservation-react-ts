import { describe, expect, it } from "vitest";
import { fieldErrors, quantitySchema, registerSchema } from "./index";

const valid = {
  firstName: "Ana",
  lastName: "Petrović",
  username: "ana.p",
  email: "ana@example.com",
  password: "correct-horse",
};

describe("registerSchema", () => {
  it("accepts a valid registration and trims text fields", () => {
    const result = registerSchema.parse({ ...valid, firstName: "  Ana " });
    expect(result.firstName).toBe("Ana");
  });

  it("returns one message per invalid field", () => {
    const result = registerSchema.safeParse({ ...valid, email: "nope", password: "short" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error)).toEqual({
        email: "Enter a valid e-mail address",
        password: "Password must have at least 8 characters",
      });
    }
  });
});

describe("quantitySchema", () => {
  it.each([0, 5, 1.5])("rejects quantity %s", (quantity) => {
    expect(quantitySchema.safeParse({ quantity }).success).toBe(false);
  });

  it("accepts 1 to 4 tickets", () => {
    expect(quantitySchema.safeParse({ quantity: 4 }).success).toBe(true);
  });
});
