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
  qrGenQualityRating: number | null;
  qrGenQualityFlowers: string | null;
  qrGenDippingLocation: string | null;
  qrGenProtocolChanges: string | null;
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
  qrExportPh: number | null;
  qrExportEc: number | null;
  qrExportTempColdstore: number | null;
  qrExportHumidityColdstore: number | null;
  qrExportColdstoreHours: number | null;
  qrExportWaterQuality: number | null;
  qrExportTreatment: string | null;
  qrDispatchPackingQuality: number | null;
  qrDispatchPackrate: number | null;
  qrDispatchTruckType: string | null;
  qrDispatchUsedLiner: string | null;
  qrPackProcessingSpeed: number | null;
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

/** Parse a date field that may be a Unix-ms timestamp OR an ISO date string. Returns ms since epoch. */
function parseDate(val: string): number | null {
  if (!val || val.trim() === "") return null;
  const trimmed = val.trim();
  // If it looks like a number (Unix ms timestamp), parse as float
  const num = Number(trimmed);
  if (!isNaN(num) && trimmed.match(/^\d+(\.\d+)?$/)) {
    return num;
  }
  // Otherwise try parsing as a date string (ISO 8601, etc.)
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.getTime();
  }
  return null;
}

function parseStr(val: string): string | null {
  if (!val || val.trim() === "") return null;
  return val.trim();
}

async function fetchCsv<T>(url: string, transform: (row: Record<string, string>) => T): Promise<T[]> {
  const response = await fetch(url, { cache: "no-store" });
  const text = await response.text();
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: "greedy",      // skip lines that are empty or only whitespace
    transformHeader: (h) => h.trim(), // trim whitespace from header names
    quoteChar: '"',
  });
  // Filter out rows that have no id (likely parse artifacts from multiline fields)
  return (result.data as Record<string, string>[])
    .filter((row) => row.id && row.id.trim() !== "")
    .map(transform);
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
  assignedUserId: string;
  ownerUserId: string;
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
    assignedUserId: row.assignedUserId || "",
    ownerUserId: row.ownerUserId || "",
    type: row.type || "",
    status: row.status || "",
    subject: parseStr(row.subject) || "",
    description: parseStr(row.description) || "",
    startsAt: parseDate(row.startsAt),
    completedAt: parseDate(row.completedAt),
    createdAt: parseDate(row.createdAt),
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
    createdAt: parseDate(row.createdAt),
    deletedAt: parseDate(row.deletedAt),
  }));
}

export interface Container {
  id: string;
  bookingCode: string;
  containerNumber: string;
  dropoffDate: number | null;
  shippingDate: number | null;
  shippingLineId: string;
}

export async function loadContainers(): Promise<Container[]> {
  const url = await getDataFileUrl("container.csv");
  return fetchCsv(url, (row) => ({
    id: row.id,
    bookingCode: row.bookingCode || "",
    containerNumber: row.containerNumber || "",
    dropoffDate: parseDate(row.dropoffDate),
    shippingDate: parseDate(row.shippingDate),
    shippingLineId: row.shippingLineId || "",
  }));
}

export interface ServicesOrder {
  id: string;
  orderNumber: string;
  containerId: string;
  customerAccountId: string;
  farmAccountId: string;
  dippingDate: number | null;
  dippingWeek: string;
  pallets: number | null;
  forecast: number | null;
  statusName: string;
  purposeName: string;
  shipperReportId: string;
  qualityReportId: string;
}

export async function loadServicesOrders(): Promise<ServicesOrder[]> {
  const url = await getDataFileUrl("servicesOrder.csv");
  return fetchCsv(url, (row) => ({
    id: row.id,
    orderNumber: row.orderNumber || "",
    containerId: row.containerId || "",
    customerAccountId: row.customerAccountId || "",
    farmAccountId: row.farmAccountId || "",
    dippingDate: parseDate(row.dippingDate),
    dippingWeek: row.dippingWeek || "",
    pallets: parseNum(row.pallets),
    forecast: parseNum(row.forecast),
    statusName: row.statusName || "",
    purposeName: row.purposeName || "",
    shipperReportId: row.shipperReportId || "",
    qualityReportId: row.qualityReportId || "",
  }));
}

export interface ShipperArrival {
  id: string;
  servicesOrderId: string;
  arrivalDate: number | null;
  dischargeWaitingMin: number | null;
  gensetOffMoment: string | null;
  arrivalTemp1: number | null;
  arrivalTemp2: number | null;
  arrivalTemp3: number | null;
  afterVc1Temp: number | null;
  afterVc2Temp: number | null;
  afterVc3Temp: number | null;
  specificComments: string | null;
  vcCycles: number | null;
  vcDurationMin: number | null;
}

export async function loadShipperArrivals(): Promise<ShipperArrival[]> {
  const url = await getDataFileUrl("shipperArrival.csv");
  return fetchCsv(url, (row) => ({
    id: row.id,
    servicesOrderId: row.servicesOrderId || "",
    arrivalDate: parseDate(row.arrivalDate),
    dischargeWaitingMin: parseNum(row.dischargeWaitingMin),
    gensetOffMoment: parseStr(row.gensetOffMoment),
    arrivalTemp1: parseNum(row.arrivalTemp1),
    arrivalTemp2: parseNum(row.arrivalTemp2),
    arrivalTemp3: parseNum(row.arrivalTemp3),
    afterVc1Temp: parseNum(row.afterVc1Temp),
    afterVc2Temp: parseNum(row.afterVc2Temp),
    afterVc3Temp: parseNum(row.afterVc3Temp),
    specificComments: parseStr(row.specificComments),
    vcCycles: parseNum(row.vcCycles),
    vcDurationMin: parseNum(row.vcDurationMin),
  }));
}

export interface ShipperReport {
  id: string;
  weekNr: string;
  containerId: string;
  stuffingDate: number | null;
  loadingMin: number | null;
  generalComments: string | null;
  approvedMtAt: number | null;
}

export interface ShippingLine {
  id: string;
  name: string;
}

export async function loadShippingLines(): Promise<ShippingLine[]> {
  const url = await getDataFileUrl("shippingLine.csv");
  return fetchCsv(url, (row) => ({
    id: row.id,
    name: row.name || "Unknown",
  }));
}

export async function loadShipperReports(): Promise<ShipperReport[]> {
  const url = await getDataFileUrl("shipperReport.csv");
  return fetchCsv(url, (row) => ({
    id: row.id,
    weekNr: row.weekNr || "",
    containerId: row.containerId || "",
    stuffingDate: parseDate(row.stuffingDate),
    loadingMin: parseNum(row.loadingMin),
    generalComments: parseStr(row.generalComments),
    approvedMtAt: parseDate(row.approvedMtAt),
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
    submittedAt: parseDate(row.submittedAt),
    submittedByUserId: parseStr(row.submittedByUserId),
    createdByUserId: parseStr(row.createdById),
    updatedByUserId: parseStr(row.updatedById),
    generalComment: parseStr(row.generalComment),
  }));
}
