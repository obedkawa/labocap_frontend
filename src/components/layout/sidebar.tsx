"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Stethoscope,
  FileCheck,
  Building2,
  Users,
  User,
  Receipt,
  DollarSign,
  Folder,
  TrendingDown,
  Package,
  Truck,
  RefreshCw,
  Briefcase,
  AlertCircle,
  UserCheck,
  Settings,
  Users2,
  BookOpen,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  ClipboardList,
  BarChart2,
  Search,
  Syringe,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useUIStore } from "@/stores/ui.store";
import { usePermissions } from "@/hooks/usePermissions";
import { useHydrated } from "@/hooks/useHydrated";
import { useAuthStore } from "@/stores/auth.store";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { testOrdersApi } from "@/lib/api/testOrders";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BadgeProps {
  count: number;
}

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  badge?: number;
}

interface CollapseItemProps {
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  badge?: number;
  children: React.ReactNode;
}

interface SubItemProps {
  href: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function Badge({ count }: BadgeProps) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto bg-yellow-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
      {count}
    </span>
  );
}

function NavItem({ href, icon, label, collapsed, badge = 0 }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`flex items-center px-4 py-2.5 rounded-md mx-2 transition-colors text-sm ${
        collapsed ? "justify-center" : "gap-3"
      } ${
        isActive
          ? "bg-gray-700 text-white"
          : "text-gray-300 hover:bg-gray-800 hover:text-white"
      }`}
      title={collapsed ? label : undefined}
    >
      <span className="flex-shrink-0 w-5 h-5">{icon}</span>
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          <Badge count={badge} />
        </>
      )}
    </Link>
  );
}

