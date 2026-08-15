import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calculator, Info, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { type Matter } from "@/hooks/use-matters";

type CalcMode = "general" | "dependency" | "earnings" | "comprehensive";

function RMInput({ value, onChange, testId, label, hint }: { value: string; onChange: (v: string) => void; testId?: string; label: string; hint?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
      {hint && <p className="text-[10px] text-muted-foreground/70 mb-1">{hint}</p>}
      <div className="flex items-center">
        <span className="bg-muted px-3 py-2 border border-border border-r-0 rounded-l-md text-sm font-mono">RM</span>
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="rounded-l-none text-right font-mono" data-testid={testId} />
      </div>
    </div>
  );
}

function NumInput({ value, onChange, testId, label, hint }: { value: string; onChange: (v: string) => void; testId?: string; label: string; hint?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
      {hint && <p className="text-[10px] text-muted-foreground/70 mb-1">{hint}</p>}
      <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="text-right font-mono" data-testid={testId} />
    </div>
  );
}

function fmt(n: number): string {
  return `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pf(v: string): number {
  return parseFloat(v) || 0;
}

function SummaryRow({ label, amount, bold, accent }: { label: string; amount: number; bold?: boolean; accent?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-1.5 ${bold ? "border-t border-border pt-3 mt-2" : ""}`}>
      <span className={`text-sm ${bold ? "font-semibold" : "text-muted-foreground"}`}>{label}</span>
      <span className={`font-mono text-sm ${bold ? "font-bold" : ""} ${accent ? "text-primary" : ""}`}>{fmt(amount)}</span>
    </div>
  );
}

