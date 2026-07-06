"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Plus, Download, Pencil, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { TextInput } from "@/components/ui/TextInput";
import { Checkbox } from "@/components/ui/Checkbox";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { SearchInput } from "@/components/ui/SearchInput";
import { RHFSelect } from "@/components/ui/RHFSelect";
import { SelectField } from "@/components/ui/SelectField";
import { CreatableSelectField } from "@/components/ui/CreatableSelectField";
import { FormField } from "@/components/ui/FormField";
import { RHFCreatableSelect } from "@/components/ui/RHFCreatableSelect";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RowActions } from "@/components/common/RowActions";
import { DataTableCard } from "@/components/common/DataTableCard";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { LabTestForm, type LabTestFormData } from "@/components/examens/LabTestForm";
import { CategoryForm, type CategoryFormData } from "@/components/examens/CategoryForm";
import type { CategoryTest } from "@/lib/api/examens";

interface DemoForm {
  categorie: string;
}

// Catégories fictives pour alimenter le LabTestForm de la vitrine.
const demoCategories: CategoryTest[] = [
  { id: "cf", code: "CF", name: "Cytologie", branchId: "b1" },
  { id: "hp", code: "HP", name: "Histopathologie", branchId: "b1" },
  { id: "im", code: "IM", name: "Immunohistochimie", branchId: "b1" },
  { id: "bm", code: "BM", name: "Biologie moléculaire", branchId: "b1" },
];

interface DemoRow {
  id: string;
  name: string;
  category: string;
  price: number;
}

const demoRows: DemoRow[] = [
  { id: "1", name: "Frottis cervico-vaginal", category: "Cytologie", price: 12000 },
  { id: "2", name: "Biopsie cutanée", category: "Histopathologie", price: 25000 },
  { id: "3", name: "Immunomarquage CK7", category: "Immunohistochimie", price: 40000 },
  { id: "4", name: "Recherche HPV", category: "Biologie moléculaire", price: 35000 },
  { id: "5", name: "Cytoponction thyroïdienne", category: "Cytologie", price: 18000 },
  { id: "6", name: "Biopsie mammaire", category: "Histopathologie", price: 28000 },
  { id: "7", name: "Ganglion sentinelle", category: "Histopathologie", price: 45000 },
  { id: "8", name: "Frottis sanguin", category: "Cytologie", price: 8000 },
  { id: "9", name: "Immunomarquage Ki-67", category: "Immunohistochimie", price: 42000 },
  { id: "10", name: "Biopsie prostatique", category: "Histopathologie", price: 30000 },
  { id: "11", name: "Recherche EBV", category: "Biologie moléculaire", price: 33000 },
  { id: "12", name: "Cytologie urinaire", category: "Cytologie", price: 15000 },
];

/** Bloc titre d'une sous-section de la vitrine. */
function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-gray-100 py-4 last:border-b-0 md:flex-row md:items-center">
      <p className="w-full text-sm font-medium text-gray-500 md:w-56 md:shrink-0">
        {title}
      </p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/**
 * Vitrine des composants réutilisables créés pour le Catalogue d'examen.
 * Purement démonstratif (aucune donnée persistée).
 */
