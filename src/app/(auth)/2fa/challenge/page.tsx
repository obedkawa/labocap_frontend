"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authApi } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/auth.store";

const twoFactorSchema = z.object({
  code: z
    .string()
    .min(1, "Le code est requis")
    .regex(/^\d{6}$/, "Le code doit contenir exactement 6 chiffres"),
});

type TwoFactorFormData = z.infer<typeof twoFactorSchema>;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const masked =
    local.length <= 2
      ? local[0] + "***"
      : local[0] + "***" + local[local.length - 1];
  return `${masked}@${domain}`;
}

export default function TwoFactorChallengePage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    const email = sessionStorage.getItem("2fa_email") || "";
    setMaskedEmail(email ? maskEmail(email) : "votre adresse e-mail");
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TwoFactorFormData>({
    resolver: zodResolver(twoFactorSchema),
  });

  const onSubmit = async (data: TwoFactorFormData) => {
    setIsLoading(true);
    try {
      const tempToken = sessionStorage.getItem("2fa_temp_token") ?? "";
      const response = await authApi.twoFactor({ code: data.code, tempToken });
      const result = response.data;

      if (result.user) {
        sessionStorage.removeItem("2fa_email");
        sessionStorage.removeItem("2fa_temp_token");
        setUser(result.user);
        router.push("/home");
      }
    } catch {
      toast.error("Le code saisi est incorrecte");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    const email = sessionStorage.getItem("2fa_email");
    if (!email) {
      toast.error("Adresse e-mail introuvable, veuillez vous reconnecter.");
      return;
    }
    setIsResending(true);
    try {
      await authApi.resendTwoFactor(email);
      toast.success("Code renvoyé");
    } catch {
      toast.error("Impossible de renvoyer le code, veuillez réessayer.");
    } finally {
      setIsResending(false);
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
                    "logo-fallback-2fa"
                  );
                  if (fallback) fallback.style.display = "block";
                }}
              />
              <span
                id="logo-fallback-2fa"
                className="text-xl font-bold text-gray-800 hidden"
              >
                Labo AnaPath
              </span>
            </a>
          </div>

          {/* Body */}
          <div className="px-8 py-8">
            <h4 className="text-2xl font-bold text-gray-800 mb-2">
              Vérifiez votre e-mail pour un code
            </h4>
            <p className="text-gray-500 mb-6 text-sm">
              Nous avons envoyé un code à 6 caractères à{" "}
              <strong>{maskedEmail}</strong>. Le code expire sous peu, veuillez
              donc le saisir rapidement.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              {/* Code */}
              <div className="mb-6">
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  placeholder="Entrer le code"
                  {...register("code")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg tracking-widest"
                  maxLength={6}
                />
                {errors.code && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.code.message}
                  </p>
                )}
              </div>

              {/* Bouton submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white w-full py-2 rounded font-medium text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? "Vérification..." : "Confirmer"}
              </button>

              {/* Lien renvoyer */}
              <p className="text-center mt-4 text-sm text-gray-500">
                Vous n&apos;aviez pas reçu le code ?{" "}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (!isResending) handleResend();
                  }}
                  aria-disabled={isResending}
                  className={`font-semibold ${isResending ? "text-gray-400 cursor-not-allowed" : "text-blue-600 hover:underline"}`}
                >
                  {isResending ? "Envoi en cours…" : "Renvoyer"}
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
