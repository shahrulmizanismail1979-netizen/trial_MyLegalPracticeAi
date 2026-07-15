import type { Tier } from "@workspace/db/sya";

export const TIER_RANK: Record<Tier, number> = {
  starter: 0,
  professional: 1,
  premium: 2,
  firm: 3,
};

export type FeatureKey =
  | "aiToolkit"
  | "voiceMode"
  | "elevenLabs"
  | "voiceStt"
  | "kitab"
  | "tafsir";

export const FEATURE_MIN_TIER: Record<FeatureKey, Tier> = {
  aiToolkit: "professional",
  voiceMode: "professional",
  elevenLabs: "premium",
  voiceStt: "premium",
  kitab: "premium",
  tafsir: "premium",
};

export interface PackageDef {
  tier: Tier;
  name: string;
  nameBm: string;
  priceMyr: number;
  lookupKey: string | null;
  tagline: string;
  taglineBm: string;
  features: string[];
  featuresBm: string[];
}

export const PACKAGES: PackageDef[] = [
  {
    tier: "starter",
    name: "Starter",
    nameBm: "Permulaan",
    priceMyr: 0,
    lookupKey: null,
    tagline: "Core legal research to get started",
    taglineBm: "Penyelidikan undang-undang asas untuk bermula",
    features: [
      "Legal Provisions, Case Laws & Glossary",
      "Legislation, Cause Papers & Workflows",
      "Limited AI Counsel queries",
    ],
    featuresBm: [
      "Peruntukan Undang-undang, Kes & Glosari",
      "Perundangan, Kertas Kausa & Aliran Kerja",
      "Pertanyaan AI Counsel terhad",
    ],
  },
  {
    tier: "professional",
    name: "Professional",
    nameBm: "Profesional",
    priceMyr: 49,
    lookupKey: "professional_monthly",
    tagline: "Full AI toolkit for everyday practice",
    taglineBm: "Kit AI penuh untuk amalan harian",
    features: [
      "Everything in Starter",
      "Full AI Toolkit (Analyzer, Opinion Writer, Document Generator, Case Analysis, Smart Search)",
      "Voice Mode court practice (standard voice)",
      "Compliance Checker & Client Intake",
    ],
    featuresBm: [
      "Semua dalam Permulaan",
      "Kit AI Penuh (Penganalisis, Penulis Pendapat, Penjana Dokumen, Analisis Kes, Carian Pintar)",
      "Mod Suara latihan mahkamah (suara standard)",
      "Pemeriksa Pematuhan & Pengambilan Klien",
    ],
  },
  {
    tier: "premium",
    name: "Premium",
    nameBm: "Premium",
    priceMyr: 149,
    lookupKey: "premium_monthly",
    tagline: "Realistic AI voices and scholarly depth",
    taglineBm: "Suara AI realistik dan kedalaman ilmiah",
    features: [
      "Everything in Professional",
      "Realistic ElevenLabs AI voices in Voice Mode",
      "High-accuracy ElevenLabs speech-to-text",
      "Kitab Reference & Analysis library",
      "AI Tafsir Al-Quran",
    ],
    featuresBm: [
      "Semua dalam Profesional",
      "Suara AI ElevenLabs realistik dalam Mod Suara",
      "Tukar suara ke teks ElevenLabs ketepatan tinggi",
      "Perpustakaan Rujukan & Analisis Kitab",
      "AI Tafsir Al-Quran",
    ],
  },
  {
    tier: "firm",
    name: "Firm",
    nameBm: "Firma",
    priceMyr: 399,
    lookupKey: "firm_monthly",
    tagline: "For chambers and legal teams",
    taglineBm: "Untuk firma dan pasukan guaman",
    features: [
      "Everything in Premium",
      "Multiple practitioner seats",
      "Unlimited voice minutes",
      "Priority support",
    ],
    featuresBm: [
      "Semua dalam Premium",
      "Pelbagai kerusi pengamal",
      "Minit suara tanpa had",
      "Sokongan keutamaan",
    ],
  },
];

export function tierHasFeature(tier: string, feature: FeatureKey): boolean {
  const rank = TIER_RANK[tier as Tier];
  if (rank === undefined) return false;
  return rank >= TIER_RANK[FEATURE_MIN_TIER[feature]];
}

export function getPackage(tier: string): PackageDef | undefined {
  return PACKAGES.find((p) => p.tier === tier);
}
