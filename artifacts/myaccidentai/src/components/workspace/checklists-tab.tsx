import { useState, useEffect, useMemo } from "react";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  AlignmentType,
} from "docx";
import { saveAs } from "file-saver";
import {
  CheckSquare, ChevronDown, Info, Download, FileText, Printer,
  Copy, RotateCcw, Plus, Trash2, ExternalLink, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checklistData as rawChecklistData } from "./data";

type Checklist = {
  slug: string;
  title: string;
  category: string;
  items: Array<{ id: string; text: string }>;
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function defaultItemId(text: string): string {
  return `d:${slugify(text).slice(0, 80)}`;
}

function generateCustomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `c:${crypto.randomUUID()}`;
  }
  return `c:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const checklistData: Checklist[] = (rawChecklistData as Array<Record<string, unknown>>).map((c) => {
  const title = (c.title as string | undefined) ?? (c.name as string | undefined) ?? "Untitled Checklist";
  const itemTexts = (c.items as string[] | undefined) ?? [];
  return {
    slug: slugify(title),
    title,
    category: (c.category as string | undefined) ?? "General",
    items: itemTexts.map((text) => ({ id: defaultItemId(text), text })),
  };
});

type ChecklistState = {
  checked: Record<string, boolean>;
  customItems: Array<{ id: string; text: string }>;
  hiddenDefaults: string[];
};

type AllState = Record<string, ChecklistState>;

const STORAGE_KEY = "myaccidentai.checklists.v2";

function emptyState(): ChecklistState {
  return { checked: {}, customItems: [], hiddenDefaults: [] };
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function normalizeChecklistState(raw: unknown): ChecklistState {
  if (!isPlainObject(raw)) return emptyState();

  const checkedRaw = raw.checked;
  const checked: Record<string, boolean> = {};
  if (isPlainObject(checkedRaw)) {
    for (const [k, v] of Object.entries(checkedRaw)) {
      if (typeof k === "string" && typeof v === "boolean") checked[k] = v;
    }
  }

  const customRaw = raw.customItems;
  const customItems: Array<{ id: string; text: string }> = [];
  if (Array.isArray(customRaw)) {
    for (const entry of customRaw) {
      if (
        isPlainObject(entry) &&
        typeof entry.id === "string" &&
        typeof entry.text === "string" &&
        entry.text.trim() !== ""
      ) {
        customItems.push({ id: entry.id, text: entry.text });
      }
    }
  }

  const hiddenRaw = raw.hiddenDefaults;
  const hiddenDefaults: string[] = Array.isArray(hiddenRaw)
    ? hiddenRaw.filter((x): x is string => typeof x === "string")
    : [];

  return { checked, customItems, hiddenDefaults };
}

function loadState(): AllState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return {};
    const out: AllState = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k === "string") out[k] = normalizeChecklistState(v);
    }
    return out;
  } catch {
    return {};
  }
}

function saveState(state: AllState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode */
  }
}

function getChecklistState(state: AllState, slug: string): ChecklistState {
  return state[slug] ?? emptyState();
}

type DisplayItem = { id: string; text: string; isCustom: boolean };

function getVisibleItems(checklist: Checklist, state: ChecklistState): DisplayItem[] {
  const defaults: DisplayItem[] = checklist.items
    .filter((it) => !state.hiddenDefaults.includes(it.id))
    .map((it) => ({ id: it.id, text: it.text, isCustom: false }));
  const customs: DisplayItem[] = state.customItems.map((it) => ({
    id: it.id,
    text: it.text,
    isCustom: true,
  }));
  return [...defaults, ...customs];
}

async function generateDocx(
  checklist: Checklist,
  items: DisplayItem[],
  state: ChecklistState,
): Promise<Blob> {
  const doc = new Document({
    creator: "MyAccidentAi",
    title: checklist.title,
    description: `${checklist.category} checklist`,
    styles: {
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          run: { font: "Calibri", size: 22 },
        },
      ],
    },
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: checklist.title,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: `Category: ${checklist.category}`,
                italics: true,
                color: "666666",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 360 },
            children: [
              new TextRun({
                text: "MyAccidentAi · Malaysian Accident & Personal Injury Practice Platform",
                size: 18,
                color: "888888",
              }),
            ],
          }),
          ...items.map((item) => {
            const isChecked = state.checked[item.id] === true;
            return new Paragraph({
              spacing: { after: 120 },
              children: [
                new TextRun({
                  text: isChecked ? "☒  " : "☐  ",
                  size: 24,
                }),
                new TextRun({
                  text: item.text,
                  strike: isChecked,
                  color: isChecked ? "888888" : "000000",
                }),
              ],
            });
          }),
          new Paragraph({
            spacing: { before: 480 },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `Generated on ${new Date().toLocaleDateString("en-MY", { year: "numeric", month: "long", day: "numeric" })}`,
                size: 18,
                italics: true,
                color: "999999",
              }),
            ],
          }),
        ],
      },
    ],
  });
  return await Packer.toBlob(doc);
}

function buildPlainText(
  checklist: Checklist,
  items: DisplayItem[],
  state: ChecklistState,
): string {
  const lines = [
    checklist.title,
    "=".repeat(checklist.title.length),
    `Category: ${checklist.category}`,
    "",
  ];
  for (const item of items) {
    const isChecked = state.checked[item.id] === true;
    lines.push(`${isChecked ? "[x]" : "[ ]"} ${item.text}`);
  }
  lines.push("");
  lines.push(`— Generated by MyAccidentAi on ${new Date().toLocaleDateString("en-MY")}`);
  return lines.join("\n");
}

export function ChecklistsTab() {
  const [state, setState] = useState<AllState>(() => loadState());
  const [expanded, setExpanded] = useState<number>(0);
  const [newItemText, setNewItemText] = useState<Record<string, string>>({});
  const [busyDocx, setBusyDocx] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [gdocsHintSlug, setGdocsHintSlug] = useState<string | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const updateChecklist = (slug: string, updater: (s: ChecklistState) => ChecklistState) => {
    setState((prev) => {
      const current = getChecklistState(prev, slug);
      return { ...prev, [slug]: updater(current) };
    });
  };

  const toggleItem = (slug: string, item: DisplayItem) => {
    updateChecklist(slug, (s) => ({
      ...s,
      checked: { ...s.checked, [item.id]: !s.checked[item.id] },
    }));
  };

  const addCustomItem = (slug: string) => {
    const text = (newItemText[slug] ?? "").trim();
    if (!text) return;
    updateChecklist(slug, (s) => ({
      ...s,
      customItems: [...s.customItems, { id: generateCustomId(), text }],
    }));
    setNewItemText((prev) => ({ ...prev, [slug]: "" }));
  };

  const deleteItem = (slug: string, item: DisplayItem) => {
    if (item.isCustom) {
      updateChecklist(slug, (s) => {
        const { [item.id]: _drop, ...restChecked } = s.checked;
        return {
          ...s,
          customItems: s.customItems.filter((c) => c.id !== item.id),
          checked: restChecked,
        };
      });
    } else {
      updateChecklist(slug, (s) => {
        const { [item.id]: _drop, ...restChecked } = s.checked;
        return {
          ...s,
          hiddenDefaults: s.hiddenDefaults.includes(item.id)
            ? s.hiddenDefaults
            : [...s.hiddenDefaults, item.id],
          checked: restChecked,
        };
      });
    }
  };

  const resetChecklist = (slug: string) => {
    setState((prev) => {
      const next = { ...prev };
      delete next[slug];
      return next;
    });
  };

  const downloadDocx = async (checklist: Checklist) => {
    const cs = getChecklistState(state, checklist.slug);
    const items = getVisibleItems(checklist, cs);
    setBusyDocx(checklist.slug);
    try {
      const blob = await generateDocx(checklist, items, cs);
      saveAs(blob, `${checklist.slug}.docx`);
    } finally {
      setBusyDocx(null);
    }
  };

  const downloadAndOpenGoogleDocs = async (checklist: Checklist) => {
    await downloadDocx(checklist);
    setGdocsHintSlug(checklist.slug);
    window.open("https://docs.google.com/document/u/0/?action=open", "_blank", "noopener,noreferrer");
    setTimeout(() => setGdocsHintSlug((v) => (v === checklist.slug ? null : v)), 8000);
  };

  const printChecklist = (checklist: Checklist) => {
    const cs = getChecklistState(state, checklist.slug);
    const items = getVisibleItems(checklist, cs);
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) return;
    const escape = (c: string) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] ?? c);
    const itemsHtml = items
      .map((it) => {
        const isChecked = cs.checked[it.id] === true;
        return `<li class="${isChecked ? "done" : ""}"><span class="box">${isChecked ? "&#9746;" : "&#9744;"}</span><span class="txt">${it.text.replace(/[<>&]/g, escape)}</span></li>`;
      })
      .join("");
    w.document.write(`<!doctype html><html><head><title>${checklist.title.replace(/[<>&]/g, escape)}</title>
      <style>
        body { font-family: Calibri, Arial, sans-serif; max-width: 720px; margin: 32px auto; padding: 0 24px; color: #111; }
        h1 { font-family: Georgia, serif; text-align: center; font-size: 22px; margin-bottom: 4px; }
        .cat { text-align: center; color: #666; font-style: italic; margin-bottom: 24px; font-size: 13px; }
        ul { list-style: none; padding: 0; margin: 0; }
        li { display: flex; gap: 10px; padding: 6px 0; border-bottom: 1px dashed #eee; font-size: 14px; line-height: 1.5; }
        .box { font-size: 18px; line-height: 1; flex-shrink: 0; }
        .done .txt { text-decoration: line-through; color: #888; }
        .footer { margin-top: 32px; text-align: center; color: #999; font-size: 11px; font-style: italic; }
        @media print { body { margin: 0; } }
      </style></head><body>
      <h1>${checklist.title.replace(/[<>&]/g, escape)}</h1>
      <div class="cat">Category: ${checklist.category.replace(/[<>&]/g, escape)}</div>
      <ul>${itemsHtml}</ul>
      <div class="footer">MyAccidentAi · Generated ${new Date().toLocaleDateString("en-MY")}</div>
      <script>window.onload = () => { setTimeout(() => window.print(), 200); };</script>
    </body></html>`);
    w.document.close();
  };

  const copyToClipboard = async (checklist: Checklist) => {
    const cs = getChecklistState(state, checklist.slug);
    const items = getVisibleItems(checklist, cs);
    const text = buildPlainText(checklist, items, cs);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSlug(checklist.slug);
      setTimeout(() => setCopiedSlug((v) => (v === checklist.slug ? null : v)), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const totals = useMemo(() => {
    return checklistData.map((cl) => {
      const cs = getChecklistState(state, cl.slug);
      const items = getVisibleItems(cl, cs);
      const done = items.reduce((acc, it) => acc + (cs.checked[it.id] ? 1 : 0), 0);
      return { total: items.length, done };
    });
  }, [state]);

  return (
    <div className="space-y-4">
      <div className="bg-muted/30 rounded-xl p-4 border border-border mb-6">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Tick items as you complete them, add your own, and export to Word or print. Your progress is saved on this device.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {[
          ["Use with the file", "Add matter-specific owners, source documents and status notes. A checked box should correspond to evidence in the file."],
          ["Track gaps explicitly", "Add missing reports, receipts, witness details, insurer material and unanswered requests as custom items rather than assuming completion."],
          ["Close-out review", "Before export, review unchecked items, verify figures and dates, and confirm current procedural requirements with the responsible practitioner."],
        ].map(([title, text]) => (
          <div key={title} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-semibold text-primary mb-1">{title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
          </div>
        ))}
      </div>

      {checklistData.map((checklist, i) => {
        const cs = getChecklistState(state, checklist.slug);
        const items = getVisibleItems(checklist, cs);
        const { total, done } = totals[i];
        const pct = total === 0 ? 0 : Math.round((done / total) * 100);
        const isOpen = expanded === i;
        const newText = newItemText[checklist.slug] ?? "";

        return (
          <div key={checklist.slug} className="bg-card border border-border rounded-xl overflow-hidden" data-testid={`checklist-${i}`}>
            <button
              className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors"
              onClick={() => setExpanded(isOpen ? -1 : i)}
              data-testid={`checklist-toggle-${i}`}
            >
              <div className="flex items-center gap-3 text-left flex-1 min-w-0">
                <CheckSquare className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-serif font-semibold truncate">{checklist.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {done} / {total} done · {checklist.category}
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 mr-3">
                  <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-9 text-right">{pct}%</span>
                </div>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
              <div className="border-t border-border">
                <div className="px-5 py-3 bg-muted/20 border-b border-border flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => downloadDocx(checklist)}
                    disabled={busyDocx === checklist.slug}
                    data-testid={`btn-download-word-${i}`}
                  >
                    <Download className="h-3 w-3" />
                    {busyDocx === checklist.slug ? "Building…" : "Download Word"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => downloadAndOpenGoogleDocs(checklist)}
                    disabled={busyDocx === checklist.slug}
                    data-testid={`btn-google-docs-${i}`}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Send to Google Docs
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => printChecklist(checklist)}
                    data-testid={`btn-print-${i}`}
                  >
                    <Printer className="h-3 w-3" /> Print / PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => copyToClipboard(checklist)}
                    data-testid={`btn-copy-${i}`}
                  >
                    {copiedSlug === checklist.slug ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    {copiedSlug === checklist.slug ? "Copied" : "Copy"}
                  </Button>
                  <div className="flex-1" />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => resetChecklist(checklist.slug)}
                    data-testid={`btn-reset-${i}`}
                  >
                    <RotateCcw className="h-3 w-3" /> Reset
                  </Button>
                </div>

                {gdocsHintSlug === checklist.slug && (
                  <div className="px-5 py-2.5 bg-primary/5 border-b border-primary/20 text-xs text-primary flex items-start gap-2" data-testid={`gdocs-hint-${i}`}>
                    <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>
                      Word file downloaded. In the Google Docs tab that just opened, choose <strong>Upload</strong> and select <code className="bg-primary/10 px-1 rounded">{checklist.slug}.docx</code> to convert it to a Google Doc.
                    </span>
                  </div>
                )}

                <div className="px-5 py-4 space-y-1">
                  {items.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      All items removed. Add your own below or reset to restore the original checklist.
                    </p>
                  )}
                  {items.map((item) => {
                    const isChecked = cs.checked[item.id] === true;
                    return (
                      <div
                        key={item.id}
                        className="group flex items-start gap-3 py-2 px-2 rounded-md hover:bg-muted/30 transition-colors"
                        data-testid={`checklist-${i}-item-${item.id}`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleItem(checklist.slug, item)}
                          aria-pressed={isChecked}
                          className={`w-5 h-5 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                            isChecked
                              ? "bg-primary border-primary text-primary-foreground"
                              : "bg-background border-border hover:border-primary"
                          }`}
                          data-testid={`checkbox-${i}-${items.indexOf(item)}`}
                          aria-label={isChecked ? `Uncheck: ${item.text}` : `Check: ${item.text}`}
                        >
                          {isChecked && <Check className="h-3 w-3" />}
                        </button>
                        <p className={`text-sm flex-1 leading-relaxed ${isChecked ? "text-muted-foreground line-through" : "text-foreground/80"}`}>
                          {item.text}
                          {item.isCustom && (
                            <span className="ml-2 text-[10px] uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded">Custom</span>
                          )}
                        </p>
                        <button
                          type="button"
                          onClick={() => deleteItem(checklist.slug, item)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
                          aria-label={`Remove: ${item.text}`}
                          data-testid={`btn-delete-${i}-${items.indexOf(item)}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="px-5 py-4 border-t border-border bg-muted/10 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    value={newText}
                    onChange={(e) => setNewItemText((prev) => ({ ...prev, [checklist.slug]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomItem(checklist.slug);
                      }
                    }}
                    placeholder="Add a custom checklist item…"
                    className="h-9 text-sm"
                    data-testid={`input-new-item-${i}`}
                  />
                  <Button
                    size="sm"
                    onClick={() => addCustomItem(checklist.slug)}
                    disabled={!newText.trim()}
                    className="h-9 gap-1.5 bg-primary"
                    data-testid={`btn-add-item-${i}`}
                  >
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <p className="text-xs text-muted-foreground text-center mt-6">
        <FileText className="inline h-3 w-3 mr-1" />
        Tip: The downloaded Word file can be uploaded directly to Google Docs (File &gt; Open &gt; Upload).
      </p>
    </div>
  );
}
