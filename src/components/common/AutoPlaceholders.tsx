"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { fieldLabel, isFormControl } from "@/lib/ui/hints";

/**
 * Renseigne automatiquement un `placeholder` sur TOUS les champs de saisie qui
 * n'en ont pas, dérivé de leur libellé — sans avoir à annoter chaque formulaire.
 *
 * Ne touche pas :
 *  - les champs qui ont déjà un placeholder (contenu authored prioritaire) ;
 *  - les selects, cases à cocher, fichiers, dates… (placeholder sans effet) ;
 *  - les éléments marqués `data-no-placeholder`.
 *
 * Un MutationObserver couvre les champs ajoutés dynamiquement (modales, etc.).
 * Placer un placeholder est une simple écriture d'attribut : React ne le
 * réinitialise pas tant que le composant ne définit pas lui-même la prop.
 */
export function AutoPlaceholders() {
  const pathname = usePathname();

  useEffect(() => {
    function apply(el: Element) {
      // input texte ou textarea uniquement (les selects n'ont pas de placeholder)
      const tag = el.tagName.toLowerCase();
      if (tag !== "input" && tag !== "textarea") return;
      if (!isFormControl(el)) return;
      const input = el as HTMLInputElement;
      if (input.getAttribute("placeholder")) return;
      if (input.hasAttribute("data-no-placeholder")) return;
      const label = fieldLabel(el);
      if (label) input.setAttribute("placeholder", label);
    }

    function scan(root: ParentNode | Element) {
      if (root instanceof Element) apply(root);
      root.querySelectorAll?.("input, textarea").forEach(apply);
    }

    // Passe initiale (après le premier rendu de la page).
    const id = window.setTimeout(() => scan(document.body), 0);

    // Champs ajoutés ensuite (ouverture de modale, chargement asynchrone…).
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === 1) scan(n as Element);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(id);
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
