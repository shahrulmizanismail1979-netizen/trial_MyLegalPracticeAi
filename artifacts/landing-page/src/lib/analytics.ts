type AnalyticsData = Record<string, string | number | boolean>;

type ValueRule =
  | { kind: "boolean" }
  | { kind: "number"; min: number; max: number }
  | { kind: "enum"; values: Set<string> };

const CHECKOUT_TIERS = new Set(["single", "bundle", "standard", "firm_starter", "firm_growth", "firm_scale", "corporate_starter", "corporate_growth", "corporate_scale", "education_starter", "education_growth", "education_scale", "unknown"]);
const LAWYES_ROLES = new Set(["owner", "editor", "viewer"]);
const MATTER_STATUSES = new Set(["active", "closed", "archived", "unknown"]);
const RESEARCH_MODES = new Set(["verified_library", "web"]);
const MEDIA_TYPES = new Set(["image", "audio", "video", "unknown"]);

const EVENT_CONTRACT: Record<string, Record<string, ValueRule>> = {
  checkout_started: {
    tier: { kind: "enum", values: CHECKOUT_TIERS },
    is_trial: { kind: "boolean" },
    portal_selected: { kind: "boolean" },
    surface: { kind: "enum", values: new Set(["pricing", "bundle"]) },
  },
  checkout_start_failed: {
    tier: { kind: "enum", values: CHECKOUT_TIERS },
    is_trial: { kind: "boolean" },
    portal_selected: { kind: "boolean" },
    surface: { kind: "enum", values: new Set(["pricing", "bundle"]) },
    error_category: { kind: "enum", values: new Set(["api", "network"]) },
    http_status: { kind: "number", min: 0, max: 599 },
  },
  checkout_completed: {
    tier: { kind: "enum", values: CHECKOUT_TIERS },
    is_trial: { kind: "boolean" },
    app_count: { kind: "number", min: 0, max: 20 },
    access_ready: { kind: "boolean" },
  },
  lawyes_login_succeeded: {
    auth_method: { kind: "enum", values: new Set(["access_code"]) },
  },
  lawyes_login_failed: {
    auth_method: { kind: "enum", values: new Set(["access_code"]) },
    error_category: { kind: "enum", values: new Set(["invalid_or_expired", "network"]) },
  },
  lawyes_logout: {},
  lawyes_matter_opened: {
    role: { kind: "enum", values: LAWYES_ROLES },
    can_write: { kind: "boolean" },
    can_use_connectors: { kind: "boolean" },
    matter_status: { kind: "enum", values: MATTER_STATUSES },
  },
  lawyes_evidence_uploaded: {
    status: { kind: "enum", values: new Set(["success", "failure"]) },
    media_type: { kind: "enum", values: MEDIA_TYPES },
    size_bucket: { kind: "enum", values: new Set(["under_1mb", "1mb_to_10mb", "over_10mb"]) },
  },
  lawyes_instruction_submitted: {
    research_mode: { kind: "enum", values: RESEARCH_MODES },
    instruction_length: { kind: "number", min: 0, max: 100_000 },
  },
  lawyes_instruction_completed: {
    research_mode: { kind: "enum", values: RESEARCH_MODES },
    citation_count: { kind: "number", min: 0, max: 10_000 },
    content_length: { kind: "number", min: 0, max: 10_000_000 },
  },
  lawyes_instruction_failed: {
    research_mode: { kind: "enum", values: RESEARCH_MODES },
  },
  lawyes_output_saved: {
    output_kind: { kind: "enum", values: new Set(["lawyes_draft"]) },
    citation_count: { kind: "number", min: 0, max: 10_000 },
    content_length: { kind: "number", min: 0, max: 10_000_000 },
  },
};

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
  }
}

export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === "undefined") return;
  const contract = EVENT_CONTRACT[name];
  if (!contract) return;

  const safeData: AnalyticsData = {};
  for (const [key, rule] of Object.entries(contract)) {
    const value = data?.[key];
    if (rule.kind === "boolean" && typeof value === "boolean") {
      safeData[key] = value;
    } else if (
      rule.kind === "number"
      && typeof value === "number"
      && Number.isFinite(value)
      && value >= rule.min
      && value <= rule.max
    ) {
      safeData[key] = value;
    } else if (rule.kind === "enum" && typeof value === "string" && rule.values.has(value)) {
      safeData[key] = value;
    }
  }

  try {
    window.umami?.track(name, Object.keys(safeData).length ? safeData : undefined);
  } catch {
    // Analytics must never affect the user journey.
  }
}