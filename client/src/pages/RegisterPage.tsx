import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerSchema, type RegisterInput } from "@tickets/shared";
import { ApiError, api } from "../api/client";
import { Field } from "../components/Field";
import { useZodForm } from "../hooks/useZodForm";

const FIELDS: { name: keyof RegisterInput; label: string; type?: string; autoComplete: string }[] = [
  { name: "firstName", label: "First name", autoComplete: "given-name" },
  { name: "lastName", label: "Last name", autoComplete: "family-name" },
  { name: "username", label: "Username", autoComplete: "username" },
  { name: "email", label: "E-mail", type: "email", autoComplete: "email" },
  { name: "password", label: "Password (min. 8 characters)", type: "password", autoComplete: "new-password" },
];

export function RegisterPage() {
  const navigate = useNavigate();
  const form = useZodForm(registerSchema, {
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    password: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = form.submit(async (data) => {
    setBusy(true);
    setFormError(null);
    try {
      const user = await api.register(data);
      navigate("/login", { state: { registered: user.username } });
    } catch (error) {
      if (error instanceof ApiError && error.code === "USERNAME_TAKEN") {
        form.setErrors({ username: error.message });
      } else if (error instanceof ApiError && error.code === "VALIDATION_FAILED") {
        form.setErrors(error.fields);
      } else {
        setFormError("Could not reach the server.");
      }
    } finally {
      setBusy(false);
    }
  });

  return (
    <section className="card narrow">
      <h1>Create an account</h1>
      <form onSubmit={onSubmit} noValidate>
        {FIELDS.map((f) => (
          <Field key={f.name} name={f.name} label={f.label} type={f.type ?? "text"}
            value={form.values[f.name]} onChange={form.onChange} error={form.errors[f.name]}
            autoComplete={f.autoComplete} />
        ))}
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Register"}
        </button>
      </form>
      <p className="muted">
        Already registered? <Link to="/login">Log in</Link>
      </p>
    </section>
  );
}
