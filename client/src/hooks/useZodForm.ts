import { useState, type ChangeEvent, type FormEvent } from "react";
import type { z } from "zod";
import { fieldErrors, type FieldErrors } from "@tickets/shared";

/**
 * Generic form state driven by a shared zod schema.
 * `values` has exactly the keys of the schema, and `submit` only calls `onValid`
 * with data that already passed the same validation the server will run.
 */
export function useZodForm<S extends z.ZodObject<z.ZodRawShape>>(
  schema: S,
  initial: Record<keyof z.input<S>, string>,
) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    // clear the message for the field the user is fixing
    setErrors(({ [name]: _removed, ...rest }) => rest);
  }

  function submit(onValid: (data: z.output<S>) => void | Promise<void>) {
    return async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const result = schema.safeParse(values);
      if (!result.success) {
        setErrors(fieldErrors(result.error));
        return;
      }
      await onValid(result.data);
    };
  }

  return { values, errors, setErrors, onChange, submit };
}
