"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Select from "react-select";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { FormToggle } from "@/components/ui/FormToggle";
import { testOrdersApi, type TestOrderRequest } from "@/lib/api/testOrders";
import { patientsApi } from "@/lib/api/patients";
import { doctorsApi } from "@/lib/api/doctors";
import { hospitalsApi } from "@/lib/api/hospitals";
import { typeOrdersApi, type TypeOrder } from "@/lib/api/examens";
import type { ApiError as ApiErrorType } from "@/types/api";
import apiClient from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContractOption {
  id: string;
  name: string;
}

interface UserOption {
  id: string;
  firstname: string;
  lastname: string;
  roles?: string[];
}

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const editOrderSchema = z.object({
  typeOrderId: z.string().optional(),
  contratId: z.string().optional(),
  patientId: z.string().min(1, "Le patient est requis"),
  doctorId: z.string().optional(),
  hospitalId: z.string().optional(),
  referenceHopital: z.string().optional(),
  prelevementDate: z.string().min(1, "La date de prélèvement est requise"),
  isUrgent: z.boolean(),
  option: z.boolean().optional(),
  assignedToUserId: z.string().optional(),
});

type EditOrderFormData = z.infer<typeof editOrderSchema>;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface EditPageProps {
  params: Promise<{ id: string }>;
}

