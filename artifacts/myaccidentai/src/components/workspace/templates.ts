export type CaseDetails = {
  court: string;
  suitNo: string;
  year: string;
  plaintiffName: string;
  plaintiffIc: string;
  plaintiffAddress: string;
  defendantName: string;
  defendantIc: string;
  defendantAddress: string;
  insurerName: string;
  insurerAddress: string;
  accidentDate: string;
  accidentTime: string;
  accidentPlace: string;
  plaintiffVehicle: string;
  defendantVehicle: string;
  policeReportNo: string;
  injuriesSummary: string;
  specialDamages: string;
  generalDamagesEstimate: string;
  solicitorName: string;
  solicitorFirm: string;
  solicitorAddress: string;
  filingDate: string;
};

export const defaultCase: CaseDetails = {
  court: "MAHKAMAH SESYEN DI KUALA LUMPUR",
  suitNo: "B52NCvC-",
  year: new Date().getFullYear().toString(),
  plaintiffName: "AHMAD BIN ABDULLAH",
  plaintiffIc: "850101-14-1234",
  plaintiffAddress: "No. 12, Jalan Mawar 3, Taman Mawar, 50000 Kuala Lumpur",
  defendantName: "TAN AH KOW",
  defendantIc: "780505-10-5678",
  defendantAddress: "No. 45, Jalan Bunga Raya, 47000 Sungai Buloh, Selangor",
  insurerName: "ETIQA GENERAL INSURANCE BERHAD",
  insurerAddress: "Level 19, Tower C, Dataran Maybank, 59000 Kuala Lumpur",
  accidentDate: "15 March 2025",
  accidentTime: "8:30 a.m.",
  accidentPlace: "Jalan Tun Razak, Kuala Lumpur (in front of KLCC)",
  plaintiffVehicle: "Perodua Myvi WXY 1234",
  defendantVehicle: "Toyota Hilux ABC 5678",
  policeReportNo: "Dang Wangi/000123/25",
  injuriesSummary: "Fracture of right tibia and fibula, soft tissue injuries to neck and lower back, multiple abrasions",
  specialDamages: "RM 18,500.00 (medical bills, transport, vehicle repair, loss of earnings during MC)",
  generalDamagesEstimate: "RM 85,000.00",
  solicitorName: "Tetuan Solicitor & Co.",
  solicitorFirm: "Tetuan Solicitor & Co.",
  solicitorAddress: "Suite 12-3, Wisma Cosway, 50450 Kuala Lumpur",
  filingDate: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }),
};

const heading = (c: CaseDetails) => `DALAM ${c.court}
DALAM NEGERI WILAYAH PERSEKUTUAN, MALAYSIA
GUAMAN SIVIL NO: ${c.suitNo}${c.year}

ANTARA

${c.plaintiffName.toUpperCase()}
(NO. K/P: ${c.plaintiffIc})                                     ... PLAINTIF

DAN

${c.defendantName.toUpperCase()}
(NO. K/P: ${c.defendantIc})                                     ... DEFENDAN
`;

const sig = (c: CaseDetails) => `
Bertarikh pada ${c.filingDate}.

                                         ........................................
                                         ${c.solicitorFirm}
                                         Peguamcara bagi pihak Plaintif
                                         ${c.solicitorAddress}

This document is filed by ${c.solicitorFirm}, solicitors for the Plaintiff,
whose address for service is at ${c.solicitorAddress}.
`;

export type TemplateDef = {
  id: string;
  name: string;
  category: string;
  desc: string;
  build: (c: CaseDetails) => string;
};

