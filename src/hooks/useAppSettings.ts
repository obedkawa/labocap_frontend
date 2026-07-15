"use client";

import { useQuery } from "@tanstack/react-query";
import { settingAppsApi } from "@/lib/api/appSettings";

/**
 * Réglages applicatifs (table `setting_apps`) sous forme de map clé → valeur :
 * `logo`, `logo_white`, `app_name`, etc. Mis en cache (les logos sont lourds,
 * on évite de recharger à chaque navigation).
 *
 * Nécessite la permission `view-settings` ; en cas d'erreur (403…), `data` est
 * indéfini et l'appelant retombe sur ses valeurs par défaut.
 */
export function useAppSettings() {
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: () => settingAppsApi.getAll(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });
}
