import type { ChangeEvent, HTMLInputTypeAttribute } from "react";

interface FieldProps {
  name: string;
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  error?: string | undefined;
  type?: HTMLInputTypeAttribute;
  autoComplete?: string;
}

/** Labelled input with an accessible error message (aria-invalid + aria-describedby). */
export function Field({ name, label, value, onChange, error, type = "text", autoComplete }: FieldProps) {
  const errorId = `${name}-error`;
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p className="field-error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
