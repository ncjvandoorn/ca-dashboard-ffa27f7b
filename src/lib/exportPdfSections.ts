import html2canvas from "html2canvas";
import jsPDF from "jspdf";

function withPadding(canvas: HTMLCanvasElement, padPx: number) {
  const padded = document.createElement("canvas");
  padded.width = canvas.width;
  padded.height = canvas.height + padPx * 2;
  const ctx = padded.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, padded.width, padded.height);
  ctx.drawImage(canvas, 0, padPx);
  return padded;
}

/**
 * Section-aware PDF export that avoids clipping text/titles and avoids splitting
 * cards across pages unless a single card is taller than one page.
 */
export async function exportSectionsPdf(container: HTMLElement, filename: string) {
  const scale = 2;
  const quality = 0.9;
  const margin = 10; // mm
  const sectionGap = 2; // mm

  const pageWidth = 210; // A4 portrait
  const pageHeight = 297;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;

  const sandbox = document.createElement("div");
  sandbox.style.position = "fixed";
  sandbox.style.left = "-100000px";
  sandbox.style.top = "0";
  sandbox.style.background = "#ffffff";
  sandbox.style.pointerEvents = "none";
  sandbox.style.zIndex = "-1";

  const clone = container.cloneNode(true) as HTMLElement;
  clone.style.maxHeight = "none";
  clone.style.height = "auto";
  clone.style.overflow = "visible";
  clone.style.width = `${Math.max(container.scrollWidth, container.clientWidth)}px`;

  clone
    .querySelectorAll<HTMLElement>(".overflow-auto, .overflow-y-auto, .overflow-x-auto, .overflow-hidden")
    .forEach((el) => {
      el.style.overflow = "visible";
      el.style.maxHeight = "none";
      el.style.height = "auto";
    });

  sandbox.appendChild(clone);
  document.body.appendChild(sandbox);

  try {
    const sectionBlocks = Array.from(clone.querySelectorAll<HTMLElement>("[data-pdf-section]"));
    const blocks = sectionBlocks.length > 0 ? sectionBlocks : (Array.from(clone.children) as HTMLElement[]);

    const pdf = new jsPDF("p", "mm", "a4");
    let cursorY = margin;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];

      const rawCanvas = await html2canvas(block, {
        scale,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: Math.max(clone.scrollWidth, clone.clientWidth),
        windowHeight: Math.max(clone.scrollHeight, clone.clientHeight),
      });

      // Padding prevents glyph top/bottom clipping on headings in some browsers.
      const canvas = withPadding(rawCanvas, 8);
      const blockHeightMm = (canvas.height * contentWidth) / canvas.width;

      // Fits in one page: keep block intact.
      if (blockHeightMm <= contentHeight) {
        if (cursorY > margin && cursorY + blockHeightMm > pageHeight - margin) {
          pdf.addPage();
          cursorY = margin;
        }

        const imgData = canvas.toDataURL("image/jpeg", quality);
        pdf.addImage(imgData, "JPEG", margin, cursorY, contentWidth, blockHeightMm, undefined, "FAST");
        cursorY += blockHeightMm + sectionGap;
      } else {
        // Tall block: split cleanly by available page height.
        const pxPerMm = canvas.width / contentWidth;
        let sourceY = 0;

        while (sourceY < canvas.height) {
          const availableMm = pageHeight - margin - cursorY;
          if (availableMm <= 0.5) {
            pdf.addPage();
            cursorY = margin;
            continue;
          }

          const availablePx = Math.max(1, Math.floor(availableMm * pxPerMm));
          const slicePx = Math.min(availablePx, canvas.height - sourceY);
          const sliceMm = slicePx / pxPerMm;

          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = slicePx;
          const ctx = sliceCanvas.getContext("2d");
          if (!ctx) break;

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          ctx.drawImage(canvas, 0, sourceY, canvas.width, slicePx, 0, 0, canvas.width, slicePx);

          const sliceImg = sliceCanvas.toDataURL("image/jpeg", quality);
          pdf.addImage(sliceImg, "JPEG", margin, cursorY, contentWidth, sliceMm, undefined, "FAST");

          sourceY += slicePx;
          cursorY += sliceMm;

          if (sourceY < canvas.height) {
            pdf.addPage();
            cursorY = margin;
          }
        }

        cursorY += sectionGap;
      }

      if (cursorY > pageHeight - margin && i < blocks.length - 1) {
        pdf.addPage();
        cursorY = margin;
      }
    }

    pdf.save(`${filename}.pdf`);
  } finally {
    sandbox.remove();
  }
}
