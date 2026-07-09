"use client";

import { useSyncExternalStore } from "react";

// Ni l'hydratation ni le sessionStorage ne notifient de changement : on ne
// s'abonne à rien, le snapshot est relu à chaque rendu.
const noopSubscribe = () => () => {};

/**
 * `false` au rendu serveur et pendant l'hydratation, `true` ensuite.
 *
 * Remplace le couple `useState(false)` + `useEffect(() => setMounted(true), [])`,
 * qui déclenche un rendu en cascade et est refusé par `react-hooks/set-state-in-effect`.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

/**
 * Lit une clé du `sessionStorage`. Renvoie `""` côté serveur et pendant
 * l'hydratation, puis la valeur réelle. La valeur n'est pas réactive : elle est
 * relue à chaque rendu, ce qui suffit pour des données écrites avant navigation.
 */
export function useSessionStorageValue(key: string): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => sessionStorage.getItem(key) ?? "",
    () => ""
  );
}
