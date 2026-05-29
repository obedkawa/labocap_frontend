import { create } from "zustand";
import { persist } from "zustand/middleware";
import { User } from "@/types/auth";

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

        const permissions =
          user.permissions?.length
            ? user.permissions
            : [
                ...new Set(
                  user.roles?.flatMap((role) =>
                    (role.permissions ?? []).map(extractSlug)
                  ) ?? []
                ),
              ];

        set({
          user: { ...user, permissions, roles: user.roles ?? [] },
          isAuthenticated: true,
        });
      },
      clearAuth: () => set({ user: null, isAuthenticated: false }),
      hasPermission: (permission) => {
        const { user } = get();
        return user?.permissions?.includes(permission) ?? false;
      },
      hasAnyPermission: (...permissions) => {
        const { user } = get();
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
