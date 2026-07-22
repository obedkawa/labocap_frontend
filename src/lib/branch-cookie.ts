/**
 * Gestion de la branche (agence/site) active côté client — équivalent de la valeur
 * de session `selected_branch_id` de l'app Laravel.
 *
 * La branche est stockée dans un cookie **lisible** (non HttpOnly) afin d'être :
 *  - lue par l'intercepteur de requête ({@link ../lib/api/client}) qui pose l'en-tête
 *    `X-Branch-Id` sur chaque appel API (l'équivalent stateless du filtrage par branche) ;
 *  - lue par le proxy serveur ({@link ../proxy}) pour rediriger vers `/select-branch`
 *    tant qu'aucune branche n'est choisie (analogue du middleware `BranchRequired`).
 */

export const BRANCH_ID_COOKIE = "selected_branch_id";
export const BRANCH_NAME_COOKIE = "selected_branch_name";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 jours

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(
    value,
  )}; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax`;
}

function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

/** Identifiant de la branche active, ou `null` si aucune n'est sélectionnée. */
export function getSelectedBranchId(): string | null {
  return readCookie(BRANCH_ID_COOKIE);
}

/** Nom de la branche active, ou `null`. */
export function getSelectedBranchName(): string | null {
  return readCookie(BRANCH_NAME_COOKIE);
}

/** Enregistre la branche active (id + nom) dans les cookies. */
export function writeSelectedBranch(id: string, name: string): void {
  writeCookie(BRANCH_ID_COOKIE, id);
  writeCookie(BRANCH_NAME_COOKIE, name);
}

/** Efface la branche active (déconnexion, accès révoqué, re-sélection). */
export function clearSelectedBranch(): void {
  deleteCookie(BRANCH_ID_COOKIE);
  deleteCookie(BRANCH_NAME_COOKIE);
}
