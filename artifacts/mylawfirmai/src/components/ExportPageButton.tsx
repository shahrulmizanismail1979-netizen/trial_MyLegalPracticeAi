import { useState } from "react";
import { Download, Image as ImageIcon, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { downloadNodePng, downloadNodePdf } from "@/lib/exportImage";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";

// A reusable "export this page" control. Captures the referenced DOM node and
// offers a PNG image or a PDF download, so any page can be shared elsewhere.
export function ExportPageButton({
  targetRef,
  name,
}: {
  targetRef: React.RefObject<HTMLElement | null>;
  name: string;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);

  const run = async (kind: "png" | "pdf") => {
    const node = targetRef.current;
    if (!node) return;
    setBusy(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const safe = name.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "") || "page";
      const filename = `mylawfirmai-${safe}-${stamp}`;
      if (kind === "png") await downloadNodePng(node, filename);
      else await downloadNodePdf(node, filename);
    } catch {
      toast.error(t("export.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          className="font-semibold rounded-xl gap-2 bg-background/70 backdrop-blur"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {busy ? t("export.preparing") : t("export.menu")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => run("png")}
          className="gap-2 cursor-pointer"
        >
          <ImageIcon className="w-4 h-4" /> {t("export.image")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => run("pdf")}
          className="gap-2 cursor-pointer"
        >
          <FileText className="w-4 h-4" /> {t("export.pdf")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
