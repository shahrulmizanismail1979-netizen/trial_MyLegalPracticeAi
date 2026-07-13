import { TIER_DEFINITIONS, type AiToolId, type Tier } from "@workspace/entitlements";
import { useEntitlements } from "@/lib/entitlements";
import { UpgradeCard } from "./upgrade-card";

/** Lowest purchasable tier name that includes a given AI tool. */
function lowestTierNameForTool(toolId: AiToolId): string {
  const order: Tier[] = ["starter", "practitioner", "advocate", "chambers"];
  for (const t of order) {
    const tools = TIER_DEFINITIONS[t].aiTools;
    if (tools === "all" || tools.includes(toolId)) return TIER_DEFINITIONS[t].name;
  }
  return TIER_DEFINITIONS.practitioner.name;
}

export function ToolGuard({
  toolId,
  children,
}: {
  toolId: AiToolId;
  children: React.ReactNode;
}) {
  const { isLoading, hasTool } = useEntitlements();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!hasTool(toolId)) {
    const isOral =
      toolId === "witness-practice" || toolId === "judge-practice";
    return (
      <UpgradeCard
        title="Upgrade to unlock this tool"
        description={
          isOral
            ? "Realistic voice oral-practice and this simulator are part of a higher plan."
            : "This AI tool is part of a higher plan."
        }
        requiredTierName={lowestTierNameForTool(toolId)}
      />
    );
  }

  return <>{children}</>;
}
