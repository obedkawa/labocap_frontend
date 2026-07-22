import { NextRequest, NextResponse } from "next/server";

/**
 * Garde de routes côté serveur (Proxy Next.js 16, ex-`middleware`).
 *
 * Première ligne de défense UX : redirige les utilisateurs non authentifiés
 * vers /login avant même le rendu de la page protégée (l'ancien dispositif ne
 * reposait que sur le client — intercepteur 401 + PermissionGate).
 *
 * La sécurité réelle reste assurée par l'API (token JWT HttpOnly validé côté
 * Spring Security) ; ici on se contente de vérifier la *présence* du cookie
 * `access_token` (Path=/ donc visible par le proxy) pour orienter la
 * navigation. On ne valide pas la signature : ce n'est pas le rôle du front.
 */

const ACCESS_COOKIE = "access_token";
const BRANCH_COOKIE = "selected_branch_id";
const SELECT_BRANCH_PATH = "/select-branch";

// Routes accessibles sans authentification.
const PUBLIC_PATHS = ["/login", "/2fa", "/forgot-password", "/reset-password"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasToken = request.cookies.has(ACCESS_COOKIE);
  const hasBranch = request.cookies.has(BRANCH_COOKIE);

  // Utilisateur authentifié qui revient sur une page d'auth → renvoyé à l'accueil.
  if (hasToken && isPublic(pathname)) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  // Page protégée sans token → redirection vers /login, en mémorisant la cible.
  if (!hasToken && !isPublic(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authentifié mais aucune branche sélectionnée → écran de sélection de branche
  // (analogue du middleware `BranchRequired` de Laravel). `/select-branch` et les
  // pages publiques sont exemptés pour ne pas boucler.
  if (
    hasToken &&
    !hasBranch &&
    pathname !== SELECT_BRANCH_PATH &&
    !isPublic(pathname)
  ) {
    return NextResponse.redirect(new URL(SELECT_BRANCH_PATH, request.url));
  }

  return NextResponse.next();
}

/**
 * Exclut les internes Next.js et les fichiers statiques du proxy :
 * _next (build/HMR), favicon, et tout chemin contenant une extension de fichier.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
