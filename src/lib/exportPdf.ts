import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface ExportOptions {
  orientation?: "p" | "l";
  scale?: number;
  quality?: number;
}

/**
 * Export a DOM element to PDF with smart section-aware page breaks.
 *
 * If the element (or its descendants) contain `[data-pdf-section]` markers,
 * each marked section is rendered individually and placed on pages without
 * splitting content mid-section.
 *
 * If no `[data-pdf-section]` markers are found, the element's direct children
 * are each treated as implicit sections.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  filename: string,
  options?: ExportOptions
) {
  const orientation = options?.orientation ?? "p";
  const scale = options?.scale ?? 2;
  const quality = options?.quality ?? 0.9;
  const isLandscape = orientation === "l";

  const pageWidth = isLandscape ? 297 : 210; // A4 mm
  const pageHeight = isLandscape ? 210 : 297;
  const margin = 15; // generous margins for readability
  const contentWidth = pageWidth - margin * 2;
  const maxContentHeight = pageHeight - margin * 2;
  const sectionGap = 3; // mm between sections

  // Temporarily expand ALL scrollable / height-constrained containers
  const constrained = element.querySelectorAll<HTMLElement>(
    ".overflow-x-auto, .overflow-auto, .overflow-y-auto, [class*='max-h-']"
  );
  const savedStyles: {
    el: HTMLElement;
    cssText: string;
  }[] = [];
  constrained.forEach((el) => {
    savedStyles.push({ el, cssText: el.style.cssText });
    // Use !important to override Tailwind utility classes
    el.style.setProperty("overflow", "visible", "important");
    el.style.setProperty("max-height", "none", "important");
    el.style.setProperty("max-width", "none", "important");
    el.style.setProperty("height", `${el.scrollHeight}px`, "important");
  });

  // Determine sections: explicit [data-pdf-section] markers, or direct children
  let sections = Array.from(
    element.querySelectorAll<HTMLElement>("[data-pdf-section]")
  );
  if (sections.length === 0) {
    sections = Array.from(element.children).filter(
      (c) => c instanceof HTMLElement && c.offsetHeight > 0
    ) as HTMLElement[];
  }

  // Capture each section to its own canvas
  const blocks: { imgData: string; heightMm: number }[] = [];
  for (const section of sections) {
    const canvas = await html2canvas(section, {
      scale,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: element.scrollWidth,
    });
    const heightMm = (canvas.height / scale) * (contentWidth / (canvas.width / scale));
    blocks.push({
      imgData: canvas.toDataURL("image/jpeg", quality),
      heightMm,
    });
  }

  // Restore constrained containers
  savedStyles.forEach(({ el, cssText }) => {
    el.style.cssText = cssText;
  });

  if (blocks.length === 0) return;

  const pdf = new jsPDF(orientation, "mm", "a4");
  let cursorY = margin;

  for (let i = 0; i < blocks.length; i++) {
    const { imgData, heightMm } = blocks[i];

    // If we're not at the top and this section won't fit, start a new page
    if (cursorY > margin && cursorY + heightMm > pageHeight - margin) {
      pdf.addPage();
      cursorY = margin;
    }

    // If a single section is taller than a full page, tile it across pages
    if (heightMm > maxContentHeight) {
      let remainingHeight = heightMm;
      let sourceY = 0;
      while (remainingHeight > 0) {
        const sliceHeight = Math.min(maxContentHeight - (cursorY - margin), remainingHeight);
        // We draw the full image but offset it so the visible portion aligns
        pdf.addImage(
          imgData,
          "JPEG",
          margin,
          cursorY - sourceY,
          contentWidth,
          heightMm,
          `block-${i}`,
          "FAST"
        );

        // Clip to page by just advancing
        sourceY += sliceHeight;
        remainingHeight -= sliceHeight;

        if (remainingHeight > 0) {
          pdf.addPage();
          cursorY = margin;
        } else {
          cursorY += sliceHeight + sectionGap;
        }
      }
    } else {
      pdf.addImage(imgData, "JPEG", margin, cursorY, contentWidth, heightMm, undefined, "FAST");
      cursorY += heightMm + sectionGap;
    }
  }

  pdf.save(`${filename}.pdf`);
}
