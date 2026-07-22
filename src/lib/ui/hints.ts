/**
 * Dérivation de libellés d'aide (titres d'infobulle et placeholders) directement
 * depuis le DOM, pour couvrir TOUS les champs / boutons / liens sans avoir à
 * annoter chaque élément à la main.
 */

/** Nettoie un texte : espaces compactés + astérisque « obligatoire » retirée. */
export function cleanText(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/\s+/g, " ")
    .replace(/\s*\*+\s*$/, "")
    .trim();
}

const SKIP_INPUT_TYPES = new Set([
  "hidden",
  "checkbox",
  "radio",
  "file",
  "range",
  "color",
  "submit",
  "button",
  "reset",
  "image",
]);

/** Un contrôle de formulaire éligible (input texte, textarea, select). */
export function isFormControl(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === "textarea" || tag === "select") return true;
  if (tag === "input") {
    const type = (el.getAttribute("type") || "text").toLowerCase();
    return !SKIP_INPUT_TYPES.has(type);
  }
  return false;
}

/**
 * Libellé associé à un champ : label lié (htmlFor/for), aria-label, label
 * englobant, sinon le premier <label> du conteneur de champ (motif FormField :
 * <div><label/>…<input/></div>).
 */
export function fieldLabel(el: Element): string {
  const input = el as HTMLInputElement;

  // 1. labels natifs (association for/id ou label englobant)
  const labels = input.labels;
  if (labels && labels.length && labels[0].textContent) {
    const t = cleanText(labels[0].textContent);
    if (t) return t;
  }
  // 2. aria-label
  const aria = cleanText(el.getAttribute("aria-label"));
  if (aria) return aria;
  // 3. label englobant
  const wrap = el.closest("label");
  if (wrap && wrap.textContent) {
    const t = cleanText(wrap.textContent);
    if (t) return t;
  }
  // 4. premier <label> d'un conteneur ancêtre proche
  let node: Element | null = el.parentElement;
  for (let i = 0; i < 4 && node; i++) {
    const lbl = node.querySelector("label");
    if (lbl && lbl.textContent) {
      const t = cleanText(lbl.textContent);
      if (t) return t;
    }
    node = node.parentElement;
  }
  return "";
}

/** Indique si un champ possède un libellé visible (label associé ou englobant). */
export function hasVisibleLabel(el: Element): boolean {
  const input = el as HTMLInputElement;
  const labels = input.labels;
  if (labels && labels.length && cleanText(labels[0].textContent)) return true;
  const wrap = el.closest("label");
  if (wrap && cleanText(wrap.textContent)) return true;
  let node: Element | null = el.parentElement;
  for (let i = 0; i < 4 && node; i++) {
    const lbl = node.querySelector("label");
    if (lbl && cleanText(lbl.textContent)) return true;
    node = node.parentElement;
  }
  return false;
}

/**
 * Texte d'infobulle — affichée UNIQUEMENT là où aucun texte visible ne renseigne
 * déjà l'élément :
 *  - `title` explicite → toujours prioritaire (boutons-icônes d'action) ;
 *  - champ SANS libellé visible → son aria-label, sinon son placeholder ;
 *  - bouton / lien « icône seule » (aucun texte visible) → son aria-label / href.
 * Un champ avec libellé ou un bouton/lien avec texte ne reçoit PAS d'infobulle.
 * Retourne "" si aucune infobulle ne doit être affichée.
 */
export function tooltipText(el: Element): string {
  const explicit = cleanText(el.getAttribute("title"));
  if (explicit) return explicit;

  // Champs : infobulle seulement si le champ n'a pas de libellé visible.
  if (isFormControl(el)) {
    if (hasVisibleLabel(el)) return "";
    const aria = cleanText(el.getAttribute("aria-label"));
    if (aria) return aria;
    return cleanText(el.getAttribute("placeholder"));
  }

  // Boutons / liens : infobulle seulement s'ils sont « icône seule » (sans texte).
  const tag = el.tagName.toLowerCase();
  const isButtonish =
    tag === "button" || tag === "a" || el.getAttribute("role") === "button";
  if (isButtonish) {
    if (cleanText(el.textContent)) return ""; // a du texte visible → pas d'infobulle
    const aria = cleanText(el.getAttribute("aria-label"));
    if (aria) return aria;
    if (tag === "a") {
      const href = el.getAttribute("href");
      if (href && href !== "#") return href;
    }
    return "";
  }

  return "";
}
