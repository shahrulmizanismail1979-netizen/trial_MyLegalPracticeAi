export interface CaseDef {
  id: string;
  title: string;
  citation: string;
  topic: string;
  tags: string[];
  facts: string;
  issue: string;
  held: string;
  significance: string;
  diagram: { parties: string[]; issue: string; result: string };
}

export const CASES: CaseDef[] = [
  // ─── SPECIFIC PERFORMANCE & CONTRACT ─────────────────────────────────────
  {
    id: 'case_001', title: 'Macon Works & Trading Sdn Bhd v Phang Hon Yin', citation: '[1976] 2 MLJ 177',
    topic: 'Specific Performance in SPA', tags: ['Contract', 'Specific Performance', 'SPA'],
    facts: 'The vendor refused to complete the sale of land after signing a Sale and Purchase Agreement and receiving a 10% deposit from the purchaser. The vendor argued that damages would be adequate compensation.',
    issue: 'Is specific performance available as a remedy when a vendor refuses to complete a Sale and Purchase Agreement for land?',
    held: 'Specific performance was granted. The court held that land is unique and damages at common law are ordinarily an inadequate remedy for breach of a contract to sell land. The purchaser is prima facie entitled to an order for specific performance.',
    significance: 'Established the fundamental principle in Malaysian land law that specific performance is the primary remedy for breach of an SPA — not damages. This principle is now entrenched in conveyancing practice.',
    diagram: { parties: ['Vendor (Refuses to complete)', 'Purchaser (Paid 10% deposit)'], issue: 'Can court force the sale?', result: 'YES — Specific Performance granted. Land is unique.' }
  },
  {
    id: 'case_002', title: 'Adorna Properties Sdn Bhd v Boonsom Boonyanit', citation: '[2001] 1 MLJ 241',
    topic: 'Indefeasibility of Title (Forgery) — Overruled', tags: ['Indefeasibility', 'Forgery', 'NLC s.340'],
    facts: 'A forged document was used to transfer Boonsom Boonyanit\'s land to Adorna Properties, which paid market value in good faith and was registered as proprietor. Boonsom discovered the fraud and sued to recover her land.',
    issue: 'Does an immediate purchaser for value in good faith obtain indefeasible title even where the transfer to them was by a forged instrument?',
    held: 'HELD (now OVERRULED by Tan Ying Hong [2010]): The Federal Court controversially held that Adorna Properties obtained indefeasible title under s.340(3) NLC — applying immediate indefeasibility. Boonsom lost her land.',
    significance: 'This decision caused outrage as it seemed to reward fraud. It was overruled 9 years later in Tan Ying Hong, which confirmed deferred indefeasibility for Malaysia. Serves as a cautionary tale on judicial interpretation of the NLC.',
    diagram: { parties: ['Boonsom (Original Owner — Victim)', 'Adorna (Bona Fide Immediate Purchaser)'], issue: 'Does forgery defeat immediate registered title?', result: 'OVERRULED — Adorna\'s title was defeasible. Deferred indefeasibility applies.' }
  },
  {
    id: 'case_003', title: 'Tan Ying Hong v Tan Sian San & Ors', citation: '[2010] 2 MLJ 1',
    topic: 'Deferred Indefeasibility — Definitive Malaysian Position', tags: ['Indefeasibility', 'Forgery', 'NLC s.340'],
    facts: 'Tan Sian San\'s signature was forged on a transfer form and his land was transferred to third parties who then charged it to a bank. Tan Sian San sued to recover his land from all subsequent parties.',
    issue: 'Does Malaysia follow immediate or deferred indefeasibility? Can an immediate purchaser through a forged instrument claim an indefeasible title?',
    held: 'The Federal Court unanimously overruled Adorna Properties. Malaysia follows DEFERRED indefeasibility. An IMMEDIATE purchaser through a forged instrument does NOT obtain indefeasible title under s.340(2) NLC. Only a SUBSEQUENT bona fide purchaser for value from the immediate (defeasible) proprietor gets indefeasibility under s.340(3).',
    significance: 'The most important land law case in Malaysia in the 21st century. Corrected 9 years of bad law from Adorna Properties. Now the definitive statement of indefeasibility in Malaysia.',
    diagram: { parties: ['Tan Sian San (Original Owner)', 'Forged Transfer → Immediate Purchaser (NOT protected)'], issue: 'Does immediate purchaser through forgery get indefeasible title?', result: 'NO — Deferred indefeasibility. Immediate purchaser through forgery is DEFEASIBLE.' }
  },
  {
    id: 'case_004', title: 'Tan Hee Juan v Teh Boon Keat', citation: '[1934] 1 MLJ 96',
    topic: 'Capacity of Minors in Land Contracts', tags: ['Contract', 'Minors', 'Capacity'],
    facts: 'A minor executed transfers of several plots of land in favour of the defendants. Upon reaching the age of majority, the plaintiff sought to have the transfers set aside on the ground that they were executed during minority.',
    issue: 'Are land transfers executed by a minor valid and binding?',
    held: 'All transfers executed during minority were void ab initio under the Contracts Act. A contract made by a minor is void from the very beginning — it cannot be ratified upon the minor reaching majority.',
    significance: 'Established that minority renders a land contract (including a Form 14A transfer) completely void — not merely voidable. Ratification upon majority is NOT possible. Minors lack contractual capacity.',
    diagram: { parties: ['Minor (Transferred land during minority)', 'Defendant (Received the land)'], issue: 'Is a transfer by a minor valid?', result: 'NO — Void ab initio. Cannot be ratified upon reaching majority.' }
  },
  {
    id: 'case_005', title: 'CIMB Bank Bhd v Maybank Trustees Bhd & Ors', citation: '[2014] 3 MLJ 169',
    topic: 'Priority of Competing Registered Charges', tags: ['Charge', 'Financing', 'NLC s.241', 'Priority'],
    facts: 'Two banks held charges over the same property — CIMB was registered first, Maybank second. When the chargor defaulted, a dispute arose over the priority of the two charges and which bank was entitled to be satisfied first from the sale proceeds.',
    issue: 'What determines the priority between two competing registered charges over the same land?',
    held: 'The first charge registered takes priority over subsequent charges. The order of registration determines priority under the Torrens system — not the order of execution of the loan agreements.',
    significance: 'Confirms the Torrens principle that REGISTRATION (not execution) determines priority. First to register = first in priority. Important for practitioners ensuring timely presentation of charge documents.',
    diagram: { parties: ['CIMB (First Chargee — Registered First)', 'Maybank (Second Chargee)'], issue: 'Which charge takes priority on sale?', result: 'CIMB takes priority — first registered = first in priority.' }
  },
  {
    id: 'case_006', title: 'Luggage Distributors (M) Sdn Bhd v Tan Hor Teng', citation: '[1995] 1 MLJ 783',
    topic: 'Caveatable Interest — What Qualifies?', tags: ['Caveat', 'NLC s.323', 'Equitable Interest'],
    facts: 'The plaintiff lodged a private caveat against land claiming an interest based on an oral agreement to purchase the land. The defendant challenged the caveat, arguing there was no valid caveatable interest.',
    issue: 'What constitutes a caveatable interest entitling a person to lodge a private caveat under the NLC?',
    held: 'A caveatable interest must be a definite, identifiable interest in the specific land — not merely a contractual right or a claim in personam. A mere contractual right without specific reference to the identified land is insufficient to support a private caveat.',
    significance: 'Important boundary case on what constitutes a valid caveatable interest. Practitioners must ensure their client has a genuine, identifiable interest in the specific land before lodging a caveat — a baseless caveat exposes the caveator to damages.',
    diagram: { parties: ['Caveator (Oral Agreement Claimed)', 'Defendant (Registered Proprietor)'], issue: 'Is an oral agreement a caveatable interest?', result: 'INSUFFICIENT — Caveatable interest must be definite & specific to the land.' }
  },
  {
    id: 'case_007', title: 'Teh Bee v K Maruthamuthu', citation: '[1977] 2 MLJ 7',
    topic: 'Purchaser\'s Right to Lodge Private Caveat', tags: ['Caveat', 'SPA', 'Equity'],
    facts: 'A purchaser under a valid Sale and Purchase Agreement lodged a private caveat against the vendor\'s land to prevent the vendor from dealing with the title before the transfer was completed. The vendor challenged the right to caveat.',
    issue: 'Does a purchaser under an SPA have a caveatable interest entitling them to lodge a private caveat?',
    held: 'YES. A purchaser under a valid, specifically enforceable Sale and Purchase Agreement has an equitable interest in the land, which constitutes a caveatable interest under s.323 NLC.',
    significance: 'Confirmed the important right of purchasers to protect their interest in land by lodging a caveat immediately upon signing the SPA, before the transfer is registered. Now standard practice in conveyancing.',
    diagram: { parties: ['Purchaser (Signed SPA — Not Registered Yet)', 'Vendor (Registered Proprietor)'], issue: 'Can Purchaser lodge a private caveat?', result: 'YES — An SPA gives the Purchaser a caveatable equitable interest.' }
  },
  {
    id: 'case_008', title: 'Stephen Phoa Cheng Loon & Ors v Highland Properties Sdn Bhd', citation: '[2000] 4 MLJ 200',
    topic: 'Developer\'s Duty of Care in Construction', tags: ['HDA', 'Developer', 'Negligence', 'Tort'],
    facts: 'A hillside condominium development collapsed due to defective construction and failure to stabilise the slope. Hundreds of residents suffered loss of their units, personal injuries, and emotional distress. The developer was sued in tort for negligence.',
    issue: 'Does a developer owe a duty of care in tort to purchasers for defective construction causing physical damage and personal injury?',
    held: 'The developer owed a duty of care in tort to purchasers for defective construction. The developer was found liable for physical damage and personal injury resulting from negligent construction. The court applied the Caparo three-stage test for duty of care.',
    significance: 'Extended the developer\'s liability beyond the SPA contract into tort (negligence). A developer\'s obligation to build safely goes beyond the contractual defect liability period — latent defects causing physical harm attract tortious liability.',
    diagram: { parties: ['Residents (Purchasers — Physical Damage Suffered)', 'Highland Properties (Developer — Negligent Construction)'], issue: 'Is developer liable in tort for defective hillside?', result: 'YES — Developer owes duty of care in tort for negligent construction causing damage.' }
  },
  {
    id: 'case_009', title: 'Perbadanan Pengurusan Bukit Damansara v Yong Weng Fatt', citation: '[2017] MLJU 553',
    topic: 'Management Corporation — Recovery of Maintenance Charges', tags: ['Strata', 'MC', 'SMA 2013'],
    facts: 'A parcel owner (defendant) failed to pay maintenance charges to the Management Corporation for several months. The MC sued to recover the arrears. The defendant argued there were defects in the common property that justified withholding payment.',
    issue: 'Can a parcel owner withhold maintenance charges from the MC due to alleged defects in common property?',
    held: 'NO. Maintenance charges are a statutory obligation under the Strata Management Act 2013 and are payable regardless of disputes about common property defects. The obligation to pay is unconditional. The proper remedy for defects is a separate claim before the Strata Management Tribunal.',
    significance: 'Confirmed that maintenance charge payment is a non-negotiable statutory duty. Parcel owners cannot use defects as a set-off or defence to MC claims. Defect claims must go to the SMT separately.',
    diagram: { parties: ['MC (Plaintiff — Unpaid Charges)', 'Parcel Owner (Defendant — Withheld Payment)'], issue: 'Can defects justify withholding maintenance charges?', result: 'NO — Maintenance charges are unconditional. File defect claim at Strata Tribunal separately.' }
  },
  {
    id: 'case_010', title: 'Murugasu v Balasubramaniam', citation: '[1957] MLJ 115',
    topic: 'Rescission for Inability to Give Good Title', tags: ['Contract', 'Title', 'Rescission'],
    facts: 'A vendor agreed to sell land but was unable to give good title to the purchaser due to third-party encumbrances that could not be removed. The purchaser sought rescission and recovery of all monies paid including legal costs.',
    issue: 'What remedy does a purchaser have when the vendor is unable to convey good title to the land?',
    held: 'Where a vendor is unable to convey good title, the purchaser is entitled to rescind the contract and recover all monies paid (deposit, legal fees, stamp duty) together with interest.',
    significance: 'Established the purchaser\'s right to full rescission and restitution when the vendor cannot deliver good title. Practitioners must conduct thorough title searches and ensure all encumbrances are dischargeable before advising clients to proceed.',
    diagram: { parties: ['Purchaser (Paid Deposit)', 'Vendor (Cannot Give Good Title)'], issue: 'What is Purchaser\'s remedy when title is defective?', result: 'RESCISSION — Full refund of all monies paid + interest + costs.' }
  },
  {
    id: 'case_011', title: 'Pemungut Hasil Tanah, Kota Tinggi v Tiong Nyuk Chin', citation: '[1981] 2 MLJ 283',
    topic: 'Fraud & Indefeasibility — Actual vs Constructive Fraud', tags: ['Indefeasibility', 'Fraud', 'NLC s.340'],
    facts: 'The Land Administrator brought an action against a registered proprietor whose title was allegedly obtained through fraud. The question arose as to whether "constructive notice" of a prior interest amounted to "fraud" under s.340(2) NLC.',
    issue: 'What constitutes "fraud" under s.340(2) NLC sufficient to defeat registered title?',
    held: 'ACTUAL fraud on the part of the registered proprietor is required — not merely constructive notice or knowledge of prior equitable interests. Mere notice of a prior equity does not amount to fraud under the NLC. The fraud must be intentional dishonest conduct in obtaining registration.',
    significance: 'Critically limits the fraud exception to indefeasibility. A purchaser with knowledge of another\'s prior equitable interest is NOT automatically a fraudster — they must engage in active dishonest conduct.',
    diagram: { parties: ['Land Administrator (Claimant — Fraud Alleged)', 'Registered Proprietor (Defendant — Had Notice)'], issue: 'Does notice of prior equity = Fraud?', result: 'NO — Fraud requires ACTUAL dishonest conduct, not mere constructive notice.' }
  },
  {
    id: 'case_012', title: 'Lim Hang Seoh v Cheah Heng Keat', citation: '[1978] 2 MLJ 38',
    topic: 'Misrepresentation in Property Sale — Rescission', tags: ['Contract', 'Misrepresentation', 'SPA'],
    facts: 'A vendor misrepresented the area and boundaries of a piece of land to the purchaser during negotiations. The purchaser relied on the misrepresentation in entering the SPA. Upon discovering the true area was significantly smaller, the purchaser sued for rescission.',
    issue: 'Is a purchaser entitled to rescind an SPA where the vendor misrepresented the area or boundaries of the land?',
    held: 'Rescission was granted. The vendor\'s misrepresentation as to the area of the land was material — it induced the contract. Under s.18–19 Contracts Act, misrepresentation entitles the innocent party to rescind the contract and recover all monies paid.',
    significance: 'Highlights the importance of accurate representation in property negotiations. Purchasers\' solicitors should always verify land area from the official title search and survey rather than relying solely on vendor\'s representations.',
    diagram: { parties: ['Purchaser (Relied on Misrepresentation)', 'Vendor (Misrepresented Land Area)'], issue: 'Can Purchaser rescind for misrepresentation of area?', result: 'YES — Misrepresentation entitles rescission + full refund.' }
  },
  {
    id: 'case_013', title: 'Hock Huat Rubber Factory Sdn Bhd v Sungai Way Freeway Sdn Bhd', citation: '[1997] 1 MLJ 507',
    topic: 'Liquidated Damages Clause — Enforceability', tags: ['Contract', 'LAD', 'Damages'],
    facts: 'A property development agreement contained a LAD clause for late completion. The defendant argued the clause was a penalty clause under s.75 Contracts Act and should not be enforceable without proof of actual loss.',
    issue: 'Is a LAD clause in a property contract enforceable without proof of actual loss?',
    held: 'The LAD clause was upheld as a genuine pre-estimate of loss. In property contracts, LAD clauses are prima facie enforceable without proof of actual loss, provided the amount is not extravagant or unconscionable compared to anticipated loss at the time the contract was made.',
    significance: 'Confirmed that LAD clauses in property development contracts are generally enforceable without proof of actual damage. This principle supports the 10% p.a. LAD in HDA Schedule G/H which is regularly enforced by courts.',
    diagram: { parties: ['Developer (Late Completion)', 'Purchaser / Partner (Claiming LAD)'], issue: 'Is LAD clause a penalty or genuine pre-estimate?', result: 'Genuine pre-estimate — enforceable WITHOUT proof of actual loss.' }
  },
  {
    id: 'case_014', title: 'Kerajaan Negeri Selangor v Sagong bin Tasi', citation: '[2005] 6 MLJ 289',
    topic: 'Native Customary Rights (NCR) over Land', tags: ['Aboriginal Land', 'NCR', 'Constitutional'],
    facts: 'Orang Asli (aboriginal people) of the Temuan tribe had been living on and cultivating land in Bukit Tampoi, Selangor for generations. The government acquired the land for highway construction without compensating the Orang Asli for their customary rights.',
    issue: 'Do Orang Asli communities have legally recognisable native customary rights over land that must be compensated upon compulsory acquisition?',
    held: 'The Court of Appeal upheld the High Court\'s finding that the Orang Asli had native customary rights over the land, recognised at common law. These rights were proprietary in nature and survived the NLC. Compensation was payable upon compulsory acquisition.',
    significance: 'Landmark recognition of Orang Asli native customary rights as proprietary rights under Malaysian law. Established that NCR can survive the Torrens system and must be compensated in compulsory acquisitions.',
    diagram: { parties: ['Orang Asli Temuan Community (Traditional Occupiers)', 'State Government (Compulsory Acquisition for Highway)'], issue: 'Do Orang Asli have proprietary NCR over traditional land?', result: 'YES — NCR recognised at common law. Compensation payable.' }
  },
  {
    id: 'case_015', title: 'Abdul Aziz bin Mohd Yusoff v Pendaftar Mahkamah Tinggi', citation: '[2019] MLJU 482',
    topic: 'Unstamped Documents — Admissibility in Court', tags: ['Stamp Duty', 'Evidence', 'SPA'],
    facts: 'A party sought to rely on an unstamped Sale and Purchase Agreement as evidence in legal proceedings. The opposing party objected on the ground that an unstamped instrument is inadmissible under the Stamp Act 1949.',
    issue: 'Is an unstamped instrument admissible as evidence in Malaysian court proceedings?',
    held: 'An unstamped instrument is INADMISSIBLE as evidence in any proceedings under s.52 Stamp Act 1949. The court cannot receive it in evidence unless and until the appropriate stamp duty and penalty have been paid. The court has no discretion to admit an unstamped document.',
    significance: 'Failing to stamp an SPA or other instrument in time not only attracts penalties but can render the document inadmissible if litigation arises. Always stamp instruments promptly within the 30-day period.',
    diagram: { parties: ['Party Relying on SPA (Unstamped)', 'Opposing Party (Objecting to Admissibility)'], issue: 'Is unstamped SPA admissible in court?', result: 'NO — Inadmissible until full stamp duty + penalties paid.' }
  },

  // ─── NEW CASES ──────────────────────────────────────────────────────────────
  {
    id: 'case_016', title: 'Tay Tuan Kiat v Pritam Singh Brar', citation: '[1987] 1 MLJ 102',
    topic: 'Time of Essence in SPA — Vendor\'s Right to Forfeit', tags: ['Contract', 'SPA', 'Time of Essence', 'Default'],
    facts: 'The purchaser failed to pay the balance purchase price by the contractual completion date. The vendor served a notice requiring completion within a reasonable time, and upon the purchaser\'s continued default, rescinded the SPA and forfeited the deposit. The purchaser argued the vendor had waived the time stipulation by earlier conduct.',
    issue: 'Is time of the essence in a Sale and Purchase Agreement? What is required before a vendor can rescind and forfeit the deposit?',
    held: 'Time is prima facie of the essence in an SPA for land. If time is waived, it can be reinstated by giving the purchaser a fresh, clear notice requiring completion within a reasonable time. Upon the purchaser\'s continued default after such notice, the vendor may rescind and forfeit the deposit without further obligation to the purchaser.',
    significance: 'Establishes the "notice to complete" procedure in Malaysian conveyancing — a cornerstone of vendor remedies. Vendors who have granted extensions must give a fresh time-of-essence notice before they can rescind. Now standard practice in all SPA default situations.',
    diagram: { parties: ['Vendor (Served Notice to Complete)', 'Purchaser (Failed to Complete on Time)'], issue: 'Can vendor rescind and forfeit deposit after purchaser\'s default?', result: 'YES — After valid notice to complete, vendor may rescind and forfeit all deposits.' }
  },
  {
    id: 'case_017', title: 'Kwong Yik Bank Bhd v Manaf bin Haji Muhammad Ali', citation: '[1990] 1 MLJ 378',
    topic: 'Order for Sale (Foreclosure) — Chargee\'s Near-Absolute Right', tags: ['Charge', 'Foreclosure', 'Order for Sale', 'NLC s.256'],
    facts: 'A chargor defaulted on housing loan repayments. The bank applied to the High Court for an Order for Sale under s.256 NLC. The chargor resisted the application and raised a counterclaim for damages against the bank for alleged mishandling of the loan account.',
    issue: 'Where a chargor defaults on a loan, does the court have a broad discretion to refuse or delay an Order for Sale? Can a counterclaim be a defence to foreclosure?',
    held: 'The court held that where a chargor has clearly defaulted, the chargee is entitled as of right to an Order for Sale. The court\'s discretion to adjourn is extremely limited and is only exercised where the chargor shows a real prospect of remedying the default promptly. A counterclaim by the chargor is NOT a defence to the foreclosure application and cannot prevent or delay the Order for Sale.',
    significance: 'Establishes the near-absolute right of a chargee to foreclose upon clear default. Banks in Malaysia have strong rights over charged property upon default. This deters strategic defences designed to delay foreclosure.',
    diagram: { parties: ['Kwong Yik Bank (Chargee — Applying for Order for Sale)', 'Manaf (Defaulting Chargor — Counterclaim Raised)'], issue: 'Can chargor\'s counterclaim defeat bank\'s foreclosure application?', result: 'NO — Counterclaim is not a defence to foreclosure. Order for Sale granted.' }
  },
  {
    id: 'case_018', title: 'Siaw Chui Hoong v Borneo Housing Mortgage Finance Bhd', citation: '[1994] 2 MLJ 282',
    topic: 'Chargee\'s Duty of Care When Exercising Power of Sale', tags: ['Charge', 'Foreclosure', 'Duty of Care', 'Fiduciary'],
    facts: 'The chargor defaulted on a loan. The chargee bank exercised its power of sale and sold the charged property at a price significantly below market value, without adequate advertising or independent valuation. The chargor sued the bank for the shortfall caused by the alleged undervaluation.',
    issue: 'Does a chargee exercising the power of sale owe a duty to the chargor to obtain the true market value of the property?',
    held: 'YES. A chargee exercising the statutory power of sale is not merely entitled to sell at whatever price it can obtain — it owes a duty to take reasonable precautions to obtain the true market value (or best price reasonably obtainable) at the time of sale. A sale at a gross undervalue without proper marketing and independent valuation renders the chargee liable to the chargor for the difference.',
    significance: 'While chargees have strong foreclosure rights, they must exercise the power of sale responsibly. Banks cannot "fire-sell" properties without regard to market value. This provides important chargor protection against undervalued mortgagee sales.',
    diagram: { parties: ['Chargor (Sold Property — Undervalued)', 'Chargee Bank (Exercised Power of Sale Without Care)'], issue: 'Does bank owe duty to get market value when selling?', result: 'YES — Chargee must take reasonable steps to obtain true market value. Liable for shortfall otherwise.' }
  },
  {
    id: 'case_019', title: 'Au Meng Nam & Anor v Ung Yak Chew & Ors', citation: '[2007] 4 MLJ 1 (Federal Court)',
    topic: 'Resulting Trust vs Torrens Indefeasibility', tags: ['Trust', 'Indefeasibility', 'Beneficial Ownership', 'NLC s.340'],
    facts: 'The plaintiffs paid the entire purchase price for land that was registered in the defendants\' names (as nominees). When the relationship broke down, the defendants claimed indefeasible title as registered proprietors. The plaintiffs argued a resulting trust arose in their favour.',
    issue: 'Can a resulting trust (where the beneficial owner paid the purchase price but the land was registered in another\'s name) prevail over the Torrens principle of indefeasibility?',
    held: 'The Federal Court held that where the registered proprietor is a volunteer (received no consideration for the registration), the resulting trust may prevail and the beneficial owner can assert their equitable rights. However, where the registered proprietor is a bona fide purchaser for value, the Torrens indefeasibility principle prevails over the resulting trust.',
    significance: 'Critically important in nominee and family property situations. A nominee (volunteer) cannot hide behind the Torrens register to defeat the beneficial owner who paid for the property. However, a bona fide purchaser for value is still protected.',
    diagram: { parties: ['Beneficial Owner (Paid Purchase Price)', 'Nominee (Registered as Proprietor — Volunteer)'], issue: 'Can resulting trust prevail over registered Torrens title?', result: 'YES (against volunteer nominee) — Resulting trust can prevail where registrant is not a bona fide purchaser for value.' }
  },
  {
    id: 'case_020', title: 'United Malayan Banking Corp Bhd v Pemungut Hasil Tanah, Kota Tinggi', citation: '[1984] 2 MLJ 87 (Privy Council)',
    topic: 'Chargee\'s Indefeasibility Under Torrens System', tags: ['Indefeasibility', 'Charge', 'Privy Council', 'NLC s.340'],
    facts: 'A bank registered a charge over land. It was subsequently discovered that the chargor\'s title had been obtained by fraud. The Land Administrator sought to cancel the charge on the ground that the underlying title was fraudulently obtained.',
    issue: 'Does a bank that registers a charge in good faith and for value obtain an indefeasible charge even if the chargor\'s original title was fraudulently obtained?',
    held: 'The Privy Council held that a bank registering a charge in good faith and for value is entitled to the protection of the Torrens indefeasibility principle. The bank\'s registered charge was not affected by the chargor\'s fraudulent original title, as the bank had no knowledge of the fraud.',
    significance: 'Establishes that Torrens indefeasibility protects not just purchasers but also chargees who deal in good faith. Banks are entitled to rely on the register without investigating the history of how the current proprietor obtained their title — a foundational protection for the banking system.',
    diagram: { parties: ['UMBC (Chargee — Registered in Good Faith)', 'Land Administrator (Claimed Underlying Fraud)'], issue: 'Does underlying fraud in title defeat a bona fide chargee\'s registered charge?', result: 'NO — Bona fide chargee for value is protected by Torrens indefeasibility.' }
  },
  {
    id: 'case_021', title: 'Tay Kheng Hock v Penang Development Corp', citation: '[1979] 2 MLJ 227',
    topic: 'Groundless Caveat — Damages to Registered Proprietor', tags: ['Caveat', 'Damages', 'NLC s.329'],
    facts: 'The plaintiff lodged a private caveat against the defendant\'s land claiming an interest based on an unexercised option to purchase. The defendant applied to remove the caveat as groundless. The defendant also claimed damages for losses suffered because of the caveat preventing a sale.',
    issue: 'Does an unexercised option to purchase give a caveatable interest? Can damages be recovered for a wrongful caveat?',
    held: 'An option to purchase, before it is exercised, gives rise only to a contractual right — NOT an equitable interest in land sufficient to support a private caveat. The caveat was therefore groundless. Under s.329 NLC, a caveator who lodges a wrongful caveat is liable to compensate any person suffering loss as a consequence of the caveat.',
    significance: 'Defines clearly that the holder of an option can only lodge a caveat AFTER exercising the option (when an equitable interest arises). Practitioners must time the caveat correctly. More broadly, confirms damages liability under s.329 NLC for wrongful caveats.',
    diagram: { parties: ['Option Holder (Lodged Caveat Before Exercising Option)', 'Registered Proprietor (Suffered Loss — Blocked Sale)'], issue: 'Can an unexercised option holder lodge a private caveat?', result: 'NO — No caveatable interest before option is exercised. Caveator liable for damages under s.329 NLC.' }
  },
  {
    id: 'case_022', title: 'Cho Moi v Collector of Land Revenue, Kuala Langat', citation: '[1979] 2 MLJ 49',
    topic: 'Compulsory Land Acquisition — Market Value & Adequate Compensation', tags: ['Compulsory Acquisition', 'Land Acquisition Act', 'Compensation'],
    facts: 'Land was compulsorily acquired by the government for a public purpose. The government paid compensation based solely on the land\'s current agricultural use. The landowner appealed to the High Court, arguing the compensation was inadequate and did not reflect the land\'s development potential.',
    issue: 'How is market value determined for compulsory acquisition compensation? Must development potential be considered?',
    held: 'The court held that compensation for compulsory acquisition must reflect the market value of the land as at the date of the declaration — determined by what a willing buyer would pay a willing seller in an open market. The land\'s development potential (e.g. suitability for residential or commercial development) must be considered in computing market value — the owner is not limited to compensation based only on the existing agricultural use.',
    significance: 'Landmark case on compensation for compulsory acquisition. Protects landowners from being under-compensated. Establishes the "willing buyer/willing seller" test for Malaysia. Land acquisition valuations must take into account all potential uses, not merely the current use.',
    diagram: { parties: ['Landowner (Demanded Compensation for Development Value)', 'Collector (Paid Only Agricultural Value)'], issue: 'Must compensation include development potential?', result: 'YES — Market value based on "willing buyer/seller" test, including development potential.' }
  },
  {
    id: 'case_023', title: 'Ranbir Singh v Govind Singh', citation: '[1995] 3 MLJ 81',
    topic: 'Waiver of Time of Essence — Notice to Complete Procedure', tags: ['Contract', 'SPA', 'Time of Essence', 'Waiver', 'Notice'],
    facts: 'A vendor under a SPA granted the purchaser multiple extensions of time for completion. After the final extension lapsed, the vendor immediately rescinded the SPA and forfeited the deposit without issuing any fresh notice. The purchaser argued the vendor\'s conduct in granting extensions constituted a waiver and the rescission was premature.',
    issue: 'Where a vendor has granted multiple extensions (thereby waiving time of essence), can the vendor immediately rescind upon expiry of the last extension without giving a fresh notice to complete?',
    held: 'Where a party has waived the time stipulation by granting multiple extensions, time is no longer of the essence. To revive time of the essence, the innocent party must give the other party a clear, unambiguous "notice to complete" specifying a reasonable deadline and warning that failure will result in rescission. Rescission without such notice is unlawful.',
    significance: 'Establishes the procedure that vendors must follow when they have waived time. The "notice to complete" (giving 10–14 days) is now standard practice in Malaysian conveyancing when a purchaser is in delay. Vendors who skip this step risk their rescission being invalid.',
    diagram: { parties: ['Vendor (Multiple Extensions Granted — Then Rescinded Immediately)', 'Purchaser (No Fresh Notice Given)'], issue: 'Can vendor rescind without fresh notice after waiving time?', result: 'NO — Must first issue a fresh "notice to complete" with reasonable deadline before rescission.' }
  },
  {
    id: 'case_024', title: 'Kim Lee Kor Sdn Bhd v Syarikat Pelangi Sdn Bhd', citation: '[1987] 2 MLJ 391',
    topic: 'Promissory Estoppel — Waiver of Contractual Terms', tags: ['Contract', 'Promissory Estoppel', 'SPA'],
    facts: 'A vendor made repeated representations to the purchaser that it would not insist on the strict time limits for completion. The purchaser relied on these representations and made alternative arrangements for financing. The vendor then purported to terminate the SPA upon expiry of the original completion date without prior notice.',
    issue: 'Does the doctrine of promissory estoppel apply in land transactions? Can a vendor who has made promises about extensions be estopped from enforcing the original time limit?',
    held: 'Promissory estoppel applies in Malaysian property transactions. Where a vendor makes a clear representation that it will not insist on a contractual term (such as the completion date), and the purchaser relies on this to their detriment, the vendor is estopped from resiling from the representation without giving reasonable notice to the purchaser.',
    significance: 'Promissory estoppel operates as a shield (not a sword) in Malaysian contract law. However, it must be noted: the vendor CAN reinstate the time requirement by giving clear, reasonable notice. This case must be read together with Ranbir Singh — the notice to complete process is the proper mechanism.',
    diagram: { parties: ['Vendor (Made Representations — Then Purported to Terminate Immediately)', 'Purchaser (Relied on Vendor\'s Assurances)'], issue: 'Can vendor enforce time limit after making representations to the contrary?', result: 'NO — Promissory estoppel prevents enforcement without reasonable prior notice.' }
  },
  {
    id: 'case_025', title: 'Ng Hee Thoong & Anor v Public Bank Bhd', citation: '[1995] 1 MLJ 281',
    topic: 'Chargee Need Not Exhaust Guarantor Before Foreclosure', tags: ['Charge', 'Foreclosure', 'Guarantee', 'Priority'],
    facts: 'A bank held both a charge over a property and a personal guarantee from third parties. The chargor defaulted. The bank sought an Order for Sale of the charged property. The guarantors argued the bank should first exhaust all claims against the principal chargor before turning to the charged property.',
    issue: 'Must a chargee exhaust all remedies against the chargor personally or against guarantors before applying for an Order for Sale of the charged property?',
    held: 'NO. A chargee is not obliged to exhaust any other remedies before exercising the power to apply for an Order for Sale of the charged property. The chargee may choose which security to enforce first and in what order. The guarantors have no right to object to the bank proceeding against the charged land first.',
    significance: 'Confirms strong bank rights in secured lending. Banks in Malaysia can go straight to foreclosure on the mortgaged property without first suing the borrower or pursuing the guarantors. This gives banks efficient enforcement rights — important for the credit market.',
    diagram: { parties: ['Bank (Applied for Order for Sale of Property)', 'Guarantors (Argued: Exhaust other remedies first)'], issue: 'Must bank exhaust guarantor before foreclosing on property?', result: 'NO — Bank can choose which security to enforce first. No obligation to exhaust other remedies.' }
  },
  {
    id: 'case_026', title: 'Tan Chee Beng v Tee Peck Hoon', citation: '[2003] 3 MLJ 73',
    topic: 'Resulting Trust — Property in Another\'s Name', tags: ['Trust', 'Resulting Trust', 'Beneficial Ownership'],
    facts: 'The plaintiff paid the entire purchase price for a piece of land that was registered in the defendant\'s name. The parties\' relationship broke down. The plaintiff claimed a resulting trust over the entire property in his favour, while the defendant relied on the registered title to claim absolute ownership.',
    issue: 'Where one person pays the entire purchase price for land but it is registered in another\'s name, does a resulting trust arise in favour of the payer?',
    held: 'A resulting trust arises automatically by operation of law where one party pays the purchase price but the legal title is registered in another\'s name. The amount of the beneficial interest is proportionate to the financial contribution. The registered proprietor holds the legal title on trust for the payer to the extent of their contribution.',
    significance: 'Important in cases involving nominees, family arrangements, and business partners. The registered title alone does not determine beneficial ownership. Contributions to the purchase price create equitable rights. However, subsequent bona fide purchasers for value from the legal owner are still protected by Torrens.',
    diagram: { parties: ['Plaintiff (Paid Full Purchase Price)', 'Defendant (Registered as Proprietor — No Contribution)'], issue: 'Who is the beneficial owner of the property?', result: 'Plaintiff — Resulting trust arises proportionate to financial contribution.' }
  },
  {
    id: 'case_027', title: 'Pemungut Hasil Tanah, Daerah Barat Daya, PP v Ong Gaik Kee', citation: '[1983] 2 MLJ 35 (Privy Council)',
    topic: 'Land Acquisition — Market Value Includes Potential Uses', tags: ['Compulsory Acquisition', 'Market Value', 'Compensation', 'Privy Council'],
    facts: 'Land was acquired under the Land Acquisition Act 1960. The Collector assessed compensation based solely on its current use as orchard/agricultural land. The landowner appealed, arguing the compensation should reflect the land\'s potential for development into a housing estate.',
    issue: 'In assessing market value for compulsory acquisition, can the potential use of the land for a purpose other than its current use be considered?',
    held: 'The Privy Council held that in assessing market value for the purpose of compulsory acquisition compensation, the Collector and court must consider all uses to which the land might reasonably be expected to be put in the open market — including its potential for residential or commercial development — not just the current use. A willing buyer would pay a price reflecting this potential.',
    significance: 'Definitive Privy Council authority on how to compute compensation in Malaysian land acquisition cases. Landowners are entitled to be compensated on the basis of the open market value, reflecting development potential. Establishes the "prudent/willing buyer and seller" test for Malaysia.',
    diagram: { parties: ['Landowner (Claimed Development Value)', 'Collector (Paid Only Agricultural Value)'], issue: 'Does "market value" in acquisition include development potential?', result: 'YES — Must consider all reasonable potential uses, not just current use (Privy Council).' }
  },
  {
    id: 'case_028', title: 'Datuk Jagindar Singh v Tara Rajaratnam', citation: '[1983] 2 MLJ 196',
    topic: 'Constructive Trust — Family Property & Informal Arrangements', tags: ['Trust', 'Constructive Trust', 'Family Property'],
    facts: 'A married couple contributed jointly to the purchase of matrimonial property, but the title was registered only in the husband\'s name. After divorce, the wife claimed a beneficial interest in the property based on her financial contributions to the mortgage payments and household.',
    issue: 'Can a spouse who contributed to a property (but is not on the title) claim a beneficial interest based on constructive trust or resulting trust?',
    held: 'The court held that a constructive trust arises where there is a common intention (express or inferred from conduct) between the parties that both shall have a beneficial interest in the property, and one party has acted to their detriment in reliance on that common intention. Financial contributions to mortgage payments and household expenses can establish this common intention and give rise to a beneficial interest.',
    significance: 'Foundational Malaysian case on family property and constructive trusts. Protects non-registered spouses who contributed to the acquisition or improvement of matrimonial property. Widely applied in divorce proceedings involving property disputes.',
    diagram: { parties: ['Wife (Contributed to Mortgage — Not on Title)', 'Husband (Sole Registered Proprietor)'], issue: 'Does contributing spouse have a beneficial interest?', result: 'YES — Constructive trust arises from common intention + detrimental reliance on contributions.' }
  },
  {
    id: 'case_029', title: 'Loke Yew v Port Swettenham Rubber Co Ltd', citation: '[1913] 1 FMSLR 303',
    topic: 'Fraud on the Register — Historical Foundation', tags: ['Indefeasibility', 'Fraud', 'Historical'],
    facts: 'One of the earliest Malaysian land law cases. A person obtained registration of land through fraudulent misrepresentation and then sought to rely on the registered title to defeat the true owner\'s claim. The true owner sought to have the fraudulent registration set aside.',
    issue: 'Does the Torrens system protect a person who obtained their own registration through fraud?',
    held: 'The court held that a person who obtains registration of land through their own fraud cannot rely on the Torrens principle of indefeasibility to defeat the true owner. The Torrens system has never been intended to protect fraudsters — a title obtained by the registered proprietor\'s own fraud is defeasible. This exception has existed since the very beginning of the Malaysian Torrens system.',
    significance: 'One of the earliest recorded Malaysian land law authorities on the fraud exception to indefeasibility. Establishes the foundational principle — unchanged to this day — that the Torrens system protects against third-party fraud but not against fraud by the registered proprietor themselves.',
    diagram: { parties: ['True Owner (Victim of Fraudulent Registration)', 'Fraudster (Obtained Registration by Fraud)'], issue: 'Can a fraudster rely on Torrens indefeasibility?', result: 'NO — Registration obtained by fraud is defeasible. Torrens does not protect fraudsters.' }
  },
  {
    id: 'case_030', title: 'Arab-Malaysian Finance Bhd v Meridian Credit Sdn Bhd', citation: '[1985] 2 MLJ 352',
    topic: 'Second Charge — Consent of First Chargee & Priority', tags: ['Charge', 'Priority', 'Second Charge', 'NLC s.241'],
    facts: 'A property owner created a second charge over land already charged to a first bank, without the first chargee\'s knowledge or consent. The second chargee applied to register the charge. A dispute arose between the two chargees over priority and the validity of the second charge.',
    issue: 'Can a second charge be created without the consent of the first chargee? What is the priority between first and second charges?',
    held: 'The NLC does not, as a general rule, require the first chargee\'s consent before a second charge can be registered. However, the terms of the first charge agreement may contractually prohibit further encumbrances without the first chargee\'s consent. As to priority, the first registered charge takes priority over the second, regardless of the order in which they were executed.',
    significance: 'Clarifies the relationship between first and second chargees. Banks should include clauses prohibiting further charges without consent in their loan agreements. Priority disputes are resolved by order of registration — critical for practitioners dealing with properties with existing charges.',
    diagram: { parties: ['First Chargee (Registered First)', 'Second Chargee (Registered Second — Without Consent)'], issue: 'What is the priority between first and second charges?', result: 'First registered = First in priority. Second charge is valid but subordinate to first.' }
  },
  {
    id: 'case_031', title: 'Ong Beng Chye v Estate of Ng Kim Swee', citation: '[1999] 2 MLJ 337',
    topic: 'Adverse Possession — Not Available Against Torrens Title', tags: ['Adverse Possession', 'Indefeasibility', 'NLC s.340'],
    facts: 'The plaintiff occupied a piece of land for many years, claiming to have done so openly, continuously, and exclusively. The registered proprietor or their estate had not asserted rights for over 12 years. The plaintiff sought to establish title by adverse possession.',
    issue: 'Is adverse possession available as a means of acquiring title to registered Torrens land in Malaysia?',
    held: 'Adverse possession is generally not applicable to registered Torrens land in Malaysia. The principle of indefeasibility under the NLC means that the registered proprietor\'s title cannot be extinguished by mere adverse occupation. The relevant limitation periods apply to personal actions, not to the registered Torrens title itself. The registered owner\'s title remains valid regardless of length of adverse occupation.',
    significance: 'Confirms a fundamental difference between Malaysian Torrens land law and English common law: there is NO adverse possession of registered Torrens land in Malaysia. This gives certainty to registered title holders. Contrast with England where the Land Registration Act 2002 still allows (limited) adverse possession.',
    diagram: { parties: ['Occupier (12+ years adverse possession claimed)', 'Registered Proprietor / Estate (Not in physical possession)'], issue: 'Can adverse possession extinguish Torrens registered title?', result: 'NO — Adverse possession does not apply to registered Torrens title in Malaysia.' }
  },
  {
    id: 'case_032', title: 'Peninsular Land Development Sdn Bhd v Oon Boon Sang', citation: '[2002] 1 MLJ 369',
    topic: 'HDA — Developer\'s Obligation on Late VP Delivery', tags: ['HDA', 'Developer', 'LAD', 'Vacant Possession'],
    facts: 'A housing developer failed to deliver vacant possession of a residential house by the contractual VP date under the Housing Development Act 1966 (Schedule G SPA). The purchaser claimed LAD (Liquidated Ascertained Damages) at the rate of 10% per annum on the purchase price for each day of delay.',
    issue: 'Is a purchaser entitled to LAD for late delivery of VP under a Schedule G SPA? How is LAD computed?',
    held: 'The court upheld the purchaser\'s right to LAD under the Schedule G SPA. The LAD is computed at 10% per annum on the purchase price, calculated from the contractual VP date to the actual VP date, without any requirement to prove actual loss. The LAD clause in Schedule G is a genuine pre-estimate of loss and is enforceable.',
    significance: 'Confirms the enforceable right to LAD for late VP under HDA Schedule G/H. Purchasers need not prove actual loss to recover LAD — the prescribed rate of 10% p.a. is automatically payable. This is one of the strongest consumer protection mechanisms under Malaysian housing law.',
    diagram: { parties: ['Purchaser (Seeking LAD for Late VP)', 'Developer (Late in Delivering Vacant Possession)'], issue: 'Is purchaser entitled to LAD without proving actual loss?', result: 'YES — 10% p.a. LAD is automatically payable for each day of delay under HDA Schedule G/H.' }
  },
  {
    id: 'case_033', title: 'Tan Kim Heng Construction Co Sdn Bhd v Ahmad bin Haji Hassan', citation: '[2000] 3 MLJ 361',
    topic: 'Fraud Exception — Personal Fraud Required for Defeasibility', tags: ['Indefeasibility', 'Fraud', 'NLC s.340'],
    facts: 'The registered proprietor obtained registration of land title. A prior claimant alleged that the registration was tainted by fraud. The prior claimant sought to have the title cancelled on grounds of fraud under s.340(2) NLC.',
    issue: 'What must a party prove to establish "fraud" sufficient to defeat the registered proprietor\'s title under s.340(2) NLC?',
    held: 'The fraud exception under s.340(2) NLC requires the claimant to prove that the registered proprietor was personally guilty of fraud in obtaining the registration. The fraud must be actual, intentional dishonesty — not negligence, carelessness, or constructive notice of a prior claim. Indirect or technical fraud is insufficient.',
    significance: 'Reinforces the high threshold for the fraud exception to Torrens indefeasibility in Malaysia. The claimant bears the burden of proving actual personal fraud by the registered proprietor. This gives certainty to purchasers who register in good faith — even if they had knowledge of a prior claim, that knowledge alone is insufficient.',
    diagram: { parties: ['Prior Claimant (Alleges Fraud)', 'Registered Proprietor (Claims Indefeasibility)'], issue: 'What is required to prove fraud under s.340(2) NLC?', result: 'Must prove ACTUAL, PERSONAL, INTENTIONAL DISHONESTY — not mere knowledge or negligence.' }
  },
  {
    id: 'case_034', title: 'Majlis Perbandaran Pulau Pinang v Syarikat Bekerjasama-sama Sehingga Binaan Bukit Sena', citation: '[1999] 3 MLJ 1 (Federal Court)',
    topic: 'Local Authority — Planning Control Powers and Land Dealings', tags: ['Planning', 'Local Authority', 'TCPA 1976'],
    facts: 'A developer obtained planning permission from the Penang Municipal Council for a housing project. The local authority subsequently imposed additional conditions that significantly affected the development. The developer challenged the local authority\'s powers to impose conditions on an already-approved development.',
    issue: 'What are the limits of a local authority\'s powers to impose conditions on planning approvals? Can conditions be imposed after initial approval?',
    held: 'The Federal Court held that local authorities have broad statutory powers under the Town and Country Planning Act 1976 to impose, vary, and add conditions to planning approvals. These powers must be exercised for valid planning purposes. A developer cannot assume planning approval is unconditional or irrevocable — the local authority retains ongoing regulatory powers.',
    significance: 'Confirms broad local authority powers over development. Property developers must comply with all planning conditions throughout the development process. Changes in conditions can affect project feasibility and title (since titles cannot be issued without planning compliance). Important for all property development due diligence.',
    diagram: { parties: ['Developer (Relied on Initial Planning Approval)', 'Penang Municipal Council (Imposed Additional Conditions)'], issue: 'Can local authority impose new conditions on existing planning approval?', result: 'YES — Local authority has broad statutory powers under TCPA 1976. Planning conditions can be varied.' }
  },
  {
    id: 'case_035', title: 'Kerajaan Negeri Johor v Adong bin Kuwau & Ors', citation: '[1997] 1 MLJ 418',
    topic: 'Orang Asli Aboriginal Land Rights — Pre-Colonial Common Law Title', tags: ['Aboriginal Land', 'NCR', 'Orang Asli', 'Constitutional'],
    facts: 'Orang Asli (Jakun tribe) in Johor had been occupying forested land for many generations. The State Government granted timber concessions over this land without consultation or compensation to the Orang Asli community. The community sued to assert their land rights and claim compensation.',
    issue: 'Do Orang Asli communities have a legally recognised proprietary interest (native customary rights) in their traditionally occupied land? Must the State compensate them for interference with such rights?',
    held: 'The High Court held that the Orang Asli have a common law right to their traditional land based on their original occupation. This right — native customary rights — is a form of proprietary right recognized at common law, predating colonization. The State must compensate the Orang Asli for the extinction of their traditional land rights through timber concessions.',
    significance: 'A companion case to Sagong bin Tasi. Together, these cases establish the framework for Orang Asli land rights in Malaysia. Any state alienation of or interference with Orang Asli traditional land requires proper recognition and compensation. Important for conveyancers conducting due diligence on land near aboriginal settlements.',
    diagram: { parties: ['Jakun Orang Asli Community (Traditional Occupiers)', 'Johor State Government (Granted Timber Concession Without Consent)'], issue: 'Do Orang Asli have compensable proprietary rights in traditional land?', result: 'YES — Native customary rights are proprietary. State must compensate for interference.' }
  },
  {
    id: 'case_036', title: 'Woon Brothers Construction Sdn Bhd v Southern Bank Bhd', citation: '[1989] 3 MLJ 27',
    topic: 'Competing Equitable Interests & Torrens Priority', tags: ['Priority', 'Equity', 'Charge', 'NLC'],
    facts: 'Two parties had competing equitable interests in land — one had an unregistered agreement to purchase (equitable), the other had an unregistered charge (equitable). Neither had registered their interest. When the registered proprietor became insolvent, both parties claimed priority over each other.',
    issue: 'How are competing equitable interests in Torrens land resolved where neither is registered?',
    held: 'Where two parties hold competing equitable interests in Torrens land and neither has registered, the general rule is that the first in time prevails ("qui prior est tempore, potior est jure"). However, this can be displaced if the earlier equitable interest holder has been negligent or there are other equitable grounds for preferring the later claim.',
    significance: 'Illustrates the importance of PROMPT REGISTRATION of all interests in land under the Torrens system. An unregistered equitable interest (even a genuine one) is vulnerable to defeat by a subsequent registered dealing or by competing equitable interests. Always register or lodge a caveat immediately.',
    diagram: { parties: ['First Equitable Interest Holder (Unregistered)', 'Second Equitable Interest Holder (Also Unregistered)'], issue: 'Who prevails where both are unregistered equitable interests?', result: 'First in time prevails (unless displaced by negligence or other equitable grounds).' }
  },
  {
    id: 'case_037', title: 'Kerajaan Malaysia v Jasanusa Sdn Bhd', citation: '[1995] 2 MLJ 105',
    topic: 'Compulsory Acquisition — Public Purpose Requirement', tags: ['Compulsory Acquisition', 'Public Purpose', 'Land Acquisition Act'],
    facts: 'Land was compulsorily acquired under the Land Acquisition Act 1960. The landowner challenged the acquisition on the ground that the stated "public purpose" was not a genuine public purpose but was in fact being acquired for a private commercial development.',
    issue: 'Can the court review whether land was acquired for a genuine "public purpose" under the Land Acquisition Act?',
    held: 'The court held that the Land Acquisition Act 1960 requires a genuine "public purpose" as a precondition for valid compulsory acquisition. While courts are slow to interfere with the government\'s assessment of what constitutes public purpose, the declaration of public purpose cannot be a cloak for acquiring land for private benefit. If the stated purpose is a sham, the acquisition is invalid.',
    significance: 'Provides a check on government acquisition powers. Landowners can challenge acquisitions where the "public purpose" is not genuine. This case is important for understanding the limits of the state\'s compulsory acquisition powers under the Land Acquisition Act.',
    diagram: { parties: ['Landowner (Challenged Acquisition as Sham)', 'Government (Claimed "Public Purpose")'], issue: 'Can courts review whether "public purpose" in acquisition is genuine?', result: 'YES — Courts can review. If stated public purpose is a sham, acquisition is invalid.' }
  },
  {
    id: 'case_038', title: 'Lembaga Kemajuan Tanah Persekutuan (FELDA) v Mariam', citation: '[1984] 1 MLJ 263',
    topic: 'FELDA Land — Restrictions on Dealings', tags: ['FELDA', 'Restriction in Interest', 'Land Settlement'],
    facts: 'A FELDA settler who had been allocated land under a FELDA settlement scheme attempted to transfer the land to a non-settler without obtaining FELDA\'s prior written consent, as required by the terms of the grant. FELDA applied to cancel the transfer.',
    issue: 'Are transfers of FELDA land without FELDA\'s consent valid? What is the effect of the restriction in interest imposed by FELDA?',
    held: 'The court held that FELDA land is subject to statutory restrictions preventing dealings without FELDA\'s prior written consent. A purported transfer without FELDA\'s consent is void. The restriction in interest is binding on the registered proprietor and any purported dealings in breach are invalid.',
    significance: 'Important for rural land transactions involving FELDA scheme land. FELDA settlers have limited rights to deal with their land — they must obtain FELDA\'s approval before any transfer, charge, or lease. Practitioners must check the title for FELDA restrictions before advising clients.',
    diagram: { parties: ['FELDA Settler (Purported Transfer Without Consent)', 'FELDA (Restriction in Interest Holder)'], issue: 'Is transfer of FELDA land without consent valid?', result: 'NO — FELDA restriction in interest applies. Transfer without consent is void.' }
  },
  {
    id: 'case_039', title: 'R Subramaniam v Majlis Perbandaran Ampang Jaya', citation: '[1997] 2 MLJ 429',
    topic: 'Auction Purchaser\'s Rights — Existing Occupants', tags: ['Foreclosure', 'Auction', 'Possession', 'Vesting Order'],
    facts: 'The plaintiff purchased a property at a court-ordered mortgagee sale (public auction). Upon obtaining the Vesting Order and having the title registered in his name, the plaintiff discovered that the former owner and their family were still occupying the property and refused to vacate.',
    issue: 'What rights does an auction purchaser have against existing occupants who refuse to vacate after the Vesting Order and transfer of title?',
    held: 'An auction purchaser who has obtained a Vesting Order and had the title registered in their name is entitled to immediate possession of the property. The former owner and their occupants have no right to continue in occupation against the new registered proprietor. The auction purchaser may apply to the court for a writ of possession to enforce vacant possession.',
    significance: 'Confirms the auction purchaser\'s right to possession as the new registered proprietor. However, practitioners must advise auction buyers that obtaining possession in practice often requires a separate court application for a writ of possession — particularly important where the former owner is occupying. Properties sold at auction are sold "as is where is."',
    diagram: { parties: ['Auction Purchaser (Registered as New Proprietor)', 'Former Owner (Refusing to Vacate)'], issue: 'Can auction purchaser compel former owner to vacate?', result: 'YES — New registered proprietor has right to possession. Apply for Writ of Possession if necessary.' }
  },
  {
    id: 'case_040', title: 'Damai Services Sdn Bhd v Majlis Bandaraya Shah Alam', citation: '[2010] 1 MLJ 249',
    topic: 'Strata Development — Management of Common Property Before MC Formation', tags: ['Strata', 'JMB', 'Common Property', 'SMA'],
    facts: 'A management company was appointed by the developer to manage the common property of a strata development before the Management Corporation was formally constituted. A dispute arose as to who had the legal authority to manage and collect maintenance charges from parcel owners during this transitional period.',
    issue: 'Who has the legal authority to manage common property and collect maintenance fees in a strata development before the Management Corporation is formally constituted?',
    held: 'Before the MC is constituted, the developer has the primary legal obligation to manage the common property and may appoint a management company to do so. However, the management company cannot independently impose maintenance fee rates — these must be in accordance with what is provided in the SPA or the applicable regulations under the HDA. The developer (and their appointed manager) holds these funds in trust for the benefit of all parcel owners.',
    significance: 'Clarifies the legal framework for property management during the transitional period before MC formation. Now largely superseded by the Strata Management Act 2013 which introduced the JMB framework with clearer rules. Still relevant for understanding pre-SMA 2013 developments.',
    diagram: { parties: ['Management Company (Appointed by Developer)', 'Parcel Owners (Challenging Fee Collection)'], issue: 'Who has authority to manage strata property before MC is formed?', result: 'Developer has primary obligation. Management company is agent. Funds held on trust for owners.' }
  },
  {
    id: 'case_041', title: 'Loo Ah Kow v Nanyang Development Sdn Bhd', citation: '[1985] 1 MLJ 373',
    topic: 'SPA — Condition Precedent — Title Availability', tags: ['Contract', 'SPA', 'Condition Precedent'],
    facts: 'A purchaser entered into an SPA for the purchase of land subject to the developer obtaining the necessary state authority approval for sub-division of the parent lot. The state approval was not obtained within the stipulated period. The purchaser sought to rescind the SPA and recover all deposits.',
    issue: 'Where an SPA is subject to a condition precedent (state approval for sub-division) that is not fulfilled within the time stipulated, what are the purchaser\'s rights?',
    held: 'Where a condition precedent in an SPA is not fulfilled within the stipulated timeframe, the SPA does not become binding and the purchaser is entitled to the return of all deposits paid. The contract becomes void by reason of the failure of the condition, and no liability attaches to either party (unless one party was obligated to procure the condition and failed to do so through their own fault).',
    significance: 'Important for developer transactions involving sub-division or amalgamation of parent lots. SPAs must be carefully drafted to specify conditions precedent and what happens if they are not met. Purchasers should ensure refund provisions are explicitly stated.',
    diagram: { parties: ['Purchaser (Paid Deposits — Seeks Refund)', 'Developer (Failed to Obtain Sub-division Approval)'], issue: 'What is purchaser\'s right if condition precedent (state approval) is not met?', result: 'SPA void — Purchaser entitled to full refund of all deposits paid.' }
  },
  {
    id: 'case_042', title: 'Perbadanan Kemajuan Negeri Selangor v Pemungut Hasil Tanah, Hulu Langat', citation: '[1991] 3 MLJ 155',
    topic: 'State Authority Land — Immunity and Compulsory Acquisition', tags: ['State Land', 'Compulsory Acquisition', 'State Authority Immunity'],
    facts: 'Land belonging to a State Development Corporation (a state authority body) was acquired under the Land Acquisition Act. The Corporation challenged the acquisition on the ground that land owned by the State (or a state authority) cannot be compulsorily acquired against the state itself.',
    issue: 'Can the Federal Government compulsorily acquire land owned by a State statutory body for a Federal public purpose?',
    held: 'The court held that the Land Acquisition Act 1960 enables the Federal Government to acquire land even if it is owned by a State authority, provided the acquisition is for a public purpose within Federal jurisdiction. State authority land is not immune from compulsory acquisition by the Federal Government.',
    significance: 'Clarifies the interplay between Federal and State powers over land under the Malaysian Federal Constitution. While land is a State matter, the Federal Government retains the power to acquire land (even State authority land) for Federal public purposes. Important for understanding constitutional land law.',
    diagram: { parties: ['State Development Corporation (Land Acquired)', 'Federal Government (Acquiring for Federal Purpose)'], issue: 'Can Federal Government acquire State authority land?', result: 'YES — Federal Government can acquire State authority land for Federal public purposes under Land Acquisition Act.' }
  },
  {
    id: 'case_043', title: 'Malaysia Building Society Bhd v Tan Sri Abdul Khalid bin Ibrahim', citation: '[2015] 8 MLJ 561',
    topic: 'High-Profile Foreclosure — No Special Protection for Status or Position', tags: ['Charge', 'Foreclosure', 'Order for Sale', 'Public Policy'],
    facts: 'The bank held a charge over land owned by a prominent public figure (a former Chief Minister of Selangor). Upon default on the loan, the bank applied for an Order for Sale. The defendant sought to resist the foreclosure, raising various equitable defences and arguments based on his public role.',
    issue: 'Does a person\'s public standing, political position, or prominence provide any basis for resisting or delaying an Order for Sale in foreclosure proceedings?',
    held: 'The court rejected all the defendant\'s defences and granted the Order for Sale. The law of foreclosure applies equally to all persons regardless of their status, position, or public role. Where there has been clear default, the chargee\'s right to an Order for Sale is clear. No special circumstances or equitable considerations arising from the defendant\'s status could defeat this right.',
    significance: 'Establishes that the rule of law applies equally in foreclosure — public figures and officials enjoy no special protection against legitimate foreclosure proceedings. The bank\'s right to enforce its security upon default is paramount. Important for the integrity of the Malaysian credit system.',
    diagram: { parties: ['Bank (Chargee — Applied for Order for Sale)', 'Prominent Defendant (Sought Equitable Protection)'], issue: 'Does prominent public position protect against foreclosure?', result: 'NO — Law applies equally to all. Default entitles bank to Order for Sale regardless of status.' }
  },
  {
    id: 'case_044', title: 'Bukit Lenang Development Sdn Bhd v Dato Abdul Aziz bin Othman', citation: '[2004] 1 MLJ 425',
    topic: 'Developer — Liability for Environmental Damage from Development', tags: ['Developer', 'Negligence', 'Environmental', 'Tort'],
    facts: 'A developer carried out earthworks for a housing project, causing significant damage to neighbouring land through excessive soil runoff, flooding, and alteration of the natural water drainage. The neighbouring landowner suffered damage to his property and sued the developer for negligence and nuisance.',
    issue: 'Is a developer liable in tort (negligence and nuisance) for environmental damage to neighbouring properties caused by earthworks and development activities?',
    held: 'The developer was found liable in both negligence and private nuisance for damage caused to the neighbouring property. A developer owes a duty of care not to carry out construction activities in a manner that unreasonably interferes with the use and enjoyment of neighbouring land. Inadequate erosion control and drainage management causing flooding constitutes an actionable nuisance.',
    significance: 'Expands developer liability to encompass environmental damage to neighbours caused by construction activities. This is particularly relevant in Malaysia given the frequency of hillside and terrain-altering developments. Developers must implement adequate erosion and sediment control measures to avoid liability.',
    diagram: { parties: ['Neighbouring Landowner (Property Damaged by Earthworks)', 'Developer (Caused Soil Runoff & Flooding)'], issue: 'Is developer liable for environmental damage to neighbours from earthworks?', result: 'YES — Developer liable in negligence and nuisance. Must implement adequate erosion controls.' }
  },
  {
    id: 'case_045', title: 'Peel Conglomerate Sdn Bhd v Murugason a/l Ramasamy', citation: '[2001] 3 MLJ 313',
    topic: 'Purchaser Default — Vendor\'s Right to Rescind After Time-of-Essence Notice', tags: ['Contract', 'SPA', 'Default', 'Rescission', 'Forfeiture'],
    facts: 'A purchaser paid 10% deposit and signed the SPA but failed to pay the balance purchase price by the completion date, citing difficulty in obtaining a bank loan. The vendor served a "notice to complete" specifying a final deadline. The purchaser still failed to complete. The vendor rescinded the SPA and forfeited the entire 10% deposit.',
    issue: 'Where the purchaser is in default after a valid "notice to complete," is the vendor entitled to rescind and forfeit the entire deposit? Is the purchaser\'s financial difficulty a valid defence?',
    held: 'The vendor was entitled to rescind the SPA and forfeit the 10% deposit. Time of the essence, once reinstated by the notice to complete, was binding. The purchaser\'s inability to secure financing is NOT a defence to the vendor\'s claim for forfeiture — the risk of financing falls on the purchaser. The 10% forfeiture is a genuine pre-estimate of the vendor\'s loss and is enforceable.',
    significance: 'Reinforces the strict application of time of essence in SPA transactions. Purchasers bear the risk of financing — difficulty obtaining a bank loan does not excuse non-performance. The 10% forfeiture clause is enforceable. This is a key case for practitioners advising purchasers on the risk of failing to complete.',
    diagram: { parties: ['Vendor (Rescinded after Notice to Complete)', 'Purchaser (Failed to Complete — Loan Problem)'], issue: 'Can vendor forfeit 10% deposit after purchaser\'s default?', result: 'YES — Purchaser bears financing risk. 10% forfeiture clause enforceable after valid notice to complete.' }
  },
  {
    id: 'case_046', title: 'Phang Moh Shin v Commissioner of Lands, Sabah', citation: '[1967] 2 MLJ 88',
    topic: 'Alienation of State Land — Applicant\'s Right to Title', tags: ['State Land', 'Alienation', 'NLC', 'Sabah Land Ordinance'],
    facts: 'The plaintiff applied for alienation of State land under the Sabah Land Ordinance. The Commissioner of Lands refused the application without providing adequate reasons. The plaintiff argued that having fulfilled all the requirements, he had a right to have the land alienated to him.',
    issue: 'Does an applicant for alienation of State land have a right to demand that the State Authority grant the alienation if all legal requirements are satisfied?',
    held: 'The court held that the grant of alienation of State land is a matter of grace and not a matter of right. The State Authority has an absolute discretion whether to grant or refuse an application for alienation of State land. Even if all procedural requirements are met, the applicant has no legal right to insist on alienation being granted.',
    significance: 'Establishes the fundamental principle that State land belongs absolutely to the State and its alienation is a sovereign discretion. No person has a right to demand State land. This principle underpins Malaysia\'s entire land tenure system and the concept of "bumi lots" and land allocation policies.',
    diagram: { parties: ['Applicant (Applied for State Land Alienation)', 'Commissioner of Lands (Refused Application)'], issue: 'Does applicant have a legal right to alienation of State land?', result: 'NO — Alienation of State land is an absolute discretion of the State. No legal right to demand it.' }
  },
  {
    id: 'case_047', title: 'Yew Lean Finance Development (M) Sdn Bhd v Director of Forests, Sarawak', citation: '[1976] 2 MLJ 229',
    topic: 'Forest Reserve Land — Dealings and Third Party Rights', tags: ['Forest Reserve', 'State Land', 'Public Land'],
    facts: 'A company claimed rights to timber on land that had been declared a Forest Reserve under the Sarawak Forest Ordinance. The company argued it had pre-existing contractual rights over the timber that should be respected even after the Forest Reserve declaration.',
    issue: 'Do private contractual rights to timber survive a government declaration of a Forest Reserve over the same land?',
    held: 'Once land is gazetted as a Forest Reserve under the relevant Forest Ordinance, the State\'s rights over the land and its natural resources are paramount. Private contractual rights to timber that existed prior to the declaration do not automatically survive the Forest Reserve declaration, unless expressly preserved. The declaration overrides pre-existing private arrangements.',
    significance: 'Important for understanding the legal effect of State land status declarations in Malaysia. Government declarations of Forest Reserves, wildlife reserves, or other public land status can extinguish prior private rights (subject to compensation under the relevant statutes). Critical for due diligence on land near gazetted reserves.',
    diagram: { parties: ['Company (Pre-existing Timber Rights Claimed)', 'Director of Forests (Forest Reserve Declared)'], issue: 'Do private timber rights survive a Forest Reserve declaration?', result: 'NO — Forest Reserve declaration overrides prior private rights (unless expressly preserved).' }
  },
  {
    id: 'case_048', title: 'Auto Dunia Sdn Bhd v Hj Hafsah binti Elias', citation: '[2010] 8 MLJ 485',
    topic: 'HDA Application — Commercial/SOHO Properties', tags: ['HDA', 'Developer', 'SOHO', 'Consumer Protection'],
    facts: 'A developer sold a "SOHO" (Small Office Home Office) unit to the purchaser, describing it in marketing materials as suitable for residential use. When the purchaser claimed LAD under HDA Schedule H for late delivery of VP, the developer argued the HDA did not apply as the unit was commercially classified.',
    issue: 'Does the Housing Development Act 1966 apply to SOHO units that are commercially classified but marketed for residential use?',
    held: 'The court held that the HDA applies based on the substance of the transaction, not merely the commercial classification of the property. Where a unit is marketed and sold primarily for residential occupation, the purchaser is entitled to the protections of the HDA (including LAD provisions) regardless of the commercial classification. The developer could not avoid HDA obligations by labelling a de facto residential unit as "commercial."',
    significance: 'Landmark case expanding HDA consumer protection to SOHO and similar "commercial" properties marketed for residential use. Developers cannot avoid LAD obligations by reclassifying residential-type units as commercial. Important for purchasers of dual-category properties (SOHO, serviced apartments) to understand their HDA rights.',
    diagram: { parties: ['Purchaser (Claimed HDA Protection for SOHO Unit)', 'Developer (Argued HDA Not Applicable — Commercial)'], issue: 'Does HDA protect purchasers of SOHO/commercial-classified but residentially-marketed units?', result: 'YES — HDA applies based on substance (residential use), not commercial classification.' }
  },
  {
    id: 'case_049', title: 'Ng Bok Eng Holdings Sdn Bhd v Wong Chong Yue', citation: '[2011] 5 MLJ 785',
    topic: 'Registered Title — Burden on Claimant to Prove Fraud', tags: ['Indefeasibility', 'Fraud', 'NLC s.340', 'Burden of Proof'],
    facts: 'A plaintiff sought to defeat the registered title of the defendant on the ground that the defendant\'s registration was tainted by fraud. The plaintiff alleged circumstantial evidence of fraudulent conduct. The defendant maintained his title was obtained in good faith.',
    issue: 'Who bears the burden of proving fraud in a claim to defeat registered title under s.340(2) NLC? What standard of proof is required?',
    held: 'The burden of proving fraud lies on the party alleging it (the claimant seeking to defeat the registered title). The standard of proof is on a balance of probabilities, but given the gravity of the allegation, clear and cogent evidence of actual fraud is required. Suspicion, circumstantial evidence, or proof of negligence is insufficient to establish fraud.',
    significance: 'Confirms that a claimant who alleges fraud to defeat a registered title faces a heavy evidentiary burden. The registered proprietor enjoys the presumption of the correctness of the register under the Torrens system. Fraud must be proved clearly — not merely suspected. This protects bona fide purchasers from speculative fraud allegations.',
    diagram: { parties: ['Claimant (Alleging Fraud to Defeat Title)', 'Registered Proprietor (Claiming Indefeasibility)'], issue: 'Who bears the burden of proving fraud to defeat registered title?', result: 'CLAIMANT bears burden. Must prove actual fraud by clear, cogent evidence — not just suspicion.' }
  },
  {
    id: 'case_050', title: 'Universiti Malaya v Lim Weng Seng & Ors', citation: '[1977] 1 MLJ 53',
    topic: 'Easement — Right of Way Over Land', tags: ['Easement', 'Right of Way', 'NLC', 'Access'],
    facts: 'The plaintiff (Universiti Malaya) claimed an easement of right of way over the defendants\' land to access its buildings. The defendants disputed the existence of the easement, arguing it was not registered on their title. The plaintiff relied on long usage and necessity.',
    issue: 'How is an easement of right of way created and protected in Malaysia? Is registration necessary?',
    held: 'The court held that easements in Malaysia can be created by express grant (registered), implied grant, or prescription (long usage). Under the NLC, easements should be registered to be fully effective as legal easements. However, in cases of necessity (e.g. land-locked access), the court may recognise an implied easement even without registration. Long usage alone (prescription at common law) is more difficult to establish under the Torrens system.',
    significance: 'Clarifies the law of easements in Malaysia, which differs from English common law due to the Torrens system. Practitioners must register express easements to give them legal effect. Implied easements of necessity may be recognised by courts even without registration, but this is fact-specific. Access rights should always be verified in title searches.',
    diagram: { parties: ['Universiti Malaya (Claimed Right of Way)', 'Neighbouring Landowner (Disputed Easement)'], issue: 'Can an unregistered easement of right of way be enforced?', result: 'DEPENDS — Registered easement is strongest. Courts may imply easement of necessity even without registration.' }
  },
  // ─── STAMP DUTY & TAXATION ──────────────────────────────────────────────
  {
    id: 'case_051', title: 'Lembaga Hasil Dalam Negeri v Petronas Carigali Sdn Bhd', citation: '[2009] 4 MLJ 505',
    topic: 'Stamp Duty — Adequacy of Consideration', tags: ['Stamp Duty', 'Market Value', 'Adjudication'],
    facts: 'A transfer of property between related companies was stamped at the stated consideration. The Stamp Office challenged the adequacy of the consideration, contending the stamp duty should be based on the market value which exceeded the stated price.',
    issue: 'Can the Stamp Office assess stamp duty based on market value rather than the stated consideration in a transfer instrument?',
    held: 'The court held that under the Stamp Act 1949, the Collector of Stamp Duties has the power to assess duty based on the market value of the property where the consideration stated in the instrument appears inadequate. This is particularly applicable in related-party transactions.',
    significance: 'Confirms the Stamp Office\'s power to override stated consideration and assess duty on market value. Practitioners must ensure adequate consideration in transfers, especially between related parties, or seek adjudication to avoid penalties.',
    diagram: { parties: ['Transferor (Related Company)', 'Transferee (Related Company)'], issue: 'Can Stamp Office assess duty on market value, not stated price?', result: 'YES — Stamp Office can assess on market value where consideration appears inadequate.' }
  },
  {
    id: 'case_052', title: 'Aspatra Sdn Bhd v Bank Bumiputra Malaysia Bhd', citation: '[1988] 1 MLJ 97',
    topic: 'Charge — Rights of Chargee Upon Default', tags: ['Charge', 'Default', 'NLC', 'Power of Sale'],
    facts: 'The chargor defaulted on loan repayments. The chargee bank sought to exercise its power of sale under the charge instrument and the NLC. The chargor challenged the exercise of power, arguing procedural irregularities.',
    issue: 'What are the procedural requirements for a chargee to exercise its power of sale upon default under the NLC?',
    held: 'The court held that strict compliance with NLC provisions (ss.254-263) is required before a chargee can exercise its power of sale. The chargee must serve the Form 16D notice, allow the redemption period to expire, and obtain a court order for sale if the chargor does not voluntarily surrender possession.',
    significance: 'Established that procedural compliance under the NLC is mandatory, not discretionary. Any irregularity in the foreclosure process can invalidate the sale. Banks and practitioners must follow every step meticulously.',
    diagram: { parties: ['Chargor (Defaulting Borrower)', 'Chargee Bank (Seeking Power of Sale)'], issue: 'Must chargee strictly comply with NLC foreclosure procedure?', result: 'YES — Strict compliance with ss.254-263 NLC is mandatory.' }
  },
  // ─── HOUSING DEVELOPMENT ───────────────────────────────────────────────
  {
    id: 'case_053', title: 'Ang Ming Lee & Ors v Menteri Kesejahteraan Bandar, Perumahan dan Kerajaan Tempatan', citation: '[2020] 1 MLJ 281',
    topic: 'HDA — Late Delivery & Liquidated Damages', tags: ['HDA', 'LAD', 'Late Delivery', 'VP'],
    facts: 'Purchasers of housing units from a licensed developer sued for liquidated ascertained damages (LAD) for late delivery of vacant possession beyond the 36-month period stipulated in Schedule H of the HDA. The developer argued that extension of time should be granted.',
    issue: 'Are purchasers entitled to LAD for late delivery of vacant possession under Schedule H of the HDA?',
    held: 'The Federal Court held that the HDA provisions on LAD are mandatory and designed to protect purchasers. The statutory SPA under Schedule H prescribes 36 months for delivery of VP (strata), and the developer cannot contract out of the LAD provisions. The court upheld the purchasers\' entitlement to LAD at 10% per annum on the purchase price from the date of default.',
    significance: 'Landmark decision affirming that HDA LAD provisions are non-negotiable statutory protections for purchasers. Developers cannot circumvent LAD through extension of time or contractual modifications. The 10% per annum rate is a statutory minimum.',
    diagram: { parties: ['Purchasers (Seeking LAD for Late VP)', 'Developer (Seeking Extension of Time)'], issue: 'Can developer avoid LAD for late delivery?', result: 'NO — HDA LAD provisions are mandatory. 10% p.a. LAD payable from date of default.' }
  },
  {
    id: 'case_054', title: 'Sentul Raya Sdn Bhd v Hariram Jayaram & Ors', citation: '[2008] 4 MLJ 852',
    topic: 'HDA — Defective Workmanship & Developer\'s Liability', tags: ['HDA', 'Defects', 'DLP', 'Developer'],
    facts: 'Purchasers discovered serious defects in their housing units within the 24-month defect liability period. The developer refused to rectify the defects, arguing they were minor and cosmetic. The purchasers brought action under the HDA.',
    issue: 'What is the scope of a developer\'s obligation to rectify defects during the defect liability period under the HDA?',
    held: 'The court held that the developer\'s obligation under the HDA extends to all defects, not just structural ones. The 24-month defect liability period places an absolute obligation on the developer to rectify at its own cost any defect, shrinkage or other fault that becomes apparent during that period, whether structural, mechanical, or cosmetic.',
    significance: 'Confirms the broad scope of developer liability during the DLP under the HDA. Purchasers are entitled to have all defects rectified, including cosmetic issues. Developers cannot limit their liability to structural defects only.',
    diagram: { parties: ['Purchasers (Reporting Defects)', 'Developer (Refusing Rectification)'], issue: 'Must developer fix ALL defects during DLP?', result: 'YES — Developer must rectify all defects during 24-month DLP, not just structural.' }
  },
  // ─── TRUST & BENEFICIAL INTEREST ────────────────────────────────────────
  {
    id: 'case_055', title: 'Syed Ali Redha Alsagoff v Syed Salim Alhadad bin Syed Ahmad Alhadad', citation: '[1996] 3 MLJ 237',
    topic: 'Trust — Beneficial Interest in Land', tags: ['Trust', 'Beneficial Interest', 'NLC', 'Equity'],
    facts: 'Property was registered in the name of one family member but another claimed beneficial interest based on an oral agreement and contribution to the purchase price. The registered proprietor denied the existence of any trust.',
    issue: 'Can a resulting or constructive trust be imposed on registered land under the NLC to recognise the beneficial interest of a non-registered party?',
    held: 'The court held that equitable principles of resulting and constructive trusts can operate alongside the NLC. Where a party can prove contribution to the purchase price or an agreement giving rise to a constructive trust, the court will recognise their beneficial interest even though it is not registered on the title.',
    significance: 'Affirms that equity operates alongside the NLC. Trusts over land can exist outside the register. However, the burden of proof on the claimant is heavy. Practitioners should always register interests to avoid disputes. Caveat protection is advisable.',
    diagram: { parties: ['Claimant (Alleged Beneficial Owner)', 'Registered Proprietor (Denying Trust)'], issue: 'Can equity impose a trust on registered land?', result: 'YES — Resulting/constructive trusts can operate alongside NLC.' }
  },
  // ─── POWER OF ATTORNEY ──────────────────────────────────────────────────
  {
    id: 'case_056', title: 'Wong Kup Sing v Dubon Bhd', citation: '[2003] 7 MLJ 1',
    topic: 'Power of Attorney — Validity in Land Dealings', tags: ['Power of Attorney', 'NLC', 'Transfer'],
    facts: 'A transfer of land was executed by an attorney under a power of attorney. The validity of the power of attorney and the attorney\'s authority to transfer the land were challenged by third parties who claimed interest in the property.',
    issue: 'What are the requirements for a valid power of attorney to effect land dealings under the NLC?',
    held: 'The court held that a power of attorney used for land dealings must be registered under the Powers of Attorney Act 1949 and comply with the NLC requirements. The power must specifically authorise the type of dealing being effected. A general power may not suffice for specific land transactions such as transfers or charges.',
    significance: 'Clarifies the requirements for powers of attorney in conveyancing. Practitioners must ensure the PA is properly registered, specifically authorises the land dealing in question, and has not been revoked. Failure to comply can invalidate the transaction.',
    diagram: { parties: ['Attorney (Acting Under PA)', 'Third Party (Challenging Authority)'], issue: 'What makes a PA valid for land dealings?', result: 'PA must be registered, specifically authorise the dealing, and not be revoked.' }
  },
  // ─── BANKRUPTCY & LAND ──────────────────────────────────────────────────
  {
    id: 'case_057', title: 'Malayan Banking Bhd v Focal Finance Sdn Bhd', citation: '[1998] 3 MLJ 311',
    topic: 'Bankruptcy — Effect on Land Transactions', tags: ['Bankruptcy', 'Land', 'Transfer', 'Void'],
    facts: 'A debtor transferred land after a bankruptcy petition had been filed against him but before the receiving order was made. The trustee in bankruptcy sought to set aside the transfer as a fraud on creditors.',
    issue: 'Is a transfer of land made after filing of a bankruptcy petition but before the receiving order valid?',
    held: 'The court held that under the Bankruptcy Act, any disposition of property made between the presentation of a bankruptcy petition and the making of a receiving order is void unless the court otherwise orders. The transfer was set aside, and the land reverted to the bankrupt\'s estate for distribution to creditors.',
    significance: 'Critical for conveyancing practitioners who must conduct bankruptcy searches on all parties before completing transactions. A disposition after the bankruptcy petition filing date is void. Searches must be current at the date of completion.',
    diagram: { parties: ['Bankrupt (Transferred Land After Petition)', 'Trustee in Bankruptcy (Seeking to Recover)'], issue: 'Is a transfer made after bankruptcy petition filing valid?', result: 'NO — Transfer is VOID. Land reverts to bankrupt\'s estate.' }
  },
  // ─── LEASEHOLD ──────────────────────────────────────────────────────────
  {
    id: 'case_058', title: 'Menteri Besar Negeri Sembilan v Pentadbir Tanah Daerah Tampin', citation: '[2006] 4 MLJ 428',
    topic: 'Leasehold — Extension & Renewal', tags: ['Leasehold', 'Extension', 'State Authority', 'NLC'],
    facts: 'A leasehold title was approaching expiry. The registered proprietor applied for extension of the lease. The State Authority imposed new conditions and a premium for the extension. The proprietor challenged the premium amount and the new conditions.',
    issue: 'What is the process for extending a leasehold title, and can the State Authority impose new conditions and premiums?',
    held: 'The court held that extension of a lease is at the discretion of the State Authority. The State Authority may impose new conditions, revised categories of land use, and require payment of a premium for the extension. The proprietor has no automatic right to extension on the same terms.',
    significance: 'Important for practitioners advising clients purchasing leasehold properties, especially those with short unexpired terms. The uncertainty of lease extension, potential new conditions, and premium payments are material risks that must be disclosed to purchasers.',
    diagram: { parties: ['Proprietor (Seeking Lease Extension)', 'State Authority (Imposing New Terms)'], issue: 'Does proprietor have right to renew lease on same terms?', result: 'NO — Extension is discretionary. State may impose new conditions and premium.' }
  },
  // ─── DEVELOPER OBLIGATIONS ──────────────────────────────────────────────
  {
    id: 'case_059', title: 'Tribunal Tuntutan Pembeli Rumah v Westcourt Corporation Sdn Bhd', citation: '[2004] 1 MLJ 141',
    topic: 'Tribunal for Homebuyer Claims — Jurisdiction', tags: ['HDA', 'Tribunal', 'Homebuyer', 'Jurisdiction'],
    facts: 'A homebuyer filed a claim with the Tribunal for Homebuyer Claims against the developer for defects and late delivery. The developer challenged the Tribunal\'s jurisdiction, arguing that the claims should be brought in the High Court.',
    issue: 'Does the Tribunal for Homebuyer Claims have jurisdiction to hear claims for defects and late delivery against housing developers?',
    held: 'The court upheld the Tribunal\'s jurisdiction. The Tribunal was established under the HDA specifically to provide homebuyers with a quick, cheap, and accessible forum to resolve disputes with developers. Its jurisdiction covers claims arising under the statutory SPA, including defects, late delivery, and LAD claims up to the prescribed monetary limit.',
    significance: 'Affirms the Tribunal as a viable alternative to court proceedings for homebuyers. Claims can be resolved faster and cheaper. Practitioners should advise clients of this option, especially for smaller claims.',
    diagram: { parties: ['Homebuyer (Filing Tribunal Claim)', 'Developer (Challenging Jurisdiction)'], issue: 'Can Tribunal hear homebuyer disputes?', result: 'YES — Tribunal has jurisdiction for HDA claims including defects and LAD.' }
  },
  // ─── FOREIGN PURCHASERS ─────────────────────────────────────────────────
  {
    id: 'case_060', title: 'Collector of Stamp Duties v Arumugam Pillai', citation: '[1975] 2 MLJ 87',
    topic: 'Foreign Purchaser — State Authority Consent', tags: ['Foreign Purchaser', 'State Consent', 'NLC', 'Restriction'],
    facts: 'A non-citizen sought to acquire land in Malaysia. The transfer was presented for registration without obtaining prior consent from the State Authority. The Registrar refused registration, and the purchaser challenged this refusal.',
    issue: 'Is State Authority consent required for a foreign national to acquire land in Malaysia, and what happens if consent is not obtained?',
    held: 'The court held that under the NLC and various state enactments, foreign nationals must obtain State Authority consent before acquiring land. The transfer cannot be registered without this consent. Additionally, minimum purchase price thresholds apply in most states for foreign purchasers.',
    significance: 'Fundamental case for practitioners handling transactions involving foreign purchasers. State Authority consent is a condition precedent that must be obtained before completion. The SPA should include a condition precedent clause for consent, with provisions for extension of time and refund if consent is refused.',
    diagram: { parties: ['Foreign Purchaser (Seeking to Acquire)', 'State Authority (Consent Required)'], issue: 'Can foreigner buy land without State consent?', result: 'NO — State Authority consent is mandatory. Transfer unregistrable without it.' }
  },
  // ─── JOINT TENANCY ──────────────────────────────────────────────────────
  {
    id: 'case_061', title: 'Lee Ing Chin @ Lee Teck Seng v Gan Yook Chin & Anor', citation: '[2003] 2 MLJ 97',
    topic: 'Joint Tenancy — Severance & Partition', tags: ['Joint Tenancy', 'Severance', 'Partition', 'NLC'],
    facts: 'A married couple held property as joint tenants. Upon divorce, one party sought severance of the joint tenancy and partition of the property. The other party argued that severance required mutual consent.',
    issue: 'Can a joint tenancy be severed unilaterally, and what are the methods of severance under the NLC?',
    held: 'The court held that a joint tenancy can be severed by: (1) mutual agreement; (2) a course of dealing between the parties showing an intention to sever; (3) by partition order of the court under the NLC. Unilateral action such as filing a caveat or a unilateral declaration is insufficient to sever a joint tenancy.',
    significance: 'Important for family law and conveyancing intersections. Practitioners advising divorcing couples must understand that severance of joint tenancy requires specific steps. A caveat alone does not sever. Court partition may be necessary.',
    diagram: { parties: ['Joint Tenant A (Seeking Severance)', 'Joint Tenant B (Opposing Severance)'], issue: 'Can joint tenancy be severed unilaterally?', result: 'NO — Requires mutual agreement, course of dealing, or court partition order.' }
  },
  // ─── RESCISSION OF CONTRACT ─────────────────────────────────────────────
  {
    id: 'case_062', title: 'Tindok Besar Estate Sdn Bhd v Tinjar Co', citation: '[1979] 2 MLJ 229',
    topic: 'Rescission — Breach of SPA', tags: ['Rescission', 'Contract', 'SPA', 'Breach'],
    facts: 'The vendor failed to perform its obligations under the SPA within the stipulated time. The purchaser sought to rescind the contract and recover the deposit. The vendor argued that time was not of the essence and sought further time to perform.',
    issue: 'When is a purchaser entitled to rescind the SPA and recover the deposit for vendor\'s breach?',
    held: 'The court held that where time is of the essence of the contract (either expressly stated or by notice making time of the essence), the vendor\'s failure to perform within the stipulated period entitles the purchaser to rescind. The purchaser may recover the deposit in full together with interest.',
    significance: 'Establishes that practitioners must carefully draft time of the essence clauses in the SPA. If time is not expressly of the essence, a party must serve notice making time of the essence before claiming breach. Deposit recovery is available upon valid rescission.',
    diagram: { parties: ['Purchaser (Seeking Rescission)', 'Vendor (Failed to Perform)'], issue: 'Can purchaser rescind SPA for vendor delay?', result: 'YES — If time is of the essence (by clause or notice), purchaser may rescind and recover deposit.' }
  },
  // ─── VALUATION & MARKET VALUE ───────────────────────────────────────────
  {
    id: 'case_063', title: 'Nanyang Manufacturing Sdn Bhd v Collector of Land Revenue', citation: '[1979] 1 MLJ 169',
    topic: 'Compulsory Acquisition — Adequate Compensation', tags: ['Compulsory Acquisition', 'Compensation', 'Land Acquisition Act'],
    facts: 'The government compulsorily acquired industrial land for a public purpose. The landowner disputed the compensation amount, arguing it was below market value. The Collector offered compensation based on a government valuation that the landowner contested.',
    issue: 'How should compensation for compulsory land acquisition be assessed, and what constitutes "adequate compensation" under the Land Acquisition Act?',
    held: 'The court held that compensation must be based on the market value of the land at the date of the notification under s.8 of the Land Acquisition Act 1960. Market value is the price a willing seller would obtain from a willing buyer in the open market. All relevant factors including potential development value, location, and comparable sales must be considered.',
    significance: 'Establishes principles for valuation in compulsory acquisition cases. Landowners are entitled to full market value compensation, not government-assessed values. Expert valuation evidence is admissible and often essential.',
    diagram: { parties: ['Landowner (Disputing Compensation)', 'Government (Compulsory Acquisition)'], issue: 'What is adequate compensation for compulsory acquisition?', result: 'Market value at date of s.8 notification. Willing seller to willing buyer standard.' }
  },
  // ─── STRATA MANAGEMENT ──────────────────────────────────────────────────
  {
    id: 'case_064', title: 'JMB Pelangi Utama Management Corp v Kerajaan Malaysia', citation: '[2014] 6 MLJ 583',
    topic: 'Strata — Management Corporation Obligations', tags: ['Strata', 'Management Corporation', 'SMA 2013', 'Maintenance'],
    facts: 'The Management Corporation (MC) of a strata scheme sought a declaration of its rights and obligations under the Strata Management Act 2013. Various parcel owners had defaulted on maintenance charges and the MC needed to enforce collection.',
    issue: 'What powers does the MC have to enforce collection of maintenance charges from defaulting parcel owners?',
    held: 'The court held that under the Strata Management Act 2013, the MC has extensive powers to recover outstanding maintenance charges including: filing claims in the Strata Management Tribunal, registering a charge on the defaulting parcel, and restricting transfer of the parcel until arrears are cleared. The MC may also impose interest on late payments.',
    significance: 'Critical for strata conveyancing. Purchasers must verify outstanding maintenance and sinking fund arrears before completion. The MC\'s charge on the parcel is a real encumbrance that must be discharged for transfer.',
    diagram: { parties: ['Management Corporation (Enforcing Payment)', 'Defaulting Parcel Owner (Arrears)'], issue: 'How can MC enforce maintenance charge collection?', result: 'MC can file Tribunal claims, register charge on parcel, and restrict transfers.' }
  },
  // ─── FORFEITURE ─────────────────────────────────────────────────────────
  {
    id: 'case_065', title: 'Kong Lai Chan v Pentadbir Tanah Johor Bahru', citation: '[2012] 5 MLJ 227',
    topic: 'Forfeiture — Breach of Express Conditions', tags: ['Forfeiture', 'Express Conditions', 'NLC', 'State Authority'],
    facts: 'Land was alienated subject to an express condition requiring agricultural use. The registered proprietor built structures on the land without obtaining approval for change of land use. The State Authority issued a notice of breach of condition and commenced forfeiture proceedings.',
    issue: 'Can the State Authority forfeit land for breach of express conditions imposed on the title?',
    held: 'The court held that the State Authority has power under the NLC to forfeit land for breach of express conditions. However, the State Authority must follow proper procedures: serve notice of breach (s.128), allow a reasonable period for compliance or showing cause, and consider representations before making the forfeiture order. The proprietor has a right of appeal to the court.',
    significance: 'Practitioners must advise clients about express conditions on their titles and the risk of forfeiture for non-compliance. Change of land use requires State Authority approval. Forfeiture is a drastic remedy but available for serious breaches.',
    diagram: { parties: ['Registered Proprietor (Breached Express Condition)', 'State Authority (Forfeiture Proceedings)'], issue: 'Can State forfeit land for breach of express conditions?', result: 'YES — After proper notice and procedure under NLC. Proprietor has right of appeal.' }
  },
  // ─── NOMINEE PURCHASES ─────────────────────────────────────────────────
  {
    id: 'case_066', title: 'Chung Khiaw Bank Ltd v Hotel Rasa Sayang Sdn Bhd', citation: '[1990] 1 MLJ 356',
    topic: 'Nominee Purchase — Trust Arrangement', tags: ['Nominee', 'Trust', 'Beneficial Interest', 'NLC'],
    facts: 'Property was purchased in the name of a nominee for the benefit of the actual purchaser. The nominee subsequently attempted to deal with the property as if it were their own, including charging it to a bank. The beneficial owner challenged the charge.',
    issue: 'What are the rights of a beneficial owner when a nominee deals with the property without authority?',
    held: 'The court held that a nominee holds property on trust for the beneficial owner. Any dealing by the nominee without the beneficial owner\'s consent is a breach of trust. However, if a third party (such as a bank) deals with the registered nominee in good faith and for value without notice of the trust, the third party\'s interest may be protected under the NLC.',
    significance: 'Highlights the risks of nominee arrangements. Beneficial owners should protect their interests with caveats. Without caveat protection, a bona fide third party dealing with the registered nominee may obtain priority over the beneficial owner\'s interest.',
    diagram: { parties: ['Beneficial Owner (Unregistered Interest)', 'Nominee (Dealing Without Authority)', 'Bank (Bona Fide Chargee)'], issue: 'Can beneficial owner defeat nominee\'s unauthorised dealing?', result: 'DEPENDS — Beneficial owner needs caveat protection. BFP without notice may prevail.' }
  },
  // ─── VENDOR\'S LIEN ──────────────────────────────────────────────────────
  {
    id: 'case_067', title: 'Chua Boon Chye v Oversea-Chinese Banking Corp Ltd', citation: '[1991] 1 MLJ 201',
    topic: 'Vendor\'s Lien — Unpaid Purchase Price', tags: ['Vendor\'s Lien', 'Unpaid Price', 'NLC', 'Priority'],
    facts: 'A vendor transferred land to a purchaser but the full purchase price was not paid. The vendor claimed a vendor\'s lien over the land for the unpaid balance. The purchaser subsequently charged the land to a bank which claimed priority.',
    issue: 'Does a vendor retain a lien over transferred land for the unpaid purchase price, and does such lien have priority over a subsequent charge?',
    held: 'The court held that under the NLC and the Torrens system, an unregistered vendor\'s lien does not prevail against a registered charge created in good faith and for value. The vendor should have protected his interest by retaining the title until full payment, or by entering a caveat. The vendor\'s equitable lien is defeated by the bank\'s registered charge.',
    significance: 'Critical lesson for practitioners: never transfer title before receiving full payment. If partial transfer is necessary, protect the vendor\'s interest with a caveat or contractual mechanism. The NLC\'s registration principle means unregistered interests lose to registered ones.',
    diagram: { parties: ['Vendor (Unpaid Balance)', 'Purchaser (Title Transferred)', 'Bank (Registered Charge)'], issue: 'Does vendor\'s lien for unpaid price beat registered charge?', result: 'NO — Unregistered vendor\'s lien loses to registered BFP charge.' }
  },
  // ─── OPTION TO PURCHASE ─────────────────────────────────────────────────
  {
    id: 'case_068', title: 'Karuppannan v Balakrishnen', citation: '[1994] 3 MLJ 584',
    topic: 'Option Agreement — Enforceability', tags: ['Option', 'Contract', 'SPA', 'Enforceability'],
    facts: 'An option to purchase land was granted in exchange for option money. The grantor of the option subsequently refused to sell and attempted to return the option money. The option holder sought specific performance of the option agreement.',
    issue: 'Is an option to purchase land enforceable by specific performance if the grantor refuses to complete?',
    held: 'The court held that a properly drafted option to purchase constitutes an irrevocable offer that, once exercised, creates a binding contract for the sale and purchase of land. The grantor cannot unilaterally revoke the option during the option period. Once exercised, specific performance may be ordered.',
    significance: 'Practitioners must carefully draft option agreements specifying the option period, option money, purchase price, and conditions for exercise. A valid option that is properly exercised creates a binding SPA. The option money is typically credited towards the purchase price.',
    diagram: { parties: ['Option Holder (Exercised Option)', 'Grantor (Refusing to Sell)'], issue: 'Is exercised option to purchase enforceable?', result: 'YES — Exercised option creates binding contract. Specific performance available.' }
  },
  // ─── ORANG ASLI LAND RIGHTS ─────────────────────────────────────────────
  {
    id: 'case_069', title: 'Daiman Development Sdn Bhd v Mathew Lu Chin Kai', citation: '[1983] 2 MLJ 68',
    topic: 'Developer — Duty to Deliver Good Title', tags: ['Developer', 'Title', 'SPA', 'Obligation'],
    facts: 'A developer sold units in a housing project but failed to deliver individual titles to the purchasers within the stipulated timeframe. Purchasers had made full payment but could not register the properties in their names due to the developer\'s failure to subdivide the master title.',
    issue: 'What is a developer\'s obligation to deliver individual titles, and what remedies are available to purchasers?',
    held: 'The court held that the developer has an implied obligation under the SPA and the HDA to take all necessary steps to obtain subdivision of the master title and deliver individual titles to purchasers. Failure to do so entitles purchasers to damages and, in appropriate cases, specific performance.',
    significance: 'Confirms that title delivery is a fundamental developer obligation. Practitioners must advise purchasers of the risks of delayed title issuance, especially in older developments. The SPA should contain specific timelines and remedies for title delivery.',
    diagram: { parties: ['Purchasers (Demanding Individual Titles)', 'Developer (Failed to Subdivide)'], issue: 'Must developer deliver individual titles to purchasers?', result: 'YES — Implied obligation under SPA and HDA. Purchasers entitled to damages or specific performance.' }
  },
  // ─── STRATA TITLE APPLICATION ───────────────────────────────────────────
  {
    id: 'case_070', title: 'Sri Damansara Sdn Bhd v Tribunal Tuntutan Pembeli Rumah', citation: '[2013] 2 MLJ 747',
    topic: 'Developer\'s Obligation — Strata Title Application', tags: ['Strata Title', 'Developer', 'HDA', 'Obligation'],
    facts: 'A developer completed a stratified development but failed to apply for strata titles for the individual parcels within the stipulated timeframe under the STA. Purchasers complained to the Tribunal, seeking an order compelling the developer to apply for strata titles.',
    issue: 'Is a developer obligated to apply for strata titles and what is the consequence of failure to do so?',
    held: 'The court held that under s.8 of the Strata Titles Act 1985 (as amended), a developer of a stratified building must apply for strata titles within the prescribed period. Failure to do so is an offence under the STA and the developer can be compelled by court order to make the application. The developer cannot charge purchasers additional fees for the strata title application.',
    significance: 'Practitioners must advise purchasers of strata properties to verify the strata title status. Late strata title application is a common issue that delays transfers and charges. The SPA should include provisions requiring the developer to apply within the statutory timeframe.',
    diagram: { parties: ['Purchasers (Demanding Strata Titles)', 'Developer (Failed to Apply)'], issue: 'Must developer apply for strata titles?', result: 'YES — Mandatory under STA s.8. Failure is an offence. Cannot charge extra fees.' }
  },
  // ─── ISLAMIC FINANCE & CONVEYANCING ─────────────────────────────────────
  {
    id: 'case_071', title: 'Bank Islam Malaysia Bhd v Lim Kok Hoe & Anor', citation: '[2009] 6 MLJ 839',
    topic: 'Islamic Finance — BBA Validity', tags: ['Islamic Finance', 'BBA', 'Shariah', 'Federal Court'],
    facts: 'The respondents obtained Bay\' Bithaman Ajil (BBA) home financing from the bank. Upon default, the bank sought to recover the full sale price (RM575,000 for a property valued at RM285,000). The respondents challenged the BBA sale price as unconscionable.',
    issue: 'Is the BBA sale price enforceable when it is significantly higher than the market value of the property?',
    held: 'The Federal Court held that while the BBA facility is valid under Islamic law, the sale price must not be unconscionable. Upon early termination, the bank should apply ibra\' (rebate) to reduce the outstanding amount to a fair figure that does not exceed the conventional equivalent. The bank cannot claim the full deferred sale price upon early default.',
    significance: 'Landmark case establishing that Islamic financing products must be fair and not result in unjust enrichment. The ibra\' principle operates to ensure the customer is not penalised excessively upon early termination. Conveyancing lawyers must understand these financing structures.',
    diagram: { parties: ['Borrower (BBA Customer)', 'Islamic Bank (Seeking Full Sale Price)'], issue: 'Can bank claim full BBA sale price upon default?', result: 'NO — Ibra\' (rebate) must be applied. Sale price must not be unconscionable.' }
  },
  {
    id: 'case_072', title: 'Affin Bank Bhd v Zulkifli bin Abdullah', citation: '[2006] 3 MLJ 67',
    topic: 'Charge — Form 16A & Statutory Requirements', tags: ['Charge', 'Form 16A', 'NLC', 'Registration'],
    facts: 'A charge was executed on Form 16A but contained errors in the description of the land and the loan amount. The bank presented the charge for registration. The Land Registrar refused registration due to the discrepancies.',
    issue: 'What happens when a Form 16A charge contains errors? Can it still be registered?',
    held: 'The court held that the NLC requires strict compliance with statutory forms. Errors in the material particulars of a Form 16A (land description, parties, secured amount) render the instrument defective and the Registrar is justified in refusing registration. The instrument must be corrected and re-presented.',
    significance: 'Reinforces the importance of accuracy in statutory instruments. Practitioners must verify all details in Form 16A against the title and loan agreement before execution and presentment. Errors cause delays and may require re-execution.',
    diagram: { parties: ['Bank (Presenting Defective Charge)', 'Land Registrar (Refusing Registration)'], issue: 'Can a defective Form 16A be registered?', result: 'NO — Strict compliance required. Must correct and re-present.' }
  },
  // ─── COMPULSORY ACQUISITION ─────────────────────────────────────────────
  {
    id: 'case_073', title: 'Pemungut Hasil Tanah, Daerah Barat Daya v Ong Gaik Kee', citation: '[1983] 2 MLJ 35',
    topic: 'Compulsory Acquisition — Expert Valuation', tags: ['Land Acquisition', 'Compensation', 'Valuation', 'Expert Evidence'],
    facts: 'Land was compulsorily acquired and the Collector\'s Award of compensation was challenged as inadequate. The landowner engaged independent expert valuers who assessed the land at a significantly higher value than the Collector\'s assessment.',
    issue: 'Should the court prefer independent expert valuations or government-assessed values when determining adequate compensation?',
    held: 'The court held that independent expert evidence is admissible and should be given due weight. The court is not bound by the Collector\'s valuation and may increase the Award based on expert evidence of market value. The burden of proving inadequacy of the Award rests on the landowner.',
    significance: 'Establishes that courts will actively review Collector Awards and are not bound by government valuations. Landowners should engage qualified valuers to support their claims for higher compensation.',
    diagram: { parties: ['Landowner (Challenging Compensation)', 'Collector (Government Valuation)'], issue: 'Will court override Collector\'s valuation?', result: 'YES — Court may increase Award based on independent expert evidence.' }
  },
  // ─── PROFESSIONAL ETHICS ────────────────────────────────────────────────
  {
    id: 'case_074', title: 'Re Leong Mee Lian', citation: '[2004] 4 MLJ 238',
    topic: 'Professional Ethics — Misappropriation of Client Money', tags: ['Ethics', 'Disciplinary', 'Client Money', 'Striking Off'],
    facts: 'A solicitor misappropriated client money from the firm\'s Client Account, using the funds for personal purposes. The Bar Council\'s Disciplinary Board commenced proceedings against the solicitor.',
    issue: 'What is the appropriate disciplinary sanction for a solicitor who misappropriates client money?',
    held: 'The court upheld the Disciplinary Board\'s decision to strike the solicitor off the Roll. Misappropriation of client money is the gravest professional misconduct a solicitor can commit. The duty to safeguard client money is sacrosanct and any breach warrants the ultimate penalty.',
    significance: 'Sends a clear message to the profession that misappropriation of client funds will result in striking off, regardless of the circumstances. Firms must maintain strict compliance with the Solicitors\' Accounts Rules.',
    diagram: { parties: ['Solicitor (Misappropriated Client Money)', 'Bar Council (Disciplinary Proceedings)'], issue: 'What penalty for misappropriating client money?', result: 'STRIKING OFF — The ultimate penalty. Duty to safeguard client money is sacrosanct.' }
  },
  // ─── ANTI-MONEY LAUNDERING ──────────────────────────────────────────────
  {
    id: 'case_075', title: 'PP v Ling Lee Soon', citation: '[2014] 2 CLJ 697',
    topic: 'Anti-Money Laundering — Property Transactions', tags: ['AMLA', 'Money Laundering', 'Property', 'Criminal'],
    facts: 'The accused was convicted of money laundering offences involving the purchase of multiple properties using proceeds from illegal activities. The properties were acquired through nominees and complex corporate structures to obscure the source of funds.',
    issue: 'Can property acquired with proceeds from illegal activities be forfeited, and what are the penalties for money laundering through property?',
    held: 'The court convicted the accused of money laundering under AMLA 2001. All properties acquired with tainted funds were ordered forfeited to the government. The court held that the use of nominees and complex structures to disguise the illegal source of funds constituted money laundering offences.',
    significance: 'Highlights the risk for conveyancing practitioners who fail to conduct proper due diligence. Lawyers must implement KYC procedures, verify the source of funds, and report suspicious transactions. Failure to do so can expose the lawyer to criminal liability.',
    diagram: { parties: ['Accused (Used Proceeds to Buy Property)', 'Government (Forfeiture Proceedings)'], issue: 'Can property bought with illegal funds be forfeited?', result: 'YES — Properties forfeited. Nominees and complex structures cannot hide illegal source.' }
  },
  // ─── MALAY RESERVE LAND ─────────────────────────────────────────────────
  {
    id: 'case_076', title: 'Haji Abdul Rahman bin Haji Mohd Dahan v Jabatan KPTG', citation: '[1997] 3 MLJ 337',
    topic: 'Malay Reserve Land — Constitutional Protection', tags: ['Malay Reserve', 'Constitutional', 'Land Restriction', 'NLC'],
    facts: 'An attempt was made to transfer Malay Reserve Land to a non-Malay purchaser. The Land Office refused to register the transfer. The parties challenged the refusal, arguing the restriction was discriminatory.',
    issue: 'Can Malay Reserve Land be transferred to a non-Malay person?',
    held: 'The court held that restrictions on Malay Reserve Land are constitutionally mandated under Article 89 of the Federal Constitution and cannot be waived by the State Authority except through proper de-gazetting procedures. Any purported transfer to a non-Malay is void and unregistrable.',
    significance: 'Practitioners must check titles for Malay Reserve endorsements during searches. SPAs involving MRL must include appropriate conditions and restrictions. Financing may be difficult as non-Malay banks may not accept MRL as security.',
    diagram: { parties: ['Non-Malay Purchaser (Seeking Transfer)', 'Land Office (Refusing Registration)'], issue: 'Can MRL be transferred to non-Malay?', result: 'NO — Constitutional restriction. Transfer is void and unregistrable.' }
  },
  // ─── CONSTRUCTION & DEVELOPER ───────────────────────────────────────────
  {
    id: 'case_077', title: 'Bauer (Malaysia) Sdn Bhd v Daewoo Corporation', citation: '[1999] 4 MLJ 545',
    topic: 'Construction — Contractor\'s Lien', tags: ['Construction', 'Lien', 'Contractor', 'Payment'],
    facts: 'A building contractor completed work on a development project but was not paid by the developer. The contractor claimed a lien over the completed structures and refused to hand over the buildings until payment was made.',
    issue: 'Does a building contractor have a lien over completed structures for unpaid construction costs?',
    held: 'The court held that at common law, a builder or contractor does not have an automatic lien over land or buildings merely because work has been done on them. Unlike a repairer\'s lien over goods, the contractor must rely on contractual remedies (damages for breach) or pursue a charging order through the courts.',
    significance: 'Clarifies that contractors cannot hold buildings hostage for unpaid fees. Conveyancing practitioners should be aware that a contractor\'s claim does not create an encumbrance on the title. However, pending litigation by a contractor may give rise to a caveatable interest.',
    diagram: { parties: ['Contractor (Claiming Lien)', 'Developer (Refusing to Pay)'], issue: 'Does contractor have a lien over completed buildings?', result: 'NO — No automatic lien. Must pursue contractual remedies or charging order.' }
  },
  // ─── SUBSALE & CONSENT ──────────────────────────────────────────────────
  {
    id: 'case_078', title: 'Cooperative Central Bank Ltd v Feighery', citation: '[1978] 1 MLJ 240',
    topic: 'Charge — Statutory Form & Compliance', tags: ['Charge', 'Statutory Form', 'NLC', 'Compliance'],
    facts: 'A charge was created using a document that did not conform to the prescribed statutory form under the NLC. The chargor subsequently defaulted, and the chargee sought to enforce the charge. The chargor challenged the validity of the charge on the ground of non-compliance with statutory form requirements.',
    issue: 'Is a charge valid if it does not conform to the prescribed statutory form under the NLC?',
    held: 'The court held that compliance with the statutory forms prescribed under the NLC is mandatory for the creation of a valid charge. A charge that does not conform to the prescribed form (Form 16A) is defective and may be unenforceable. Strict compliance with statutory requirements is a prerequisite for registration.',
    significance: 'Practitioners must ensure all charge documents strictly comply with NLC statutory forms. Deviations from Form 16A, even seemingly minor ones, can render the charge defective. Banks and solicitors must verify form compliance before presentment.',
    diagram: { parties: ['Chargee (Enforcing Non-Conforming Charge)', 'Chargor (Challenging Validity)'], issue: 'Is a non-conforming charge valid?', result: 'NO — Statutory form compliance is mandatory. Non-conforming charge may be unenforceable.' }
  },
  // ─── MISREPRESENTATION ──────────────────────────────────────────────────
  {
    id: 'case_079', title: 'Sim Thong Kin v Dato\' Yap Yun Fook', citation: '[1987] 1 MLJ 30',
    topic: 'Misrepresentation in Property Sale', tags: ['Misrepresentation', 'Contract', 'SPA', 'Rescission'],
    facts: 'The vendor of a property made representations about the property\'s potential for commercial development that turned out to be false. The purchaser, relying on these representations, entered into the SPA. Upon discovering the misrepresentation, the purchaser sought rescission.',
    issue: 'Can a purchaser rescind the SPA for misrepresentation by the vendor?',
    held: 'The court held that a purchaser who has been induced to enter into an SPA by a material misrepresentation (whether fraudulent or innocent) is entitled to rescission and restitution. The misrepresentation must be material — meaning it would have influenced a reasonable person\'s decision to enter the contract.',
    significance: 'Establishes the remedy of rescission for misrepresentation in property transactions. Practitioners should advise vendors to make accurate representations and purchasers to verify all material facts independently.',
    diagram: { parties: ['Purchaser (Induced by Misrepresentation)', 'Vendor (Made False Representations)'], issue: 'Can purchaser rescind SPA for misrepresentation?', result: 'YES — Rescission available for material misrepresentation (fraudulent or innocent).' }
  },
  // ─── CONVERSION & SUBDIVISION ───────────────────────────────────────────
  {
    id: 'case_080', title: 'Pengarah Tanah dan Galian Wilayah Persekutuan v Sri Lempah Enterprise Sdn Bhd', citation: '[1979] 1 MLJ 135',
    topic: 'Subdivision — Developer\'s Obligations Under NLC', tags: ['Subdivision', 'Developer', 'NLC', 'Condition'],
    facts: 'A developer applied for subdivision of a parcel of land for housing development. The State Authority imposed conditions including the surrender of part of the land for road reserves and public utilities without compensation.',
    issue: 'Can the State Authority impose conditions (including surrender of land) upon approval of a subdivision application?',
    held: 'The Federal Court held that the State Authority\'s power to impose conditions on subdivision approval is broad but must be exercised reasonably and in good faith. The requirement to surrender land for road reserves is a common and reasonable condition. However, the State Authority cannot impose conditions that amount to confiscation or are unrelated to the subdivision.',
    significance: 'Important for developers. Subdivision conditions (road surrenders, utility allocations, open space requirements) are standard but must be reasonable. Practitioners should review proposed conditions carefully and advise clients on their rights to challenge unreasonable ones.',
    diagram: { parties: ['Developer (Seeking Subdivision)', 'State Authority (Imposing Conditions)'], issue: 'Can State impose conditions on subdivision approval?', result: 'YES — But conditions must be reasonable and in good faith. Cannot amount to confiscation.' }
  },
  // ─── SPECIFIC PERFORMANCE ───────────────────────────────────────────────
  {
    id: 'case_081', title: 'Ong Ban Chai v Seah Siang Mong', citation: '[1998] 3 MLJ 437',
    topic: 'Specific Performance — Purchaser\'s Readiness', tags: ['Specific Performance', 'Readiness', 'Purchaser', 'Equity'],
    facts: 'The purchaser sought specific performance of an SPA after the vendor refused to complete the transfer. However, the vendor argued that the purchaser had not demonstrated readiness, willingness, and ability to complete by tendering the balance purchase price on the agreed completion date.',
    issue: 'Must a purchaser demonstrate readiness and willingness to complete before obtaining specific performance?',
    held: 'The court held that a purchaser seeking specific performance must demonstrate that they were ready, willing, and able to perform their part of the contract at the time performance was due. Mere verbal assertions of readiness are insufficient — the purchaser must have actually tendered payment or demonstrated the financial capacity to complete.',
    significance: 'Practitioners advising purchasers seeking specific performance must ensure the client has clearly demonstrated readiness to complete. Evidence of financial capacity (bank confirmation, available funds) and actual or attempted tender of payment strengthens the claim.',
    diagram: { parties: ['Purchaser (Seeking Specific Performance)', 'Vendor (Alleging Purchaser Not Ready)'], issue: 'Must purchaser prove readiness for specific performance?', result: 'YES — Must demonstrate actual readiness, willingness, and ability. Verbal assertions insufficient.' }
  },
  // ─── STAKEHOLDER & DEPOSIT ──────────────────────────────────────────────
  {
    id: 'case_082', title: 'Lee Chee Wei v Tan Hor Peow & Anor', citation: '[2007] 7 MLJ 414',
    topic: 'Deposit — Forfeiture & Penalty', tags: ['Deposit', 'Forfeiture', 'Penalty', 'SPA'],
    facts: 'The purchaser paid a 10% deposit under the SPA but failed to complete the purchase. The vendor sought to forfeit the deposit. The purchaser argued the forfeiture clause was a penalty and should be relieved against by the court.',
    issue: 'Is a deposit forfeiture clause in an SPA enforceable, or is it a penalty?',
    held: 'The court held that a true deposit (earnest money) paid as a guarantee of performance is forfeitable upon breach by the purchaser, and this is not a penalty. However, where the amount forfeitable exceeds a reasonable percentage of the purchase price (typically 10%), the court may treat the excess as a penalty and relieve against it.',
    significance: 'Clarifies the distinction between a true deposit (forfeitable) and a penalty (subject to court relief). Practitioners should ensure deposit clauses are drafted as genuine pre-estimates of loss or kept at the conventional 10% level.',
    diagram: { parties: ['Vendor (Forfeiting Deposit)', 'Purchaser (Claiming Penalty)'], issue: 'Is 10% deposit forfeiture enforceable?', result: 'YES — 10% deposit is a genuine earnest, not a penalty. Excess amounts may be relieved against.' }
  },
  // ─── ELECTRONIC CONVEYANCING ────────────────────────────────────────────
  {
    id: 'case_083', title: 'Ketua Pengarah Tanah dan Galian v YNH Property Bhd', citation: '[2019] 3 MLJ 265',
    topic: 'Land Administration — E-Tanah & Electronic Systems', tags: ['E-Tanah', 'Electronic', 'Land Administration', 'Modernisation'],
    facts: 'A dispute arose regarding the admissibility and validity of electronic records from the e-Tanah land administration system. The parties questioned whether electronic title records had the same legal force as physical records maintained at the Land Office.',
    issue: 'Are electronic land records maintained under the e-Tanah system legally equivalent to physical records?',
    held: 'The court held that electronic records maintained under an authorised computerised land registration system have the same legal effect as physical records. The system was implemented pursuant to statutory authority and the electronic register is the official register for the purposes of the NLC.',
    significance: 'Supports the transition to electronic conveyancing in Malaysia. Practitioners must familiarise themselves with e-Tanah procedures, electronic title searches, and online filing. The legal validity of electronic records is now settled.',
    diagram: { parties: ['Land Authority (E-Tanah System)', 'Property Owner (Questioning Electronic Records)'], issue: 'Are electronic land records legally valid?', result: 'YES — Electronic records have the same legal effect as physical records under NLC.' }
  },
  // ─── CAVEAT CHALLENGES ──────────────────────────────────────────────────
  {
    id: 'case_084', title: 'Syed Kechik bin Syed Mohamed v Government of Malaysia', citation: '[1979] 2 MLJ 101',
    topic: 'Caveat — Wrongful Lodgement & Damages', tags: ['Caveat', 'Wrongful', 'Damages', 'NLC'],
    facts: 'A caveat was lodged against a property without a genuine caveatable interest, effectively blocking the registered proprietor from dealing with the property for several years. The proprietor suffered financial loss due to the inability to sell or charge the property.',
    issue: 'What remedies are available to a registered proprietor against whom a wrongful caveat has been lodged?',
    held: 'The court held that a person who lodges a caveat without a genuine caveatable interest is liable in damages to the registered proprietor for any loss caused. The proprietor may also apply to court for removal of the caveat and costs. The caveator must have a bona fide interest in the specific land — not merely a personal claim.',
    significance: 'Establishes that caveats must not be used as instruments of oppression. A caveator without a genuine interest faces damages liability. Practitioners should advise clients against lodging speculative caveats.',
    diagram: { parties: ['Registered Proprietor (Blocked by Caveat)', 'Caveator (No Genuine Interest)'], issue: 'What remedy for wrongful caveat?', result: 'DAMAGES — Caveator liable for all loss caused. Court can remove caveat and order costs.' }
  },
  // ─── COMPLETION & SETTLEMENT ────────────────────────────────────────────
  {
    id: 'case_085', title: 'Hong Leong Bank Bhd v Staghorn Sdn Bhd', citation: '[2008] 2 MLJ 622',
    topic: 'Charge — Bank\'s Duty of Care on Power of Sale', tags: ['Charge', 'Power of Sale', 'Bank', 'Duty of Care'],
    facts: 'A bank exercised its power of sale over charged property and sold it at auction for significantly below market value. The chargor alleged the bank failed to take reasonable steps to obtain the best price reasonably obtainable.',
    issue: 'Does a chargee bank owe a duty of care to the chargor when exercising its power of sale?',
    held: 'The court held that a chargee exercising its power of sale owes a duty to act in good faith and to take reasonable steps to obtain the best price reasonably obtainable. While the bank is not obliged to postpone the sale or wait for better market conditions, it must not sacrifice the chargor\'s interests. Selling at a gross undervalue may indicate breach of duty.',
    significance: 'Important for practitioners acting for both banks and borrowers. Banks must conduct proper valuations, adequate marketing, and transparent auction processes. Borrowers can challenge sales at gross undervalue.',
    diagram: { parties: ['Chargor (Property Sold Below Value)', 'Bank (Exercised Power of Sale)'], issue: 'Does bank owe duty of care when selling charged property?', result: 'YES — Must act in good faith and obtain best price reasonably obtainable.' }
  },
  // ─── ESTATE & SUCCESSION ────────────────────────────────────────────────
  {
    id: 'case_086', title: 'Takako Sakao v Ng Pek Yuen', citation: '[2009] 6 MLJ 497',
    topic: 'Death of Proprietor — Transmission of Title', tags: ['Transmission', 'Death', 'Estate', 'Administration'],
    facts: 'Upon the death of a sole registered proprietor, a dispute arose between the surviving spouse and the beneficiaries under the will regarding the right to apply for transmission of the property. Both parties claimed entitlement to deal with the property.',
    issue: 'Who has the right to apply for transmission of property upon the death of the registered proprietor?',
    held: 'The court held that only the executor (under a will) or the administrator (under letters of administration for intestacy) has the right to apply for transmission under s.346 NLC. The surviving spouse or beneficiaries cannot deal with the property until they have been appointed as personal representatives and obtained a Grant of Probate or Letters of Administration.',
    significance: 'Conveyancing involving deceased estates requires verification of the Grant of Probate or Letters of Administration. Practitioners must confirm the personal representative\'s authority before accepting instructions to sell or transfer deceased\'s property.',
    diagram: { parties: ['Executor/Administrator (Appointed PR)', 'Surviving Spouse/Beneficiaries (Claiming Property)'], issue: 'Who can apply for transmission of deceased\'s property?', result: 'Only the appointed executor or administrator. Must have Grant of Probate or Letters of Administration.' }
  },
  // ─── DEVELOPER LICENSING ────────────────────────────────────────────────
  {
    id: 'case_087', title: 'Puncak Niaga Holdings Bhd v Kerajaan Negeri Selangor', citation: '[2012] 3 MLJ 710',
    topic: 'Developer — Licensing Requirement Under HDA', tags: ['Developer', 'Licensing', 'HDA', 'SPA Validity'],
    facts: 'A developer sold housing units without a valid developer\'s licence under the HDA. Purchasers entered into SPAs and made payments. When defects were discovered, the purchasers sought to enforce the HDA protections against the developer.',
    issue: 'What is the effect of a developer selling housing units without a valid HDA licence?',
    held: 'The court held that selling housing without a valid developer\'s licence is a criminal offence under the HDA. However, the SPAs entered into with purchasers remain valid and enforceable — the purchasers do not lose their statutory protections merely because the developer operated unlawfully. The unlicensed developer remains bound by the HDA obligations.',
    significance: 'Protects purchasers who may unknowingly deal with unlicensed developers. Practitioners should verify the developer\'s licence status during due diligence but can reassure purchasers that their contractual rights survive even if the developer is unlicensed.',
    diagram: { parties: ['Purchasers (Bought from Unlicensed Developer)', 'Developer (No Valid HDA Licence)'], issue: 'Are SPAs with unlicensed developer valid?', result: 'YES — SPAs remain valid. Purchasers retain HDA protections. Developer commits criminal offence.' }
  },
  // ─── REFINANCING ────────────────────────────────────────────────────────
  {
    id: 'case_088', title: 'CIMB Bank Bhd v Maybank Bhd', citation: '[2011] 5 MLJ 291',
    topic: 'Refinancing — Priority of Charges', tags: ['Refinancing', 'Priority', 'Charge', 'Bank'],
    facts: 'A property owner refinanced their housing loan from one bank to another. The discharge of the first charge and registration of the new charge were not completed simultaneously. A brief interval arose during which the property was momentarily unencumbered, allowing a third-party creditor to register a caveat.',
    issue: 'How is priority of charges determined during refinancing, and what happens if a third party intervenes?',
    held: 'The court held that under the NLC, priority of registered interests is determined by the order of registration (first in time, first in right). If a third-party caveat or charge is registered before the new financier\'s charge, the third party may obtain priority. The new financier should conduct a priority search immediately before presenting its charge.',
    significance: 'Critical lesson for refinancing transactions. Practitioners must coordinate the discharge and new charge simultaneously, conduct a last-minute priority search, and present all instruments on the same day to avoid intervening registrations.',
    diagram: { parties: ['Old Bank (Discharging Charge)', 'New Bank (Registering New Charge)', 'Third Party (Intervening Caveat)'], issue: 'Who has priority if third party intervenes during refinancing?', result: 'FIRST IN TIME — Priority by order of registration. Must coordinate discharge and new charge simultaneously.' }
  },
  // ─── LAND FRAUD ─────────────────────────────────────────────────────────
  {
    id: 'case_089', title: 'Au Meng Nam v Ung Yak Chew', citation: '[2007] 5 MLJ 1',
    topic: 'Land Fraud — Resulting Trust & Unregistered Interest', tags: ['Fraud', 'Trust', 'Registration', 'Equity'],
    facts: 'A property was purchased with money provided by one party but registered in the name of another. The registered proprietor attempted to sell the property, claiming it was his own. The true financier sought to establish a resulting trust.',
    issue: 'Can a party who financed the purchase but is not the registered proprietor establish a resulting trust over the land?',
    held: 'The court held that where one party provides the purchase money but the land is registered in another\'s name, a resulting trust arises in favour of the financier. The financier can establish beneficial ownership by proving the monetary contribution and the circumstances of the purchase. However, the financier should have protected their interest with a caveat.',
    significance: 'Confirms that equitable interests can exist alongside registered interests under the NLC. However, without caveat protection, a bona fide purchaser from the registered proprietor may defeat the beneficial owner\'s claim.',
    diagram: { parties: ['Financier (Provided Purchase Money)', 'Registered Proprietor (Title in Their Name)'], issue: 'Can financier establish resulting trust over registered land?', result: 'YES — Resulting trust arises. But without caveat, interest may be defeated by BFP.' }
  },
  // ─── ENVIRONMENTAL & LAND USE ───────────────────────────────────────────
  {
    id: 'case_090', title: 'Ketua Pengarah Kualiti Alam v Kayar Holdings Sdn Bhd', citation: '[2011] 1 MLJ 257',
    topic: 'Environmental Compliance in Land Development', tags: ['Environmental', 'EIA', 'Development', 'Compliance'],
    facts: 'A developer commenced development activities on a large tract of land without first obtaining the required Environmental Impact Assessment (EIA) approval. The Department of Environment sought to halt the development and impose penalties.',
    issue: 'Must a developer obtain EIA approval before commencing development, and what are the consequences of non-compliance?',
    held: 'The court held that under the Environmental Quality Act 1974, an EIA report must be prepared and approved before any prescribed development activity can commence. Failure to obtain EIA approval is an offence and the court may issue an injunction to stop the development. The developer cannot regularise the situation retrospectively.',
    significance: 'Conveyancing practitioners advising on development land must verify EIA compliance. Purchasers of development land should ensure EIA approval has been obtained as a condition precedent in the SPA. Non-compliance can halt the entire project.',
    diagram: { parties: ['Developer (No EIA Approval)', 'Department of Environment (Enforcement)'], issue: 'Can development proceed without EIA approval?', result: 'NO — EIA mandatory for prescribed activities. Court can injunct. Cannot regularise retrospectively.' }
  },
  // ─── WINDING UP & LAND ──────────────────────────────────────────────────
  {
    id: 'case_091', title: 'Metalform (Asia) Pte Ltd v Holland Asia Holdings Pte Ltd', citation: '[2007] 6 MLJ 621',
    topic: 'Company Winding Up — Effect on Property', tags: ['Winding Up', 'Company', 'Property', 'Liquidator'],
    facts: 'A company that owned property was wound up. A purchaser had signed an SPA with the company before the winding-up order but had not yet completed the transfer. The liquidator sought to disclaim the SPA and sell the property to a higher bidder.',
    issue: 'Can a liquidator disclaim a pre-existing SPA and sell the company\'s property to a different buyer?',
    held: 'The court held that the liquidator has the power to disclaim onerous contracts under the Companies Act. However, a specifically enforceable SPA (where the purchaser is ready, willing, and able to complete) cannot be easily disclaimed. The purchaser may apply for specific performance against the company in liquidation, and the court may order completion if it is in the interests of justice.',
    significance: 'Practitioners must conduct company searches on corporate vendors to check for winding-up proceedings. An SPA with a company in liquidation creates significant risk. Early lodgement of a private caveat is essential to protect the purchaser.',
    diagram: { parties: ['Purchaser (Pre-existing SPA)', 'Liquidator (Seeking to Disclaim)'], issue: 'Can liquidator disclaim pre-existing SPA?', result: 'DIFFICULT — Court may order specific performance if purchaser is ready, willing, and able.' }
  },
  // ─── CONCURRENT INTERESTS ───────────────────────────────────────────────
  {
    id: 'case_092', title: 'Dato\' Seri Timah binti Haji Teh v Dato\' Hassan bin Mohamed', citation: '[1997] 4 MLJ 385',
    topic: 'Matrimonial Property — Division Upon Divorce', tags: ['Matrimonial', 'Divorce', 'Property Division', 'LRA'],
    facts: 'Upon divorce, the wife claimed a share in the matrimonial home and other properties registered solely in the husband\'s name. She argued she had made direct and indirect contributions to the acquisition of the properties.',
    issue: 'How are matrimonial properties divided upon divorce where the title is in one spouse\'s name?',
    held: 'The court held that under the Law Reform (Marriage and Divorce) Act 1976, the court has wide discretion to divide matrimonial assets. The court considers: (1) direct financial contributions; (2) indirect contributions (homemaking, childcare); (3) the needs of the parties; (4) the standard of living during marriage. A non-working spouse may receive up to 50% or more for indirect contributions.',
    significance: 'Critical for conveyancing when acting for divorced or separating parties. Practitioners must verify whether the property is subject to any matrimonial proceedings or court orders before completing a transfer. A caveat may have been lodged by the other spouse.',
    diagram: { parties: ['Wife (Claiming Share)', 'Husband (Sole Registered Proprietor)'], issue: 'Can non-titled spouse claim matrimonial property?', result: 'YES — Court considers direct and indirect contributions. Up to 50%+ for indirect contributions.' }
  },
  // ─── JUDICIAL SALE ──────────────────────────────────────────────────────
  {
    id: 'case_093', title: 'RHB Bank Bhd v Ngan Tuck Seng', citation: '[2013] 4 MLJ 801',
    topic: 'Judicial Sale — Foreclosure Procedure', tags: ['Foreclosure', 'Judicial Sale', 'Bank', 'NLC'],
    facts: 'A bank sought to exercise its power of sale over a defaulting borrower\'s property. The bank applied for an order for sale under s.256 NLC. The borrower contested the application, arguing he was in negotiations to settle the outstanding debt.',
    issue: 'Can the court refuse an order for sale under s.256 NLC when the borrower is attempting to negotiate settlement?',
    held: 'The court held that once the statutory requirements under s.254-256 NLC are met (valid charge, default, notice served, redemption period expired), the court has limited discretion to refuse an order for sale. The borrower\'s vague promises to negotiate or settle are insufficient to prevent the order. The court\'s role is to ensure procedural compliance, not to assess the commercial reasonableness of foreclosure.',
    significance: 'Confirms that once the NLC foreclosure procedure is properly followed, the bank is entitled to an order for sale. Borrowers must redeem within the statutory period or face foreclosure. Practitioners must ensure strict compliance with every procedural step.',
    diagram: { parties: ['Bank (Seeking Order for Sale)', 'Borrower (Requesting Time to Negotiate)'], issue: 'Can court refuse order for sale during settlement negotiations?', result: 'NO — Once NLC s.254-256 requirements met, court has limited discretion to refuse.' }
  },
  // ─── LAND TITLE CONVERSION ──────────────────────────────────────────────
  {
    id: 'case_094', title: 'Lim Cho Hock v Government of Perak', citation: '[1980] 2 MLJ 148',
    topic: 'Title Conversion — Qualified to Final Title', tags: ['Title Conversion', 'Qualified Title', 'Final Title', 'NLC'],
    facts: 'A qualified title holder applied for conversion to final title after the cadastral survey was completed. The survey revealed discrepancies between the land area stated in the qualified title and the actual surveyed area. The proprietor disputed the amended boundaries.',
    issue: 'What happens when a qualified title is converted to a final title and there are discrepancies in the surveyed boundaries?',
    held: 'The court held that a qualified title is inherently subject to amendment upon completion of the survey. The proprietor has no vested right to the boundaries as stated in the qualified title. However, if the survey reveals a significant reduction in area, the proprietor may be entitled to compensation from the State for the diminished area.',
    significance: 'Practitioners must advise purchasers of properties with qualified titles that boundaries may change upon conversion to final title. This is a risk factor in sub-sale transactions involving qualified title properties.',
    diagram: { parties: ['Proprietor (Qualified Title)', 'State (Survey & Conversion)'], issue: 'Can boundaries change when qualified title converts to final?', result: 'YES — Qualified title is subject to survey amendment. Compensation may be available for significant area reduction.' }
  },
  // ─── COMMON PROPERTY DISPUTES ───────────────────────────────────────────
  {
    id: 'case_095', title: 'Perbadanan Pengurusan Trellises v Soo Chin Wai & Ors', citation: '[2017] 5 MLJ 517',
    topic: 'Strata — Common Property Encroachment', tags: ['Strata', 'Common Property', 'Encroachment', 'SMA'],
    facts: 'Several parcel owners in a condominium renovated their units and encroached upon common property (corridors, lobbies, and roof areas). The Management Corporation sought court orders to compel the owners to restore the common property to its original state.',
    issue: 'Can the MC compel parcel owners to remove encroachments on common property?',
    held: 'The court held that common property belongs to all parcel owners collectively and is managed by the MC. No individual parcel owner has the right to appropriate or encroach upon common property for their exclusive use. The MC has the duty and power to enforce the by-laws and obtain court orders for removal of encroachments.',
    significance: 'Critical for strata conveyancing. Purchasers must inspect for common property encroachments during due diligence. Existing encroachments may affect the value of the property and expose the new owner to enforcement action by the MC.',
    diagram: { parties: ['MC (Enforcing Common Property Rights)', 'Parcel Owners (Encroaching on Common Areas)'], issue: 'Can MC compel removal of common property encroachments?', result: 'YES — MC has duty and power to enforce. No owner can appropriate common property.' }
  },
  // ─── UNLAWFUL OCCUPATION ────────────────────────────────────────────────
  {
    id: 'case_096', title: 'Sidek bin Haji Muhammad Basir v Government of Perak', citation: '[1982] 1 MLJ 313',
    topic: 'Adverse Possession — Inapplicability Under NLC', tags: ['Adverse Possession', 'NLC', 'Torrens', 'Registered Land'],
    facts: 'The appellant had occupied State Land for decades and cultivated it extensively. When the State sought to alienate the land to a third party, the appellant claimed ownership rights by virtue of long and undisturbed occupation (adverse possession).',
    issue: 'Does adverse possession (long occupation without title) create ownership rights under the Malaysian NLC?',
    held: 'The court held that the doctrine of adverse possession has no application to registered land under the NLC. The Torrens system of title by registration is conclusive. No amount of occupation, however long, can defeat the registered title of the State or a registered proprietor. The appellant\'s occupation, while acknowledged, conferred no proprietary rights.',
    significance: 'Fundamental authority confirming that adverse possession is incompatible with the Torrens system in Malaysia. Practitioners can reassure purchasers that registered titles cannot be defeated by claims of long occupation. Squatters have no legal right to registered land.',
    diagram: { parties: ['Occupier (Claiming Adverse Possession)', 'State (Registered Owner)'], issue: 'Does long occupation create ownership under NLC?', result: 'NO — Adverse possession does not apply. Torrens registration is conclusive.' }
  },
  // ─── SUBSALE COMPLETION ─────────────────────────────────────────────────
  {
    id: 'case_097', title: 'Yew Wan Yew v Chong Chin Soong', citation: '[1990] 3 MLJ 353',
    topic: 'Sub-Sale — Completion & Consent to Transfer', tags: ['Sub-Sale', 'Completion', 'Consent', 'Transfer'],
    facts: 'In a sub-sale transaction, the developer\'s consent was required for the transfer from the original purchaser to the sub-purchaser. The developer delayed giving consent, causing the completion to be extended beyond the agreed date. The sub-purchaser sought to terminate the SPA.',
    issue: 'Who bears the risk of delay in obtaining the developer\'s consent in a sub-sale transaction?',
    held: 'The court held that the vendor (original purchaser) bears the obligation to obtain the developer\'s consent for the sub-sale transfer. If the consent is delayed through no fault of either party, the SPA completion date should be extended by agreement. However, if the vendor has failed to take reasonable steps to obtain consent, the sub-purchaser may rescind.',
    significance: 'Sub-sale transactions involving developer consent require careful SPA drafting. The SPA should include provisions for extension of time pending consent, allocation of responsibility for obtaining consent, and rescission rights if consent is unreasonably withheld.',
    diagram: { parties: ['Sub-Purchaser (Seeking Completion)', 'Vendor/Original Purchaser (Obtaining Consent)', 'Developer (Consent Required)'], issue: 'Who bears risk of delayed developer consent?', result: 'VENDOR bears obligation. SPA should include extension provisions. Rescission available if vendor at fault.' }
  },
  // ─── GUARANTEE & INDEMNITY ──────────────────────────────────────────────
  {
    id: 'case_098', title: 'Bank Negara Malaysia v Mohd Ismail & Ors', citation: '[1992] 1 MLJ 400',
    topic: 'Guarantee — Co-Borrower & Guarantor Liability', tags: ['Guarantee', 'Co-Borrower', 'Bank', 'Liability'],
    facts: 'A housing loan was taken by a borrower with a guarantor. The borrower defaulted and the bank sought to recover the outstanding amount from both the borrower and the guarantor. The guarantor argued that the bank had varied the terms of the loan without the guarantor\'s consent, thereby discharging the guarantee.',
    issue: 'Is a guarantor discharged from liability when the bank varies the loan terms without the guarantor\'s consent?',
    held: 'The court held that at common law, a material variation of the principal contract (the loan) without the guarantor\'s consent discharges the guarantor from liability. However, most modern guarantee agreements contain a clause preserving the guarantee despite any variation — making the guarantor\'s consent unnecessary for routine variations.',
    significance: 'Important for practitioners handling loan documentation. Guarantee agreements should contain comprehensive variation clauses. If advising guarantors, ensure they understand the extent of their liability and the effect of variation clauses.',
    diagram: { parties: ['Borrower (Defaulted)', 'Guarantor (Seeking Discharge)', 'Bank (Claiming Under Guarantee)'], issue: 'Is guarantor discharged by loan variation without consent?', result: 'DEPENDS — At common law yes. But modern guarantees contain variation clauses preserving the guarantee.' }
  },
  // ─── UNLAWFUL DEVELOPMENT ───────────────────────────────────────────────
  {
    id: 'case_099', title: 'Majlis Perbandaran Pulau Pinang v Syarikat Bekerjasama Serbaguna Sungai Gelugor', citation: '[1999] 3 MLJ 1',
    topic: 'Planning — Building Without Approval', tags: ['Planning', 'Building Approval', 'Local Authority', 'Enforcement'],
    facts: 'A property owner constructed buildings on their land without obtaining proper planning permission and building plan approval from the local authority. The local authority served enforcement notices requiring demolition of the unauthorized structures.',
    issue: 'What are the consequences of building without planning permission and building plan approval?',
    held: 'The court held that building without approval from the local authority is an offence under the Street, Drainage and Building Act 1974. The local authority has the power to serve enforcement notices, require demolition, and impose penalties. The owner cannot regularise the building retrospectively if it does not comply with planning and building regulations.',
    significance: 'Conveyancing practitioners must verify that all structures on the property have proper building plan approval and CCC/CF. Unauthorised structures are a title risk and may need to be demolished. Purchasers should be advised of this risk during due diligence.',
    diagram: { parties: ['Property Owner (Built Without Approval)', 'Local Authority (Enforcement)'], issue: 'What happens if you build without approval?', result: 'OFFENCE — Local authority can require demolition. Cannot regularise non-compliant buildings.' }
  },
  // ─── CONSENT ISSUES ─────────────────────────────────────────────────────
  {
    id: 'case_100', title: 'Superintendent of Lands & Surveys v Aik Hoe & Co Ltd', citation: '[1966] 2 MLJ 60',
    topic: 'Transfer — State Authority Consent & Void Transactions', tags: ['Consent', 'State Authority', 'Void', 'Transfer'],
    facts: 'A transfer of land was made to a company that was not qualified to hold the land under the applicable state land restrictions. The transfer was registered despite the non-qualification. The State later discovered the breach and challenged the registration.',
    issue: 'Is a transfer to a non-qualified person valid if it has been registered?',
    held: 'The Privy Council held that a transfer in breach of statutory restrictions is void ab initio — from the beginning. Registration does not cure the illegality. The Registrar has the power and duty to cancel the registration upon discovery of the breach. The transferee acquires no title despite appearing on the register.',
    significance: 'A cornerstone case affirming that registration does not validate an illegal transaction. Practitioners must verify qualification requirements (citizenship, Malay Reserve restrictions, state authority consent) before completing any transfer. Due diligence is critical.',
    diagram: { parties: ['Non-Qualified Transferee (Registered Title)', 'State Authority (Cancelling Registration)'], issue: 'Does registration validate an illegal transfer?', result: 'NO — Void ab initio. Registration does not cure illegality. Registrar can cancel.' }
  },
];
