import { useCallback, useEffect, useState } from "react";
import type { Availability } from "@tickets/shared";
import { api } from "../api/client";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: Availability };

/** Loads ticket availability for the current user; `update` applies a server response. */
export function useAvailability(token: string | null) {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(async () => {
    try {
      setState({ status: "ready", data: await api.tickets(token) });
    } catch {
      setState({ status: "error", message: "Could not load ticket availability." });
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback((data: Availability) => setState({ status: "ready", data }), []);

  return { state, reload: load, update };
}
