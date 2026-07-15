"use client";

import { useId } from "react";
import type { SingleValue, StylesConfig } from "react-select";
import { cn } from "@/lib/utils";
import type { SelectOption } from "./FormSelect";
import { LimitedCreatableSelect as CreatableSelect } from "./LimitedSelect";
import { buildSelectStyles, SELECT_MENU_CLASSNAMES } from "./selectStyles";

interface CreatableSelectFieldProps {
  options: SelectOption[];
  /** Valeur courante (peut être une valeur créée absente de `options`). */
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  isClearable?: boolean;
  isDisabled?: boolean;
  name?: string;
  id?: string;
  className?: string;
}

/**
 * Champ de sélection mono-option avec recherche interne **et création à la
 * volée** : si le texte saisi ne figure pas dans la liste, l'utilisateur peut
 * valider sa saisie clavier comme nouvelle valeur.
 *
 * `value`/`onChange` manipulent une simple `string` (l'`id` choisi ou le texte
 * créé). Le menu n'affiche que 6 options, sans défilement : la recherche porte
 * sur toute la liste.
 */
export function CreatableSelectField({
  options,
  value,
  onChange,
  label,
  error,
  required = false,
  placeholder = "Rechercher ou saisir…",
  isClearable = true,
  isDisabled = false,
  name,
  id,
  className,
}: CreatableSelectFieldProps) {
  const styles = buildSelectStyles(!!error);

  // id stable SSR/client → évite le mismatch d'hydratation de react-select
  const generatedId = useId();
  const instanceId = id ?? name ?? generatedId;

  // La valeur peut avoir été créée (absente de `options`) : on reconstruit
  // alors une option ad hoc { value, label } pour l'afficher.
  const selected: SelectOption | null =
    value == null || value === ""
      ? null
      : options.find((o) => o.value === value) ?? { value, label: value };

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label
          htmlFor={id ?? name}
          className="block text-sm font-medium text-gray-700"
        >
          {label}
          {required && (
            <span className="ml-0.5 text-red-500" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <CreatableSelect<SelectOption, false>
        instanceId={instanceId}
        inputId={id ?? name}
        name={name}
        options={options}
        isMulti={false}
        value={selected}
        onChange={(opt: SingleValue<SelectOption>) =>
          onChange(opt?.value ?? null)
        }
        placeholder={placeholder}
        isClearable={isClearable}
        isDisabled={isDisabled}
        styles={styles as StylesConfig<SelectOption, false>}
        classNames={SELECT_MENU_CLASSNAMES}
        classNamePrefix="react-select"
        formatCreateLabel={(input) => `Ajouter « ${input} »`}
        noOptionsMessage={() => "Saisir pour ajouter une valeur"}
      />

      {error && (
        <p className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
