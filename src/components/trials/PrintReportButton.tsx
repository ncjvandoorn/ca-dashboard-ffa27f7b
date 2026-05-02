import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

/**
 * Triggers the browser print dialog for the Vase Life Report sheet.
 *
 * Works by toggling `print-vlr-active` on <body>, which a print stylesheet in
 * `index.css` uses to hide everything except the element with id
 * `#vlr-print-area`. This keeps headers, sidebars and the dialog chrome out of
 * the printout while preserving the existing in-app layout.
 */
export function PrintReportButton({ className }: { className?: string }) {
  const handlePrint = () => {
    const cls = "print-vlr-active";
    document.body.classList.add(cls);
    const cleanup = () => {
      document.body.classList.remove(cls);
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    // Give the browser a tick to apply the class before opening the dialog
    setTimeout(() => window.print(), 50);
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handlePrint}
      className={`gap-1.5 vlr-no-print ${className || ""}`}
    >
      <Printer className="h-3.5 w-3.5" />
      Print
    </Button>
  );
}
