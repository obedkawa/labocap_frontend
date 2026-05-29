"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, Receipt, FileText, Upload, X } from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { FormField } from "@/components/ui/FormField";
import { PermissionGate } from "@/components/common/PermissionGate";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { usersApi, SettingsData } from "@/lib/api/users";
import { Sliders } from "lucide-react";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const settingsSchema = z.object({
  // Labo
  labName: z.string().optional(),
  labAddress: z.string().optional(),
  labPhone: z.string().optional(),
  labEmail: z.string().email("Email invalide").optional().or(z.literal("")),
  // Facturation
  invoicePrefix: z.string().optional(),
  taxRate: z.string().optional(),
  mecefIfu: z.string().optional(),
  mecefNimf: z.string().optional(),
  // Rapports
  reportFooter: z.string().optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500";

type ActiveSection = "labo" | "facturation" | "rapports" | "avance";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<ActiveSection>("labo");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // ---- Avancé state -------------------------------------------------------
  const [ourvoiceKey, setOurvoiceKey] = useState("");
  const [ourvoiceCallLink, setOurvoiceCallLink] = useState("");
  const [ourvoiceSmsLink, setOurvoiceSmsLink] = useState("");
  const [entete, setEntete] = useState("");
  const [tokenPayment, setTokenPayment] = useState("");

  const canManage = can(PERMISSIONS.MANAGE_SETTINGS);

  // ---- Queries -------------------------------------------------------------

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => usersApi.getSettings().then((r) => r.data),
  });

  useQuery({
    queryKey: ["setting-apps"],
    queryFn: async () => {
      const apps = await usersApi.getSettingApps();
      setOurvoiceKey(apps["api_key_ourvoice"] ?? "");
      setOurvoiceCallLink(apps["link_ourvoice_call"] ?? "");
      setOurvoiceSmsLink(apps["link_ourvoice_sms"] ?? "");
      setEntete(apps["entete"] ?? "");
      return apps;
    },
    enabled: activeSection === "avance",
  });

  useQuery({
    queryKey: ["setting-token-payment"],
    queryFn: async () => {
      const v = await usersApi.getTokenPayment();
      setTokenPayment(v ?? "");
      return v;
    },
    enabled: activeSection === "avance",
  });

  // ---- Form ----------------------------------------------------------------

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      labName: "",
      labAddress: "",
      labPhone: "",
      labEmail: "",
      invoicePrefix: "",
      taxRate: "",
      mecefIfu: "",
      mecefNimf: "",
      reportFooter: "",
    },
  });

  // Pré-remplir le formulaire quand les données sont chargées
  useEffect(() => {
    if (settingsData) {
      reset({
        labName: settingsData.labName ?? "",
        labAddress: settingsData.labAddress ?? "",
        labPhone: settingsData.labPhone ?? "",
        labEmail: settingsData.labEmail ?? "",
        invoicePrefix: settingsData.invoicePrefix ?? "",
        taxRate: settingsData.taxRate ?? "",
        mecefIfu: settingsData.mecefIfu ?? "",
        mecefNimf: settingsData.mecefNimf ?? "",
        reportFooter: settingsData.reportFooter ?? "",
      });
      if (settingsData.labLogo) {
        setLogoPreview(settingsData.labLogo);
      }
    }
  }, [settingsData, reset]);

  // ---- Mutation ------------------------------------------------------------

  const updateMutation = useMutation({
    mutationFn: (payload: SettingsData) => usersApi.updateSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Paramètres sauvegardés");
    },
    onError: () => {
      toast.error("Une erreur est survenue lors de la sauvegarde");
    },
  });

  // ---- Handlers ------------------------------------------------------------

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function clearLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    if (logoInputRef.current) logoInputRef.current.value = "";
  }

  function onSubmit(values: SettingsFormValues) {
    const payload: SettingsData = {
      labName: values.labName || undefined,
      labAddress: values.labAddress || undefined,
      labPhone: values.labPhone || undefined,
      labEmail: values.labEmail || undefined,
      invoicePrefix: values.invoicePrefix || undefined,
      taxRate: values.taxRate || undefined,
      mecefIfu: values.mecefIfu || undefined,
      mecefNimf: values.mecefNimf || undefined,
      reportFooter: values.reportFooter || undefined,
    };
    updateMutation.mutate(payload);
  }

  // ---- Nav sections --------------------------------------------------------

  const sections: { key: ActiveSection; label: string; icon: React.ReactNode; permission?: string }[] = [
    {
      key: "labo",
      label: "Labo",
      icon: <Building2 className="h-4 w-4" />,
      permission: PERMISSIONS.VIEW_SETTINGS,
    },
    {
      key: "facturation",
      label: "Facturation",
      icon: <Receipt className="h-4 w-4" />,
      permission: PERMISSIONS.VIEW_SETTING_INVOICE,
    },
    {
      key: "rapports",
      label: "Rapports",
      icon: <FileText className="h-4 w-4" />,
      permission: PERMISSIONS.VIEW_SETTING_REPORT_TEMPLATES,
    },
    {
      key: "avance",
      label: "Avancé",
      icon: <Sliders className="h-4 w-4" />,
      permission: PERMISSIONS.MANAGE_SETTINGS,
    },
  ];

  // ---- Render --------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Paramètres" />
        <div className="flex items-center justify-center py-20">
          <svg className="h-6 w-6 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Paramètres" />

      <div className="flex gap-6">
        {/* Sidebar navigation */}
        <nav className="w-48 flex-shrink-0">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {sections.map((section) => (
              <button
                key={section.key}
                onClick={() => setActiveSection(section.key)}
                className={`w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition-colors text-left border-b border-gray-100 last:border-0 ${
                  activeSection === section.key
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {section.icon}
                {section.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Main content */}
        <div className="flex-1">
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Section Labo */}
            {activeSection === "labo" && (
              <PermissionGate permission={PERMISSIONS.VIEW_SETTINGS}>
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-200 px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-gray-500" />
                      <h2 className="text-base font-semibold text-gray-900">
                        Informations du laboratoire
                      </h2>
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500">
                      Informations générales affichées sur les documents imprimés.
                    </p>
                  </div>

                  <div className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      label="Nom du laboratoire"
                      error={errors.labName?.message}
                      className="sm:col-span-2"
                    >
                      <input
                        type="text"
                        {...register("labName")}
                        placeholder="Ex : Labo Anapath Bénin"
                        className={inputClass}
                        disabled={!canManage}
                      />
                    </FormField>

                    <FormField label="Adresse" error={errors.labAddress?.message} className="sm:col-span-2">
                      <input
                        type="text"
                        {...register("labAddress")}
                        placeholder="Adresse du laboratoire"
                        className={inputClass}
                        disabled={!canManage}
                      />
                    </FormField>

                    <FormField label="Téléphone" error={errors.labPhone?.message}>
                      <input
                        type="tel"
                        {...register("labPhone")}
                        placeholder="97000000"
                        className={inputClass}
                        disabled={!canManage}
                      />
                    </FormField>

                    <FormField label="Email" error={errors.labEmail?.message}>
                      <input
                        type="email"
                        {...register("labEmail")}
                        placeholder="contact@laboratoire.bj"
                        className={inputClass}
                        disabled={!canManage}
                      />
                    </FormField>

                    {/* Logo upload */}
                    <FormField label="Logo" className="sm:col-span-2">
                      <div className="flex items-start gap-4">
                        {logoPreview ? (
                          <div className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={logoPreview}
                              alt="Logo laboratoire"
                              className="h-20 w-20 rounded-lg object-contain border border-gray-200"
                            />
                            {canManage && (
                              <button
                                type="button"
                                onClick={clearLogo}
                                className="absolute -top-2 -right-2 rounded-full bg-red-100 p-0.5 text-red-600 hover:bg-red-200 transition-colors"
                                aria-label="Supprimer le logo"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
                            <Building2 className="h-8 w-8 text-gray-300" />
                          </div>
                        )}
                        {canManage && (
                          <div className="flex-1">
                            <input
                              ref={logoInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleLogoChange}
                              className="hidden"
                              id="logo-upload"
                            />
                            <label
                              htmlFor="logo-upload"
                              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <Upload className="h-4 w-4" />
                              {logoFile ? logoFile.name : "Choisir un fichier"}
                            </label>
                            <p className="mt-1 text-xs text-gray-500">
                              PNG, JPG, SVG — max 3 Mo
                            </p>
                          </div>
                        )}
                      </div>
                    </FormField>
                  </div>
                </div>
              </PermissionGate>
            )}

            {/* Section Facturation */}
            {activeSection === "facturation" && (
              <PermissionGate permission={PERMISSIONS.VIEW_SETTING_INVOICE}>
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-200 px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-5 w-5 text-gray-500" />
                      <h2 className="text-base font-semibold text-gray-900">
                        Paramètres de facturation
                      </h2>
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500">
                      Numérotation des factures et conformité fiscale (MECeF).
                    </p>
                  </div>

                  <div className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      label="Préfixe numéro de facture"
                      error={errors.invoicePrefix?.message}
                      hint="Ex : FAC- → FAC-0001"
                    >
                      <input
                        type="text"
                        {...register("invoicePrefix")}
                        placeholder="FAC-"
                        className={inputClass}
                        disabled={!canManage}
                      />
                    </FormField>

                    <FormField
                      label="TVA (%)"
                      error={errors.taxRate?.message}
                    >
                      <input
                        type="number"
                        {...register("taxRate")}
                        placeholder="18"
                        min={0}
                        max={100}
                        step={0.01}
                        className={inputClass}
                        disabled={!canManage}
                      />
                    </FormField>

                    <div className="sm:col-span-2">
                      <p className="mb-3 text-sm font-medium text-gray-700">
                        Paramètres MECeF
                      </p>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                          label="IFU (Identifiant Fiscal Unique)"
                          error={errors.mecefIfu?.message}
                        >
                          <input
                            type="text"
                            {...register("mecefIfu")}
                            placeholder="Ex : 1234567890123"
                            className={inputClass}
                            disabled={!canManage}
                          />
                        </FormField>

                        <FormField
                          label="NIMF (Numéro d'Identification MECeF Fiscal)"
                          error={errors.mecefNimf?.message}
                        >
                          <input
                            type="text"
                            {...register("mecefNimf")}
                            placeholder="Ex : A1234"
                            className={inputClass}
                            disabled={!canManage}
                          />
                        </FormField>
                      </div>
                    </div>
                  </div>
                </div>
              </PermissionGate>
            )}

            {/* Section Rapports */}
            {activeSection === "rapports" && (
              <PermissionGate permission={PERMISSIONS.VIEW_SETTING_REPORT_TEMPLATES}>
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-200 px-6 py-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-gray-500" />
                      <h2 className="text-base font-semibold text-gray-900">
                        Paramètres des rapports
                      </h2>
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500">
                      Pied de page et modèles de compte rendu anatomopathologique.
                    </p>
                  </div>

                  <div className="p-6 space-y-4">
                    <FormField
                      label="Pied de page des rapports"
                      error={errors.reportFooter?.message}
                      hint="Affiché en bas de chaque compte rendu imprimé."
                    >
                      <textarea
                        {...register("reportFooter")}
                        rows={5}
                        placeholder="Ex : Ce rapport est confidentiel et destiné exclusivement au médecin prescripteur."
                        className={inputClass + " resize-none"}
                        disabled={!canManage}
                      />
                    </FormField>

                    {/* Modèles de rapport — section informative */}
                    <div>
                      <p className="mb-3 text-sm font-medium text-gray-700">
                        Modèles de rapport
                      </p>
                      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                        <FileText className="mx-auto h-10 w-10 text-gray-300" />
                        <p className="mt-2 text-sm text-gray-500">
                          La gestion des modèles de rapport est disponible depuis la section{" "}
                          <strong>Comptes Rendus</strong>.
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          Vous pouvez y définir les titres par défaut et les mises en page des rapports.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </PermissionGate>
            )}

            {/* Bouton Sauvegarder */}
            {canManage && activeSection !== "avance" && (
              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={updateMutation.isPending || (!isDirty && !logoFile)}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {updateMutation.isPending && (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                  Sauvegarder
                </button>
              </div>
            )}
          </form>

          {/* Section Avancé — gestion indépendante par champ */}
          {activeSection === "avance" && (
            <PermissionGate permission={PERMISSIONS.MANAGE_SETTINGS}>
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-5 w-5 text-gray-500" />
                    <h2 className="text-base font-semibold text-gray-900">Paramètres avancés</h2>
                  </div>
                  <p className="mt-0.5 text-sm text-gray-500">
                    Intégrations tierces et configuration PDF.
                  </p>
                </div>
                <div className="p-6 space-y-6">

                  {/* OurVoice */}
                  <div>
                    <p className="mb-3 text-sm font-semibold text-gray-700">OurVoice (notifications vocales & SMS)</p>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                      <AdvancedField
                        label="Clé API OurVoice"
                        value={ourvoiceKey}
                        onChange={setOurvoiceKey}
                        onSave={() => usersApi.upsertSettingApp("api_key_ourvoice", ourvoiceKey).then(() => toast.success("Sauvegardé"))}
                        placeholder="sk-xxxxxxxxxxxxxxxx"
                        type="password"
                      />
                      <AdvancedField
                        label="Endpoint appel vocal"
                        value={ourvoiceCallLink}
                        onChange={setOurvoiceCallLink}
                        onSave={() => usersApi.upsertSettingApp("link_ourvoice_call", ourvoiceCallLink).then(() => toast.success("Sauvegardé"))}
                        placeholder="https://api.ourvoice.io/v1/call"
                      />
                      <AdvancedField
                        label="Endpoint SMS"
                        value={ourvoiceSmsLink}
                        onChange={setOurvoiceSmsLink}
                        onSave={() => usersApi.upsertSettingApp("link_ourvoice_sms", ourvoiceSmsLink).then(() => toast.success("Sauvegardé"))}
                        placeholder="https://api.ourvoice.io/v1/sms"
                      />
                    </div>
                  </div>

                  {/* MECeF token */}
                  <div>
                    <p className="mb-3 text-sm font-semibold text-gray-700">MECeF — Token de paiement</p>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <AdvancedField
                        label="Token de paiement MECeF"
                        value={tokenPayment}
                        onChange={setTokenPayment}
                        onSave={() => usersApi.setTokenPayment(tokenPayment).then(() => toast.success("Sauvegardé"))}
                        placeholder="token_xxxxxxxxxxxxx"
                        type="password"
                      />
                    </div>
                  </div>

                  {/* Entête PDF */}
                  <div>
                    <p className="mb-3 text-sm font-semibold text-gray-700">Entête PDF des rapports</p>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-700">Texte de l'entête</label>
                        <textarea
                          value={entete}
                          onChange={(e) => setEntete(e.target.value)}
                          rows={4}
                          placeholder="Entête affiché en haut de chaque rapport PDF…"
                          className={inputClass + " resize-none"}
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => usersApi.upsertSettingApp("entete", entete).then(() => toast.success("Entête sauvegardée"))}
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                        >
                          Sauvegarder l'entête
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </PermissionGate>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdvancedField — champ avec bouton Sauvegarder inline
// ---------------------------------------------------------------------------

function AdvancedField({
  label,
  value,
  onChange,
  onSave,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  placeholder?: string;
  type?: "text" | "password";
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="flex gap-2">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={onSave}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          OK
        </button>
      </div>
    </div>
  );
}
