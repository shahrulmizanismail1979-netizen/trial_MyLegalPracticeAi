/**
 * Case stage / status configuration for all portals.
 *
 * Each portal has an ordered list of allowed stages. The "status" field on a
 * matter row always holds the current stage. Stage history is logged in the
 * case_stage_history table. There is no mandatory progression — practitioners
 * can jump to any stage.
 */

export type Portal = "lit" | "crim" | "sya" | "corp" | "ccb" | "convey";

/** Ordered stage labels per portal. */
export const PORTAL_STAGES: Record<Portal, string[]> = {
  lit: ["Pre-Trial", "Trial", "Judgment", "Appeal", "Closed"],
  crim: ["Investigation", "Charge", "Mention", "Trial", "Judgment", "Appeal", "Closed"],
  sya: ["Pengajuan", "Perbicaraan", "Penghakiman", "Rayuan", "Selesai"],
  corp: ["Instruction", "Due Diligence", "Advisory", "Opinion Delivered", "Closed"],
  ccb: ["Pre-Action", "Filing", "Interlocutory", "Trial", "Judgment", "Enforcement", "Closed"],
  convey: [
    "Instruction",
    "SPA Execution",
    "Financing",
    "Stamping",
    "Completion",
    "Registration",
    "Closed",
  ],
};

/** Human-readable portal names used in AI prompts. */
export const PORTAL_NAMES: Record<Portal, string> = {
  lit: "Malaysian Civil Litigation (MyLitAI)",
  crim: "Malaysian Criminal Law (MyCrimAI)",
  sya: "Malaysian Syariah Law (MySyariahAI)",
  corp: "Malaysian Corporate Legal (MyCorpLegalAI)",
  ccb: "Malaysian Corporate, Commercial & Banking Litigation (MyCCBLitAI)",
  convey: "Malaysian Conveyancing (MyConveyLitAI)",
};

export function isValidPortal(p: string): p is Portal {
  return p in PORTAL_STAGES;
}

export function isValidStage(portal: Portal, stage: string): boolean {
  return PORTAL_STAGES[portal].includes(stage);
}
