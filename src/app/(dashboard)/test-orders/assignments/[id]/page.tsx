"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Select, { type SingleValue } from "react-select";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  assignmentsApi,
  type AssignmentDetail,
  type AssignmentPrint,
} from "@/lib/api/assignments";
import { usersApi, type User } from "@/lib/api/users";
import { testOrdersApi, type TestOrder } from "@/lib/api/testOrders";
import type { ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function isDoctorRole(name?: string): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return (
    n.includes("docteur") ||
    n.includes("doctor") ||
    n.includes("medecin") ||
    n.includes("médecin") ||
    n.includes("anapath") ||
    n.includes("anatomopath")
  );
}

interface UpdateForm {
  userId: string;
  date: string;
  note: string;
}

interface OrderOption {
  value: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AssignmentDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const canManage = can(PERMISSIONS.MANAGE_TEST_ORDER_ASSIGNMENTS);

  // ---- Form mise à jour ----------------------------------------------------

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateForm>({
    defaultValues: { userId: "", date: "", note: "" },
  });

  // ---- Ajout détail
  const [selectedOrder, setSelectedOrder] = useState<OrderOption | null>(null);
  const [detailNote, setDetailNote] = useState("");

  // ---- Modal suppression
  const [detailToDelete, setDetailToDelete] = useState<AssignmentDetail | null>(
    null
  );

  // ---- Queries -------------------------------------------------------------

  const { data: printData, isLoading } = useQuery<AssignmentPrint>({
    queryKey: ["assignment", id],
    queryFn: () => assignmentsApi.getPrint(id as string).then((r) => r.data),
    enabled: !!id,
  });

  const assignment = printData?.assignment;
  const details = useMemo<AssignmentDetail[]>(
    () => printData?.details ?? [],
    [printData]
  );

  // Docteurs
  const { data: usersData } = useQuery({
    queryKey: ["users-doctors"],
    queryFn: () =>
      usersApi.findAll({ size: 500 }).then((r) => r.data.content as User[]),
  });
  const doctors = useMemo(
    () =>
      (usersData ?? []).filter((u) =>
        (u.roles ?? []).some((r) => isDoctorRole(r.name))
      ),
    [usersData]
  );

  // Demandes d'examens VALIDATED
  const { data: ordersData } = useQuery({
    queryKey: ["test-orders-validated-for-assignment"],
    queryFn: () =>
      testOrdersApi
        .findAll({ size: 500, status: "VALIDATED" })
        .then((r) => r.data.content as TestOrder[]),
  });

  const assignedOrderIds = useMemo(
    () => new Set(details.map((d) => d.testOrderId)),
    [details]
  );

  const orderOptions: OrderOption[] = useMemo(
    () =>
      (ordersData ?? [])
        .filter((o) => !assignedOrderIds.has(o.id))
        .map((o) => ({
          value: o.id,
          label: `${o.code} — ${o.patientFirstname} ${o.patientLastname}`,
        })),
    [ordersData, assignedOrderIds]
  );

  // ---- Initialisation form après chargement --------------------------------

  useEffect(() => {
    if (assignment) {
      reset({
        userId: assignment.userId ?? "",
        date: assignment.date
          ? assignment.date.slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        note: assignment.note ?? "",
      });
    }
  }, [assignment, reset]);

  // ---- Mutations -----------------------------------------------------------

  const updateMutation = useMutation({
    mutationFn: (values: UpdateForm) =>
      assignmentsApi.update(id as string, {
        userId: values.userId,
        date: values.date || undefined,
        note: values.note || undefined,
      }),
    onSuccess: () => {
      toast.success("Affectation mise à jour");
      queryClient.invalidateQueries({ queryKey: ["assignment", id] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la mise à jour"
      );
    },
  });

  const addDetailMutation = useMutation({
    mutationFn: (data: { testOrderId: string; note?: string }) =>
      assignmentsApi.addDetail(id as string, data),
    onSuccess: () => {
      toast.success("Demande d'examen ajoutée");
      queryClient.invalidateQueries({ queryKey: ["assignment", id] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      setSelectedOrder(null);
      setDetailNote("");
    },
    onError: (err: AxiosError<ApiError>) => {
      const status = err.response?.status;
      if (status === 409) {
        toast.error("Cette demande d'examen est déjà affectée");
      } else {
        toast.error(
          err.response?.data?.message ?? "Erreur lors de l'ajout"
        );
      }
    },
  });

  const deleteDetailMutation = useMutation({
    mutationFn: (detailId: string) => assignmentsApi.deleteDetail(detailId),
    onSuccess: () => {
      toast.success("Détail supprimé");
      queryClient.invalidateQueries({ queryKey: ["assignment", id] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      setDetailToDelete(null);
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la suppression"
      );
    },
  });

  // ---- Handlers ------------------------------------------------------------

  const onSubmitUpdate = (values: UpdateForm) => {
    if (!values.userId) {
      toast.error("Veuillez sélectionner un docteur");
      return;
    }
    updateMutation.mutate(values);
  };

  const handleAddDetail = () => {
    if (!selectedOrder) {
      toast.error("Veuillez sélectionner une demande d'examen");
      return;
    }
    addDetailMutation.mutate({
      testOrderId: selectedOrder.value,
      note: detailNote || undefined,
    });
  };

  // ---- Guard ---------------------------------------------------------------

  if (!can(PERMISSIONS.VIEW_TEST_ORDER_ASSIGNMENTS)) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-gray-500">
          Vous n&apos;avez pas la permission de consulter les affectations.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-gray-500">Chargement...</p>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-gray-500">Affectation introuvable.</p>
      </div>
    );
  }

  // ---- Render --------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Affectation ${assignment.code}`}
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Affectations", href: "/test-orders/assignments" },
          { label: assignment.code },
        ]}
        action={
          <Link
            href="/test-orders/assignments"
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la liste des affectations
          </Link>
        }
      />

