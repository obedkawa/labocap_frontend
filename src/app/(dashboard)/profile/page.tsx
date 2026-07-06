"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Camera } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { useAuthStore } from "@/stores/auth.store";
import apiClient from "@/lib/api/client";
import { FormField } from "@/components/ui/FormField";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils";

// ── Schemas Zod ──────────────────────────────────────────────────────────────

const profileSchema = z.object({
  firstname: z.string().min(1, "Le prénom est requis"),
  lastname: z.string().min(1, "Le nom est requis"),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "L'ancien mot de passe est requis"),
    newPassword: z
      .string()
      .min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères"),
    newPasswordConfirmation: z.string().min(1, "La confirmation est requise"),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirmation, {
    message: "Les mots de passe ne correspondent pas",
    path: ["newPasswordConfirmation"],
  });

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(firstname: string, lastname: string): string {
  return `${firstname.charAt(0)}${lastname.charAt(0)}`.toUpperCase();
}

// ── Composant principal ────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();

  // State fichier signature
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(
    user?.signature ?? null
  );

  // Visibilité mots de passe
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  // ── Formulaire profil ───────────────────────────────────────────────────────
  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileErrors, isSubmitting: isProfileSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstname: user?.firstname ?? "",
      lastname: user?.lastname ?? "",
    },
  });

  const onSubmitProfile = async (values: ProfileFormValues) => {
    if (!user) return;
    try {
      // Construire le body JSON (le backend accepte uniquement @RequestBody)
      // IMPORTANT : inclure roleIds. Le UserServiceImpl.update remplace les rôles
      // dès que `roleIds != null` (le DTO l'initialise à []), donc un PUT sans
      // roleIds VIDE les rôles — et donc les permissions — de l'utilisateur courant.
      const body: Record<string, unknown> = {
        firstname: values.firstname,
        lastname: values.lastname,
        email: user.email,
        roleIds: (user.roles ?? []).map((r) => r.id),
      };

      // Convertir la signature (File) en base64 si elle a été changée
      if (signatureFile) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(signatureFile);
        });
        body.signature = base64;
      }

      const response = await apiClient.put(`/users/${user.id}`, body);

      setUser(response.data.data ?? response.data);
      toast.success("Profil mis à jour avec succès");
    } catch {
      toast.error("Erreur lors de la mise à jour du profil");
    }
  };

  // ── Formulaire mot de passe ─────────────────────────────────────────────────
  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    reset: resetPassword,
    formState: { errors: passwordErrors, isSubmitting: isPasswordSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      newPasswordConfirmation: "",
    },
  });

  const onSubmitPassword = async (values: PasswordFormValues) => {
    if (!user) return;
    try {
      await apiClient.patch(`/users/${user.id}/password`, {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      resetPassword();
      toast.success("Mot de passe changé avec succès");
    } catch {
      toast.error("Erreur lors du changement de mot de passe");
    }
  };

  // ── Gestion fichier signature ───────────────────────────────────────────────
  const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSignatureFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setSignaturePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  if (!user) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        Chargement du profil…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mon profil"
        subtitle="Gérez vos informations personnelles et votre mot de passe"
        breadcrumbs={[{ label: "Accueil", href: "/home" }, { label: "Profil" }]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Colonne principale (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Section 1 — Informations personnelles */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-base font-semibold text-gray-900">
              Informations personnelles
            </h2>

            <form onSubmit={handleSubmitProfile(onSubmitProfile)} noValidate>
              <div className="grid grid-cols-1 gap-4">
                {/* Prénom */}
                <FormField
                  label="Prénom"
                  required
                  error={profileErrors.firstname?.message}
                >
                  <input
                    {...registerProfile("firstname")}
                    type="text"
                    autoComplete="given-name"
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-1",
                      profileErrors.firstname
                        ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                        : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    )}
                    placeholder="Votre prénom"
                  />
                </FormField>

                {/* Nom */}
                <FormField
                  label="Nom"
                  required
                  error={profileErrors.lastname?.message}
                >
                  <input
                    {...registerProfile("lastname")}
                    type="text"
                    autoComplete="family-name"
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-1",
                      profileErrors.lastname
                        ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                        : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    )}
                    placeholder="Votre nom"
                  />
                </FormField>
              </div>

              {/* Adresse e-mail (readonly) */}
              <div className="mt-4">
                <FormField label="Adresse e-mail">
                  <input
                    type="email"
                    value={user.email}
                    readOnly
                    disabled
                    autoComplete="email"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                  />
                </FormField>
              </div>

              {/* Signature */}
              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Signature
                </label>
                {signaturePreview && (
                  <div className="mb-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="mb-1.5 text-xs text-gray-500">
                      Aperçu de la signature :
                    </p>
                    <Image
                      src={signaturePreview}
                      alt="Signature"
                      width={300}
                      height={80}
                      className="max-h-20 object-contain"
                      unoptimized
                    />
                  </div>
                )}
                <label
                  htmlFor="signature-upload"
                  className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 p-4 transition-colors hover:border-blue-400 hover:bg-blue-50"
                >
                  <Camera className="h-5 w-5 flex-shrink-0 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {signatureFile
                      ? signatureFile.name
                      : "Cliquer pour changer la signature (PNG, JPG)"}
                  </span>
                  <input
                    id="signature-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={handleSignatureChange}
                    className="sr-only"
                  />
                </label>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={isProfileSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isProfileSubmitting && (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
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

          {/* Section 2 — Changer le mot de passe */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-base font-semibold text-gray-900">
              Changer le mot de passe
            </h2>

            <form onSubmit={handleSubmitPassword(onSubmitPassword)} noValidate>
              <div className="space-y-4">
                {/* Ancien mot de passe */}
                <FormField
                  label="Ancien mot de passe"
                  required
                  error={passwordErrors.currentPassword?.message}
                >
                  <div className="relative">
                    <input
                      {...registerPassword("currentPassword")}
                      type={showCurrentPwd ? "text" : "password"}
                      autoComplete="current-password"
                      className={cn(
                        "w-full rounded-lg border px-3 py-2 pr-10 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-1",
                        passwordErrors.currentPassword
                          ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      )}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowCurrentPwd((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={
                        showCurrentPwd
                          ? "Masquer le mot de passe"
                          : "Afficher le mot de passe"
                      }
                    >
                      {showCurrentPwd ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </FormField>

                {/* Nouveau mot de passe */}
                <FormField
                  label="Nouveau mot de passe"
                  required
                  error={passwordErrors.newPassword?.message}
                  hint="Au moins 8 caractères"
                >
                  <div className="relative">
                    <input
                      {...registerPassword("newPassword")}
                      type={showNewPwd ? "text" : "password"}
                      autoComplete="new-password"
                      className={cn(
                        "w-full rounded-lg border px-3 py-2 pr-10 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-1",
                        passwordErrors.newPassword
                          ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      )}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowNewPwd((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={
                        showNewPwd
                          ? "Masquer le mot de passe"
                          : "Afficher le mot de passe"
                      }
                    >
                      {showNewPwd ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </FormField>

                {/* Confirmation */}
                <FormField
                  label="Confirmer le mot de passe"
                  required
                  error={passwordErrors.newPasswordConfirmation?.message}
                >
                  <div className="relative">
                    <input
                      {...registerPassword("newPasswordConfirmation")}
                      type={showConfirmPwd ? "text" : "password"}
                      autoComplete="new-password"
                      className={cn(
                        "w-full rounded-lg border px-3 py-2 pr-10 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-1",
                        passwordErrors.newPasswordConfirmation
                          ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      )}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowConfirmPwd((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={
                        showConfirmPwd
                          ? "Masquer le mot de passe"
                          : "Afficher le mot de passe"
                      }
                    >
                      {showConfirmPwd ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </FormField>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={isPasswordSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPasswordSubmitting && (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
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
                  Changer le mot de passe
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Colonne droite (1/3) — Card profil */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            {/* Avatar */}
            <div className="flex flex-col items-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white shadow-md">
                {getInitials(user.firstname, user.lastname)}
              </div>
              <h3 className="mt-3 text-center text-base font-semibold text-gray-900">
                {user.firstname} {user.lastname}
              </h3>
              <p className="mt-0.5 text-center text-sm text-gray-500">
                {user.email}
              </p>
            </div>

            {/* Rôles */}
            {user.roles && user.roles.length > 0 && (
              <div className="mt-5 border-t border-gray-100 pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                  Rôles
                </p>
                <div className="flex flex-wrap gap-2">
                  {user.roles.map((role) => (
                    <Badge key={role.id} variant="info">
                      {role.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
