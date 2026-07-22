import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  clearSelectedBranch,
  getSelectedBranchId,
  getSelectedBranchName,
  writeSelectedBranch,
} from "@/lib/branch-cookie";

/** Branche (agence/site) active sélectionnée par l'utilisateur. */
export interface SelectedBranch {
  id: string;
  name: string;
}

interface BranchStore {
  branch: SelectedBranch | null;
  /** Sélectionne la branche active (met aussi à jour les cookies de transport). */
  setBranch: (branch: SelectedBranch) => void;
  /** Efface la branche active (déconnexion / re-sélection). */
  clearBranch: () => void;
}

/**
 * Store de la branche active — analogue de `session('selected_branch_id')` de Laravel.
 *
 * La source de vérité pour le **transport** (en-tête `X-Branch-Id`) et le **proxy**
 * serveur est le cookie ({@link @/lib/branch-cookie}) ; ce store en est le miroir
 * réactif pour l'UI et rejoue les cookies à l'hydratation.
 */
export const useBranchStore = create<BranchStore>()(
  persist(
    (set) => ({
      branch: null,
      setBranch: (branch) => {
        writeSelectedBranch(branch.id, branch.name);
        set({ branch });
      },
      clearBranch: () => {
        clearSelectedBranch();
        set({ branch: null });
      },
    }),
    {
      name: "branch-storage",
      // À la réhydratation, on resynchronise les cookies depuis l'état persisté
      // (utile si les cookies ont expiré mais que l'onglet garde l'état).
      onRehydrateStorage: () => (state) => {
        if (state?.branch && !getSelectedBranchId()) {
          writeSelectedBranch(state.branch.id, state.branch.name);
        } else if (!state?.branch && getSelectedBranchId()) {
          // Cookie présent mais store vide (ex. autre onglet) : on aligne le store.
          state?.setBranch({
            id: getSelectedBranchId() as string,
            name: getSelectedBranchName() ?? "",
          });
        }
      },
    },
  ),
);
