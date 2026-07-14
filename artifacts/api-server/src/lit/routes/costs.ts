import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { litCostSchedules } from "@workspace/db";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  const schedules = await db.select().from(litCostSchedules);
  res.json(schedules);
});

// POST /api/costs/judgment-interest
// Calculates pre-judgment and post-judgment interest under Courts of Judicature Act 1964, s.11
router.post("/judgment-interest", (req, res) => {
  const { principal, ratePercent, startDate, endDate, type } = req.body;
  const principalAmount = parseFloat(principal);
  const rate = parseFloat(ratePercent) || 5; // Default 5% p.a. (CJA 1964 prescribed rate)

  if (isNaN(principalAmount) || principalAmount <= 0) {
    res.status(400).json({ error: "Invalid principal amount" });
    return;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    res.status(400).json({ error: "Invalid date range" });
    return;
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.floor((end.getTime() - start.getTime()) / msPerDay);
  const years = days / 365;
  const dailyRate = (principalAmount * rate) / 100 / 365;
  const totalInterest = principalAmount * (rate / 100) * years;
  const totalWithPrincipal = principalAmount + totalInterest;

  const applicableProvision = type === "post_judgment"
    ? "Courts of Judicature Act 1964 (Act 91), s. 11(2) — Post-judgment interest at 5% p.a. prescribed rate"
    : "Courts of Judicature Act 1964 (Act 91), s. 11(1) — Pre-judgment interest at court's discretion (default 5% p.a.)";

  res.json({
    principal: principalAmount,
    ratePercent: rate,
    startDate,
    endDate,
    days,
    years: Math.round(years * 100) / 100,
    dailyRate: Math.round(dailyRate * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalWithPrincipal: Math.round(totalWithPrincipal * 100) / 100,
    applicableProvision,
    breakdown: [
      { description: "Principal Judgment Sum", amount: principalAmount },
      { description: `Interest (${rate}% p.a. × ${days} days)`, amount: Math.round(totalInterest * 100) / 100 },
      { description: "Total Sum Recoverable", amount: Math.round(totalWithPrincipal * 100) / 100 },
    ],
  });
});

// POST /api/costs/filing-fees
// Calculates court filing fees for civil litigation proceedings
router.post("/filing-fees", (req, res) => {
  const { court, proceedingType, claimAmount } = req.body;
  const claim = parseFloat(claimAmount) || 0;

  let filingFee = 0;
  let notes = "";
  let authority = "";

  if (court === "high_court") {
    if (proceedingType === "writ") {
      filingFee = claim <= 1000000 ? 1000 : 3000;
      notes = claim <= 1000000
        ? "Claims up to RM1 million: RM1,000"
        : "Claims above RM1 million: RM3,000";
      authority = "Courts of Judicature Act 1964 (Fees)";
    } else if (proceedingType === "os" || proceedingType === "judicial_review") {
      filingFee = 600;
      notes = "Originating Summons or OS for Judicial Review";
      authority = "Courts of Judicature Act 1964 (Fees); Order 53 ROC 2012";
    } else if (proceedingType === "winding_up") {
      filingFee = 1000;
      notes = "Winding Up Petition under Companies Act 2016, s. 464";
      authority = "Companies Act 2016; Courts of Judicature Act 1964 (Fees)";
    } else if (proceedingType === "bankruptcy_petition") {
      filingFee = 600;
      notes = "Creditor's Petition in Bankruptcy under Insolvency Act 1967";
      authority = "Insolvency Act 1967 (Act 360)";
    } else if (proceedingType === "interlocutory") {
      filingFee = 50;
      notes = "Per summons (Order 14, injunction application, etc.)";
      authority = "Rules of Court 2012";
    }
  } else if (court === "sessions_court") {
    // Sessions Court: RM25,001 to RM1 million jurisdiction
    if (claim <= 50000) {
      filingFee = 200;
    } else if (claim <= 250000) {
      filingFee = 300;
    } else {
      filingFee = 500;
    }
    notes = "Sessions Court civil jurisdiction: RM25,001 to RM1 million";
    authority = "Subordinate Courts Act 1948; Courts Rules";
  } else if (court === "magistrates_court") {
    // Magistrates Court: up to RM100,000 jurisdiction
    if (claim <= 10000) {
      filingFee = 50;
    } else if (claim <= 50000) {
      filingFee = 100;
    } else {
      filingFee = 200;
    }
    notes = "Magistrates Court civil jurisdiction: up to RM100,000";
    authority = "Subordinate Courts Act 1948; Courts Rules";
  }

  res.json({
    court,
    proceedingType,
    claimAmount: claim,
    filingFee,
    notes,
    authority,
    additionalCosts: [
      { description: "Service of process (per defendant)", amount: "RM10–RM30 approx." },
      { description: "Affidavit filing fee", amount: "RM5–RM10 per affidavit" },
      { description: "Hearing fee (if matter proceeds to trial)", amount: "At court's direction" },
    ],
  });
});

export default router;
