"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { useAuthStore } from "@/stores/auth.store";
import { meApi } from "@/lib/api/me";
import { FormField } from "@/components/ui/FormField";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils";

// ── Schemas Zod ──────────────────────────────────────────────────────────────

const profileSchema = z.object({
  firstname: z.string().min(1, "Le prénom est requis"),
  lastname: z.string().min(1, "Le nom est requis"),
});

const emailSchema = z.object({
  newEmail: z.string().min(1, "L'adresse e-mail est requise").email("L'adresse e-mail est invalide"),
  currentPassword: z.string().min(1, "Le mot de passe actuel est requis"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type EmailFormValues = z.infer<typeof emailSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(firstname: string, lastname: string): string {
  return `${firstname.charAt(0)}${lastname.charAt(0)}`.toUpperCase();
}

/** Remonte le message d'erreur du backend (mot de passe faux, e-mail déjà pris…). */
function apiMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string } } })?.response
    ?.data?.message;
  return message ?? fallback;
}

// ── Composant principal ────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();

  // State fichier signature
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(
    user?.signature ?? null
  );

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
      // `/users/me` ne touche ni aux rôles ni à l'e-mail : plus besoin de renvoyer
      // roleIds pour éviter que le backend ne les efface.
      const body: Parameters<typeof meApi.updateProfile>[0] = {
        firstname: values.firstname,
        lastname: values.lastname,
      };

      // Signature envoyée uniquement si un nouveau fichier a été choisi.
      if (signatureFile) {
        body.signature = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(signatureFile);
        });
      }

      const response = await meApi.updateProfile(body);
      setUser(response.data);
      toast.success("Profil mis à jour avec succès");
    } catch (err) {
      toast.error(apiMessage(err, "Erreur lors de la mise à jour du profil"));
    }
  };

  // ── Formulaire e-mail de connexion ──────────────────────────────────────────
  const {
    register: registerEmail,
    handleSubmit: handleSubmitEmail,
    reset: resetEmail,
    formState: { errors: emailErrors, isSubmitting: isEmailSubmitting },
  } = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { newEmail: user?.email ?? "", currentPassword: "" },
  });

  const [showEmailPwd, setShowEmailPwd] = useState(false);

  const onSubmitEmail = async (values: EmailFormValues) => {
    if (!user) return;
    if (values.newEmail.trim().toLowerCase() === user.email.toLowerCase()) {
      toast.error("Cette adresse est déjà votre adresse de connexion.");
      return;
    }
    try {
      const response = await meApi.updateEmail({
        newEmail: values.newEmail.trim(),
        currentPassword: values.currentPassword,
      });
      setUser(response.data);
      resetEmail({ newEmail: response.data.email, currentPassword: "" });
      toast.success("Adresse e-mail de connexion mise à jour");
    } catch (err) {
      toast.error(apiMessage(err, "Erreur lors du changement d'adresse e-mail"));
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
        subtitle="Gérez vos informations personnelles et votre adresse de connexion"
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
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Mettre à jour
                </button>
              </div>
            </form>
          </div>

          {/* Section 2 — Adresse e-mail de connexion (identifiant) */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-base font-semibold text-gray-900">
              Adresse e-mail de connexion
            </h2>
            <p className="mb-5 text-sm text-gray-500">
              C&apos;est l&apos;identifiant avec lequel vous vous connectez. Votre
              mot de passe actuel est requis pour le modifier.
            </p>

            <form onSubmit={handleSubmitEmail(onSubmitEmail)} noValidate>
              <div className="space-y-4">
                <FormField
                  label="Nouvelle adresse e-mail"
                  required
                  error={emailErrors.newEmail?.message}
                >
                  <input
                    {...registerEmail("newEmail")}
                    type="email"
                    autoComplete="email"
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-1",
                      emailErrors.newEmail
                        ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                        : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    )}
                    placeholder="nouvelle@adresse.com"
                  />
                </FormField>

                <FormField
                  label="Mot de passe actuel"
                  required
                  error={emailErrors.currentPassword?.message}
                >
                  <div className="relative">
                    <input
                      {...registerEmail("currentPassword")}
                      type={showEmailPwd ? "text" : "password"}
                      autoComplete="current-password"
                      className={cn(
                        "w-full rounded-lg border px-3 py-2 pr-10 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-1",
                        emailErrors.currentPassword
                          ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      )}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowEmailPwd((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={
                        showEmailPwd
                          ? "Masquer le mot de passe"
                          : "Afficher le mot de passe"
                      }
                    >
                      {showEmailPwd ? (
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
                  disabled={isEmailSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isEmailSubmitting && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Changer l&apos;adresse e-mail
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
