/**
 * Deadline templates for Malaysian Syariah court practice, grounded mainly in
 * the Syariah Court Civil Procedure (Federal Territories) Act 1998 (Akta 585)
 * and the Islamic Family Law (Federal Territories) Act 1984 (Akta 303). State
 * enactments largely mirror these but periods can differ.
 *
 * IMPORTANT (practitioner caveat): these are the ordinary Federal-Territories
 * periods. Always verify against the applicable STATE enactment, the sealed
 * saman/perintah and any specific directions of the Mahkamah Syariah before
 * relying on a date. The court may abridge or extend time.
 */

export type SyaDeadlineCategory =
  | "kehadiran"
  | "pliding"
  | "pendengaran"
  | "rayuan"
  | "penguatkuasaan"
  | "iddah"
  | "custom";

export interface ComputedSyaDeadline {
  title: string;
  category: SyaDeadlineCategory;
  dueDate: string; // ISO date
  basis: string;
  notes?: string;
}

interface TemplateRule {
  title: string;
  category: SyaDeadlineCategory;
  offsetDays?: number;
  offsetYears?: number;
  basis: string;
  notes?: string;
}

export interface SyaTriggerTemplate {
  trigger: string;
  label: string;
  description: string;
  rules: TemplateRule[];
}

export const SYA_DEADLINE_TRIGGERS: SyaTriggerTemplate[] = [
  {
    trigger: "saman_diserah",
    label: "Saman diserahkan kepada defendan (Summons served)",
    description:
      "Penyerahan saman dan pernyataan tuntutan ke atas defendan di Mahkamah Syariah.",
    rules: [
      {
        title: "Defendan hadir / failkan kehadiran",
        category: "kehadiran",
        offsetDays: 14,
        basis: "s.60–61 Akta 585 (tempoh lazim dalam saman)",
        notes:
          "Tempoh sebenar mengikut apa yang dinyatakan dalam saman yang dimeterai — sahkan pada dokumen dan enakmen negeri.",
      },
      {
        title: "Failkan pembelaan (dan tuntutan balas, jika ada)",
        category: "pliding",
        offsetDays: 21,
        basis: "s.68–69 Akta 585",
        notes:
          "Pembelaan difailkan dalam tempoh yang diarahkan Mahkamah selepas kehadiran; 21 hari adalah anggaran lazim — sahkan arahan Mahkamah.",
      },
    ],
  },
  {
    trigger: "permohonan_interlokutori",
    label: "Permohonan interlokutori difailkan (Interlocutory application filed)",
    description:
      "Notis permohonan (mis. nafkah interim, hadhanah interim, perintah injunksi) difailkan.",
    rules: [
      {
        title: "Failkan afidavit jawapan",
        category: "pliding",
        offsetDays: 14,
        basis: "Bhg. XVI Akta 585 (afidavit)",
        notes:
          "Tempoh jawapan biasanya ditetapkan oleh Mahkamah semasa sebutan — 14 hari adalah anggaran lazim.",
      },
    ],
  },
  {
    trigger: "penghakiman",
    label: "Penghakiman / perintah diberikan (Judgment or order made)",
    description: "Tarikh Mahkamah Syariah menjatuhkan penghakiman atau perintah.",
    rules: [
      {
        title: "Failkan notis rayuan (jika merayu)",
        category: "rayuan",
        offsetDays: 14,
        basis: "s.141 Akta 585",
        notes:
          "Notis rayuan dalam 14 hari dari tarikh keputusan (Mahkamah Rendah → Tinggi Syariah; Tinggi → Rayuan Syariah). Sahkan tempoh negeri.",
      },
      {
        title: "Mohon penguatkuasaan / pelaksanaan perintah",
        category: "penguatkuasaan",
        offsetDays: 30,
        basis: "Bhg. XIX Akta 585 (penguatkuasaan)",
        notes:
          "Peringatan diari untuk memulakan tindakan penguatkuasaan (notis penghakiman, hiwalah, saman penghutang penghakiman) jika perintah tidak dipatuhi.",
      },
    ],
  },
  {
    trigger: "talaq_dilafaz",
    label: "Talaq dilafazkan / perceraian didaftarkan (Divorce pronounced)",
    description:
      "Tarikh lafaz talaq disahkan Mahkamah atau perceraian didaftarkan — memulakan tempoh iddah.",
    rules: [
      {
        title: "Anggaran tamat tempoh iddah (3 bulan qamariah)",
        category: "iddah",
        offsetDays: 90,
        basis: "s.124 Akta 303; hukum syarak",
        notes:
          "Iddah sebenar mengikut hukum syarak (3 kali suci / 90 hari / hingga bersalin bagi yang hamil). Diarikan tuntutan nafkah iddah dan mut'ah dalam tempoh ini.",
      },
      {
        title: "Failkan pendaftaran perceraian & tuntutan sampingan",
        category: "pliding",
        offsetDays: 30,
        basis: "s.55A–57 Akta 303",
        notes:
          "Peringatan untuk memfailkan tuntutan sampingan (mut'ah, nafkah iddah, harta sepencarian, hadhanah) awal — boleh difailkan bersama prosiding perceraian.",
      },
    ],
  },
  {
    trigger: "kematian_pusaka",
    label: "Kematian si mati (Estate / faraid matter)",
    description:
      "Tarikh kematian bagi urusan faraid, wasiat dan pentadbiran pusaka.",
    rules: [
      {
        title: "Mohon sijil faraid di Mahkamah Syariah",
        category: "pendengaran",
        offsetDays: 60,
        basis: "Bidang kuasa mal Mahkamah Syariah; Akta/Enakmen Wasiat negeri",
        notes:
          "Tiada had masa statutori, tetapi permohonan awal mengelakkan komplikasi aset. Diarikan juga tuntutan wasiat (had 1/3) dan hibah.",
      },
    ],
  },
];

function addDays(d: Date, days: number): Date {
  const r = new Date(d.getTime());
  r.setDate(r.getDate() + days);
  return r;
}

function addYears(d: Date, years: number): Date {
  const r = new Date(d.getTime());
  r.setFullYear(r.getFullYear() + years);
  return r;
}

/** Roll a Saturday/Sunday due date forward to Monday (registry closed). */
function rollForwardOffWeekend(d: Date): Date {
  const r = new Date(d.getTime());
  const day = r.getUTCDay();
  if (day === 6) r.setUTCDate(r.getUTCDate() + 2);
  else if (day === 0) r.setUTCDate(r.getUTCDate() + 1);
  return r;
}

/**
 * Compute the standard deadlines flowing from a trigger event on a given date.
 * Returns an empty array for an unknown trigger.
 */
export function computeSyaDeadlines(
  trigger: string,
  triggerDateIso: string,
): ComputedSyaDeadline[] {
  const template = SYA_DEADLINE_TRIGGERS.find((t) => t.trigger === trigger);
  if (!template) return [];
  const base = new Date(triggerDateIso);
  if (Number.isNaN(base.getTime())) return [];

  return template.rules.map((rule) => {
    let due = base;
    if (rule.offsetYears) due = addYears(due, rule.offsetYears);
    if (rule.offsetDays) due = addDays(due, rule.offsetDays);
    // Procedural day-based periods roll off a weekend; the iddah period is a
    // substantive period of syarak and is NOT rolled.
    if (rule.offsetDays && !rule.offsetYears && rule.category !== "iddah") {
      due = rollForwardOffWeekend(due);
    }
    return {
      title: rule.title,
      category: rule.category,
      dueDate: due.toISOString(),
      basis: rule.basis,
      notes: rule.notes,
    };
  });
}
