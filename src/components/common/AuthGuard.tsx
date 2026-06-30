"use client";

import { useEffect } from "react";

import { useAuthStore } from "@/stores/auth.store";
import { authApi } from "@/lib/api/auth";

/**
 * Validation de session du tableau de bord.
 *
 * La *redirection* des utilisateurs non authentifiés est déjà assurée côté
 * serveur par `proxy.ts` (Proxy Next.js 16, ex-middleware), qui vérifie la
 * présence du cookie `access_token`. AuthGuard ne refait donc PAS cette
 * redirection (sous peine de boucle avec le proxy) : il se contente de
 * VALIDER la session au montage via `authApi.me()` —
 *  - succès  → (re)peuple le store si le cookie est valide mais le localStorage
 *              a été vidé (désynchronisation cookie/store) ;
 *  - échec   → l'intercepteur a déjà tenté un refresh puis redirigé vers
 *              /login ; on se contente de nettoyer le store.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  useEffect(() => {
    let active = true;
    authApi
      .me()
      .then((res) => {
        if (active) setUser(res.data);
      })
      .catch(() => {
        if (active) clearAuth();
      });
    return () => {
      active = false;
    };
    // Validation unique au montage du tableau de bord.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
