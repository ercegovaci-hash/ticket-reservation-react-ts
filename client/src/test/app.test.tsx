import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { loginAs, mockApi, renderApp, testUser } from "./utils";

describe("routing and authentication", () => {
  it("sends anonymous visitors of /tickets to the login page", () => {
    renderApp("/tickets");
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });

  it("shows the server message for wrong credentials", async () => {
    mockApi({
      "POST /api/auth/login": () => ({
        status: 401,
        body: { error: { code: "INVALID_CREDENTIALS", message: "Wrong username or password." } },
      }),
    });
    renderApp("/login");
    await userEvent.type(screen.getByLabelText("Username"), "ana");
    await userEvent.type(screen.getByLabelText("Password"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong username or password.");
  });

  it("logs in, stores only the token, and opens the ticket page", async () => {
    mockApi({
      "POST /api/auth/login": () => ({ status: 200, body: { token: "abc", user: testUser } }),
      "GET /api/tickets": () => ({ status: 200, body: { capacity: 20, available: 20, mine: 0, maxPerUser: 4 } }),
    });
    renderApp("/login");
    await userEvent.type(screen.getByLabelText("Username"), "ana");
    await userEvent.type(screen.getByLabelText("Password"), "correct-horse");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("heading", { name: "Championship final" })).toBeInTheDocument();
    expect(sessionStorage.getItem("tickets.session")).not.toContain("correct-horse");
  });
});

describe("registration form", () => {
  it("validates with the shared schema before calling the API", async () => {
    const fetchSpy = mockApi({});
    renderApp("/register");
    await userEvent.type(screen.getByLabelText("E-mail"), "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: "Register" }));

    expect(screen.getByText("Enter a valid e-mail address")).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("aria-invalid", "true");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows a taken username next to the username field", async () => {
    mockApi({
      "POST /api/auth/register": () => ({
        status: 409,
        body: { error: { code: "USERNAME_TAKEN", message: "This username is already taken." } },
      }),
    });
    renderApp("/register");
    await userEvent.type(screen.getByLabelText("First name"), "Ana");
    await userEvent.type(screen.getByLabelText("Last name"), "Petrović");
    await userEvent.type(screen.getByLabelText("Username"), "ana");
    await userEvent.type(screen.getByLabelText("E-mail"), "ana@example.com");
    await userEvent.type(screen.getByLabelText(/Password/), "correct-horse");
    await userEvent.click(screen.getByRole("button", { name: "Register" }));

    expect(await screen.findByText("This username is already taken.")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("ticket page", () => {
  it("reserves tickets and updates the counters from the server response", async () => {
    loginAs();
    const api = mockApi({
      "GET /api/tickets": () => ({ status: 200, body: { capacity: 20, available: 20, mine: 0, maxPerUser: 4 } }),
      "POST /api/reservations": (body) => ({
        status: 201,
        body: { capacity: 20, available: 18, mine: (body as { quantity: number }).quantity, maxPerUser: 4 },
      }),
    });
    renderApp("/tickets");

    await userEvent.selectOptions(await screen.findByLabelText("Tickets"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Reserve" }));

    await waitFor(() => expect(screen.getByTestId("mine")).toHaveTextContent("2"));
    expect(screen.getByTestId("available")).toHaveTextContent("18");
    const [, init] = api.mock.calls.at(-1)!;
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer t0k3n");
  });

  it("disables Reserve when the choice would exceed the personal limit", async () => {
    loginAs();
    mockApi({
      "GET /api/tickets": () => ({ status: 200, body: { capacity: 20, available: 10, mine: 3, maxPerUser: 4 } }),
    });
    renderApp("/tickets");
    await userEvent.selectOptions(await screen.findByLabelText("Tickets"), "2");
    expect(screen.getByRole("button", { name: "Reserve" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });
});
