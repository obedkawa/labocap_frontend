import apiClient from "./client";

export interface DashboardStats {
  patients: number;
  contrats: number;
  tests: number;
  testOrdersCount: number;
  finishTest: number;
  noSaveTest: number;
  noFinishTest: number;
  noFinishWeek: number;
  // Admin
  valeurPatient?: number;
  crPatient?: number;
  valeurClient?: number;
  crClient?: number;
  valeurTestOrder?: number;
  crTestOrder?: number;
  valeurInvoice?: number;
  crInvoice?: number;
}

export interface ReportToday {
  id: string;
  testOrderId: string;
  code: string;
  patientLastname: string;
  patientFirstname: string;
  createdAt: string;
  status: number;
  isDeliver: number;
  invoiceId?: string;
}

export interface DoctorStat {
  doctor: string;
  assigne: number;
  traite: number;
}

export interface TopExamen {
  testName: string;
  totalDemandes: number;
}

// ByItem correspond au record ByItem du backend (champ "nom" et non "nomHopital" etc.)
export interface ByItem {
  nom: string;
  totalPatients: number;
}

export interface MonthlyStats {
  nombreTests: number;
  caTests: number;
  totalPatientTest: number;
  byHopital: ByItem[];
  byMedecin: ByItem[];
  byType: ByItem[];
}

export interface RevenueData {
  totalCurrentWeek: number;
  totalLastWeek: number;
  totalToday: number;
  currentWeekByDay: Array<{ date: string; total: number }>;
  lastWeekByDay: Array<{ date: string; total: number }>;
}

export interface InvoiceStatusData {
  invoicePaid: number;
  invoiceNoPaid: number;
  refundPaid: number;
  refundNoPaid: number;
  invoiceTotalPaid: number;
  invoiceTotalNoPaid: number;
  refundTotalPaid: number;
  refundTotalNoPaid: number;
}

export interface ExamStatusChart {
  termine: number;
  enAttente: number;
}

export interface AppointmentItem {
  id: string;
  patientName: string;
  date: string;
  priority: string;
  status: string;
  message?: string;
}

export interface ConnectedUser {
  id: string;
  lastname: string;
  firstname: string;
  email: string;
}

export interface DoctorOrder {
  id: string;
  code: string;
  createdAt: string;
  patientFirstname: string;
  patientLastname: string;
  reportStatus: number; // 0 = en attente, 1 = terminé
}

export const dashboardApi = {
  getStats: () => apiClient.get<DashboardStats>("/dashboard/stats"),
  getReportsToday: () => apiClient.get<ReportToday[]>("/dashboard/reports-today"),
  getDoctorStats: () => apiClient.get<DoctorStat[]>("/dashboard/doctor-stats"),
  getTopExamens: () => apiClient.get<TopExamen[]>("/dashboard/top-examens"),
  getMonthlyStats: () => apiClient.get<MonthlyStats>("/dashboard/monthly-stats"),
  getConnectedUsers: () => apiClient.get<ConnectedUser[]>("/dashboard/connected-users"),
  getRevenueData: () => apiClient.get<RevenueData>("/dashboard/revenue"),
  getInvoiceStatus: () => apiClient.get<InvoiceStatusData>("/dashboard/invoice-status"),
  getDoctorExamStatus: () => apiClient.get<ExamStatusChart>("/dashboard/doctor/exam-status"),
  getDoctorAppointments: () => apiClient.get<AppointmentItem[]>("/dashboard/doctor/appointments"),
  getDoctorOrders: () => apiClient.get<DoctorOrder[]>("/dashboard/doctor/orders"),
  getDoctorOrdersToday: () => apiClient.get<DoctorOrder[]>("/dashboard/doctor/orders-today"),
};
