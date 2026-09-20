import { DraftDocument, DraftExportButtons } from "@workspace/draft-export/react";
import { DisclaimerNotice } from "@/components/DisclaimerNotice";
import { SaveToVault } from "@/components/SaveToVault";

interface StreamOutputProps {
  output: string;
  disclaimer?: string;
  generating?: boolean;
  /** When provided, a "Save to vault" button appears once generation finishes. */
  saveKind?: string;
  saveTitle?: string;
  saveLabel?: string;
}

// Shared rendered output for the streamed drafters (affidavits, appeals): export
// buttons, an optional save-to-vault button, the markdown body and the disclaimer.
export function StreamOutput({
  output,
  disclaimer,
  generating,
  saveKind,
  saveTitle,
  saveLabel,
}: StreamOutputProps) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2 flex-wrap">
        {saveKind && !generating && output && (
          <SaveToVault
            kind={saveKind}
            workLabel={saveLabel || saveTitle || ""}
            defaultTitle={saveTitle || ""}
            content={output}
          />
        )}
        <DraftExportButtons
          title={saveTitle || saveLabel || "Document"}
          content={output}
          hideMarkdown
        />
      </div>
      <div className="bg-background/60 border border-border rounded-lg p-5 max-h-[60vh] overflow-y-auto">
        <DraftDocument content={output} />
      </div>
      {disclaimer && <DisclaimerNotice disclaimer={disclaimer} />}
    </div>
  );
}