function CollapseItem({
  icon,
  label,
  collapsed,
  badge = 0,
  children,
}: CollapseItemProps) {
  const [open, setOpen] = useState(false);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const triggerRef = useRef<HTMLDivElement>(null);

  if (collapsed) {
    // En mode replié, on affiche un flyout au survol (positionné en `fixed` pour
    // échapper au `overflow-hidden` de la sidebar) listant les sous-éléments,
    // afin que les sections à enfants restent accessibles.
    return (
      <div
        ref={triggerRef}
        className="relative"
        onMouseEnter={() => {
          const rect = triggerRef.current?.getBoundingClientRect();
          if (rect) setFlyoutTop(rect.top);
          setOpen(true);
        }}
        onMouseLeave={() => setOpen(false)}
      >
        <div
          className="flex items-center justify-center px-4 py-2.5 mx-2 text-gray-300 cursor-pointer hover:bg-gray-800 hover:text-white rounded-md"
          title={label}
        >
          <span className="flex-shrink-0 w-5 h-5">{icon}</span>
        </div>
        {open && (
          // `pl-1` sert de pont de survol entre l'icône et le panneau.
          <div className="fixed left-16 z-50 pl-1" style={{ top: flyoutTop }}>
            <div className="min-w-[210px] rounded-md border border-gray-700 bg-gray-900 py-2 shadow-xl">
              <div className="px-4 pb-2 mb-1 border-b border-gray-700 text-xs uppercase tracking-wider text-gray-400 font-semibold">
                {label}
              </div>
              {children}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-3 px-4 py-2.5 rounded-md mx-2 w-[calc(100%-16px)] text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
      >
        <span className="flex-shrink-0 w-5 h-5">{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        <Badge count={badge} />
        <span className="flex-shrink-0 ml-1">
          {open ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </span>
      </button>
      {open && (
        <div className="ml-4 border-l border-gray-700 mt-0.5 mb-0.5">
          {children}
        </div>
      )}
    </div>
  );
}

function SubItem({ href, label }: SubItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`flex items-center pl-8 pr-4 py-2 text-sm transition-colors ${
        isActive
          ? "text-white bg-gray-700 rounded-r-md"
          : "text-gray-400 hover:text-white hover:bg-gray-800 rounded-r-md"
      }`}
    >
      {label}
    </Link>
  );
}

function SectionLabel({
  label,
  collapsed,
}: {
  label: string;
  collapsed: boolean;
}) {
  if (collapsed) {
    return <div className="mx-2 my-2 border-t border-gray-700" />;
  }
  return (
    <div className="px-4 mt-5 mb-2">
      <span className="text-xs uppercase text-gray-500 font-semibold tracking-wider">
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Sidebar component
// ---------------------------------------------------------------------------

export function Sidebar() {
  const { sidebarCollapsed } = useUIStore();
  const { can } = usePermissions();
  const { user } = useAuthStore();
  const mounted = useHydrated();

  // Le rôle médecin est « Docteur » (slug « docteur ») en base — on accepte les
  // deux orthographes (FR/EN) sur le nom comme sur le slug.
  const isDoctor =
    mounted &&
    user?.roles?.some((r) => {
      const tokens = `${r.name ?? ""} ${r.slug ?? ""}`.toLowerCase();
      return tokens.includes("docteur") || tokens.includes("doctor");
    });

  const { data: immunoPendingCount } = useQuery({
    queryKey: ["immuno-pending-count"],
    queryFn: () => testOrdersApi.countImmunoPending().then((r) => r.data.count),
    enabled: can(PERMISSIONS.VIEW_TEST_ORDERS),
    refetchOnWindowFocus: false,
  });

  const collapsed = sidebarCollapsed;

  return (
    <aside
      className={`bg-gray-900 text-white flex flex-col flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-center flex-shrink-0 border-b border-gray-800">
        {collapsed ? (
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            L
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              L
            </div>
            <span className="font-semibold text-white text-base truncate">
              Labo AnaPath
            </span>
          </div>
        )}
      </div>

      {/* Scrollable nav */}
      <nav className="sidebar-scroll flex-1 overflow-y-auto py-3 overflow-x-hidden">

        {/* ══════════════ TABLEAU DE BORD ══════════════ */}
        <SectionLabel label="TABLEAU DE BORD" collapsed={collapsed} />

        <NavItem href="/home" icon={<Home className="w-5 h-5" />} label="Tableau de bord" collapsed={collapsed} />

        {/* ══════════════ EXAMENS ══════════════ */}
        <SectionLabel label="EXAMENS" collapsed={collapsed} />

        {/* Catalogue d'examens */}
        {can(PERMISSIONS.VIEW_TESTS) && (
          <CollapseItem icon={<FlaskConical className="w-5 h-5" />} label="Catalogue d'examens" collapsed={collapsed}>
            {can(PERMISSIONS.VIEW_TESTS) && <SubItem href="/examens" label="Tous les examens" />}
            {can(PERMISSIONS.VIEW_CATEGORY_TESTS) && <SubItem href="/examens/categories" label="Catégories" />}
          </CollapseItem>
        )}

        {/* Demandes d'examen */}
        {can(PERMISSIONS.VIEW_TEST_ORDERS) && (
          <CollapseItem icon={<Stethoscope className="w-5 h-5" />} label="Demandes d'examen" collapsed={collapsed}>
            {isDoctor && <SubItem href="/test-orders/myspace" label="Mon espace" />}
            <SubItem href="/test-orders" label="Toutes les demandes" />
            {can(PERMISSIONS.VIEW_TEST_ORDER_ASSIGNMENTS) && (
              <SubItem href="/test-orders/macroscopy" label="Macroscopie" />
            )}
            {can(PERMISSIONS.VIEW_TEST_ORDER_ASSIGNMENTS) && (
              <SubItem href="/test-orders/assignments" label="Affectation" />
            )}
            {can(PERMISSIONS.VIEW_TEST_ORDER_ASSIGNMENTS) && (
              <SubItem href="/reports/suivi" label="Suivi des demandes" />
            )}
            <SubItem href="/search" label="Rechercher" />
          </CollapseItem>
        )}

        {/* Immuno */}
        {can(PERMISSIONS.VIEW_TEST_ORDERS) && (
          <NavItem
            href="/test-orders/immuno"
            icon={<Syringe className="w-5 h-5" />}
            label="Immuno"
            collapsed={collapsed}
            badge={immunoPendingCount ?? 0}
          />
        )}

        {/* Comptes rendu */}
        {can(PERMISSIONS.VIEW_REPORTS) && (
          <CollapseItem icon={<FileCheck className="w-5 h-5" />} label="Comptes rendu" collapsed={collapsed}>
            <SubItem href="/reports" label="Tous les comptes rendu" />
            <SubItem href="/reports/history" label="Historique" />
            {can(PERMISSIONS.VIEW_SETTINGS) && <SubItem href="/reports/templates" label="Templates" />}
            {can(PERMISSIONS.VIEW_SETTINGS) && <SubItem href="/reports/settings" label="Paramètres" />}
          </CollapseItem>
        )}

        {/* Hôpitaux */}
        {can(PERMISSIONS.VIEW_HOSPITALS) && (
          <NavItem href="/hospitals" icon={<Building2 className="w-5 h-5" />} label="Hôpitaux" collapsed={collapsed} />
        )}

        {/* Médecins */}
        {can(PERMISSIONS.VIEW_DOCTORS) && (
          <NavItem href="/doctors" icon={<Users className="w-5 h-5" />} label="Médecins traitants" collapsed={collapsed} />
        )}

        {/* Patients */}
        {can(PERMISSIONS.VIEW_PATIENTS) && (
          <NavItem href="/patients" icon={<User className="w-5 h-5" />} label="Patients" collapsed={collapsed} />
        )}

        {/* Consultations */}
        {can(PERMISSIONS.VIEW_CONSULTATIONS) && (
          <CollapseItem icon={<Stethoscope className="w-5 h-5" />} label="Consultations" collapsed={collapsed}>
            <SubItem href="/consultations" label="Toutes les consultations" />
            {can(PERMISSIONS.VIEW_TYPE_CONSULTATIONS) && (
              <SubItem href="/consultations/types" label="Types" />
            )}
          </CollapseItem>
        )}

        {/* Prestations */}
        {(can(PERMISSIONS.VIEW_PRESTATIONS) ||
          can(PERMISSIONS.VIEW_PRESTATION_ORDERS)) && (
          <CollapseItem icon={<ClipboardList className="w-5 h-5" />} label="Prestations" collapsed={collapsed}>
            {can(PERMISSIONS.VIEW_PRESTATIONS) && (
              <SubItem href="/prestations" label="Toutes les prestations" />
            )}
            {can(PERMISSIONS.VIEW_PRESTATION_ORDERS) && (
              <SubItem href="/prestations/orders" label="Commandes de prestations" />
            )}
            {can(PERMISSIONS.MANAGE_SETTINGS) && (
              <SubItem href="/prestations/categories" label="Catégories" />
            )}
          </CollapseItem>
        )}

        {/* ══════════════ COMPTABILITÉS ══════════════ */}
        <SectionLabel label="COMPTABILITÉS" collapsed={collapsed} />

        {/* Factures */}
        {can(PERMISSIONS.VIEW_INVOICES) && (
          <CollapseItem icon={<Receipt className="w-5 h-5" />} label="Factures" collapsed={collapsed}>
            <SubItem href="/invoices" label="Toutes les Factures" />
            {can(PERMISSIONS.CREATE_INVOICES) && <SubItem href="/invoices/create" label="Créer" />}
            {/* "Rapports" et "Paramètre" : permission view-setting-invoice (cohérent avec Laravel) */}
            {can(PERMISSIONS.VIEW_SETTING_INVOICE) && <SubItem href="/invoices/business" label="Rapports" />}
            {can(PERMISSIONS.VIEW_SETTING_INVOICE) && <SubItem href="/invoices/settings" label="Paramètre" />}
          </CollapseItem>
        )}

        {/* Caisses */}
        {can(PERMISSIONS.VIEW_CASHBOXES) && (
          <CollapseItem icon={<DollarSign className="w-5 h-5" />} label="Caisses" collapsed={collapsed}>
            <SubItem href="/cashbox" label="Caisse de vente" />
            <SubItem href="/expenses" label="Caisse de dépense" />
            <SubItem href="/cashbox/tickets" label="Billetage de caisse" />
            <SubItem href="/cashbox/sessions" label="Ouverture et fermeture" />
          </CollapseItem>
        )}

        {/* Contrats */}
        {can(PERMISSIONS.VIEW_CONTRATS) && (
          <NavItem href="/contracts" icon={<Folder className="w-5 h-5" />} label="Contrats" collapsed={collapsed} />
        )}

        {/* Dépenses */}
        {can(PERMISSIONS.VIEW_EXPENSES) && (
          <CollapseItem icon={<TrendingDown className="w-5 h-5" />} label="Dépenses" collapsed={collapsed}>
            <SubItem href="/expenses" label="Toutes les dépenses" />
            {can(PERMISSIONS.MANAGE_SETTINGS) && (
              <SubItem href="/expenses/categories" label="Catégories" />
            )}
          </CollapseItem>
        )}

        {/* Stocks */}
        {can(PERMISSIONS.VIEW_ARTICLES) && (
          <CollapseItem icon={<Package className="w-5 h-5" />} label="Stocks" collapsed={collapsed}>
            <SubItem href="/inventory/articles" label="Tous les articles" />
            <SubItem href="/inventory/movements" label="Mouvements de stock" />
            <SubItem href="/inventory/units" label="Unité de mesure" />
          </CollapseItem>
        )}

        {/* Fournisseurs */}
        {can(PERMISSIONS.VIEW_SUPPLIERS) && (
          <CollapseItem icon={<Truck className="w-5 h-5" />} label="Fournisseurs" collapsed={collapsed}>
            <SubItem href="/suppliers" label="Tous les fournisseurs" />
            {can(PERMISSIONS.MANAGE_SETTINGS) && (
              <SubItem href="/suppliers/categories" label="Catégories" />
            )}
          </CollapseItem>
        )}

        {/* Remboursements */}
        {can(PERMISSIONS.VIEW_REFUNDS) && (
          <CollapseItem icon={<RefreshCw className="w-5 h-5" />} label="Remboursements" collapsed={collapsed}>
            <SubItem href="/refunds" label="Historiques" />
          </CollapseItem>
        )}

        {/* Clients Professionnels */}
        {can(PERMISSIONS.VIEW_CLIENTS) && (
          <NavItem href="/clients" icon={<Briefcase className="w-5 h-5" />} label="Clients Professionnels" collapsed={collapsed} />
        )}

        {/* ══════════════ ADMINISTRATIONS ══════════════ */}
        <SectionLabel label="ADMINISTRATIONS" collapsed={collapsed} />

        {/* Support */}
        <CollapseItem icon={<AlertCircle className="w-5 h-5" />} label="Support" collapsed={collapsed}>
          <SubItem href="/support" label="Historiques" />
        </CollapseItem>

        {/* Utilisateurs */}
        {can(PERMISSIONS.VIEW_USERS) && (
          <CollapseItem icon={<UserCheck className="w-5 h-5" />} label="Utilisateurs" collapsed={collapsed}>
            {can(PERMISSIONS.VIEW_USERS) && <SubItem href="/settings/permissions" label="Permissions" />}
            {can(PERMISSIONS.MANAGE_ROLES) && <SubItem href="/settings/roles" label="Rôles" />}
            {can(PERMISSIONS.VIEW_USERS) && <SubItem href="/settings/users" label="Tous les utilisateurs" />}
          </CollapseItem>
        )}

        {/* Paramètres */}
        {can(PERMISSIONS.VIEW_SETTINGS) && (
          <NavItem href="/settings" icon={<Settings className="w-5 h-5" />} label="Paramètres" collapsed={collapsed} />
        )}

        {/* Finance */}
        {can(PERMISSIONS.MANAGE_FINANCE) && (
          <CollapseItem icon={<BarChart2 className="w-5 h-5" />} label="Finance" collapsed={collapsed}>
            <SubItem href="/finance" label="Vue d'ensemble" />
            <SubItem href="/finance/banks" label="Comptes bancaires" />
          </CollapseItem>
        )}

        {/* ══════════════ EQUIPES ══════════════ */}
        <SectionLabel label="EQUIPES" collapsed={collapsed} />

        {can(PERMISSIONS.VIEW_EMPLOYEES) && (
          <CollapseItem icon={<Users2 className="w-5 h-5" />} label="Equipes" collapsed={collapsed}>
            <SubItem href="/hr/employees" label="Tous les employés" />
            {can(PERMISSIONS.MANAGE_TIMEOFF) && <SubItem href="/hr/timeoff" label="Congés" />}
            {can(PERMISSIONS.MANAGE_PAYROLL) && <SubItem href="/hr/payroll" label="Paie" />}
          </CollapseItem>
        )}

        {/* ══════════════ DOCUMENTATIONS ══════════════ */}
        <SectionLabel label="DOCUMENTATIONS" collapsed={collapsed} />

        {can(PERMISSIONS.VIEW_DOCS) && (
          <CollapseItem icon={<BookOpen className="w-5 h-5" />} label="Documentations" collapsed={collapsed}>
            <SubItem href="/docs" label="Tous les documents" />
            <SubItem href="/docs/shared" label="Partagé avec moi" />
            <SubItem href="/docs/trash" label="Corbeille" />
            {can(PERMISSIONS.MANAGE_SETTINGS) && <SubItem href="/docs/categories" label="Toutes les catégories" />}
          </CollapseItem>
        )}

        <NavItem href="/search" icon={<Search className="w-5 h-5" />} label="Recherche" collapsed={collapsed} />

        {/* Bottom padding */}
        <div className="h-4" />
      </nav>
    </aside>
  );
}
