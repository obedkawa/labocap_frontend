"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import type { AxiosError } from "axios";

import Link from "next/link";
import { X } from "lucide-react";

import { FormField } from "@/components/ui/FormField";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { PermissionGate } from "@/components/common/PermissionGate";
import { LimitedSelect as ReactSelect } from "@/components/ui/LimitedSelect";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { hrApi, type Employee } from "@/lib/api/hr";
import type { ApiError } from "@/types/api";

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500";

// Formulaire calqué à l'identique sur Laravel employee_timeoffs/create2.blade.php
// (« Ajouter un congé »). Le backend Java n'ayant qu'un champ texte `reason` et
// un statut enum (PENDING/APPROVED/REJECTED) non saisissable à la création, le
// mapping se fait derrière : reason = « type — message », et le statut Laravel
// (active/non active) est appliqué après coup via l'endpoint dédié.
const schema = z.object({
  employeeId: z.string().min(1, "L'employé est requis"),
  timeoffType: z.string().min(1, "Le type de congé est requis"),
  startDate: z.string().min(1, "La date de début est requise"),
  endDate: z.string().min(1, "La date de fin est requise"),
  status: z.string().min(1, "Le statut est requis"),
  message: z.string().min(1, "Le message est requis"),
});
type FormValues = z.infer<typeof schema>;

function AddTimeoffForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  // Laravel : le champ status est un select seulement pour qui peut créer des
  // paies ; sinon il est en lecture seule à « Non active ».
  const canSetStatus = can(PERMISSIONS.CREATE_PAYROLL);

  // Employé pré-sélectionné quand on arrive depuis une fiche employé
  // (?employeeId=…). On revient alors sur cette fiche après l'ajout.
  const searchParams = useSearchParams();
  const presetEmployeeId = searchParams.get("employeeId") ?? "";
  const backHref = presetEmployeeId ? `/hr/employees/${presetEmployeeId}` : "/hr/timeoff";

  const { data: employeesData } = useQuery({
    queryKey: ["employees"],
    queryFn: () => hrApi.findAll({ size: 200 }).then((r) => r.data),
  });
  const employees: Employee[] = employeesData?.content ?? [];
  const employeeOptions = employees.map((e) => ({
    value: e.id,
    label: `${e.firstName} ${e.lastName}`,
  }));

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: presetEmployeeId,
      timeoffType: "",
      startDate: "",
      endDate: "",
      status: canSetStatus ? "" : "non active",
      message: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (v: FormValues) => {
      const reason = v.message ? `${v.timeoffType} — ${v.message}` : v.timeoffType;
      const created = await hrApi
        .createTimeOff(v.employeeId, {
          startDate: v.startDate,
          endDate: v.endDate,
          reason,
        })
        .then((r) => r.data);
      // Laravel « active » ⇒ congé approuvé côté enum Java.
      if (v.status === "active") {
        await hrApi.updateTimeoffStatus(v.employeeId, created.id, { status: "APPROVED" });
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-offs"] });
      queryClient.invalidateQueries({ queryKey: ["employee-timeoffs"] });
      toast.success("Congé ajouté");
      router.push(backHref);
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur lors de l'enregistrement"),
  });

  return (
    <PermissionGate
      permission={PERMISSIONS.MANAGE_TIMEOFF}
      fallback={
        <div className="flex h-64 items-center justify-center text-sm text-gray-500">
          Vous n&apos;avez pas accès à cette page.
        </div>
      }
    >
      {/* Carte façon modale Bootstrap Laravel (header / body / footer) —
          design identique, couleurs de notre thème. */}
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* modal-header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Ajouter un congé</h2>
            <Link
              href={backHref}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </Link>
          </div>

          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
            {/* modal-body */}
            <div className="px-6 py-5">
              <p className="mb-4 text-right text-xs">
                <span className="text-red-500">*</span> champs obligatoires
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Employé — pleine largeur */}
            <FormField
              label="Employé"
              required
              error={form.formState.errors.employeeId?.message}
              className="sm:col-span-2"
            >
              <Controller
                name="employeeId"
                control={form.control}
                render={({ field }) => (
                  <ReactSelect
                    instanceId="add-timeoff-employee"
                    options={employeeOptions}
                    value={employeeOptions.find((o) => o.value === field.value) ?? null}
                    onChange={(opt) => field.onChange(opt?.value ?? "")}
                    placeholder="Selectionner un employé"
                    isClearable
                    classNamePrefix="react-select"
                  />
                )}
              />
            </FormField>

            {/* Type de congé + Date de début */}
            <FormField
              label="Type de congé"
              required
              error={form.formState.errors.timeoffType?.message}
            >
              <input type="text" {...form.register("timeoffType")} className={inputClass} />
            </FormField>

            <FormField
              label="Date de début"
              required
              error={form.formState.errors.startDate?.message}
            >
              <input type="date" {...form.register("startDate")} className={inputClass} />
            </FormField>

            {/* Date de fin + status */}
            <FormField
              label="Date de fin"
              required
              error={form.formState.errors.endDate?.message}
            >
              <input type="date" {...form.register("endDate")} className={inputClass} />
            </FormField>

            <FormField label="status" required error={form.formState.errors.status?.message}>
              {canSetStatus ? (
                <NativeSelect {...form.register("status")}>
                  <option value="">Selectionner un statut</option>
                  <option value="active">Active</option>
                  <option value="non active">Non Active</option>
                </NativeSelect>
              ) : (
                <input type="text" readOnly value="Non active" className={inputClass} />
              )}
            </FormField>

            {/* Message — pleine largeur */}
            <FormField
              label="Message"
              required
              error={form.formState.errors.message?.message}
              className="sm:col-span-2"
            >
              <textarea
                {...form.register("message")}
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </FormField>
              </div>
            </div>

            {/* modal-footer */}
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={() => router.push("/hr/timeoff")}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                Ajouter un congé
              </button>
            </div>
          </form>
        </div>
      </div>
    </PermissionGate>
  );
}

// useSearchParams doit être sous un <Suspense> (App Router).
export default function AddTimeoffPage() {
  return (
    <Suspense fallback={null}>
      <AddTimeoffForm />
    </Suspense>
  );
}
