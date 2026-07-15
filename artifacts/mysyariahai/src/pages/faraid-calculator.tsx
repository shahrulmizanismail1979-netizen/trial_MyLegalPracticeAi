import { useState } from "react";
import { useLanguage } from "@/lib/language-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type HeirType =
  | "husband" | "wife" | "father" | "mother"
  | "son" | "daughter" | "grandson" | "granddaughter"
  | "grandfather" | "grandmother"
  | "full_brother" | "full_sister"
  | "paternal_brother" | "paternal_sister"
  | "maternal_sibling" | "paternal_uncle";

type Group = "spouse_parents" | "descendants" | "grandparents" | "siblings" | "extended";

interface HeirConfig {
  key: HeirType;
  labelEn: string;
  labelBm: string;
  maxCount: number;
  group: Group;
  gender: "male" | "female";
}

const HEIR_CONFIGS: HeirConfig[] = [
  { key: "husband", labelEn: "Husband (Suami)", labelBm: "Suami", maxCount: 1, group: "spouse_parents", gender: "male" },
  { key: "wife", labelEn: "Wife (Isteri)", labelBm: "Isteri", maxCount: 4, group: "spouse_parents", gender: "female" },
  { key: "father", labelEn: "Father (Bapa)", labelBm: "Bapa", maxCount: 1, group: "spouse_parents", gender: "male" },
  { key: "mother", labelEn: "Mother (Ibu)", labelBm: "Ibu", maxCount: 1, group: "spouse_parents", gender: "female" },
  { key: "son", labelEn: "Son (Anak Lelaki)", labelBm: "Anak Lelaki", maxCount: 30, group: "descendants", gender: "male" },
  { key: "daughter", labelEn: "Daughter (Anak Perempuan)", labelBm: "Anak Perempuan", maxCount: 30, group: "descendants", gender: "female" },
  { key: "grandson", labelEn: "Grandson — son's son (Cucu Lelaki)", labelBm: "Cucu Lelaki (dari anak lelaki)", maxCount: 30, group: "descendants", gender: "male" },
  { key: "granddaughter", labelEn: "Granddaughter — son's daughter (Cucu Perempuan)", labelBm: "Cucu Perempuan (dari anak lelaki)", maxCount: 30, group: "descendants", gender: "female" },
  { key: "grandfather", labelEn: "Paternal Grandfather (Datuk)", labelBm: "Datuk Sebelah Bapa", maxCount: 1, group: "grandparents", gender: "male" },
  { key: "grandmother", labelEn: "Grandmother (Nenek)", labelBm: "Nenek", maxCount: 2, group: "grandparents", gender: "female" },
  { key: "full_brother", labelEn: "Full Brother (Saudara Seibu Sebapa)", labelBm: "Saudara Lelaki Seibu Sebapa", maxCount: 30, group: "siblings", gender: "male" },
  { key: "full_sister", labelEn: "Full Sister (Saudara Seibu Sebapa)", labelBm: "Saudara Perempuan Seibu Sebapa", maxCount: 30, group: "siblings", gender: "female" },
  { key: "paternal_brother", labelEn: "Paternal Half-Brother (Sebapa)", labelBm: "Saudara Lelaki Sebapa", maxCount: 30, group: "siblings", gender: "male" },
  { key: "paternal_sister", labelEn: "Paternal Half-Sister (Sebapa)", labelBm: "Saudara Perempuan Sebapa", maxCount: 30, group: "siblings", gender: "female" },
  { key: "maternal_sibling", labelEn: "Maternal Half-Sibling (Seibu)", labelBm: "Saudara Seibu", maxCount: 30, group: "extended", gender: "male" },
  { key: "paternal_uncle", labelEn: "Paternal Uncle (Bapa Saudara Sebelah Bapa)", labelBm: "Bapa Saudara Sebelah Bapa", maxCount: 10, group: "extended", gender: "male" },
];

const HEIR_LABELS: Record<HeirType, { en: string; bm: string }> = HEIR_CONFIGS.reduce((acc, c) => {
  acc[c.key] = { en: c.labelEn, bm: c.labelBm };
  return acc;
}, {} as Record<HeirType, { en: string; bm: string }>);

const GROUP_LABELS: Record<Group, { en: string; bm: string }> = {
  spouse_parents: { en: "Spouse & Parents", bm: "Pasangan & Ibu Bapa" },
  descendants: { en: "Children & Grandchildren", bm: "Anak & Cucu" },
  grandparents: { en: "Grandparents", bm: "Datuk & Nenek" },
  siblings: { en: "Siblings", bm: "Adik Beradik" },
  extended: { en: "Extended Heirs", bm: "Waris Lanjutan" },
};

