"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Save, ClipboardCheck, PenLine, Send, ArrowLeft, Clock, X, FileDown, FileText } from "lucide-react";
import Select from "react-select";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PermissionGate } from "@/components/common/PermissionGate";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { formatDate } from "@/lib/utils";
import { reportsApi, type ReportDetail, type StoreSignatureRequest } from "@/lib/api/reports";
import { usersApi } from "@/lib/api/users";
import { tagsApi } from "@/lib/api/tags";
import { reportTemplatesApi } from "@/lib/api/reportTemplates";
import { useAuthStore } from "@/stores/auth.store";
import type { ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const reportEditSchema = z.object({
  content: z.string().optional(),
  contentMicro: z.string().optional(),
  comment: z.string().optional(),
  commentSup: z.string().optional(),
  receiverName: z.string().optional(),
  signatory1Id: z.string().optional(),
  signatory2Id: z.string().optional(),
  signatory3Id: z.string().optional(),
  reviewedById: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
});

type ReportEditFormValues = z.infer<typeof reportEditSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500";

const textareaClass =
  "w-full min-h-[200px] p-3 border border-gray-300 rounded font-mono text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 resize-y";

// ---------------------------------------------------------------------------
// Timeline des logs
// ---------------------------------------------------------------------------

function LogTimeline({ logs }: { logs: ReportDetail["logs"] }) {
  if (!logs || logs.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">Aucune activité enregistrée.</p>
    );
  }

  return (
    <ol className="relative border-l border-gray-200 space-y-4 ml-3">
      {logs.map((log, idx) => (
        <li key={idx} className="ml-4">
          <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-blue-500" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-800">{log.action}</p>
              {log.description && (
                <p className="text-xs text-gray-500 mt-0.5">{log.description}</p>
              )}
              <p className="text-xs text-gray-400 mt-0.5">Par {log.userName}</p>
            </div>
            <span className="text-xs text-gray-400 whitespace-nowrap flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(log.createdAt)}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // --- Etats modaux deliver / storeSignature
  const [showDeliverModal, setShowDeliverModal] = useState(false);
  const [deliverReceiverName, setDeliverReceiverName] = useState("");

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatorName, setSignatorName] = useState("");

  // --- Query rapport
  const { data: report, isLoading } = useQuery<ReportDetail>({
    queryKey: ["report", id],
    queryFn: () => reportsApi.findById(id).then((r) => r.data),
    enabled: !!id,
  });

  // --- Utilisateurs (réviseur / signataires)
  const { data: usersData } = useQuery({
    queryKey: ["users-for-report"],
    queryFn: () => usersApi.findAll({ size: 200 }).then((r) => r.data.content),
    staleTime: 5 * 60_000,
  });
  const userOptions = (usersData ?? []).map((u) => ({
    value: u.id,
    label: `${u.firstname} ${u.lastname}`.trim(),
  }));

  // --- Tags
  const { data: tagsData } = useQuery({
    queryKey: ["tags"],
    queryFn: () => tagsApi.findAll().then((r) => r.data.content),
    staleTime: 5 * 60_000,
  });
  const tagOptions = (tagsData ?? []).map((t) => ({ value: t.id, label: t.name }));

  // --- Modèles de compte-rendu
  const { data: templatesData } = useQuery({
    queryKey: ["report-templates"],
    queryFn: () => reportTemplatesApi.findAll({ size: 200 }).then((r) => r.data.content),
    staleTime: 5 * 60_000,
  });
  const templateOptions = (templatesData ?? []).map((t) => ({ value: t.id, label: t.title ?? t.name }));
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // --- Formulaire
  const {
    register,
    handleSubmit,
    reset,
    control,
  } = useForm<ReportEditFormValues>({
    resolver: zodResolver(reportEditSchema),
    defaultValues: {
      content: "",
      contentMicro: "",
      comment: "",
      commentSup: "",
      receiverName: "",
      signatory1Id: "",
      signatory2Id: "",
      signatory3Id: "",
      reviewedById: "",
      tagIds: [],
    },
  });

  // Préremplir le formulaire quand le rapport est chargé
  useEffect(() => {
    if (report) {
      reset({
        content: report.content ?? "",
        contentMicro: report.contentMicro ?? "",
        comment: report.comment ?? "",
        commentSup: report.commentSup ?? "",
        receiverName: report.receiverName ?? "",
        signatory1Id: report.signatory1Id ?? "",
        signatory2Id: report.signatory2Id ?? "",
        signatory3Id: report.signatory3Id ?? "",
        reviewedById: report.reviewedById ?? "",
        tagIds: report.tagIds ?? [],
      });
    }
  }, [report, reset]);

  // --- Mutations

  const updateMutation = useMutation({
    mutationFn: (data: ReportEditFormValues) =>
      reportsApi.update(id, {
        content: data.content || undefined,
        contentMicro: data.contentMicro || undefined,
        comment: data.comment || undefined,
        commentSup: data.commentSup || undefined,
        receiverName: data.receiverName || undefined,
        signatory1Id: data.signatory1Id || undefined,
        signatory2Id: data.signatory2Id || undefined,
        signatory3Id: data.signatory3Id || undefined,
        reviewedById: data.reviewedById || undefined,
        tagIds: data.tagIds ?? [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report", id] });
      toast.success("Rapport sauvegardé");
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de la sauvegarde");
    },
  });

  const validateMutation = useMutation({
    mutationFn: () => reportsApi.validate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report", id] });
      toast.success("Rapport validé");
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de la validation");
    },
  });

  const storeSignatureMutation = useMutation({
    mutationFn: (data: StoreSignatureRequest) => reportsApi.storeSignature(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report", id] });
      setShowSignatureModal(false);
      setSignatorName("");
      toast.success("Signature enregistrée");
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de la signature");
    },
  });

  const deliverMutation = useMutation({
    mutationFn: (receiverName: string) => reportsApi.deliver(id, receiverName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report", id] });
      setShowDeliverModal(false);
      setDeliverReceiverName("");
      toast.success("Rapport livré");
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de la livraison");
    },
  });

  const setTemplateMutation = useMutation({
    mutationFn: (templateId: string) => reportsApi.setTemplate(id, templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report", id] });
      toast.success("Modèle associé au compte-rendu");
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de l'association du modèle");
    },
  });

  // ---------------------------------------------------------------------------
  // Guard de permission
  // ---------------------------------------------------------------------------

  if (!can(PERMISSIONS.VIEW_REPORTS)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Accès non autorisé</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Loading / not found
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-72 animate-pulse rounded bg-gray-200" />
        <div className="h-10 animate-pulse rounded-xl bg-gray-100" />
        <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
        <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-gray-500">Rapport introuvable.</p>
      </div>
    );
  }

  const isEditable = report.status === "DRAFT";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Compte rendu — ${report.testOrderCode ?? report.code ?? id}`}
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Comptes rendus", href: "/reports" },
          { label: report.testOrderCode ?? report.code ?? id },
        ]}
      />

      {/* ===================================================================
          Toolbar workflow
      =================================================================== */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
        {/* Retour */}
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>

        <div className="h-5 w-px bg-gray-200" />

        {/* Statut courant */}
        <StatusBadge status={report.status} domain="report" />

        <div className="ml-auto flex items-center gap-2">
          {/* Sauvegarder — DRAFT uniquement */}
          <PermissionGate permission={PERMISSIONS.EDIT_REPORTS}>
            {isEditable && (
              <button
                type="button"
                onClick={handleSubmit((data) => updateMutation.mutate(data))}
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? "Sauvegarde..." : "Sauvegarder"}
              </button>
            )}
          </PermissionGate>

          {/* Valider — DRAFT */}
          {report.status === "DRAFT" && can(PERMISSIONS.REVIEW_REPORTS) && (
            <button
              type="button"
              onClick={() => validateMutation.mutate()}
              disabled={validateMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-700 disabled:opacity-50"
            >
              <ClipboardCheck className="h-4 w-4" />
              {validateMutation.isPending ? "En cours..." : "Valider"}
            </button>
          )}

          {/* Signer — VALIDATED */}
          {report.status === "VALIDATED" && can(PERMISSIONS.SIGN_REPORTS) && (
            <button
              type="button"
              onClick={() => setShowSignatureModal(true)}
              disabled={storeSignatureMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
            >
              <PenLine className="h-4 w-4" />
              {storeSignatureMutation.isPending ? "Signature..." : "Signer"}
            </button>
          )}

          {/* Livrer — VALIDATED */}
          {report.status === "VALIDATED" && can(PERMISSIONS.DELIVER_REPORTS) && (
            <button
              type="button"
              onClick={() => setShowDeliverModal(true)}
              disabled={deliverMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {deliverMutation.isPending ? "Livraison..." : "Livrer"}
            </button>
          )}

          {/* Télécharger PDF */}
          <button
            type="button"
            onClick={async () => {
              try {
                const res = await reportsApi.downloadPdf(id);
                const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `rapport-${report.testOrderCode ?? id}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
              } catch {
                toast.error("Erreur lors du téléchargement du PDF");
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <FileDown className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      {/* ===================================================================
          Informations rapport
      =================================================================== */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-800">
          Informations
        </h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 text-sm">
          {report.patientName && (
            <div className="flex items-start gap-2">
              <dt className="w-36 flex-shrink-0 font-medium text-gray-500">Patient :</dt>
              <dd className="text-gray-800">{report.patientName}</dd>
            </div>
          )}
          <div className="flex items-start gap-2">
            <dt className="w-36 flex-shrink-0 font-medium text-gray-500">Code demande :</dt>
            <dd className="text-gray-800">{report.testOrderCode ?? "—"}</dd>
          </div>
          {report.titleName && (
            <div className="flex items-start gap-2">
              <dt className="w-36 flex-shrink-0 font-medium text-gray-500">Titre :</dt>
              <dd className="text-gray-800">{report.titleName}</dd>
            </div>
          )}
          {report.signatory1Name && (
            <div className="flex items-start gap-2">
              <dt className="w-36 flex-shrink-0 font-medium text-gray-500">Signataire 1 :</dt>
              <dd className="text-gray-800">{report.signatory1Name}</dd>
            </div>
          )}
          {report.signatory2Name && (
            <div className="flex items-start gap-2">
              <dt className="w-36 flex-shrink-0 font-medium text-gray-500">Signataire 2 :</dt>
              <dd className="text-gray-800">{report.signatory2Name}</dd>
            </div>
          )}
          {report.signatory3Name && (
            <div className="flex items-start gap-2">
              <dt className="w-36 flex-shrink-0 font-medium text-gray-500">Signataire 3 :</dt>
              <dd className="text-gray-800">{report.signatory3Name}</dd>
            </div>
          )}
          <div className="flex items-start gap-2">
            <dt className="w-36 flex-shrink-0 font-medium text-gray-500">Créé le :</dt>
            <dd className="text-gray-800">{formatDate(report.createdAt)}</dd>
          </div>
          {report.signatureDate && (
            <div className="flex items-start gap-2">
              <dt className="w-36 flex-shrink-0 font-medium text-gray-500">Signé le :</dt>
              <dd className="text-gray-800">{formatDate(report.signatureDate)}</dd>
            </div>
          )}
          {report.deliveryDate && (
            <div className="flex items-start gap-2">
              <dt className="w-36 flex-shrink-0 font-medium text-gray-500">Livré le :</dt>
              <dd className="text-gray-800">{formatDate(report.deliveryDate)}</dd>
            </div>
          )}
          {report.status === "DELIVERED" && (
            <>
              <div className="flex items-start gap-2">
                <dt className="w-36 flex-shrink-0 font-medium text-gray-500">Livré au patient :</dt>
                <dd className="text-gray-800">{report.isDelivered ? "Oui" : "Non"}</dd>
              </div>
              <div className="flex items-start gap-2">
                <dt className="w-36 flex-shrink-0 font-medium text-gray-500">Patient informé :</dt>
                <dd className="text-gray-800">{report.isCalled ? "Oui" : "Non"}</dd>
              </div>
              {report.receiverName && (
                <div className="flex items-start gap-2">
                  <dt className="w-36 flex-shrink-0 font-medium text-gray-500">Récepteur :</dt>
                  <dd className="text-gray-800">{report.receiverName}</dd>
                </div>
              )}
            </>
          )}
          {report.tagNames && report.tagNames.length > 0 && (
            <div className="flex items-start gap-2 sm:col-span-2">
              <dt className="w-36 flex-shrink-0 font-medium text-gray-500">Tags :</dt>
              <dd className="flex flex-wrap gap-1">
                {report.tagNames.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                  >
                    {tag}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* ===================================================================
          Formulaire édition
      =================================================================== */}
      <PermissionGate permission={PERMISSIONS.EDIT_REPORTS}>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
          <h2 className="text-base font-semibold text-gray-800">
            Contenu du rapport
          </h2>

          {!isEditable && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Le rapport ne peut être modifié qu&apos;au statut Brouillon.
            </p>
          )}

          {/* Description Macro */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Description Macro
            </label>
            <textarea
              {...register("content")}
              disabled={!isEditable}
              placeholder="Saisir la description macroscopique..."
              className={textareaClass}
            />
          </div>

          {/* Description Micro */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Description Micro
            </label>
            <textarea
              {...register("contentMicro")}
              disabled={!isEditable}
              placeholder="Saisir la description microscopique..."
              className={textareaClass}
            />
          </div>

          {/* Commentaire */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Commentaire
            </label>
            <textarea
              {...register("comment")}
              rows={4}
              disabled={!isEditable}
              placeholder="Commentaire..."
              className={textareaClass}
            />
          </div>

          {/* Commentaire supplémentaire */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Commentaire supplémentaire
            </label>
            <textarea
              {...register("commentSup")}
              rows={3}
              disabled={!isEditable}
              placeholder="Commentaire supplémentaire..."
              className={textareaClass}
            />
          </div>
        </div>
      </PermissionGate>

      {/* ===================================================================
          Signataires & Récepteur
      =================================================================== */}
      <PermissionGate permission={PERMISSIONS.EDIT_REPORTS}>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            Signataires &amp; Livraison
          </h2>
          <div className="grid grid-cols-1 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Signataire 1
              </label>
              <Controller
                name="signatory1Id"
                control={control}
                render={({ field }) => (
                  <Select
                    instanceId="report-signatory1"
                    options={userOptions}
                    value={userOptions.find((o) => o.value === field.value) ?? null}
                    onChange={(opt) => field.onChange(opt?.value ?? "")}
                    isDisabled={!isEditable}
                    isClearable
                    placeholder="Sélectionner un signataire..."
                    noOptionsMessage={() => "Aucun utilisateur"}
                    classNamePrefix="react-select"
                  />
                )}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Signataire 2
              </label>
              <Controller
                name="signatory2Id"
                control={control}
                render={({ field }) => (
                  <Select
                    instanceId="report-signatory2"
                    options={userOptions}
                    value={userOptions.find((o) => o.value === field.value) ?? null}
                    onChange={(opt) => field.onChange(opt?.value ?? "")}
                    isDisabled={!isEditable}
                    isClearable
                    placeholder="Sélectionner un signataire..."
                    noOptionsMessage={() => "Aucun utilisateur"}
                    classNamePrefix="react-select"
                  />
                )}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Signataire 3
              </label>
              <Controller
                name="signatory3Id"
                control={control}
                render={({ field }) => (
                  <Select
                    instanceId="report-signatory3"
                    options={userOptions}
                    value={userOptions.find((o) => o.value === field.value) ?? null}
                    onChange={(opt) => field.onChange(opt?.value ?? "")}
                    isDisabled={!isEditable}
                    isClearable
                    placeholder="Sélectionner un signataire..."
                    noOptionsMessage={() => "Aucun utilisateur"}
                    classNamePrefix="react-select"
                  />
                )}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Nom du récepteur
              </label>
              <input
                type="text"
                {...register("receiverName")}
                disabled={!isEditable}
                placeholder="Nom de la personne qui reçoit..."
                className={inputClass}
              />
            </div>

            {/* Réviseur / relecteur */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Réviseur (relecteur)
              </label>
              <Controller
                name="reviewedById"
                control={control}
                render={({ field }) => (
                  <Select
                    instanceId="report-reviewer"
                    options={userOptions}
                    value={userOptions.find((o) => o.value === field.value) ?? null}
                    onChange={(opt) => field.onChange(opt?.value ?? "")}
                    isDisabled={!isEditable}
                    isClearable
                    placeholder="Assigner un relecteur..."
                    noOptionsMessage={() => "Aucun utilisateur"}
                    classNamePrefix="react-select"
                  />
                )}
              />
            </div>
          </div>

          {/* Tags */}
          <div className="mt-4 flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Tags</label>
            <Controller
              name="tagIds"
              control={control}
              render={({ field }) => (
                <Select
                  instanceId="report-tags"
                  isMulti
                  options={tagOptions}
                  value={tagOptions.filter((o) => (field.value ?? []).includes(o.value))}
                  onChange={(opts) => field.onChange(opts.map((o) => o.value))}
                  isDisabled={!isEditable}
                  placeholder="Sélectionner des tags..."
                  noOptionsMessage={() => "Aucun tag"}
                  classNamePrefix="react-select"
                />
              )}
            />
          </div>
        </div>
      </PermissionGate>

      {/* ===================================================================
          Modèle (template) du compte-rendu
      =================================================================== */}
      <PermissionGate permission={PERMISSIONS.EDIT_REPORTS}>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-800">
            <FileText className="h-4 w-4" />
            Modèle d&apos;impression
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Modèle à associer
              </label>
              <Select
                instanceId="report-template"
                options={templateOptions}
                value={templateOptions.find((o) => o.value === selectedTemplateId) ?? null}
                onChange={(opt) => setSelectedTemplateId(opt?.value ?? "")}
                placeholder="Sélectionner un modèle..."
                noOptionsMessage={() => "Aucun modèle"}
                classNamePrefix="react-select"
              />
            </div>
            <button
              type="button"
              onClick={() => selectedTemplateId && setTemplateMutation.mutate(selectedTemplateId)}
              disabled={!selectedTemplateId || setTemplateMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              Appliquer
            </button>
          </div>
        </div>
      </PermissionGate>

      {/* Bouton de sauvegarde bas de page */}
      <PermissionGate permission={PERMISSIONS.EDIT_REPORTS}>
        {isEditable && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmit((data) => updateMutation.mutate(data))}
              disabled={updateMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {updateMutation.isPending ? "Sauvegarde..." : "Sauvegarder les modifications"}
            </button>
          </div>
        )}
      </PermissionGate>

      {/* ===================================================================
          Historique (logs)
      =================================================================== */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-800">
          Historique
        </h2>
        <LogTimeline logs={report.logs ?? []} />
      </div>

      {/* ===================================================================
          Modal — Livrer
      =================================================================== */}
      {showDeliverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-800">Livrer le rapport</h3>
              <button
                type="button"
                onClick={() => { setShowDeliverModal(false); setDeliverReceiverName(""); }}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-1 mb-5">
              <label className="text-sm font-medium text-gray-700">
                Nom du récepteur <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={deliverReceiverName}
                onChange={(e) => setDeliverReceiverName(e.target.value)}
                placeholder="Nom de la personne qui récupère le rapport..."
                className={inputClass}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowDeliverModal(false); setDeliverReceiverName(""); }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!deliverReceiverName.trim()) {
                    toast.error("Le nom du récepteur est obligatoire");
                    return;
                  }
                  deliverMutation.mutate(deliverReceiverName.trim());
                }}
                disabled={deliverMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {deliverMutation.isPending ? "Livraison..." : "Confirmer la livraison"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          Modal — Signature
      =================================================================== */}
      {showSignatureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-800">Enregistrer la signature</h3>
              <button
                type="button"
                onClick={() => { setShowSignatureModal(false); setSignatorName(""); }}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-1 mb-5">
              <label className="text-sm font-medium text-gray-700">
                Nom du signataire <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={signatorName}
                onChange={(e) => setSignatorName(e.target.value)}
                placeholder="Nom complet du signataire..."
                className={inputClass}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowSignatureModal(false); setSignatorName(""); }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  const name = signatorName.trim() || (user ? `${user.firstname} ${user.lastname}` : "");
                  if (!name) {
                    toast.error("Le nom du signataire est obligatoire");
                    return;
                  }
                  const signature = user?.signature ?? name;
                  storeSignatureMutation.mutate({ signatorName: name, signature });
                }}
                disabled={storeSignatureMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                <PenLine className="h-4 w-4" />
                {storeSignatureMutation.isPending ? "Signature..." : "Confirmer la signature"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
