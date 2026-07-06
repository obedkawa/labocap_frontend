"use client";

import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { CreatableSelectField } from "./CreatableSelectField";
import type { SelectOption } from "./FormSelect";

interface RHFCreatableSelectProps<T extends FieldValues> {
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
 * `CreatableSelectField` (mono-option, recherche + saisie libre) branché sur
 * react-hook-form. La valeur du formulaire reste une chaîne : l'`id`/`value`
 * choisi dans la liste, ou le texte saisi au clavier.
 */
export function RHFCreatableSelect<T extends FieldValues>({
  control,
  name,
  options,
  label,
  error,
  required,
  placeholder,
  isClearable,
  isDisabled,
}: RHFCreatableSelectProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <CreatableSelectField
          options={options}
          label={label}
          error={error}
          required={required}
          placeholder={placeholder}
          isClearable={isClearable}
          isDisabled={isDisabled}
          name={field.name}
          value={(field.value as string) || null}
          onChange={(v) => field.onChange(v ?? "")}
        />
      )}
    />
  );
}
