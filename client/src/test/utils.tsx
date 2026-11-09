import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import type { PublicUser } from "@tickets/shared";
import { App } from "../App";
import { AuthProvider } from "../auth/AuthContext";

type Handler = (body: unknown, init: RequestInit) => { status: number; body?: unknown };

/** Replaces fetch with a tiny in-memory router: { "POST /api/auth/login": handler }. */
export function mockApi(routes: Record<string, Handler>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init = {}) => {
    const key = `${init.method ?? "GET"} ${String(input)}`;
    const handler = routes[key];
    if (!handler) throw new Error(`Unexpected request: ${key}`);
    const { status, body } = handler(init.body ? JSON.parse(String(init.body)) : undefined, init);
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  });
}

export const testUser: PublicUser = {
  id: "u1",
  username: "ana",
  firstName: "Ana",
  lastName: "Petrović",
  email: "ana@example.com",
};

export function loginAs(user: PublicUser = testUser) {
  sessionStorage.setItem("tickets.session", JSON.stringify({ token: "t0k3n", user }));
}

export function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}
