export const PERMISSIONS = {
  // Patients
  VIEW_PATIENTS: "view-patients",
  CREATE_PATIENTS: "create-patients",
  EDIT_PATIENTS: "edit-patients",
  DELETE_PATIENTS: "delete-patients",

  // Tests / Examens catalogue
  VIEW_TESTS: "view-tests",
  CREATE_TESTS: "create-tests",
  EDIT_TESTS: "edit-tests",
  DELETE_TESTS: "delete-tests",
  VIEW_CATEGORY_TESTS: "view-category-tests",

  // Test Orders / Demandes
  VIEW_TEST_ORDER_ASSIGNMENTS: "view-test-order-assignments",
  MANAGE_TEST_ORDER_ASSIGNMENTS: "manage-test-order-assignments",
  VIEW_TEST_ORDERS: "view-test-orders",
  CREATE_TEST_ORDERS: "create-test-orders",
  EDIT_TEST_ORDERS: "edit-test-orders",
  DELETE_TEST_ORDERS: "delete-test-orders",
  VALIDATE_TEST_ORDERS: "validate-test-orders",

  // Reports
  VIEW_REPORTS: "view-reports",
  CREATE_REPORTS: "create-reports",
  EDIT_REPORTS: "edit-reports",
  DELETE_REPORTS: "delete-reports",
  REVIEW_REPORTS: "review-reports",
  VALIDATE_REPORTS: "validate-reports",
  SIGN_REPORTS: "sign-reports",
  DELIVER_REPORTS: "deliver-reports",

  // Macroscopy
  VIEW_MACRO: "view-macro",
  CREATE_MACRO: "create-macro",
  EDIT_MACRO: "edit-macro",

  // Invoices
  VIEW_INVOICES: "view-invoices",
  CREATE_INVOICES: "create-invoices",
  EDIT_INVOICES: "edit-invoices",
  DELETE_INVOICES: "delete-invoices",
  MANAGE_FINANCE: "view-dashbord-finance",

  // Cashbox (granular — from Laravel @can slugs)
  VIEW_CASHBOX: "view-cashbox",
  VIEW_CASHBOXES: "view-cashboxes",
  MANAGE_CASHBOX: "manage-cashbox",
  VIEW_CASHBOX_ADDS: "view-cashbox-adds",
  VIEW_CASHBOX_TICKETS: "view-cashbox-tickets",
  VIEW_CASHBOX_DAILIES: "view-cashbox-dailies",
  CREATE_CASHBOX_DAILIES: "create-cashbox-dailies",
  EDIT_CASHBOX_DAILIES: "edit-cashbox-dailies",
  CREATE_CASHBOX_TICKETS: "create-cashbox-tickets",

  // Banks
  VIEW_BANKS: "view-banks",
  CREATE_BANKS: "create-banks",
  EDIT_BANKS: "edit-banks",
  DELETE_BANKS: "delete-banks",

  // Doctors
  VIEW_DOCTORS: "view-doctors",
  CREATE_DOCTORS: "create-doctors",
  EDIT_DOCTORS: "edit-doctors",
  DELETE_DOCTORS: "delete-doctors",

  // Hospitals
  VIEW_HOSPITALS: "view-hospitals",
  CREATE_HOSPITALS: "create-hospitals",
  EDIT_HOSPITALS: "edit-hospitals",
  DELETE_HOSPITALS: "delete-hospitals",

  // Clients
  VIEW_CLIENTS: "view-clients",
  CREATE_CLIENTS: "create-clients",
  EDIT_CLIENTS: "edit-clients",
  DELETE_CLIENTS: "delete-clients",

  // Contracts (Laravel uses 'view-contrats')
  VIEW_CONTRATS: "view-contrats",
  VIEW_CONTRACTS: "view-contracts",
  CREATE_CONTRACTS: "create-contracts",
  EDIT_CONTRACTS: "edit-contracts",
  DELETE_CONTRACTS: "delete-contracts",

  // Expenses
  VIEW_EXPENSES: "view-expenses",
  CREATE_EXPENSES: "create-expenses",
  EDIT_EXPENSES: "edit-expenses",
  DELETE_EXPENSES: "delete-expenses",

  // Inventory
  VIEW_ARTICLES: "view-articles",
  CREATE_ARTICLES: "create-articles",
  EDIT_ARTICLES: "edit-articles",
  DELETE_ARTICLES: "delete-articles",

  // Suppliers
  VIEW_SUPPLIERS: "view-suppliers",
  CREATE_SUPPLIERS: "create-suppliers",
  EDIT_SUPPLIERS: "edit-suppliers",
  DELETE_SUPPLIERS: "delete-suppliers",

  // HR — slugs réels du backend Spring Boot
  VIEW_HR: "view-hr",
  MANAGE_EMPLOYEES: "manage-employees",
  VIEW_EMPLOYEES: "view-employees",
  CREATE_EMPLOYEES: "manage-employees",
  EDIT_EMPLOYEES: "manage-employees",
  DELETE_EMPLOYEES: "manage-employees",
  MANAGE_PAYROLL: "view-employee-payrolls",
  MANAGE_TIMEOFF: "view-employee-timeoffs",

  // Dashboard (rôle-based views)
  VIEW_ADMIN_DASHBOARD: "view-admin-dashboard",
  VIEW_SECRETARIAT_DASHBOARD: "view-secretariat-dashboard",
  VIEW_PATHOLOGIST_DASHBOARD: "view-pathologist-dashboard",
  VIEW_DASHBORD_FINANCE: "view-dashbord-finance",

  // Settings / Admin (granular)
  VIEW_SETTING_INVOICE: "view-setting-invoice",
  VIEW_SETTING_REPORT_TEMPLATES: "view-setting-report-templates",
  VIEW_MOVEMENTS: "view-movements",
  VIEW_REFUND_REQUESTS: "view-refund-requests",
  VIEW_PERMISSIONS: "view-permissions",
  VIEW_ROLES: "view-roles",
  VIEW_SETTINGS: "view-settings",
  MANAGE_SETTINGS: "edit-settings",
  VIEW_USERS: "view-users",
  CREATE_USERS: "create-users",
  EDIT_USERS: "edit-users",
  DELETE_USERS: "delete-users",
  // Écriture des rôles (création / édition / suppression).
  // La seule permission de gestion des rôles seedée en base est `manage-roles`
  // (V2__seed_permissions.sql) — c'est elle que l'utilisateur ADMIN possède réellement.
  // NB : le backend RoleController annote actuellement ses routes avec
  // `hasAuthority('edit-roles')` alors que sa propre Javadoc dit `manage-roles` :
  // incohérence backend à corriger côté API. On gate l'UI sur la permission
  // réellement attribuée (`manage-roles`) et surtout PAS sur `view-roles` (lecture).
  MANAGE_ROLES: "manage-roles",
  MANAGE_PERMISSIONS: "manage-permissions",

  // Consultations
  VIEW_CONSULTATIONS: "view-consultations",
  CREATE_CONSULTATIONS: "create-consultations",
  EDIT_CONSULTATIONS: "edit-consultations",
  DELETE_CONSULTATIONS: "delete-consultations",
  VIEW_TYPE_CONSULTATIONS: "view-type-consultations",

  // Prestations
  VIEW_PRESTATIONS: "view-prestations",
  CREATE_PRESTATIONS: "create-prestations",
  EDIT_PRESTATIONS: "edit-prestations",
  DELETE_PRESTATIONS: "delete-prestations",

  // Commandes de prestations
  VIEW_PRESTATION_ORDERS: "view-prestation-orders",
  CREATE_PRESTATION_ORDERS: "create-prestation-orders",
  EDIT_PRESTATION_ORDERS: "edit-prestation-orders",
  DELETE_PRESTATION_ORDERS: "delete-prestation-orders",

  // Support / Tickets
  VIEW_SUPPORT: "view-support",
  MANAGE_SUPPORT: "manage-support",

  // Documentation
  VIEW_DOCS: "view-documentation-categories",
  CREATE_DOCS: "create-docs",
  EDIT_DOCS: "edit-docs",
  DELETE_DOCS: "delete-docs",

  // Refunds
  VIEW_REFUNDS: "view-refund-requests",
  MANAGE_REFUNDS: "manage-refunds",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