      {/* Form principal englobant tout (comme Laravel) */}
      <form onSubmit={handleSubmit(onSubmitUpdate)} className="space-y-6">

        {/* Section 1 : Informations affectation */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            Informations
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="userId"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Docteur <span className="text-red-500">*</span>
              </label>
              <select
                id="userId"
                {...register("userId", { required: true })}
                disabled={!canManage}
                className={inputClass}
              >
                <option value="">Sélectionner le docteur</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.firstname} {d.lastname}
                  </option>
                ))}
              </select>
              {errors.userId && (
                <p className="mt-1 text-xs text-red-600">
                  Le docteur est requis
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="date"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Date
              </label>
              <input
                id="date"
                type="date"
                {...register("date")}
                disabled={!canManage}
                className={inputClass}
              />
            </div>
          </div>

          <div className="mt-4">
            <label
              htmlFor="note"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Note
            </label>
            <textarea
              id="note"
              rows={5}
              {...register("note")}
              disabled={!canManage}
              className={inputClass}
            />
          </div>
        </div>

        {/* Section 2 : Liste des demandes d'examens affectées */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-3">
            <h5 className="font-medium text-gray-800">
              Liste des demandes d&apos;examens affectées
            </h5>
          </div>

          <div className="p-5">
            {/* Ajout détail — formulaire indépendant (pas submit) */}
            {canManage && (
              <div className="mb-6 grid grid-cols-1 items-end gap-3 md:grid-cols-12">
                <div className="md:col-span-6">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Code{" "}
                    <span className="text-xs uppercase text-gray-400">
                      [Demande d&apos;examen/Reférence]
                    </span>
                  </label>
                  <Select<OrderOption>
                    instanceId="assignment-test-order"
                    options={orderOptions}
                    value={selectedOrder}
                    onChange={(v: SingleValue<OrderOption>) =>
                      setSelectedOrder(v)
                    }
                    isClearable
                    placeholder="Sélectionner une demande d'examen"
                    noOptionsMessage={() => "Aucune demande disponible"}
                    className="text-sm"
                    classNamePrefix="react-select"
                  />
                </div>

                <div className="md:col-span-4">
                  <label
                    htmlFor="detail-note"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Note
                  </label>
                  <input
                    id="detail-note"
                    type="text"
                    value={detailNote}
                    onChange={(e) => setDetailNote(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddDetail}
                    disabled={addDetailMutation.isPending}
                    className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {addDetailMutation.isPending ? "Ajout..." : "Ajouter"}
                  </button>
                </div>
              </div>
            )}

            {/* Tableau des détails */}
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Demande d&apos;examen
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Note
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {details.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-sm text-gray-500"
                      >
                        Aucune demande d&apos;examen affectée
                      </td>
                    </tr>
                  ) : (
                    details.map((d, idx) => (
                      <tr
                        key={d.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 text-gray-700">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm font-medium text-gray-800">
                            {d.testOrderCode}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {d.note ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => setDetailToDelete(d)}
                              className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Supprimer
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Bouton Soumettre full-width vert (comme Laravel : btn w-100 btn-success) */}
            {canManage && (
              <div className="mt-4 border-t border-gray-200 pt-4">
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="inline-flex w-full items-center justify-center rounded-md bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {updateMutation.isPending ? "Enregistrement..." : "Soumettre"}
                </button>
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Modal de confirmation */}
      <ConfirmModal
        isOpen={!!detailToDelete}
        onClose={() => setDetailToDelete(null)}
        onConfirm={() =>
          detailToDelete && deleteDetailMutation.mutate(detailToDelete.id)
        }
        title="Supprimer cette affectation"
        message={
          detailToDelete
            ? `Voulez-vous vraiment retirer la demande "${detailToDelete.testOrderCode}" de cette affectation ?`
            : ""
        }
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteDetailMutation.isPending}
      />
    </div>
  );
}
