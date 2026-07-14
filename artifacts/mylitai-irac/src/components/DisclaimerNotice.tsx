import React from "react";
import { AlertCircle, ShieldAlert } from "lucide-react";

export function DisclaimerNotice({
  disclaimer,
  severe = false,
}: {
  disclaimer?: string;
  severe?: boolean;
}) {
  if (!disclaimer) return null;

  if (severe) {
    return (
      <div className="mt-8 p-4 bg-destructive/10 border border-destructive/40 rounded-md flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <p className="text-xs text-destructive leading-relaxed font-medium">
          {disclaimer}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 p-4 bg-muted/30 border border-muted rounded-md flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
      <p className="text-xs text-muted-foreground leading-relaxed italic">
        {disclaimer}
      </p>
    </div>
  );
}