export const templates: TemplateDef[] = [
  {
    id: "writ-summons",
    name: "Writ of Summons (Form 2)",
    category: "Pleadings",
    desc: "Originating process commencing the action under O.6 ROC 2012",
    build: (c) => `${heading(c)}

WRIT SAMAN
(Borang 2 — Aturan 6, Kaedah-Kaedah Mahkamah 2012)

KEPADA: ${c.defendantName.toUpperCase()}
        ${c.defendantAddress}

KAMI MEMERINTAHKAN bahawa dalam tempoh LAPAN BELAS (18) HARI selepas penyampaian Writ ini ke atas kamu, eksklusif daripada hari penyampaian, kamu hendaklah memasukkan Memorandum Kehadiran di Pejabat Pendaftar Mahkamah ini.

DAN AMBIL PERHATIAN bahawa jika kamu gagal berbuat demikian, Plaintif boleh meneruskan tindakan ini dan penghakiman boleh diberikan terhadap kamu tanpa notis lanjut kepada kamu.

Tuntutan Plaintif adalah seperti yang dinyatakan dalam Pernyataan Tuntutan yang dilampirkan.

Bertarikh pada ${c.filingDate}.

                                         ........................................
                                         PENDAFTAR

Diendorskan oleh:
${c.solicitorFirm}
${c.solicitorAddress}
Peguamcara bagi pihak Plaintif
${sig(c)}`,
  },
  {
    id: "soc-mva",
    name: "Statement of Claim (MVA — Driver)",
    category: "Pleadings",
    desc: "Pernyataan Tuntutan for plaintiff driver injured in motor vehicle accident",
    build: (c) => `${heading(c)}

PERNYATAAN TUNTUTAN

1.  Plaintif pada setiap masa material kepada tindakan ini adalah seorang dewasa warganegara Malaysia dan pemandu/pemilik berdaftar kenderaan jenama ${c.plaintiffVehicle}.

2.  Defendan pada setiap masa material adalah pemandu dan/atau pemilik berdaftar kenderaan jenama ${c.defendantVehicle}, yang telah diinsuranskan dengan ${c.insurerName} di bawah polisi insurans pihak ketiga sebagaimana dikehendaki oleh Akta Pengangkutan Jalan 1987.

3.  Pada ${c.accidentDate} lebih kurang jam ${c.accidentTime}, di ${c.accidentPlace}, satu kemalangan jalan raya telah berlaku di antara kenderaan Plaintif dengan kenderaan yang dipandu oleh Defendan.

4.  Kemalangan tersebut adalah disebabkan sepenuhnya atau sebaliknya oleh kecuaian Defendan.

BUTIR-BUTIR KECUAIAN DEFENDAN
   (a) Memandu pada kelajuan yang melampau dalam keadaan tersebut;
   (b) Gagal memerhati atau memerhati dengan secukupnya kehadiran kenderaan Plaintif;
   (c) Gagal mengawal kenderaannya;
   (d) Gagal menggunakan brek pada bila-bila masa atau pada masa yang munasabah;
   (e) Gagal memberi laluan kepada kenderaan Plaintif;
   (f) Gagal mengelakkan perlanggaran apabila dengan menjalankan penjagaan munasabah beliau dapat dan sepatutnya berbuat demikian;
   (g) Memandu dengan cara yang membahayakan pengguna jalan raya yang lain.

Plaintif merujuk kepada Laporan Polis No: ${c.policeReportNo} bertarikh ${c.accidentDate}.

5.  Akibat daripada kecuaian Defendan tersebut, Plaintif telah mengalami kecederaan, kerugian dan kerosakan.

BUTIR-BUTIR KECEDERAAN
   ${c.injuriesSummary}

(Plaintif merujuk kepada Laporan Perubatan yang akan dikemukakan pada perbicaraan.)

BUTIR-BUTIR GANTI RUGI KHAS
   ${c.specialDamages}

6.  Plaintif juga menuntut ganti rugi am bagi kesakitan dan kesusahan yang dialami serta kehilangan keupayaan mendapat pendapatan pada masa hadapan, dianggarkan pada ${c.generalDamagesEstimate}.

7.  Plaintif menuntut faedah ke atas amaun yang diawardkan menurut s.11 Akta Undang-Undang Sivil 1956.

OLEH YANG DEMIKIAN PLAINTIF MENUNTUT TERHADAP DEFENDAN:
   (a) Ganti rugi am;
   (b) Ganti rugi khas berjumlah ${c.specialDamages};
   (c) Faedah pada kadar 5% setahun dari tarikh kemalangan sehingga tarikh penghakiman bagi ganti rugi am;
   (d) Faedah pada kadar 4% setahun dari tarikh writ sehingga tarikh penghakiman bagi ganti rugi khas;
   (e) Faedah pada kadar 5% setahun dari tarikh penghakiman sehingga penyelesaian sepenuhnya;
   (f) Kos tindakan ini;
   (g) Apa-apa relief lain yang Mahkamah Yang Mulia ini fikirkan adil dan suaimanfaat.
${sig(c)}`,
  },
  {
    id: "memo-appearance",
    name: "Memorandum of Appearance (Form 11)",
    category: "Pleadings",
    desc: "Defendant's appearance under O.12 ROC 2012 (must file within 14 days)",
    build: (c) => `${heading(c)}

MEMORANDUM KEHADIRAN
(Borang 11 — Aturan 12, Kaedah-Kaedah Mahkamah 2012)

KEPADA: PENDAFTAR Mahkamah tersebut di atas
        DAN KEPADA Peguamcara bagi pihak Plaintif

SILA AMBIL NOTIS bahawa Defendan, ${c.defendantName.toUpperCase()}, hadir dalam tindakan ini.

Alamat Defendan untuk penyampaian dokumen ialah:
${c.defendantAddress}

Bertarikh pada ${c.filingDate}.

                                         ........................................
                                         Peguamcara bagi pihak Defendan
`,
  },
  {
    id: "defence-mva",
    name: "Statement of Defence (MVA)",
    category: "Pleadings",
    desc: "Standard defence denying negligence and pleading contributory negligence",
    build: (c) => `${heading(c)}

PERNYATAAN PEMBELAAN

1.  Defendan mengaku perenggan 1, 2 dan 3 Pernyataan Tuntutan setakat berlakunya kemalangan jalan raya pada tarikh, masa dan tempat tersebut, tetapi menafikan bahawa kemalangan itu disebabkan oleh kecuaian Defendan sebagaimana yang dikatakan atau langsung.

2.  Defendan menafikan setiap dan kesemua butir-butir kecuaian dalam perenggan 4 Pernyataan Tuntutan dan menghendaki bukti yang ketat daripadanya.

3.  Sebagai alternatif, jika Defendan didapati cuai (yang dinafikan), Defendan menyatakan bahawa kemalangan tersebut disebabkan sepenuhnya atau sebahagiannya oleh kecuaian Plaintif sendiri.

BUTIR-BUTIR KECUAIAN PLAINTIF
   (a) Memandu pada kelajuan yang melampau;
   (b) Gagal memerhati atau memerhati dengan secukupnya kehadiran kenderaan Defendan;
   (c) Gagal mengawal kenderaannya;
   (d) Gagal menggunakan brek pada bila-bila masa atau pada masa yang munasabah;
   (e) Memasuki simpang/persimpangan tanpa berhenti atau memberi laluan;
   (f) Gagal mengelakkan perlanggaran apabila dengan menjalankan penjagaan munasabah beliau dapat dan sepatutnya berbuat demikian.

4.  Defendan tidak mengakui kecederaan, kerugian dan kerosakan dalam perenggan 5 Pernyataan Tuntutan dan menghendaki bukti yang ketat daripadanya.

5.  Defendan tidak mengakui butir-butir ganti rugi khas yang dituntut dan menghendaki bukti dokumentari yang ketat.

6.  Save as expressly admitted, Defendan menafikan setiap dakwaan dalam Pernyataan Tuntutan seolah-olah disebut secara seriatim dan dinafikan secara seriatim.

OLEH YANG DEMIKIAN, DEFENDAN MEMOHON tindakan Plaintif ditolak dengan kos.

Bertarikh pada ${c.filingDate}.

                                         ........................................
                                         Peguamcara bagi pihak Defendan
`,
  },
  {
    id: "s96-notice",
    name: "Notice of Demand under s.96 RTA 1987",
    category: "Pre-Action",
    desc: "Mandatory pre-action notice to insurer before commencing action",
    build: (c) => `${c.solicitorFirm.toUpperCase()}
${c.solicitorAddress}

Tarikh: ${c.filingDate}

Pengurus Tuntutan
${c.insurerName}
${c.insurerAddress}

Tuan,

NOTIS DI BAWAH SEKSYEN 96(2) AKTA PENGANGKUTAN JALAN 1987
INSURED       : ${c.defendantName.toUpperCase()} (NO. K/P: ${c.defendantIc})
KENDERAAN     : ${c.defendantVehicle}
TARIKH KEMALANGAN: ${c.accidentDate}
TEMPAT        : ${c.accidentPlace}
ANAK GUAM KAMI: ${c.plaintiffName.toUpperCase()} (NO. K/P: ${c.plaintiffIc})

Dengan hormatnya kami merujuk kepada perkara di atas.

1.  Kami bertindak bagi pihak ${c.plaintiffName.toUpperCase()} ("anak guam kami") yang telah cedera akibat kemalangan jalan raya yang berlaku pada ${c.accidentDate} pada lebih kurang ${c.accidentTime} di ${c.accidentPlace}.

2.  Kemalangan tersebut melibatkan kenderaan anak guam kami, ${c.plaintiffVehicle}, dan kenderaan ${c.defendantVehicle} yang dipandu oleh ${c.defendantName.toUpperCase()} dan diinsuranskan dengan tuan.

3.  Berdasarkan Laporan Polis No: ${c.policeReportNo}, kemalangan tersebut adalah disebabkan oleh kecuaian pemandu kenderaan yang diinsuranskan oleh tuan.

4.  Akibat daripada kemalangan tersebut, anak guam kami telah mengalami kecederaan-kecederaan berikut:
    ${c.injuriesSummary}

5.  Anak guam kami juga telah mengalami kerugian dan perbelanjaan, antaranya: ${c.specialDamages}.

6.  TAKE NOTICE bahawa notis ini diberikan menurut Seksyen 96(2) Akta Pengangkutan Jalan 1987 mengenai niat anak guam kami untuk membuat tuntutan terhadap pemandu/pemilik kenderaan yang diinsuranskan oleh pihak tuan.

7.  Sila ambil maklum bahawa tindakan undang-undang akan diambil sekiranya tiada penyelesaian dicapai dalam tempoh dua (2) bulan dari tarikh notis ini.

Sila hubungi pejabat kami untuk perbincangan lanjut.

Sekian, terima kasih.

Yang benar,

........................................
${c.solicitorFirm}
Peguamcara bagi pihak ${c.plaintiffName.toUpperCase()}

s.k.: Anak guam
`,
  },
  {
    id: "demand-letter",
    name: "Letter of Demand (Personal Injury)",
    category: "Pre-Action",
    desc: "Pre-action letter setting out claim and demanding compensation",
    build: (c) => `${c.solicitorFirm.toUpperCase()}
${c.solicitorAddress}

Tarikh: ${c.filingDate}

${c.defendantName.toUpperCase()}
${c.defendantAddress}

Tuan/Puan,

PER: KEMALANGAN JALAN RAYA PADA ${c.accidentDate} DI ${c.accidentPlace}
     ANAK GUAM KAMI: ${c.plaintiffName.toUpperCase()}
     LAPORAN POLIS NO: ${c.policeReportNo}

Kami bertindak bagi pihak ${c.plaintiffName.toUpperCase()} ("anak guam kami") berkenaan perkara di atas.

1.  Pada ${c.accidentDate} pada lebih kurang ${c.accidentTime}, anak guam kami sedang memandu kenderaan ${c.plaintiffVehicle} di ${c.accidentPlace} apabila kenderaan tuan, ${c.defendantVehicle}, telah berlanggar dengan kenderaan anak guam kami.

2.  Berdasarkan keterangan yang ada, kemalangan tersebut adalah disebabkan oleh kecuaian tuan, antara lain memandu pada kelajuan yang melampau, gagal mengawal kenderaan tuan, dan gagal memerhati kenderaan anak guam kami.

3.  Akibat daripada kecuaian tuan, anak guam kami telah mengalami kecederaan-kecederaan berikut: ${c.injuriesSummary}.

4.  Anak guam kami juga telah mengalami kerugian khas berjumlah ${c.specialDamages} serta berhak menuntut ganti rugi am yang dianggarkan pada ${c.generalDamagesEstimate}.

5.  KAMI DENGAN INI MENUNTUT bahawa tuan membayar pampasan sepenuhnya kepada anak guam kami dalam tempoh empat belas (14) hari dari tarikh surat ini.

6.  Sekiranya tuan gagal mematuhi tuntutan ini, kami diberi arahan untuk memulakan tindakan undang-undang terhadap tuan tanpa notis lanjut, di mana kos dan faedah akan turut dituntut.

Sekian, terima kasih.

Yang benar,

........................................
${c.solicitorFirm}
Peguamcara bagi pihak ${c.plaintiffName.toUpperCase()}
`,
  },
  {
    id: "noa-interim-payment",
    name: "Notice of Application — Interim Payment (O.29 r.10)",
    category: "Interlocutory",
    desc: "Application for interim payment of damages before trial",
    build: (c) => `${heading(c)}

NOTIS PERMOHONAN
(Aturan 29, Kaedah 10, Kaedah-Kaedah Mahkamah 2012)

AMBIL NOTIS bahawa Mahkamah Yang Mulia ini akan dipohon pada hari ............ haribulan ............ pada jam ............ pagi atau sebaik sahaja kemudian daripada itu sepertimana yang Plaintif boleh didengar, oleh peguamcara bagi pihak Plaintif untuk satu PERINTAH bahawa:

1.  Defendan hendaklah membayar kepada Plaintif sejumlah RM ............ sebagai bayaran pendahuluan ke atas kerosakan yang akan dianggar oleh Mahkamah ini;

2.  Bayaran tersebut dibuat dalam tempoh empat belas (14) hari dari tarikh perintah ini;

3.  Kos permohonan ini ditanggung oleh Defendan;

4.  Lain-lain perintah dan/atau relief yang Mahkamah Yang Mulia ini fikirkan adil dan suaimanfaat.

Permohonan ini adalah berdasarkan kepada:
   (a) Aturan 29 Kaedah 10, 11 dan 12 Kaedah-Kaedah Mahkamah 2012;
   (b) Afidavit Sokongan Plaintif yang difailkan bersama;
   (c) Bidangkuasa kebawaan (inherent jurisdiction) Mahkamah Yang Mulia ini.

ALASAN PERMOHONAN:
   (i) Plaintif berkemungkinan akan mendapat penghakiman bagi ganti rugi yang besar terhadap Defendan;
   (ii) Defendan diinsuranskan berkenaan liabiliti tersebut;
   (iii) Plaintif berada dalam keperluan kewangan akibat kecederaan dan kehilangan pendapatan;
   (iv) Adalah adil dan munasabah untuk satu pembayaran pendahuluan diperintahkan.
${sig(c)}`,
  },
  {
    id: "affidavit-interim",
    name: "Affidavit in Support of Interim Payment",
    category: "Interlocutory",
    desc: "Plaintiff's affidavit supporting interim payment application",
    build: (c) => `${heading(c)}

AFIDAVIT SOKONGAN

Saya, ${c.plaintiffName.toUpperCase()} (NO. K/P: ${c.plaintiffIc}), warganegara Malaysia, beralamat di ${c.plaintiffAddress}, dengan sesungguhnya berikrar dan mengaku seperti berikut:

1.  Saya adalah Plaintif dalam tindakan ini dan saya membuat afidavit ini bagi pihak diri saya sendiri.

2.  Fakta-fakta yang saya ikrarkan di sini adalah dalam pengetahuan peribadi saya kecuali yang dinyatakan sebaliknya, dan dalam mana fakta tersebut bukan dalam pengetahuan peribadi saya, ia adalah benar mengikut kepercayaan saya.

3.  Pada ${c.accidentDate} pada lebih kurang ${c.accidentTime}, saya sedang memandu kenderaan ${c.plaintiffVehicle} di ${c.accidentPlace} apabila kenderaan Defendan, ${c.defendantVehicle}, telah berlanggar dengan kenderaan saya.

4.  Akibat daripada kemalangan tersebut, saya telah mengalami kecederaan-kecederaan berikut: ${c.injuriesSummary}. Sesalinan Laporan Perubatan saya dilampirkan dan ditandakan sebagai EKSIBIT "P-1".

5.  Liabiliti Defendan adalah jelas berdasarkan Laporan Polis No: ${c.policeReportNo} yang dilampirkan sebagai EKSIBIT "P-2".

6.  Defendan diinsuranskan dengan ${c.insurerName} di bawah polisi insurans pihak ketiga.

7.  Sehingga tarikh ini, saya telah menanggung perbelanjaan rawatan perubatan dan kerugian pendapatan berjumlah ${c.specialDamages}. Sesalinan resit-resit dilampirkan sebagai EKSIBIT "P-3".

8.  Saya tidak dapat bekerja sejak tarikh kemalangan dan menghadapi kesukaran kewangan untuk meneruskan rawatan perubatan saya yang berterusan.

9.  Saya merayu kepada Mahkamah Yang Mulia ini untuk memerintahkan satu bayaran pendahuluan agar saya dapat meneruskan rawatan dan menyara keluarga saya sehingga perbicaraan dijalankan.

10. Oleh yang demikian, saya memohon perintah dalam terma-terma Notis Permohonan yang difailkan bersama ini.

Diikrarkan oleh ${c.plaintiffName.toUpperCase()})
yang dikenali oleh saya          )
di ${c.accidentPlace.split(",")[0]}        )      ........................................
pada ${c.filingDate}            )      Pendeposit

Di hadapan saya,

........................................
PESURUHJAYA SUMPAH
`,
  },
  {
    id: "noa-summary-judgment",
    name: "Notice of Application — Summary Judgment (O.14)",
    category: "Interlocutory",
    desc: "Application for summary judgment where defence has no merit",
    build: (c) => `${heading(c)}

NOTIS PERMOHONAN
(Aturan 14, Kaedah-Kaedah Mahkamah 2012)

AMBIL NOTIS bahawa Mahkamah Yang Mulia ini akan dipohon pada hari ............ haribulan ............ pada jam ............ pagi atau sebaik sahaja kemudian daripada itu sepertimana yang Plaintif boleh didengar, oleh peguamcara bagi pihak Plaintif untuk satu PERINTAH bahawa:

1.  Penghakiman terus dimasukkan terhadap Defendan untuk:
    (a) Liabiliti penuh atas tuntutan Plaintif; dan
    (b) Ganti rugi untuk dianggar oleh Mahkamah;

2.  Kos permohonan ini ditanggung oleh Defendan;

3.  Lain-lain perintah yang Mahkamah Yang Mulia ini fikirkan adil dan suaimanfaat.

Permohonan ini adalah berdasarkan kepada:
   (a) Aturan 14 Kaedah-Kaedah Mahkamah 2012;
   (b) Afidavit Sokongan yang difailkan bersama;
   (c) Bidangkuasa kebawaan Mahkamah.

ALASAN PERMOHONAN:
   (i) Defendan tidak mempunyai pembelaan yang bermerit terhadap tuntutan Plaintif;
   (ii) Liabiliti adalah jelas berdasarkan Laporan Polis No: ${c.policeReportNo};
   (iii) Tiada isu yang patut dibicarakan.
${sig(c)}`,
  },
  {
    id: "noa-striking-out",
    name: "Notice of Application — Striking Out (O.18 r.19)",
    category: "Interlocutory",
    desc: "Application to strike out pleadings disclosing no reasonable cause of action",
    build: (c) => `${heading(c)}

NOTIS PERMOHONAN
(Aturan 18 Kaedah 19, Kaedah-Kaedah Mahkamah 2012)

AMBIL NOTIS bahawa Mahkamah Yang Mulia ini akan dipohon untuk satu PERINTAH bahawa:

1.  ${"<<Pernyataan Tuntutan Plaintif>>"} dibatalkan/dipotong/dihapuskan menurut Aturan 18 Kaedah 19(1)(a), (b), (c) dan/atau (d) Kaedah-Kaedah Mahkamah 2012 atas alasan bahawa ia:
    (a) Tidak mendedahkan kausa tindakan/pembelaan yang munasabah;
    (b) Adalah remeh, mengganggu atau menyusahkan;
    (c) Mungkin memprejudiskan, memalukan atau melengahkan perbicaraan adil tindakan ini; dan/atau
    (d) Adalah satu penyalahgunaan proses Mahkamah;

2.  Tindakan ini ditolak;

3.  Kos permohonan dan tindakan ditanggung oleh Plaintif/Defendan;

4.  Lain-lain perintah yang Mahkamah Yang Mulia ini fikirkan adil dan suaimanfaat.

Permohonan ini adalah berdasarkan kepada:
   (a) Aturan 18 Kaedah 19 KKM 2012;
   (b) Afidavit Sokongan yang difailkan bersama;
   (c) Bidangkuasa kebawaan Mahkamah.
${sig(c)}`,
  },
  {
    id: "noa-discovery",
    name: "Notice of Application — Discovery (O.24 r.3)",
    category: "Interlocutory",
    desc: "Application for discovery of documents",
    build: (c) => `${heading(c)}

NOTIS PERMOHONAN
(Aturan 24 Kaedah 3, Kaedah-Kaedah Mahkamah 2012)

AMBIL NOTIS bahawa Mahkamah Yang Mulia ini akan dipohon untuk satu PERINTAH bahawa:

1.  Defendan dalam tempoh empat belas (14) hari dari tarikh perintah ini hendaklah membuat dan menyampaikan kepada Plaintif satu afidavit penzahiran (affidavit of discovery) menyatakan dokumen-dokumen yang ada dalam jagaan, milik atau kuasa Defendan berkenaan dengan perkara dalam tindakan ini, termasuk tetapi tidak terhad kepada:

    (a) Polisi insurans bagi kenderaan ${c.defendantVehicle};
    (b) Laporan tuntutan dalaman insurans;
    (c) Kenyataan saksi-saksi yang diambil;
    (d) Gambar-gambar tempat kejadian dan kenderaan;
    (e) Laporan pemeriksaan kenderaan;
    (f) Apa-apa dokumen lain yang berkaitan dengan kemalangan pada ${c.accidentDate};

2.  Defendan hendaklah membenarkan Plaintif memeriksa dan membuat salinan dokumen-dokumen tersebut;

3.  Kos permohonan ini ditanggung oleh Defendan;

4.  Lain-lain perintah yang Mahkamah Yang Mulia ini fikirkan adil dan suaimanfaat.
${sig(c)}`,
  },
  {
    id: "noa-default-judgment",
    name: "Notice of Application — Default Judgment (O.13/O.19)",
    category: "Interlocutory",
    desc: "Application to enter default judgment for failure to appear or file defence",
    build: (c) => `${heading(c)}

NOTIS PERMOHONAN
(Aturan 13/19, Kaedah-Kaedah Mahkamah 2012)

AMBIL NOTIS bahawa Mahkamah Yang Mulia ini akan dipohon untuk satu PERINTAH bahawa:

1.  Penghakiman ingkar dimasukkan terhadap Defendan atas alasan kegagalan Defendan untuk memasukkan kehadiran/memfailkan pembelaan dalam tempoh yang ditetapkan oleh Kaedah-Kaedah Mahkamah 2012;

2.  Penghakiman dimasukkan untuk:
    (a) Liabiliti penuh; dan
    (b) Ganti rugi untuk dianggar;

3.  Kos permohonan ditanggung oleh Defendan;

4.  Lain-lain perintah yang Mahkamah Yang Mulia ini fikirkan adil dan suaimanfaat.

ALASAN:
   (i) Writ Saman dan Pernyataan Tuntutan telah disampaikan kepada Defendan pada ............;
   (ii) Tempoh untuk memasukkan kehadiran/memfailkan pembelaan telah luput;
   (iii) Sehingga tarikh ini, Defendan masih gagal memasukkan kehadiran/memfailkan pembelaan.
${sig(c)}`,
  },
  {
    id: "noa-third-party",
    name: "Third Party Notice (O.16)",
    category: "Pleadings",
    desc: "Notice bringing in third party for contribution or indemnity",
    build: (c) => `${heading(c)}

NOTIS PIHAK KETIGA
(Aturan 16, Kaedah-Kaedah Mahkamah 2012)

KEPADA: <<Nama Pihak Ketiga>>
        <<Alamat Pihak Ketiga>>

AMBIL NOTIS bahawa tindakan ini telah dimulakan oleh Plaintif terhadap Defendan. Sesalinan Writ Saman dan Pernyataan Tuntutan dilampirkan.

Defendan menuntut terhadap pihak kamu sebagai Pihak Ketiga untuk:
   (a) Sumbangan (contribution) di bawah s.10(1)(c) Akta Undang-Undang Sivil 1956 sehingga keseluruhan amaun yang Defendan didapati bertanggungjawab kepada Plaintif; dan/atau
   (b) Indemniti penuh atas alasan bahawa kemalangan tersebut adalah disebabkan sepenuhnya atau sebahagian besar oleh kecuaian pihak kamu.

BUTIR-BUTIR
   (i) Pada ${c.accidentDate} pada lebih kurang ${c.accidentTime}, satu kemalangan jalan raya berlaku di ${c.accidentPlace};
   (ii) Kenderaan kamu, <<vehicle no>>, terlibat dalam kemalangan tersebut;
   (iii) Kecuaian kamu adalah penyebab utama kemalangan tersebut.

JIKA kamu ingin mempertikaikan tuntutan Plaintif terhadap Defendan atau tuntutan Defendan terhadap kamu, kamu hendaklah memasukkan kehadiran dalam tempoh empat belas (14) hari selepas penyampaian Notis ini.

JIKA kamu gagal berbuat demikian, kamu akan dianggap mengakui kesahihan apa-apa penghakiman yang diberikan terhadap Defendan dan haknya untuk indemniti/sumbangan terhadap kamu.
${sig(c)}`,
  },
  {
    id: "scott-schedule",
    name: "Scott Schedule (Special Damages)",
    category: "Court Documents",
    desc: "Itemized table of special damages required under O.22A ROC 2012",
    build: (c) => `${heading(c)}

JADUAL SCOTT (SCOTT SCHEDULE)
GANTI RUGI KHAS

Disediakan menurut Aturan 22A Kaedah-Kaedah Mahkamah 2012

+------+----------------------------------------+----------+----------+----------+
| Bil  | Item / Description                     | Tuntutan | Cadangan | Catatan  |
|      |                                        | Plaintif | Defendan |          |
+------+----------------------------------------+----------+----------+----------+
| 1    | Bil hospital (rujuk Eksibit P-1)       |  RM      |  RM      |          |
| 2    | Bil rawatan susulan / fizioterapi      |  RM      |  RM      |          |
| 3    | Bil ubat-ubatan                        |  RM      |  RM      |          |
| 4    | Pengangkutan ke hospital               |  RM      |  RM      |          |
| 5    | Bantuan domestik / penjaga             |  RM      |  RM      |          |
| 6    | Kerosakan kenderaan / kos pembaikan    |  RM      |  RM      |          |
| 7    | Sewa kenderaan gantian                 |  RM      |  RM      |          |
| 8    | Kehilangan pendapatan semasa MC        |  RM      |  RM      |          |
| 9    | Kerosakan pakaian / harta peribadi     |  RM      |  RM      |          |
| 10   | Lain-lain perbelanjaan tak terduga     |  RM      |  RM      |          |
+------+----------------------------------------+----------+----------+----------+
|      | JUMLAH                                 |  RM      |  RM      |          |
+------+----------------------------------------+----------+----------+----------+

Disediakan oleh: ${c.solicitorFirm}
Tarikh: ${c.filingDate}
Untuk: ${c.plaintiffName.toUpperCase()} v. ${c.defendantName.toUpperCase()}

NOTA:
- Tiap-tiap item hendaklah disokong dengan dokumen (resit, invois, sijil cuti sakit).
- Jadual ini hendaklah ditukar dengan pihak Defendan sebelum perbicaraan untuk diisi lajur cadangan dan catatan mereka.
`,
  },
  {
    id: "bundle-of-documents",
    name: "Index to Bundle of Documents (Form A/B/C)",
    category: "Court Documents",
    desc: "Index to agreed/disputed bundle of documents",
    build: (c) => `${heading(c)}

INDEKS BUNDEL DOKUMEN
(Bundel A — Dokumen Yang Dipersetujui)

+------+------------------------------------------+--------------+
| Bil  | Dokumen                                  | Halaman      |
+------+------------------------------------------+--------------+
| 1    | Laporan Polis No: ${c.policeReportNo.padEnd(20)}     |    1 - ?     |
| 2    | Sketch plan & key                        |    ? - ?     |
| 3    | Laporan Pemeriksa Kenderaan (PUSPAKOM)   |    ? - ?     |
| 4    | Laporan Perubatan Awal                   |    ? - ?     |
| 5    | Laporan Perubatan Lanjutan               |    ? - ?     |
| 6    | Sijil Cuti Sakit (MC)                    |    ? - ?     |
| 7    | Resit-resit perubatan                    |    ? - ?     |
| 8    | Resit pembaikan kenderaan                |    ? - ?     |
| 9    | Slip gaji / penyata pendapatan           |    ? - ?     |
| 10   | Polisi insurans                          |    ? - ?     |
+------+------------------------------------------+--------------+

DISEDIAKAN OLEH: ${c.solicitorFirm}
${c.solicitorAddress}
Peguamcara bagi pihak Plaintif

Bertarikh pada ${c.filingDate}.
`,
  },
  {
    id: "noa-mareva",
    name: "Notice of Application — Mareva Injunction",
    category: "Interlocutory",
    desc: "Ex parte application to freeze defendant's assets",
    build: (c) => `${heading(c)}

NOTIS PERMOHONAN (EX PARTE)
PERINTAH INJUNKSI MAREVA

AMBIL NOTIS bahawa Mahkamah Yang Mulia ini akan dipohon ex parte untuk satu PERINTAH bahawa:

1.  Defendan, sama ada secara sendiri atau melalui ejen, pegawai, pekerja atau dengan apa-apa cara lain dilarang daripada memindahkan, melupuskan, mengasingkan atau mengurangkan asetnya yang berada di dalam atau di luar bidang kuasa Mahkamah ini sehingga ke jumlah RM ............;

2.  Defendan hendaklah dalam tempoh tujuh (7) hari mendepositkan satu afidavit yang menyenaraikan secara penuh kesemua asetnya dengan menyatakan nilai, lokasi dan butir-butirnya;

3.  Perintah ini berkuat kuasa serta-merta dan kekal berkuat kuasa sehingga perintah lanjut Mahkamah;

4.  Plaintif memberi aku janji silang ganti rugi (cross-undertaking as to damages) sekiranya didapati bahawa perintah ini tidak sepatutnya dikeluarkan;

5.  Kos permohonan ini ditanggung oleh Defendan;

6.  Liberty to apply.

ALASAN:
   (i) Plaintif mempunyai kes prima facie yang baik;
   (ii) Terdapat risiko nyata bahawa Defendan akan melupuskan asetnya untuk mengelak penghakiman;
   (iii) Adalah adil dan munasabah supaya perintah dikeluarkan;
   (iv) Plaintif sanggup memberi aku janji silang ganti rugi.
${sig(c)}`,
  },
  {
    id: "writ-seizure-sale",
    name: "Writ of Seizure and Sale (Form 84)",
    category: "Enforcement",
    desc: "Enforcement: seize and sell judgment debtor's movable property",
    build: (c) => `${heading(c)}

WRIT PENYITAAN DAN PENJUALAN
(Borang 84 — Aturan 47, Kaedah-Kaedah Mahkamah 2012)

KEPADA: BAILIF Mahkamah tersebut di atas

BAHAWASANYA pada ${c.filingDate}, dalam Mahkamah ini, satu penghakiman telah diberikan kepada ${c.plaintiffName.toUpperCase()} ("Plaintif/Pemiutang Penghakiman") terhadap ${c.defendantName.toUpperCase()} ("Defendan/Penghutang Penghakiman") untuk:
   (a) RM ............ sebagai ganti rugi;
   (b) RM ............ sebagai kos;
   (c) Faedah pada kadar 5% setahun dari ${c.filingDate} sehingga penyelesaian sepenuhnya.

DAN BAHAWASANYA jumlah tersebut belum dijelaskan oleh Penghutang Penghakiman;

OLEH ITU KAMU DIPERINTAHKAN untuk merampas dan menjual harta alih kepunyaan Penghutang Penghakiman yang mencukupi untuk memenuhi:
   (a) Jumlah penghakiman;
   (b) Faedah ke atasnya;
   (c) Kos eksekusi termasuk yuran Bailif.

Kembalikan writ ini kepada Mahkamah dalam tempoh enam (6) bulan dari tarikh ini dengan endorsmen kamu mengenai cara writ ini telah dilaksanakan.

Bertarikh pada ${c.filingDate}.

                                         ........................................
                                         PENDAFTAR
${sig(c)}`,
  },
  {
    id: "garnishee",
    name: "Garnishee Order (O.49)",
    category: "Enforcement",
    desc: "Order garnishing debt owed to judgment debtor (e.g. bank account)",
    build: (c) => `${heading(c)}

NOTIS PERMOHONAN (EX PARTE)
PERINTAH GARNISHI NISI
(Aturan 49, Kaedah-Kaedah Mahkamah 2012)

AMBIL NOTIS bahawa Mahkamah Yang Mulia ini akan dipohon untuk satu PERINTAH bahawa:

1.  Garnishee, <<Bank/Pihak Ketiga>>, dengan ini diperintahkan menunjukkan sebab mengapa hutang yang terhutang olehnya kepada Penghutang Penghakiman tidak patut diperuntukkan kepada Pemiutang Penghakiman bagi memenuhi penghakiman bertarikh ${c.filingDate} dalam tindakan ini sebanyak RM ............ bersama faedah dan kos;

2.  Sehingga keluasan perintah ini muktamad (Order Absolute), Garnishee dilarang membayar atau melepaskan apa-apa hutang yang terhutang olehnya kepada Penghutang Penghakiman;

3.  Kos permohonan ini ditanggung oleh Penghutang Penghakiman;

4.  Permohonan ini didengar pada ............ pada jam ............ pagi.

ALASAN:
   (i) Penghakiman telah dimasukkan terhadap Penghutang Penghakiman pada ${c.filingDate};
   (ii) Penghakiman tersebut belum diselesaikan;
   (iii) Garnishee adalah seorang berhutang kepada Penghutang Penghakiman.
${sig(c)}`,
  },
  {
    id: "judgment-debtor-summons",
    name: "Judgment Debtor Summons (O.74)",
    category: "Enforcement",
    desc: "Summons to examine judgment debtor on means",
    build: (c) => `${heading(c)}

SAMAN PENGHUTANG PENGHAKIMAN
(Aturan 74, Kaedah-Kaedah Mahkamah 2012)

KEPADA: ${c.defendantName.toUpperCase()}
        ${c.defendantAddress}

KAMI MEMERINTAHKAN supaya kamu hadir secara peribadi di hadapan Hakim/Pendaftar Mahkamah ini di .......................... pada hari ............ haribulan ............ pada jam ............ pagi untuk diperiksa atas sumpah mengenai segala harta dan cara untuk memuaskan penghakiman bertarikh ${c.filingDate} dalam tindakan ini sebanyak RM ............ yang masih belum dijelaskan.

KAMU JUGA DIPERINTAHKAN supaya membawa bersama:
   (a) Penyata bank untuk enam (6) bulan terkini;
   (b) Slip gaji/penyata pendapatan untuk enam (6) bulan terkini;
   (c) Senarai semua aset alih dan tak alih kepunyaan kamu;
   (d) Senarai semua hutang yang terhutang kepada kamu;
   (e) Apa-apa dokumen lain yang berkaitan dengan kemampuan kewangan kamu.

AMBIL NOTIS bahawa kegagalan untuk hadir boleh mengakibatkan satu Waran Tangkap dikeluarkan terhadap kamu.

Bertarikh pada ${c.filingDate}.

                                         ........................................
                                         PENDAFTAR
${sig(c)}`,
  },
];