export default function TestOrderEditPage({ params }: EditPageProps) {
  const { id } = use(params);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<EditOrderFormData>({
    resolver: zodResolver(editOrderSchema),
    defaultValues: {
      isUrgent: false,
    },
  });

  // --- Query : demande existante
  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: ["test-order", id],
    queryFn: () => testOrdersApi.findById(id).then((r) => r.data),
    enabled: !!id,
  });

  // Préremplir le formulaire dès que la demande est chargée
  useEffect(() => {
    if (!order) return;
    reset({
      typeOrderId: order.typeOrderId ?? "",
      contratId: order.contratId ?? "",
      patientId: order.patientId,
      doctorId: order.doctorId ?? "",
      hospitalId: order.hospitalId ?? "",
      referenceHopital: order.referenceHopital ?? "",
      prelevementDate: order.prelevementDate ?? "",
      isUrgent: order.isUrgent,
      option: order.option ?? false,
      assignedToUserId: order.assignedToUserId ?? "",
    });
  }, [order, reset]);

  // --- Queries (référentiels)
  const { data: patientsData } = useQuery({
    queryKey: ["patients-all"],
    queryFn: () =>
      patientsApi.findAll({ size: 1000 }).then((r) => r.data.content),
  });

  const { data: doctorsData } = useQuery({
    queryKey: ["doctors-all"],
    queryFn: () =>
      doctorsApi.findAll({ size: 1000 }).then((r) => r.data.content),
  });

  const { data: hospitalsData } = useQuery({
    queryKey: ["hospitals-all"],
    queryFn: () =>
      hospitalsApi.findAll({ size: 1000 }).then((r) => r.data.content),
  });

  const { data: contractsData } = useQuery<ContractOption[]>({
    queryKey: ["contracts-active"],
    queryFn: async () => {
      const res = await apiClient.get<{ content: ContractOption[] }>(
        "/contracts",
        { params: { size: 1000, status: "ACTIF" } }
      );
      return res.data.content;
    },
  });

  const { data: typeOrdersData } = useQuery<TypeOrder[]>({
    queryKey: ["type-orders"],
    queryFn: () => typeOrdersApi.findAll().then((r) => r.data),
  });

  // Utilisateurs pour "Affecter à"
  const { data: usersData } = useQuery<UserOption[]>({
    queryKey: ["users-doctors"],
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ content: UserOption[] }>("/users", {
          params: { size: 1000, role: "doctor" },
        });
        return res.data.content;
      } catch {
        return [];
      }
    },
  });

  // Options React Select
  const patientOptions =
    patientsData?.map((p) => ({
      value: p.id,
      label: `${p.code} - ${p.firstname} ${p.lastname}`,
    })) ?? [];

  const doctorOptions =
    doctorsData?.map((d) => ({
      value: d.id,
      label: d.name,
    })) ?? [];

  const hospitalOptions =
    hospitalsData?.map((h) => ({
      value: h.id,
      label: h.name,
    })) ?? [];

  const contractOptions =
    contractsData?.map((c) => ({
      value: c.id,
      label: c.name,
    })) ?? [];

  const typeOrderOptions =
    typeOrdersData
      ?.filter((t) => t.id !== "1")
      .map((t) => ({
        value: t.id,
        label: t.title,
      })) ?? [];

  const userOptions =
    usersData?.map((u) => ({
      value: u.id,
      label: `${u.firstname} ${u.lastname}`,
    })) ?? [];

  // --- Mutation mise à jour
  const updateMutation = useMutation({
    mutationFn: (data: TestOrderRequest) => testOrdersApi.update(id, data),
    onSuccess: () => {
      toast.success("Demande mise à jour avec succès");
      router.push(`/test-orders/${id}/details`);
    },
    onError: (err: AxiosError<ApiErrorType>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la mise à jour"
      );
    },
  });

  const onSubmit = (data: EditOrderFormData) => {
    const payload: TestOrderRequest = {
      patientId: data.patientId,
      prelevementDate: data.prelevementDate,
      isUrgent: data.isUrgent,
    };

    if (data.typeOrderId) payload.typeOrderId = data.typeOrderId;
    if (data.contratId) payload.contratId = data.contratId;
    if (data.doctorId) payload.doctorId = data.doctorId;
    if (data.hospitalId) payload.hospitalId = data.hospitalId;
    if (data.referenceHopital) payload.referenceHopital = data.referenceHopital;
    if (data.assignedToUserId) payload.assignedToUserId = data.assignedToUserId;
    if (data.option !== undefined) payload.option = data.option;

    // Le PUT remplace l'intégralité de la demande, examens compris.
    // On réinjecte donc les examens existants pour ne pas les effacer
    // (ils sont gérés sur la page "détails", pas dans ce formulaire).
    if (order?.details?.length) {
      payload.details = order.details.map((d) => ({
        labTestId: d.labTestId,
        price: d.price,
        discount: d.discount,
      }));
    }

    updateMutation.mutate(payload);
  };

  if (orderLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Modifier la demande d'examen"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Demandes d'examen", href: "/test-orders" },
          { label: `Modifier #${order?.code ?? id}` },
        ]}
      />

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* 1. Type d'examen */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Type d'examen
              </label>
              <Controller
                name="typeOrderId"
                control={control}
                render={({ field }) => (
                  <Select
                    instanceId="order-type"
                    inputId="typeOrderId"
                    options={typeOrderOptions}
                    placeholder="Sélectionner un type..."
                    value={
                      typeOrderOptions.find((o) => o.value === field.value) ??
                      null
                    }
                    onChange={(opt) => field.onChange(opt?.value ?? "")}
                    isClearable
                    classNamePrefix="react-select"
                  />
                )}
              />
              {errors.typeOrderId && (
                <p className="text-xs text-red-500">
                  {errors.typeOrderId.message}
                </p>
              )}
            </div>

            {/* 2. Contrat */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Contrat
              </label>
              <Controller
                name="contratId"
                control={control}
                render={({ field }) => (
                  <Select
                    instanceId="order-contract"
                    inputId="contratId"
                    options={contractOptions}
                    placeholder="Sélectionner un contrat..."
                    value={
                      contractOptions.find((o) => o.value === field.value) ??
                      null
                    }
                    onChange={(opt) => field.onChange(opt?.value ?? "")}
                    isClearable
                    classNamePrefix="react-select"
                  />
                )}
              />
              {errors.contratId && (
                <p className="text-xs text-red-500">
                  {errors.contratId.message}
                </p>
              )}
            </div>

            {/* 3. Patient */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Patient <span className="text-red-500">*</span>
              </label>
              <Controller
                name="patientId"
                control={control}
                render={({ field }) => (
                  <Select
                    instanceId="order-patient"
                    inputId="patientId"
                    options={patientOptions}
                    placeholder="Sélectionner un patient..."
                    value={
                      patientOptions.find((o) => o.value === field.value) ??
                      null
                    }
                    onChange={(opt) => field.onChange(opt?.value ?? "")}
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

            {/* 4. Médecin traitant */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Médecin traitant
              </label>
              <Controller
                name="doctorId"
                control={control}
                render={({ field }) => (
                  <Select
                    instanceId="order-doctor"
                    inputId="doctorId"
                    options={doctorOptions}
                    placeholder="Sélectionner un médecin..."
                    value={
                      doctorOptions.find((o) => o.value === field.value) ?? null
                    }
                    onChange={(opt) => field.onChange(opt?.value ?? "")}
                    isClearable
                    isSearchable
                    classNamePrefix="react-select"
                  />
                )}
              />
            </div>

            {/* 5. Hôpital de provenance */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Hôpital de provenance
              </label>
              <Controller
                name="hospitalId"
                control={control}
                render={({ field }) => (
                  <Select
                    instanceId="order-hospital"
                    inputId="hospitalId"
                    options={hospitalOptions}
                    placeholder="Sélectionner un hôpital..."
                    value={
                      hospitalOptions.find((o) => o.value === field.value) ??
                      null
                    }
                    onChange={(opt) => field.onChange(opt?.value ?? "")}
                    isClearable
                    isSearchable
                    classNamePrefix="react-select"
                  />
                )}
              />
            </div>

            {/* 6. Référence hôpital */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Référence hôpital
              </label>
              <input
                type="text"
                {...register("referenceHopital")}
                placeholder="Numéro de référence..."
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* 7. Date prélèvement */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Date prélèvement <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                {...register("prelevementDate")}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {errors.prelevementDate && (
                <p className="text-xs text-red-500">
                  {errors.prelevementDate.message}
                </p>
              )}
            </div>

            {/* 8. Cas urgent */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">
                Cas urgent
              </label>
              <Controller
                name="isUrgent"
                control={control}
                render={({ field }) => (
                  <FormToggle
                    id="isUrgent-edit"
                    label={field.value ? "Urgent" : "Normal"}
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>

            {/* 9. Option */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">
                Option
              </label>
              <Controller
                name="option"
                control={control}
                render={({ field }) => (
                  <FormToggle
                    id="option-edit"
                    label={field.value ? "Oui" : "Non"}
                    checked={field.value ?? false}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>

            {/* 10. Affecter à (champ additionnel édition) */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Affecter à
              </label>
              <Controller
                name="assignedToUserId"
                control={control}
                render={({ field }) => (
                  <Select
                    instanceId="order-assigned-user"
                    inputId="assignedToUserId"
                    options={userOptions}
                    placeholder="Sélectionner un utilisateur..."
                    value={
                      userOptions.find((o) => o.value === field.value) ?? null
                    }
                    onChange={(opt) => field.onChange(opt?.value ?? "")}
                    isClearable
                    isSearchable
                    classNamePrefix="react-select"
                  />
                )}
              />
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
              disabled={updateMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {updateMutation.isPending && (
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
              Mettre à jour
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