function SectionHeader({ title, expanded, onToggle }: { title: string; expanded: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="w-full flex items-center justify-between py-3 px-1 border-b border-border text-left">
      <span className="text-sm font-semibold text-primary">{title}</span>
      {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
    </button>
  );
}

export function CalculatorTab({ matter }: { matter?: Matter | null }) {
  const [mode, setMode] = useState<CalcMode>("comprehensive");
  const [contribNeg, setContribNeg] = useState("0");

  const [painSuffering, setPainSuffering] = useState("45000");
  const [lossAmenities, setLossAmenities] = useState("15000");
  const [scarring, setScarring] = useState("5000");
  const [lossExpectation, setLossExpectation] = useState("0");

  const [medicalExpenses, setMedicalExpenses] = useState("8500");
  const [transportCosts, setTransportCosts] = useState("1200");
  const [preLossEarnings, setPreLossEarnings] = useState("24000");
  const [vehicleRepair, setVehicleRepair] = useState("6500");
  const [nursingCare, setNursingCare] = useState("0");
  const [aidsAppliances, setAidsAppliances] = useState("0");
  const [funeralExpenses, setFuneralExpenses] = useState("0");
  const [otherSpecial, setOtherSpecial] = useState("0");

  const [monthlyEarnings, setMonthlyEarnings] = useState("5000");
  const [epfRate, setEpfRate] = useState("11");
  const [taxRate, setTaxRate] = useState("8");
  const [multiplier, setMultiplier] = useState("14");
  const [futureMedical, setFutureMedical] = useState("12000");
  const [futureNursing, setFutureNursing] = useState("0");
  const [lossingCapacity, setLossingCapacity] = useState("0");

  const [deceasedMonthly, setDeceasedMonthly] = useState("6000");
  const [personalExpPercent, setPersonalExpPercent] = useState("33");
  const [depMultiplier, setDepMultiplier] = useState("16");
  const [bereavement, setBereavement] = useState("30000");
  const [numDependants, setNumDependants] = useState("3");
  const [estatePS, setEstatePS] = useState("10000");

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    general: true, special: true, future: true, dependency: false, interest: true,
  });

  const toggleSection = (s: string) => setExpandedSections(prev => ({ ...prev, [s]: !prev[s] }));

  const totalGD = pf(painSuffering) + pf(lossAmenities) + pf(scarring) + pf(lossExpectation);
  const totalSD = pf(medicalExpenses) + pf(transportCosts) + pf(preLossEarnings) + pf(vehicleRepair) + pf(nursingCare) + pf(aidsAppliances) + pf(funeralExpenses) + pf(otherSpecial);

  const netMonthly = pf(monthlyEarnings) * (1 - pf(epfRate) / 100 - pf(taxRate) / 100);
  const annualLoss = netMonthly * 12;
  const futureLossEarnings = annualLoss * pf(multiplier);
  const totalFuture = futureLossEarnings + pf(futureMedical) + pf(futureNursing) + pf(lossingCapacity);

  const deceasedNet = pf(deceasedMonthly) * (1 - pf(epfRate) / 100 - pf(taxRate) / 100);
  const annualDependency = deceasedNet * 12 * (1 - pf(personalExpPercent) / 100);
  const totalDependency = annualDependency * pf(depMultiplier);
  const totalFatalClaim = totalDependency + pf(bereavement) + pf(estatePS) + totalSD;

  const subtotal = mode === "dependency"
    ? totalFatalClaim
    : totalGD + totalSD + totalFuture;

  const contribPercent = pf(contribNeg);
  const deduction = subtotal * (contribPercent / 100);
  const grandTotal = subtotal - deduction;

  const accidentDate = new Date();
  accidentDate.setFullYear(accidentDate.getFullYear() - 1);
  const monthsSinceAccident = 12;
  const interestGD_rate = 0.05;
  const interestSD_rate = 0.05;
  const interestGD = (mode === "dependency" ? 0 : totalGD) * interestGD_rate * (monthsSinceAccident / 24);
  const interestSD = totalSD * interestSD_rate * (monthsSinceAccident / 12);
  const totalWithInterest = grandTotal + interestGD + interestSD;

  const handleReset = () => {
    setPainSuffering("0"); setLossAmenities("0"); setScarring("0"); setLossExpectation("0");
    setMedicalExpenses("0"); setTransportCosts("0"); setPreLossEarnings("0"); setVehicleRepair("0");
    setNursingCare("0"); setAidsAppliances("0"); setFuneralExpenses("0"); setOtherSpecial("0");
    setMonthlyEarnings("0"); setMultiplier("14"); setFutureMedical("0"); setFutureNursing("0");
    setLossingCapacity("0"); setDeceasedMonthly("0"); setBereavement("30000"); setEstatePS("0");
    setContribNeg("0");
  };

  const modes: { id: CalcMode; label: string }[] = [
    { id: "comprehensive", label: "Full Assessment" },
    { id: "general", label: "Quick (GD + SD)" },
    { id: "earnings", label: "Future Loss" },
    { id: "dependency", label: "Fatal Claim" },
  ];

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Calculator className="h-6 w-6 text-primary" />
        <h2 className="font-serif text-xl font-bold">AI Damages Calculator</h2>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1 text-xs" data-testid="button-reset-calc">
            <RotateCcw className="h-3 w-3" /> Reset
          </Button>
        </div>
      </div>

      {matter && (
        <div className="mb-5 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 text-xs text-muted-foreground space-y-0.5">
          <p className="font-semibold text-foreground text-sm">{matter.title}</p>
          {(matter.clientName || matter.plaintiff) && (
            <p>Client / Plaintiff: {matter.clientName || matter.plaintiff}</p>
          )}
          {matter.defendant && <p>Defendant: {matter.defendant}</p>}
          {matter.caseNo && <p>Case No.: {matter.caseNo}</p>}
          {matter.claimAmount && (
            <p>Claim amount on file: <strong>{matter.claimAmount}</strong> — enter figures in the fields below.</p>
          )}
        </div>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        {modes.map(m => (
          <Button
            key={m.id}
            variant={mode === m.id ? "default" : "outline"}
            size="sm"
            onClick={() => setMode(m.id)}
            className={`text-xs ${mode === m.id ? "bg-primary text-primary-foreground" : ""}`}
            data-testid={`button-mode-${m.id}`}
          >
            {m.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {mode !== "dependency" && (
            <div className="bg-card border border-border rounded-xl p-5">
              <SectionHeader title="General Damages (Non-Pecuniary)" expanded={expandedSections.general} onToggle={() => toggleSection("general")} />
              {expandedSections.general && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <RMInput label="Pain & Suffering" hint="Based on severity: minor fracture RM10k-50k, major RM50k-300k" value={painSuffering} onChange={setPainSuffering} testId="input-pain-suffering" />
                  <RMInput label="Loss of Amenities of Life" hint="Inability to enjoy pre-accident activities and lifestyle" value={lossAmenities} onChange={setLossAmenities} testId="input-loss-amenities" />
                  <RMInput label="Scarring & Disfigurement" hint="Visible scars, especially on face; higher for women and young persons" value={scarring} onChange={setScarring} testId="input-scarring" />
                  <RMInput label="Loss of Expectation of Life" hint="Reduced lifespan due to injuries (fatal/severe cases)" value={lossExpectation} onChange={setLossExpectation} testId="input-loss-expectation" />
                </div>
              )}
            </div>
          )}

          <div className="bg-card border border-border rounded-xl p-5">
            <SectionHeader title="Special Damages (Pecuniary — Must Be Proved)" expanded={expandedSections.special} onToggle={() => toggleSection("special")} />
            {expandedSections.special && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <RMInput label="Medical Expenses" hint="Hospital, specialist, medication, physiotherapy bills" value={medicalExpenses} onChange={setMedicalExpenses} testId="input-medical-exp" />
                <RMInput label="Transport Costs" hint="Ambulance, taxi, mileage to hospital and clinics" value={transportCosts} onChange={setTransportCosts} testId="input-transport" />
                <RMInput label="Pre-Trial Loss of Earnings" hint="Salary/income lost from accident to trial date" value={preLossEarnings} onChange={setPreLossEarnings} testId="input-pre-loss" />
                <RMInput label="Vehicle Repair / Write-Off" hint="Workshop quotation or insurance write-off valuation" value={vehicleRepair} onChange={setVehicleRepair} testId="input-vehicle-repair" />
                <RMInput label="Cost of Nursing Care" hint="Home nursing, caregiver costs during recovery" value={nursingCare} onChange={setNursingCare} testId="input-nursing" />
                <RMInput label="Aids & Appliances" hint="Wheelchair, crutches, prosthetics, special equipment" value={aidsAppliances} onChange={setAidsAppliances} testId="input-aids" />
                <RMInput label="Funeral Expenses" hint="Applicable in fatal accident claims only" value={funeralExpenses} onChange={setFuneralExpenses} testId="input-funeral" />
                <RMInput label="Other Special Damages" hint="Damaged property, clothing, misc. out-of-pocket expenses" value={otherSpecial} onChange={setOtherSpecial} testId="input-other-special" />
              </div>
            )}
          </div>

          {(mode === "comprehensive" || mode === "earnings") && (
            <div className="bg-card border border-border rounded-xl p-5">
              <SectionHeader title="Future Losses (Multiplier-Multiplicand Method)" expanded={expandedSections.future} onToggle={() => toggleSection("future")} />
              {expandedSections.future && (
                <>
                  <div className="bg-muted/30 rounded-lg p-3 mt-3 mb-4 border border-border/50">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        <strong>Multiplicand</strong> = Net annual earnings (after EPF + tax deductions).
                        <strong> Multiplier</strong> = Years of future loss adjusted for contingencies (typically 50-70% of remaining working years).
                        Based on <em>Lim Kok Seng v Lim Ah Lai [1992] 2 MLJ 399</em>.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <RMInput label="Monthly Gross Earnings" hint="Before deductions; include allowances and bonuses (averaged)" value={monthlyEarnings} onChange={setMonthlyEarnings} testId="input-monthly-earnings" />
                    <NumInput label="EPF Contribution Rate (%)" hint="Employee's share: 11% (standard) or 7% (option)" value={epfRate} onChange={setEpfRate} testId="input-epf-rate" />
                    <NumInput label="Income Tax Rate (%)" hint="Effective tax rate based on annual income bracket" value={taxRate} onChange={setTaxRate} testId="input-tax-rate" />
                    <NumInput label="Multiplier (years)" hint="Typical range: 8-18 years depending on plaintiff's age" value={multiplier} onChange={setMultiplier} testId="input-multiplier" />
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 mt-4 space-y-1.5 border border-border/50">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Net monthly earnings (after EPF + tax):</span>
                      <span className="font-mono">{fmt(netMonthly)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Annual loss (multiplicand):</span>
                      <span className="font-mono">{fmt(annualLoss)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold">
                      <span>Future loss of earnings ({fmt(annualLoss)} x {pf(multiplier)} years):</span>
                      <span className="font-mono text-primary">{fmt(futureLossEarnings)}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <RMInput label="Future Medical Costs" hint="Estimated cost of future surgeries, therapy, medication" value={futureMedical} onChange={setFutureMedical} testId="input-future-medical" />
                    <RMInput label="Future Nursing / Care Costs" hint="Long-term care needs for severe disability" value={futureNursing} onChange={setFutureNursing} testId="input-future-nursing" />
                    <RMInput label="Loss of Earning Capacity" hint="Handicap in labour market (if still employed but disadvantaged)" value={lossingCapacity} onChange={setLossingCapacity} testId="input-loss-capacity" />
                  </div>
                </>
              )}
            </div>
          )}

          {mode === "dependency" && (
            <div className="bg-card border border-border rounded-xl p-5">
              <SectionHeader title="Fatal Accident — Dependency Claim (s.7 & s.8 CLA)" expanded={expandedSections.dependency} onToggle={() => toggleSection("dependency")} />
              {expandedSections.dependency || true ? (
                <>
                  <div className="bg-muted/30 rounded-lg p-3 mt-3 mb-4 border border-border/50">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        <strong>Dependency</strong> = (Deceased's net annual income - personal expenses) x multiplier.
                        Personal expenses typically 1/3 if family, 2/3 if single. Bereavement fixed under s.7(3A) CLA 1956.
                        Based on <em>Yew Wan Leong v Lai Kok Chye [1990] 2 MLJ 152</em>.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <RMInput label="Deceased's Monthly Gross Income" hint="Average monthly earnings before death" value={deceasedMonthly} onChange={setDeceasedMonthly} testId="input-deceased-monthly" />
                    <NumInput label="Personal Expenditure (%)" hint="Usually 33% (married w/ family) or 66% (single)" value={personalExpPercent} onChange={setPersonalExpPercent} testId="input-personal-exp" />
                    <NumInput label="Multiplier (years)" hint="Based on deceased's age at death; range 10-18" value={depMultiplier} onChange={setDepMultiplier} testId="input-dep-multiplier" />
                    <NumInput label="Number of Dependants" hint="Spouse, children, parents who were financially dependent" value={numDependants} onChange={setNumDependants} testId="input-num-dependants" />
                    <RMInput label="Bereavement Damages (s.7(3A))" hint="Fixed sum payable to spouse or parents of deceased minor" value={bereavement} onChange={setBereavement} testId="input-bereavement" />
                    <RMInput label="Estate Claim (Pain & Suffering)" hint="If deceased was conscious between accident and death" value={estatePS} onChange={setEstatePS} testId="input-estate-ps" />
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 mt-4 space-y-1.5 border border-border/50">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Deceased's net monthly income:</span>
                      <span className="font-mono">{fmt(deceasedNet)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Annual dependency (after {pf(personalExpPercent)}% personal expenses):</span>
                      <span className="font-mono">{fmt(annualDependency)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold">
                      <span>Total dependency ({fmt(annualDependency)} x {pf(depMultiplier)} years):</span>
                      <span className="font-mono text-primary">{fmt(totalDependency)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Per dependant ({pf(numDependants)} dependants):</span>
                      <span className="font-mono">{fmt(pf(numDependants) > 0 ? totalDependency / pf(numDependants) : 0)}</span>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-primary">Contributory Negligence Deduction</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground block mb-1">Plaintiff's Contributory Negligence (%)</label>
                <p className="text-[10px] text-muted-foreground/70 mb-1">s.12 Civil Law Act 1956 — reduce by proportion of plaintiff's fault</p>
                <input
                  type="range"
                  min="0" max="100" step="5"
                  value={contribNeg}
                  onChange={(e) => setContribNeg(e.target.value)}
                  className="w-full accent-primary"
                  data-testid="slider-contrib-neg"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>0% (no fault)</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
              </div>
              <div className="text-center">
                <span className="text-3xl font-mono font-bold text-primary">{contribNeg}%</span>
                <p className="text-xs text-muted-foreground">deduction</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-card border-2 border-primary/30 rounded-2xl p-6 sticky top-24">
            <h3 className="text-sm font-semibold text-center text-muted-foreground uppercase tracking-wider mb-4">Assessment Summary</h3>

            {mode !== "dependency" && (
              <>
                <SummaryRow label="General Damages" amount={totalGD} />
                <SummaryRow label="Special Damages" amount={totalSD} />
                {(mode === "comprehensive" || mode === "earnings") && (
                  <SummaryRow label="Future Losses" amount={totalFuture} />
                )}
              </>
            )}

            {mode === "dependency" && (
              <>
                <SummaryRow label="Dependency Claim" amount={totalDependency} />
                <SummaryRow label="Bereavement (s.7(3A))" amount={pf(bereavement)} />
                <SummaryRow label="Estate Claim" amount={pf(estatePS)} />
                <SummaryRow label="Special Damages" amount={totalSD} />
              </>
            )}

            <SummaryRow label="Subtotal" amount={subtotal} bold />

            {contribPercent > 0 && (
              <div className="flex justify-between items-center py-1.5 text-red-400">
                <span className="text-sm">Less: {contribPercent}% contrib. neg.</span>
                <span className="font-mono text-sm">- {fmt(deduction)}</span>
              </div>
            )}

            <div className="bg-primary/10 rounded-xl p-4 mt-4 border border-primary/20">
              <p className="text-xs text-center text-muted-foreground mb-1">Total Award (excl. interest)</p>
              <p className="text-3xl font-mono font-bold text-primary text-center" data-testid="text-total-damages">
                {fmt(grandTotal)}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-border space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Interest Estimate</p>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">GD interest (5% p.a. from writ)</span>
                <span className="font-mono">{fmt(interestGD)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">SD interest (5% p.a. from accident)</span>
                <span className="font-mono">{fmt(interestSD)}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold pt-2 border-t border-border">
                <span>Estimated total with interest</span>
                <span className="font-mono text-primary">{fmt(totalWithInterest)}</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quick Reference</p>
              <div className="space-y-1 text-[10px] text-muted-foreground">
                <p>GD Interest: 5% p.a. from service of writ to judgment</p>
                <p>SD Interest: 5% p.a. from date of accident to judgment</p>
                <p>Future losses: No interest (already discounted)</p>
                <p>Costs: To be taxed if not agreed</p>
              </div>
            </div>
          </div>

          <div className="bg-muted/30 rounded-xl p-4 border border-border">
            <h4 className="text-xs font-semibold mb-2 text-primary">Comparable Awards Guide</h4>
            <div className="space-y-1.5 text-[10px] text-muted-foreground">
              <div className="flex justify-between"><span>Whiplash / Soft tissue</span><span className="font-mono">RM 5k - 25k</span></div>
              <div className="flex justify-between"><span>Simple fracture (arm/leg)</span><span className="font-mono">RM 15k - 50k</span></div>
              <div className="flex justify-between"><span>Compound fracture</span><span className="font-mono">RM 30k - 80k</span></div>
              <div className="flex justify-between"><span>Spinal injuries (no paralysis)</span><span className="font-mono">RM 50k - 150k</span></div>
              <div className="flex justify-between"><span>Paraplegia</span><span className="font-mono">RM 150k - 300k</span></div>
              <div className="flex justify-between"><span>Quadriplegia</span><span className="font-mono">RM 250k - 500k</span></div>
              <div className="flex justify-between"><span>Severe head injury / brain damage</span><span className="font-mono">RM 150k - 400k</span></div>
              <div className="flex justify-between"><span>Loss of limb (single)</span><span className="font-mono">RM 80k - 200k</span></div>
              <div className="flex justify-between"><span>Loss of eye (one)</span><span className="font-mono">RM 60k - 120k</span></div>
              <div className="flex justify-between"><span>Multiple injuries (severe)</span><span className="font-mono">RM 100k - 350k</span></div>
              <div className="flex justify-between"><span>Facial scarring (female)</span><span className="font-mono">RM 20k - 80k</span></div>
              <div className="flex justify-between"><span>Loss of teeth</span><span className="font-mono">RM 3k - 15k</span></div>
            </div>
            <p className="text-[9px] text-muted-foreground/50 mt-2 italic">Ranges are indicative. Actual awards depend on specific facts, severity, and plaintiff's circumstances.</p>
          </div>

          <div className="bg-muted/30 rounded-xl p-4 border border-border">
            <h4 className="text-xs font-semibold mb-2 text-primary">Multiplier Guide by Age</h4>
            <div className="space-y-1.5 text-[10px] text-muted-foreground">
              <div className="flex justify-between"><span>20-25 years old</span><span className="font-mono">15 - 18</span></div>
              <div className="flex justify-between"><span>26-30 years old</span><span className="font-mono">14 - 16</span></div>
              <div className="flex justify-between"><span>31-35 years old</span><span className="font-mono">13 - 15</span></div>
              <div className="flex justify-between"><span>36-40 years old</span><span className="font-mono">12 - 14</span></div>
              <div className="flex justify-between"><span>41-45 years old</span><span className="font-mono">10 - 13</span></div>
              <div className="flex justify-between"><span>46-50 years old</span><span className="font-mono">8 - 11</span></div>
              <div className="flex justify-between"><span>51-55 years old</span><span className="font-mono">5 - 8</span></div>
              <div className="flex justify-between"><span>56-60 years old</span><span className="font-mono">3 - 5</span></div>
            </div>
            <p className="text-[9px] text-muted-foreground/50 mt-2 italic">Based on retirement age 60. Adjust for specific occupation, health, and individual circumstances.</p>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-muted/20 border border-border rounded-xl p-4">
        <p className="text-xs text-muted-foreground text-center">
          This calculator provides estimates for reference only. Actual awards are determined by the court based on the specific facts, evidence, and applicable authorities. Always verify calculations against current case law and statutory provisions.
        </p>
      </div>
    </div>
  );
}
