import AdmitPatientPage from "./src/pages/AdmitPatientPage";
import TransferPatientPage from "./src/pages/TransferPatientPage";
import DischargePatientPage from "./src/pages/DischargePatientPage";
import TreatmentPage from "./src/pages/TreatmentPage";
import PatientsByWardPage from "./src/pages/PatientsByWardPage";
import PatientsByTeamPage from "./src/pages/PatientsByTeamPage";
import PatientDetailsPage from "./src/pages/PatientDetailsPage";
import ManageWardsPage from "./src/pages/ManageWardsPage";
import ManageDoctorsPage from "./src/pages/ManageDoctorsPage";
import DashboardPage from "./src/pages/DashboardPage";
import AppointmentsPage from "./src/pages/AppointmentsPage";
import ReportsPage from "./src/pages/ReportsPage";
import PatientFreeDoctorsPage from "./src/pages/PatientFreeDoctorsPage";
import PatientAdmissionRecordsPage from "./src/pages/PatientAdmissionRecordsPage";
import PatientMyCasesPage from "./src/pages/PatientMyCasesPage";
import AIAssistantPage from "./src/pages/AIAssistantPage.jsx";

/** 管理员侧栏（与原先一致） */
export const ADMIN_NAV_ITEMS = [
  { id: "dashboard", label: "工作台", icon: "dashboard" },
  { id: "admit", label: "办理入院", icon: "admit" },
  { id: "transfer", label: "患者转科", icon: "transfer" },
  { id: "discharge", label: "办理出院", icon: "discharge" },
  { id: "treatment", label: "诊疗记录", icon: "treatment" },
  { id: "byWard", label: "按病区查询患者", icon: "ward" },
  { id: "byTeam", label: "按医疗组查询患者", icon: "team" },
  { id: "patientDetails", label: "患者详情", icon: "details" },
  { id: "manageWards", label: "病区管理", icon: "manageWard" },
  { id: "manageDoctors", label: "医生管理", icon: "manageDoctors" },
  { id: "appointments", label: "预约挂号", icon: "appointments" },
  { id: "reports", label: "统计报表", icon: "reports" },
  { id: "aiAssistant", label: "管理小助手", icon: "aiAssistant" },
];

/** 兼容旧引用：等同于管理员菜单 */
export const NAV_ITEMS = ADMIN_NAV_ITEMS;

/** 患者端侧栏首页模块 id */
export const PATIENT_ROOT_ID = "patientFreeDoctors";

/** 患者侧栏（仅三项） */
export const PATIENT_NAV_ITEMS = [
  { id: PATIENT_ROOT_ID, label: "查看指定时间段空闲医生", icon: "patientCalendar" },
  { id: "patientAdmissionRecords", label: "查看住院记录", icon: "patientBed" },
  { id: "patientMyCases", label: "我的病例", icon: "patientCase" },
  { id: "aiAssistant", label: "健康小助手", icon: "aiAssistant" },
];

export function isPatientRole(role) {
  return String(role ?? "").toUpperCase() === "PATIENT";
}

export function getNavItemsForRole(role) {
  return isPatientRole(role) ? PATIENT_NAV_ITEMS : ADMIN_NAV_ITEMS;
}

export function getDefaultActiveId(role) {
  return isPatientRole(role) ? PATIENT_ROOT_ID : "dashboard";
}

/** 面包屑根节点：管理员为「工作台」，患者为「患者服务」 */
export function getDashboardRoot(role) {
  if (isPatientRole(role)) {
    return { id: PATIENT_ROOT_ID, label: "患者服务" };
  }
  return { id: "dashboard", label: "工作台" };
}

/** AI 助手展示名（与侧栏菜单一致）：患者「健康」、医护端「管理」 */
export function getAiAssistantDisplayName(role) {
  return isPatientRole(role) ? "健康小助手" : "管理小助手";
}

export const PAGES = {
  dashboard: DashboardPage,
  admit: AdmitPatientPage,
  transfer: TransferPatientPage,
  discharge: DischargePatientPage,
  treatment: TreatmentPage,
  byWard: PatientsByWardPage,
  byTeam: PatientsByTeamPage,
  patientDetails: PatientDetailsPage,
  manageWards: ManageWardsPage,
  manageDoctors: ManageDoctorsPage,
  appointments: AppointmentsPage,
  reports: ReportsPage,
  patientFreeDoctors: PatientFreeDoctorsPage,
  patientAdmissionRecords: PatientAdmissionRecordsPage,
  patientMyCases: PatientMyCasesPage,
  aiAssistant: AIAssistantPage,
};
