import { useLanguage } from "@/lib/language-context";

type GuidanceKind = "analyzer" | "drafting" | "intake";

const guides: Record<GuidanceKind, {
  title: [string, string]; prepare: Array<[string, string]>; review: Array<[string, string]>;
  example: [string, string]; faqs: Array<[[string, string], [string, string]]>;
}> = {
  analyzer: {
    title: ["Jurisdiction-aware analysis checklist", "Senarai semak analisis mengikut bidang kuasa"],
    prepare: [
      ["State the relevant State or Federal Territory and the court or agency, if known.", "Nyatakan Negeri atau Wilayah Persekutuan serta mahkamah atau agensi, jika diketahui."],
      ["Separate confirmed events, disputed accounts and missing information in a dated chronology.", "Asingkan peristiwa yang disahkan, keterangan yang dipertikaikan dan maklumat yang belum ada dalam kronologi bertarikh."],
      ["Identify the exact question and desired practical outcome without assuming an available remedy.", "Kenal pasti soalan tepat dan hasil praktikal yang dikehendaki tanpa menganggap remedi tertentu tersedia."],
    ],
    review: [
      ["Verify every enactment, rule, fatwa, authority and form with the competent current official source.", "Sahkan setiap enakmen, kaedah, fatwa, autoriti dan borang melalui sumber rasmi semasa yang berbidang kuasa."],
      ["Do not generalise a State-specific source to another jurisdiction.", "Jangan gunakan sumber khusus sesebuah Negeri secara umum untuk bidang kuasa lain."],
      ["Mark religious-source interpretation, legal proposition and factual inference separately for expert review.", "Tandakan tafsiran sumber agama, proposisi undang-undang dan inferens fakta secara berasingan untuk semakan pakar."],
    ],
    example: ["“Jurisdiction: [state]. Confirmed facts: […]. Disputed: […]. Unknown: […]. Analyse issues only and flag each source requiring official verification.”", "“Bidang kuasa: [negeri]. Fakta disahkan: […]. Dipertikaikan: […]. Belum diketahui: […]. Analisis isu sahaja dan tandakan setiap sumber yang perlu disahkan secara rasmi.”"],
    faqs: [
      [["Why must I name the State?", "Mengapa perlu nyatakan Negeri?"], ["Syariah legislation, procedure, institutions and forms can be jurisdiction-specific.", "Perundangan, prosedur, institusi dan borang Syariah boleh berbeza mengikut bidang kuasa."]],
      [["Is the analysis a ruling or fatwa?", "Adakah analisis ini suatu keputusan atau fatwa?"], ["No. It is a working aid and requires qualified, jurisdiction-specific review.", "Tidak. Ia alat kerja yang memerlukan semakan berkelayakan mengikut bidang kuasa."]],
    ],
  },
  drafting: {
    title: ["Local-template drafting checklist", "Senarai semak draf templat tempatan"],
    prepare: [
      ["Obtain the current form or approved local precedent from the competent court or authority.", "Dapatkan borang semasa atau duluan tempatan yang diluluskan daripada mahkamah atau pihak berkuasa berbidang kuasa."],
      ["Confirm jurisdiction, proceeding type, party capacities, language and requested outcome.", "Sahkan bidang kuasa, jenis prosiding, kapasiti pihak, bahasa dan hasil yang dimohon."],
      ["Supply verified facts and leave unknown particulars as visible placeholders.", "Berikan fakta yang disahkan dan biarkan butiran yang belum diketahui sebagai ruang letak yang jelas."],
    ],
    review: [
      ["Compare headings, mandatory fields, execution and attachments line by line with the verified local template.", "Bandingkan tajuk, medan wajib, penyempurnaan dan lampiran baris demi baris dengan templat tempatan yang disahkan."],
      ["Check names, dates, amounts, citations and translations against source documents.", "Semak nama, tarikh, amaun, rujukan dan terjemahan berdasarkan dokumen sumber."],
      ["Confirm filing, fees, service and registry practice directly before use.", "Sahkan pemfailan, fi, penyampaian dan amalan pendaftar secara langsung sebelum digunakan."],
    ],
    example: ["“Follow the uploaded verified template structure. Draft only [sections]. Insert [VERIFY] for every unsupported particular.”", "“Ikut struktur templat disahkan yang dimuat naik. Draf hanya [bahagian]. Masukkan [SAHKAN] bagi setiap butiran tanpa sokongan.”"],
    faqs: [
      [["Is a portal template universal?", "Adakah templat portal terpakai secara universal?"], ["No. Confirm State, court, case type, version and registry acceptance.", "Tidak. Sahkan Negeri, mahkamah, jenis kes, versi dan penerimaan pendaftar."]],
      [["May AI complete missing facts?", "Bolehkah AI melengkapkan fakta yang tiada?"], ["No. Use placeholders and obtain instructions or documents.", "Tidak. Gunakan ruang letak dan dapatkan arahan atau dokumen."]],
    ],
  },
  intake: {
    title: ["Client-intake file checklist", "Senarai semak fail pengambilan klien"],
    prepare: [
      ["Record identity, contact preference, relationships, jurisdiction and any interpreter or accessibility need.", "Catat identiti, pilihan hubungan, pertalian, bidang kuasa serta keperluan jurubahasa atau aksesibiliti."],
      ["Capture the client’s account in their own words, then create a separate dated chronology.", "Rekod keterangan klien dengan kata-kata mereka sendiri, kemudian sediakan kronologi bertarikh secara berasingan."],
      ["List documents held, documents missing, other proceedings and urgent practical concerns without promising an outcome.", "Senaraikan dokumen yang ada dan tiada, prosiding lain serta kebimbangan praktikal segera tanpa menjanjikan hasil."],
    ],
    review: [
      ["Distinguish client instructions from documents, third-party accounts and practitioner inference.", "Bezakan arahan klien daripada dokumen, keterangan pihak ketiga dan inferens pengamal."],
      ["Complete conflict, capacity, authority, confidentiality and safeguarding checks under office procedure.", "Lengkapkan semakan konflik, kapasiti, kuasa, kerahsiaan dan perlindungan mengikut prosedur pejabat."],
      ["Verify every date or procedural urgency independently and assign a responsible reviewer.", "Sahkan setiap tarikh atau perkara prosedur mendesak secara bebas dan tetapkan penyemak bertanggungjawab."],
    ],
    example: ["Intake note: “Client says […]. Document seen: […]. Not yet verified: […]. Follow-up owner: […].”", "Nota pengambilan: “Klien menyatakan […]. Dokumen dilihat: […]. Belum disahkan: […]. Pegawai susulan: […].”"],
    faqs: [
      [["Should the generated brief replace attendance notes?", "Patutkah ringkasan dijana menggantikan nota kehadiran?"], ["No. Retain the original record and review the brief against it.", "Tidak. Simpan rekod asal dan semak ringkasan berdasarkan rekod tersebut."]],
      [["What if the client is unsure?", "Bagaimana jika klien tidak pasti?"], ["Record the uncertainty; do not convert it into a definite fact.", "Catat ketidakpastian; jangan menukarkannya menjadi fakta muktamad."]],
    ],
  },
};

