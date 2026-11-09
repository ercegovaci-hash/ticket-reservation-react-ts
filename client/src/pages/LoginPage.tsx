import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { loginSchema } from "@tickets/shared";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Field } from "../components/Field";
import { useZodForm } from "../hooks/useZodForm";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const registered = (location.state as { registered?: string } | null)?.registered;
  const from = (location.state as { from?: string } | null)?.from ?? "/tickets";

  const form = useZodForm(loginSchema, { username: registered ?? "", password: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = form.submit(async (data) => {
    setBusy(true);
    setFormError(null);
    try {
      await login(data);
      navigate(from, { replace: true });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Could not reach the server.");
    } finally {
      setBusy(false);
    }
  });

  return (
    <section className="card narrow">
      <h1>Log in</h1>
      {registered && <p className="notice">Account created. You can log in now.</p>}
      <form onSubmit={onSubmit} noValidate>
        <Field name="username" label="Username" value={form.values.username} onChange={form.onChange}
          error={form.errors.username} autoComplete="username" />
        <Field name="password" label="Password" type="password" value={form.values.password}
          onChange={form.onChange} error={form.errors.password} autoComplete="current-password" />
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="muted">
        No account yet? <Link to="/register">Register</Link>
      </p>
    </section>
  );
}
