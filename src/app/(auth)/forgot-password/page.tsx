"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { authApi } from "@/lib/api/auth";

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "L'adresse e-mail est requise")
    .email("Format d'e-mail invalide"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      await authApi.forgotPassword({ email: data.email });
      toast.success(
        "Un e-mail contenant les instructions de réinitialisation a été envoyé."
      );
      reset();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Une erreur est survenue. Veuillez réessayer.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Header avec logo */}
          <div className="bg-gray-50 px-8 py-6 text-center border-b">
            <a href="/">
              <img
                src="/logo.png"
                alt="Logo"
                className="h-12 mx-auto"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const fallback = document.getElementById(
                    "logo-fallback-forgot"
                  );
                  if (fallback) fallback.style.display = "block";
                }}
              />
              <span
                id="logo-fallback-forgot"
                className="text-xl font-bold text-gray-800 hidden"
              >
                Labo AnaPath
              </span>
            </a>
          </div>

          {/* Body */}
          <div className="px-8 py-8">
            <h4 className="text-2xl font-bold text-gray-800 mb-2">
              Mot de passe oublié
            </h4>
            <p className="text-gray-500 mb-6 text-sm">
              Merci de renseigner votre adresse e-mail. Vous recevrez un e-mail
              contenant les instructions vous permettant de réinitialiser votre
              mot de passe.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              {/* Email */}
              <div className="mb-6">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Adresse e-mail
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="Entrez votre email"
                  {...register("email")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Bouton submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white w-full py-2 rounded font-medium text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading
                  ? "Envoi en cours..."
                  : "Réinitialiser le mot de passe"}
              </button>

              {/* Lien retour */}
              <p className="text-center mt-4 text-sm text-gray-500">
                Revenir en arrière ?{" "}
                <a
                  href="/login"
                  className="text-blue-600 font-semibold hover:underline"
                >
                  Connexion
                </a>
              </p>
            </form>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center mt-4 text-sm text-gray-500">
          <a
            href="mailto:serviceskawa@gmail.com?subject=Support"
            className="text-blue-600 hover:underline"
          >
            Cliquez ici pour contacter le Support Technique
          </a>
        </p>
      </div>
    </div>
  );
}
