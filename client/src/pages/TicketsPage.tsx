import { useState } from "react";
import type { Availability, PublicUser } from "@tickets/shared";
import { ApiError, api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useAvailability } from "../hooks/useAvailability";

type Action = "reserve" | "cancel";

interface Confirmation {
  holder: Pick<PublicUser, "firstName" | "lastName" | "email">;
  tickets: number;
  issuedAt: string;
}

/** Same feature as the original app: download the reservation details as a file. */
function downloadConfirmation(confirmation: Confirmation) {
  const blob = new Blob([JSON.stringify(confirmation, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "reservation-confirmation.json";
  link.click();
  URL.revokeObjectURL(url);
}

export function TicketsPage() {
  const { user, token, logout } = useAuth();
  const { state, update } = useAvailability(token);
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);

  if (state.status === "loading") return <p className="muted">Loading availability…</p>;
  if (state.status === "error") return <p className="form-error" role="alert">{state.message}</p>;

  const data: Availability = state.data;
  const mine = data.mine ?? 0;
  const canReserveMax = Math.min(data.maxPerUser - mine, data.available);
  const soldPercent = Math.round(((data.capacity - data.available) / data.capacity) * 100);

  async function run(action: Action) {
    if (!token) return;
    setBusy(action);
    setFeedback(null);
    try {
      const next = action === "reserve" ? await api.reserve(token, quantity) : await api.cancel(token, quantity);
      update(next);
      setQuantity(1);
      setFeedback({
        kind: "ok",
        text: action === "reserve" ? `Reserved ${quantity} ticket(s).` : `Cancelled ${quantity} ticket(s).`,
      });
    } catch (error) {
      if (error instanceof ApiError && error.code === "UNAUTHORIZED") {
        await logout(); // session expired on the server: back to login
        return;
      }
      setFeedback({ kind: "error", text: error instanceof ApiError ? error.message : "Request failed." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card">
      <h1>Championship final</h1>
      <p className="muted">Reserve up to {data.maxPerUser} tickets per person.</p>

      <div className="stats">
        <div className="stat">
          <span className="stat-value" data-testid="available">{data.available}</span>
          <span className="stat-label">of {data.capacity} still available</span>
        </div>
        <div className="stat">
          <span className="stat-value" data-testid="mine">{mine}</span>
          <span className="stat-label">reserved by you</span>
        </div>
      </div>
      <div className="progress" role="progressbar" aria-valuenow={soldPercent} aria-valuemin={0} aria-valuemax={100}
        aria-label="Tickets sold">
        <div className="progress-bar" style={{ width: `${soldPercent}%` }} />
      </div>

      <div className="actions">
        <label htmlFor="quantity">Tickets</label>
        <select id="quantity" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>
          {Array.from({ length: data.maxPerUser }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <button className="btn btn-primary" type="button" disabled={busy !== null || quantity > canReserveMax}
          onClick={() => void run("reserve")}>
          {busy === "reserve" ? "Reserving…" : "Reserve"}
        </button>
        <button className="btn btn-danger" type="button" disabled={busy !== null || quantity > mine}
          onClick={() => void run("cancel")}>
          {busy === "cancel" ? "Cancelling…" : "Cancel"}
        </button>
      </div>

      {feedback && (
        <p className={feedback.kind === "ok" ? "notice" : "form-error"} role="status">{feedback.text}</p>
      )}

      {user && mine > 0 && (
        <button className="btn btn-ghost" type="button"
          onClick={() => downloadConfirmation({
            holder: { firstName: user.firstName, lastName: user.lastName, email: user.email },
            tickets: mine,
            issuedAt: new Date().toISOString(),
          })}>
          Download confirmation
        </button>
      )}
    </section>
  );
}
