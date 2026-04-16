import type { QualityReport } from "@/lib/csvParser";

const REPORT_DATA_FIELDS: (keyof QualityReport)[] = [
  "qrGenQualityRating",
  "qrIntakePh",
  "qrIntakeEc",
  "qrIntakeHeadSize",
  "qrIntakeHumidityColdstore",
  "qrIntakeStemLength",
  "qrIntakeTempColdstore",
  "qrIntakeWaterQuality",
  "qrExportPh",
  "qrExportEc",
  "qrExportHumidityColdstore",
  "qrExportTempColdstore",
  "qrExportWaterQuality",
  "qrDispatchPackingQuality",
  "qrDispatchPackrate",
  "qrPackProcessingSpeed",
  "qrGenQualityFlowers",
  "qrGenDippingLocation",
  "qrGenProtocolChanges",
  "qrIntakeTreatment",
  "qrIntakeDippingStand",
  "qrIntakeUsingNets",
  "qrExportTreatment",
  "qrDispatchTruckType",
  "qrDispatchUsedLiner",
  "generalComment",
  "signoffName",
];

export function hasVisibleReportData(report: QualityReport): boolean {
  return REPORT_DATA_FIELDS.some((field) => {
    const value = report[field];
    return value !== null && value !== "";
  });
}

export function isVisibleFarmReport(report: QualityReport): boolean {
  return report.weekNr > 0 && hasVisibleReportData(report);
}

export function getReportTimestamp(report: QualityReport): number | null {
  return report.submittedAt ?? report.createdAt;
}
