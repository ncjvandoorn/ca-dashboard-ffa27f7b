import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Export a DOM element to PDF, keeping elements marked with [data-pdf-section]
 * from being split across pages. Captures each section individually.
 */
export async function exportSectionsPdf(container: HTMLElement, filename: string) {
  const scale = 2;
  const quality = 0.9;
  const margin = 10; // mm
  const pageWidth = 210; // A4 portrait
  const pageHeight = 297;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;

  // Gather all direct children and sections
  const children = Array.from(container.children) as HTMLElement[];

  // Capture each child block separately
  const blocks: { canvas: HTMLCanvasElement; heightMm: number }[] = [];

  for (const child of children) {
    const canvas = await html2canvas(child, {
      scale,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
    const heightMm = (canvas.height * contentWidth) / canvas.width;
    blocks.push({ canvas, heightMm });
  }

  const pdf = new jsPDF("p", "mm", "a4");
  let cursorY = margin;

  for (let i = 0; i < blocks.length; i++) {
    const { canvas, heightMm } = blocks[i];
    const isSection = children[i].hasAttribute("data-pdf-section");

    // If this section won't fit on the current page and we're not at the top, start a new page
    if (cursorY > margin && isSection && cursorY + heightMm > pageHeight - margin) {
      pdf.addPage();
      cursorY = margin;
    }

    // If a single block is taller than a page, just render it (it'll overflow, but that's rare for sections)
    const imgData = canvas.toDataURL("image/jpeg", quality);
    pdf.addImage(imgData, "JPEG", margin, cursorY, contentWidth, heightMm, undefined, "FAST");
    cursorY += heightMm + 3; // 3mm gap between blocks

    // If cursor exceeds page, start new page for next block
    if (cursorY > pageHeight - margin && i < blocks.length - 1) {
      pdf.addPage();
      cursorY = margin;
    }
  }

  pdf.save(`${filename}.pdf`);
}
