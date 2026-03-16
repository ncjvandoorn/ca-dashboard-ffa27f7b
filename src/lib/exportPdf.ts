import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Export a DOM element's content to a PDF file with margins.
 * @param element - The DOM element to capture
 * @param filename - PDF filename (without extension)
 */
export async function exportElementToPdf(element: HTMLElement, filename: string) {
  const canvas = await html2canvas(element, {
    scale: 1.5,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.75);

  const margin = 10; // mm
  const pageWidth = 210; // A4
  const pageHeight = 297;
  const contentWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * contentWidth) / canvas.width;

  const pdf = new jsPDF("p", "mm", "a4");
  let heightLeft = imgHeight;
  let position = margin;

  pdf.addImage(imgData, "PNG", margin, position, contentWidth, imgHeight);
  heightLeft -= (pageHeight - margin * 2);

  while (heightLeft > 0) {
    position = margin - (imgHeight - heightLeft);
    pdf.addPage();
    pdf.addImage(imgData, "PNG", margin, position, contentWidth, imgHeight);
    heightLeft -= (pageHeight - margin * 2);
  }

  pdf.save(`${filename}.pdf`);
}