templates.push(
  {
    id: "bundle-pleadings",
    name: "Bundle of Pleadings (Index)",
    category: "Trial Bundles",
    desc: "Index page for the Bundle of Pleadings to be filed before trial",
    build: (c) => `${heading(c)}

BUNDEL PLIDING (BUNDLE OF PLEADINGS)

INDEKS

+------+--------------------------------------------------------+--------------+
| Bil  | Dokumen                                                | Halaman      |
+------+--------------------------------------------------------+--------------+
| 1    | Writ Saman bertarikh ${c.filingDate.padEnd(20)}       |    1 - ?     |
| 2    | Pernyataan Tuntutan bertarikh ${c.filingDate.padEnd(11)}|    ? - ?     |
| 3    | Memorandum Kehadiran (Defendan)                        |    ? - ?     |
| 4    | Pernyataan Pembelaan                                   |    ? - ?     |
| 5    | Jawapan kepada Pembelaan                               |    ? - ?     |
| 6    | Tuntutan Balas (jika ada)                              |    ? - ?     |
| 7    | Pernyataan Pembelaan kepada Tuntutan Balas             |    ? - ?     |
| 8    | Notis Pihak Ketiga (jika ada)                          |    ? - ?     |
| 9    | Permohonan-permohonan interlokutori                    |    ? - ?     |
| 10   | Perintah-perintah Mahkamah                             |    ? - ?     |
+------+--------------------------------------------------------+--------------+

DISEDIAKAN OLEH:
${c.solicitorFirm}
${c.solicitorAddress}
Peguamcara bagi pihak Plaintif

Bertarikh pada ${c.filingDate}.

CATATAN: Bundel ini disediakan menurut arahan Mahkamah dalam Pengurusan Kes (Case Management).
`,
  },
  {
    id: "bundle-docs-a",
    name: "Bundle of Documents Part A (Agreed)",
    category: "Trial Bundles",
    desc: "Bundle A — agreed authenticity AND agreed contents (no proof needed)",
    build: (c) => `${heading(c)}

BUNDEL DOKUMEN BAHAGIAN A
(BUNDLE OF DOCUMENTS — PART A)
DOKUMEN-DOKUMEN YANG DIPERSETUJUI KESAHIHAN DAN KANDUNGANNYA

INDEKS

+------+----------------------------------------------------+--------------+
| Bil  | Dokumen                                            | Halaman      |
+------+----------------------------------------------------+--------------+
| A1   | Laporan Polis No: ${c.policeReportNo.padEnd(20)} |    1 - ?     |
| A2   | Sketch Plan & Key                                  |    ? - ?     |
| A3   | Laporan PUSPAKOM (Pemeriksaan Kenderaan)           |    ? - ?     |
| A4   | Salinan Polisi Insurans                            |    ? - ?     |
| A5   | Salinan Geran/Vehicle Registration                 |    ? - ?     |
| A6   | Salinan Lesen Memandu                              |    ? - ?     |
| A7   | Sijil Cuti Sakit (MC)                              |    ? - ?     |
| A8   | Salinan Kad Pengenalan Pihak-Pihak                 |    ? - ?     |
+------+----------------------------------------------------+--------------+

NOTA:
- Pihak-pihak bersetuju kesahihan dan kandungan dokumen-dokumen di atas.
- Tiada bukti diperlukan untuk kesahihan atau kandungan.
- Dokumen-dokumen ini boleh dirujuk dan dibaca sebagai sebahagian keterangan tanpa bukti lanjut.

DISEDIAKAN OLEH:
${c.solicitorFirm}
${c.solicitorAddress}
Peguamcara bagi pihak Plaintif

Bertarikh pada ${c.filingDate}.
`,
  },
  {
    id: "bundle-docs-b",
    name: "Bundle of Documents Part B (Disputed Contents)",
    category: "Trial Bundles",
    desc: "Bundle B — agreed authenticity, disputed contents (must prove truth of contents)",
    build: (c) => `${heading(c)}

BUNDEL DOKUMEN BAHAGIAN B
(BUNDLE OF DOCUMENTS — PART B)
DOKUMEN-DOKUMEN YANG DIPERSETUJUI KESAHIHAN TETAPI DIPERTIKAIKAN KANDUNGANNYA

INDEKS

+------+----------------------------------------------------+--------------+
| Bil  | Dokumen                                            | Halaman      |
+------+----------------------------------------------------+--------------+
| B1   | Laporan Perubatan Awal (Hospital ............)     |    1 - ?     |
| B2   | Laporan Perubatan Lanjutan / Specialist Report     |    ? - ?     |
| B3   | Laporan Pakar Ortopedik                            |    ? - ?     |
| B4   | Laporan Pakar Psikiatri (jika ada)                 |    ? - ?     |
| B5   | Laporan Pakar Loss of Earning Capacity             |    ? - ?     |
| B6   | Penyata Bank / Penyata Pendapatan                  |    ? - ?     |
| B7   | Resit-resit perubatan                              |    ? - ?     |
| B8   | Resit pembaikan kenderaan                          |    ? - ?     |
+------+----------------------------------------------------+--------------+

NOTA:
- Pihak-pihak bersetuju kesahihan dokumen tetapi mempertikaikan kandungannya.
- Pihak yang bergantung kepada dokumen hendaklah membuktikan kebenaran kandungan dokumen tersebut melalui saksi.

DISEDIAKAN OLEH:
${c.solicitorFirm}
${c.solicitorAddress}
Peguamcara bagi pihak Plaintif

Bertarikh pada ${c.filingDate}.
`,
  },
  {
    id: "bundle-docs-c",
    name: "Bundle of Documents Part C (Disputed Authenticity)",
    category: "Trial Bundles",
    desc: "Bundle C — disputed authenticity AND contents (must prove both)",
    build: (c) => `${heading(c)}

BUNDEL DOKUMEN BAHAGIAN C
(BUNDLE OF DOCUMENTS — PART C)
DOKUMEN-DOKUMEN YANG DIPERTIKAIKAN KESAHIHAN DAN KANDUNGANNYA

INDEKS

+------+----------------------------------------------------+--------------+
| Bil  | Dokumen                                            | Halaman      |
+------+----------------------------------------------------+--------------+
| C1   | Gambar-gambar tempat kejadian                      |    1 - ?     |
| C2   | Gambar-gambar kenderaan terlibat                   |    ? - ?     |
| C3   | Kenyataan saksi tidak rasmi                        |    ? - ?     |
| C4   | Surat-menyurat antara pihak-pihak                  |    ? - ?     |
| C5   | Laporan dalaman insurans                           |    ? - ?     |
| C6   | CCTV footage / Dashcam recording                   |    ? - ?     |
+------+----------------------------------------------------+--------------+

NOTA:
- Pihak-pihak mempertikaikan kesahihan dan kandungan dokumen-dokumen ini.
- Pihak yang bergantung kepada dokumen hendaklah membuktikan kedua-dua kesahihan dan kandungan dokumen tersebut.
- Pengarang dokumen atau saksi yang berkaitan hendaklah dipanggil untuk memberi keterangan.

DISEDIAKAN OLEH:
${c.solicitorFirm}
${c.solicitorAddress}
Peguamcara bagi pihak Plaintif

Bertarikh pada ${c.filingDate}.
`,
  },
  {
    id: "common-bundle",
    name: "Common Bundle (Joint Trial Bundle)",
    category: "Trial Bundles",
    desc: "Joint bundle agreed between parties combining all trial documents",
    build: (c) => `${heading(c)}

BUNDEL BERSAMA (COMMON BUNDLE / JOINT BUNDLE)

INDEKS

BAHAGIAN I — PLIDING-PLIDING (PLEADINGS)
+------+----------------------------------------------------+--------------+
| Bil  | Dokumen                                            | Halaman      |
+------+----------------------------------------------------+--------------+
| 1    | Writ Saman & Pernyataan Tuntutan                   |    1 - ?     |
| 2    | Memorandum Kehadiran                               |    ? - ?     |
| 3    | Pernyataan Pembelaan                               |    ? - ?     |
| 4    | Jawapan kepada Pembelaan                           |    ? - ?     |
+------+----------------------------------------------------+--------------+

BAHAGIAN II — DOKUMEN POLIS DAN INSURANS
+------+----------------------------------------------------+--------------+
| 5    | Laporan Polis No: ${c.policeReportNo.padEnd(20)}|    ? - ?     |
| 6    | Sketch Plan & Key                                  |    ? - ?     |
| 7    | Laporan PUSPAKOM                                   |    ? - ?     |
| 8    | Polisi Insurans                                    |    ? - ?     |
+------+----------------------------------------------------+--------------+

BAHAGIAN III — DOKUMEN PERUBATAN
+------+----------------------------------------------------+--------------+
| 9    | Laporan Perubatan Awal                             |    ? - ?     |
| 10   | Laporan Perubatan Lanjutan                         |    ? - ?     |
| 11   | Laporan Pakar                                      |    ? - ?     |
| 12   | Sijil Cuti Sakit (MC)                              |    ? - ?     |
+------+----------------------------------------------------+--------------+

BAHAGIAN IV — DOKUMEN GANTI RUGI KHAS
+------+----------------------------------------------------+--------------+
| 13   | Resit perubatan                                    |    ? - ?     |
| 14   | Resit pembaikan kenderaan                          |    ? - ?     |
| 15   | Slip gaji & penyata pendapatan                     |    ? - ?     |
| 16   | Jadual Scott                                       |    ? - ?     |
+------+----------------------------------------------------+--------------+

BAHAGIAN V — KENYATAAN SAKSI (WITNESS STATEMENTS)
+------+----------------------------------------------------+--------------+
| 17   | Kenyataan Saksi PW1 (Plaintif)                     |    ? - ?     |
| 18   | Kenyataan Saksi PW2                                |    ? - ?     |
| 19   | Kenyataan Saksi DW1 (Defendan)                     |    ? - ?     |
+------+----------------------------------------------------+--------------+

DIPERSETUJUI OLEH:

........................................          ........................................
Peguamcara Plaintif                                Peguamcara Defendan
${c.solicitorFirm}                                <<Tetuan Defendan>>

Bertarikh pada ${c.filingDate}.
`,
  },
  {
    id: "core-bundle",
    name: "Core Bundle (Key Documents)",
    category: "Trial Bundles",
    desc: "Slim bundle of key documents the judge will refer to during trial",
    build: (c) => `${heading(c)}

BUNDEL TERAS (CORE BUNDLE)
DOKUMEN-DOKUMEN UTAMA UNTUK RUJUKAN MAHKAMAH

INDEKS

+------+--------------------------------------------------------+--------------+
| Bil  | Dokumen                                                | Halaman      |
+------+--------------------------------------------------------+--------------+
| 1    | Pernyataan Tuntutan                                    |    1 - ?     |
| 2    | Pernyataan Pembelaan                                   |    ? - ?     |
| 3    | Laporan Polis No: ${c.policeReportNo.padEnd(20)}     |    ? - ?     |
| 4    | Sketch Plan & Key                                      |    ? - ?     |
| 5    | Laporan Perubatan Utama                                |    ? - ?     |
| 6    | Laporan Pakar (jika ada)                               |    ? - ?     |
| 7    | Jadual Scott                                           |    ? - ?     |
| 8    | Penghakiman/Perintah-perintah Interlokutori (jika ada) |    ? - ?     |
+------+--------------------------------------------------------+--------------+

NOTA: Bundel ini disediakan untuk memudahkan rujukan Mahkamah Yang Mulia kepada dokumen-dokumen utama semasa perbicaraan. Bundel-bundel lain (A, B, C) tetap difailkan secara berasingan.

DISEDIAKAN OLEH:
${c.solicitorFirm}
${c.solicitorAddress}
Peguamcara bagi pihak Plaintif

Bertarikh pada ${c.filingDate}.
`,
  },
  {
    id: "bundle-authorities",
    name: "Bundle of Authorities",
    category: "Trial Bundles",
    desc: "Bundle of case law and statutory authorities cited in submissions",
    build: (c) => `${heading(c)}

BUNDEL OTORITI PLAINTIF
(PLAINTIFF'S BUNDLE OF AUTHORITIES)

INDEKS

A. KES-KES MAHKAMAH PERSEKUTUAN / RAYUAN
+------+----------------------------------------------------------------+--------------+
| Bil  | Kes / Authoriti                                                | Tab          |
+------+----------------------------------------------------------------+--------------+
| 1    | Mat v. Public Trustee, Federation of Malaya [1957] MLJ 60      |    1         |
| 2    | Yang Salbiah & Anor v. Jamil bin Harun [1981] 1 MLJ 292        |    2         |
| 3    | Ong Ah Long v. Dr S Underwood [1983] 2 MLJ 324                 |    3         |
| 4    | Sambu (M) Sdn Bhd v. Stone World Sdn Bhd [2018] 5 MLJ 28       |    4         |
| 5    | Inas Faiqah Mohd Helmi v. Kerajaan Malaysia [2016] 2 MLJ 1     |    5         |
+------+----------------------------------------------------------------+--------------+

B. KES-KES MAHKAMAH TINGGI
+------+----------------------------------------------------------------+--------------+
| 6    | Marappan v. Siti Rahmah [1990] 1 MLJ 99                        |    6         |
| 7    | Ahmad Nordin v. Ng Say Chuan [2008] 5 MLJ 245                  |    7         |
+------+----------------------------------------------------------------+--------------+

C. STATUT DAN PERATURAN
+------+----------------------------------------------------------------+--------------+
| 8    | Akta Undang-Undang Sivil 1956 — s.7, s.8, s.10, s.28A          |    8         |
| 9    | Akta Pengangkutan Jalan 1987 — s.96                            |    9         |
| 10   | Kaedah-Kaedah Mahkamah 2012 — Aturan 22A, 29 r.10              |   10         |
+------+----------------------------------------------------------------+--------------+

D. TEKS DAN KOMENTAR
+------+----------------------------------------------------------------+--------------+
| 11   | Kemp & Kemp on Quantum of Damages (relevant chapter)           |   11         |
| 12   | Compendium of Personal Injury Awards (Malaysia)                |   12         |
+------+----------------------------------------------------------------+--------------+

DISEDIAKAN OLEH:
${c.solicitorFirm}
${c.solicitorAddress}
Peguamcara bagi pihak Plaintif

Bertarikh pada ${c.filingDate}.
`,
  },
  {
    id: "bundle-witness-statements",
    name: "Bundle of Witness Statements",
    category: "Trial Bundles",
    desc: "Bundle of all witness statements/affidavits-in-chief filed for trial",
    build: (c) => `${heading(c)}

BUNDEL KENYATAAN SAKSI
(BUNDLE OF WITNESS STATEMENTS)

INDEKS

SAKSI-SAKSI PLAINTIF
+------+---------------------------------------------------+--------------+
| Saksi| Nama                                              | Halaman      |
+------+---------------------------------------------------+--------------+
| PW1  | ${c.plaintiffName.padEnd(45)} |    1 - ?     |
| PW2  | <<Saksi mata kemalangan>>                         |    ? - ?     |
| PW3  | <<Pegawai Polis Penyiasat>>                       |    ? - ?     |
| PW4  | <<Pakar Perubatan>>                               |    ? - ?     |
| PW5  | <<Pakar Loss of Earning Capacity>>                |    ? - ?     |
+------+---------------------------------------------------+--------------+

SAKSI-SAKSI DEFENDAN
+------+---------------------------------------------------+--------------+
| DW1  | ${c.defendantName.padEnd(45)} |    ? - ?     |
| DW2  | <<Saksi Defendan>>                                |    ? - ?     |
+------+---------------------------------------------------+--------------+

NOTA:
- Setiap kenyataan saksi dilampirkan dengan eksibit-eksibit yang dirujuk.
- Saksi hendaklah hadir untuk pemeriksaan balas berdasarkan kenyataan masing-masing.
- Kenyataan ini berfungsi sebagai keterangan utama (evidence-in-chief) menurut Aturan 38 Kaedah-Kaedah Mahkamah 2012.

DISEDIAKAN OLEH:
${c.solicitorFirm}
${c.solicitorAddress}
Peguamcara bagi pihak Plaintif

Bertarikh pada ${c.filingDate}.
`,
  },
  {
    id: "witness-statement",
    name: "Witness Statement (Evidence-in-Chief)",
    category: "Trial Bundles",
    desc: "Witness statement under O.38 r.2 ROC 2012 (evidence-in-chief)",
    build: (c) => `${heading(c)}

KENYATAAN SAKSI
(Aturan 38 Kaedah 2, Kaedah-Kaedah Mahkamah 2012)

KENYATAAN SAKSI PERTAMA PLAINTIF (PW1)

Nama:           ${c.plaintiffName.toUpperCase()}
No. K/P:        ${c.plaintiffIc}
Pekerjaan:      <<pekerjaan>>
Alamat:         ${c.plaintiffAddress}

Saya, ${c.plaintiffName.toUpperCase()}, dengan sesungguhnya menyatakan seperti berikut:

LATAR BELAKANG

1.  Saya berusia <<umur>> tahun dan bekerja sebagai <<pekerjaan>> di <<majikan>>. Saya adalah Plaintif dalam tindakan ini.

2.  Pada ${c.accidentDate} pada lebih kurang ${c.accidentTime}, saya sedang memandu kenderaan saya jenama ${c.plaintiffVehicle} di sepanjang ${c.accidentPlace}.

KEMALANGAN

3.  Pada masa material, cuaca adalah cerah dan jalan raya dalam keadaan baik. Saya memandu pada kelajuan munasabah dan mematuhi peraturan jalan raya.

4.  Tiba-tiba, kenderaan Defendan iaitu ${c.defendantVehicle} telah <<huraikan bagaimana kemalangan berlaku>>.

5.  Saya tidak dapat mengelakkan perlanggaran tersebut walaupun saya telah mengambil langkah munasabah untuk berbuat demikian.

KECEDERAAN DAN RAWATAN

6.  Akibat daripada kemalangan tersebut, saya telah mengalami kecederaan-kecederaan berikut: ${c.injuriesSummary}.

7.  Saya dihantar ke <<nama hospital>> di mana saya menerima rawatan kecemasan dan dimasukkan untuk pembedahan/rawatan lanjut.

8.  Saya telah dimasukkan ke wad selama <<bilangan hari>> hari dan menjalani <<bilangan>> sesi fizioterapi selepas itu.

KESAN KECEDERAAN

9.  Akibat daripada kecederaan tersebut, saya tidak dapat bekerja selama <<tempoh>> dan diberi cuti sakit oleh doktor (rujuk Eksibit P-1).

10. Saya masih mengalami kesakitan di <<bahagian badan>> dan menghadapi kesukaran untuk <<aktiviti yang terjejas>>.

11. Pendapatan saya sebanyak RM <<jumlah>> sebulan terjejas akibat ketidakupayaan saya untuk bekerja.

GANTI RUGI KHAS

12. Saya telah menanggung perbelanjaan-perbelanjaan berikut: ${c.specialDamages}. Resit-resit dilampirkan sebagai Eksibit P-2.

PENGAKUAN

13. Semua yang saya nyatakan di atas adalah benar mengikut pengetahuan, ingatan dan kepercayaan saya.

........................................
${c.plaintiffName.toUpperCase()}
(PW1)

Bertarikh: ${c.filingDate}
`,
  },
  {
    id: "noa-set-aside",
    name: "Notice of Application — Setting Aside Default Judgment",
    category: "Interlocutory",
    desc: "Application to set aside judgment in default (regular or irregular)",
    build: (c) => `${heading(c)}

NOTIS PERMOHONAN
(Aturan 13 Kaedah 8 / Aturan 42 Kaedah 13, Kaedah-Kaedah Mahkamah 2012)

AMBIL NOTIS bahawa Mahkamah Yang Mulia ini akan dipohon oleh peguamcara bagi pihak Defendan untuk satu PERINTAH bahawa:

1.  Penghakiman ingkar bertarikh ............ yang dimasukkan terhadap Defendan diketepikan;

2.  Defendan diberi kebenaran untuk memfailkan dan menyampaikan Memorandum Kehadiran dan Pernyataan Pembelaan dalam tempoh empat belas (14) hari dari tarikh perintah ini;

3.  Pelaksanaan penghakiman digantung sementara menunggu pendengaran permohonan ini;

4.  Kos permohonan dalam kausa (costs in the cause);

5.  Lain-lain perintah yang Mahkamah Yang Mulia ini fikirkan adil dan suaimanfaat.

ALASAN PERMOHONAN:
   (i) Defendan mempunyai pembelaan yang bermerit terhadap tuntutan Plaintif;
   (ii) Kelewatan Defendan adalah disebabkan oleh <<sebab>>;
   (iii) Plaintif tidak akan diprejudiskan jika perintah diberikan;
   (iv) Kepentingan keadilan menghendaki kes ini dibicarakan atas merit.
${sig(c)}`,
  },
  {
    id: "noa-extension-time",
    name: "Notice of Application — Extension of Time",
    category: "Interlocutory",
    desc: "Application for extension of time to file/serve any process under O.3 r.5",
    build: (c) => `${heading(c)}

NOTIS PERMOHONAN
(Aturan 3 Kaedah 5, Kaedah-Kaedah Mahkamah 2012)

AMBIL NOTIS bahawa Mahkamah Yang Mulia ini akan dipohon untuk satu PERINTAH bahawa:

1.  Tempoh masa untuk Defendan/Plaintif memfailkan dan menyampaikan <<dokumen>> dilanjutkan sehingga ............;

2.  Apa-apa proses yang difailkan dalam tempoh lanjutan tersebut dianggap difailkan dalam masa;

3.  Kos permohonan dalam kausa;

4.  Lain-lain perintah yang Mahkamah Yang Mulia ini fikirkan adil dan suaimanfaat.

ALASAN:
   (i) Pelanjutan masa adalah perlu kerana <<sebab munasabah>>;
   (ii) Tiada kemudaratan akan dialami oleh pihak satu lagi;
   (iii) Pelanjutan akan menggalakkan keadilan substantif.
${sig(c)}`,
  },
  {
    id: "noa-stay-execution",
    name: "Notice of Application — Stay of Execution",
    category: "Interlocutory",
    desc: "Application for stay of execution of judgment pending appeal",
    build: (c) => `${heading(c)}

NOTIS PERMOHONAN
(Aturan 55 Kaedah 16, Kaedah-Kaedah Mahkamah 2012)

AMBIL NOTIS bahawa Mahkamah Yang Mulia ini akan dipohon untuk satu PERINTAH bahawa:

1.  Pelaksanaan penghakiman bertarikh ............ digantung sementara menunggu pelupusan rayuan Defendan ke Mahkamah Tinggi/Rayuan;

2.  Pelaksanaan digantung dengan syarat Defendan mendepositkan jumlah penghakiman ke dalam akaun Mahkamah/sebagai jaminan dalam tempoh empat belas (14) hari;

3.  Kos permohonan dalam kausa;

4.  Lain-lain perintah yang Mahkamah Yang Mulia ini fikirkan adil dan suaimanfaat.

ALASAN:
   (i) Defendan telah memfailkan Notis Rayuan terhadap penghakiman tersebut;
   (ii) Rayuan mempunyai prospek kejayaan yang munasabah;
   (iii) Sekiranya pelaksanaan tidak digantung, rayuan akan menjadi sia-sia (nugatory);
   (iv) Defendan sanggup memberi jaminan yang sesuai.
${sig(c)}`,
  },
  {
    id: "notice-trial",
    name: "Notice of Setting Down for Trial (O.34)",
    category: "Court Documents",
    desc: "Notice setting action down for trial after pleadings closed",
    build: (c) => `${heading(c)}

NOTIS PENETAPAN UNTUK PERBICARAAN
(Aturan 34, Kaedah-Kaedah Mahkamah 2012)

KEPADA: PENDAFTAR Mahkamah tersebut di atas
        DAN KEPADA Peguamcara bagi pihak Defendan

AMBIL NOTIS bahawa Plaintif dengan ini menetapkan tindakan ini untuk perbicaraan.

BUTIR-BUTIR:
   Tarikh permulaan tindakan:    ${c.filingDate}
   Pliding ditutup pada:         ............
   Anggaran masa perbicaraan:    <<bilangan>> hari
   Bilangan saksi:               <<bilangan>>

DOKUMEN-DOKUMEN YANG DIFAILKAN BERSAMA:
   (a) Bundel Pliding;
   (b) Bundel Dokumen Bahagian A, B dan C;
   (c) Senarai saksi;
   (d) Penyataan isu (Statement of Issues).

DISEDIAKAN OLEH:
${c.solicitorFirm}
${c.solicitorAddress}
Peguamcara bagi pihak Plaintif

Bertarikh pada ${c.filingDate}.
`,
  },
  {
    id: "subpoena-ad-test",
    name: "Subpoena Ad Testificandum (O.38 r.14)",
    category: "Court Documents",
    desc: "Subpoena requiring witness to attend court and give evidence",
    build: (c) => `${heading(c)}

SAPINA AD TESTIFICANDUM
(Borang 67 — Aturan 38 Kaedah 14, Kaedah-Kaedah Mahkamah 2012)

KEPADA: <<Nama Saksi>>
        <<Alamat Saksi>>

KAMI MEMERINTAHKAN supaya kamu mengetepikan segala urusan dan hadir secara peribadi di hadapan Mahkamah Yang Mulia ini di .......................... pada hari ............ haribulan ............ pada jam ............ pagi dan terus dari hari ke hari sehingga tindakan tersebut di atas didengar untuk memberi keterangan bagi pihak Plaintif.

AMBIL NOTIS bahawa kegagalan untuk hadir tanpa alasan yang sah adalah satu penghinaan terhadap Mahkamah dan boleh mengakibatkan satu Waran Tangkap dikeluarkan terhadap kamu.

Wang saksi (witness expenses) dilampirkan/akan dibayar sebelum kehadiran.

Bertarikh pada ${c.filingDate}.

                                         ........................................
                                         PENDAFTAR

Diendorskan oleh:
${c.solicitorFirm}
${c.solicitorAddress}
Peguamcara bagi pihak Plaintif
`,
  },
  {
    id: "subpoena-duces",
    name: "Subpoena Duces Tecum (O.38 r.14)",
    category: "Court Documents",
    desc: "Subpoena requiring witness to attend AND produce specified documents",
    build: (c) => `${heading(c)}

SAPINA DUCES TECUM
(Borang 68 — Aturan 38 Kaedah 14, Kaedah-Kaedah Mahkamah 2012)

KEPADA: <<Nama Saksi / Pegawai Rekod>>
        <<Nama Organisasi / Hospital / Bank>>
        <<Alamat>>

KAMI MEMERINTAHKAN supaya kamu mengetepikan segala urusan dan hadir secara peribadi di hadapan Mahkamah Yang Mulia ini di .......................... pada hari ............ haribulan ............ pada jam ............ pagi DAN MEMBAWA BERSAMA dokumen-dokumen berikut:

   (a) <<senaraikan dokumen — contoh: Rekod Perubatan ${c.plaintiffName.toUpperCase()} bagi tempoh ${c.accidentDate} sehingga kini>>;
   (b) <<contoh: Penyata bank Defendan untuk tempoh 6 bulan kebelakang>>;
   (c) <<contoh: CCTV footage di ${c.accidentPlace} bertarikh ${c.accidentDate}>>;
   (d) Apa-apa dokumen lain yang berkaitan dengan kes ini.

AMBIL NOTIS bahawa kegagalan untuk hadir dan/atau membawa dokumen yang dinyatakan adalah satu penghinaan terhadap Mahkamah.

Bertarikh pada ${c.filingDate}.

                                         ........................................
                                         PENDAFTAR

Diendorskan oleh:
${c.solicitorFirm}
${c.solicitorAddress}
Peguamcara bagi pihak Plaintif
`,
  },
  {
    id: "notice-admit-facts",
    name: "Notice to Admit Facts (O.27)",
    category: "Court Documents",
    desc: "Notice requiring opposing party to admit specified facts",
    build: (c) => `${heading(c)}

NOTIS UNTUK MENGAKUI FAKTA
(Aturan 27, Kaedah-Kaedah Mahkamah 2012)

KEPADA: Defendan dan/atau Peguamcaranya

AMBIL NOTIS bahawa Plaintif menghendaki Defendan mengakui, bagi maksud tindakan ini sahaja, fakta-fakta berikut:

1.  Bahawa pada ${c.accidentDate} pada lebih kurang ${c.accidentTime}, satu kemalangan jalan raya berlaku di ${c.accidentPlace} yang melibatkan kenderaan ${c.plaintiffVehicle} (Plaintif) dan kenderaan ${c.defendantVehicle} (Defendan).

2.  Bahawa Defendan adalah pemandu kenderaan ${c.defendantVehicle} pada masa kemalangan.

3.  Bahawa kenderaan ${c.defendantVehicle} diinsuranskan dengan ${c.insurerName} pada masa material.

4.  Bahawa Laporan Polis No: ${c.policeReportNo} telah dibuat oleh Plaintif berkenaan kemalangan tersebut.

5.  Bahawa Plaintif telah dirawat di <<nama hospital>> berikutan kemalangan tersebut.

AMBIL NOTIS bahawa jika Defendan tidak mengakui fakta-fakta tersebut dalam tempoh empat belas (14) hari dari penyampaian notis ini, kos pembuktian fakta-fakta tersebut akan ditanggung oleh Defendan tanpa mengira keputusan tindakan ini, kecuali Mahkamah memerintahkan sebaliknya.

DISEDIAKAN OLEH:
${c.solicitorFirm}
${c.solicitorAddress}
Peguamcara bagi pihak Plaintif

Bertarikh pada ${c.filingDate}.
`,
  },
  {
    id: "notice-produce-docs",
    name: "Notice to Produce Documents at Trial (O.27 r.4)",
    category: "Court Documents",
    desc: "Notice requiring opposing party to produce documents at trial",
    build: (c) => `${heading(c)}

NOTIS UNTUK MENGEMUKAKAN DOKUMEN PADA PERBICARAAN
(Aturan 27 Kaedah 4, Kaedah-Kaedah Mahkamah 2012)

KEPADA: Defendan dan/atau Peguamcaranya

AMBIL NOTIS bahawa Plaintif menghendaki Defendan mengemukakan pada perbicaraan tindakan ini dokumen-dokumen berikut yang berada dalam jagaan, milik atau kuasa Defendan:

   (a) Polisi insurans bagi kenderaan ${c.defendantVehicle} yang berkuat kuasa pada ${c.accidentDate};
   (b) Lesen memandu Defendan pada masa kemalangan;
   (c) Geran dan dokumen pendaftaran kenderaan ${c.defendantVehicle};
   (d) Apa-apa kenyataan yang dibuat oleh Defendan kepada syarikat insurans;
   (e) Apa-apa laporan dalaman atau penyiasatan oleh syarikat insurans;
   (f) Salinan Laporan Polis Defendan (jika berlainan daripada laporan Plaintif);
   (g) Apa-apa CCTV footage atau dashcam recording di tangan Defendan.

DISEDIAKAN OLEH:
${c.solicitorFirm}
${c.solicitorAddress}
Peguamcara bagi pihak Plaintif

Bertarikh pada ${c.filingDate}.
`,
  },
  {
    id: "interrogatories",
    name: "Interrogatories (O.26)",
    category: "Court Documents",
    desc: "Written questions requiring sworn answers from opposing party",
    build: (c) => `${heading(c)}

INTEROGATORI UNTUK DIJAWAB OLEH DEFENDAN
(Aturan 26, Kaedah-Kaedah Mahkamah 2012)

Berikut adalah interogatori yang hendaklah dijawab oleh Defendan secara afidavit dalam tempoh empat belas (14) hari dari tarikh penyampaian:

1.  Adakah Defendan pemandu kenderaan ${c.defendantVehicle} pada ${c.accidentDate}?

2.  Pada masa kemalangan, apakah kelajuan kenderaan Defendan?

3.  Adakah Defendan memakai tali pinggang keledar pada masa kemalangan?

4.  Adakah kenderaan Defendan diservis dalam tempoh enam bulan sebelum kemalangan? Jika ya, di bengkel mana?

5.  Berapa lama Defendan telah memandu sebelum kemalangan berlaku pada hari tersebut?

6.  Adakah Defendan mengambil apa-apa minuman beralkohol atau ubat dalam 24 jam sebelum kemalangan? Jika ya, sila nyatakan butirannya.

7.  Adakah Defendan pernah didakwa atau didapati bersalah atas apa-apa kesalahan lalulintas berkaitan kemalangan ini?

8.  Adakah Defendan menggunakan telefon mudah alih semasa memandu sebelum kemalangan?

9.  Berapa pemandu yang berada dalam kenderaan Defendan pada masa kemalangan?

10. Berikan butir-butir penuh polisi insurans Defendan pada masa kemalangan termasuk nombor polisi dan nama insurer.

DISEDIAKAN OLEH:
${c.solicitorFirm}
${c.solicitorAddress}
Peguamcara bagi pihak Plaintif

Bertarikh pada ${c.filingDate}.
`,
  },
  {
    id: "notice-discontinuance",
    name: "Notice of Discontinuance (O.21)",
    category: "Court Documents",
    desc: "Plaintiff's notice discontinuing the action",
    build: (c) => `${heading(c)}

NOTIS PEMBERHENTIAN
(Aturan 21, Kaedah-Kaedah Mahkamah 2012)

KEPADA: PENDAFTAR Mahkamah tersebut di atas
        DAN KEPADA Defendan dan/atau Peguamcaranya

AMBIL NOTIS bahawa Plaintif dengan ini memberhentikan tindakan ini terhadap Defendan sepenuhnya.

DISEDIAKAN OLEH:
${c.solicitorFirm}
${c.solicitorAddress}
Peguamcara bagi pihak Plaintif

Bertarikh pada ${c.filingDate}.
`,
  },
  {
    id: "notice-change-solicitors",
    name: "Notice of Change of Solicitors (O.64)",
    category: "Court Documents",
    desc: "Notice that party has changed solicitors",
    build: (c) => `${heading(c)}

NOTIS PERTUKARAN PEGUAMCARA
(Aturan 64 Kaedah 1, Kaedah-Kaedah Mahkamah 2012)

KEPADA: PENDAFTAR Mahkamah tersebut di atas
        DAN KEPADA Peguamcara bagi pihak Defendan

AMBIL NOTIS bahawa Plaintif dengan ini memberi notis bahawa Tetuan ${c.solicitorFirm} telah dilantik sebagai peguamcara baharu bagi pihak Plaintif menggantikan Tetuan <<peguamcara terdahulu>>.

Alamat untuk penyampaian dokumen yang baharu adalah:
${c.solicitorAddress}

Bertarikh pada ${c.filingDate}.

                                         ........................................
                                         ${c.solicitorFirm}
                                         Peguamcara baharu bagi pihak Plaintif
`,
  },
  {
    id: "consent-judgment",
    name: "Consent Judgment / Order in Terms",
    category: "Court Documents",
    desc: "Settlement recorded as consent judgment between parties",
    build: (c) => `${heading(c)}

PENGHAKIMAN PERSETUJUAN
(CONSENT JUDGMENT / ORDER IN TERMS)

DI HADAPAN: YA TUAN/PUAN HAKIM ............
DALAM KAMAR/MAHKAMAH TERBUKA pada ${c.filingDate}

ATAS KEHADIRAN peguamcara bagi pihak-pihak DAN ATAS PERSETUJUAN pihak-pihak,

ADALAH DENGAN INI DIPERINTAHKAN bahawa:

1.  Defendan hendaklah membayar kepada Plaintif jumlah RM ............ (Ringgit Malaysia ............ sahaja) sebagai penyelesaian penuh dan muktamad bagi tindakan ini;

2.  Bayaran tersebut hendaklah dibuat dalam tempoh tiga puluh (30) hari dari tarikh perintah ini melalui peguamcara Plaintif;

3.  Setelah bayaran dibuat, tindakan ini disifatkan sebagai diberhentikan dengan prejudis;

4.  Setiap pihak menanggung kos masing-masing / Defendan menanggung kos berjumlah RM ............;

5.  Tiada perintah lain.

DIPERSETUJUI OLEH:

........................................          ........................................
Peguamcara Plaintif                                Peguamcara Defendan
${c.solicitorFirm}                                <<Tetuan Defendan>>

DIREKODKAN OLEH:

........................................
PENDAFTAR

Bertarikh pada ${c.filingDate}.
`,
  },
  {
    id: "notice-of-appeal",
    name: "Notice of Appeal",
    category: "Court Documents",
    desc: "Notice of appeal against judgment to High Court / Court of Appeal",
    build: (c) => `${heading(c)}

NOTIS RAYUAN

KEPADA: PENDAFTAR Mahkamah tersebut di atas
        DAN KEPADA peguamcara bagi pihak Plaintif

AMBIL NOTIS bahawa Defendan dengan ini merayu kepada Mahkamah Tinggi/Mahkamah Rayuan terhadap keseluruhan/sebahagian penghakiman/perintah Mahkamah ini bertarikh ............ yang diberikan oleh YA Tuan/Puan Hakim ............

ALAMAT UNTUK PENYAMPAIAN: <<alamat peguamcara perayu>>

Bertarikh pada ${c.filingDate}.

                                         ........................................
                                         <<Tetuan Defendan>>
                                         Peguamcara bagi pihak Defendan/Perayu
`,
  },
  {
    id: "memo-of-appeal",
    name: "Memorandum of Appeal",
    category: "Court Documents",
    desc: "Memorandum setting out grounds of appeal",
    build: (c) => `${heading(c)}

MEMORANDUM RAYUAN

Defendan/Perayu dengan ini merayu terhadap keseluruhan penghakiman/perintah YA Tuan/Puan Hakim ............ bertarikh ............ atas alasan-alasan berikut:

1.  Bahawa Hakim Yang Mulia telah terkhilaf dalam undang-undang dan fakta apabila mendapati Defendan bertanggungjawab sepenuhnya/sebahagian besar atas kemalangan pada ${c.accidentDate};

2.  Bahawa Hakim Yang Mulia telah terkhilaf dalam tidak memberi pertimbangan yang sewajarnya kepada keterangan kecuaian sumbangan oleh Plaintif;

3.  Bahawa Hakim Yang Mulia telah terkhilaf dalam mengaward ganti rugi am yang melampau dan tidak selari dengan award-award perbandingan;

4.  Bahawa Hakim Yang Mulia telah terkhilaf dalam menggunakan pengganda yang terlalu tinggi dalam pengiraan kehilangan pendapatan masa hadapan;

5.  Bahawa Hakim Yang Mulia telah terkhilaf dalam menerima/menolak keterangan pakar <<nama pakar>>;

6.  Apa-apa alasan tambahan yang akan dimajukan pada masa pendengaran rayuan.

OLEH YANG DEMIKIAN, Defendan/Perayu memohon:
   (a) Penghakiman bertarikh ............ diketepikan;
   (b) Tindakan Plaintif ditolak; ATAU
   (c) Award ganti rugi dikurangkan kepada amaun yang munasabah;
   (d) Kos di Mahkamah ini dan di bawah ditanggung oleh Plaintif.

Bertarikh pada ${c.filingDate}.

                                         ........................................
                                         <<Tetuan Defendan>>
                                         Peguamcara bagi pihak Defendan/Perayu
`,
  },
  {
    id: "bill-of-costs",
    name: "Bill of Costs (O.59)",
    category: "Court Documents",
    desc: "Bill of party-and-party costs for taxation",
    build: (c) => `${heading(c)}

BIL KOS
(BILL OF COSTS — Aturan 59, Kaedah-Kaedah Mahkamah 2012)

KOS DIBERIKAN KEPADA: Plaintif (menurut perintah bertarikh ${c.filingDate})

BAHAGIAN A — KOS PEGUAMCARA (GETTING-UP)
+------+--------------------------------------------------+--------------+
| Bil  | Item                                             | Jumlah (RM)  |
+------+--------------------------------------------------+--------------+
| 1    | Pemberian arahan dan pengambilan kenyataan saksi |              |
| 2    | Penyediaan pliding (Writ, SOC, Reply)            |              |
| 3    | Surat-menyurat dengan pihak-pihak                |              |
| 4    | Telekonferens & mesyuarat                        |              |
| 5    | Penyediaan untuk perbicaraan                     |              |
| 6    | Hadir di perbicaraan (<<bilangan>> hari)         |              |
| 7    | Penyediaan hujahan bertulis                      |              |
+------+--------------------------------------------------+--------------+
|      | JUMLAH BAHAGIAN A:                               |              |
+------+--------------------------------------------------+--------------+

BAHAGIAN B — KOS PERBELANJAAN (DISBURSEMENTS)
+------+--------------------------------------------------+--------------+
| 1    | Yuran pemfailan Mahkamah                         |              |
| 2    | Yuran penyampaian (proses server)                |              |
| 3    | Yuran sapina                                     |              |
| 4    | Wang saksi (witness expenses)                    |              |
| 5    | Yuran pakar (expert witness fees)                |              |
| 6    | Fotostat & penjilidan                            |              |
| 7    | Perjalanan & penginapan                          |              |
+------+--------------------------------------------------+--------------+
|      | JUMLAH BAHAGIAN B:                               |              |
+------+--------------------------------------------------+--------------+

JUMLAH BESAR (A + B):                                    RM ............

DISEDIAKAN OLEH:
${c.solicitorFirm}
${c.solicitorAddress}
Peguamcara bagi pihak Plaintif

Bertarikh pada ${c.filingDate}.

CATATAN: Bil ini hendaklah diserahkan kepada Penolong Kanan Pendaftar untuk pentaksiran (taxation) menurut Aturan 59.
`,
  },
  {
    id: "skeletal-submissions",
    name: "Written Submissions (Skeletal)",
    category: "Court Documents",
    desc: "Plaintiff's written submissions for trial",
    build: (c) => `${heading(c)}

HUJAHAN BERTULIS PLAINTIF
(PLAINTIFF'S WRITTEN SUBMISSIONS)

A. PENGENALAN

1.  Tindakan ini timbul daripada satu kemalangan jalan raya yang berlaku pada ${c.accidentDate} di ${c.accidentPlace}, yang melibatkan kenderaan ${c.plaintiffVehicle} (Plaintif) dan kenderaan ${c.defendantVehicle} (Defendan).

2.  Plaintif menuntut ganti rugi am dan khas atas dasar kecuaian Defendan.

B. ISU-ISU UNTUK DIPUTUSKAN

3.  Yang Mulia diperlukan untuk memutuskan:
    (i)  Sama ada kemalangan disebabkan oleh kecuaian Defendan;
    (ii) Sama ada terdapat kecuaian sumbangan oleh Plaintif, dan jika ada, peratusannya;
    (iii) Kuantum ganti rugi am dan khas yang sepatutnya diawardkan kepada Plaintif.

C. HUJAHAN ATAS LIABILITI

4.  Berdasarkan Laporan Polis No: ${c.policeReportNo} dan keterangan PW1, kemalangan disebabkan oleh kecuaian Defendan kerana <<huraian ringkas>>.

5.  Plaintif merujuk kepada kes Mat v. Public Trustee, Federation of Malaya [1957] MLJ 60 yang memutuskan bahawa kewajipan berhati-hati pemandu adalah ketara dan mutlak.

6.  Tiada sebarang keterangan yang menyokong kecuaian sumbangan oleh Plaintif.

D. HUJAHAN ATAS KUANTUM

7.  GANTI RUGI AM:
    Plaintif mengalami ${c.injuriesSummary}. Berdasarkan award perbandingan dalam kes-kes serupa (rujuk Bundle of Authorities), award yang adil dan munasabah adalah RM ............ untuk kesakitan dan kesusahan.

8.  GANTI RUGI KHAS:
    Plaintif telah membuktikan ganti rugi khas berjumlah ${c.specialDamages} dengan resit-resit (Eksibit P-2 hingga P-...).

9.  KEHILANGAN PENDAPATAN MASA HADAPAN:
    Menggunakan kaedah multiplier-multiplicand dengan multiplicand RM ............ dan multiplier ............, kehilangan pendapatan masa hadapan adalah RM ............

E. KESIMPULAN

10. Plaintif berhormatnya memohon penghakiman terhadap Defendan untuk:
    (a) Ganti rugi am sebanyak RM ............;
    (b) Ganti rugi khas sebanyak ${c.specialDamages};
    (c) Faedah menurut s.11 Akta Undang-Undang Sivil 1956;
    (d) Kos.

DISEDIAKAN OLEH:
${c.solicitorFirm}
${c.solicitorAddress}
Peguamcara bagi pihak Plaintif

Bertarikh pada ${c.filingDate}.
`,
  },
  {
    id: "list-of-issues",
    name: "Statement of Agreed Issues",
    category: "Court Documents",
    desc: "Statement of issues agreed between parties for trial",
    build: (c) => `${heading(c)}

PENYATAAN ISU-ISU YANG DIPERSETUJUI
(STATEMENT OF AGREED ISSUES)

Pihak-pihak melalui peguamcara masing-masing dengan ini bersetuju bahawa isu-isu yang perlu diputuskan oleh Mahkamah Yang Mulia ini adalah seperti berikut:

LIABILITI:
1.  Sama ada kemalangan jalan raya pada ${c.accidentDate} di ${c.accidentPlace} disebabkan oleh kecuaian Defendan?

2.  Jika ya, sama ada Plaintif juga cuai dan menyumbang kepada kemalangan tersebut, dan jika ya, apakah peratusan kecuaian sumbangan?

KUANTUM:
3.  Apakah jumlah ganti rugi am yang sepatutnya diawardkan kepada Plaintif bagi:
    (a) Kesakitan dan kesusahan;
    (b) Kehilangan kemudahan hidup (loss of amenities);
    (c) Kehilangan keupayaan mendapat pendapatan (LFE/LEC).

4.  Apakah jumlah ganti rugi khas yang dibuktikan oleh Plaintif?

5.  Apakah kadar dan tempoh faedah yang sepatutnya diberikan?

6.  Siapakah yang akan menanggung kos tindakan?

DIPERSETUJUI OLEH:

........................................          ........................................
Peguamcara Plaintif                                Peguamcara Defendan
${c.solicitorFirm}                                <<Tetuan Defendan>>

Bertarikh pada ${c.filingDate}.
`,
  },
  {
    id: "reply-defence-counterclaim",
    name: "Reply and Defence to Counterclaim",
    category: "Pleadings",
    desc: "Plaintiff's reply to defence and defence to counterclaim",
    build: (c) => `${heading(c)}

JAWAPAN DAN PEMBELAAN KEPADA TUNTUTAN BALAS

JAWAPAN

1.  Plaintif menerima dan/atau bergantung kepada apa yang diakui dalam Pernyataan Pembelaan dan menafikan setiap dakwaan dalam Pernyataan Pembelaan kecuali yang diakui secara nyata.

2.  Mengenai perenggan 3 Pernyataan Pembelaan, Plaintif menafikan kecuaian sumbangan dan mengulangi semula butir-butir kecuaian Defendan dalam perenggan 4 Pernyataan Tuntutan.

3.  Plaintif tidak cuai dalam apa-apa cara seperti yang didakwa atau langsung.

PEMBELAAN KEPADA TUNTUTAN BALAS

4.  Plaintif menafikan setiap dakwaan dalam Tuntutan Balas Defendan.

5.  Plaintif menafikan secara khusus bahawa beliau telah cuai sepertimana didakwa atau langsung dan menghendaki bukti yang ketat daripada Defendan.

6.  Plaintif tidak mengakui kecederaan, kerugian dan kerosakan yang didakwa oleh Defendan dalam Tuntutan Balas dan menghendaki bukti yang ketat.

7.  Save as expressly admitted, Plaintif menafikan setiap dakwaan dalam Tuntutan Balas seolah-olah disebut secara seriatim dan dinafikan secara seriatim.

OLEH YANG DEMIKIAN, Plaintif memohon supaya Tuntutan Balas Defendan ditolak dengan kos.
${sig(c)}`,
  },
  {
    id: "noa-leave-appeal",
    name: "Notice of Application — Leave to Appeal",
    category: "Interlocutory",
    desc: "Application for leave to appeal interlocutory order",
    build: (c) => `${heading(c)}

NOTIS PERMOHONAN
KEBENARAN UNTUK MERAYU
(Aturan 56 / Akta Mahkamah Kehakiman 1964 — s.68)

AMBIL NOTIS bahawa Mahkamah Yang Mulia ini akan dipohon untuk satu PERINTAH bahawa:

1.  Pemohon (Defendan) diberi kebenaran untuk merayu kepada Mahkamah Tinggi/Mahkamah Rayuan terhadap perintah YA Tuan/Puan Hakim ............ bertarikh ............;

2.  Pelaksanaan perintah tersebut digantung sementara menunggu pelupusan rayuan;

3.  Kos permohonan dalam kausa;

4.  Lain-lain perintah yang Mahkamah Yang Mulia ini fikirkan adil dan suaimanfaat.

ALASAN:
   (i) Perintah tersebut adalah perintah interlokutori yang memerlukan kebenaran untuk merayu;
   (ii) Rayuan menimbulkan persoalan undang-undang yang penting;
   (iii) Terdapat prospek kejayaan yang munasabah;
   (iv) Adalah adil dan munasabah supaya kebenaran diberikan.
${sig(c)}`,
  },
  {
    id: "noa-anton-piller",
    name: "Notice of Application — Anton Piller Order",
    category: "Interlocutory",
    desc: "Ex parte search and seizure order to preserve evidence",
    build: (c) => `${heading(c)}

NOTIS PERMOHONAN (EX PARTE)
PERINTAH ANTON PILLER

AMBIL NOTIS bahawa Mahkamah Yang Mulia ini akan dipohon ex parte untuk satu PERINTAH bahawa:

1.  Defendan, ejen, pegawai atau pekerjanya hendaklah membenarkan Plaintif (atau peguamcara/wakilnya) memasuki premis di .......................... pada bila-bila masa antara jam 9.00 pagi hingga 5.00 petang untuk:
    (a) Mencari, memeriksa dan mengambil dalam jagaan dokumen-dokumen, rekod, fail, perisian komputer dan apa-apa harta yang berkaitan dengan tindakan ini;
    (b) Membuat salinan dokumen-dokumen tersebut;
    (c) Mengambil gambar premis dan kandungannya;

2.  Defendan dilarang daripada memberitahu pihak ketiga mengenai perintah ini selama tujuh (7) hari;

3.  Plaintif memberi aku janji silang ganti rugi (cross-undertaking as to damages);

4.  Perintah ini akan dilaksanakan oleh peguamcara bebas (supervising solicitor) yang dilantik oleh Mahkamah;

5.  Liberty to apply.

ALASAN:
   (i) Plaintif mempunyai kes prima facie yang sangat kuat;
   (ii) Kerosakan yang dialami atau dialami terus oleh Plaintif adalah sangat serius;
   (iii) Terdapat keterangan jelas bahawa Defendan memiliki dokumen yang memberatkan dan terdapat risiko nyata bahawa Defendan akan memusnahkan dokumen tersebut sebelum permohonan inter partes;
   (iv) Plaintif sanggup memberi aku janji silang ganti rugi.
${sig(c)}`,
  },
  {
    id: "noa-norwich-pharmacal",
    name: "Notice of Application — Norwich Pharmacal Order",
    category: "Interlocutory",
    desc: "Order requiring third party to disclose information about wrongdoer",
    build: (c) => `${heading(c)}

NOTIS PERMOHONAN
PERINTAH NORWICH PHARMACAL

AMBIL NOTIS bahawa Mahkamah Yang Mulia ini akan dipohon untuk satu PERINTAH bahawa:

1.  Responden (<<nama pihak ketiga — contoh: bank, ISP, syarikat insurans>>) hendaklah dalam tempoh empat belas (14) hari mendedahkan kepada Pemohon:
    (a) Identiti penuh dan alamat <<orang yang dicari>>;
    (b) <<butir lain yang diperlukan>>;

2.  Responden hendaklah mengemukakan satu afidavit menyatakan butir-butir yang dikehendaki;

3.  Pemohon menanggung kos munasabah Responden untuk pematuhan perintah ini;

4.  Liberty to apply.

ALASAN:
   (i) Pemohon menjadi mangsa kepada satu kesalahan/kerosakan;
   (ii) Responden, walaupun tanpa salah, telah terlibat dalam kesalahan tersebut sehingga memudahkan kesalahan;
   (iii) Pendedahan adalah perlu untuk membolehkan Pemohon mengambil tindakan undang-undang;
   (iv) Pendedahan adalah dalam kepentingan keadilan.
${sig(c)}`,
  },
  {
    id: "originating-summons",
    name: "Originating Summons (O.7)",
    category: "Pleadings",
    desc: "Originating Summons for matters not requiring full pleadings",
    build: (c) => `${heading(c)}

SAMAN PEMULA
(Borang 7 — Aturan 7, Kaedah-Kaedah Mahkamah 2012)

ANTARA

${c.plaintiffName.toUpperCase()}
(NO. K/P: ${c.plaintiffIc})                                     ... PEMOHON

DAN

${c.defendantName.toUpperCase()}
(NO. K/P: ${c.defendantIc})                                     ... RESPONDEN

KEPADA: ${c.defendantName.toUpperCase()}
        ${c.defendantAddress}

KAMU DIPERINTAHKAN supaya hadir secara peribadi atau melalui peguamcara di Mahkamah ini di .......................... pada hari ............ haribulan ............ pada jam ............ pagi untuk pendengaran satu permohonan oleh Pemohon untuk satu perintah:

1.  <<Penyataan relief yang dipohon>>;
2.  Kos permohonan ini ditanggung oleh Responden;
3.  Lain-lain perintah yang Mahkamah Yang Mulia ini fikirkan adil dan suaimanfaat.

JIKA kamu tidak hadir, perintah-perintah tersebut boleh dibuat tanpa mendengar kamu lagi.

Permohonan ini disokong oleh afidavit ............ yang dilampirkan.

Bertarikh pada ${c.filingDate}.

                                         ........................................
                                         PENDAFTAR

Diendorskan oleh:
${c.solicitorFirm}
${c.solicitorAddress}
Peguamcara bagi pihak Pemohon
`,
  },
);

export const templateById = (id: string) => templates.find(t => t.id === id);
