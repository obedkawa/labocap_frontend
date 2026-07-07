"use client";

import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { FormSelect, type SelectOption } from "./FormSelect";

interface RHFSelectProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  options: SelectOption[];
  label?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  isClearable?: boolean;
  isDisabled?: boolean;
}

/**
 * Select recherchable (react-select) branché sur react-hook-form.
 * La valeur du formulaire reste une simple chaîne (l'`id`/`value` choisi) ;
 * le champ de recherche interne aux options est fourni par `FormSelect`.
 */
export function RHFSelect<T extends FieldValues>({
  control,
  name,
  options,
  label,
  error,
  required,
  placeholder,
  isClearable,
  isDisabled,
}: RHFSelectProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <FormSelect
          label={label}
          error={error}
          required={required}
          options={options}
          placeholder={placeholder}
          isClearable={isClearable}
          isDisabled={isDisabled}
          name={field.name}
          value={
            options.find((o) => o.value === (field.value as string)) ?? null
          }
          onChange={(opt) => field.onChange((opt as SelectOption | null)?.value ?? "")}
        />
      )}
    />
  );
}
