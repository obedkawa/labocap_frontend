"use client";

import { useEffect, useRef, useState } from "react";
import { tooltipText } from "@/lib/ui/hints";

// Sélecteur des éléments interactifs éligibles à une infobulle.
const INTERACTIVE =
  'a, button, input, select, textarea, [role="button"], [title], [aria-label]';

/**
 * Infobulles globales façon Hyper / Bootstrap.
 *
 * Au survol (ou focus clavier) de n'importe quel élément portant un attribut
 * `title`, on affiche une infobulle stylée (fond sombre #343a40) juste au-dessus
 * de l'élément — comme le thème Hyper du projet Laravel — plutôt que l'infobulle
 * native grise et temporisée du navigateur.
 *
 * Fonctionne par délégation d'évènements : aucun changement n'est requis sur les
 * boutons/champs/liens existants, il suffit qu'ils aient un `title`. L'attribut
 * `title` est retiré temporairement pendant l'affichage pour éviter le doublon
 * avec l'infobulle native, puis restauré.
 *
 * Pour exclure un élément, lui donner l'attribut `data-no-tooltip`.
 */
export function HyperTooltip() {
  const [state, setState] = useState<{
    text: string;
    x: number;
    y: number;
    placement: "top" | "bottom";
  } | null>(null);
  const [shown, setShown] = useState(false);

  // Élément actuellement survolé + son title d'origine (retiré le temps de l'affichage).
  const activeRef = useRef<HTMLElement | null>(null);
  const titleRef = useRef<string | null>(null);

  useEffect(() => {
    function restore() {
      const el = activeRef.current;
      if (el) {
        // Restaure le title natif s'il avait été retiré, et retire les écouteurs.
        if (titleRef.current != null) el.setAttribute("title", titleRef.current);
        el.removeEventListener("mouseleave", onLeave);
        el.removeEventListener("blur", onLeave);
      }
      activeRef.current = null;
      titleRef.current = null;
      setShown(false);
      setState(null);
    }

    function onLeave() {
      restore();
    }

    function activate(el: HTMLElement) {
      if (el === activeRef.current) return;
      restore();

      if (el.hasAttribute("data-no-tooltip")) return;
      const text = tooltipText(el);
      if (!text) return;

      activeRef.current = el;
      // On ne retire le `title` natif (anti-doublon) que s'il existe réellement.
      const nativeTitle = el.getAttribute("title");
      if (nativeTitle) {
        titleRef.current = nativeTitle;
        el.removeAttribute("title");
      } else {
        titleRef.current = null;
      }
      el.addEventListener("mouseleave", onLeave);
      el.addEventListener("blur", onLeave);

      const rect = el.getBoundingClientRect();
      // Au-dessus par défaut ; en dessous si trop près du haut de l'écran.
      const placement: "top" | "bottom" = rect.top > 44 ? "top" : "bottom";
      const x = rect.left + rect.width / 2;
      const y = placement === "top" ? rect.top - 8 : rect.bottom + 8;
      setState({ text, x, y, placement });
      // Laisser le DOM peindre à opacité 0 avant la transition.
      requestAnimationFrame(() => setShown(true));
    }

    function onOver(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const el = target?.closest?.(INTERACTIVE) as HTMLElement | null;
      if (el) activate(el);
    }

    function onFocusIn(e: FocusEvent) {
      const target = e.target as HTMLElement | null;
      const el = target?.closest?.(INTERACTIVE) as HTMLElement | null;
      if (el) activate(el);
    }

    // Cache l'infobulle sur clic ou défilement (position devenue caduque).
    function hideNow() {
      if (activeRef.current) restore();
    }

    document.addEventListener("mouseover", onOver);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("click", hideNow, true);
    window.addEventListener("scroll", hideNow, true);

    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("click", hideNow, true);
      window.removeEventListener("scroll", hideNow, true);
      restore();
    };
  }, []);

  if (!state) return null;

  return (
    <div
      className={`hyper-tooltip${shown ? " show" : ""}`}
      data-placement={state.placement}
      style={{
        left: state.x,
        top: state.y,
        transform:
          state.placement === "top"
            ? "translate(-50%, -100%)"
            : "translate(-50%, 0)",
      }}
      role="tooltip"
    >
      <div className="hyper-tooltip__inner">{state.text}</div>
      <span className="hyper-tooltip__arrow" />
    </div>
  );
}
