import { branchesApi } from "@/lib/api/branches";
import { useBranchStore } from "@/stores/branch.store";

/**
 * Détermine la route à suivre après une authentification réussie, en reproduisant
 * la logique de `TFAuthController::selectBranch` de Laravel :
 *  - exactement **1** branche accessible → auto-sélection puis tableau de bord ;
 *  - **0 ou plusieurs** branches → écran de sélection `/select-branch`.
 *
 * @returns le chemin de destination (`/home` ou `/select-branch`)
 */
export async function resolvePostLoginRoute(): Promise<string> {
  try {
    const res = await branchesApi.getMyBranches();
    const branches = res.data ?? [];
    if (branches.length === 1) {
      const branch = branches[0];
      useBranchStore.getState().setBranch({ id: branch.id, name: branch.name });
      return "/home";
    }
  } catch {
    // En cas d'échec de chargement, on laisse l'utilisateur choisir explicitement.
  }
  return "/select-branch";
}
