import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { DisclaimerNotice } from "@/components/DisclaimerNotice";
import { SaveToVault } from "@/components/SaveToVault";
import { useLanguage } from "@/contexts/LanguageContext";

interface StreamOutputProps {
  output: string;
  disclaimer?: string;
  generating?: boolean;
  /** When provided, a "Save to vault" button appears once generation finishes. */
  saveKind?: string;
  saveTitle?: string;
  saveLabel?: string;
}

// Shared rendered output for the streamed drafters (affidavits, appeals): a copy
// button, an optional save-to-vault button, the markdown body and the disclaimer.
export function StreamOutput({
  output,
  disclaimer,
  generating,
  saveKind,
  saveTitle,
  saveLabel,
}: StreamOutputProps) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        {saveKind && !generating && output && (
          <SaveToVault
            kind={saveKind}
            workLabel={saveLabel || saveTitle || ""}
            defaultTitle={saveTitle || ""}
            content={output}
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => {
            navigator.clipboard.writeText(output);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              {t("common.copied")}
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              {t("common.copy")}
            </>
          )}
        </Button>
      </div>
      <div className="bg-background/60 border border-border rounded-lg p-5 max-h-[60vh] overflow-y-auto">
        <MarkdownRenderer content={output} />
      </div>
      {disclaimer && <DisclaimerNotice disclaimer={disclaimer} />}
    </div>
  );
}
