import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Export a DOM element to PDF, keeping elements marked with [data-pdf-section]
 * from being split across pages. Captures each logical block individually and
 * handles tall blocks that exceed a single page by slicing them cleanly.
 */
export async function exportSectionsPdf(container: HTMLElement, filename: string) {
  const scale = 2;
  const quality = 0.9;
  const margin = 10; // mm
  const pageWidth = 210; // A4 portrait
  const pageHeight = 297;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;

  // Collect all renderable blocks — walk deeper into containers to find
  // individual [data-pdf-section] elements, falling back to direct children.
  const blocks: HTMLElement[] = [];

  function collectBlocks(parent: HTMLElement) {
    const children = Array.from(parent.children) as HTMLElement[];
    for (const child of children) {
      if (child.hasAttribute("data-pdf-section")) {
        blocks.push(child);
      } else if (child.children.length > 0) {
        // Check if any descendant has data-pdf-section
        const hasSections = child.querySelector("[data-pdf-section]");
        if (hasSections) {
          // Recurse into this container
          collectBlocks(child);
        } else {
          blocks.push(child);
        }
      } else {
        blocks.push(child);
      }
    }
  }

  collectBlocks(container);

  // Capture each block
  const captures: { canvas: HTMLCanvasElement; heightMm: number }[] = [];
  for (const block of blocks) {
    const canvas = await html2canvas(block, {
      scale,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
    const heightMm = (canvas.height * contentWidth) / canvas.width;
    captures.push({ canvas, heightMm });
  }

  const pdf = new jsPDF("p", "mm", "a4");
  let cursorY = margin;

  for (let i = 0; i < captures.length; i++) {
    const { canvas, heightMm } = captures[i];
    const imgData = canvas.toDataURL("image/jpeg", quality);

    // If this block won't fit on the current page and we're not at the top, new page
    if (cursorY > margin && cursorY + heightMm > pageHeight - margin) {
      pdf.addPage();
      cursorY = margin;
    }

    if (heightMm <= contentHeight) {
      // Block fits on a single page
      pdf.addImage(imgData, "JPEG", margin, cursorY, contentWidth, heightMm, undefined, "FAST");
      cursorY += heightMm + 2;
    } else {
      // Block is taller than one page — slice it across pages
      let remainingHeight = heightMm;
      let sourceY = 0;

      while (remainingHeight > 0) {
        const sliceHeight = Math.min(contentHeight - (cursorY - margin), remainingHeight);
        const sliceRatio = sliceHeight / heightMm;
        const sourceSliceH = canvas.height * sliceRatio;

        // Create a temporary canvas for this slice
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.round(sourceSliceH);
        const ctx = sliceCanvas.getContext("2d")!;
        ctx.drawImage(canvas, 0, Math.round(sourceY), canvas.width, Math.round(sourceSliceH), 0, 0, canvas.width, Math.round(sourceSliceH));

        const sliceImg = sliceCanvas.toDataURL("image/jpeg", quality);
        pdf.addImage(sliceImg, "JPEG", margin, cursorY, contentWidth, sliceHeight, undefined, "FAST");

        sourceY += sourceSliceH;
        remainingHeight -= sliceHeight;
        cursorY += sliceHeight;

        if (remainingHeight > 0.5) {
          pdf.addPage();
          cursorY = margin;
        }
      }

      cursorY += 2;
    }

    // If cursor exceeds page, new page for next block
    if (cursorY > pageHeight - margin && i < captures.length - 1) {
      pdf.addPage();
      cursorY = margin;
    }
  }

  pdf.save(`${filename}.pdf`);
}
