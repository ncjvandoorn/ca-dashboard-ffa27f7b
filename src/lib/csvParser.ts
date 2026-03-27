import Papa from "papaparse";
import { getDataFileUrl } from "./dataFileUrl";

export interface Account {
  id: string;
  name: string;
  publicId: string;
  servicesEnabled: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  position: string;
  countryName: string;
}

export async function loadUsers(): Promise<User[]> {
  const url = await getDataFileUrl("user.csv");
  return fetchCsv(url, (row) => ({
    id: row.id,
    name: row.name || "Unknown",
    email: row.email || "",
    position: row.position || "",
    countryName: row.countryName || "",
  }));
}

export interface QualityReport {
  id: string;
  farmAccountId: string;
  weekNr: number;
  createdAt: number;
  // General
  qrGenQualityRating: number | null;
  qrGenQualityFlowers: string | null;
  qrGenDippingLocation: string | null;
  qrGenProtocolChanges: string | null;
  // Intake
  qrIntakePh: number | null;
  qrIntakeEc: number | null;
  qrIntakeHeadSize: number | null;
  qrIntakeStemLength: number | null;
  qrIntakeTempColdstore: number | null;
  qrIntakeHumidityColdstore: number | null;
  qrIntakeColdstoreHours: number | null;
  qrIntakeWaterQuality: number | null;
  qrIntakeTreatment: string | null;
  qrIntakeDippingStand: string | null;
  qrIntakeUsingNets: string | null;
  // Export
  qrExportPh: number | null;
  qrExportEc: number | null;
  qrExportTempColdstore: number | null;
  qrExportHumidityColdstore: number | null;
  qrExportColdstoreHours: number | null;
  qrExportWaterQuality: number | null;
  qrExportTreatment: string | null;
  // Dispatch
  qrDispatchPackingQuality: number | null;
  qrDispatchPackrate: number | null;
  qrDispatchTruckType: string | null;
  qrDispatchUsedLiner: string | null;
  // Packhouse
  qrPackProcessingSpeed: number | null;
  // Sign off
  signoffName: string | null;
  submittedAt: number | null;
  submittedByUserId: string | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  generalComment: string | null;
}

