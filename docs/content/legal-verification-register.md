# Legal source verification register

**Research check date:** 23 September 2026  
**Scope:** Official-source verification supporting `artifacts/landing-page/src/data/legal-reference-guide.ts`.

This register records only what was observed through web search followed by an attempted or successful fetch. It is not legal advice, a current-law certificate, a corpus-wide audit, or human legal review. The reusable checklists and drafting structures are original issue-spotting aids; they are not court forms or filing precedents.

## Verification method

1. Search was restricted or directed to official Malaysian authority domains.
2. Candidate pages were fetched as page text where the authority site permitted automated retrieval.
3. Claims in the data module were limited to page identity, navigation, or high-level content actually visible.
4. No case names, holdings, filing deadlines, limitation periods or guaranteed legal outcomes were added.
5. Search-only or failed-fetch sources are explicitly labelled and must not support a substantive legal proposition without fresh direct verification.

## Verified official pages and bounded claims

| Domain | Authority and exact page | Fetch result on check date | Bounded claim verified | Limits |
|---|---|---:|---|---|
| Civil / IRAC | Office of the Chief Registrar, Federal Court of Malaysia — [Procedures In Civil Cases](https://www.kehakiman.gov.my/en/procedures-civil-cases) | Successful | Page is organised around starting a case, trial and post-trial; it tells prospective claimants to consider cause of action, limitation, evidence and costs, and gives a high-level distinction between writ and originating summons. | Public guidance only. Figures, routes, rules, forms, deadlines and local registry practice must be rechecked. |
| Federal legislation | Attorney General's Chambers — [Federal Legislation Portal search](https://lom.agc.gov.my/search-legislation.php) and [portal home](https://lom.agc.gov.my/) | Successful | Search page identifies principal Acts, amendment Acts and P.U. (A)/(B) categories, with title/content search. Home page displayed dated legislative updates. | Search/listing presence does not prove consolidation, commencement or application. Verify the instrument and gazette history. |
| Criminal | Malaysian Judiciary, Sabah State Court — [Procedures In Criminal Cases](https://sabah.kehakiman.gov.my/en/procedures-criminal-cases) | Successful | Page contains general remand, trial and post-trial sections, identifies participants and describes trial-court hierarchy. | Introductory material only; no procedural entitlement or deadline is adopted into the guide. Current primary law and local directions control. |
| Court forms | Malaysian Judiciary, Johor State Court — [Forms (Court)](https://johor.kehakiman.gov.my/en/forms-court) | Successful | Page lists downloadable court-management forms and an infographic concerning self-representation in criminal proceedings. | A listed download is not verified as suitable or current for a particular case or registry. |
| Corporate | Companies Commission of Malaysia — [Guidelines for the Reporting Framework for Beneficial Ownership of Companies](https://www.ssm.com.my/bm/Pages/Legal_Framework/document/Guideline%20BO%20%28Revised%29%202025%20fair.pdf) | Successful | Fetched guideline says it assists companies with beneficial-ownership reporting, including identification criteria, senior-management information where a beneficial owner cannot be identified, and related obligations. | No beneficial-owner conclusion or filing timing is drawn. Confirm current revision, coverage, commencement, transition and SSM process. |
| Banking / financial services | Bank Negara Malaysia — [Legislation](https://www.bnm.gov.my/legislation) | Successful | Page provides regulator-hosted legislation and instrument-specific amendment/commencement notes. The page itself notes that a displayed Financial Services Act copy had not incorporated a later amendment order. | Regulator-hosted copy may not be fully updated. Cross-check AGC/gazette and current policy documents. |
| Conveyancing | Department of Director General of Lands and Mines — [Land Management FAQ](https://www.jkptg.gov.my/en/soalan-lazim-3/42-faq/pengurusan-tanah) | Successful, but extraction was navigation-heavy | Official FAQ concerns land administration; search result text described an example involving attestation, valuation/stamp-duty and presentation stages for a gift transfer. | Example/FAQ is not a conveyancing checklist. It is not used for Sabah or Sarawak. State authority, title, consent, duty/tax and form requirements require direct verification. |
| Accident / police service | Royal Malaysia Police — [e-Reporting](https://ereporting.rmp.gov.my/index.aspx?lang=english) and [guide](https://ereporting.rmp.gov.my/panduan.aspx?lang=english) | Search found official pages; automated fetch failed | Search metadata identifies the PDRM service and indicates it is limited to specified report categories, with emergency direction to police channels. | Not treated as an accident-reporting route. Users must confirm the correct reporting method directly with PDRM. |
| Syariah — general | Department of Syariah Judiciary Malaysia — [Pengkelasan Kes Mal](https://www.jksm.gov.my/pengkelasan-kes-mal) and [Prosedur Mahkamah](https://www.jksm.gov.my/prosedur-mahkamah) | Search found official pages; automated fetch failed | Search metadata describes Mal registration categories and general court procedure content, and identifies JKSM's coordinating role. | Insufficient for classification, filing or a legal proposition. Live page plus the competent state/territory sources must be checked. |
| Syariah — Selangor example | Selangor Syariah Judiciary Department — [court forms](https://www.jakess.gov.my/rujukan/muat-turun-borang) and [enactments/rules](https://www.jakess.gov.my/rujukan/akta-enakmen-odinen) | Search found official pages; fetch returned not found | Search results identified a forms area and categories of Selangor enactments/rules. | Paths were not fetch-verifiable and may have moved. No cached form or enactment is endorsed. Navigate from the official home page and verify current gazette text. Applies to Selangor only. |
| Sarawak | Sarawak LawNet — [Laws of Sarawak full listing](https://lawnet.sarawak.gov.my/lawnet/Law/TLnetPublishedOrdList.jsp?LTyp=All) | Successful | Page identifies Laws of Sarawak; provides full, alphabetic, year and search navigation; and lists ordinances with PDF links and expandable subsidiary materials. | Listing/PDF presence does not prove latest operative consolidation, commencement or application. Federal interaction needs separate analysis. |

## Substantive verification limits

- **No corpus certification:** Existing portal templates, seeds, examples, help text, generated documents, case references and statutory statements were not exhaustively reviewed.
- **No human-review status:** Nothing in this work is marked lawyer-reviewed, editorially approved or court-approved.
- **No case-law verification:** No case citation or holding was introduced. Existing case-law content remains outside this verification exercise.
- **No deadline reliance:** The module deliberately supplies no filing, appeal, limitation, reporting, corporate or land deadline. A practitioner must calculate each from current primary sources and facts.
- **No universal forms:** Judiciary and Syariah form pages are discovery points only. Form, court, state, language, version and registry acceptance require live confirmation.
- **Jurisdiction matters:** JKPTG material was not treated as Sarawak land law. Syariah materials were not generalised across states. Sarawak LawNet was kept distinct from the federal AGC portal.
- **Currency is not guaranteed:** Official pages can move, instruments can be amended, and hosted consolidations can lag. `checkedDate` means only that the listed page was examined on that date.
- **Search-only material is weak evidence:** PDRM, JKSM and the searched JAKESS paths could not be fetched successfully. Their entries are warnings and routing aids, not substantive authorities.
- **No production data changes:** No database, production seed or existing portal content was overwritten. The source-aware module is standalone for a front-end owner to integrate.

## Safe integration requirements

Any UI consuming the data module should display the source authority, jurisdiction, `checkedDate`, direct `sourceUrl`, `verificationLimit` and domain caution alongside the checklist/template. It should not collapse “checked” into “current”, “approved”, “official template” or “human-reviewed”. External links should be visibly labelled and opened as official-source checks, not as proof that generated work is filing-ready.