// ---------- Rational arithmetic ----------
interface Frac { n: number; d: number; }
function gcd(a: number, b: number): number { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
function fr(n: number, d: number): Frac { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; }
function addF(a: Frac, b: Frac): Frac { return fr(a.n * b.d + b.n * a.d, a.d * b.d); }
function subF(a: Frac, b: Frac): Frac { return fr(a.n * b.d - b.n * a.d, a.d * b.d); }
function mulF(a: Frac, b: Frac): Frac { return fr(a.n * b.n, a.d * b.d); }
function divF(a: Frac, b: Frac): Frac { return fr(a.n * b.d, a.d * b.n); }
function dec(a: Frac): number { return a.n / a.d; }
function fstr(a: Frac): string { return a.n === 0 ? "0" : `${a.n}/${a.d}`; }
const ZERO: Frac = { n: 0, d: 1 };
const ONE: Frac = { n: 1, d: 1 };

type ShareKind = "fard" | "asabah" | "fard+asabah" | "radd" | "maal_ghayr";

interface HeirShare {
  key: HeirType;
  count: number;
  fraction: string;
  percentage: number;
  amount: number;
  kind: ShareKind;
  basis: string;
  basisBm: string;
}

interface FaraidResult {
  shares: HeirShare[];
  residuary: number;
  adjustments: { en: string; bm: string }[];
  method: string;
  methodBm: string;
}

interface WorkEntry { count: number; fard: Frac; kind: ShareKind; label: string; basis: string; basisBm: string; }

const KIND_BASIS: Record<ShareKind, { en: string; bm: string }> = {
  fard: { en: "Fixed share (fardh) — Quran 4:11-12, 4:176", bm: "Bahagian tetap (fardhu) — Al-Quran 4:11-12, 4:176" },
  asabah: { en: "Residuary heir (asabah) — takes the remainder", bm: "Waris asabah — mengambil baki" },
  "fard+asabah": { en: "Fixed share plus residuary (asabah)", bm: "Bahagian tetap tambah baki (asabah)" },
  radd: { en: "Fixed share increased by Radd (surplus returned, spouse excluded)", bm: "Bahagian tetap ditambah Radd (lebihan dipulangkan, pasangan dikecualikan)" },
  maal_ghayr: { en: "Residuary with others (asabah ma'al ghayr) — sister inherits with daughters", bm: "Asabah ma'al ghayr — saudara perempuan mewarisi bersama anak perempuan" },
};

function calculateFaraid(deceasedGender: "male" | "female", heirs: Record<HeirType, number>, estateValue: number): FaraidResult {
  const num = (k: HeirType) => heirs[k] || 0;
  const son = num("son"), daughter = num("daughter"), grandson = num("grandson"), granddaughter = num("granddaughter");
  const fatherP = num("father") > 0, motherP = num("mother") > 0;
  const gfP = num("grandfather") > 0 && !fatherP;
  const gmCount = num("grandmother"); const gmP = gmCount > 0 && !motherP;
  const fb = num("full_brother"), fs = num("full_sister"), pb = num("paternal_brother"), ps = num("paternal_sister");
  const ms = num("maternal_sibling"); const uncle = num("paternal_uncle") > 0;
  const hasMaleDesc = son > 0 || grandson > 0;
  const hasFemaleDesc = daughter > 0 || granddaughter > 0;
  const hasDescendant = hasMaleDesc || hasFemaleDesc;
  const totalSiblings = fb + fs + pb + ps + ms;

  const E: Partial<Record<HeirType, WorkEntry>> = {};
  const adjustments: { en: string; bm: string }[] = [];

  const setFard = (k: HeirType, count: number, share: Frac, label: string, basis: string, basisBm: string) => {
    E[k] = { count, fard: share, kind: "fard", label, basis, basisBm };
  };

  // Spouse
  let spouseFrac: Frac = ZERO;
  if (deceasedGender === "female" && num("husband") > 0) {
    spouseFrac = hasDescendant ? fr(1, 4) : fr(1, 2);
    setFard("husband", 1, spouseFrac, fstr(spouseFrac),
      `Husband receives ${fstr(spouseFrac)} ${hasDescendant ? "with descendants" : "without descendants"} (Quran 4:12)`,
      `Suami menerima ${fstr(spouseFrac)} ${hasDescendant ? "dengan keturunan" : "tanpa keturunan"} (Al-Quran 4:12)`);
  }
  if (deceasedGender === "male" && num("wife") > 0) {
    spouseFrac = hasDescendant ? fr(1, 8) : fr(1, 4);
    setFard("wife", num("wife"), spouseFrac, fstr(spouseFrac),
      `Wife/wives share ${fstr(spouseFrac)} ${hasDescendant ? "with descendants" : "without descendants"} (Quran 4:12)`,
      `Isteri berkongsi ${fstr(spouseFrac)} ${hasDescendant ? "dengan keturunan" : "tanpa keturunan"} (Al-Quran 4:12)`);
  }

  // Mother (incl. Umariyyatan)
  const umariyya = (num("husband") > 0 || num("wife") > 0) && fatherP && motherP && !hasDescendant && totalSiblings < 2;
  if (motherP) {
    if (umariyya) {
      const mf = divF(subF(ONE, spouseFrac), fr(3, 1));
      setFard("mother", 1, mf, "1/3 of remainder",
        "Mother receives 1/3 of the remainder after the spouse (al-Gharrawayn / Umariyyatan case)",
        "Ibu menerima 1/3 daripada baki selepas pasangan (kes al-Gharrawayn / Umariyyatan)");
      adjustments.push({ en: "Umariyyatan: mother takes 1/3 of the remainder after the spouse, not 1/3 of the whole estate.", bm: "Umariyyatan: ibu mengambil 1/3 daripada baki selepas pasangan, bukan 1/3 keseluruhan harta." });
    } else {
      const mf = (hasDescendant || totalSiblings >= 2) ? fr(1, 6) : fr(1, 3);
      setFard("mother", 1, mf, fstr(mf),
        `Mother receives ${fstr(mf)} ${(hasDescendant || totalSiblings >= 2) ? "(with descendants or 2+ siblings)" : "(no descendants, fewer than 2 siblings)"} (Quran 4:11)`,
        `Ibu menerima ${fstr(mf)} ${(hasDescendant || totalSiblings >= 2) ? "(ada keturunan atau 2+ adik beradik)" : "(tiada keturunan, kurang 2 adik beradik)"} (Al-Quran 4:11)`);
    }
  }

  if (gmP) {
    setFard("grandmother", Math.min(gmCount, 2), fr(1, 6), "1/6",
      "Grandmother(s) share 1/6 in the absence of the mother (Sunnah)",
      "Nenek berkongsi 1/6 jika tiada ibu (Sunnah)");
  }

  // Father / Grandfather fixed portion (only when there is a descendant)
  if (fatherP && hasDescendant) {
    setFard("father", 1, fr(1, 6), hasMaleDesc ? "1/6" : "1/6 + residuary",
      hasMaleDesc ? "Father receives 1/6 as fixed share with a male descendant (Quran 4:11)" : "Father receives 1/6 plus the residuary with only female descendants (Quran 4:11)",
      hasMaleDesc ? "Bapa menerima 1/6 bahagian tetap dengan keturunan lelaki (Al-Quran 4:11)" : "Bapa menerima 1/6 tambah baki dengan keturunan perempuan sahaja (Al-Quran 4:11)");
  }
  if (gfP && hasDescendant) {
    setFard("grandfather", 1, fr(1, 6), hasMaleDesc ? "1/6" : "1/6 + residuary",
      "Grandfather stands in place of the father, receiving 1/6 with descendants",
      "Datuk menggantikan bapa, menerima 1/6 dengan keturunan");
  }

  // Children — daughters/granddaughters fixed shares only when there is no son
  if (!(son > 0)) {
    if (daughter === 1) setFard("daughter", 1, fr(1, 2), "1/2", "A single daughter receives 1/2 (Quran 4:11)", "Seorang anak perempuan menerima 1/2 (Al-Quran 4:11)");
    else if (daughter >= 2) setFard("daughter", daughter, fr(2, 3), "2/3", "Two or more daughters share 2/3 (Quran 4:11)", "Dua atau lebih anak perempuan berkongsi 2/3 (Al-Quran 4:11)");

    if (!(grandson > 0)) {
      if (daughter === 0) {
        if (granddaughter === 1) setFard("granddaughter", 1, fr(1, 2), "1/2", "A single granddaughter receives 1/2 in the absence of children", "Seorang cucu perempuan menerima 1/2 jika tiada anak");
        else if (granddaughter >= 2) setFard("granddaughter", granddaughter, fr(2, 3), "2/3", "Two or more granddaughters share 2/3 in the absence of children", "Dua atau lebih cucu perempuan berkongsi 2/3 jika tiada anak");
      } else if (daughter === 1) {
        if (granddaughter >= 1) setFard("granddaughter", granddaughter, fr(1, 6), "1/6", "Granddaughter(s) take 1/6 to complete 2/3 alongside one daughter", "Cucu perempuan mengambil 1/6 untuk melengkapkan 2/3 bersama seorang anak perempuan");
      }
      // daughter >= 2 → granddaughters blocked (hajb) when no grandson
    }
  }

  // Asabah (residuary) selection — only the nearest class inherits the remainder
  let asabah: { members: { key: HeirType; weight: number; count: number }[]; kind: ShareKind } | null = null;

  if (son > 0) {
    const m = [{ key: "son" as HeirType, weight: 2, count: son }];
    if (daughter > 0) m.push({ key: "daughter", weight: 1, count: daughter });
    asabah = { members: m, kind: "asabah" };
  } else if (grandson > 0) {
    const m = [{ key: "grandson" as HeirType, weight: 2, count: grandson }];
    if (granddaughter > 0) m.push({ key: "granddaughter", weight: 1, count: granddaughter });
    asabah = { members: m, kind: "asabah" };
  } else if (fatherP) {
    asabah = { members: [{ key: "father", weight: 1, count: 1 }], kind: "asabah" };
  } else if (gfP) {
    asabah = { members: [{ key: "grandfather", weight: 1, count: 1 }], kind: "asabah" };
  } else {
    // Siblings level — no son, no grandson, no father, no grandfather
    if (ms > 0 && !hasDescendant) {
      const mf = ms === 1 ? fr(1, 6) : fr(1, 3);
      setFard("maternal_sibling", ms, mf, fstr(mf),
        `Maternal sibling(s) ${ms === 1 ? "receive 1/6" : "share 1/3 equally (male and female alike)"} (Quran 4:12)`,
        `Saudara seibu ${ms === 1 ? "menerima 1/6" : "berkongsi 1/3 sama rata (lelaki dan perempuan sama)"} (Al-Quran 4:12)`);
    }

    if (fb > 0) {
      const m = [{ key: "full_brother" as HeirType, weight: 2, count: fb }];
      if (fs > 0) m.push({ key: "full_sister", weight: 1, count: fs });
      asabah = { members: m, kind: "asabah" };
    } else if (fs > 0) {
      if (hasFemaleDesc) {
        asabah = { members: [{ key: "full_sister", weight: 1, count: fs }], kind: "maal_ghayr" };
      } else if (fs === 1) {
        setFard("full_sister", 1, fr(1, 2), "1/2", "A single full sister receives 1/2 (Quran 4:176)", "Seorang saudara perempuan seibu sebapa menerima 1/2 (Al-Quran 4:176)");
      } else {
        setFard("full_sister", fs, fr(2, 3), "2/3", "Two or more full sisters share 2/3 (Quran 4:176)", "Dua atau lebih saudara perempuan seibu sebapa berkongsi 2/3 (Al-Quran 4:176)");
      }
    }

    const patBlocked = fb > 0 || (fs > 0 && hasFemaleDesc);
    if (!asabah && !patBlocked) {
      if (fs >= 2) {
        if (pb > 0) {
          const m = [{ key: "paternal_brother" as HeirType, weight: 2, count: pb }];
          if (ps > 0) m.push({ key: "paternal_sister", weight: 1, count: ps });
          asabah = { members: m, kind: "asabah" };
        }
        // else paternal siblings blocked by 2+ full sisters
      } else if (fs === 1) {
        if (pb > 0) {
          const m = [{ key: "paternal_brother" as HeirType, weight: 2, count: pb }];
          if (ps > 0) m.push({ key: "paternal_sister", weight: 1, count: ps });
          asabah = { members: m, kind: "asabah" };
        } else if (ps > 0) {
          setFard("paternal_sister", ps, fr(1, 6), "1/6", "Paternal sister(s) take 1/6 to complete 2/3 with one full sister", "Saudara perempuan sebapa mengambil 1/6 untuk melengkapkan 2/3 bersama seorang saudara perempuan seibu sebapa");
        }
      } else {
        // no full siblings
        if (pb > 0) {
          const m = [{ key: "paternal_brother" as HeirType, weight: 2, count: pb }];
          if (ps > 0) m.push({ key: "paternal_sister", weight: 1, count: ps });
          asabah = { members: m, kind: "asabah" };
        } else if (ps > 0) {
          if (hasFemaleDesc) asabah = { members: [{ key: "paternal_sister", weight: 1, count: ps }], kind: "maal_ghayr" };
          else if (ps === 1) setFard("paternal_sister", 1, fr(1, 2), "1/2", "A single paternal sister receives 1/2 (Quran 4:176)", "Seorang saudara perempuan sebapa menerima 1/2 (Al-Quran 4:176)");
          else setFard("paternal_sister", ps, fr(2, 3), "2/3", "Two or more paternal sisters share 2/3 (Quran 4:176)", "Dua atau lebih saudara perempuan sebapa berkongsi 2/3 (Al-Quran 4:176)");
        }
      }
    }

    if (!asabah && uncle) {
      asabah = { members: [{ key: "paternal_uncle", weight: 1, count: num("paternal_uncle") }], kind: "asabah" };
    }
  }

  // Sum fixed shares
  let sumFard: Frac = ZERO;
  (Object.keys(E) as HeirType[]).forEach((k) => { sumFard = addF(sumFard, E[k]!.fard); });

  let residuary: Frac = ZERO;

  if (dec(sumFard) > 1) {
    // 'Awl — proportionally reduce fixed shares so they sum to 1; no residuary remains
    (Object.keys(E) as HeirType[]).forEach((k) => {
      E[k]!.fard = divF(E[k]!.fard, sumFard);
      E[k]!.kind = "fard";
    });
    adjustments.push({ en: `'Awl applied: fixed shares exceeded the estate, so all shares were proportionally reduced (denominator raised to ${sumFard.n}/${sumFard.d}).`, bm: `'Awl digunakan: bahagian tetap melebihi harta, jadi semua bahagian dikurangkan secara berkadar.` });
    asabah = null;
  } else {
    const residue = subF(ONE, sumFard);
    if (asabah && dec(residue) > 0) {
      const totalW = asabah.members.reduce((s, m) => s + m.weight * m.count, 0);
      asabah.members.forEach((m) => {
        const portion = mulF(residue, fr(m.weight * m.count, totalW));
        if (E[m.key] && E[m.key]!.fard) {
          E[m.key]!.fard = addF(E[m.key]!.fard, portion);
          E[m.key]!.kind = "fard+asabah";
        } else {
          const baseKind: ShareKind = asabah!.kind === "maal_ghayr" ? "maal_ghayr" : "asabah";
          E[m.key] = { count: m.count, fard: portion, kind: baseKind, label: "residuary", basis: KIND_BASIS[baseKind].en, basisBm: KIND_BASIS[baseKind].bm };
        }
      });
    } else if (dec(residue) > 0) {
      // Radd — return surplus to fixed-share heirs proportionally, excluding the spouse
      const nonSpouse = (Object.keys(E) as HeirType[]).filter((k) => k !== "husband" && k !== "wife" && E[k]!.fard);
      let sumNon: Frac = ZERO;
      nonSpouse.forEach((k) => { sumNon = addF(sumNon, E[k]!.fard); });
      if (nonSpouse.length > 0 && dec(sumNon) > 0) {
        nonSpouse.forEach((k) => {
          const extra = mulF(residue, divF(E[k]!.fard, sumNon));
          E[k]!.fard = addF(E[k]!.fard, extra);
          E[k]!.kind = "radd";
        });
        adjustments.push({ en: "Radd applied: no residuary heir, so the surplus was returned proportionally to the fixed-share heirs (the spouse is excluded).", bm: "Radd digunakan: tiada waris asabah, jadi lebihan dipulangkan secara berkadar kepada waris bahagian tetap (pasangan dikecualikan)." });
      } else {
        residuary = residue;
      }
    }
  }

  // Build display shares in heir-config order
  const shares: HeirShare[] = [];
  HEIR_CONFIGS.forEach((cfg) => {
    const e = E[cfg.key];
    if (!e || dec(e.fard) <= 0) return;
    const kindBasis = e.basis && e.kind !== "fard+asabah" && e.kind !== "radd" ? { en: e.basis, bm: e.basisBm } : KIND_BASIS[e.kind];
    shares.push({
      key: cfg.key,
      count: e.count,
      fraction: e.kind === "fard+asabah" ? `${e.label} (${fstr(e.fard)} total)` : fstr(e.fard),
      percentage: dec(e.fard) * 100,
      amount: estateValue * dec(e.fard),
      kind: e.kind,
      basis: e.kind === "fard" ? e.basis : kindBasis.en,
      basisBm: e.kind === "fard" ? e.basisBm : kindBasis.bm,
    });
  });

  return {
    shares,
    residuary: Math.max(0, estateValue * dec(residuary)),
    adjustments,
    method: "Detailed Faraid distribution — fixed shares (ashab al-furud), residuary (asabah), with 'Awl, Radd & Hajb. Quran 4:11-12, 4:176.",
    methodBm: "Pengagihan Faraid terperinci — bahagian tetap (ashab al-furud), asabah, dengan 'Awl, Radd & Hajb. Al-Quran 4:11-12, 4:176.",
  };
}

const KIND_BADGE: Record<ShareKind, { en: string; bm: string; cls: string }> = {
  fard: { en: "Fixed", bm: "Tetap", cls: "border-secondary/40 text-secondary" },
  asabah: { en: "Residuary", bm: "Asabah", cls: "border-emerald-600/40 text-emerald-400" },
  "fard+asabah": { en: "Fixed + Residuary", bm: "Tetap + Asabah", cls: "border-emerald-600/40 text-emerald-400" },
  radd: { en: "Radd", bm: "Radd", cls: "border-sky-600/40 text-sky-400" },
  maal_ghayr: { en: "Asabah ma'al ghayr", bm: "Asabah ma'al ghayr", cls: "border-emerald-600/40 text-emerald-400" },
};

const EMPTY_HEIRS = (): Record<HeirType, number> => ({
  husband: 0, wife: 0, father: 0, mother: 0, son: 0, daughter: 0,
  grandson: 0, granddaughter: 0, grandfather: 0, grandmother: 0,
  full_brother: 0, full_sister: 0, paternal_brother: 0, paternal_sister: 0,
  maternal_sibling: 0, paternal_uncle: 0,
});

const GROUP_ORDER: Group[] = ["spouse_parents", "descendants", "grandparents", "siblings", "extended"];

type TFn = (en: string, bm: string) => string;

// Reusable heir-input grid (shared by the main calculator and the Munasakha tool)
function HeirInputGrid({ gender, heirs, onUpdate, mode, t }: {
  gender: "male" | "female";
  heirs: Record<HeirType, number>;
  onUpdate: (k: HeirType, v: number) => void;
  mode: string;
  t: TFn;
}) {
  const available = HEIR_CONFIGS.filter((h) => {
    if (gender === "male" && h.key === "husband") return false;
    if (gender === "female" && h.key === "wife") return false;
    return true;
  });
  return (
    <div className="space-y-4">
      {GROUP_ORDER.map((grp) => {
        const items = available.filter((h) => h.group === grp);
        if (items.length === 0) return null;
        return (
          <div key={grp}>
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary/80 mb-2">{t(GROUP_LABELS[grp].en, GROUP_LABELS[grp].bm)}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((h) => (
                <div key={h.key} className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-2">
                  <span className="text-sm text-foreground pr-2">{mode === "bm" ? h.labelBm : h.labelEn}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => onUpdate(h.key, (heirs[h.key] || 0) - 1)} disabled={(heirs[h.key] || 0) === 0}>-</Button>
                    <span className="w-6 text-center text-sm font-mono font-bold text-secondary">{heirs[h.key] || 0}</span>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => onUpdate(h.key, (heirs[h.key] || 0) + 1)} disabled={(heirs[h.key] || 0) >= h.maxCount}>+</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Reusable list of computed shares (used by the main result and Munasakha sub-result)
function ShareList({ result, mode, t }: { result: FaraidResult; mode: string; t: TFn }) {
  return (
    <div className="space-y-3">
      {result.shares.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("No qualifying heirs — this share would pass to the Baitulmal.", "Tiada waris layak — bahagian ini akan diserahkan kepada Baitulmal.")}</p>
      )}
      {result.shares.map((share, i) => (
        <div key={i} className="border border-border/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-foreground">{mode === "bm" ? HEIR_LABELS[share.key].bm : HEIR_LABELS[share.key].en}</span>
              {share.count > 1 && <Badge variant="outline" className="text-xs">x{share.count}</Badge>}
              <Badge variant="outline" className={`text-[10px] ${KIND_BADGE[share.kind].cls}`}>{t(KIND_BADGE[share.kind].en, KIND_BADGE[share.kind].bm)}</Badge>
            </div>
            <span className="font-mono font-bold text-secondary">RM {share.amount.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("Share", "Bahagian")}: {share.fraction} ({share.percentage.toFixed(2)}%)</span>
            {share.count > 1 && <span>{t("Each", "Setiap seorang")}: RM {(share.amount / share.count).toLocaleString("en-MY", { minimumFractionDigits: 2 })}</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-1 italic">{mode === "bm" ? share.basisBm : share.basis}</p>
        </div>
      ))}
      {result.residuary > 0.01 && (
        <div className="border border-amber-800/30 bg-amber-900/10 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm text-amber-400">{t("Unallocated Residue (Baitulmal)", "Baki Tidak Diagihkan (Baitulmal)")}</span>
            <span className="font-mono font-bold text-amber-400">RM {result.residuary.toLocaleString("en-MY", { minimumFractionDigits: 2 })}</span>
          </div>
          <p className="text-xs text-amber-400/70 mt-1">{t("No residuary heir and no eligible heir for Radd — surplus passes to the Baitulmal.", "Tiada waris asabah dan tiada waris layak untuk Radd — lebihan diserahkan kepada Baitulmal.")}</p>
        </div>
      )}
    </div>
  );
}

// Munasakha (تناسخ): an heir survives the deceased but dies before the estate is divided.
// Their inherited share becomes part of THEIR estate and is redistributed to THEIR heirs.
function MunasakhaTool({ mainResult, mode, t }: { mainResult: FaraidResult | null; mode: string; t: TFn }) {
  const [selIdx, setSelIdx] = useState<number>(-1);
  const [gender, setGender] = useState<"male" | "female">("male");
  const [heirs, setHeirs] = useState<Record<HeirType, number>>(EMPTY_HEIRS());
  const [sub, setSub] = useState<FaraidResult | null>(null);

  const candidates = mainResult?.shares ?? [];
  const selected = selIdx >= 0 && selIdx < candidates.length ? candidates[selIdx] : null;
  const perPerson = selected ? selected.amount / selected.count : 0;

  const update = (k: HeirType, v: number) => {
    const cfg = HEIR_CONFIGS.find((h) => h.key === k)!;
    setHeirs((p) => ({ ...p, [k]: Math.min(Math.max(0, v), cfg.maxCount) }));
  };

  const calc = () => {
    if (!selected || perPerson <= 0) return;
    const cleaned = { ...heirs };
    if (gender === "male") cleaned.husband = 0; else cleaned.wife = 0;
    setSub(calculateFaraid(gender, cleaned, perPerson));
  };

  const reset = () => { setSelIdx(-1); setHeirs(EMPTY_HEIRS()); setSub(null); };

  return (
    <Card className="border-secondary/20">
      <CardHeader className="pb-3">
        <h3 className="font-serif font-semibold text-foreground">{t("Munasakha — heir dies before distribution", "Munasakha — waris meninggal sebelum pengagihan")}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {t(
            "If an heir outlives the deceased but passes away before the estate is shared out, that heir's portion is valid and is redistributed to their own heirs by a second faraid. This tool redistributes only the inherited portion shown below — in a real estate it must be combined with the deceased heir's other assets, debts and wasiat first. Calculate the main distribution, then pick the heir who has since died.",
            "Jika seorang waris hidup lebih lama daripada si mati tetapi meninggal dunia sebelum harta diagihkan, bahagian waris itu sah dan diagihkan semula kepada warisnya sendiri melalui faraid kedua. Alat ini hanya mengagihkan semula bahagian warisan yang ditunjukkan di bawah — dalam harta sebenar ia mesti digabung dahulu dengan aset, hutang dan wasiat waris yang meninggal. Kira pengagihan utama, kemudian pilih waris yang telah meninggal."
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!mainResult ? (
          <p className="text-sm text-muted-foreground">{t("Calculate the main distribution first (Distribution tab), then return here.", "Kira pengagihan utama dahulu (tab Pengagihan), kemudian kembali ke sini.")}</p>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("The main distribution produced no heir shares to redistribute.", "Pengagihan utama tidak menghasilkan bahagian waris untuk diagihkan semula.")}</p>
        ) : (
          <>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">{t("Which heir has since passed away?", "Waris yang manakah telah meninggal dunia?")}</label>
              <div className="grid grid-cols-1 gap-2">
                {candidates.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => { setSelIdx(i); setSub(null); }}
                    className={`text-left rounded-md border px-3 py-2 text-sm transition-colors ${selIdx === i ? "border-secondary bg-secondary/10 text-secondary" : "border-border/50 bg-muted/20 text-foreground hover:border-secondary/40"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{mode === "bm" ? HEIR_LABELS[c.key].bm : HEIR_LABELS[c.key].en}{c.count > 1 ? ` (x${c.count})` : ""}</span>
                      <span className="font-mono text-xs">RM {(c.amount / c.count).toLocaleString("en-MY", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </button>
                ))}
              </div>
              {selected && selected.count > 1 && (
                <p className="text-xs text-amber-400/80 mt-2">{t(`This line is shared by ${selected.count} people. The redistribution below uses one person's portion (RM ${(perPerson).toLocaleString("en-MY", { minimumFractionDigits: 2 })}). Repeat for each who has died.`, `Baris ini dikongsi oleh ${selected.count} orang. Pengagihan di bawah menggunakan bahagian seorang (RM ${(perPerson).toLocaleString("en-MY", { minimumFractionDigits: 2 })}). Ulang bagi setiap yang meninggal.`)}</p>
              )}
            </div>

            {selected && (
              <>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">{t("Gender of the deceased heir", "Jantina waris yang meninggal")}</label>
                  <div className="flex gap-2">
                    <Button variant={gender === "male" ? "default" : "outline"} size="sm" onClick={() => { setGender("male"); setSub(null); }} className={gender === "male" ? "bg-secondary text-secondary-foreground" : ""}>{t("Male (Lelaki)", "Lelaki")}</Button>
                    <Button variant={gender === "female" ? "default" : "outline"} size="sm" onClick={() => { setGender("female"); setSub(null); }} className={gender === "female" ? "bg-secondary text-secondary-foreground" : ""}>{t("Female (Perempuan)", "Perempuan")}</Button>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground mb-2">{t("Heirs of the deceased heir", "Waris bagi waris yang meninggal")}</p>
                  <HeirInputGrid gender={gender} heirs={heirs} onUpdate={update} mode={mode} t={t} />
                </div>

                <div className="flex gap-3">
                  <Button onClick={calc} className="flex-1 bg-secondary hover:bg-secondary/90 text-secondary-foreground">{t("Redistribute this share", "Agihkan semula bahagian ini")}</Button>
                  <Button variant="outline" onClick={reset}>{t("Clear", "Kosongkan")}</Button>
                </div>
              </>
            )}

            {sub && (
              <div className="border-t border-border/30 pt-4">
                <p className="text-sm font-semibold text-secondary mb-2">{t(`Redistribution of RM ${perPerson.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`, `Pengagihan semula RM ${perPerson.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`)}</p>
                <ShareList result={sub} mode={mode} t={t} />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Wasiat Wajibah (وصية واجبة): Malaysian obligatory bequest for orphaned grandchildren
// whose parent (a child of the deceased) died BEFORE the deceased.
function WasiatWajibahTool({ mode, t }: { mode: string; t: TFn }) {
  const [estate, setEstate] = useState("");
  const [parentShare, setParentShare] = useState("");
  const [grandsons, setGrandsons] = useState("0");
  const [granddaughters, setGranddaughters] = useState("0");
  const [out, setOut] = useState<{ bequest: number; capped: boolean; perSon: number; perDaughter: number; gs: number; gd: number } | null>(null);
  const [err, setErr] = useState("");

  const calc = () => {
    const E = parseFloat(estate), P = parseFloat(parentShare);
    const gs = Math.max(0, Math.floor(parseInt(grandsons) || 0));
    const gd = Math.max(0, Math.floor(parseInt(granddaughters) || 0));
    if (isNaN(E) || E <= 0) { setErr(t("Enter a valid estate value greater than zero.", "Masukkan nilai harta yang sah lebih daripada sifar.")); setOut(null); return; }
    if (isNaN(P) || P < 0) { setErr(t("Enter the late parent's notional share (zero or more).", "Masukkan bahagian andaian ibu/bapa yang meninggal (sifar atau lebih).")); setOut(null); return; }
    if (gs + gd === 0) { setErr(t("Enter at least one orphaned grandchild.", "Masukkan sekurang-kurangnya seorang cucu yatim.")); setOut(null); return; }
    setErr("");
    const cap = E / 3;
    const bequest = Math.min(P, cap);
    const units = gs * 2 + gd;
    const unit = units > 0 ? bequest / units : 0;
    setOut({ bequest, capped: P > cap, perSon: unit * 2, perDaughter: unit, gs, gd });
  };

  return (
    <Card className="border-secondary/20">
      <CardHeader className="pb-3">
        <h3 className="font-serif font-semibold text-foreground">{t("Wasiat Wajibah — orphaned grandchildren", "Wasiat Wajibah — cucu yatim")}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {t(
            "Classical faraid has no 'representation': if a son or daughter dies BEFORE the deceased, that line's children normally inherit nothing while an uncle/aunt survives. Malaysian state enactments correct this with an obligatory bequest (wasiat wajibah) to those orphaned grandchildren — equal to what their late parent would have received, but capped at one-third (1/3) of the estate — taken off the top before the normal faraid split.",
            "Faraid klasik tiada konsep 'penggantian': jika seorang anak lelaki atau perempuan meninggal SEBELUM si mati, anak-anak baris itu biasanya tidak mewarisi apa-apa selagi bapa/ibu saudara masih hidup. Enakmen negeri di Malaysia membetulkannya dengan wasiat wajibah kepada cucu yatim itu — sama dengan bahagian yang sepatutnya diterima ibu/bapa mereka, tetapi terhad kepada satu pertiga (1/3) harta — diambil dahulu sebelum pengagihan faraid biasa."
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">{t("Total estate value (RM)", "Jumlah nilai harta (RM)")}</label>
            <Input type="number" value={estate} onChange={(e) => setEstate(e.target.value)} placeholder="500000" className="font-mono" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">{t("Share the late parent would have received (RM)", "Bahagian yang sepatutnya diterima ibu/bapa (RM)")}</label>
            <Input type="number" value={parentShare} onChange={(e) => setParentShare(e.target.value)} placeholder="100000" className="font-mono" />
            <p className="text-[11px] text-muted-foreground mt-1">{t("Tip: use the Distribution tab with the late child counted as alive to find this figure.", "Petua: guna tab Pengagihan dengan anak yang meninggal dikira sebagai hidup untuk mendapat angka ini.")}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">{t("Number of grandsons", "Bilangan cucu lelaki")}</label>
            <Input type="number" min="0" step="1" value={grandsons} onChange={(e) => setGrandsons(e.target.value)} className="font-mono" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">{t("Number of granddaughters", "Bilangan cucu perempuan")}</label>
            <Input type="number" min="0" step="1" value={granddaughters} onChange={(e) => setGranddaughters(e.target.value)} className="font-mono" />
          </div>
        </div>
        <Button onClick={calc} className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground">{t("Calculate obligatory bequest", "Kira wasiat wajibah")}</Button>
        {err && <p className="text-xs text-rose-400">{err}</p>}

        {out && (
          <div className="space-y-2 border-t border-border/30 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{t("Obligatory bequest (total)", "Wasiat wajibah (jumlah)")}</span>
              <span className="font-mono font-bold text-secondary">RM {out.bequest.toLocaleString("en-MY", { minimumFractionDigits: 2 })}</span>
            </div>
            {out.capped && (
              <p className="text-xs text-amber-400/80">{t("Capped at 1/3 of the estate — the late parent's full notional share exceeded the legal maximum.", "Dihadkan pada 1/3 harta — bahagian penuh ibu/bapa yang meninggal melebihi had undang-undang.")}</p>
            )}
            {out.gs > 0 && <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{t(`Each grandson (x${out.gs})`, `Setiap cucu lelaki (x${out.gs})`)}</span><span className="font-mono">RM {out.perSon.toLocaleString("en-MY", { minimumFractionDigits: 2 })}</span></div>}
            {out.gd > 0 && <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{t(`Each granddaughter (x${out.gd})`, `Setiap cucu perempuan (x${out.gd})`)}</span><span className="font-mono">RM {out.perDaughter.toLocaleString("en-MY", { minimumFractionDigits: 2 })}</span></div>}
            <p className="text-[11px] text-muted-foreground italic">{t("Grandsons take twice a granddaughter's portion (2:1). The remaining estate after this bequest is then distributed by normal faraid among the living heirs.", "Cucu lelaki mengambil dua kali bahagian cucu perempuan (2:1). Baki harta selepas wasiat ini diagihkan secara faraid biasa kepada waris yang hidup.")}</p>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground italic border-t border-border/30 pt-2">
          {t(
            "Basis: state Wasiat enactments (e.g. Selangor Wills of Muslims Enactment), modelled on the Egyptian Law of Testamentary Dispositions 1946. Scope (son's vs daughter's line) and conditions vary by state — confirm with the Shariah Court.",
            "Asas: Enakmen Wasiat negeri (cth. Enakmen Wasiat Orang Islam Selangor), berasaskan Undang-Undang Wasiat Mesir 1946. Skop (baris anak lelaki vs perempuan) dan syarat berbeza mengikut negeri — sahkan dengan Mahkamah Syariah."
          )}
        </p>
      </CardContent>
    </Card>
  );
}

const SPECIAL_CASES: { titleEn: string; titleBm: string; bodyEn: string; bodyBm: string }[] = [
  {
    titleEn: "Simultaneous death (al-Gharqa wal-Hadma)",
    titleBm: "Kematian serentak (al-Gharqa wal-Hadma)",
    bodyEn: "When two people who would inherit from each other die in the same event (drowning, fire, road accident, collapsed building) and the order of death cannot be established, the majority (Hanafi, Maliki, Shafi'i) hold that neither inherits from the other. Each estate is distributed only among the heirs who were already alive. A minority Hanbali view lets them inherit from each other's pre-event property.",
    bodyBm: "Apabila dua orang yang saling mewarisi meninggal dalam kejadian yang sama (lemas, kebakaran, kemalangan jalan raya, bangunan runtuh) dan susunan kematian tidak dapat dipastikan, majoriti (Hanafi, Maliki, Syafi'i) berpendapat tiada yang mewarisi yang lain. Setiap harta diagihkan hanya kepada waris yang sememangnya hidup. Pandangan minoriti Hanbali membenarkan mereka saling mewarisi daripada harta sebelum kejadian.",
  },
  {
    titleEn: "Missing heir (al-Mafqud)",
    titleBm: "Waris hilang (al-Mafqud)",
    bodyEn: "An heir whose life or death is unknown. The estate is not closed for their portion: the court reserves the missing person's share and gives the other heirs only the minimum they are certain to receive. The reserved share is released once the court rules the person alive (paid to them) or legally dead (redistributed among those alive at the original death).",
    bodyBm: "Waris yang tidak diketahui hidup atau matinya. Harta tidak diselesaikan bagi bahagiannya: mahkamah menahan bahagian orang hilang itu dan memberi waris lain hanya jumlah minimum yang pasti. Bahagian yang ditahan dilepaskan apabila mahkamah memutuskan orang itu hidup (dibayar kepadanya) atau mati dari segi undang-undang (diagihkan semula kepada yang hidup ketika kematian asal).",
  },
  {
    titleEn: "Unborn child (al-Haml)",
    titleBm: "Anak dalam kandungan (al-Haml)",
    bodyEn: "A child conceived before the deceased's death and later born alive is a valid heir. Because the number and sex of the unborn are unknown, distribution is paused or the LARGER of the possible shares (e.g. assuming the maximum number of sons) is reserved for the unborn; the balance is settled after a live birth confirms the actual heirs.",
    bodyBm: "Anak yang dikandung sebelum kematian si mati dan kemudian dilahirkan hidup adalah waris yang sah. Oleh kerana bilangan dan jantina kandungan tidak diketahui, pengagihan ditangguhkan atau bahagian yang LEBIH BESAR (cth. mengandaikan bilangan anak lelaki maksimum) ditahan untuk kandungan; bakinya diselesaikan selepas kelahiran hidup mengesahkan waris sebenar.",
  },
  {
    titleEn: "Ambiguous-sex heir (al-Khuntha al-Mushkil)",
    titleBm: "Waris khunsa musykil (al-Khuntha al-Mushkil)",
    bodyEn: "An heir whose sex is genuinely indeterminate, whose share would differ as male or female. The cautious approach gives the khuntha the SMALLER of the two possible shares and holds the difference until the sex is established; other scholars share the difference among the affected heirs.",
    bodyBm: "Waris yang jantinanya benar-benar tidak dapat ditentukan, yang bahagiannya berbeza sebagai lelaki atau perempuan. Pendekatan berhati-hati memberi khunsa bahagian yang LEBIH KECIL antara dua kemungkinan dan menahan bezanya sehingga jantina disahkan; sebahagian ulama membahagikan beza itu antara waris yang terlibat.",
  },
];

export default function FaraidCalculatorPage() {
  const { mode } = useLanguage();
  const t = (en: string, bm: string) => (mode === "bm" ? bm : en);

  const [activeView, setActiveView] = useState<"main" | "succession">("main");

  const emptyHeirs = EMPTY_HEIRS;

  const [deceasedGender, setDeceasedGender] = useState<"male" | "female">("male");
  const [estateValue, setEstateValue] = useState("");
  const [heirs, setHeirs] = useState<Record<HeirType, number>>(emptyHeirs());
  const [result, setResult] = useState<FaraidResult | null>(null);

  const updateHeir = (key: HeirType, val: number) => {
    const config = HEIR_CONFIGS.find((h) => h.key === key)!;
    setHeirs((prev) => ({ ...prev, [key]: Math.min(Math.max(0, val), config.maxCount) }));
  };

  const handleCalculate = () => {
    const val = parseFloat(estateValue);
    if (isNaN(val) || val <= 0) return;
    const cleaned = { ...heirs };
    if (deceasedGender === "male") cleaned.husband = 0;
    if (deceasedGender === "female") cleaned.wife = 0;
    setResult(calculateFaraid(deceasedGender, cleaned, val));
  };

  const handleReset = () => {
    setHeirs(emptyHeirs());
    setEstateValue("");
    setResult(null);
  };

  const availableHeirs = HEIR_CONFIGS.filter((h) => {
    if (deceasedGender === "male" && h.key === "husband") return false;
    if (deceasedGender === "female" && h.key === "wife") return false;
    return true;
  });

  const groups: Group[] = ["spouse_parents", "descendants", "grandparents", "siblings", "extended"];

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">
          {t("Faraid Calculator", "Kalkulator Faraid")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "Detailed Islamic inheritance: fixed shares (fardh), residuary (asabah), with 'Awl, Radd & blocking (hajb) — Quran 4:11-12 & 4:176",
            "Pewarisan Islam terperinci: bahagian tetap (fardhu), asabah, dengan 'Awl, Radd & hajb — Al-Quran 4:11-12 & 4:176"
          )}
        </p>
      </div>

      <div className="flex gap-2">
        <Button variant={activeView === "main" ? "default" : "outline"} size="sm" onClick={() => setActiveView("main")} className={activeView === "main" ? "bg-secondary text-secondary-foreground" : ""}>
          {t("Distribution", "Pengagihan")}
        </Button>
        <Button variant={activeView === "succession" ? "default" : "outline"} size="sm" onClick={() => setActiveView("succession")} className={activeView === "succession" ? "bg-secondary text-secondary-foreground" : ""}>
          {t("Succession & Special Cases", "Penggantian & Kes Khas")}
        </Button>
      </div>

      {activeView === "main" && (
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <h2 className="font-serif font-semibold text-foreground">{t("Deceased Information", "Maklumat Si Mati")}</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">{t("Gender of Deceased", "Jantina Si Mati")}</label>
                <div className="flex gap-2">
                  <Button variant={deceasedGender === "male" ? "default" : "outline"} size="sm" onClick={() => setDeceasedGender("male")} className={deceasedGender === "male" ? "bg-secondary text-secondary-foreground" : ""}>
                    {t("Male (Lelaki)", "Lelaki")}
                  </Button>
                  <Button variant={deceasedGender === "female" ? "default" : "outline"} size="sm" onClick={() => setDeceasedGender("female")} className={deceasedGender === "female" ? "bg-secondary text-secondary-foreground" : ""}>
                    {t("Female (Perempuan)", "Perempuan")}
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">{t("Total Estate Value (RM)", "Jumlah Nilai Harta Pusaka (RM)")}</label>
                <Input type="number" value={estateValue} onChange={(e) => setEstateValue(e.target.value)} placeholder="e.g. 500000" className="font-mono" />
                <p className="text-xs text-muted-foreground mt-1">{t("After deducting funeral expenses, debts, and wasiat (max 1/3)", "Selepas menolak kos pengebumian, hutang, dan wasiat (maks 1/3)")}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <h2 className="font-serif font-semibold text-foreground">{t("Living Heirs", "Waris Yang Hidup")}</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {groups.map((grp) => {
                const items = availableHeirs.filter((h) => h.group === grp);
                if (items.length === 0) return null;
                return (
                  <div key={grp}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-secondary/80 mb-2">
                      {t(GROUP_LABELS[grp].en, GROUP_LABELS[grp].bm)}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {items.map((h) => (
                        <div key={h.key} className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-2">
                          <span className="text-sm text-foreground pr-2">{mode === "bm" ? h.labelBm : h.labelEn}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => updateHeir(h.key, (heirs[h.key] || 0) - 1)} disabled={(heirs[h.key] || 0) === 0}>-</Button>
                            <span className="w-6 text-center text-sm font-mono font-bold text-secondary">{heirs[h.key] || 0}</span>
                            <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => updateHeir(h.key, (heirs[h.key] || 0) + 1)} disabled={(heirs[h.key] || 0) >= h.maxCount}>+</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button onClick={handleCalculate} className="flex-1 bg-secondary hover:bg-secondary/90 text-secondary-foreground" disabled={!estateValue || parseFloat(estateValue) <= 0}>
              {t("Calculate Faraid", "Kira Faraid")}
            </Button>
            <Button variant="outline" onClick={handleReset}>{t("Reset", "Set Semula")}</Button>
          </div>
        </div>

        <div className="space-y-4">
          {result ? (
            <>
              <Card className="border-secondary/30">
                <CardHeader className="pb-3">
                  <h2 className="font-serif font-semibold text-secondary">{t("Distribution Result", "Keputusan Pengagihan")}</h2>
                  <p className="text-xs text-muted-foreground">{mode === "bm" ? result.methodBm : result.method}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.shares.length === 0 && (
                    <p className="text-sm text-muted-foreground">{t("No qualifying heirs entered. The estate would pass to the Baitulmal.", "Tiada waris yang layak dimasukkan. Harta akan diserahkan kepada Baitulmal.")}</p>
                  )}
                  {result.shares.map((share, i) => (
                    <div key={i} className="border border-border/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-foreground">{mode === "bm" ? HEIR_LABELS[share.key].bm : HEIR_LABELS[share.key].en}</span>
                          {share.count > 1 && <Badge variant="outline" className="text-xs">x{share.count}</Badge>}
                          <Badge variant="outline" className={`text-[10px] ${KIND_BADGE[share.kind].cls}`}>{t(KIND_BADGE[share.kind].en, KIND_BADGE[share.kind].bm)}</Badge>
                        </div>
                        <span className="font-mono font-bold text-secondary">RM {share.amount.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{t("Share", "Bahagian")}: {share.fraction} ({share.percentage.toFixed(2)}%)</span>
                        {share.count > 1 && <span>{t("Each", "Setiap seorang")}: RM {(share.amount / share.count).toLocaleString("en-MY", { minimumFractionDigits: 2 })}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 italic">{mode === "bm" ? share.basisBm : share.basis}</p>
                    </div>
                  ))}
                  {result.residuary > 0.01 && (
                    <div className="border border-amber-800/30 bg-amber-900/10 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-amber-400">{t("Unallocated Residue (Baitulmal)", "Baki Tidak Diagihkan (Baitulmal)")}</span>
                        <span className="font-mono font-bold text-amber-400">RM {result.residuary.toLocaleString("en-MY", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <p className="text-xs text-amber-400/70 mt-1">{t("No residuary heir and no eligible heir for Radd — surplus passes to the Baitulmal.", "Tiada waris asabah dan tiada waris layak untuk Radd — lebihan diserahkan kepada Baitulmal.")}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {result.adjustments.length > 0 && (
                <Card className="border-sky-800/30 bg-sky-900/10">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-sky-300 mb-2">{t("Adjustments Applied", "Pelarasan Yang Digunakan")}</h3>
                    <ul className="space-y-1.5">
                      {result.adjustments.map((a, i) => (
                        <li key={i} className="text-xs text-sky-200/80 flex gap-2">
                          <span className="text-sky-400 mt-0.5">•</span>
                          <span>{mode === "bm" ? a.bm : a.en}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-muted/20">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2">{t("Quranic & Methodological Basis", "Asas Al-Quran & Metodologi")}</h3>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p><strong>Surah An-Nisa 4:11</strong> - {t("Shares of children and parents", "Bahagian anak-anak dan ibu bapa")}</p>
                    <p><strong>Surah An-Nisa 4:12</strong> - {t("Shares of spouses and maternal siblings", "Bahagian pasangan dan saudara seibu")}</p>
                    <p><strong>Surah An-Nisa 4:176</strong> - {t("Shares of full and paternal siblings (Kalalah)", "Bahagian adik beradik seibu sebapa dan sebapa (Kalalah)")}</p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border/30 space-y-1.5 text-xs text-muted-foreground">
                    <p><strong className="text-foreground">{t("This engine models", "Enjin ini memodelkan")}:</strong> {t("ashab al-furud (fixed shares), asabah (residuary), 'Awl (proportional reduction), Radd (return of surplus), Umariyyatan (al-Gharrawayn), asabah ma'al ghayr, and hajb (blocking) of grandchildren, grandparents and siblings.", "ashab al-furud (bahagian tetap), asabah, 'Awl (pengurangan berkadar), Radd (pemulangan lebihan), Umariyyatan (al-Gharrawayn), asabah ma'al ghayr, dan hajb (penghalang) cucu, datuk nenek dan adik beradik.")}</p>
                    <p className="italic">
                      {t(
                        "Limitations: the rare grandfather-with-siblings (jadd wa ikhwah muqasamah) and distant kindred (dhawu al-arham) cases are simplified, and the grandfather is treated like the father. Verify complex estates with a qualified Shariah practitioner and apply for a Sijil Faraid from the Shariah Court for official distribution.",
                        "Batasan: kes datuk bersama adik beradik (jadd wa ikhwah muqasamah) dan dhawu al-arham diringkaskan, dan datuk dianggap seperti bapa. Sahkan harta kompleks dengan pengamal Syariah berkelayakan dan mohon Sijil Faraid daripada Mahkamah Syariah untuk pengagihan rasmi."
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-dashed border-border/50">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-secondary/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 7h6m-6 4h6m-3 4v3m-4-3h8l-4 3m-8-12a9 9 0 1118 0 9 9 0 01-18 0z" />
                  </svg>
                </div>
                <h3 className="font-serif font-semibold text-foreground mb-2">{t("Faraid Distribution", "Pengagihan Faraid")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t(
                    "Enter the deceased's details, select living heirs across all tiers, and enter the estate value to calculate the detailed Islamic inheritance distribution.",
                    "Masukkan maklumat si mati, pilih waris yang hidup merentasi semua peringkat, dan masukkan nilai harta pusaka untuk mengira pengagihan pewarisan Islam yang terperinci."
                  )}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      )}

      {activeView === "succession" && (
      <div className="space-y-4 max-w-3xl">
        <Card className="bg-muted/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              {t(
                "These tools handle what happens to a beneficiary's share when the beneficiary themselves dies, and other situations the basic split does not cover. Classical Sunni faraid has no 'representation' — a share belongs only to an heir alive at the moment of death — so each case below has its own rule.",
                "Alat ini menangani apa yang berlaku kepada bahagian seorang waris apabila waris itu sendiri meninggal, dan keadaan lain yang tidak diliputi oleh pengagihan asas. Faraid Sunni klasik tiada konsep 'penggantian' — bahagian hanya milik waris yang hidup pada saat kematian — jadi setiap kes di bawah mempunyai peraturannya sendiri."
              )}
            </p>
          </CardContent>
        </Card>

        <MunasakhaTool mainResult={result} mode={mode} t={t} />
        <WasiatWajibahTool mode={mode} t={t} />

        <Card>
          <CardHeader className="pb-3">
            <h3 className="font-serif font-semibold text-foreground">{t("Other special inheritance cases", "Kes pewarisan khas yang lain")}</h3>
            <p className="text-xs text-muted-foreground mt-1">{t("These are determined by the Shariah Court because they depend on facts that must be established (order of death, survival, sex, live birth).", "Ini ditentukan oleh Mahkamah Syariah kerana ia bergantung pada fakta yang perlu disahkan (susunan kematian, kelangsungan hidup, jantina, kelahiran hidup).")}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {SPECIAL_CASES.map((c, i) => (
              <div key={i} className="border border-border/50 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-secondary mb-1">{mode === "bm" ? c.titleBm : c.titleEn}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{mode === "bm" ? c.bodyBm : c.bodyEn}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-muted/20">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground italic">
              {t(
                "These cases draw on the Sunni schools and Malaysian state Wasiat enactments; the schools differ on several of them and practice varies by state, so the notes above describe the mainstream position rather than a single agreed ruling. They can also interact in complex ways — always confirm a real estate with a qualified Shariah practitioner and obtain a Sijil Faraid from the Shariah Court for official distribution.",
                "Kes ini berdasarkan mazhab Sunni dan Enakmen Wasiat negeri di Malaysia; mazhab berbeza dalam beberapa daripadanya dan amalan berbeza mengikut negeri, jadi nota di atas menerangkan pandangan arus perdana dan bukan satu hukum yang disepakati. Ia juga boleh berinteraksi secara kompleks — sentiasa sahkan harta sebenar dengan pengamal Syariah berkelayakan dan dapatkan Sijil Faraid daripada Mahkamah Syariah untuk pengagihan rasmi."
              )}
            </p>
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
}