function parseNum(val: string): number | null {
  if (!val || val.trim() === "") return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function parseStr(val: string): string | null {
  if (!val || val.trim() === "") return null;
  return val.trim();
}

async function fetchCsv<T>(url: string, transform: (row: Record<string, string>) => T): Promise<T[]> {
  const response = await fetch(url);
  const text = await response.text();
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
  return (result.data as Record<string, string>[]).map(transform);
}

export async function loadAccounts(): Promise<Account[]> {
  const url = await getDataFileUrl("account.csv");
  return fetchCsv(url, (row) => ({
    id: row.id,
    name: row.name || "Unknown",
    publicId: row.publicId || "",
    servicesEnabled: row.servicesEnabled || "",
  }));
}

export interface Activity {
  id: string;
  accountId: string;
  type: string;
  status: string;
  subject: string;
  description: string;
  startsAt: number | null;
  completedAt: number | null;
  createdAt: number | null;
}

export async function loadActivities(): Promise<Activity[]> {
  const url = await getDataFileUrl("activity.csv");
  return fetchCsv(url, (row) => ({
    id: row.id,
    accountId: row.accountId || "",
    type: row.type || "",
    status: row.status || "",
    subject: parseStr(row.subject) || "",
    description: parseStr(row.description) || "",
    startsAt: parseNum(row.startsAt),
    completedAt: parseNum(row.completedAt),
    createdAt: parseNum(row.createdAt),
  }));
}

export interface CustomerFarm {
  id: string;
  customerAccountId: string;
  farmAccountId: string;
  farmAccountConsent: string;
  createdAt: number | null;
  deletedAt: number | null;
}

export async function loadCustomerFarms(): Promise<CustomerFarm[]> {
  const url = await getDataFileUrl("customerFarm.csv");
  return fetchCsv(url, (row) => ({
    id: row.id,
    customerAccountId: row.customerAccountId || "",
    farmAccountId: row.farmAccountId || "",
    farmAccountConsent: row.farmAccountConsent || "",
    createdAt: parseNum(row.createdAt),
    deletedAt: parseNum(row.deletedAt),
  }));
}

export async function loadQualityReports(): Promise<QualityReport[]> {
  const url = await getDataFileUrl("qualityReport.csv");
  return fetchCsv(url, (row) => ({
    id: row.id,
    farmAccountId: row.farmAccountId,
    weekNr: parseInt(row.weekNr) || 0,
    createdAt: parseInt(row.createdAt) || 0,
    qrGenQualityRating: parseNum(row.qrGenQualityRating),
    qrGenQualityFlowers: parseStr(row.qrGenQualityFlowers),
    qrGenDippingLocation: parseStr(row.qrGenDippingLocation),
    qrGenProtocolChanges: parseStr(row.qrGenProtocolChanges),
    qrIntakePh: parseNum(row.qrIntakePh),
    qrIntakeEc: parseNum(row.qrIntakeEc),
    qrIntakeHeadSize: parseNum(row.qrIntakeHeadSize),
    qrIntakeStemLength: parseNum(row.qrIntakeStemLength),
    qrIntakeTempColdstore: parseNum(row.qrIntakeTempColdstore),
    qrIntakeHumidityColdstore: parseNum(row.qrIntakeHumidityColdstore),
    qrIntakeColdstoreHours: parseNum(row.qrIntakeColdstoreHours),
    qrIntakeWaterQuality: parseNum(row.qrIntakeWaterQuality),
    qrIntakeTreatment: parseStr(row.qrIntakeTreatment),
    qrIntakeDippingStand: parseStr(row.qrIntakeDippingStand),
    qrIntakeUsingNets: parseStr(row.qrIntakeUsingNets),
    qrExportPh: parseNum(row.qrExportPh),
    qrExportEc: parseNum(row.qrExportEc),
    qrExportTempColdstore: parseNum(row.qrExportTempColdstore),
    qrExportHumidityColdstore: parseNum(row.qrExportHumidityColdstore),
    qrExportColdstoreHours: parseNum(row.qrExportColdstoreHours),
    qrExportWaterQuality: parseNum(row.qrExportWaterQuality),
    qrExportTreatment: parseStr(row.qrExportTreatment),
    qrDispatchPackingQuality: parseNum(row.qrDispatchPackingQuality),
    qrDispatchPackrate: parseNum(row.qrDispatchPackrate),
    qrDispatchTruckType: parseStr(row.qrDispatchTruckType),
    qrDispatchUsedLiner: parseStr(row.qrDispatchUsedLiner),
    qrPackProcessingSpeed: parseNum(row.qrPackProcessingSpeed),
    signoffName: parseStr(row.signoffName),
    submittedAt: parseNum(row.submittedAt),
    submittedByUserId: parseStr(row.submittedByUserId),
    createdByUserId: parseStr(row.createdById),
    updatedByUserId: parseStr(row.updatedById),
    generalComment: parseStr(row.generalComment),
  }));
}
    farmAccountId: row.farmAccountId,
    weekNr: parseInt(row.weekNr) || 0,
    createdAt: parseInt(row.createdAt) || 0,
    qrGenQualityRating: parseNum(row.qrGenQualityRating),
    qrGenQualityFlowers: parseStr(row.qrGenQualityFlowers),
    qrGenDippingLocation: parseStr(row.qrGenDippingLocation),
    qrGenProtocolChanges: parseStr(row.qrGenProtocolChanges),
    qrIntakePh: parseNum(row.qrIntakePh),
    qrIntakeEc: parseNum(row.qrIntakeEc),
    qrIntakeHeadSize: parseNum(row.qrIntakeHeadSize),
    qrIntakeStemLength: parseNum(row.qrIntakeStemLength),
    qrIntakeTempColdstore: parseNum(row.qrIntakeTempColdstore),
    qrIntakeHumidityColdstore: parseNum(row.qrIntakeHumidityColdstore),
    qrIntakeColdstoreHours: parseNum(row.qrIntakeColdstoreHours),
    qrIntakeWaterQuality: parseNum(row.qrIntakeWaterQuality),
    qrIntakeTreatment: parseStr(row.qrIntakeTreatment),
    qrIntakeDippingStand: parseStr(row.qrIntakeDippingStand),
    qrIntakeUsingNets: parseStr(row.qrIntakeUsingNets),
    qrExportPh: parseNum(row.qrExportPh),
    qrExportEc: parseNum(row.qrExportEc),
    qrExportTempColdstore: parseNum(row.qrExportTempColdstore),
    qrExportHumidityColdstore: parseNum(row.qrExportHumidityColdstore),
    qrExportColdstoreHours: parseNum(row.qrExportColdstoreHours),
    qrExportWaterQuality: parseNum(row.qrExportWaterQuality),
    qrExportTreatment: parseStr(row.qrExportTreatment),
    qrDispatchPackingQuality: parseNum(row.qrDispatchPackingQuality),
    qrDispatchPackrate: parseNum(row.qrDispatchPackrate),
    qrDispatchTruckType: parseStr(row.qrDispatchTruckType),
    qrDispatchUsedLiner: parseStr(row.qrDispatchUsedLiner),
    qrPackProcessingSpeed: parseNum(row.qrPackProcessingSpeed),
    signoffName: parseStr(row.signoffName),
    submittedAt: parseNum(row.submittedAt),
    submittedByUserId: parseStr(row.submittedByUserId),
    createdByUserId: parseStr(row.createdById),
    updatedByUserId: parseStr(row.updatedById),
    generalComment: parseStr(row.generalComment),
  }));
}
