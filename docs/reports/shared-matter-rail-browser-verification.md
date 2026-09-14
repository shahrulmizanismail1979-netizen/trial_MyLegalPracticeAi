# Shared matter rail browser verification

Date: 14 September 2026

## Result

**Failed acceptance.** An authenticated browser pass covered all eight matter-enabled specialist portals at desktop (approximately 1440 × 1000) and narrow mobile (390 × 844) viewports.

The rail consistently moved to the upper right on desktop and above core matter content on narrow screens. Task creation and completion worked in every reachable Case Home. The full requirement did not pass because:

- the Sources section was empty in every observed Case Home, including matters whose host UI contained source/work records;
- saved-output cards in the shared rail were not actionable;
- several narrow portal shells clipped rail content or allowed fixed status/assistant widgets to overlap it;
- only dark host themes were available in the authenticated portal paths, so a real light host theme could not be exercised.

## Portal matrix

| Portal | Desktop position and theme | Narrow position | Progress action | Outputs | Sources | Outcome |
|---|---|---|---|---|---|---|
| MyLitAI | Upper right; dark navy/gold legible | Above content, but horizontally clipped and crowded by lower fixed status | Created a unique task and changed Open to Done | Three real outputs visible; clicking Statement of Claim did nothing | Empty despite Client Documents showing three records | Fail |
| MyLitAI IRAC | Upper right; dark navy/gold legible | Above content, but New Task/stage/output content clipped and lower fixed widgets overlapped | Created a unique task and toggled it to Done | One real filed Writ/Statement of Claim visible; rail card did nothing. The separate Documents tab preview opened correctly | Empty; the source uploaded and processed in the active workspace was not carried into the filed matter | Fail |
| MySyariahAI | Upper right; dark theme legible | Above content, with left-edge clipping and lower widget overlap | Created a unique task and toggled it to Done | Empty | Empty | Fail |
| MyCorpLegalAI | Upper right; dark theme legible | Above content; controls visible, but lower fixed status overlapped | Created a unique task and toggled it to Done | Empty | Empty | Fail |
| MyCCBLitAI | Upper right; dark theme legible | Above content, with lower fixed status crowding | Created a unique task and toggled it to Done | Empty | Empty | Fail |
| MyCrimAI | Upper right; dark theme legible | Above content, with long content and lower widgets clipped/crowded | Created a unique task and toggled it to Done | One real AI Legal Research output visible but rendered as a generic, non-link card | Empty | Fail |
| MyAccidentAI | Upper right; dark theme legible | Above content; rail controls remained visible, but lower widgets crowded content | Created a unique task and toggled it to Done | Empty | Empty | Fail |
| MyConveyLitAI | Upper right; dark theme legible | Above content, with rate-limit/status/assistant overlays crowding lower content | Created a unique task and toggled it to Done | Empty | Empty | Fail |

## IRAC setup and verification

IRAC initially had no selected pathway, so the browser pass established the missing real-data path:

1. Started General Civil Litigation from the authenticated Chambers page.
2. Uploaded and processed a real text source in the active matter workspace.
3. Ran Identify Issues and generated a real Writ of Summons plus Statement of Claim.
4. Used File into Matter to create and open a persisted IRAC matter.
5. Created and completed a task in the shared Progress rail.
6. Confirmed the filed output appeared in Outputs.
7. Confirmed clicking the rail output was a no-op.
8. Opened the same filed output successfully from the host Documents tab.
9. Confirmed Sources remained empty and the uploaded initiating source was not transferred.
10. Repeated the layout check at 390 × 844.

## Browser evidence

Screenshot IDs below refer to the authenticated browser-run evidence retained by the testing system.

- MyLitAI desktop rail: `epydu3`
- MyLitAI completed task: `ekmgup`
- MyLitAI narrow clipping: `0r1z93`
- MyLitAI IRAC processed source: `cjuocf`
- MyLitAI IRAC filed draft controls: `n2kxsd`
- MyLitAI IRAC completed task and empty Sources: `026snv`
- MyLitAI IRAC working host document preview: `9qw25q`
- MyLitAI IRAC narrow clipping/overlap: `8ivnhx`
- MySyariahAI desktop: `2z55j1`
- MySyariahAI narrow: `fy0da1`
- MyCorpLegalAI desktop: `03l3s2`
- MyCorpLegalAI narrow: `h9lrez`
- MyCCBLitAI narrow: `hoaq6j`
- MyCrimAI desktop: `pj6z89`
- MyCrimAI narrow: `un81yk`
- MyAccidentAI desktop: `usxbtp`
- MyAccidentAI narrow: `m0o7nw`
- MyConveyLitAI desktop: `02pf38`
- MyConveyLitAI narrow: `hgpomh`

## Other observations

- A recurring resource-load 404 appeared during several matter flows.
- Some dialogs logged missing Description/`aria-describedby` accessibility warnings.
- A few task updates briefly produced stale screenshots while the accessibility tree already reflected Done; settled mobile captures confirmed the completed state.
- The configured completion E2E command later failed before exercising application behavior because Chromium could not create threads (`pthread_create: Resource temporarily unavailable`). API tests, payment-access tests, and pre-publish validation passed.

## Follow-up work

The failed acceptance areas are tracked separately:

- make saved outputs and source documents open from every matter rail;
- prevent matter rails and task actions from being clipped on phones;
- keep a populated MyLitAI IRAC matter available for repeatable browser checks.