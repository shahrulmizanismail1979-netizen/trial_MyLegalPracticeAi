import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Header,
  Footer,
  AlignmentType,
  PageNumber,
  UnderlineType,
  BorderStyle,
  TabStopType,
  TabStopPosition,
  LineRuleType,
  LevelFormat,
  convertInchesToTwip,
} from "docx";
import { exportPlainText, normalizeExportLines, type ExportLine } from "./exportFormatting";

export interface ExportDocxInput {
  title: string;
  content: string;
  docType?: "land-office" | "firm" | "court" | "agreement";
  refNo?: string;
  parties?: string;
  state?: string;
  district?: string;
  dateStr?: string;
}

const FONT = "Times New Roman";

function makeBodyParagraph(line: ExportLine): Paragraph {
  if (line.kind === "heading" && line.level === 1) {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 160, line: 360, lineRule: LineRuleType.AUTO },
      children: [
        new TextRun({
          text: line.runs.map((run) => run.text).join("").toUpperCase(),
          font: FONT,
          size: 28,
          bold: true,
          underline: { type: UnderlineType.SINGLE },
        }),
      ],
    });
  }
  if (line.kind === "heading" && line.level === 2) {
    return new Paragraph({
      spacing: { before: 200, after: 120, line: 360, lineRule: LineRuleType.AUTO },
      children: [
        new TextRun({ text: line.runs.map((run) => run.text).join("").toUpperCase(), font: FONT, size: 26, bold: true }),
      ],
    });
  }
  if (line.kind === "heading") {
    return new Paragraph({
      spacing: { before: 160, after: 100, line: 360, lineRule: LineRuleType.AUTO },
      children: [new TextRun({ text: line.runs.map((run) => run.text).join(""), font: FONT, size: 24, bold: true })],
    });
  }

  // Numbered list line: "1. text" or "(a) text"
  if (line.kind === "numbered") {
    return new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.5) },
      spacing: { before: 80, after: 80, line: 360, lineRule: LineRuleType.AUTO },
      children: [
        new TextRun({ text: `${line.marker}\t`, font: FONT, size: 24, bold: true }),
        ...line.runs.map((run) => new TextRun({ text: run.text, font: run.code ? "Courier New" : FONT, size: 24, bold: run.bold, italics: run.italics })),
      ],
    });
  }
  if (line.kind === "bullet") {
    return new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) },
      spacing: { before: 60, after: 60, line: 360, lineRule: LineRuleType.AUTO },
      children: [
        new TextRun({ text: "•\t", font: FONT, size: 24 }),
        ...line.runs.map((run) => new TextRun({ text: run.text, font: run.code ? "Courier New" : FONT, size: 24, bold: run.bold, italics: run.italics })),
      ],
    });
  }
  // Centred markers like _________ become signature lines
  const plainText = line.runs.map((run) => run.text).join("");
  if (/^_{3,}\s*$/.test(plainText)) {
    return new Paragraph({
      spacing: { before: 240, after: 0, line: 360, lineRule: LineRuleType.AUTO },
      children: [new TextRun({ text: "_______________________________", font: FONT, size: 24 })],
    });
  }

  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 100, after: 100, line: 360, lineRule: LineRuleType.AUTO },
    children: line.runs.map((run) => new TextRun({
      text: run.text,
      font: run.code ? "Courier New" : FONT,
      size: 24,
      bold: run.bold,
      italics: run.italics,
    })),
  });
}

function buildHeader(opts: ExportDocxInput): Header {
  const docType = opts.docType ?? "land-office";
  const lines: Paragraph[] = [];

  // Top: MALAYSIA
  lines.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({ text: "MALAYSIA", font: FONT, size: 22, bold: true }),
      ],
    }),
  );

  if (docType === "land-office") {
    lines.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: "PEJABAT TANAH DAN GALIAN",
            font: FONT,
            size: 22,
            bold: true,
          }),
        ],
      }),
    );
    if (opts.state || opts.district) {
      lines.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: [opts.state ? `NEGERI ${opts.state.toUpperCase()}` : "", opts.district ? `DAERAH ${opts.district.toUpperCase()}` : ""]
                .filter(Boolean)
                .join("  •  "),
              font: FONT,
              size: 20,
              bold: true,
            }),
          ],
        }),
      );
    } else {
      lines.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [
            new TextRun({ text: "(Pejabat Tanah)", font: FONT, size: 20, italics: true }),
          ],
        }),
      );
    }
  } else if (docType === "firm") {
    lines.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: "PROFESSIONAL LEGAL DOCUMENT",
            font: FONT,
            size: 20,
            bold: true,
          }),
        ],
      }),
    );
  } else if (docType === "court") {
    lines.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({ text: "DALAM MAHKAMAH", font: FONT, size: 22, bold: true }),
        ],
      }),
    );
  } else if (docType === "agreement") {
    lines.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: "AGREEMENT / PERJANJIAN",
            font: FONT,
            size: 20,
            bold: true,
          }),
        ],
      }),
    );
  }

  // Horizontal rule
  lines.push(
    new Paragraph({
      spacing: { before: 0, after: 40 },
      border: {
        bottom: { color: "000000", space: 1, style: BorderStyle.SINGLE, size: 8 },
      },
      children: [new TextRun({ text: "", font: FONT, size: 4 })],
    }),
  );

  return new Header({ children: lines });
}

function buildFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "Page ", font: FONT, size: 18 }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18 }),
          new TextRun({ text: " of ", font: FONT, size: 18 }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 18 }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "MYConveyAI — Generated for educational & practitioner reference. Verify before use.",
            font: FONT,
            size: 14,
            italics: true,
            color: "666666",
          }),
        ],
      }),
    ],
  });
}

function buildRefBlock(opts: ExportDocxInput): Paragraph[] {
  const date = opts.dateStr ?? new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const ref = opts.refNo ?? `MYC/${new Date().getFullYear()}/${Math.floor(Math.random() * 90000 + 10000)}`;
  return [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 240, after: 0 },
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      children: [
        new TextRun({ text: `Ruj. Kami / Our Ref:  ${ref}`, font: FONT, size: 22, bold: true }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after: 240 },
      children: [
        new TextRun({ text: `Tarikh / Date:  ${date}`, font: FONT, size: 22 }),
      ],
    }),
  ];
}

function buildTitleBlock(title: string): Paragraph[] {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 80, line: 360, lineRule: LineRuleType.AUTO },
      children: [
        new TextRun({
          text: title.toUpperCase(),
          font: FONT,
          size: 32,
          bold: true,
          underline: { type: UnderlineType.SINGLE },
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: "(Disediakan oleh / Prepared by: MYConveyAI)",
          font: FONT,
          size: 18,
          italics: true,
        }),
      ],
    }),
  ];
}

function buildPartiesBlock(parties?: string): Paragraph[] {
  if (!parties) return [];
  return [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 120, after: 240 },
      children: [
        new TextRun({ text: "PIHAK-PIHAK / PARTIES:  ", font: FONT, size: 22, bold: true }),
        new TextRun({ text: parties, font: FONT, size: 22 }),
      ],
    }),
  ];
}

function buildSignatureBlock(): Paragraph[] {
  const sigCell = (label: string, witness = false) => [
    new Paragraph({
      spacing: { before: witness ? 480 : 720, after: 0 },
      children: [
        new TextRun({ text: "_______________________________", font: FONT, size: 24 }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({ text: label, font: FONT, size: 22, bold: true }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({ text: "Nama / Name: ………………………………………", font: FONT, size: 22 }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({ text: "No. K/P / NRIC: ……………………………………", font: FONT, size: 22 }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({ text: "Jawatan / Designation: ……………………………", font: FONT, size: 22 }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 120 },
      children: [
        new TextRun({ text: "Tarikh / Date: ……………………………………", font: FONT, size: 22 }),
      ],
    }),
  ];

  return [
    new Paragraph({
      spacing: { before: 480, after: 120 },
      children: [
        new TextRun({
          text: "DI HADAPAN SAYA / IN MY PRESENCE:",
          font: FONT,
          size: 22,
          bold: true,
        }),
      ],
    }),
    ...sigCell("Tandatangan / Signature"),
    ...sigCell("Saksi / Witness", true),
  ];
}

export async function buildLandOfficeDocx(input: ExportDocxInput): Promise<Buffer> {
  const opts: ExportDocxInput = {
    ...input,
    title: exportPlainText(input.title),
    refNo: input.refNo == null ? undefined : exportPlainText(input.refNo),
    parties: input.parties == null ? undefined : exportPlainText(input.parties),
    state: input.state == null ? undefined : exportPlainText(input.state),
    district: input.district == null ? undefined : exportPlainText(input.district),
    dateStr: input.dateStr == null ? undefined : exportPlainText(input.dateStr),
  };

  const bodyLines = normalizeExportLines(opts.content ?? "");

  const bodyParagraphs: Paragraph[] = [];
  for (const line of bodyLines) {
    if (line.kind === "blank") {
      bodyParagraphs.push(
        new Paragraph({
          spacing: { before: 80, after: 80, line: 360, lineRule: LineRuleType.AUTO },
          children: [new TextRun({ text: "", font: FONT, size: 24 })],
        }),
      );
      continue;
    }
    bodyParagraphs.push(makeBodyParagraph(line));
  }

  const doc = new Document({
    creator: "MYConveyAI",
    title: opts.title,
    description: "Generated by MYConveyAI — Malaysian Conveyancing Legal Practice",
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 24 },
          paragraph: { spacing: { line: 360, lineRule: LineRuleType.AUTO } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "lo-numbered",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: {
              top: convertInchesToTwip(1.2),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              header: convertInchesToTwip(0.5),
              footer: convertInchesToTwip(0.4),
            },
          },
        },
        headers: { default: buildHeader(opts) },
        footers: { default: buildFooter() },
        children: [
          ...buildRefBlock(opts),
          ...buildTitleBlock(opts.title),
          ...buildPartiesBlock(opts.parties),
          ...bodyParagraphs,
          ...buildSignatureBlock(),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
