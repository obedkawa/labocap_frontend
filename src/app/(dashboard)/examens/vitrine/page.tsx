"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { ComponentsShowcase } from "@/components/examens/ComponentsShowcase";

export default function VitrineComposantsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Vitrine des composants"
        subtitle="Aperçu des composants réutilisables du Catalogue d'examen"
      />

      <ComponentsShowcase />
    </div>
  );
}
