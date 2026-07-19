import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
} from "docx";
import type { MeetingMinutes } from "../db";

type Labels = {
  attendees: string;
  agenda: string;
  decisions: string;
  actionItems: string;
  owner: string;
  unassigned: string;
};

const LABELS: Record<"en" | "ms", Labels> = {
  en: {
    attendees: "Attendees",
    agenda: "Agenda & Discussion",
    decisions: "Decisions",
    actionItems: "Action Items",
    owner: "Owner",
    unassigned: "Unassigned",
  },
  ms: {
    attendees: "Kehadiran",
    agenda: "Agenda & Perbincangan",
    decisions: "Keputusan",
    actionItems: "Tindakan Susulan",
    owner: "Pemilik",
    unassigned: "Belum Ditugaskan",
  },
};

/** Build a Word (.docx) document from structured minutes; returns a Buffer. */
export async function buildMinutesDocx(
  minutes: MeetingMinutes,
  lang: "en" | "ms",
): Promise<Buffer> {
  const L = LABELS[lang];
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({ text: minutes.title, heading: HeadingLevel.TITLE }),
  );

  if (minutes.summary) {
    children.push(new Paragraph({ children: [new TextRun(minutes.summary)] }));
  }

  if (minutes.attendees.length > 0) {
    children.push(
      new Paragraph({ text: L.attendees, heading: HeadingLevel.HEADING_1 }),
    );
    for (const a of minutes.attendees) {
      children.push(new Paragraph({ text: a, bullet: { level: 0 } }));
    }
  }

  if (minutes.agenda.length > 0) {
    children.push(
      new Paragraph({ text: L.agenda, heading: HeadingLevel.HEADING_1 }),
    );
    for (const item of minutes.agenda) {
      children.push(
        new Paragraph({ text: item.topic, heading: HeadingLevel.HEADING_2 }),
      );
      if (item.discussion) {
        children.push(
          new Paragraph({ children: [new TextRun(item.discussion)] }),
        );
      }
      for (const d of item.decisions) {
        children.push(new Paragraph({ text: d, bullet: { level: 0 } }));
      }
    }
  }

  if (minutes.decisions.length > 0) {
    children.push(
      new Paragraph({ text: L.decisions, heading: HeadingLevel.HEADING_1 }),
    );
    for (const d of minutes.decisions) {
      children.push(new Paragraph({ text: d, bullet: { level: 0 } }));
    }
  }

  if (minutes.actionItems.length > 0) {
    children.push(
      new Paragraph({ text: L.actionItems, heading: HeadingLevel.HEADING_1 }),
    );
    for (const a of minutes.actionItems) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [
            new TextRun(a.text),
            new TextRun({
              text: `  (${L.owner}: ${a.owner ?? L.unassigned})`,
              italics: true,
            }),
          ],
        }),
      );
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
