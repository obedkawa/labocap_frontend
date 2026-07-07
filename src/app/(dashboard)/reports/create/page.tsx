"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Select from "react-select";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { FormField } from "@/components/ui/FormField";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { reportsApi } from "@/lib/api/reports";
import { patientsApi, type Patient } from "@/lib/api/patients";
import { testOrdersApi, type TestOrder } from "@/lib/api/testOrders";
import { formatDate } from "@/lib/utils";
import type { ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const createReportSchema = z.object({
  patientId: z.string().min(1, "Le patient est requis"),
  testOrderId: z.string().min(1, "La demande d'examen est requise"),
  content: z.string().optional(),
});

type CreateReportFormValues = z.infer<typeof createReportSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const textareaClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y";

interface SelectOption {
  value: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReportCreatePage() {
  const router = useRouter();
  const { can } = usePermissions();

  // Recherche patient (la requête part dès le 1er caractère, sans debounce)
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<CreateReportFormValues>({
    resolver: zodResolver(createReportSchema),
    defaultValues: {
      patientId: "",
      testOrderId: "",
      content: "",
    },
  });

  // --- Query : patients (recherche)
  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ["patients-search", patientSearch],
    queryFn: () =>
      patientsApi
        .findAll({ size: 50, search: patientSearch || undefined })
        .then((r) => r.data.content),
    placeholderData: (prev) => prev,
  });

  const patientOptions: SelectOption[] = (patientsData ?? []).map(
    (p: Patient) => ({
      value: p.id,
      label: `${p.code} - ${p.firstname} ${p.lastname}`,
    })
  );

  // --- Query : demandes liées au patient sélectionné
  const { data: testOrdersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["test-orders-patient", selectedPatientId],
    queryFn: () =>
      testOrdersApi
        .findAll({ size: 100, patientId: selectedPatientId || undefined })
        .then((r) => r.data.content),
    enabled: !!selectedPatientId,
  });

  // Filtre côté client par patient (l'API peut ne pas supporter ce paramètre)
  const filteredOrders = selectedPatientId
    ? (testOrdersData ?? []).filter(
        (o: TestOrder) => o.patientId === selectedPatientId
      )
    : [];

  const testOrderOptions: SelectOption[] = filteredOrders.map(
    (o: TestOrder) => ({
      value: o.id,
      label: `${o.code} — ${formatDate(o.createdAt)}`,
    })
  );

  // --- Mutation création
  const createMutation = useMutation({
    mutationFn: (data: CreateReportFormValues) =>
      reportsApi.create({
        testOrderId: data.testOrderId,
        content: data.content || undefined,
      }),
    onSuccess: (res) => {
      toast.success("Rapport créé avec succès");
      router.push(`/reports/${res.data.id}`);
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la création du rapport"
      );
    },
  });

  const onSubmit = (data: CreateReportFormValues) => {
    createMutation.mutate(data);
  };

  // ---------------------------------------------------------------------------
  // Guard de permission
  // ---------------------------------------------------------------------------

  if (!can(PERMISSIONS.CREATE_REPORTS)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Accès non autorisé</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nouveau rapport"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Comptes rendus", href: "/reports" },
          { label: "Nouveau rapport" },
        ]}
      />

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {/* 1. Patient */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Patient <span className="text-red-500">*</span>
              </label>
              <Controller
                name="patientId"
                control={control}
                render={({ field }) => (
                  <Select
                    instanceId="report-patient"
                    inputId="patientId"
                    options={patientOptions}
                    isLoading={patientsLoading}
                    placeholder="Rechercher un patient…"
                    noOptionsMessage={() =>
                      patientSearch.length === 0
                        ? "Saisissez un nom pour rechercher"
                        : "Aucun patient trouvé"
                    }
                    value={
                      patientOptions.find((o) => o.value === field.value) ??
                      null
                    }
                    onInputChange={(v) => setPatientSearch(v)}
                    onChange={(opt) => {
                      const val = opt?.value ?? "";
                      field.onChange(val);
                      setSelectedPatientId(val);
                      // Réinitialiser la demande si on change de patient
                      setValue("testOrderId", "");
                    }}
                    isClearable
                    isSearchable
                    classNamePrefix="react-select"
                  />
                )}
              />
              {errors.patientId && (
                <p className="text-xs text-red-500">
                  {errors.patientId.message}
                </p>
              )}
            </div>

            {/* 2. Demande d'examen liée */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Demande d&apos;examen <span className="text-red-500">*</span>
              </label>
              <Controller
                name="testOrderId"
                control={control}
                render={({ field }) => (
                  <Select
                    instanceId="report-test-order"
                    inputId="testOrderId"
                    options={testOrderOptions}
                    isLoading={ordersLoading}
                    isDisabled={!selectedPatientId}
                    placeholder={
                      selectedPatientId
                        ? "Sélectionner une demande…"
                        : "Sélectionnez d'abord un patient"
                    }
                    noOptionsMessage={() =>
                      selectedPatientId
                        ? "Aucune demande trouvée"
                        : "Sélectionnez d'abord un patient"
                    }
                    value={
                      testOrderOptions.find((o) => o.value === field.value) ??
                      null
                    }
                    onChange={(opt) => field.onChange(opt?.value ?? "")}
                    isClearable
                    classNamePrefix="react-select"
                  />
                )}
              />
              {errors.testOrderId && (
                <p className="text-xs text-red-500">
                  {errors.testOrderId.message}
                </p>
              )}
            </div>

            {/* 3. Contenu optionnel */}
            <div className="flex flex-col gap-1 md:col-span-2">
              <FormField label="Contenu initial" error={errors.content?.message}>
                <textarea
                  {...register("content")}
                  rows={8}
                  placeholder="Saisir le contenu initial du rapport (optionnel)…"
                  className={textareaClass}
                />
              </FormField>
            </div>
          </div>

          {/* Boutons */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createMutation.isPending && (
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
              )}
              Créer le rapport
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
