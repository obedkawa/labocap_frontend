"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAppSettings } from "@/hooks/useAppSettings";

/**
 * Applique les réglages « Général » qui n'étaient enregistrés mais jamais utilisés :
 *  - `favicon` → icône de l'onglet du navigateur (`<link rel="icon">`).
 *  - `app_name` → titre du document (onglet).
 *
 * Rendu invisible ; à placer dans le layout du dashboard (post-authentification).
 */
export function AppSettingsEffects() {
  const { data } = useAppSettings();
  const favicon = data?.favicon?.trim();
  const appName = data?.app_name?.trim();
  // Next réécrit le <title> à chaque navigation ; on ré-applique après chaque
  // changement de route pour que le nom du labo reste dans l'onglet.
  const pathname = usePathname();

  useEffect(() => {
    if (!favicon) return;
    const head = document.head;
    // NE PAS supprimer les <link rel="icon"> injectés par Next (app/favicon.ico) :
    // ce sont des nœuds gérés par React. Les retirer à la main casse la
    // réconciliation du <head> (« Cannot read properties of null (reading
    // 'removeChild') » à la navigation/HMR). On gère notre propre <link> dédié,
    // ajouté en dernier — le navigateur retient toujours la dernière icône déclarée.
    let link = head.querySelector<HTMLLinkElement>(
      'link[rel="icon"][data-app-favicon]'
    );
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.setAttribute("data-app-favicon", "");
      head.appendChild(link);
    }
    link.href = favicon;
  }, [favicon]);

  useEffect(() => {
    if (!appName) return;
    document.title = appName;
    // Ré-applique juste après le rendu de Next (qui vient d'écraser le titre).
    const id = window.setTimeout(() => {
      document.title = appName;
    }, 0);
    return () => window.clearTimeout(id);
  }, [appName, pathname]);

  return null;
}
