import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useT, useLanguage } from "@/lib/i18n";
import {
  POSITION_LEVELS,
  VERBS_BY_LEVEL,
  STANDARDS_BY_LEVEL,
  NATURE_OF_WORK,
  BUSINESS_UNITS,
  DELIVERABLES,
  assembleTitle,
  assembleDescription,
  type PositionLevel,
  type RubricSelection,
} from "@/lib/taskRubric";

export interface TaskRubricFieldsProps {
  selection: RubricSelection;
  onChange: (next: RubricSelection) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  memberNames?: string[];
}

const NONE = "__none__";

export function TaskRubricFields({
  selection,
  onChange,
  notes,
  onNotesChange,
  memberNames = [],
}: TaskRubricFieldsProps) {
  const t = useT();
  const { lang } = useLanguage();

  const level = (selection.positionLevel as PositionLevel | null) ?? null;
  const verbs = level ? VERBS_BY_LEVEL[level] : [];
  const standards = level ? STANDARDS_BY_LEVEL[level] : [];

  const previewTitle = useMemo(
    () => assembleTitle(t, lang, selection),
    [t, lang, selection],
  );
  const previewDescription = useMemo(
    () => assembleDescription(t, selection, memberNames, notes),
    [t, selection, memberNames, notes],
  );

  const set = (patch: Partial<RubricSelection>) =>
    onChange({ ...selection, ...patch });

  const handleLevel = (value: string) => {
    // Changing the level invalidates verb/standard, which are level-scoped.
    set({
      positionLevel: value === NONE ? null : value,
      actionVerb: null,
      qualityStandard: null,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("rubric.field.level")}</label>
          <Select value={selection.positionLevel ?? NONE} onValueChange={handleLevel}>
            <SelectTrigger>
              <SelectValue placeholder={t("rubric.select.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {POSITION_LEVELS.map((l) => (
                <SelectItem key={l} value={l}>{t(`rubric.level.${l}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("rubric.field.verb")}</label>
          <Select
            value={selection.actionVerb ?? NONE}
            onValueChange={(v) => set({ actionVerb: v === NONE ? null : v })}
            disabled={!level}
          >
            <SelectTrigger>
              <SelectValue placeholder={level ? t("rubric.select.placeholder") : t("rubric.level.first")} />
            </SelectTrigger>
            <SelectContent>
              {verbs.map((v) => (
                <SelectItem key={v} value={v}>{t(`rubric.verb.${v}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("rubric.field.nature")}</label>
          <Select
            value={selection.natureOfWork ?? NONE}
            onValueChange={(v) => set({ natureOfWork: v === NONE ? null : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("rubric.select.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {NATURE_OF_WORK.map((n) => (
                <SelectItem key={n} value={n}>{t(`rubric.nature.${n}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("rubric.field.deliverable")}</label>
          <Select
            value={selection.deliverable ?? NONE}
            onValueChange={(v) => set({ deliverable: v === NONE ? null : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("rubric.select.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {DELIVERABLES.map((d) => (
                <SelectItem key={d} value={d}>{t(`rubric.deliverable.${d}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("rubric.field.unit")}</label>
          <Select
            value={selection.businessUnit ?? NONE}
            onValueChange={(v) => set({ businessUnit: v === NONE ? null : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("rubric.select.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_UNITS.map((u) => (
                <SelectItem key={u} value={u}>{t(`rubric.unit.${u}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("rubric.field.standard")}</label>
          <Select
            value={selection.qualityStandard ?? NONE}
            onValueChange={(v) => set({ qualityStandard: v === NONE ? null : v })}
            disabled={!level}
          >
            <SelectTrigger>
              <SelectValue placeholder={level ? t("rubric.select.placeholder") : t("rubric.level.first")} />
            </SelectTrigger>
            <SelectContent>
              {standards.map((s) => (
                <SelectItem key={s} value={s}>{t(`rubric.standard.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t("rubric.field.notes")}</label>
        <Textarea
          placeholder={t("rubric.field.notes.placeholder")}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          className="resize-none h-20"
        />
      </div>

      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1.5">
        <div className="text-xs font-bold uppercase tracking-wide text-primary">
          {t("rubric.preview.title")}
        </div>
        {previewTitle ? (
          <>
            <p className="text-sm font-semibold text-foreground">{previewTitle}</p>
            {previewDescription && (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {previewDescription}
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{t("rubric.preview.empty")}</p>
        )}
      </div>
    </div>
  );
}
