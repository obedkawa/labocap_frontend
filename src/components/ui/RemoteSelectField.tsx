"use client";

import { useId, useState } from "react";
import AsyncSelect from "react-select/async";
import AsyncCreatableSelect from "react-select/async-creatable";
import type {
  ClassNamesConfig,
  GroupBase,
  MultiValue,
  SingleValue,
  StylesConfig,
} from "react-select";
import { cn } from "@/lib/utils";
import type { SelectOption } from "./FormSelect";
import { MAX_VISIBLE_OPTIONS } from "./LimitedSelect";
import { buildSelectStyles, SELECT_MENU_CLASSNAMES } from "./selectStyles";

interface RemoteSelectFieldProps<Option extends SelectOption> {
  /**
   * Recherche **côté serveur** : appelée avec le texte saisi (chaîne vide à
   * l'ouverture du menu). Doit interroger l'API sur la totalité de la
   * collection — c'est ce qui permet de retrouver un élément absent des 6
   * options affichées. Le résultat est de toute façon tronqué à 6.
   */
  loadOptions: (input: string) => Promise<Option[]>;
  /** Identifiant sélectionné (même contrat qu'un `<Select>` classique). */
  value: string | null;
  /** Reçoit l'id choisi et l'option complète (utile si elle porte des données). */
  onChange: (value: string | null, option: Option | null) => void;
  /**
   * Libellé de la valeur courante quand elle ne vient pas d'un choix dans le
   * menu : page d'édition qui arrive avec un id déjà posé, valeur tout juste
   * créée… Sans ça, le champ afficherait un id sans libellé.
   */
  selectedOption?: Option | null;
  label?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  isClearable?: boolean;
  isDisabled?: boolean;
  /** Autorise la saisie d'une valeur absente de la base. */
  creatable?: boolean;
  onCreateOption?: (input: string) => void;
  formatCreateLabel?: (input: string) => string;
  /** Menu rendu dans un portail (conteneurs à `overflow`, cellules de tableau). */
  menuPortal?: boolean;
  name?: string;
  id?: string;
  className?: string;
}

/**
 * Select dont la liste est trop grande pour être préchargée (patients, demandes
 * d'examen, factures, médecins…).
 *
 * Affichage : **6 options au maximum**, jamais de défilement — comme les selects
 * classiques (voir `LimitedSelect`).
 * Recherche : envoyée à l'API, donc portée sur **toute la base** et pas seulement
 * sur les 6 options visibles ni sur une page préchargée. Si le terme cherché
 * n'existe nulle part, le menu affiche « Aucun résultat ».
 */
