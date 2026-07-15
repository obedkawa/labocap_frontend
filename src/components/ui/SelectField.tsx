"use client";

import { useId } from "react";
import type {
  MultiValue,
  SingleValue,
  StylesConfig,
} from "react-select";
import { cn } from "@/lib/utils";
import type { SelectOption } from "./FormSelect";
import { LimitedSelect as Select } from "./LimitedSelect";
import { buildSelectStyles, SELECT_MENU_CLASSNAMES } from "./selectStyles";

// ---------------------------------------------------------------------------
// Props — API « friendly » basée sur des chaînes (pas d'objets react-select)
// ---------------------------------------------------------------------------

interface BaseProps {
  options: SelectOption[];
  label?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  isClearable?: boolean;
  isDisabled?: boolean;
  /** Champ de recherche interne (activé par défaut). */
  isSearchable?: boolean;
  /**
   * Rend le menu déroulant dans un portail (document.body) en position fixed.
   * À activer quand le select est dans un conteneur à `overflow` (ex. cellule
   * de tableau) où le menu serait sinon rogné.
   */
  menuPortal?: boolean;
  name?: string;
  id?: string;
  className?: string;
}

interface SingleProps extends BaseProps {
  isMulti?: false;
  value: string | null;
  onChange: (value: string | null) => void;
}

interface MultiProps extends BaseProps {
  isMulti: true;
  value: string[];
  onChange: (value: string[]) => void;
}

type SelectFieldProps = SingleProps | MultiProps;

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

/**
 * Champ de sélection (mono ou multi) avec recherche interne et design soigné.
 * Le menu n'affiche que 6 options, sans défilement : au-delà, on tape sa
 * recherche (qui porte sur toute la liste). Voir `LimitedSelect`.
 *
 * API par chaînes : `value`/`onChange` manipulent des `string` (mono) ou
 * `string[]` (multi), pas les objets internes de react-select.
 */
export function SelectField(props: SelectFieldProps) {
  const {
    options,
    label,
    error,
    required = false,
    placeholder = "Sélectionner...",
    isClearable = false,
    isDisabled = false,
    isSearchable = true,
    menuPortal = false,
    name,
    id,
    className,
  } = props;

  const styles = buildSelectStyles(!!error);

  // Cible du portail (uniquement côté client pour éviter les soucis de SSR).
  const menuPortalTarget =
    menuPortal && typeof document !== "undefined" ? document.body : undefined;

  // id stable SSR/client → évite le mismatch d'hydratation de react-select
  const generatedId = useId();
  const instanceId = id ?? name ?? generatedId;

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

      {props.isMulti ? (
        <Select<SelectOption, true>
          instanceId={instanceId}
          inputId={id ?? name}
          name={name}
          options={options}
          isMulti
          isSearchable={isSearchable}
          value={options.filter((o) => props.value.includes(o.value))}
          onChange={(opts: MultiValue<SelectOption>) =>
            props.onChange(opts.map((o) => o.value))
          }
          placeholder={placeholder}
          isClearable={isClearable}
          isDisabled={isDisabled}
          menuPortalTarget={menuPortalTarget}
          menuPosition={menuPortal ? "fixed" : "absolute"}
          styles={styles as StylesConfig<SelectOption, true>}
          classNames={SELECT_MENU_CLASSNAMES}
          noOptionsMessage={() => "Aucune option"}
          classNamePrefix="react-select"
        />
      ) : (
        <Select<SelectOption, false>
          instanceId={instanceId}
          inputId={id ?? name}
          name={name}
          options={options}
          isMulti={false}
          isSearchable={isSearchable}
          value={options.find((o) => o.value === props.value) ?? null}
          onChange={(opt: SingleValue<SelectOption>) =>
            props.onChange(opt?.value ?? null)
          }
          placeholder={placeholder}
          isClearable={isClearable}
          isDisabled={isDisabled}
          menuPortalTarget={menuPortalTarget}
          menuPosition={menuPortal ? "fixed" : "absolute"}
          styles={styles as StylesConfig<SelectOption, false>}
          classNames={SELECT_MENU_CLASSNAMES}
          noOptionsMessage={() => "Aucune option"}
          classNamePrefix="react-select"
        />
      )}

      {error && (
        <p className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