export function ComponentsShowcase() {
  const [search, setSearch] = useState("");
  const [nativeValue, setNativeValue] = useState("");
  const [singleValue, setSingleValue] = useState<string | null>(null);
  const [multiValue, setMultiValue] = useState<string[]>([]);
  const [creatableValue, setCreatableValue] = useState<string | null>(null);
  const [checked, setChecked] = useState(true);

  // Modales (démonstration — aucune action réelle)
  const [crudSize, setCrudSize] = useState<"sm" | "md" | "lg" | "xl" | null>(
    null
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { control } = useForm<DemoForm>({ defaultValues: { categorie: "" } });

  // Instances RHF pour démontrer les formulaires complets (sans soumission).
  const labTestForm = useForm<LabTestFormData>({
    defaultValues: { categoryTestId: "", name: "", price: "", status: "ACTIF" },
  });
  const categoryForm = useForm<CategoryFormData>({
    defaultValues: { code: "", name: "" },
  });

  const demoOptions = [
    { value: "cf", label: "Cytologie" },
    { value: "hp", label: "Histopathologie" },
    { value: "im", label: "Immunohistochimie" },
    { value: "bm", label: "Biologie moléculaire" },
    { value: "ce", label: "Cytologie exfoliative" },
    { value: "ct", label: "Cytoponction" },
    { value: "ap", label: "Anatomopathologie" },
    { value: "fs", label: "Frottis cervico-vaginal" },
    { value: "bl", label: "Biopsie liquide" },
    { value: "gs", label: "Ganglion sentinelle" },
  ];

  const demoColumns: ColumnDef<DemoRow>[] = [
    { header: "Nom", accessorKey: "name" },
    { header: "Catégorie", accessorKey: "category" },
    {
      header: "Prix",
      accessorKey: "price",
      cell: ({ row }) => `${row.original.price.toLocaleString("fr-FR")} FCFA`,
    },
    {
      header: "Actions",
      id: "actions",
      cell: () => <RowActions iconOnly onEdit={() => {}} onDelete={() => {}} />,
    },
  ];

  return (
    <div className="rounded-xl border border-dashed border-blue-300 bg-blue-50/40 p-5">
      <div className="mb-2">
        <h2 className="text-base font-semibold text-gray-800">
          Vitrine des composants réutilisables
        </h2>
        <p className="text-xs text-gray-500">
          Démonstration des composants créés (non fonctionnel — aperçu visuel).
        </p>
      </div>

      <div className="divide-y divide-gray-100">
        {/* Boutons */}
        <Row title="Button (ajouter / variantes)">
          <Button icon={<Plus className="h-4 w-4" />}>Ajouter un examen</Button>
          <Button variant="danger">Supprimer</Button>
          <Button variant="secondary" icon={<Download className="h-4 w-4" />}>
            Exporter
          </Button>
          <Button size="sm">Petit</Button>
        </Row>

        {/* IconButton */}
        <Row title="IconButton (petit bouton icône)">
          <IconButton variant="edit" icon={<Pencil className="h-4 w-4" />} title="Modifier" />
          <IconButton variant="delete" icon={<Trash2 className="h-4 w-4" />} title="Supprimer" />
          <IconButton icon={<Download className="h-4 w-4" />} title="Télécharger" />
        </Row>

        {/* RowActions */}
        <Row title="RowActions (actions de ligne)">
          <RowActions onEdit={() => {}} onDelete={() => {}} />
          <span className="text-xs text-gray-400">mode iconOnly →</span>
          <RowActions iconOnly onEdit={() => {}} onDelete={() => {}} />
        </Row>

        {/* SearchInput */}
        <Row title="SearchInput (recherche)">
          <SearchInput
            className="max-w-xs w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Row>

        {/* TextInput */}
        <Row title="TextInput (champ + erreur)">
          <div className="w-56">
            <FormField label="Nom">
              <TextInput placeholder="Saisir un nom" />
            </FormField>
          </div>
          <div className="w-56">
            <FormField label="Prix" error="Le prix est requis">
              <TextInput type="number" error placeholder="0" />
            </FormField>
          </div>
        </Row>

        {/* Checkbox */}
        <Row title="Checkbox (case à cocher)">
          <Checkbox
            label="Actif"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <Checkbox label="Cochée par défaut" defaultChecked />
          <Checkbox label="Non cochée" />
          <Checkbox label="Désactivée" disabled />
        </Row>

        {/* NativeSelect */}
        <Row title="NativeSelect (select natif)">
          <div className="w-56">
            <FormField label="Statut">
              <NativeSelect
                value={nativeValue}
                onChange={(e) => setNativeValue(e.target.value)}
              >
                <option value="">Tous</option>
                <option value="ACTIF">ACTIF</option>
                <option value="INACTIF">INACTIF</option>
              </NativeSelect>
            </FormField>
          </div>
        </Row>

        {/* RHFSelect */}
        <Row title="RHFSelect (select recherchable, RHF)">
          <div className="w-72">
            <RHFSelect
              control={control}
              name="categorie"
              label="Catégorie parente"
              placeholder="Rechercher une catégorie…"
              options={demoOptions.slice(0, 4)}
              isClearable
            />
          </div>
        </Row>

        {/* SelectField — mono */}
        <Row title="SelectField (mono-sélection + recherche)">
          <div className="w-72">
            <SelectField
              label="Catégorie"
              placeholder="Rechercher…"
              options={demoOptions}
              value={singleValue}
              onChange={setSingleValue}
              isClearable
            />
          </div>
        </Row>

        {/* SelectField — multi */}
        <Row title="SelectField (multi-sélection + recherche)">
          <div className="w-72">
            <SelectField
              isMulti
              label="Catégories"
              placeholder="Rechercher et ajouter…"
              options={demoOptions}
              value={multiValue}
              onChange={setMultiValue}
              isClearable
            />
          </div>
        </Row>

        {/* CreatableSelectField — mono + création */}
        <Row title="CreatableSelectField (mono + saisie libre)">
          <div className="w-72">
            <CreatableSelectField
              label="Catégorie"
              placeholder="Rechercher ou saisir une valeur…"
              options={demoOptions}
              value={creatableValue}
              onChange={setCreatableValue}
            />
          </div>
        </Row>

        {/* RHFCreatableSelect */}
        <Row title="RHFCreatableSelect (select créable, RHF)">
          <div className="w-72">
            <RHFCreatableSelect
              control={labTestForm.control}
              name="categoryTestId"
              label="Catégorie parente"
              placeholder="Rechercher ou saisir une catégorie…"
              options={demoOptions.slice(0, 4)}
              isClearable
            />
          </div>
        </Row>

        {/* StatusBadge */}
        <Row title="StatusBadge (badge de statut)">
          <StatusBadge status="ACTIF" domain="contract" />
          <StatusBadge status="INACTIF" domain="contract" />
          <StatusBadge status="ACTIF" domain="general" />
          <StatusBadge status="INACTIF" domain="general" />
        </Row>

        {/* CrudModal — modale de formulaire, différentes tailles */}
        <Row title="CrudModal (tailles : sm / md / lg / xl)">
          <Button variant="secondary" size="sm" onClick={() => setCrudSize("sm")}>
            sm (max-w-sm)
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCrudSize("md")}>
            md (max-w-md)
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCrudSize("lg")}>
            lg (max-w-2xl)
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCrudSize("xl")}>
            xl (max-w-4xl)
          </Button>
          <span className="text-xs text-gray-400">
            même modale, largeur adaptée à l&apos;écran
          </span>
        </Row>

        {/* ConfirmModal — modale de confirmation */}
        <Row title="ConfirmModal (confirmation)">
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Ouvrir la confirmation
          </Button>
          <span className="text-xs text-gray-400">
            confirmation d&apos;action destructive
          </span>
        </Row>
      </div>

      {/* DataTableCard — pleine largeur (tri, recherche, pagination) */}
      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-gray-500">
          DataTableCard (tableau : tri, recherche et pagination)
        </p>
        <DataTableCard columns={demoColumns} data={demoRows} />
      </div>

      {/* PageHeader — pleine largeur (titre + fil d'Ariane + action) */}
      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-gray-500">
          PageHeader (titre, sous-titre, fil d&apos;Ariane, action)
        </p>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <PageHeader
            title="Catalogue d'examens"
            subtitle="Gestion des examens du laboratoire"
            breadcrumbs={[
              { label: "Accueil", href: "#" },
              { label: "Examens" },
            ]}
            action={
              <Button icon={<Plus className="h-4 w-4" />}>Ajouter un examen</Button>
            }
          />
        </div>
      </div>

      {/* Formulaires complets — pleine largeur */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium text-gray-500">
            LabTestForm (formulaire examen)
          </p>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <LabTestForm
              register={labTestForm.register}
              control={labTestForm.control}
              errors={labTestForm.formState.errors}
              categories={demoCategories}
            />
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-gray-500">
            CategoryForm (formulaire catégorie)
          </p>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <CategoryForm
              register={categoryForm.register}
              errors={categoryForm.formState.errors}
            />
          </div>
        </div>
      </div>

      {/* CrudModal — démonstration multi-tailles */}
      <CrudModal
        isOpen={crudSize !== null}
        onClose={() => setCrudSize(null)}
        title={`Ajouter un examen — taille ${crudSize ?? ""}`}
        size={crudSize ?? "md"}
        submitLabel="Enregistrer"
        onSubmit={() => setCrudSize(null)}
        closeOnOverlayClick={false}
        closeOnEscape={false}
      >
        <div className="flex flex-col gap-4">
          <FormField label="Nom">
            <TextInput placeholder="Saisir un nom" />
          </FormField>
          <FormField label="Prix">
            <TextInput type="number" placeholder="0" />
          </FormField>
          <FormField label="Statut">
            <NativeSelect defaultValue="ACTIF">
              <option value="ACTIF">ACTIF</option>
              <option value="INACTIF">INACTIF</option>
            </NativeSelect>
          </FormField>
        </div>
      </CrudModal>

      {/* ConfirmModal — démonstration */}
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => setConfirmOpen(false)}
        title="Supprimer cet examen"
        message="Voulez-vous vraiment supprimer l'examen « Biopsie cutanée » ? Cette action est irréversible."
        confirmLabel="Supprimer"
        confirmVariant="danger"
      />
    </div>
  );
}
