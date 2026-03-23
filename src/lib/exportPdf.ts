import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface ExportOptions {
  orientation?: "p" | "l";
  scale?: number;
  quality?: number;
}

/**
 * Export a DOM element's content to a PDF file with margins.
 * @param element - The DOM element to capture
 * @param filename - PDF filename (without extension)
 * @param options - PDF options (orientation)
 */
export async function exportElementToPdf(element: HTMLElement, filename: string, options?: ExportOptions) {
  const orientation = options?.orientation ?? "p";
  const scale = options?.scale ?? 2;
  const quality = options?.quality ?? 0.85;
  const isLandscape = orientation === "l";

  // Temporarily expand scrollable containers for full capture
  const scrollContainers = element.querySelectorAll<HTMLElement>(".overflow-x-auto, .overflow-auto");
  const savedStyles: { el: HTMLElement; overflow: string; maxWidth: string; width: string }[] = [];
  scrollContainers.forEach((el) => {
    savedStyles.push({ el, overflow: el.style.overflow, maxWidth: el.style.maxWidth, width: el.style.width });
    el.style.overflow = "visible";
    el.style.maxWidth = "none";
    el.style.width = `${el.scrollWidth}px`;
  });

  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: element.scrollWidth,
  });

  // Restore
  savedStyles.forEach(({ el, overflow, maxWidth, width }) => {
    el.style.overflow = overflow;
    el.style.maxWidth = maxWidth;
    el.style.width = width;
  });

  const imgData = canvas.toDataURL("image/jpeg", quality);

  const margin = 10; // mm
  const pageWidth = isLandscape ? 297 : 210; // A4
  const pageHeight = isLandscape ? 210 : 297;
  const contentWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * contentWidth) / canvas.width;

  const pdf = new jsPDF(orientation, "mm", "a4");
  let heightLeft = imgHeight;
  let position = margin;

  pdf.addImage(imgData, "JPEG", margin, position, contentWidth, imgHeight, undefined, "FAST");
  heightLeft -= (pageHeight - margin * 2);

  while (heightLeft > 0) {
    position = margin - (imgHeight - heightLeft);
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", margin, position, contentWidth, imgHeight, undefined, "FAST");
    heightLeft -= (pageHeight - margin * 2);
  }

  pdf.save(`${filename}.pdf`);
}