export function SyariahToolGuidance({ kind }: { kind: GuidanceKind }) {
  const { mode } = useLanguage();
  const pick = ([en, bm]: [string, string]) => mode === "bm" ? bm : en;
  const g = guides[kind];
  return (
    <section className="rounded-lg border border-secondary/20 bg-card/50 p-5 space-y-4" data-testid={`guidance-${kind}`}>
      <div><p className="text-[11px] uppercase tracking-widest font-semibold text-secondary">{pick(["Practice preparation", "Persediaan amalan"])}</p><h2 className="font-serif text-lg font-semibold">{pick(g.title)}</h2><p className="text-xs text-muted-foreground mt-1">{pick(["Original working aid only—not an official form, ruling, fatwa or confirmation of current law.", "Alat kerja asal sahaja—bukan borang rasmi, keputusan, fatwa atau pengesahan undang-undang semasa."])}</p></div>
      <div className="grid md:grid-cols-2 gap-4">
        <div><h3 className="text-sm font-medium mb-2">{pick(["Prepare", "Sediakan"])}</h3><ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1.5">{g.prepare.map((x) => <li key={x[0]}>{pick(x)}</li>)}</ul></div>
        <div><h3 className="text-sm font-medium mb-2">{pick(["Review", "Semak"])}</h3><ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1.5">{g.review.map((x) => <li key={x[0]}>{pick(x)}</li>)}</ul></div>
      </div>
      <div className="rounded-md bg-muted/40 p-3 text-xs"><span className="font-medium">{pick(["Example: ", "Contoh: "])}</span><span className="text-muted-foreground">{pick(g.example)}</span></div>
      <details className="text-xs"><summary className="cursor-pointer font-medium">{pick(["Quick FAQ", "Soalan lazim ringkas"])}</summary><div className="pt-2 space-y-2">{g.faqs.map(([q, a]) => <div key={q[0]}><p className="font-medium">{pick(q)}</p><p className="text-muted-foreground">{pick(a)}</p></div>)}</div></details>
    </section>
  );
}