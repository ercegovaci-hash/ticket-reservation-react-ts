import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">⚽ Final ticket desk</span>
        {user && (
          <span className="topbar-user">
            {user.firstName} {user.lastName}
            <button type="button" className="btn btn-ghost" onClick={() => void logout()}>
              Log out
            </button>
          </span>
        )}
      </header>
      <main className="content">{children}</main>
    </div>
  );
}
