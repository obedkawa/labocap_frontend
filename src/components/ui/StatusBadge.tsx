"use client";

import { Badge, BadgeVariant } from "./Badge";

interface StatusBadgeProps {
  status: string;
  domain: "invoice" | "report" | "testOrder" | "contract" | "general";
}

interface StatusConfig {
  label: string;
  variant: BadgeVariant;
}

const domainMappings: Record<
  StatusBadgeProps["domain"],
  Record<string, StatusConfig>
> = {
  invoice: {
    paid: { label: "Payé", variant: "success" },
    pending: { label: "En attente", variant: "warning" },
    partial: { label: "Partiel", variant: "info" },
    cancelled: { label: "Annulé", variant: "danger" },
  },
  report: {
    DRAFT: { label: "En attente de relecture", variant: "warning" },
    REVIEWED: { label: "Révisé", variant: "info" },
    SIGNED: { label: "Signé", variant: "primary" },
    VALIDATED: { label: "VALIDER", variant: "success" },
    DELIVERED: { label: "Livré", variant: "success" },
  },
  testOrder: {
    PENDING: { label: "En attente", variant: "warning" },
    VALIDATED: { label: "Validé", variant: "success" },
    DELIVERED: { label: "Livré", variant: "success" },
  },
  contract: {
    ACTIF: { label: "Actif", variant: "success" },
    INACTIF: { label: "Inactif", variant: "secondary" },
    "CLÔTURER": { label: "Clôturé", variant: "danger" },
    CLOTURE: { label: "Clôturé", variant: "danger" },
  },
  general: {
    // « Inactif » en rouge (danger) ; « Actif » conserve le fond gris actuel (secondary).
    ACTIF: { label: "ACTIF", variant: "secondary" },
    INACTIF: { label: "INACTIF", variant: "danger" },
  },
};

function getStatusConfig(
  domain: StatusBadgeProps["domain"],
  status: string
): StatusConfig {
  const mapping = domainMappings[domain];

  // Lookup exact
  if (mapping[status]) return mapping[status];

  // Lookup insensible à la casse
  const key = Object.keys(mapping).find(
    (k) => k.toLowerCase() === status.toLowerCase()
  );
  if (key) return mapping[key];

  // Fallback générique
  return { label: status, variant: "secondary" };
}

export function StatusBadge({ status, domain }: StatusBadgeProps) {
  const config = getStatusConfig(domain, status);
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
