// Court-ready Malaysian criminal sample-document library.
// Worked model documents a practitioner can adapt — letters, submissions,
// attendance notes, opinions and checklists — with embedded authorities and
// NOTA AMALAN practice notes. Placeholders in [SQUARE BRACKETS]. Renders in a
// monospace <pre> block.

export type SampleDocumentSeed = {
  category: string;
  title: string;
  documentType: string;
  description: string;
  content: string;
};

const NOTE = "———————————————————————————————————————————————";

export const sampleDocuments: SampleDocumentSeed[] = [
  // ===================== CLIENT INTAKE =====================
  {
    category: "Client Engagement",
    title: "Warrant to Act / Letter of Authority (Surat Kuasa Wakil)",
    documentType: "Authority",
    description:
      "Client's authority appointing the firm to act in the criminal matter — required before lockup access and filing.",
    content: `[KOP SURAT FIRMA GUAMAN]

SURAT KUASA MEWAKILI (WARRANT TO ACT)

Saya, [NAMA KLIEN], No. K/P [____], beralamat di [____], dengan ini melantik
TETUAN [NAMA FIRMA] sebagai peguamcara saya untuk mewakili saya dalam perkara
jenayah berikut:

   Kes / Pertuduhan : [____]
   Mahkamah         : [____]
   No. Kes          : [____]

Saya memberi kuasa kepada peguamcara saya untuk:
 1. mengambil tindakan, memfailkan dan menerima dokumen bagi pihak saya;
 2. hadir dan berhujah di semua prosiding berkaitan;
 3. menerima dan memberi arahan, termasuk berhubung jaminan, plea dan rayuan;
 4. melawat saya di lokap/penjara dan berunding secara sulit.

Saya memahami terma pengambilan dan fi sebagaimana dinyatakan dalam surat
penglibatan yang berasingan.

Bertarikh pada [tarikh].

............................................        ............................
[NAMA KLIEN] (Klien)                                Saksi: [Nama peguamcara]

${NOTE}
NOTA AMALAN: Get this signed before your first lockup/prison visit — the prison
authorities and the court will ask for it. Pair it with a separate engagement
letter setting out scope and fees (see "Engagement & Fee Letter").`,
  },

  {
    category: "Client Engagement",
    title: "First Attendance / Instructions Note (Nota Temujanji Pertama)",
    documentType: "Attendance Note",
    description:
      "Structured intake note to capture full instructions at the first client meeting — drives bail, plea, alibi and mitigation.",
    content: `NOTA TEMUJANJI & ARAHAN KLIEN (SULIT — LEGALLY PRIVILEGED)

Klien: [____]   No. K/P: [____]   Tarikh/Masa: [____]   Tempat: [lokap/pejabat]

A. PERTUDUHAN & TANGKAPAN
 • Pertuduhan / seksyen disyaki : [____]
 • Tarikh & masa tangkapan      : [____]
 • Tempat tangkapan             : [____]
 • Adakah diberitahu sebab tangkap & hak peguam? (Perkara 5(3)) : Ya / Tidak
 • Sebarang aduan penderaan/keadaan tahanan : [____]

B. VERSI KLIEN (account of events — verbatim sedaya mungkin)
 [____]

C. ALIBI / PEMBELAAN AWAL
 • Di mana klien semasa kejadian? : [____]
 • Saksi alibi (nama, hubungan, hubungi) : [____]
 • Dokumen sokongan (CCTV, resit, telefon) : [____]

D. UNTUK JAMINAN
 • Pekerjaan & pendapatan : [____]
 • Alamat tetap & tempoh menetap : [____]
 • Tanggungan : [____]
 • Penjamin dicadangkan (nama, hubungan, kemampuan) : [____]
 • Pasport diserahkan? : [____]

E. UNTUK MITIGASI (jika plea bersalah dipertimbang)
 • Rekod lampau : Ya / Tidak — butir : [____]
 • Penyesalan / pampasan kepada mangsa : [____]
 • Surat watak / kesihatan / keadaan keluarga : [____]

F. ARAHAN & LANGKAH SETERUSNYA
 • Plea: claim trial / pertimbang plea — keputusan klien : [____]
 • Dokumen yang perlu klien kumpul : [____]
 • Tindakan firma seterusnya (s.51A, notis alibi, jaminan) : [____]

Direkod oleh : [Nama peguam]      Tandatangan klien : ............

${NOTE}
NOTA AMALAN: Take instructions in the client's own words and date every note —
it protects you and feeds straight into the alibi notice, bail affidavit and
mitigation. Flag any allegation of mistreatment immediately (remand/voir dire).`,
  },

  {
    category: "Client Engagement",
    title: "Engagement & Fee Letter (Criminal Matter)",
    documentType: "Engagement Letter",
    description:
      "Scope-of-work and fee letter for a criminal defence retainer, with stage-based fees and disbursements.",
    content: `[KOP SURAT FIRMA GUAMAN]                                   [Tarikh]

[Nama Klien]
[Alamat]

Tuan/Puan,

PER: PENGAMBILAN PERKHIDMATAN GUAMAN — PERKARA JENAYAH [____]

Terima kasih atas kepercayaan tuan/puan. Surat ini menetapkan skop kerja dan fi
kami.

1. SKOP KERJA
   [ ] Nasihat awal & lawatan lokap          [ ] Permohonan jaminan
   [ ] Perwakilan sebutan & pengurusan kes   [ ] Perbicaraan penuh
   [ ] Mitigasi (jika plea)                  [ ] Rayuan (dokumen berasingan)

2. FI PROFESIONAL (anggaran — tertakluk kompleksiti)
   • Nasihat & jaminan                : RM[____]
   • Pengendalian perbicaraan         : RM[____] (atau RM[____]/hari bicara)
   • Mitigasi / plea                  : RM[____]
   Fi tidak termasuk perbelanjaan (disbursements): fi failing mahkamah,
   penghantaran, laporan pakar, salinan nota keterangan, perjalanan, dll.

3. BAYARAN: Deposit RM[____] perlu dijelaskan sebelum kerja bermula. Baki
   mengikut peringkat seperti di atas.

4. SKOP TIDAK TERMASUK: jaminan tiada dijamin; keputusan mahkamah adalah di luar
   kawalan kami; rayuan memerlukan pengambilan berasingan.

Sila tandatangan salinan ini sebagai tanda persetujuan.

Yang benar,                                   Disetujui oleh,
............................                   ............................
[Peguamcara]                                  [Klien]   Tarikh: [____]

${NOTE}
NOTA AMALAN: Be explicit that outcomes are not guaranteed and that disbursements
are separate. Stage-based fees protect both sides and make scope changes easy to
re-paper.`,
  },

  // ===================== PROSECUTION-FACING =====================
  {
    category: "Representations",
    title: "Letter of Representation to the Public Prosecutor (Surat Representasi)",
    documentType: "Representation Letter",
    description:
      "Formal representation to the DPP/AG seeking withdrawal, reduction or compounding of a charge — a worked, persuasive model.",
    content: `[KOP SURAT FIRMA GUAMAN]                                   [Tarikh]

Timbalan Pendakwa Raya / Pendakwa Raya
[Pejabat Penasihat Undang-Undang Negeri / Jabatan Peguam Negara]
[Alamat]

Tuan,

PER: REPRESENTASI BAGI PIHAK [NAMA OKT]
     KES JENAYAH NO. [____] — PERTUDUHAN DI BAWAH SEKSYEN [____]

Kami mewakili OKT yang dinamakan di atas dan dengan hormatnya mengemukakan
representasi ini supaya pihak Pendakwaan mempertimbangkan:
   [ ] penarikan balik pertuduhan;
   [ ] penggantian dengan pertuduhan yang lebih ringan (cth: s.[____]);
   [ ] kompaun / pelupusan tanpa perbicaraan.

ASAS REPRESENTASI:
1. KELEMAHAN KES: Keterangan pendakwaan adalah lemah atas inti pati [____]
   kerana [____]. Tiada keterangan langsung yang menghubungkan OKT dengan [____].
2. KEADAAN PERIBADI: OKT seorang pesalah pertama, [pekerjaan/tanggungan],
   menyumbang kepada masyarakat dan tiada rekod lampau.
3. KEPENTINGAN AWAM: Pendakwaan penuh tidak menyumbang kepada kepentingan awam
   memandangkan [pampasan telah dibayar / kecederaan minimum / penyelesaian
   dengan mangsa]; sumber Mahkamah dapat dijimatkan.
4. PRESEDEN: Dalam keadaan serupa, pertuduhan telah [dikurangkan/dikompaun].

Kami melampirkan [dokumen sokongan]. Kami amat berbesar hati untuk berbincang
dan hadir bagi sebarang sesi representasi lisan.

Sekian, terima kasih.
Yang benar,
............................................
[Peguamcara] bagi pihak [Tetuan]

${NOTE}
NOTA AMALAN: Representations are persuasion, not entitlement — lead with the
evidential weakness, then public interest and personal circumstances. Keep it
respectful and concrete; attach proof (restitution receipts, medical reports).
Send early, before the prosecution commits resources to trial.`,
  },

  // ===================== SUBMISSIONS =====================
  {
    category: "Submissions",
    title: "Written Submission — Close of Defence (Hujahan Bertulis)",
    documentType: "Written Submission",
    description:
      "Full closing written submission for the defence applying the beyond-reasonable-doubt standard (Mat v PP; Mohamad Radhi) ingredient by ingredient.",
    content: `DALAM MAHKAMAH [SESYEN / TINGGI] DI [TEMPAT]
KES JENAYAH NO: [____________]

PENDAKWA RAYA  lawan  [NAMA OKT]

────────  HUJAHAN BERTULIS PIHAK PEMBELAAN  ────────
(Di penutup kes pembelaan)

A. BEBAN & STANDARD PEMBUKTIAN
1. Beban kekal pada Pendakwaan sepanjang masa untuk membuktikan kes melampaui
   keraguan munasabah; OKT hanya perlu menimbulkan keraguan munasabah:
   MAT v PP [1963] MLJ 263; MOHAMAD RADHI bin YAACOB v PP [1991] 3 MLJ 169.
2. Jika keterangan OKT menimbulkan keraguan munasabah ATAU pembelaannya
   berkemungkinan benar, OKT berhak dibebaskan.

B. INTI PATI YANG TIDAK DIBUKTIKAN (ingredient analysis)
   Pertuduhan di bawah s.[____] memerlukan:
   (i)   [inti pati 1] — Pendakwaan gagal kerana [____];
   (ii)  [inti pati 2 — mens rea] — tiada keterangan niat/pengetahuan: [____];
   (iii) [inti pati 3 — milikan/pengenalan] — tidak selamat kerana [____].

C. KETERANGAN PEMBELAAN
3. Keterangan OKT dan SD[__] adalah konsisten dan munasabah, dan tidak digoncang
   dalam soal balas. Pembelaan [alibi / bela diri / ketiadaan niat] disokong
   oleh [____].
4. Mahkamah hendaklah menilai keterangan pembelaan secara positif dan bukan
   hanya bertanya sama ada ia "dipercayai".

D. KECACATAN KES PENDAKWAAN
5. Percanggahan material: [____]. Rantaian keterangan terputus: [____].
   Pengenalan tidak selamat (Turnbull / Jaafar bin Ali): [____].
   Inferens bertentangan kerana saksi material [____] tidak dipanggil (s.114(g)
   Akta Keterangan).

E. KESIMPULAN & PERMOHONAN
6. Pendakwaan gagal membuktikan kes melampaui keraguan munasabah. OKT memohon
   dilepas dan dibebaskan atas semua pertuduhan.

Bertarikh pada [tarikh].
............................................
Peguamcara bagi pihak OKT

${NOTE}
NOTA AMALAN: Mirror the prosecution's charge ingredient by ingredient. Deploy
s.114(g) where a material witness is not called. Keep the standard of proof
front and centre — most acquittals are won on reasonable doubt, not on proving
innocence.`,
  },

  {
    category: "Submissions",
    title: "Submission on Sentence (Hujahan Hukuman) — Prosecution & Defence Notes",
    documentType: "Sentencing Submission",
    description:
      "Sentencing submission framework citing the public-interest / proportionality authorities, with both prosecution aggravation and defence mitigation angles.",
    content: `DALAM MAHKAMAH [____] DI [TEMPAT]
KES JENAYAH NO: [____________]

PENDAKWA RAYA  lawan  [NAMA OKT]

────────  HUJAHAN MENGENAI HUKUMAN  ────────

A. PRINSIP
1. Hukuman mesti setimpal dan mengimbangi kepentingan awam dengan keadaan
   pesalah: PP v LOO CHOON FATT [1976] 2 MLJ 256; MOHAMED ABDULLAH ANG SWEE
   KANG v PP [1988] 1 MLJ 167. Empat objektif: pencegahan (deterrence),
   pembalasan (retribution), pemulihan (rehabilitation), perlindungan.

B. FAKTOR MEMBERATKAN (prosecution — aggravating)
   • keterukan & cara kesalahan dilakukan; kesan kepada mangsa/masyarakat;
   • penggunaan senjata / kekerasan / perancangan;
   • rekod lampau / kesalahan berulang;
   • penyalahgunaan kepercayaan / kedudukan.

C. FAKTOR MERINGANKAN (defence — mitigating)
   • pengakuan bersalah awal — diskaun 1/3 (SAU SOO KIM v PP [1975] 2 MLJ 134);
   • pesalah pertama, umur, kesihatan, tanggungan;
   • penyesalan, pampasan/restitusi, kerjasama dengan penyiasat;
   • peranan kecil / provokasi / keterdesakan.

D. PRINSIP KESELURUHAN (totality) jika berbilang pertuduhan:
   jumlah hukuman tidak boleh melampau (RAJA IZZUDDIN SHAH v PP [1979] 1 MLJ 270);
   pertimbang hukuman serentak (concurrent) untuk kesalahan yang berkait.

E. PERMOHONAN
   Pendakwaan memohon hukuman [____] sebagai pencegahan;
   ATAU Pembelaan memohon hukuman minimum / bon akhlak (s.294 CPC) / kompaun
   memandangkan mitigasi di atas.

Bertarikh pada [tarikh].
............................................
[Timbalan Pendakwa Raya / Peguamcara]

${NOTE}
NOTA AMALAN: Match the sentence to comparable decided cases — tender a short
table of precedents with offence, facts and outcome. For mandatory-minimum or
mandatory-whipping offences, address the statutory floor and any exemptions
(s.289 CPC) directly.`,
  },

  {
    category: "Submissions",
    title: "Appeal Written Submission (Hujahan Bertulis Rayuan)",
    documentType: "Appeal Submission",
    description:
      "Appellant's written submission structured around appellate intervention principles for conviction and sentence.",
    content: `DALAM MAHKAMAH [TINGGI / RAYUAN / PERSEKUTUAN] [TEMPAT]
RAYUAN JENAYAH NO: [____________]

[NAMA] ............ PERAYU   dan   PENDAKWA RAYA ............ RESPONDEN

────────  HUJAHAN BERTULIS PERAYU  ────────

A. LATAR BELAKANG RINGKAS
   Perayu disabitkan pada [tarikh] di bawah s.[____] dan dihukum [____].

B. STANDARD CAMPUR TANGAN APPELLATE
1. Mahkamah rayuan boleh campur tangan jika dapatan Hakim Bicara terhadap
   keterangan adalah jelas salah / tidak disokong keterangan, atau terdapat
   salah arah/tiada arah yang material, atau prinsip undang-undang tersalah
   pakai.

C. ALASAN TERHADAP SABITAN (worked)
2. Penilaian maksimum tidak dijalankan / prima facie tersilap didapati
   (Looi Kow Chai; Balachandran): [____].
3. Salah arah mengenai beban bukti / keraguan munasabah / pengenalan: [____].
4. Keterangan tidak boleh diterima telah diterima (pengakuan tidak sukarela /
   hearsay / s.27 disalah guna): [____].
5. Keterangan pembelaan tidak dinilai dengan adil: [____].

D. ALASAN TERHADAP HUKUMAN (alternatif)
6. Hukuman nyata keterlaluan / salah prinsip (Bhandulananda Jayatilake v PP
   [1982] 1 MLJ 83); mitigasi material diabaikan.

E. PERMOHONAN
7. Rayuan dibenarkan; sabitan diketepikan dan Perayu dibebaskan; atau secara
   alternatif hukuman dikurangkan.

Bertarikh pada [tarikh].
............................................
Peguamcara bagi pihak Perayu

${NOTE}
NOTA AMALAN: Lead with your single strongest ground; appellate courts reward
focus, not a scattergun. Anchor every ground to the grounds of judgment and the
appeal record by page reference. File the bundle of authorities in good time.`,
  },

  // ===================== TRIAL PREP TOOLS =====================
  {
    category: "Trial Preparation",
    title: "Cross-Examination Plan & Question Bank (Pelan Soal Balas)",
    documentType: "Trial Prep",
    description:
      "Structured cross-examination plan tied to the defence theory, with control techniques and a worked question sequence using prior statements (s.145 EA).",
    content: `PELAN SOAL BALAS (SULIT — WORK PRODUCT)

Saksi: [SP__, nama]    Peranan dalam kes pendakwaan: [____]
Teori pembelaan yang disokong: [____]

A. APA YANG SAKSI MESTI BUKTIKAN (untuk pendakwaan)
   [senaraikan setiap point material]

B. SASARAN SOAL BALAS (objectives — pilih, jangan semua)
   [ ] dapatkan pengakuan menyokong teori pembelaan
   [ ] dedahkan percanggahan dengan pernyataan terdahulu (s.145 EA)
   [ ] tunjuk kekurangan peluang memerhati / pengenalan tidak selamat
   [ ] tunjuk bias / motif / kepentingan
   [ ] hadkan skop keterangan yang memudaratkan

C. TEKNIK KAWALAN
   • satu fakta satu soalan; gunakan soalan tertutup (ya/tidak);
   • jangan tanya soalan yang jawapannya tidak diketahui;
   • jangan "tanya satu soalan terlebih"; berhenti apabila point tercapai;
   • confront dengan dokumen: "Saya tunjukkan kepada kamu [____]...".

D. URUTAN SOALAN (worked sample — percanggahan)
   1. "Kamu beri pernyataan kepada polis pada [tarikh], betul?" (Ya)
   2. "Kamu cuba beri keterangan benar ketika itu?" (Ya)
   3. "Dalam pernyataan itu kamu kata '[petikan]', betul?" (Ya)
   4. "Tetapi hari ini kamu kata '[versi berbeza]'." (confront)
   5. [biarkan percanggahan kekal; jangan beri ruang menjelaskan]

E. DOKUMEN UNTUK CONFRONT
   [senarai: pernyataan s.112, CCTV, foto, rekod telefon]

${NOTE}
NOTA AMALAN: Cross-examination is controlled, not exploratory. Put your case to
the witness on every material point (rule in Browne v Dunn / Wong Swee Chin) —
failure to do so invites adverse comment. Always secure the prior statement
before you plan the contradiction.`,
  },

  {
    category: "Trial Preparation",
    title: "Bail Hearing Oral Submission Notes (Nota Hujahan Jaminan)",
    documentType: "Hearing Notes",
    description:
      "Speaking notes for an oral bail submission — concise, factor-driven, ready to deliver from the bar.",
    content: `NOTA HUJAHAN LISAN — PERMOHONAN JAMINAN

Yang Arif, saya memohon jaminan bagi OKT atas terma munasabah.

1. SIFAT KESALAHAN: pertuduhan di bawah s.[____] adalah [boleh dijamin / atas
   budi bicara Mahkamah]; tujuan jaminan ialah kehadiran, bukan hukuman awal
   (Wee Swee Siang v PP).

2. TIADA RISIKO LARI: OKT warganegara, alamat tetap [__] tahun, pekerjaan
   [____], menanggung [__] orang; bersedia menyerah pasport.

3. TIADA GANGGUAN SAKSI: saksi pendakwaan [pegawai awam / tidak dikenali OKT];
   keterangan dokumentari telah dirampas.

4. PESALAH PERTAMA & KERJASAMA: tiada rekod; kerjasama penuh dengan penyiasat.

5. SYARAT DICADANGKAN: jaminan RM[____] dengan [__] penjamin, lapor diri di
   Balai [____] setiap [____], pasport diserah, kekal di alamat tetap.

Saya mohon jaminan dibenarkan atas terma di atas. Sekian, Yang Arif.

${NOTE}
NOTA AMALAN: Pre-empt the prosecution's objection — name the absconding/
interference risk and neutralise it with concrete conditions. Bring the surety
and their documents to court so bail can be perfected the same day.`,
  },

  {
    category: "Trial Preparation",
    title: "Defence Witness List & Will-Say Summaries",
    documentType: "Trial Prep",
    description:
      "Defence witness schedule with will-say summaries and logistics, ready to serve and to brief witnesses from.",
    content: `DALAM MAHKAMAH [____] DI [TEMPAT]
KES JENAYAH NO: [____________]

PENDAKWA RAYA  lawan  [NAMA OKT]

──  SENARAI SAKSI PEMBELAAN & RINGKASAN KETERANGAN  ──

SD1  Nama: [____]   No. K/P: [____]   Hubungan: [____]
     Akan beri keterangan tentang: [will-say — point utama]
     Dokumen dibawa: [____]   Status saman: [perlu / tidak]

SD2  Nama: [____]   No. K/P: [____]   Hubungan: [____]
     Akan beri keterangan tentang: [____]
     Dokumen dibawa: [____]

[Tambah mengikut keperluan]

LOGISTIK:
 • Saman saksi (s.173 CPC) difailkan untuk: [____]
 • Pengaturan kehadiran / pengangkutan: [____]
 • Saksi pakar (notis berasingan difailkan): [____]

Bertarikh pada [tarikh].
............................................
Peguamcara bagi pihak OKT

${NOTE}
NOTA AMALAN: Keep will-say summaries to the points that advance the defence
theory — over-long witnesses get torn apart in cross. Brief each witness on
courtroom procedure and the no-coaching rule before the trial date.`,
  },

  // ===================== ADVICE =====================
  {
    category: "Advice",
    title: "Legal Advice on Plea (Nasihat Plea) — Client Letter",
    documentType: "Advice",
    description:
      "Written advice to the client weighing claim-trial vs guilty-plea, the one-third discount, and realistic outcomes — documented for the file.",
    content: `[KOP SURAT FIRMA GUAMAN]                                   [Tarikh]

SULIT & PRIVILEGED
[Nama Klien]

PER: NASIHAT BERHUBUNG PILIHAN PLEA — KES NO. [____]

Tuan/Puan,

Berikut nasihat kami untuk membantu tuan/puan membuat keputusan plea. Keputusan
akhir adalah hak tuan/puan sepenuhnya.

1. PERTUDUHAN & HUKUMAN BERKEMUNGKINAN
   Seksyen [____]; hukuman maksimum [____]; julat lazim bagi fakta seperti ini
   [____] berdasarkan kes terdahulu.

2. KEKUATAN KES PENDAKWAAN
   Kekuatan: [____]. Kelemahan yang boleh dieksploitasi: [____].
   Prospek pembebasan jika claim trial: [tinggi / sederhana / rendah] kerana
   [____].

3. PILIHAN A — CLAIM TRIAL
   Kelebihan: peluang pembebasan; menguji keterangan pendakwaan.
   Risiko: jika disabitkan selepas bicara, tiada diskaun plea; hukuman mungkin
   lebih berat.

4. PILIHAN B — MENGAKU SALAH
   Kelebihan: diskaun lazim 1/3 (Sau Soo Kim v PP); penyelesaian cepat; mitigasi
   penuh boleh dikemukakan. Pertimbang juga tawar-menawar plea (s.172C CPC) untuk
   pertuduhan/hukuman yang dikurangkan.
   Risiko: sabitan dicatat; tertakluk kepada hukuman minimum (jika ada).

5. CADANGAN KAMI
   Berdasarkan keterangan setakat ini, kami mencadangkan [____] kerana [____].

Sila hubungi kami untuk berbincang. Sahkan arahan tuan/puan secara bertulis.

Yang benar,
............................................
[Peguamcara]

${NOTE}
NOTA AMALAN: Always document plea advice and get the client's decision in
writing — it protects against later "you made me plead" complaints. Never
guarantee an outcome; give ranges grounded in comparable cases.`,
  },

  // ===================== CHECKLISTS =====================
  {
    category: "Checklists",
    title: "Trial-Readiness Checklist (Senarai Semak Kesediaan Bicara)",
    documentType: "Checklist",
    description:
      "Pre-trial checklist ensuring disclosure, notices, witnesses, bundles and authorities are all in order before the hearing.",
    content: `SENARAI SEMAK KESEDIAAN PERBICARAAN

KES: [____]   MAHKAMAH: [____]   TARIKH BICARA: [____]

A. PENDEDAHAN & NOTIS
 [ ] s.51A — dokumen pendakwaan diterima & disemak
 [ ] Pernyataan saksi (s.112) diperoleh & dianalisis
 [ ] Notis alibi (s.402A) difailkan — JIKA berkenaan (10 hari sebelum bicara)
 [ ] Notis keterangan pakar + laporan diserah
 [ ] Bantahan kebolehterimaan (voir dire) dirancang — JIKA berkenaan

B. KETERANGAN & SAKSI
 [ ] Teori pembelaan dimuktamadkan
 [ ] Pelan soal balas setiap saksi pendakwaan disiapkan
 [ ] Saksi pembelaan disahkan + saman (s.173) difailkan
 [ ] Will-say setiap saksi disediakan; saksi dibrief
 [ ] Ekshibit/dokumen pembelaan disusun & disalin

C. DOKUMEN MAHKAMAH
 [ ] Ikatan dokumen (bundle) disedia & diserah
 [ ] Ikatan otoriti (kes & statut) disedia
 [ ] Hujahan No Case to Answer dirangka (skeleton)
 [ ] Hujahan bertulis penutup dirangka

D. KLIEN
 [ ] Klien dibrief: etika mahkamah, format keterangan, pilihan plea
 [ ] Keputusan plea disahkan secara bertulis
 [ ] Pengaturan kehadiran / jaminan disahkan

E. LOGISTIK
 [ ] Pakaian mahkamah / robe   [ ] Fail kes lengkap   [ ] Salinan untuk pihak lain

${NOTE}
NOTA AMALAN: Run this list a week before trial and again the night before. The
two items most often missed — the s.402A alibi deadline and the bundle of
authorities — are also the two most damaging to miss.`,
  },

  {
    category: "Checklists",
    title: "First Appearance / Remand Checklist (Senarai Semak Sebutan & Reman)",
    documentType: "Checklist",
    description:
      "Day-one checklist for the lockup visit, remand hearing and first mention — what to verify, object to and file immediately.",
    content: `SENARAI SEMAK HARI PERTAMA — REMAN & SEBUTAN PERTAMA

KLIEN: [____]   TARIKH: [____]   MAHKAMAH/BALAI: [____]

A. SEBELUM KE MAHKAMAH
 [ ] Warrant to act ditandatangani
 [ ] Lawatan lokap — ambil arahan & versi klien
 [ ] Periksa Perkara 5(3): klien diberitahu sebab tangkap & hak peguam?
 [ ] Rekod sebarang aduan penderaan / keadaan tahanan

B. REMAN (s.117 CPC)
 [ ] Sahkan masa tangkapan & tempoh reman dipohon
 [ ] Bantah tempoh reman berlebihan; pohon tempoh minimum / pelepasan
 [ ] Hujah: kerjasama klien, kaedah siasatan alternatif, keperluan akses & rawatan
 [ ] Pastikan akses peguam & rawatan perubatan diberi

C. PERTUDUHAN & PLEA
 [ ] Semak pertuduhan untuk kecacatan (seksyen, butiran, duplisiti)
 [ ] Sahkan status: boleh/tidak boleh dijamin, boleh/tidak boleh tangkap
 [ ] Nasihat plea awal — claim trial melainkan diarah sebaliknya

D. JAMINAN
 [ ] Hujah jaminan; bawa penjamin & dokumen
 [ ] Catat terma jaminan yang diperintah

E. SELEPAS SEBUTAN
 [ ] Failkan permohonan s.51A
 [ ] Pertimbang notis alibi / pakar
 [ ] Dapatkan tarikh sebutan/bicara seterusnya
 [ ] Brief klien tentang langkah & dokumen yang perlu dikumpul

${NOTE}
NOTA AMALAN: The remand hearing is your first and best chance to limit custody
and document any mistreatment — do both on the record. File the s.51A request
the same day so disclosure starts running early.`,
  },
];
