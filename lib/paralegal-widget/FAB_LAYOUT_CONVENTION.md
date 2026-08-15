# Amani FAB — shared layout convention

## FAB geometry

| Property | Value |
|----------|-------|
| `bottom` | 20 px |
| `right`  | 20 px |
| `width`  | 60 px |
| `height` | 60 px |
| `z-index`| 2 147 483 000 |

The FAB's **top edge** is therefore **80 px from the viewport bottom**.

## Clearance rule

Any fixed-position element that could appear in the bottom-right corner
**must** start at or above the clearance line:

```
--vp-fab-clearance: 96px   (= 80 px FAB top-edge + 16 px gap)
```

The widget sets this CSS custom property on `<html>` on mount.

### In Tailwind
Use `bottom-24` (= 96 px) instead of `bottom-4`, `bottom-5`, or `bottom-6`
for any element that sits in the lower-right quadrant alongside the FAB.

```tsx
// ✅ clears the FAB
<div className="fixed bottom-24 right-6 z-50">…</div>

// ❌ stacks on top of the FAB
<div className="fixed bottom-6 right-6 z-50">…</div>
```

### In inline styles
```tsx
// ✅
style={{ position: "fixed", bottom: 96, right: 20 }}

// ❌
style={{ position: "fixed", bottom: 16, right: 20 }}
```

### Centered banners (left: 50%)
Even centered banners must use `bottom-24` / `bottom: 96` because at 375 px
viewport width a `max-w-sm / w-[calc(100%-2rem)]` banner extends to ~359 px
from the left edge — clipping the FAB's left side.

## z-index tiers

| z-index | Usage |
|---------|-------|
| 2 147 483 000 | Amani FAB + chat panel |
| `z-[200]` (200) | Full-screen tutorial / exam overlays |
| `z-[150]` (150) | Tutorial reopen / help button |
| `z-50` (50) | Toasts, rate-limit banners, dropdowns |
| `z-40` (40) | Proctor webcam, portal sidebars |
| `z-30` (30) | Sticky headers, nav scrims |

## Portals using ParalegalWidget

All portals listed below render the Amani FAB and must follow this convention:

- `artifacts/mylitai` — MyLitAI
- `artifacts/mylitai-irac` — MyLitAI IRAC
- `artifacts/mycrimai` — MyCrimAI
- `artifacts/mysyariahai` — MySyariahAI
- `artifacts/myconveylitai` — MyConveyLitAI
- `artifacts/myaccidentai` — MyAccidentAI
- `artifacts/myccblitai` — MyCorpCommBankLitAI
- `artifacts/mycorplegalai` — MyCorpLegalAI
- `artifacts/mylawfirmai` — MyLawFirmAI
- `artifacts/mylawacad` — MyLawAcad

## Checklist for adding a new fixed element to any portal

1. Is it in the lower-right quadrant (within ~100 px of `right: 0` **and** `bottom: 0`)?
   - Yes → use `bottom-24` (96 px) as the minimum bottom offset.
2. Is it centered at the bottom?
   - At ≤ 375 px viewport width it will overlap the FAB → also use `bottom-24`.
3. Assign a z-index from the tier table above — never use an arbitrary value.
