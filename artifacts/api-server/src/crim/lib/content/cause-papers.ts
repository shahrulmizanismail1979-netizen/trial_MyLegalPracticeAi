// Court-ready Malaysian criminal cause-paper library.
// Each entry is a worked model draft: full court heading, drafted body text
// (not bare blanks), embedded statutory provisions + case authorities, and a
// NOTA AMALAN (practice note) for the practitioner. Placeholders are shown in
// [SQUARE BRACKETS]. Content renders in a monospace <pre> block.

export type CausePaperSeed = {
  category: string;
  title: string;
  court: string;
  description: string;
  templateContent: string;
};

const NOTE = "———————————————————————————————————————————————";

export const causePapers: CausePaperSeed[] = [
  // ========================= CHARGES =========================
  {
    category: "Charges (Pertuduhan)",
    title: "Charge Sheet — Master Format + Worked Examples (s.152 & s.153 CPC)",
    court: "Magistrates' Court / Sessions Court / High Court",
    description:
      "Drafting charges that survive challenge: the statutory rules under ss.152–156 CPC, three worked specimen charges, and the common defects that get charges quashed.",
    templateContent: `DALAM MAHKAMAH [MAJISTRET / SESYEN / TINGGI] DI [TEMPAT]
DALAM NEGERI [NEGERI], MALAYSIA
KES JENAYAH NO: [____________]

PENDAKWA RAYA
                                                              lawan
[NAMA PENUH ORANG KENA TUDUH (OKT)]
(No. K/P: [____________])

────────────────────────  PERTUDUHAN  ────────────────────────

RULES OF A VALID CHARGE (ss.152–156 CPC):
 • s.152(1): the charge must state the offence with which the accused is charged.
 • s.152(2)-(3): the offence may be described by its specific name; otherwise
   enough of the definition must be stated to give the accused notice.
 • s.152(4): the law AND the section of the law against which the offence is
   said to have been committed must be stated.
 • s.152(6): the charge must be in the language of the Court.
 • s.153: particulars as to the time and place of the alleged offence, and the
   person (if any) against whom it was committed, must be stated.
 • s.154: where the nature of the case requires it, the manner in which the
   offence was committed must be stated to give the accused notice of the
   matter charged.
 • s.156: an error or omission in the charge is not material unless the accused
   was in fact misled and a failure of justice was occasioned (read with s.422
   CPC — curable irregularity). See FAN YEW TENG v PP on the duty to frame a
   charge that conveys the precise accusation.

SPECIMEN 1 — THEFT (s.379 Penal Code)
"Bahawa kamu pada [tarikh], lebih kurang pukul [masa], di [tempat penuh],
dalam Daerah [____], dalam Negeri [____], telah melakukan kecurian dengan
mengambil [perihal harta — cth: sebuah telefon bimbit jenama [____] bernilai
RM[____]] kepunyaan [nama mangsa], dan dengan itu kamu telah melakukan suatu
kesalahan yang boleh dihukum di bawah Seksyen 379 Kanun Keseksaan."

SPECIMEN 2 — VOLUNTARILY CAUSING HURT WITH A WEAPON (s.324 Penal Code)
"Bahawa kamu pada [tarikh], lebih kurang pukul [masa], di [tempat], dalam
Daerah [____], dalam Negeri [____], dengan sengaja telah menyebabkan cedera
kepada [nama mangsa] dengan menggunakan [senjata — cth: sebilah pisau], iaitu
suatu alat yang digunakan untuk menetak, dan dengan itu kamu telah melakukan
suatu kesalahan yang boleh dihukum di bawah Seksyen 324 Kanun Keseksaan."

SPECIMEN 3 — TRAFFICKING IN DANGEROUS DRUGS (s.39B DDA 1952)
"Bahawa kamu pada [tarikh], lebih kurang pukul [masa], di [tempat], dalam
Daerah [____], dalam Negeri [____], telah mengedar dadah berbahaya, iaitu
[jenis dadah — cth: Methamphetamine] seberat [____] gram, dan dengan itu kamu
telah melakukan suatu kesalahan di bawah Seksyen 39B(1)(a) Akta Dadah
Berbahaya 1952 yang boleh dihukum di bawah Seksyen 39B(2) Akta yang sama."

Bertarikh pada [tarikh].

............................................
[NAMA] | Timbalan Pendakwa Raya
Bagi pihak Pendakwa Raya

${NOTE}
NOTA AMALAN (DEFENCE CHECKLIST — attack the charge first):
 1. Duplicity — is more than one distinct offence rolled into one charge?
    (s.163 CPC). 2. Mis-described section / wrong limb (e.g. s.39A vs s.39B
    DDA). 3. Missing essential particular — date, place, identity of property,
    name of victim, the specific weapon. 4. Charge discloses no offence on its
    face. 5. Where defect is curable, press for an AMENDMENT under s.158 CPC
    and then a recall of witnesses under s.162 — the defence is entitled to
    re-cross on the amended charge. A fundamentally bad charge that misleads
    the accused is NOT cured by s.422: see the "failure of justice" test.`,
  },

  // ========================= BAIL =========================
  {
    category: "Bail (Jaminan)",
    title: "Notice of Motion for Bail + Supporting Affidavit (ss.388–389 CPC)",
    court: "High Court (and Subordinate Courts)",
    description:
      "Full bail application package — Notice of Motion and a worked supporting affidavit deploying the Wee Swee Siang / Dato' Mat Shah bail factors with model averments.",
    templateContent: `DALAM MAHKAMAH TINGGI MALAYA DI [TEMPAT]
PERMOHONAN JENAYAH NO: [____________]
(Berkaitan Kes Jenayah No. [____] Mahkamah [____])

PENDAKWA RAYA
                                                              lawan
[NAMA OKT]

──────────────────────  NOTIS USUL  ──────────────────────
(Di bawah Seksyen 388 dan 389 Kanun Tatacara Jenayah)

AMBIL PERHATIAN bahawa Mahkamah yang Mulia ini akan dipohon oleh Pemohon/OKT
pada [tarikh] jam [masa] atau sebaik selepasnya bagi suatu PERINTAH bahawa:

 1. OKT dibenarkan jaminan sementara menunggu perbicaraan atas terma yang
    munasabah dan boleh ditanggung oleh OKT;
 2. Apa-apa perintah lanjut atau relief lain yang difikirkan adil oleh Mahkamah;
 3. Kos permohonan ini.

Permohonan ini disokong oleh afidavit [nama deponen] yang diikrarkan pada
[tarikh] dan alasan-alasan yang dinyatakan di dalamnya.

Bertarikh pada [tarikh].
............................................
Peguamcara bagi pihak OKT

═══════════════════  AFIDAVIT SOKONGAN  ═══════════════════

Saya, [NAMA DEPONEN], No. K/P [____], beralamat di [____], dewasa, dengan
sesungguhnya berikrar dan menyatakan seperti berikut:

1. Saya adalah [OKT sendiri / bapa / isteri / penjamin yang dicadangkan] dan
   berikrar afidavit ini daripada pengetahuan saya sendiri, kecuali di mana
   dinyatakan sebaliknya.

2. OKT telah ditangkap pada [tarikh] dan dipertuduh di bawah Seksyen [____]
   bagi kesalahan yang boleh dijamin / tidak boleh dijamin / tidak boleh
   dijamin tetapi atas budi bicara Mahkamah.

LATAR BELAKANG — IKATAN DENGAN MASYARAKAT (community ties):
3. OKT seorang warganegara Malaysia berumur [__] tahun, menetap secara tetap
   di alamat di atas selama [__] tahun bersama [keluarga].
4. OKT bekerja sebagai [____] dengan [majikan] berpendapatan RM[____] sebulan
   dan menanggung [bilangan] orang tanggungan.

PRINSIP-PRINSIP JAMINAN (the established factors):
5. Tujuan jaminan ialah untuk memastikan kehadiran OKT, BUKAN hukuman awal:
   lihat WEE SWEE SIANG v PP [1948] MLJ 114 dan PP v DATO' MAT SHAH bin MOHD
   YUSOFF. Faktor-faktor relevan termasuk:
     (a) keseriusan/keterukan kesalahan dan beratnya keterangan;
     (b) risiko OKT melarikan diri (risk of absconding);
     (c) risiko gangguan terhadap saksi atau keterangan;
     (d) kesihatan, umur dan jantina OKT; dan
     (e) tempoh kemungkinan sebelum perbicaraan.
6. OKT TIDAK berisiko melarikan diri: beliau menyerahkan pasportnya, mempunyai
   alamat tetap dan ikatan keluarga/pekerjaan yang kukuh.
7. OKT TIDAK akan mengganggu saksi: saksi-saksi pendakwaan adalah [pegawai
   awam / tidak dikenali OKT] dan keterangan dokumentari telah dirampas.
8. OKT seorang pesalah pertama tanpa rekod lampau dan sentiasa memberi
   kerjasama kepada penyiasat.

UNDERTAKING:
9. OKT mengaku janji untuk hadir pada setiap tarikh, mematuhi syarat melapor
   diri di Balai Polis [____] dan apa-apa syarat lain yang ditetapkan.

Maka saya berikrar afidavit ini dengan mempercayai kandungannya adalah benar.

Diikrarkan oleh [nama deponen]     )
di hadapan saya di [____]          )      ............................
pada [tarikh]                      )      Pesuruhjaya Sumpah

${NOTE}
NOTA AMALAN: For an unbailable offence the burden is on the defence to show
bail is justified; lead with HEALTH, age, delay and weakness of the
prosecution case. Always propose concrete terms (quantum, sureties, reporting,
passport surrender, residence) — a court grants bail more readily when the
risk is pre-managed. For SOSMA / firearms-trafficking matters see the dedicated
SOSMA template: ordinary bail principles do NOT apply.`,
  },

  {
    category: "Bail (Jaminan)",
    title: "Application for Bail Pending Appeal (s.311 CPC)",
    court: "High Court / Court of Appeal",
    description:
      "Post-conviction bail. Built around the 'special / exceptional circumstances' threshold from Bhandulananda Jayatilake and the short-sentence / arguable-appeal grounds.",
    templateContent: `DALAM MAHKAMAH [TINGGI / RAYUAN] [DI / MALAYSIA] [TEMPAT]
RAYUAN JENAYAH NO: [____________]

[NAMA] ............................................ PERAYU
                                                              dan
PENDAKWA RAYA ................................. RESPONDEN

──────  PERMOHONAN JAMINAN MENUNGGU RAYUAN  ──────
(Di bawah Seksyen 311 Kanun Tatacara Jenayah)

Perayu memohon untuk dibebaskan dengan jaminan menunggu pelupusan rayuan ini
atas alasan-alasan berikut:

1. PRINSIP: Jaminan selepas sabitan TIDAK diberi secara automatik. Pemohon
   mesti menunjukkan "keadaan istimewa atau luar biasa" (special or exceptional
   circumstances): BHANDULANANDA JAYATILAKE v PP [1982] 1 MLJ 83.

2. RAYUAN BERMERIT: Terdapat persoalan undang-undang yang boleh dipertikaikan
   (arguable points), khususnya bahawa Hakim Bicara terkhilaf apabila [____].
   Rayuan ini bukan remeh dan mempunyai prospek kejayaan yang nyata.

3. HUKUMAN PENDEK / RAYUAN AKAN TERNYATA SIA-SIA: Hukuman penjara [__] bulan
   berkemungkinan tamat dijalani SEBELUM rayuan didengar; menolak jaminan akan
   menjadikan hak rayuan Perayu nugatori (illusory).

4. KEADAAN PERIBADI: Perayu seorang pesalah pertama, mempunyai alamat tetap,
   ikatan keluarga yang kukuh, dan sepanjang perbicaraan telah mematuhi setiap
   syarat jaminan tanpa sebarang kemungkiran.

5. TIADA RISIKO: Perayu tidak berisiko melarikan diri dan bersedia menyerahkan
   pasport serta melapor diri secara berkala.

Perayu memohon perintah jaminan atas terma yang difikirkan adil oleh Mahkamah.

Bertarikh pada [tarikh].
............................................
Peguamcara bagi pihak Perayu

${NOTE}
NOTA AMALAN: Stack BOTH limbs — an arguable appeal AND a sentence short enough
that detention would defeat the appeal. Exhibit the Notice/Petition of Appeal
and any written grounds already filed to show the appeal is live and serious.`,
  },

  // ========================= PRE-TRIAL =========================
  {
    category: "Pre-trial",
    title: "Application for Documents / Disclosure (s.51A CPC)",
    court: "Sessions Court / High Court",
    description:
      "Worked s.51A disclosure application with the governing authorities (Anthony Gomez; Dato' Seri Anwar) and a precise schedule of documents — including the duty to disclose material favourable to the defence.",
    templateContent: `DALAM MAHKAMAH [SESYEN / TINGGI] DI [TEMPAT]
KES JENAYAH NO: [____________]

PENDAKWA RAYA  lawan  [NAMA OKT]

──────  PERMOHONAN PEMBERIAN DOKUMEN  ──────
(Di bawah Seksyen 51A Kanun Tatacara Jenayah)

1. OKT memohon supaya pihak Pendakwaan menyerahkan, sebelum perbicaraan,
   dokumen-dokumen berikut yang Pendakwaan bercadang untuk mengemukakan:

   JADUAL DOKUMEN
   (a) Pernyataan pertama maklumat (first information report) di bawah s.107 CPC;
   (b) Senarai saksi pendakwaan dan pernyataan bertulis setiap saksi;
   (c) Apa-apa dokumen atau ekshibit yang akan dikemukakan sebagai keterangan;
   (d) Laporan-laporan pakar (kimia, patologi, balistik, forensik IT, dll.);
   (e) Apa-apa rakaman CCTV / foto / dokumen yang dirampas; dan
   (f) Apa-apa keterangan yang MENYOKONG pembelaan atau yang boleh menjejaskan
       kes pendakwaan (exculpatory material).

2. KUASA & PRINSIP: Seksyen 51A mewajibkan Pendakwaan menyerahkan dokumen yang
   dinyatakan. Tujuannya ialah perbicaraan yang adil dan persediaan pembelaan
   yang secukupnya: lihat ANTHONY GOMEZ v KETUA POLIS DAERAH KUANTAN dan
   PP v DATO' SERI ANWAR IBRAHIM mengenai skop pendedahan dan kepentingan
   menerima dokumen lebih awal supaya pembelaan tidak terkejut (no trial by
   ambush).

3. Kegagalan menyerahkan dokumen yang material boleh menjejaskan keadilan
   perbicaraan dan menyokong inferens bertentangan terhadap Pendakwaan.

OKT memohon perintah bahawa dokumen-dokumen tersebut diserahkan dalam tempoh
[__] hari dari tarikh perintah.

Bertarikh pada [tarikh].
............................................
Peguamcara bagi pihak OKT

${NOTE}
NOTA AMALAN: Frame each item by reference to an ingredient or a defence so the
court sees relevance. If the prosecution withholds, renew the application on the
record and reserve the point for submission of no case / appeal. Note s.51A is
NOT full common-law discovery — be specific, not fishing.`,
  },

  {
    category: "Pre-trial",
    title: "Notice of Alibi (s.402A CPC)",
    court: "Sessions Court / High Court",
    description:
      "s.402A alibi notice with the particulars the section requires, plus the consequence of late or defective notice (Hussin bin Sillit; Vasan Singh).",
    templateContent: `DALAM MAHKAMAH [SESYEN / TINGGI] DI [TEMPAT]
KES JENAYAH NO: [____________]

PENDAKWA RAYA  lawan  [NAMA OKT]

──────────────────  NOTIS ALIBI  ──────────────────
(Di bawah Seksyen 402A Kanun Tatacara Jenayah)

Kepada: Timbalan Pendakwa Raya, [____]

AMBIL PERHATIAN bahawa OKT bercadang untuk mengemukakan pembelaan alibi di
perbicaraan dan memberi butir-butir berikut:

1. Pada masa material kesalahan didakwa berlaku, iaitu pada [tarikh] lebih
   kurang pukul [masa], OKT TIDAK berada di [tempat kejadian] tetapi berada di
   [alamat penuh tempat alibi].

2. SAKSI-SAKSI ALIBI:
   (a) Nama: [____]  No. K/P: [____]  Alamat: [____]
       Ringkasan keterangan: [____]
   (b) Nama: [____]  No. K/P: [____]  Alamat: [____]
       Ringkasan keterangan: [____]

3. DOKUMEN SOKONGAN: [resit, rakaman CCTV, log perjalanan, rekod telefon, dll.]

Bertarikh pada [tarikh].
............................................
Peguamcara bagi pihak OKT

${NOTE}
NOTA AMALAN: s.402A requires the notice no later than TEN DAYS before trial;
without it, alibi evidence is inadmissible. Give full particulars — a bare
notice is worthless: HUSSIN bin SILLIT v PP; VASAN SINGH v PP. File early; serve
on the DPP and keep proof of service. Alibi does not shift the legal burden —
the prosecution must still disprove it beyond reasonable doubt.`,
  },

  {
    category: "Pre-trial",
    title: "Notice of Intention to Adduce Expert Evidence",
    court: "Sessions Court / High Court",
    description:
      "Notice identifying the expert, field, qualifications and report, with the s.45 Evidence Act foundation and Junaidi bin Abdullah test for expert opinion.",
    templateContent: `DALAM MAHKAMAH [SESYEN / TINGGI] DI [TEMPAT]
KES JENAYAH NO: [____________]

PENDAKWA RAYA  lawan  [NAMA OKT]

──────  NOTIS KETERANGAN PAKAR  ──────

OKT memberi notis bahawa beliau bercadang memanggil saksi pakar berikut:

1. Nama pakar: [____]
2. Bidang kepakaran: [cth: patologi forensik / kimia / balistik / forensik IT
   / psikiatri]
3. Kelayakan & pengalaman: [____]
4. Skop pendapat: pakar akan memberi keterangan mengenai [____].
5. Laporan pakar bertarikh [____] dilampirkan / akan diserahkan dalam [__] hari.

ASAS UNDANG-UNDANG: Seksyen 45 Akta Keterangan 1950 membenarkan pendapat orang
yang mahir. Ujian kebolehterimaan: pakar mesti benar-benar mahir dan pendapat
mesti membantu Mahkamah — lihat JUNAIDI bin ABDULLAH v PP [1993] 3 MLJ 217 dan
DATO' MOKHTAR HASHIM v PP mengenai berat keterangan pakar.

Bertarikh pada [tarikh].
............................................
Peguamcara bagi pihak OKT

${NOTE}
NOTA AMALAN: Serve the report early — surprise expert evidence invites
exclusion or an adjournment against you. The expert must state facts assumed,
methodology, and reasoning; an ipse dixit ("trust me") opinion carries little
weight (Junaidi). Prepare the expert for cross on qualifications and method.`,
  },

  // ========================= TRIAL =========================
  {
    category: "Trial",
    title: "Submission of No Case to Answer (ss.173(f) & 180 CPC)",
    court: "Sessions Court / High Court",
    description:
      "The flagship close-of-prosecution submission applying the maximum-evaluation test (Looi Kow Chai; Balachandran; PP v Mohd Radzi) with a worked, ingredient-by-ingredient skeleton.",
    templateContent: `DALAM MAHKAMAH [SESYEN / TINGGI] DI [TEMPAT]
KES JENAYAH NO: [____________]

PENDAKWA RAYA  lawan  [NAMA OKT]

──  HUJAHAN TIADA KES UNTUK DIJAWAB (NO CASE TO ANSWER)  ──
(Di penutup kes Pendakwaan — s.173(f) CPC [Sesyen/Majistret] /
 s.180 CPC [Mahkamah Tinggi])

A. UJIAN UNDANG-UNDANG
1. Di penutup kes Pendakwaan, Mahkamah mesti menjalankan PENILAIAN MAKSIMUM
   (maximum evaluation) terhadap keterangan dan bertanya: jika saya memanggil
   OKT membela diri dan beliau berdiam diri, adakah saya sanggup mensabitkan
   atas keterangan setakat ini? Jika tidak, prima facie tidak terbukti dan OKT
   mesti dilepas dan dibebaskan: LOOI KOW CHAI v PP [2003] 2 MLJ 65 (CA);
   BALACHANDRAN v PP [2005] 2 MLJ 301 (FC); PP v MOHD RADZI bin ABU BAKAR
   [2005] 6 MLJ 393 (FC).
2. Kes prima facie ialah kes yang, jika tidak disangkal, mencukupi untuk
   sabitan — bukan sekadar keterangan yang "boleh dipercayai jika diterima".

B. KEGAGALAN MEMBUKTIKAN INTI PATI (ingredient-by-ingredient)
   Pertuduhan di bawah s.[____] memerlukan Pendakwaan membuktikan:
   (i)  [inti pati 1] — Keterangan: [____]. KELEMAHAN: [____].
   (ii) [inti pati 2] — Keterangan: [____]. KELEMAHAN: [____].
   (iii)[inti pati 3 — mens rea / milikan / pengenalan] — KELEMAHAN: [____].

C. KECACATAN KETERANGAN PENDAKWAAN
   • Pengenalan OKT tidak selamat (unsafe identification) — panduan TURNBULL
     seperti diterima pakai dalam JAAFAR bin ALI v PP / DATO' MOKHTAR HASHIM;
   • Rantaian keterangan (chain of evidence) terputus pada [____];
   • Percanggahan material antara saksi-saksi pada [____];
   • Tiada keterangan langsung terhadap inti pati [____].

D. PERMOHONAN
   OKT memohon dilepas dan dibebaskan (acquitted and discharged) atas semua
   pertuduhan kerana Pendakwaan gagal membuktikan kes prima facie.

Bertarikh pada [tarikh].
............................................
Peguamcara bagi pihak OKT

${NOTE}
NOTA AMALAN: Argue ingredient by ingredient — concede what is genuinely proven
and concentrate fire on the weakest essential element (usually mens rea,
possession/knowledge, or identification). Quote the maximum-evaluation passage
verbatim. Even if the submission fails, it locks the prosecution's case and
frames your defence and any appeal.`,
  },

  {
    category: "Trial",
    title: "Voir Dire — Trial Within a Trial (Admissibility of Confession, s.24–27 EA)",
    court: "Sessions Court / High Court",
    description:
      "Application to challenge a cautioned statement / confession as involuntary, with the s.24 Evidence Act test and the voir dire procedure (Francis Antonysamy; PP v Law Say Seck).",
    templateContent: `DALAM MAHKAMAH [SESYEN / TINGGI] DI [TEMPAT]
KES JENAYAH NO: [____________]

PENDAKWA RAYA  lawan  [NAMA OKT]

──  BANTAHAN KEBOLEHTERIMAAN PENGAKUAN / PERCAKAPAN BERAMARAN  ──
(Permohonan untuk perbicaraan dalam perbicaraan — voir dire)

1. Apabila Pendakwaan cuba mengemukakan percakapan beraman / pengakuan OKT,
   pembelaan MEMBANTAH kebolehterimaannya dan memohon perbicaraan dalam
   perbicaraan (voir dire) untuk menentukan kesukarelaan.

2. UJIAN: Suatu pengakuan tidak boleh diterima jika ia dibuat akibat
   dorongan, ancaman atau janji (inducement, threat or promise) daripada
   seseorang yang berkuasa — s.24 Akta Keterangan 1950. Beban membuktikan
   kesukarelaan tanpa keraguan munasabah terletak pada PENDAKWAAN:
   FRANCIS ANTONYSAMY v PP [2005] 3 MLJ 389 (FC); PP v LAW SAY SECK;
   LEMANIT v PP.

3. ALASAN KETIDAKSUKARELAAN (worked grounds):
   (a) OKT didera / diugut secara fizikal atau psikologi semasa siasatan;
   (b) OKT dijanjikan akan dilepaskan / dibantu jika mengaku;
   (c) OKT tidak diberi amaran sewajarnya / tidak faham bahasa amaran;
   (d) OKT dinafikan akses kepada peguam, makanan, rehat atau rawatan;
   (e) Tempoh soal siasat yang berpanjangan dan menindas (oppressive).

4. PROSEDUR: Mahkamah hendaklah menangguh isu kebolehterimaan, mendengar
   keterangan kedua-dua pihak DALAM voir dire (termasuk OKT jika beliau pilih),
   dan memutuskan kesukarelaan SEBELUM kandungan pengakuan didedahkan kepada
   tribunal fakta.

OKT memohon perintah bahawa pengakuan/percakapan tersebut tidak boleh diterima
sebagai keterangan.

Bertarikh pada [tarikh].
............................................
Peguamcara bagi pihak OKT

${NOTE}
NOTA AMALAN: Raise the objection the moment the IO is asked to produce the
statement — do not let the contents slip in. Put each allegation of
oppression squarely to the recording officer and IO. Even if admitted,
involuntariness goes to WEIGHT and is preserved for submission and appeal.
Watch the s.27 "information leading to discovery" exception — only the part
that distinctly relates to the fact discovered is admissible.`,
  },

  {
    category: "Trial",
    title: "Application to Impeach Credit of Witness (ss.145 & 155 EA)",
    court: "Sessions Court / High Court",
    description:
      "Procedure to impeach a prosecution witness on a material contradiction with a former statement (Muthusamy v PP; Dato' Mokhtar Hashim), with the four-step Muthusamy approach.",
    templateContent: `DALAM MAHKAMAH [SESYEN / TINGGI] DI [TEMPAT]
KES JENAYAH NO: [____________]

PENDAKWA RAYA  lawan  [NAMA OKT]

──  PERMOHONAN MENCABAR KREDIBILITI SAKSI (IMPEACHMENT)  ──
(Seksyen 145 & 155(c) Akta Keterangan 1950)

1. Pembelaan memohon untuk mencabar kredit saksi [nama, SP__] atas percanggahan
   material antara keterangannya di Mahkamah dan pernyataan terdahulunya
   (s.112 CPC / polis) bertarikh [____].

2. PERCANGGAHAN MATERIAL:
   • Di Mahkamah saksi berkata: "[____]".
   • Dalam pernyataan terdahulu saksi berkata: "[____]".
   Percanggahan ini menyentuh [inti pati / pengenalan / urutan kejadian] dan
   bukan remeh.

3. PROSEDUR (MUTHUSAMY v PP [1948] MLJ 57; DATO' MOKHTAR HASHIM v PP):
   (a) tunjuk percanggahan kepada saksi dan beri peluang menjelaskan;
   (b) jika penjelasan tidak memuaskan, pohon tanda pernyataan terdahulu;
   (c) Mahkamah menimbang sama ada percanggahan adalah material; dan
   (d) jika ya, Mahkamah boleh membenarkan impeachment — keseluruhan
       keterangan saksi itu kemudian dinilai dengan berhati-hati.

4. Kesan impeachment bukan automatik menolak semua keterangan saksi; ia
   memerlukan penilaian semula kredibiliti keseluruhan saksi tersebut.

Bertarikh pada [tarikh].
............................................
Peguamcara bagi pihak OKT

${NOTE}
NOTA AMALAN: Secure the prior statement first (via s.51A / s.112). Lay the
contradiction precisely — judges refuse impeachment for trivial discrepancies.
Always put the former statement to the witness before tendering it; springing
it without warning breaches s.145.`,
  },

  {
    category: "Trial",
    title: "Application to Recall a Witness (s.425 CPC)",
    court: "All Courts",
    description:
      "Recall application where fresh matters arise, with the 'essential to a just decision' threshold.",
    templateContent: `DALAM MAHKAMAH [____] DI [TEMPAT]
KES JENAYAH NO: [____________]

PENDAKWA RAYA  lawan  [NAMA OKT]

──  PERMOHONAN MEMANGGIL SEMULA SAKSI  ──
(Di bawah Seksyen 425 Kanun Tatacara Jenayah)

1. Pemohon memohon agar saksi [nama, SP/SD __] dipanggil semula untuk
   keterangan tambahan / soal balas lanjut.

2. ALASAN: Sejak keterangan asal pada [tarikh], perkara baharu telah timbul,
   iaitu [cth: dokumen baharu didedahkan / percanggahan yang baru dikenal
   pasti / fakta yang sebelum ini tidak diketahui]. Keterangan saksi ini
   adalah PENTING untuk Mahkamah membuat keputusan yang saksama.

3. KUASA: s.425 memberi Mahkamah kuasa pada bila-bila peringkat untuk memanggil
   atau memanggil semula mana-mana saksi jika keterangannya kelihatan penting
   kepada keputusan adil kes. Kuasa ini dijalankan demi keadilan, bukan untuk
   menampung kecuaian sesuatu pihak.

Bertarikh pada [tarikh].
............................................
[Peguamcara / Timbalan Pendakwa Raya]

${NOTE}
NOTA AMALAN: Frame recall as serving the court's search for truth, not as
filling a gap you should have closed. Identify precisely the new matter and why
it could not have been dealt with earlier.`,
  },

  // ========================= SENTENCING =========================
  {
    category: "Sentencing",
    title: "Plea in Mitigation — Comprehensive Model (Rayuan Mitigasi)",
    court: "All Courts",
    description:
      "Full worked mitigation deploying the leading sentencing authorities (Sau Soo Kim discount; Mohamed Abdullah Ang public interest; Raja Izzuddin Shah totality; Bhandulananda restraint) with model paragraphs.",
    templateContent: `DALAM MAHKAMAH [____] DI [TEMPAT]
KES JENAYAH NO: [____________]

PENDAKWA RAYA  lawan  [NAMA OKT]

────────────────  RAYUAN MITIGASI  ────────────────

Yang Arif,

Saya bagi pihak OKT dengan hormatnya memohon hukuman yang setimpal dan
seadil-adilnya, dengan mengambil kira faktor-faktor berikut.

A. PRINSIP MENGIMBANGI (the sentencing balance)
   Hukuman mesti mengimbangi kepentingan awam dengan keadaan peribadi OKT:
   PP v LOO CHOON FATT [1976] 2 MLJ 256; MOHAMED ABDULLAH ANG SWEE KANG v PP
   [1988] 1 MLJ 167. Mahkamah tidak menghukum dengan dendam.

B. PENGAKUAN BERSALAH (guilty plea — the discount)
   OKT mengaku salah pada peringkat paling awal, menjimatkan masa dan kos
   Mahkamah serta saksi. Diskaun lazim satu pertiga (1/3) wajar diberi:
   SAU SOO KIM v PP [1975] 2 MLJ 134; MELVANI v PP. Pengakuan awal juga
   menunjukkan penyesalan tulen.

C. PESALAH PERTAMA & WATAK BAIK
   OKT pesalah pertama tanpa rekod lampau, berumur [__] tahun, [pekerjaan],
   menanggung [bilangan] tanggungan. Surat-surat watak dilampirkan. Peluang
   pemulihan wajar diutamakan bagi pesalah pertama: TUKIRAN bin TAIB / NEW TUCK
   SHEN v PP [1982] 1 MLJ 38.

D. FAKTOR PERIBADI & MITIGASI
   • Penyesalan dan permohonan maaf kepada mangsa;
   • Pampasan / restitusi sebanyak RM[____] telah dibayar (resit dilampirkan);
   • Kerjasama penuh dengan penyiasat;
   • Keadaan kesihatan / keluarga: [____];
   • Peranan kecil/periferi OKT dalam kejadian: [____].

E. PRINSIP KESELURUHAN (totality) & KESETARAAN (parity)
   Jika berbilang pertuduhan, jumlah hukuman keseluruhan mesti tidak melampau:
   RAJA IZZUDDIN SHAH v PP [1979] 1 MLJ 270. Hukuman OKT juga harus setara
   dengan rakan sejenayah yang dihukum [____].

F. PERMOHONAN
   OKT dengan hormatnya memohon hukuman minimum yang dibenarkan undang-undang,
   dan jika wajar, [hukuman percubaan (Bon Akhlak s.294 CPC) / perintah khidmat
   masyarakat / kompaun / penjara minimum] memandangkan rayuan campur tangan
   appellate hanya wajar jika hukuman jelas keterlaluan: BHANDULANANDA
   JAYATILAKE v PP [1982] 1 MLJ 83.

Bertarikh pada [tarikh].
............................................
Peguamcara bagi pihak OKT

${NOTE}
NOTA AMALAN: Lead with the strongest mitigating fact, not a recital of
biography. Tender documents (pay slips, medical reports, character letters,
restitution receipts) — assertions from the bar table carry little weight.
Where a mandatory minimum or mandatory whipping applies, address it head-on
(age >50 or female exempt from whipping: s.289 CPC).`,
  },

  // ========================= APPEALS =========================
  {
    category: "Appeals",
    title: "Notice of Appeal (s.307 CPC)",
    court: "All Appellate Courts",
    description:
      "The 14-day Notice of Appeal with the strict timeline and extension-of-time note.",
    templateContent: `DALAM MAHKAMAH [____] DI [TEMPAT]
KES JENAYAH NO: [____________]
RAYUAN JENAYAH NO: [____________]

[NAMA] .................................. PERAYU
                                              dan
PENDAKWA RAYA ...................... RESPONDEN

──────────────  NOTIS RAYUAN  ──────────────
(Di bawah Seksyen 307 Kanun Tatacara Jenayah)

Perayu memberi notis rayuan terhadap keputusan Yang Arif [____] yang diberikan
pada [tarikh], di mana Perayu telah:
   [ ] disabitkan di bawah Seksyen [____];
   [ ] dijatuhkan hukuman [____];
   [ ] kedua-duanya.

Perayu merayu terhadap:
   [ ] sabitan sahaja   [ ] hukuman sahaja   [ ] kedua-dua sabitan & hukuman

Bertarikh pada [tarikh].
............................................
Perayu / Peguamcara Perayu

${NOTE}
NOTA AMALAN: File within FOURTEEN (14) DAYS of the order (s.307(i) CPC) — the
clock is jurisdictional. If late, file simultaneously an application for
EXTENSION OF TIME under s.310/s.307 with an affidavit explaining the delay; do
not assume indulgence. Immediately apply in writing for the Grounds of Judgment.`,
  },

  {
    category: "Appeals",
    title: "Petition of Appeal — Worked Grounds (s.307(iii) CPC)",
    court: "All Appellate Courts",
    description:
      "Petition with specific, numbered, worked grounds covering errors of law, misdirection, wrongful admission of evidence and manifestly excessive sentence.",
    templateContent: `DALAM MAHKAMAH [TINGGI / RAYUAN / PERSEKUTUAN] [DI / MALAYSIA] [TEMPAT]
RAYUAN JENAYAH NO: [____________]

[NAMA] .................................. PERAYU
                                              dan
PENDAKWA RAYA ...................... RESPONDEN

──────────────  PETISYEN RAYUAN  ──────────────

Perayu merayu terhadap keputusan Yang Arif [____] bertarikh [____] atas
alasan-alasan berikut:

TERHADAP SABITAN:
1. Yang Arif terkhilaf di sisi undang-undang apabila gagal menjalankan
   PENILAIAN MAKSIMUM di penutup kes Pendakwaan dan tersilap mendapati kes
   prima facie sedangkan inti pati [____] tidak dibuktikan (Looi Kow Chai;
   Balachandran).
2. Yang Arif terkhilaf apabila menerima [keterangan/pengakuan] yang sepatutnya
   tidak boleh diterima kerana [tidak sukarela / s.27 disalah guna / hearsay].
3. Yang Arif tersalah arah diri (misdirection) apabila [____], dan/atau gagal
   mengarah diri (non-direction) mengenai [percanggahan material / beban bukti
   / keraguan munasabah / panduan pengenalan Turnbull].
4. Yang Arif gagal menimbang dengan secukupnya keterangan dan kes pembelaan,
   khususnya [____].
5. Sabitan adalah tidak selamat dan bertentangan dengan berat keterangan.

TERHADAP HUKUMAN (alternatif):
6. Hukuman yang dijatuhkan adalah nyata keterlaluan (manifestly excessive)
   dengan mengambil kira mitigasi, pengakuan awal dan status pesalah pertama;
   Yang Arif tersilap prinsip dan/atau terkhilaf fakta material (Bhandulananda
   Jayatilake v PP).

PERAYU MEMOHON:
   (a) rayuan dibenarkan; sabitan diketepikan; Perayu dilepas dan dibebaskan;
   ATAU secara alternatif (b) hukuman dikurangkan secara wajar.

Bertarikh pada [tarikh].
............................................
Peguamcara bagi pihak Perayu

${NOTE}
NOTA AMALAN: File within 14 days of receiving the Grounds of Judgment. Plead
grounds with specificity — "the decision is against the weight of evidence"
alone is liable to be struck out as too general. Tie every ground to a passage
in the grounds of judgment or the notes of evidence.`,
  },

  {
    category: "Appeals & Review",
    title: "Application for Criminal Revision (ss.323–325 CPC)",
    court: "High Court",
    description:
      "Invoking the High Court's revisionary jurisdiction over a subordinate court order — for correctness, legality or propriety — where no appeal lies or as an alternative.",
    templateContent: `DALAM MAHKAMAH TINGGI MALAYA DI [TEMPAT]
PERMOHONAN SEMAKAN JENAYAH NO: [____________]

[NAMA] .......................... PEMOHON
                                      dan
PENDAKWA RAYA ............ RESPONDEN

──  PERMOHONAN SEMAKAN (CRIMINAL REVISION)  ──
(Di bawah Seksyen 323, 324 & 325 Kanun Tatacara Jenayah)

1. Pemohon memohon Mahkamah Tinggi menjalankan kuasa semakan terhadap
   perintah/keputusan Mahkamah [Majistret/Sesyen] [____] bertarikh [____].

2. ALASAN: Perintah tersebut tidak betul, tidak sah atau tidak wajar
   (incorrect, illegal or improper) kerana:
   (a) [cth: Mahkamah menerima pengakuan salah tanpa memastikan ia difahami /
       fakta menyokong setiap inti pati — s.173(b) CPC];
   (b) [hukuman di luar bidang kuasa Mahkamah / melebihi had s.87 SCJA];
   (c) [keingkaran prosedur yang menjejaskan keadilan].

3. KUASA: Mahkamah Tinggi boleh meminta dan menyemak rekod (s.323) dan membuat
   apa-apa perintah yang difikirkan patut untuk membetulkan ketidakadilan
   (s.325), termasuk mengetepikan sabitan/hukuman atau memerintahkan
   perbicaraan semula.

Pemohon memohon perintah [ketepikan sabitan / kurangkan hukuman / perbicaraan
semula].

Bertarikh pada [tarikh].
............................................
Peguamcara bagi pihak Pemohon

${NOTE}
NOTA AMALAN: Revision is discretionary and best for clear jurisdictional or
procedural defects, or to fix an unlawful sentence quickly where appeal is
unavailable (e.g. after a guilty plea). It is not a substitute for a proper
appeal on the merits.`,
  },

  // ========================= SPECIAL PROCEDURE =========================
  {
    category: "Special Procedure",
    title: "Habeas Corpus — Application for Release from Unlawful Detention",
    court: "High Court",
    description:
      "Article 5(2) Federal Constitution / s.365 CPC application challenging the legality of detention, with the notice of motion and grounds.",
    templateContent: `DALAM MAHKAMAH TINGGI MALAYA DI [TEMPAT]
PERMOHONAN JENAYAH NO: [____________]

Dalam perkara permohonan untuk suatu perintah berbentuk Habeas Corpus di bawah
Perkara 5(2) Perlembagaan Persekutuan dan Seksyen 365 Kanun Tatacara Jenayah;

DAN dalam perkara penahanan [nama orang yang ditahan] di [tempat tahanan].

[NAMA PEMOHON] .................... PEMOHON
                                        dan
[PIHAK BERKUASA MENAHAN] ...... RESPONDEN

──────────  NOTIS USUL  ──────────

Pemohon akan memohon kepada Mahkamah pada [tarikh] untuk perintah bahawa:
1. [Nama tahanan] dibawa ke hadapan Mahkamah ini;
2. Penahanan beliau diisytihar tidak sah dan beliau dilepaskan dengan
   serta-merta; dan
3. Kos dan relief lanjut yang adil.

ALASAN (disokong oleh afidavit):
 (a) Penahanan melanggar Perkara 5(3): tahanan tidak dimaklumkan alasan tangkapan
     dengan seberapa segera dan/atau dinafikan hak berunding dengan peguam;
 (b) Tempoh tahan reman telah luput / diperolehi tanpa mematuhi s.117 CPC;
 (c) Perintah tahanan cacat pada zahirnya / dibuat tanpa bidang kuasa;
 (d) [alasan lain].

Bertarikh pada [tarikh].
............................................
Peguamcara bagi pihak Pemohon

${NOTE}
NOTA AMALAN: Habeas corpus tests the LEGALITY of detention, not the merits of
any charge — keep grounds focused on jurisdiction and procedure. Move fast and
exhibit the detention/remand order. Where statutory preventive-detention regimes
apply, address the limited grounds of review available (procedural
non-compliance / mala fides).`,
  },

  {
    category: "Special Procedure",
    title: "Application for Return of Seized Property / Exhibits (s.413 CPC)",
    court: "All Courts",
    description:
      "Application for disposal/return of property seized during investigation once it is no longer required for the case.",
    templateContent: `DALAM MAHKAMAH [____] DI [TEMPAT]
KES JENAYAH NO: [____________]

PENDAKWA RAYA  lawan  [NAMA OKT]

──  PERMOHONAN PEMULANGAN HARTA YANG DIRAMPAS  ──
(Di bawah Seksyen 413 Kanun Tatacara Jenayah)

1. Pemohon ialah pemilik sah [perihal harta — cth: sebuah kenderaan
   No. [____] / wang tunai RM[____] / telefon bimbit] yang dirampas pada [____]
   berkaitan kes ini.

2. Harta tersebut TIDAK lagi diperlukan sebagai keterangan kerana
   [perbicaraan selesai / harta bukan ekshibit material / kes telah dilupuskan].

3. Pemohon memohon perintah pemulangan harta tersebut kepadanya sebagai orang
   yang berhak kepada miliknya.

Bertarikh pada [tarikh].
............................................
Peguamcara bagi pihak Pemohon

${NOTE}
NOTA AMALAN: Exhibit proof of ownership (grant, receipt, registration). Where
ownership is disputed or the property is liable to forfeiture (e.g. proceeds of
crime under AMLATFPUAA), expect the court to defer disposal — address forfeiture
risk squarely.`,
  },

  // ====================== SPECIAL STATUTES ======================
  {
    category: "Special Statutes — SOSMA",
    title: "SOSMA: Representation Against Detention & Bail Position (Act 747)",
    court: "Sessions Court / High Court",
    description:
      "Security Offences (Special Measures) Act 2012 — the special detention regime (s.4), the no-bail rule and its exceptions (s.13), and a worked representation seeking release / electronic-tagging bail for an eligible accused.",
    templateContent: `DALAM MAHKAMAH [SESYEN / TINGGI] DI [TEMPAT]
KES JENAYAH NO: [____________]

PENDAKWA RAYA  lawan  [NAMA OKT]

──  HUJAHAN / REPRESENTASI DI BAWAH AKTA KESALAHAN KESELAMATAN
    (LANGKAH-LANGKAH KHAS) 2012 ("SOSMA")  ──

1. PEMAKAIAN: SOSMA terpakai kepada "kesalahan keselamatan" yang disenaraikan
   dalam Jadual Pertama (a.l. Bab VI & VIA Kanun Keseksaan). Sahkan dahulu
   bahawa pertuduhan benar-benar suatu kesalahan keselamatan; jika tidak,
   tatacara biasa CPC terpakai.

2. PENAHANAN (s.4 SOSMA): Polis boleh menahan sehingga 28 hari bagi tujuan
   siasatan. Pembelaan hendaklah memastikan:
   (a) notis penahanan dikeluarkan dan keluarga dimaklumkan (s.4(2));
   (b) akses kepada peguam tidak dilewatkan melebihi yang dibenarkan; dan
   (c) tiada penderaan semasa tahanan.

3. JAMINAN (s.13 SOSMA): Sebagai peraturan am, seseorang yang dipertuduh dengan
   kesalahan keselamatan TIDAK boleh dijamin. PENGECUALIAN: kanak-kanak,
   wanita, dan orang yang sakit atau lemah (s.13(2)) boleh dijamin tertakluk
   kepada pemantauan elektronik (electronic monitoring device).

4. REPRESENTASI (worked):
   OKT termasuk dalam pengecualian s.13(2) kerana [wanita / berumur [__] /
   pesakit dengan laporan perubatan dilampirkan]. OKT memohon dibebaskan dengan
   jaminan tertakluk kepada peranti pemantauan elektronik dan syarat-syarat
   yang munasabah. Sebagai alternatif, jika SOSMA tidak terpakai kepada
   pertuduhan ini, OKT memohon prinsip jaminan biasa di bawah s.388 CPC.

5. NOTA: Seksyen 30 SOSMA — seseorang yang dibebaskan tetap dalam tahanan
   sehingga tempoh rayuan tamat jika Pendakwaan memberi notis rayuan; pertimbang
   implikasi ini dalam strategi.

Bertarikh pada [tarikh].
............................................
Peguamcara bagi pihak OKT

${NOTE}
NOTA AMALAN: First contest whether SOSMA even applies — mis-classification is a
real and reviewable issue. If the accused falls within s.13(2), build the bail
case around the exception and accept tagging. Challenge any procedural
non-compliance under s.4 (notice, access, treatment) on the record.`,
  },

  {
    category: "Special Statutes — AMLATFPUAA",
    title: "AMLATFPUAA: Representation Against Seizure / Forfeiture (Act 613)",
    court: "Sessions Court / High Court",
    description:
      "Anti-Money Laundering, Anti-Terrorism Financing and Proceeds of Unlawful Activities Act 2001 — challenging a freezing/seizure order and resisting forfeiture (ss.50, 51, 56, 61).",
    templateContent: `DALAM MAHKAMAH [SESYEN / TINGGI] DI [TEMPAT]
[KES JENAYAH / PERMOHONAN] NO: [____________]

PENDAKWA RAYA  lawan  [NAMA OKT / PIHAK BERKEPENTINGAN]

──  REPRESENTASI BERHUBUNG SEKATAN/RAMPASAN & LUCUT HAK
    DI BAWAH AMLATFPUAA 2001  ──

1. KONTEKS: Suatu kesalahan pengubahan wang haram di bawah s.4 AMLATFPUAA
   melibatkan "hasil daripada aktiviti haram". Harta Pemohon telah
   dibeku/dirampas di bawah s.[44/45/50/51] AMLATFPUAA.

2. CABARAN TERHADAP SEKATAN/RAMPASAN:
   (a) Harta tersebut BUKAN hasil aktiviti haram tetapi diperolehi secara sah
       melalui [sumber sah — gaji, perniagaan, pinjaman], dengan dokumen
       sokongan dilampirkan;
   (b) Tiada kaitan (nexus) antara harta dan mana-mana kesalahan asas
       (predicate offence) yang dinyatakan;
   (c) Sekatan menyebabkan kesusahan melampau dan harta diperlukan untuk
       [nafkah keluarga / kelangsungan perniagaan].

3. LUCUT HAK (forfeiture):
   • s.55 — lucut hak selepas sabitan: bergantung kepada sabitan dan nexus;
   • s.56 — lucut hak harta yang disekat di mana tiada pendakwaan boleh
     dijalankan; dan
   • Pihak ketiga yang bona fide boleh membuat tuntutan ke atas harta — Pemohon
     ialah pemilik benefisial yang sah dan tidak terlibat dalam apa-apa
     kesalahan.

4. PERMOHONAN: Pemohon memohon perintah [pembatalan sekatan / pelepasan harta /
   pengecualian harta daripada lucut hak].

Bertarikh pada [tarikh].
............................................
Peguamcara bagi pihak Pemohon

${NOTE}
NOTA AMALAN: The battleground is the NEXUS between the property and a predicate
offence, plus legitimacy of source. Marshal documentary proof of lawful
provenance early. Protect bona fide third-party interests (spouse, financier)
with separate claims — forfeiture can reach property held by non-accused.`,
  },

  {
    category: "Special Statutes — MACC",
    title: "MACC Act: Bail & Representation in Corruption Charges (Act 694)",
    court: "Sessions Court / High Court",
    description:
      "Malaysian Anti-Corruption Commission Act 2009 — the core offences (ss.16, 17, 23), the s.50 presumption of corruption, and a worked representation/bail position.",
    templateContent: `DALAM MAHKAMAH [SESYEN / TINGGI] DI [TEMPAT]
KES JENAYAH NO: [____________]

PENDAKWA RAYA  lawan  [NAMA OKT]

──  REPRESENTASI / HUJAHAN DI BAWAH AKTA SPRM 2009  ──

1. PERTUDUHAN: OKT dipertuduh di bawah Seksyen [16 (menerima suapan) / 17
   (memberi/menerima suapan oleh ejen) / 23 (penyalahgunaan jawatan)] Akta
   Suruhanjaya Pencegahan Rasuah Malaysia 2009.

2. ANGGAPAN (s.50): Apabila dibuktikan suapan telah diberi/diterima, ia
   DIANGGAP telah diberi/diterima secara rasuah melainkan dibuktikan
   sebaliknya. Beban mengulang kepada OKT untuk menyangkal anggapan ini atas
   imbangan kebarangkalian — TANPA anggapan, beban kekal pada Pendakwaan.

3. CABARAN PEMBELAAN (worked):
   (a) Tiada penyerahan/penerimaan "suapan" seperti ditakrif (s.3);
   (b) Pembayaran adalah [bayaran sah / hutang / hadiah tanpa unsur dorongan
       atau ganjaran bagi sesuatu perbuatan rasmi];
   (c) Tiada niat rasuah; anggapan s.50 disangkal oleh keterangan [____].

4. JAMINAN: Kesalahan boleh dijamin; OKT memohon jaminan munasabah —
   pesalah pertama, jawatan/ikatan masyarakat kukuh, menyerahkan pasport,
   bersedia melapor diri. Pertimbangkan syarat tidak menghubungi saksi yang
   merupakan rakan sekerja.

Bertarikh pada [tarikh].
............................................
Peguamcara bagi pihak OKT

${NOTE}
NOTA AMALAN: The case usually turns on rebutting the s.50 presumption — prepare
the innocent-explanation evidence (legitimate transaction, debt, gift without
nexus) from day one. Watch s.62 (further detention) and ensure proper handling
of statements recorded under MACC powers (challenge voluntariness as needed).`,
  },

  {
    category: "Special Statutes — Child Victims",
    title: "SOACA 2017: Charge & Special Evidence Procedure (Act 792)",
    court: "Sessions Court / High Court",
    description:
      "Sexual Offences Against Children Act 2017 — specimen charge, the statutory presumptions (including relationship of trust), and the special child-witness protections (screen, video link, support person) under the Evidence of Child Witness Act 2007.",
    templateContent: `DALAM MAHKAMAH [SESYEN / TINGGI] DI [TEMPAT]
KES JENAYAH NO: [____________]

PENDAKWA RAYA  lawan  [NAMA OKT]

──  PERTUDUHAN & TATACARA KHAS DI BAWAH SOACA 2017  ──

A. SPECIMEN PERTUDUHAN (s.4 — serangan seksual fizikal)
"Bahawa kamu pada [tarikh], di [tempat], dalam Daerah [____], dalam Negeri
[____], telah melakukan serangan seksual fizikal terhadap seorang kanak-kanak
iaitu [inisial mangsa], berumur [__] tahun, dan dengan itu kamu telah melakukan
suatu kesalahan di bawah Seksyen 4 Akta Kesalahan-Kesalahan Seksual Terhadap
Kanak-Kanak 2017 (Akta 792)."
[Pertuduhan lain dalam Akta 792: child grooming, komunikasi seksual, serangan
seksual fizikal teruk, dan kesalahan berkaitan pornografi kanak-kanak — rujuk
seksyen yang berkaitan bagi pertuduhan anda.]

B. ANGGAPAN & HUBUNGAN AMANAH:
 • Akta memperuntukkan hukuman lebih berat bagi pesalah yang mempunyai
   "hubungan amanah" (relationship of trust) dengan kanak-kanak — rujuk s.16;
 • Akta juga mengandungi anggapan boleh disangkal tertentu (a.l. mengenai
   pengetahuan dan hubungan amanah) — sahkan seksyen tepat bagi pertuduhan anda.
   Pembelaan mesti menyangkal mana-mana anggapan yang berkuat kuasa dan menimbang
   isu kepercayaan munasabah tentang umur.

C. TATACARA KHAS SAKSI KANAK-KANAK (Akta Keterangan Saksi Kanak-Kanak 2007):
 (a) keterangan boleh diberi melalui SAMBUNGAN VIDEO (live link) — s.5/s.6;
 (b) SKRIN/TABIR boleh dipasang supaya kanak-kanak tidak melihat OKT;
 (c) seorang PENEMAN (support person) dibenarkan mengiringi kanak-kanak;
 (d) soal balas hendaklah dikawal dan tidak mengintimidasi.

D. PERMOHONAN (mengikut pihak):
   Pihak Pendakwaan memohon perintah perlindungan saksi kanak-kanak di atas;
   ATAU pihak Pembelaan memohon supaya soal balas dijalankan secara adil melalui
   peneman/skrin sambil mengekalkan hak soal balas yang berkesan.

Bertarikh pada [tarikh].
............................................
[Timbalan Pendakwa Raya / Peguamcara]

${NOTE}
NOTA AMALAN (DEFENCE): The special protections preserve the RIGHT to
cross-examine — insist on effective cross even via screen/video link. Probe the
rebuttable presumptions (knowledge, age, relationship of trust). Identity,
opportunity and the reliability of the child's account (and any suggestive
interviewing) remain the key battlegrounds. Always anonymise the child.`,
  },

  {
    category: "Special Statutes — Firearms",
    title: "Firearms (Increased Penalties) Act 1971: Charge & Defence Notes",
    court: "High Court",
    description:
      "Specimen charge for discharging a firearm in the commission of a scheduled offence (s.3) and being an accomplice (s.3A), with the gravity and mandatory-penalty warnings.",
    templateContent: `DALAM MAHKAMAH TINGGI MALAYA DI [TEMPAT]
KES JENAYAH NO: [____________]

PENDAKWA RAYA  lawan  [NAMA OKT]

──  PERTUDUHAN DI BAWAH AKTA SENJATA API
    (PENALTI LEBIH BERAT) 1971  ──

SPECIMEN PERTUDUHAN (s.3 — melepaskan tembakan):
"Bahawa kamu pada [tarikh], di [tempat], dalam Daerah [____], dalam Negeri
[____], semasa melakukan suatu kesalahan berjadual iaitu [cth: rompakan di
bawah s.392 Kanun Keseksaan], telah melepaskan tembakan dari sepucuk senjata
api dengan niat untuk menyebabkan kematian atau kecederaan kepada [nama], dan
dengan itu kamu telah melakukan suatu kesalahan di bawah Seksyen 3 Akta Senjata
Api (Penalti Lebih Berat) 1971."

PERUNTUKAN BERKAITAN (NOTA: sahkan hukuman semasa):
 • s.3 — melepaskan tembakan semasa kesalahan berjadual: dahulunya hukuman MATI
   mandatori. Berikutan Akta Pemansuhan Hukuman Mati Mandatori 2023, Mahkamah
   kini mempunyai BUDI BICARA untuk mengenakan hukuman mati ATAU penjara (dan
   sebatan) sebagai alternatif — hukuman mati tidak lagi mandatori;
 • s.3A — rakan sejenayah (accomplice) yang hadir: setara dengan s.3, juga
   tertakluk kepada budi bicara penghukuman selepas reformasi 2023;
 • s.7 — pengedaran senjata api/peluru: hukuman berat (sahkan julat semasa).

NOTA PEMBELAAN (worked grounds):
 1. PENGENALAN: pengenalan OKT sebagai penembak mesti selamat (Turnbull /
    Jaafar bin Ali) — cabar jarak, cahaya, masa pemerhatian, prosedur cam diri.
 2. MILIKAN & KAWALAN senjata: Pendakwaan mesti buktikan milikan dan kawalan
    sedar (knowing possession), bukan sekadar kehadiran di tempat kejadian.
 3. s.3A: "kehadiran" sahaja tidak memadai tanpa niat bersama yang dibuktikan —
    cabar elemen niat bersama (common intention) dengan teliti.
 4. Rantaian balistik & forensik: cabar pengendalian, ujian dan rantaian
    keterangan senjata/peluru.

Bertarikh pada [tarikh].
............................................
[Timbalan Pendakwa Raya / Peguamcara]

${NOTE}
NOTA AMALAN: Given the mandatory death penalty, defend identification,
possession and common intention to the hilt. Forensic/ballistic chain of custody
is frequently the weakest link — demand the full s.51A disclosure of armourer
records, ballistics methodology and exhibit movement.`,
  },

  {
    category: "Special Statutes — Immigration",
    title: "Immigration Act 1959/63: Charge & Representation",
    court: "Magistrates' / Sessions Court",
    description:
      "Specimen charges for unlawful entry/overstay (s.6), employer offences (s.55B) and harbouring (s.56(1)(d)), with bail and compounding/representation notes.",
    templateContent: `DALAM MAHKAMAH [MAJISTRET / SESYEN] DI [TEMPAT]
KES JENAYAH NO: [____________]

PENDAKWA RAYA  lawan  [NAMA OKT]

──  PERTUDUHAN & REPRESENTASI DI BAWAH AKTA IMIGRESEN 1959/63  ──

SPECIMEN PERTUDUHAN (s.6(1)(c) — masuk tanpa pas yang sah):
"Bahawa kamu pada [tarikh], di [tempat], dalam Negeri [____], telah masuk/berada
di Malaysia tanpa pas yang sah yang membenarkan kamu berbuat demikian, dan
dengan itu kamu telah melakukan suatu kesalahan di bawah Seksyen 6(1)(c) Akta
Imigresen 1959/63 yang boleh dihukum di bawah Seksyen 6(3)."

PERUNTUKAN LAIN:
 • s.15(1)(c) — tinggal melebihi tempoh (overstay);
 • s.55B — majikan menggaji pendatang tanpa izin (penalti berat, termasuk
   penjara wajib bagi bilangan tertentu);
 • s.56(1)(d) — melindungi (harbouring) pendatang tanpa izin.

REPRESENTASI / PEMBELAAN (worked):
 1. DOKUMEN: kemukakan pas/visa/permit yang sah jika ada — kesilapan rekod
    bukan kesalahan substantif;
 2. PENGETAHUAN (untuk s.55B / s.56): majikan/penjamin perlu pengetahuan;
    cabar elemen mens rea dan langkah usaha wajar (due diligence) yang diambil;
 3. RAYUAN: bagi pelanggaran teknikal pertama, pertimbang representasi kepada
    Pendakwaan untuk pertuduhan dikurangkan / kompaun / pengusiran (deportation)
    sebagai alternatif penjara.

Bertarikh pada [tarikh].
............................................
[Timbalan Pendakwa Raya / Peguamcara]

${NOTE}
NOTA AMALAN: For employers (s.55B) the fight is knowledge and due diligence —
gather the worker's documents and the employer's verification steps. For
individuals, deportation may be a better outcome than imprisonment; open
representations early.`,
  },

  {
    category: "Special Statutes — Customs",
    title: "Customs Act 1967: Smuggling/Duty Evasion Charge & Compounding",
    court: "Sessions Court",
    description:
      "Specimen charge for evasion of customs duty / smuggling (s.135), the s.119 presumptions, and the compounding route (s.127).",
    templateContent: `DALAM MAHKAMAH SESYEN DI [TEMPAT]
KES JENAYAH NO: [____________]

PENDAKWA RAYA  lawan  [NAMA OKT]

──  PERTUDUHAN & REPRESENTASI DI BAWAH AKTA KASTAM 1967  ──

SPECIMEN PERTUDUHAN (s.135(1)(a) — mengelak duti):
"Bahawa kamu pada [tarikh], di [tempat — cth: pintu masuk/limbungan], dalam
Negeri [____], dengan niat untuk mengelakkan pembayaran duti kastam, telah
[mengimport/mengeksport/menyembunyikan] barang-barang berduti iaitu [perihal
barang] bernilai RM[____] dengan duti RM[____], dan dengan itu kamu telah
melakukan suatu kesalahan di bawah Seksyen 135(1)(a) Akta Kastam 1967."

PERUNTUKAN BERKAITAN:
 • s.135 — pelbagai kesalahan penyeludupan/pengelakan duti (penalti berasaskan
   gandaan duti/nilai barang serta penjara);
 • s.119 — ANGGAPAN: pengetahuan tentang sifat barang boleh dianggap; beban
   mengulang kepada OKT;
 • s.127 — KOMPAUN: pegawai kanan kastam boleh mengkompaun kesalahan tertentu.

PEMBELAAN / REPRESENTASI (worked):
 1. MILIKAN & PENGETAHUAN: cabar sama ada OKT tahu sifat/kuantiti barang; bagi
    pembawa/ejen, kemukakan dokumen penghantaran yang menunjukkan ketiadaan niat;
 2. NILAI & DUTI: pertikai pengiraan nilai dan duti yang menentukan penalti;
 3. KOMPAUN: bagi kes pertama bernilai rendah, pohon kompaun di bawah s.127
   sebagai penyelesaian.

Bertarikh pada [tarikh].
............................................
[Timbalan Pendakwa Raya / Peguamcara]

${NOTE}
NOTA AMALAN: Penalties scale to duty/value — contest the customs valuation, as
it drives the fine and the imprisonment exposure. The s.119 knowledge
presumption is the centre of gravity; build the innocent-carrier / documented-
shipment narrative. Explore compounding under s.127 for low-value first matters.`,
  },

  {
    category: "Special Statutes — Road Transport",
    title: "Road Transport Act 1987: Dangerous Driving & DUI Charges",
    court: "Magistrates' Court",
    description:
      "Specimen charges for causing death by reckless/dangerous driving (s.41), dangerous driving (s.42) and driving under the influence (ss.44, 45A), with the breath/blood-alcohol and procedural defence notes.",
    templateContent: `DALAM MAHKAMAH MAJISTRET DI [TEMPAT]
KES JENAYAH NO: [____________]

PENDAKWA RAYA  lawan  [NAMA OKT]

──  PERTUDUHAN DI BAWAH AKTA PENGANGKUTAN JALAN 1987  ──

SPECIMEN 1 (s.41(1) — menyebabkan kematian melalui pemanduan melulu/berbahaya):
"Bahawa kamu pada [tarikh], lebih kurang pukul [masa], di [jalan/tempat], dalam
Daerah [____], dalam Negeri [____], telah memandu kenderaan motor No. [____]
secara melulu atau dengan kelajuan atau cara yang berbahaya kepada orang awam,
sehingga menyebabkan kematian [nama mangsa], dan dengan itu kamu telah melakukan
suatu kesalahan di bawah Seksyen 41(1) Akta Pengangkutan Jalan 1987."

SPECIMEN 2 (s.45A — memandu dengan kandungan alkohol melebihi had):
"Bahawa kamu pada [tarikh], di [tempat], telah memandu kenderaan motor No.
[____] sedangkan kandungan alkohol dalam [nafas/darah/air kencing] kamu, iaitu
[____], melebihi had yang ditetapkan, dan dengan itu kamu telah melakukan suatu
kesalahan di bawah Seksyen 45A Akta Pengangkutan Jalan 1987."

PERUNTUKAN LAIN:
 • s.42 — pemanduan melulu dan berbahaya (tanpa kematian);
 • s.43 — pemanduan cuai dan tidak bertimbang rasa;
 • s.44 — memandu di bawah pengaruh dadah/alkohol sehingga tidak terkawal.

NOTA PEMBELAAN (worked):
 1. STANDARD: "berbahaya" diukur secara objektif; "cuai" lebih rendah daripada
    "melulu/berbahaya" — pertimbang representasi untuk pertuduhan alternatif
    s.43 yang kurang berat;
 2. SEBAB-MUSABAB (causation): bagi s.41, cabar sama ada pemanduan OKT adalah
    punca kematian, atau terdapat punca lain (kerosakan jalan, pihak ketiga);
 3. PROSEDUR ALKOHOL: cabar penentukuran alat nafas (breathalyser), rantaian
    sampel darah, dan pematuhan tatacara s.45A/45B; ketakpatuhan boleh
    menjejaskan kebolehterimaan bacaan;
 4. DISKUALIFIKASI: sabitan s.41/45A membawa pengilangan/penggantungan lesen
    mandatori — nasihati klien tentang kesan ini dalam mitigasi.

Bertarikh pada [tarikh].
............................................
[Timbalan Pendakwa Raya / Peguamcara]

${NOTE}
NOTA AMALAN: For s.41 the war is fought on the standard of driving and
causation — secure the sketch plan, post-mortem, vehicle inspection and any
dashcam. For DUI, attack calibration and sample-handling procedure. Always
advise the client on mandatory licence disqualification before any plea.`,
  },

  // ========================= YOUTH =========================
  {
    category: "Special Procedure",
    title: "Child Offender Procedure — Court For Children (Child Act 2001)",
    court: "Court for Children",
    description:
      "Procedure and dispositions where the accused is a child, including the no-imprisonment rule and the welfare-oriented orders under the Child Act 2001.",
    templateContent: `DALAM MAHKAMAH BAGI KANAK-KANAK DI [TEMPAT]
KES NO: [____________]

PENDAKWA RAYA  lawan  [INISIAL KANAK-KANAK]

──  TATACARA & REPRESENTASI BAGI PESALAH KANAK-KANAK
    (AKTA KANAK-KANAK 2001)  ──

1. BIDANG KUASA: Seorang "kanak-kanak" (di bawah 18 tahun) dibicarakan di
   Mahkamah Bagi Kanak-Kanak. Tatacara mengutamakan kebajikan kanak-kanak.

2. PRINSIP UTAMA:
   (a) Istilah "sabitan" dan "hukuman" TIDAK digunakan;
   (b) Kanak-kanak TIDAK boleh dipenjarakan (s.96 Akta Kanak-Kanak 2001);
   (c) Laporan akhlak/Pegawai Akhlak diperlukan sebelum sebarang perintah;
   (d) Identiti kanak-kanak DILINDUNGI — tiada penyiaran.

3. PILIHAN PERINTAH (dispositions):
   • teguran / bon berkelakuan baik dengan jaminan ibu bapa;
   • perintah pengawasan oleh Pegawai Akhlak;
   • perintah tinggal di Sekolah Tunas Bakti / tempat pemulihan;
   • perintah khidmat masyarakat (jika berkenaan) / denda kepada ibu bapa.

4. REPRESENTASI: Pembelaan menekankan kebajikan, pendidikan dan pemulihan
   kanak-kanak, latar belakang keluarga, dan keperluan untuk mengelak
   institusionalisasi melainkan benar-benar perlu.

Bertarikh pada [tarikh].
............................................
Peguamcara bagi pihak Kanak-Kanak

${NOTE}
NOTA AMALAN: Establish age early — it is jurisdictional. Engage the Probation
Officer and frame everything around welfare and rehabilitation. Never permit
publication that could identify the child.`,
  },
];
