import { create } from "zustand";
import { persist } from "zustand/middleware";
import { User } from "@/types/auth";

// Un Super Admin a tous les droits, quel que soit le détail des permissions
// seedées : il court-circuite tous les contrôles (UI). Détection FR + EN sur
// le nom comme sur le slug du rôle.
const isSuperAdmin = (user: User | null): boolean =>
  (user?.roles ?? []).some((r) => {
    const tokens = `${r.name ?? ""} ${r.slug ?? ""}`.toLowerCase();
    return tokens.includes("super-admin") || tokens.includes("super admin");
  });

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  clearAuth: () => void;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => {
        // Le backend retourne roles[].permissions[] sous forme d'objets {id,name,slug}
        // On aplatit en tableau de slugs pour que hasPermission() fonctionne
        const extractSlug = (p: unknown): string =>
          typeof p === "string" ? p : (p as { slug: string }).slug;

        let permissions =
          user.permissions?.length
            ? user.permissions
            : [
                ...new Set(
                  user.roles?.flatMap((role) =>
                    (role.permissions ?? []).map(extractSlug)
                  ) ?? []
                ),
              ];

        let roles = user.roles ?? [];

        // Fusion défensive : certaines réponses (ex. PUT /users/{id}) renvoient un
        // `user` partiel sans `roles` NI `permissions`. Dans ce cas, ne JAMAIS
        // écraser les permissions/rôles déjà chargés du même utilisateur connecté —
        // sinon la sidebar et les PermissionGate se vident à tort.
        const existing = get().user;
        if (permissions.length === 0 && roles.length === 0 && existing) {
          if (!existing.id || existing.id === user.id) {
            permissions = existing.permissions ?? [];
            roles = existing.roles ?? [];
          }
        }

        set({
          user: { ...user, permissions, roles },
          isAuthenticated: true,
        });
      },
      clearAuth: () => set({ user: null, isAuthenticated: false }),
      hasPermission: (permission) => {
        const { user } = get();
        if (isSuperAdmin(user)) return true;
        return user?.permissions?.includes(permission) ?? false;
      },
      hasAnyPermission: (...permissions) => {
        const { user } = get();
        if (isSuperAdmin(user)) return true;
        return permissions.some((p) => user?.permissions?.includes(p) ?? false);
      },
    }),
    {
      name: "auth-storage",
      // Ne jamais stocker les tokens JWT ici — ils sont dans les cookies HttpOnly
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