export function RemoteSelectField<Option extends SelectOption = SelectOption>({
  loadOptions,
  value,
  onChange,
  selectedOption = null,
  label,
  error,
  required = false,
  placeholder = "Rechercher…",
  isClearable = true,
  isDisabled = false,
  creatable = false,
  onCreateOption,
  formatCreateLabel,
  menuPortal = false,
  name,
  id,
  className,
}: RemoteSelectFieldProps<Option>) {
  // Dernière option choisie dans le menu : react-select a besoin de l'objet
  // (libellé compris), or `value` ne porte que l'id.
  const [picked, setPicked] = useState<Option | null>(null);

  const current =
    value == null || value === ""
      ? null
      : picked?.value === value
        ? picked
        : selectedOption?.value === value
          ? selectedOption
          : null;

  const styles = buildSelectStyles(!!error);

  const generatedId = useId();
  const instanceId = id ?? name ?? generatedId;

  const menuPortalTarget =
    menuPortal && typeof document !== "undefined" ? document.body : undefined;

  const handleChange = (opt: SingleValue<Option>) => {
    setPicked(opt ?? null);
    onChange(opt?.value ?? null, opt ?? null);
  };

  const common = {
    instanceId,
    inputId: id ?? name,
    name,
    value: current,
    onChange: handleChange,
    loadOptions: (input: string) =>
      loadOptions(input).then((opts) => opts.slice(0, MAX_VISIBLE_OPTIONS)),
    // Charge les 6 premières options à l'ouverture, sans rien taper.
    defaultOptions: true,
    // Le serveur a déjà filtré (il cherche aussi sur le code, le téléphone…) :
    // re-filtrer sur le libellé côté client masquerait des résultats valides.
    filterOption: null,
    placeholder,
    isClearable,
    isDisabled,
    menuPortalTarget,
    menuPosition: (menuPortal ? "fixed" : "absolute") as "fixed" | "absolute",
    // `buildSelectStyles` est écrit pour `SelectOption` ; `Option` en est une
    // extension, les styles ne touchent pas aux données de l'option.
    styles: styles as unknown as StylesConfig<Option, false, GroupBase<Option>>,
    classNames: SELECT_MENU_CLASSNAMES as unknown as ClassNamesConfig<
      Option,
      false,
      GroupBase<Option>
    >,
    classNamePrefix: "react-select",
    loadingMessage: () => "Recherche…",
    noOptionsMessage: ({ inputValue }: { inputValue: string }) =>
      inputValue ? "Aucun résultat" : "Aucune option",
  };

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

      {creatable ? (
        <AsyncCreatableSelect<Option, false>
          {...common}
          onCreateOption={onCreateOption}
          formatCreateLabel={
            formatCreateLabel ?? ((input: string) => `Ajouter « ${input} »`)
          }
        />
      ) : (
        <AsyncSelect<Option, false> {...common} />
      )}

      {error && (
        <p className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface RemoteMultiSelectFieldProps<Option extends SelectOption> {
  /** Recherche côté serveur — voir {@link RemoteSelectField}. */
  loadOptions: (input: string) => Promise<Option[]>;
  /** Options sélectionnées (objets complets : les libellés ne sont plus retrouvables dans une liste préchargée). */
  value: Option[];
  onChange: (options: Option[]) => void;
  label?: string;
  placeholder?: string;
  isDisabled?: boolean;
  formatOptionLabel?: (option: Option) => React.ReactNode;
  name?: string;
  id?: string;
  className?: string;
}

/**
 * Version multi-sélection de {@link RemoteSelectField} : 6 options affichées,
 * recherche envoyée à l'API sur toute la base.
 */
export function RemoteMultiSelectField<Option extends SelectOption>({
  loadOptions,
  value,
  onChange,
  label,
  placeholder = "Rechercher…",
  isDisabled = false,
  formatOptionLabel,
  name,
  id,
  className,
}: RemoteMultiSelectFieldProps<Option>) {
  const styles = buildSelectStyles(false);
  const generatedId = useId();
  const instanceId = id ?? name ?? generatedId;

  return (
    <div className={cn(className)}>
      {label && (
        <label
          htmlFor={id ?? name}
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          {label}
        </label>
      )}
      <AsyncSelect<Option, true>
        isMulti
        instanceId={instanceId}
        inputId={id ?? name}
        name={name}
        value={value}
        onChange={(opts: MultiValue<Option>) => onChange([...opts])}
        loadOptions={(input: string) =>
          loadOptions(input).then((opts) => opts.slice(0, MAX_VISIBLE_OPTIONS))
        }
        defaultOptions
        filterOption={null}
        formatOptionLabel={formatOptionLabel}
        placeholder={placeholder}
        isDisabled={isDisabled}
        isClearable
        styles={styles as unknown as StylesConfig<Option, true, GroupBase<Option>>}
        classNames={
          SELECT_MENU_CLASSNAMES as unknown as ClassNamesConfig<
            Option,
            true,
            GroupBase<Option>
          >
        }
        classNamePrefix="react-select"
        loadingMessage={() => "Recherche…"}
        noOptionsMessage={({ inputValue }) =>
          inputValue ? "Aucun résultat" : "Aucune option"
        }
      />
    </div>
  );
}
