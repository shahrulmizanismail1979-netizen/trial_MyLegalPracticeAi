import { Router, type IRouter } from "express";
import { ai } from "@workspace/integrations-gemini-ai";
import { PRACTICAL_GUIDANCE } from "../../lib/prompt-guidance.js";

const router: IRouter = Router();

const KITAB_DATABASE = [
  {
    id: 1,
    titleArabic: "مغني المحتاج إلى معرفة معاني ألفاظ المنهاج",
    titleTranslit: "Mughni al-Muhtaj ila Ma'rifat Ma'ani Alfaz al-Minhaj",
    titleBm: "Mughni al-Muhtaj",
    author: "Shams al-Din Muhammad al-Khatib al-Shirbini (d. 977H/1570M)",
    school: "Shafi'i",
    description: "A comprehensive commentary on Imam al-Nawawi's Minhaj al-Talibin. This is one of the most authoritative references in Shafi'i fiqh and is extensively cited in Malaysian Shariah courts. Covers all areas of Islamic jurisprudence from worship to transactions and personal status law.",
    relevanceToMalaysia: "Primary reference for Malaysian Shariah courts on matters of Islamic family law, particularly marriage, divorce, nafkah, and hadhanah. Cited by judges and lawyers in court submissions.",
    keyTopics: ["Marriage (Nikah)", "Divorce (Talaq)", "Maintenance (Nafkah)", "Custody (Hadhanah)", "Inheritance (Faraid)", "Sales & Transactions (Mu'amalat)", "Endowment (Wakaf)"],
    volumes: 6,
    category: "Primary Fiqh Reference"
  },
  {
    id: 2,
    titleArabic: "فتح المعين بشرح قرة العين",
    titleTranslit: "Fath al-Mu'in bi Sharh Qurrat al-'Ayn",
    titleBm: "Fath al-Mu'in",
    author: "Zayn al-Din al-Malibari (d. 987H/1579M)",
    school: "Shafi'i",
    description: "A practical manual of Shafi'i fiqh widely used in Southeast Asian Islamic education. Known for its clarity and accessibility. Covers the essentials of Islamic jurisprudence with attention to practical application.",
    relevanceToMalaysia: "Standard textbook in Malaysian pondok and Islamic studies. Frequently referenced in Shariah court proceedings, especially at lower court levels. Considered a foundational text for Malaysian Shariah legal practitioners.",
    keyTopics: ["Purification (Taharah)", "Prayer (Solat)", "Fasting (Puasa)", "Zakat", "Marriage", "Divorce", "Commercial Transactions"],
    volumes: 1,
    category: "Essential Study Text"
  },
  {
    id: 3,
    titleArabic: "إعانة الطالبين على حل ألفاظ فتح المعين",
    titleTranslit: "I'anat al-Talibin 'ala Hall Alfaz Fath al-Mu'in",
    titleBm: "I'anat al-Talibin",
    author: "Abu Bakr al-Dimyati (d. 1310H/1893M)",
    school: "Shafi'i",
    description: "A detailed commentary (hashiyah) on Fath al-Mu'in. Provides extensive elaboration and additional evidence from the Quran, Hadith, and other fiqh authorities. Resolves ambiguities in the original text.",
    relevanceToMalaysia: "Extensively used by Malaysian Shariah judges as a supplementary reference. Often cited alongside Fath al-Mu'in to provide deeper analysis on contentious legal points.",
    keyTopics: ["Detailed rulings on family law", "Evidence and testimony", "Judicial procedure", "Criminal offences", "Contract law"],
    volumes: 4,
    category: "Commentary (Hashiyah)"
  },
  {
    id: 4,
    titleArabic: "الفقه الإسلامي وأدلته",
    titleTranslit: "Al-Fiqh al-Islami wa Adillatuh",
    titleBm: "Al-Fiqh al-Islami wa Adillatuh",
    author: "Prof. Dr. Wahbah al-Zuhayli (d. 1436H/2015M)",
    school: "Comparative (All Four Schools)",
    description: "A modern encyclopedic work covering Islamic jurisprudence across all four Sunni schools (Hanafi, Maliki, Shafi'i, Hanbali). Provides comparative analysis with evidence from primary sources. Written in modern Arabic with systematic organization.",
    relevanceToMalaysia: "Widely referenced in Malaysian academic circles and increasingly cited in court judgments. Valued for its comparative approach which helps when considering positions beyond the Shafi'i school. Used in fatwa deliberations.",
    keyTopics: ["Comparative fiqh", "Modern issues (nawazil)", "Islamic banking", "Medical jurisprudence", "Family law across schools", "Constitutional Islamic law"],
    volumes: 11,
    category: "Modern Encyclopedic Reference"
  },
  {
    id: 5,
    titleArabic: "بغية المسترشدين في تلخيص فتاوى بعض الأئمة من العلماء المتأخرين",
    titleTranslit: "Bughyat al-Mustarshidin",
    titleBm: "Bughyat al-Mustarshidin",
    author: "'Abd al-Rahman Ba'alawi (d. 1320H/1902M)",
    school: "Shafi'i",
    description: "A comprehensive collection of fatwas from later Shafi'i scholars. Organized by topic, it addresses practical legal questions encountered in daily life and judicial proceedings. Particularly valued in Southeast Asian Shafi'i tradition.",
    relevanceToMalaysia: "Frequently cited by Malaysian muftis and Shariah court judges. A key reference for resolving practical legal issues that arise in contemporary Malaysian Muslim society. Used extensively in fatwa committee deliberations.",
    keyTopics: ["Marriage and divorce fatwas", "Property disputes", "Wakaf rulings", "Commercial transactions", "Religious obligations"],
    volumes: 1,
    category: "Fatwa Collection"
  },
  {
    id: 6,
    titleArabic: "نهاية المحتاج إلى شرح المنهاج",
    titleTranslit: "Nihayat al-Muhtaj ila Sharh al-Minhaj",
    titleBm: "Nihayat al-Muhtaj",
    author: "Shams al-Din al-Ramli (d. 1004H/1596M)",
    school: "Shafi'i",
    description: "Another major commentary on al-Nawawi's Minhaj al-Talibin. Al-Ramli is known as 'al-Shafi'i al-Saghir' (the lesser Shafi'i). This work is considered authoritative alongside Mughni al-Muhtaj.",
    relevanceToMalaysia: "Cited alongside Mughni al-Muhtaj as a primary Shafi'i reference. Malaysian courts often cross-reference both works. Particularly valued for its detailed treatment of family law and inheritance.",
    keyTopics: ["Inheritance law", "Marriage conditions", "Judicial administration", "Testimony and evidence", "Endowments"],
    volumes: 8,
    category: "Primary Fiqh Reference"
  },
  {
    id: 7,
    titleArabic: "الأم",
    titleTranslit: "Al-Umm",
    titleBm: "Al-Umm",
    author: "Imam Muhammad ibn Idris al-Shafi'i (d. 204H/820M)",
    school: "Shafi'i",
    description: "The foundational work of the Shafi'i school by its founder, Imam al-Shafi'i. Contains his mature legal positions (al-qawl al-jadid) formulated in Egypt. This is the original source text of the entire Shafi'i legal tradition.",
    relevanceToMalaysia: "As the foundational text of the Shafi'i school, it is the ultimate reference point for all Shafi'i rulings applied in Malaysia. While later commentaries are more commonly cited in practice, Al-Umm is referenced when tracing the original basis of a ruling.",
    keyTopics: ["Foundations of Shafi'i methodology", "Usul al-Fiqh", "Ijtihad principles", "Original rulings on all fiqh topics"],
    volumes: 8,
    category: "Foundational Text"
  },
  {
    id: 8,
    titleArabic: "كفاية الأخيار في حل غاية الاختصار",
    titleTranslit: "Kifayat al-Akhyar fi Hall Ghayat al-Ikhtisar",
    titleBm: "Kifayat al-Akhyar",
    author: "Taqi al-Din al-Hisni (d. 829H/1426M)",
    school: "Shafi'i",
    description: "A commentary on Abu Shuja's Ghayat al-Taqrib (Matn Abi Shuja'). A mid-level text that bridges basic and advanced Shafi'i fiqh. Known for combining evidence with practical rulings.",
    relevanceToMalaysia: "Used in Malaysian Islamic education as an intermediate text. Referenced in Shariah court proceedings, particularly for worship-related cases and basic personal status matters.",
    keyTopics: ["Worship rulings", "Marriage essentials", "Basic commercial law", "Criminal law", "Judicial procedure"],
    volumes: 2,
    category: "Intermediate Study Text"
  },
  {
    id: 9,
    titleArabic: "تحفة المحتاج بشرح المنهاج",
    titleTranslit: "Tuhfat al-Muhtaj bi Sharh al-Minhaj",
    titleBm: "Tuhfat al-Muhtaj",
    author: "Ibn Hajar al-Haytami (d. 974H/1567M)",
    school: "Shafi'i",
    description: "One of the three great commentaries on al-Nawawi's Minhaj. Ibn Hajar al-Haytami is considered one of the most authoritative later Shafi'i scholars. His work is noted for its precision and thoroughness.",
    relevanceToMalaysia: "Highly regarded in Malaysian Shariah legal practice. Often cited alongside Mughni al-Muhtaj and Nihayat al-Muhtaj as the 'three pillars' of Shafi'i commentary literature. Referenced in complex legal disputes.",
    keyTopics: ["Advanced family law", "Complex inheritance scenarios", "Detailed commercial law", "Inter-school comparison"],
    volumes: 10,
    category: "Primary Fiqh Reference"
  },
  {
    id: 10,
    titleArabic: "حاشية البيجوري على شرح ابن قاسم الغزي",
    titleTranslit: "Hashiyat al-Bajuri 'ala Sharh Ibn Qasim al-Ghazzi",
    titleBm: "Hashiyat al-Bajuri",
    author: "Ibrahim al-Bajuri (d. 1276H/1860M)",
    school: "Shafi'i",
    description: "A supercommentary on Ibn Qasim al-Ghazzi's commentary on Abu Shuja's basic fiqh text. A widely-used teaching text in traditional Islamic education across Southeast Asia.",
    relevanceToMalaysia: "One of the most commonly studied texts in Malaysian pondok education. Forms the basis of fiqh understanding for many Malaysian religious scholars and Shariah court staff.",
    keyTopics: ["Basic worship rulings", "Fundamental family law", "Elementary transaction law", "Basic criminal law"],
    volumes: 2,
    category: "Teaching Text"
  },
  {
    id: 11,
    titleArabic: "الأشباه والنظائر في قواعد وفروع فقه الشافعية",
    titleTranslit: "Al-Ashbah wa al-Naza'ir",
    titleBm: "Al-Ashbah wa al-Naza'ir",
    author: "Jalal al-Din al-Suyuti (d. 911H/1505M)",
    school: "Shafi'i",
    description: "A seminal work on Islamic legal maxims (qawa'id fiqhiyyah). Presents the five universal maxims and their branches with practical applications. Essential for understanding the principles underlying specific rulings.",
    relevanceToMalaysia: "Foundational reference for legal maxims cited in Malaysian Shariah court judgments. The five universal maxims are frequently applied: al-umur bi maqasidiha (matters are judged by intentions), al-yaqin la yazul bi al-shakk (certainty is not removed by doubt), al-mashaqqah tajlib al-taysir (hardship brings ease), la darar wa la dirar (no harm and no reciprocal harm), al-'adah muhakkamah (custom is authoritative).",
    keyTopics: ["Legal maxims (Qawa'id)", "Juristic principles", "Application methodology", "Conflict resolution in rulings"],
    volumes: 2,
    category: "Legal Maxims (Qawa'id Fiqhiyyah)"
  },
  {
    id: 12,
    titleArabic: "المهذب في فقه الإمام الشافعي",
    titleTranslit: "Al-Muhadhdhab fi Fiqh al-Imam al-Shafi'i",
    titleBm: "Al-Muhadhdhab",
    author: "Abu Ishaq al-Shirazi (d. 476H/1083M)",
    school: "Shafi'i",
    description: "A major Shafi'i fiqh text that served as a basis for al-Nawawi's Majmu'. Known for presenting differing opinions within the Shafi'i school and providing evidence from hadith.",
    relevanceToMalaysia: "Referenced in Malaysian Shariah court judgments as a classical authority. Particularly useful when tracing the historical development of a ruling within the Shafi'i school.",
    keyTopics: ["Comprehensive Shafi'i fiqh", "Evidence-based rulings", "Inter-school debates", "Worship and transactions"],
    volumes: 3,
    category: "Classical Fiqh Text"
  },
  {
    id: 13,
    titleArabic: "روضة الطالبين وعمدة المفتين",
    titleTranslit: "Rawdat al-Talibin wa 'Umdat al-Muftin",
    titleBm: "Rawdat al-Talibin",
    author: "Imam Muhyi al-Din al-Nawawi (d. 676H/1277M)",
    school: "Shafi'i",
    description: "An abridgement and refinement of al-Rafi'i's al-'Aziz Sharh al-Wajiz. Al-Nawawi selected the strongest opinions (al-asahh) in the Shafi'i school, making it an essential reference for determining the relied-upon position (mu'tamad).",
    relevanceToMalaysia: "Authoritative for determining the strongest Shafi'i position on disputed matters. Malaysian Shariah courts refer to this work when clarifying which opinion within the Shafi'i school should be followed.",
    keyTopics: ["Authoritative Shafi'i positions", "Family law rulings", "Zakah and financial obligations", "Judicial administration", "Contract law"],
    volumes: 12,
    category: "Primary Fiqh Reference"
  },
  {
    id: 14,
    titleArabic: "فتح القريب المجيب في شرح ألفاظ التقريب",
    titleTranslit: "Fath al-Qarib al-Mujib fi Sharh Alfaz al-Taqrib",
    titleBm: "Fath al-Qarib",
    author: "Ibn Qasim al-Ghazzi (d. 918H/1512M)",
    school: "Shafi'i",
    description: "A commentary on Abu Shuja's Ghayat al-Taqrib, one of the most popular introductory texts in Shafi'i fiqh. Provides clear explanations of basic legal rulings with practical examples.",
    relevanceToMalaysia: "Widely taught in Malaysian pondok and religious schools as a foundational text. Many Malaysian Shariah practitioners first learned fiqh through this work. Referenced in basic court matters.",
    keyTopics: ["Basic worship rulings", "Introduction to family law", "Elementary transactions", "Criminal offences basics", "Introductory judicial procedure"],
    volumes: 1,
    category: "Introductory Study Text"
  },
  {
    id: 15,
    titleArabic: "حاشيتا قليوبي وعميرة على شرح المحلي على المنهاج",
    titleTranslit: "Hashiyata Qalyubi wa 'Umayrah",
    titleBm: "Hashiyat Qalyubi",
    author: "Shihab al-Din al-Qalyubi (d. 1069H/1659M) & Shihab al-Din 'Umayrah (d. 1066H/1656M)",
    school: "Shafi'i",
    description: "Twin marginal glosses on Jalal al-Din al-Mahalli's commentary on al-Nawawi's Minhaj. Known for their concise clarifications and additional legal details. A popular teaching text in traditional Islamic seminaries.",
    relevanceToMalaysia: "Used in Malaysian Islamic education alongside the three major Minhaj commentaries. Referenced by Shariah court practitioners for additional clarification on points discussed in Mughni al-Muhtaj and Nihayat al-Muhtaj.",
    keyTopics: ["Supplementary family law rulings", "Clarification of disputed points", "Worship details", "Evidence law", "Transaction conditions"],
    volumes: 4,
    category: "Commentary (Hashiyah)"
  },
  {
    id: 16,
    titleArabic: "المحلى بالآثار",
    titleTranslit: "Al-Muhalla bi al-Athar",
    titleBm: "Al-Muhalla",
    author: "Ibn Hazm al-Zahiri (d. 456H/1064M)",
    school: "Zahiri (Literalist)",
    description: "A monumental work of Islamic jurisprudence from the Zahiri school. Known for its rigorous evidence-based methodology, rejecting qiyas (analogical reasoning) in favor of direct textual evidence. Contains extensive hadith citations and inter-school debates.",
    relevanceToMalaysia: "While Malaysia follows the Shafi'i school, Al-Muhalla is referenced by scholars and judges when seeking alternative perspectives or when the Zahiri position offers additional textual evidence. Particularly useful in comparative fiqh discussions and academic research.",
    keyTopics: ["Evidence-based rulings", "Critique of analogical reasoning", "Comparative positions", "Hadith-focused jurisprudence", "Family and inheritance law"],
    volumes: 12,
    category: "Comparative Reference"
  },
  {
    id: 17,
    titleArabic: "بداية المجتهد ونهاية المقتصد",
    titleTranslit: "Bidayat al-Mujtahid wa Nihayat al-Muqtasid",
    titleBm: "Bidayat al-Mujtahid",
    author: "Ibn Rushd al-Hafid (Averroes) (d. 595H/1198M)",
    school: "Comparative (All Schools)",
    description: "A masterwork of comparative Islamic jurisprudence by the renowned philosopher-jurist Ibn Rushd. Systematically presents the points of agreement and disagreement among the major schools with analysis of the underlying reasons for differences.",
    relevanceToMalaysia: "Valued by Malaysian legal scholars and fatwa committees for understanding the rationale behind differing positions. Used in academic settings and when courts need to consider comparative perspectives. Particularly helpful for modern ijtihad on contemporary issues.",
    keyTopics: ["Comparative methodology", "Reasons for scholarly disagreement", "Worship across schools", "Marriage and divorce comparisons", "Commercial law differences"],
    volumes: 2,
    category: "Comparative Reference"
  },
  {
    id: 18,
    titleArabic: "منهاج الطالبين وعمدة المفتين",
    titleTranslit: "Minhaj al-Talibin wa 'Umdat al-Muftin",
    titleBm: "Minhaj al-Talibin",
    author: "Imam Muhyi al-Din al-Nawawi (d. 676H/1277M)",
    school: "Shafi'i",
    description: "The foundational matn (base text) upon which the three great commentaries (Mughni al-Muhtaj, Nihayat al-Muhtaj, Tuhfat al-Muhtaj) were written. A concise yet comprehensive summary of Shafi'i fiqh that became the standard reference text of the school.",
    relevanceToMalaysia: "The base text underlying the most frequently cited commentaries in Malaysian Shariah courts. Understanding Minhaj al-Talibin is essential for any Shariah legal practitioner working within the Malaysian system.",
    keyTopics: ["Core Shafi'i positions", "Complete fiqh coverage", "Worship to transactions", "Family law foundations", "Judicial matters"],
    volumes: 1,
    category: "Foundational Text"
  },
  {
    id: 19,
    titleArabic: "المجموع شرح المهذب",
    titleTranslit: "Al-Majmu' Sharh al-Muhadhdhab",
    titleBm: "Al-Majmu'",
    author: "Imam Muhyi al-Din al-Nawawi (d. 676H/1277M), completed by al-Subki and al-Muti'i",
    school: "Shafi'i",
    description: "Al-Nawawi's magnum opus, a massive commentary on al-Shirazi's al-Muhadhdhab. Covers comparative positions across all schools with extensive hadith verification. Al-Nawawi completed only a portion; later scholars continued the work.",
    relevanceToMalaysia: "The most comprehensive Shafi'i reference work available. Referenced in complex court cases requiring deep comparative analysis. Malaysian legal academics and senior judges rely on it for detailed scholarly opinions.",
    keyTopics: ["Comprehensive comparative fiqh", "Hadith authentication", "Detailed worship rulings", "Complex inheritance", "Advanced commercial law"],
    volumes: 23,
    category: "Encyclopedic Commentary"
  },
  {
    id: 20,
    titleArabic: "سبل السلام شرح بلوغ المرام",
    titleTranslit: "Subul al-Salam Sharh Bulugh al-Maram",
    titleBm: "Subul al-Salam",
    author: "Muhammad ibn Isma'il al-San'ani (d. 1182H/1768M)",
    school: "Comparative (Hadith-focused)",
    description: "A commentary on Ibn Hajar al-'Asqalani's Bulugh al-Maram, which collects the hadith evidence for legal rulings. Explains the juristic implications of each hadith and how different schools derive their rulings from the same evidence.",
    relevanceToMalaysia: "Used by Malaysian scholars to trace the hadith basis of legal rulings. Particularly valuable in fatwa deliberations where direct textual evidence is needed. Referenced in academic training of Shariah legal practitioners.",
    keyTopics: ["Hadith-based rulings", "Evidence for legal positions", "Purification and worship", "Marriage and family hadith", "Commercial transaction hadith", "Judicial evidence hadith"],
    volumes: 4,
    category: "Hadith Commentary"
  },
  {
    id: 21,
    titleArabic: "المدونة الكبرى",
    titleTranslit: "Al-Mudawwanah al-Kubra",
    titleBm: "Al-Mudawwanah al-Kubra",
    author: "Imam Sahnun ibn Sa'id al-Tanukhi (d. 240H/854M), recording the rulings of Imam Malik via Ibn al-Qasim",
    school: "Maliki",
    description: "The earliest and most authoritative repository of Maliki fiqh, recording Imam Malik's rulings as transmitted by his student Ibn al-Qasim. The foundational source-text of the Maliki school covering all areas of jurisprudence.",
    relevanceToMalaysia: "Primary Maliki reference consulted by Malaysian academics and the Mufti's offices when a Maliki position is being examined alongside the dominant Shafi'i view, especially on family law, oaths and witness matters.",
    keyTopics: ["Maliki primary source", "Worship", "Marriage and divorce (Maliki)", "Sales and partnerships", "Oaths and testimony", "Hudud and qisas (Maliki)"],
    volumes: 16,
    category: "Maliki Primary Source"
  },
  {
    id: 22,
    titleArabic: "بدائع الصنائع في ترتيب الشرائع",
    titleTranslit: "Bada'i' al-Sana'i' fi Tartib al-Shara'i'",
    titleBm: "Bada'i' al-Sana'i' (Hanafi)",
    author: "Ala' al-Din al-Kasani (d. 587H/1191M)",
    school: "Hanafi",
    description: "A foundational Hanafi reference, organising fiqh by causes (asbab) and conditions (shurut) rather than by topical chapters. Renowned for its analytical rigour and structured legal reasoning.",
    relevanceToMalaysia: "Cited where Malaysian courts or muftis examine Hanafi positions, particularly on contracts (mu'amalat) and Islamic banking matters where Hanafi rulings inform contemporary Islamic finance contracts.",
    keyTopics: ["Hanafi fiqh", "Contract theory", "Sales (bay')", "Partnership (sharikah)", "Marriage", "Divorce", "Criminal law"],
    volumes: 7,
    category: "Hanafi Reference"
  },
  {
    id: 23,
    titleArabic: "المغني",
    titleTranslit: "Al-Mughni",
    titleBm: "Al-Mughni (Hanbali)",
    author: "Ibn Qudamah al-Maqdisi (d. 620H/1223M)",
    school: "Hanbali (Comparative)",
    description: "The most authoritative Hanbali reference, written as a comparative commentary that presents the position of all schools alongside the Hanbali view, with extensive scriptural evidence.",
    relevanceToMalaysia: "Referenced by Malaysian academics and the Mufti's offices for comparative analysis, especially on inheritance, oaths, vows, hudud and ta'zir matters where the Hanbali position offers useful contrast.",
    keyTopics: ["Comparative fiqh", "Inheritance", "Hudud", "Vows and oaths", "Sales and ribawi items", "Family law"],
    volumes: 14,
    category: "Hanbali Comparative Reference"
  },
  {
    id: 24,
    titleArabic: "الموافقات في أصول الشريعة",
    titleTranslit: "Al-Muwafaqat fi Usul al-Shari'ah",
    titleBm: "Al-Muwafaqat (Maqasid)",
    author: "Abu Ishaq al-Shatibi (d. 790H/1388M)",
    school: "Maliki (Usul / Maqasid)",
    description: "The seminal work on maqasid al-shariah (objectives of Islamic law). Establishes the framework of daruriyyat, hajiyyat and tahsiniyyat that underpins modern Islamic legal reasoning.",
    relevanceToMalaysia: "Foundational reference for Malaysian fatwa councils (Majlis Fatwa Kebangsaan and state muftis) when deliberating on contemporary issues, Islamic finance, and policy questions requiring maqasid analysis.",
    keyTopics: ["Maqasid al-shariah", "Daruriyyat (necessities)", "Hajiyyat (needs)", "Tahsiniyyat (embellishments)", "Usul al-fiqh", "Public interest (maslahah)"],
    volumes: 4,
    category: "Usul al-Fiqh / Maqasid"
  },
  {
    id: 25,
    titleArabic: "إعلام الموقعين عن رب العالمين",
    titleTranslit: "I'lam al-Muwaqqi'in 'an Rabb al-'Alamin",
    titleBm: "I'lam al-Muwaqqi'in",
    author: "Ibn Qayyim al-Jawziyyah (d. 751H/1350M)",
    school: "Hanbali (Usul / Fatwa)",
    description: "A treatise on the methodology of issuing fatwas and the qualifications, ethics and reasoning of the mufti. Includes deep discussion on changing rulings with changing times, places and conditions.",
    relevanceToMalaysia: "Influential text on fatwa methodology used by the JAKIM Mufti training programmes and state Mufti departments. Underpins the Malaysian fatwa-issuance process.",
    keyTopics: ["Fatwa methodology", "Qualifications of the mufti", "Change of ruling with change of context", "Maslahah", "Sadd al-dhara'i' (blocking the means)"],
    volumes: 4,
    category: "Fatwa Methodology"
  },
  {
    id: 26,
    titleArabic: "صحيح البخاري",
    titleTranslit: "Sahih al-Bukhari",
    titleBm: "Sahih al-Bukhari",
    author: "Imam Muhammad ibn Isma'il al-Bukhari (d. 256H/870M)",
    school: "Hadith (Sunni consensus)",
    description: "The most authoritative Sunni hadith collection. Organised by fiqh chapters, making it directly relevant to legal reasoning. Each chapter heading indicates al-Bukhari's juristic position.",
    relevanceToMalaysia: "Primary hadith source cited in Malaysian Shariah court judgments, fatwas, and academic legal writing. Mandatory reference when a hadith is invoked as evidence.",
    keyTopics: ["Hadith primary source", "Worship", "Family law hadith", "Commercial transaction hadith", "Judicial procedure hadith", "Hudud and qisas hadith"],
    volumes: 9,
    category: "Primary Hadith Source"
  },
  {
    id: 27,
    titleArabic: "صحيح مسلم",
    titleTranslit: "Sahih Muslim",
    titleBm: "Sahih Muslim",
    author: "Imam Muslim ibn al-Hajjaj al-Naysaburi (d. 261H/875M)",
    school: "Hadith (Sunni consensus)",
    description: "The second most authoritative Sunni hadith collection, organised topically with longer hadith chains than al-Bukhari, including detailed variants of each tradition.",
    relevanceToMalaysia: "Co-equal primary hadith reference cited in Malaysian courts and fatwas, especially where multiple narrations of a hadith bear on the legal point.",
    keyTopics: ["Hadith primary source", "Iman and worship", "Marriage and divorce hadith", "Criminal law hadith", "Witness and testimony hadith", "Inheritance hadith"],
    volumes: 8,
    category: "Primary Hadith Source"
  },
  {
    id: 28,
    titleArabic: "نيل الأوطار شرح منتقى الأخبار",
    titleTranslit: "Nayl al-Awtar Sharh Muntaqa al-Akhbar",
    titleBm: "Nayl al-Awtar",
    author: "Muhammad ibn Ali al-Shawkani (d. 1250H/1834M)",
    school: "Comparative (Hadith-Fiqh)",
    description: "A comparative hadith-fiqh commentary that examines each hadith with the juristic positions derived from it across all schools. A standard reference for ijtihad-based reasoning.",
    relevanceToMalaysia: "Used in academic and fatwa contexts where direct hadith-based reasoning is needed beyond the standard Shafi'i positions.",
    keyTopics: ["Hadith-based fiqh", "Comparative rulings", "Worship", "Family law", "Commercial law", "Judicial law"],
    volumes: 8,
    category: "Hadith-Fiqh Commentary"
  },
  {
    id: 29,
    titleArabic: "المعايير الشرعية - أيوفي",
    titleTranslit: "Al-Ma'ayir al-Shar'iyyah (AAOIFI Shari'ah Standards)",
    titleBm: "Piawaian Syariah AAOIFI",
    author: "Accounting and Auditing Organisation for Islamic Financial Institutions (AAOIFI), Bahrain",
    school: "Contemporary Islamic Finance (Comparative)",
    description: "The internationally recognised Shariah standards for Islamic financial institutions. Covers murabahah, ijarah, mudarabah, musharakah, sukuk, takaful, gold trading and dozens of other instruments with detailed Shariah parameters.",
    relevanceToMalaysia: "Reference standard for Bank Negara Malaysia Shariah Advisory Council resolutions and Islamic banking advisory work in Malaysia. Essential for any Shariah compliance, Islamic banking or sukuk advisory matter.",
    keyTopics: ["Murabahah", "Ijarah", "Mudarabah", "Musharakah", "Sukuk", "Takaful", "Gold and currency", "Tawarruq", "Hibah and waqf"],
    volumes: 1,
    category: "Contemporary Islamic Finance Standard"
  },
  {
    id: 30,
    titleArabic: "قرارات وفتاوى مجلس استشارية شرعية بنك نڬارا مليسيا",
    titleTranslit: "Resolusi & Keputusan SAC Bank Negara Malaysia",
    titleBm: "Resolusi Majlis Penasihat Syariah BNM",
    author: "Shariah Advisory Council, Bank Negara Malaysia",
    school: "Malaysian Islamic Finance (Authoritative)",
    description: "The official, binding Shariah resolutions of the Bank Negara Malaysia Shariah Advisory Council (SAC) governing all Islamic financial institutions in Malaysia. Issued under Section 51 of the Central Bank of Malaysia Act 2009 (Act 701).",
    relevanceToMalaysia: "Legally binding under Act 701. Mandatory reference for any Islamic banking, takaful, sukuk or capital markets advisory work in Malaysia. Decisive in Shariah compliance disputes brought before the High Court of Malaya.",
    keyTopics: ["Bay' bithaman ajil (BBA)", "Tawarruq munazzam", "Murabahah on commodities", "Ijarah muntahiyah bi al-tamlik", "Sukuk structures", "Takaful operations", "Wakalah", "Hibah deposits"],
    volumes: 1,
    category: "Malaysian Authoritative Resolution"
  },
  {
    id: 31,
    titleArabic: "النصائح الدينية والوصايا الإيمانية",
    titleTranslit: "Al-Nasa'ih al-Diniyyah wa al-Wasaya al-Imaniyyah",
    titleBm: "Al-Nasa'ih al-Diniyyah",
    author: "Imam al-Sayyid 'Abd Allah ibn 'Alawi al-Haddad (d. 1132H/1720M)",
    school: "Shafi'i (Tasawwuf-Fiqh)",
    description: "A widely studied work combining Shafi'i fiqh of worship with practical spiritual ethics. A staple of Southeast Asian pondok and pesantren curricula.",
    relevanceToMalaysia: "Standard text in Malaysian and Indonesian traditional Islamic education. Influences the ethical framework of practitioners and the conduct of court officers.",
    keyTopics: ["Worship rulings", "Sincerity and ikhlas", "Repentance", "Adab of the seeker", "Practical fiqh"],
    volumes: 1,
    category: "Foundational Pondok Text"
  },
  {
    id: 32,
    titleArabic: "الرسالة",
    titleTranslit: "Al-Risalah",
    titleBm: "Al-Risalah (Usul al-Fiqh)",
    author: "Imam Muhammad ibn Idris al-Shafi'i (d. 204H/820M)",
    school: "Shafi'i (Usul)",
    description: "The first systematic work on usul al-fiqh, written by the founder of the Shafi'i school. Establishes the methodology of deriving legal rulings from the Quran, Sunnah, ijma' and qiyas.",
    relevanceToMalaysia: "Foundational reference for the methodological framework underlying Malaysian Shariah jurisprudence. Cited in advanced legal reasoning and judicial training.",
    keyTopics: ["Sources of Islamic law", "Quran and Sunnah", "Ijma' (consensus)", "Qiyas (analogy)", "Naskh (abrogation)", "Usul methodology"],
    volumes: 1,
    category: "Foundational Usul al-Fiqh"
  },
  {
    id: 33,
    titleArabic: "سبيل المهتدين للتفقه في أمر الدين",
    titleTranslit: "Sabil al-Muhtadin li al-Tafaqquh fi Amr al-Din",
    titleBm: "Sabil al-Muhtadin",
    author: "Sheikh Muhammad Arsyad al-Banjari (d. 1227H/1812M)",
    school: "Shafi'i (Malay-Jawi)",
    description: "The most widely studied Malay-Jawi Shafi'i fiqh text in Nusantara, completed in 1779 by the great Banjari scholar. Covers ibadah comprehensively in classical Malay using Jawi script with Arabic legal terminology fully integrated.",
    relevanceToMalaysia: "A foundational pondok and madrasah text across Malaysia, Brunei and Indonesia. Cited by Malaysian Shariah courts and state Mufti departments as a localised authoritative Shafi'i source. Essential for any Malaysian Shariah practitioner working in family law, ibadah disputes, or pondok-trained client matters.",
    keyTopics: ["Taharah", "Solat", "Zakat (with Malay context)", "Puasa", "Haji", "Kelas hukum: wajib/sunat/harus/makruh/haram", "Bilingual Arabic-Malay fiqh terminology"],
    volumes: 2,
    category: "Foundational Malay-Jawi Shafi'i Text",
    notableRulings: [
      "Establishes the Shafi'i position on niyat in solat as binding for validity, with particular attention to mu'allaq (suspended) intentions in jamak/qasar prayers — directly influencing Malaysian Mahkamah Syariah rulings on missed prayers and kifarah",
      "Classifies categories of najis (mughallazah, mukhaffafah, mutawassitah) with detailed cleansing procedures — the standard Malaysian fatwa reference on halal certification disputes",
      "Detailed exposition of zakat al-mal calculations including modern equivalents adopted by Pusat Zakat state agencies"
    ],
    sampleQuestions: [
      "What is Sheikh Arsyad al-Banjari's position on jamak prayers during work travel within Peninsular Malaysia?",
      "How does Sabil al-Muhtadin address najis mughallazah cleansing in modern halal kitchen settings?",
      "Apakah pendirian Sabil al-Muhtadin tentang zakat pendapatan untuk pekerja bergaji bulanan?"
    ]
  },
  {
    id: 34,
    titleArabic: "هداية السالكين في سلوك مسلك المتقين",
    titleTranslit: "Hidayat al-Salikin fi Suluk Maslak al-Muttaqin",
    titleBm: "Hidayat al-Salikin",
    author: "Sheikh Abdul Samad al-Falimbani (d. 1244H/1828M)",
    school: "Shafi'i (Malay-Jawi, Tasawwuf-Fiqh)",
    description: "A foundational Malay-Jawi work combining Shafi'i fiqh of worship with the spiritual ethics of al-Ghazali's Bidayat al-Hidayah. The most widely circulated Malay text on the inner and outer dimensions of Islamic practice.",
    relevanceToMalaysia: "Standard text in Malaysian pondok curricula and Tarekat-based religious training. Frequently cited in Mahkamah Syariah deliberations involving sincerity of taubat, validity of nazar, and ethical conduct of court officers and witnesses.",
    keyTopics: ["Adab worship", "Niyat and ikhlas", "Taubat", "Nazar and sumpah", "Fardu ain", "Akhlak Islamiah", "Tasawwuf 'amali"],
    volumes: 1,
    category: "Foundational Malay-Jawi Pondok Text",
    notableRulings: [
      "Establishes conditions of valid taubat (regret, cessation, resolve, restoration of rights) — applied by Mahkamah Syariah in penalty mitigation under Section 76 Syariah Criminal Procedure (Federal Territories) Act 1997",
      "Detailed conditions for nazar to be binding under Shafi'i fiqh — referenced in Mahkamah Syariah disputes over nazar property"
    ],
    sampleQuestions: [
      "How does Hidayat al-Salikin treat the sincerity requirement for sumpah laknat in li'an proceedings?",
      "Apakah syarat-syarat taubat menurut Hidayat al-Salikin yang boleh dikemukakan sebagai mitigasi di Mahkamah Syariah?"
    ]
  },
  {
    id: 35,
    titleArabic: "فروع المسائل وأصول الوسائل",
    titleTranslit: "Furu' al-Masa'il wa Usul al-Wasa'il",
    titleBm: "Furu' al-Masa'il",
    author: "Sheikh Daud bin Abdullah al-Fatani (d. 1265H/1847M)",
    school: "Shafi'i (Malay-Jawi)",
    description: "A masterwork of practical Shafi'i fiqh in Malay-Jawi by the foremost Pattani-Malay jurist. Compiled as practical fatawa to address legal questions encountered by the Malay Muslim community of Sheikh Daud's era and beyond.",
    relevanceToMalaysia: "A primary classical Malay reference for Mahkamah Syariah, particularly for issues of muamalat, family law and contemporary ijtihad in the Nusantara context. Frequently cited by Kelantan, Terengganu and Kedah Shariah courts as the definitive local Shafi'i authority.",
    keyTopics: ["Muamalat (Malay context)", "Munakahat", "Faraid", "Kontrak jual beli", "Wakaf and hibah", "Fatwa praktikal Nusantara"],
    volumes: 4,
    category: "Foundational Malay-Jawi Shafi'i Text",
    notableRulings: [
      "Authoritative on hibah amanah and hibah ruqba — the foundation for modern Malaysian wasiat and hibah practice as adopted by Amanah Raya Berhad",
      "Detailed conditions of fasakh on grounds of mafqud (missing husband) — directly underlies Section 53 Islamic Family Law (Federal Territories) Act 1984 procedure",
      "Establishes the Shafi'i position on rahn (pledge) — referenced in Bank Negara SAC discussions on Ar-Rahnu Islamic pawnbroking"
    ],
    sampleQuestions: [
      "What does Furu' al-Masa'il say about hibah ruqba and its enforceability under the Malaysian Hibah Act framework?",
      "How does Sheikh Daud al-Fatani treat fasakh for mafqud husband in light of modern documentation?",
      "Apakah pendirian Furu' al-Masa'il berkenaan rahn dan akad gadai-Janji Islam moden?"
    ]
  },
  {
    id: 36,
    titleArabic: "بغية الطلاب لمريد معرفة الأحكام بالصواب",
    titleTranslit: "Bughyat al-Tullab li Murid Ma'rifat al-Ahkam bi al-Sawab",
    titleBm: "Bughyat al-Tullab",
    author: "Sheikh Daud bin Abdullah al-Fatani (d. 1265H/1847M)",
    school: "Shafi'i (Malay-Jawi)",
    description: "A second comprehensive Malay-Jawi Shafi'i fiqh work by Sheikh Daud al-Fatani, written for advanced students. Covers worship and transactions with extensive citation of Mughni al-Muhtaj, Tuhfat al-Muhtaj and Nihayat al-Muhtaj — bridging classical Arabic Shafi'i scholarship and the Malay legal tradition.",
    relevanceToMalaysia: "Used in advanced pondok studies and increasingly cited in JAKIM and state Mufti deliberations as a Malay-language transmission channel for the major Shafi'i commentaries. Particularly valuable when a Malaysian Shariah court needs to apply a Mughni al-Muhtaj position to a local context.",
    keyTopics: ["Solat and ibadah lanjut", "Akad nikah", "Talak and rujuk", "Nafkah and mut'ah", "Faraid", "Wakaf", "Wasiat", "Hudud (klasik)"],
    volumes: 2,
    category: "Foundational Malay-Jawi Shafi'i Text",
    notableRulings: [
      "Detailed treatment of mut'ah (consolatory gift on divorce) — underlies modern Malaysian Mahkamah Syariah quantum guidelines",
      "Comprehensive ruling on hadhanah custody priorities consistent with Section 81 Islamic Family Law (Federal Territories) Act 1984"
    ],
    sampleQuestions: [
      "How does Bughyat al-Tullab calculate mut'ah quantum and how does this inform current Mahkamah Syariah practice?",
      "Apakah pendirian Bughyat al-Tullab tentang keutamaan hadhanah ibu-bapa?"
    ]
  },
  {
    id: 37,
    titleArabic: "الإقناع في حل ألفاظ أبي شجاع",
    titleTranslit: "Al-Iqna' fi Hall Alfaz Abi Shuja'",
    titleBm: "Al-Iqna' (Sharbini)",
    author: "Shams al-Din al-Khatib al-Sharbini (d. 977H/1570M)",
    school: "Shafi'i",
    description: "A widely circulated Shafi'i commentary on Abu Shuja's Ghayat al-Ikhtisar by the same author as Mughni al-Muhtaj. Renowned for its clarity and structured legal exposition, often paired with Hashiyat al-Bujayrimi as a complete teaching set.",
    relevanceToMalaysia: "Standard mid-level fiqh text in Malaysian pondok and INSANIAH/USIM curricula. Cited in Mahkamah Syariah judgments for clear authoritative Shafi'i positions on worship and basic transactions.",
    keyTopics: ["Ibadah lanjut", "Nikah dan rujuk", "Jual beli (bay')", "Riba", "Syufah", "Waqaf", "Hudud Shafi'i"],
    volumes: 2,
    category: "Intermediate Shafi'i Reference",
    notableRulings: [
      "Detailed conditions of valid bay' (sale) including ma'qud 'alayh requirements — referenced in Bank Negara SAC tawarruq deliberations",
      "Establishes Shafi'i position on riba al-fadl and riba al-nasi'ah — foundational for Islamic banking ribawi item analysis"
    ],
    sampleQuestions: [
      "What conditions does Al-Iqna' set for ma'qud 'alayh validity in modern e-commerce contracts?",
      "How does Al-Iqna' distinguish riba al-fadl from riba al-nasi'ah in commodity murabahah?"
    ]
  },
  {
    id: 38,
    titleArabic: "حاشية الجمل على شرح المنهج",
    titleTranslit: "Hashiyat al-Jamal 'ala Sharh al-Manhaj",
    titleBm: "Hashiyat al-Jamal",
    author: "Sulayman ibn Umar al-Jamal (d. 1204H/1790M)",
    school: "Shafi'i",
    description: "A detailed supercommentary (hashiyah) on Zakariyya al-Ansari's Sharh al-Manhaj, itself a commentary on al-Nawawi's Minhaj. Renowned for resolving difficult points in the Shafi'i school with comprehensive cross-referencing.",
    relevanceToMalaysia: "Used by senior Malaysian muftis and Shariah court judges for resolving complex disputed points within the Shafi'i school. Especially valuable for advanced family law and inheritance disputes.",
    keyTopics: ["Detail munakahat", "Faraid (kes kompleks)", "Kontrak jual beli", "Wakaf and trust", "Saksi dan keterangan"],
    volumes: 5,
    category: "Advanced Shafi'i Hashiyah",
    notableRulings: [
      "Extensive treatment of disputed inheritance scenarios including munasakhah (consecutive deaths before estate distribution) — applied in Malaysian Faraid Court calculations"
    ],
    sampleQuestions: [
      "How does Hashiyat al-Jamal treat munasakhah where two heirs die in sequence before estate distribution?"
    ]
  },
  {
    id: 39,
    titleArabic: "الموسوعة الفقهية الكويتية",
    titleTranslit: "Al-Mawsu'ah al-Fiqhiyyah al-Kuwaitiyyah",
    titleBm: "Ensiklopedia Fiqh Kuwait",
    author: "Kementerian Wakaf dan Hal Ehwal Islam Kuwait (1980-2006)",
    school: "Comparative (All Four Schools)",
    description: "A 45-volume modern encyclopedia of Islamic jurisprudence covering all four Sunni schools, with each entry presenting comparative positions, evidence and modern application. The most comprehensive contemporary fiqh reference work available.",
    relevanceToMalaysia: "Standard reference at INCEIF, USIM, IIUM and JAKIM. Cited in Bank Negara SAC resolutions and in Mahkamah Syariah judgments requiring comparative fiqh analysis. Essential for any contemporary Shariah issue requiring multi-school perspective.",
    keyTopics: ["Comparative fiqh on every topic", "Modern issues (nawazil)", "Islamic finance", "Medical jurisprudence", "Bioethics", "Constitutional and political fiqh"],
    volumes: 45,
    category: "Modern Encyclopedic Reference",
    notableRulings: [
      "Definitive comparative entry on 'Bay' al-Inah' showing Shafi'i permissibility vs Hanbali/Maliki prohibition — central to Bank Negara SAC ruling on BBA financing",
      "Comprehensive entry on 'Talaq' across all four schools — referenced in JAKIM-issued reform proposals on talaq registration",
      "Entry on 'Wakaf' covering all categorisations — adopted in JAWHAR's Wakaf Manual"
    ],
    sampleQuestions: [
      "What does the Mawsu'ah Fiqhiyyah Kuwaitiyyah summarise as the four-school positions on bay' al-inah?",
      "Compare the treatment of triple talaq across all four schools as presented in the Kuwaiti Encyclopedia"
    ]
  },
  {
    id: 40,
    titleArabic: "الفقه المنهجي على مذهب الإمام الشافعي",
    titleTranslit: "Al-Fiqh al-Manhaji 'ala Madhhab al-Imam al-Shafi'i",
    titleBm: "Al-Fiqh al-Manhaji",
    author: "Dr Mustafa al-Khin, Dr Mustafa al-Bugha, Sheikh Ali al-Sharbaji (Damascus, 1992)",
    school: "Shafi'i (Modern)",
    description: "A modern systematic Shafi'i fiqh textbook organised pedagogically with definitions, conditions, evidence, and contemporary applications. Has become the standard Shafi'i teaching text at most Sunni universities globally.",
    relevanceToMalaysia: "Core textbook at IIUM, USIM, UIAM and Kolej Universiti Islam states. Used in Malaysian Shariah law degree programmes and Mahkamah Syariah judicial training. The bridge between classical Shafi'i scholarship and modern Malaysian legal education.",
    keyTopics: ["Modern Shafi'i fiqh", "Ibadah", "Munakahat", "Mu'amalat moden", "Jenayah Islam", "Sistem kehakiman"],
    volumes: 8,
    category: "Modern Shafi'i Teaching Text",
    notableRulings: [
      "Modern systematisation of khiyar (option) categories in sales — adopted in BNM SAC consumer protection rulings",
      "Contemporary treatment of takaful as cooperative insurance distinct from conventional ta'min — cited in Malaysian Takaful Act 2013 deliberations"
    ],
    sampleQuestions: [
      "How does Al-Fiqh al-Manhaji classify khiyar al-shart in modern e-commerce contracts?",
      "Apakah pandangan Al-Fiqh al-Manhaji tentang takaful sebagai berbeza dengan insurans konvensional?"
    ]
  },
  {
    id: 41,
    titleArabic: "حاشية الشرقاوي على تحفة الطلاب",
    titleTranslit: "Hashiyat al-Sharqawi 'ala Tuhfat al-Tullab",
    titleBm: "Hashiyat al-Sharqawi",
    author: "Sheikh Abdullah ibn Hijazi al-Sharqawi (d. 1227H/1812M)",
    school: "Shafi'i",
    description: "A detailed Shafi'i hashiyah on Zakariyya al-Ansari's Tuhfat al-Tullab. Renowned for its precision in resolving disputed points and clarity in presentation, widely studied in al-Azhar and Southeast Asian pondok.",
    relevanceToMalaysia: "Used in advanced Malaysian pondok curricula and referenced by Shariah court practitioners alongside Mughni al-Muhtaj for mid-complexity legal questions on family law and transactions.",
    keyTopics: ["Munakahat lanjut", "Khulu' and fasakh", "Iddah", "Hadhanah", "Bay' and rahn", "Shahadah"],
    volumes: 4,
    category: "Advanced Shafi'i Hashiyah",
    notableRulings: [
      "Detailed conditions for valid khulu' including iwad (consideration) requirements — directly applied in Malaysian Mahkamah Syariah khulu' proceedings under state Islamic Family Law enactments"
    ],
    sampleQuestions: [
      "What does Hashiyat al-Sharqawi require for valid iwad in khulu' proceedings under Malaysian Mahkamah Syariah practice?"
    ]
  },
  {
    id: 42,
    titleArabic: "أنوار البروق في أنواء الفروق",
    titleTranslit: "Anwar al-Buruq fi Anwa' al-Furuq (Al-Furuq)",
    titleBm: "Al-Furuq (Qarafi)",
    author: "Shihab al-Din al-Qarafi (d. 684H/1285M)",
    school: "Maliki (Usul / Qawa'id)",
    description: "A masterwork of Islamic legal distinctions (furuq) by the great Maliki jurist. Identifies and resolves apparent contradictions between similar legal rulings by exposing the underlying juristic distinctions. Essential for advanced Islamic legal reasoning.",
    relevanceToMalaysia: "Referenced in advanced Malaysian Shariah judicial training and in Bank Negara SAC deliberations requiring nuanced legal distinctions. Critical for resolving cases where general rules appear to conflict.",
    keyTopics: ["Legal distinctions (furuq)", "Qawa'id fiqhiyyah", "Resolving apparent contradictions", "Maslahah analysis", "Sadd al-dhara'i'"],
    volumes: 4,
    category: "Legal Distinctions (Furuq)",
    notableRulings: [
      "Famous distinction between fatwa and judicial ruling (qada): fatwa is non-binding general guidance whereas qada is binding case-specific enforcement — foundational for Malaysian Mahkamah Syariah and state Mufti relationship",
      "Distinction between hibah and sadaqah on revocability — adopted in Malaysian Hibah Act framework"
    ],
    sampleQuestions: [
      "How does Al-Qarafi distinguish between a binding fatwa from a state Mufti and an enforceable Mahkamah Syariah judgment?",
      "What is Al-Qarafi's distinction between revocable hibah and irrevocable sadaqah, and how does this apply to Malaysian estate planning?"
    ]
  },
  {
    id: 43,
    titleArabic: "تفسير پيمڤينن الرحمن",
    titleTranslit: "Tafsir Pimpinan al-Rahman kepada Pengertian al-Quran",
    titleBm: "Tafsir Pimpinan al-Rahman",
    author: "Sheikh Abdullah Basmeih (1968, JAKIM/JPM publication)",
    school: "Sunni (Shafi'i-leaning, Official Malaysian)",
    description: "The official Malaysian government translation and commentary of the Quran in Bahasa Melayu, originally commissioned by JAKIM (then BAHEIS). Written from a Shafi'i jurisprudential perspective with attention to Malaysian context and gazetted fatwa positions.",
    relevanceToMalaysia: "The only government-endorsed Quran translation in Malaysia. Cited by Mahkamah Syariah, JAKIM Mufti and state Muftis as the authoritative Malay rendering when Quranic verses are invoked as evidence. Mandatory reference in Malaysian shariah practice.",
    keyTopics: ["Tafsir ayat ahkam", "Tafsir keluarga (munakahat)", "Tafsir muamalat (ribah, jual beli)", "Tafsir jenayah Islam", "Tafsir warisan (faraid)"],
    volumes: 1,
    category: "Official Malaysian Tafsir",
    notableRulings: [
      "The standard Malay rendering of Surah al-Nisa' verses on faraid — used by Faraid Court calculations",
      "Authoritative Malay translation of Surah al-Baqarah verses on talaq, iddah and ruju' — cited in Mahkamah Syariah family law judgments",
      "Standard Malay translation of riba verses (Surah al-Baqarah 275-281) — referenced in BNM SAC resolutions"
    ],
    sampleQuestions: [
      "Apakah terjemahan rasmi Tafsir Pimpinan al-Rahman bagi ayat-ayat faraid dalam Surah al-Nisa'?",
      "How does Tafsir Pimpinan al-Rahman render the riba prohibition verses for use in Malaysian Islamic banking advisory?"
    ]
  },
  {
    id: 44,
    titleArabic: "غاريس ڤندوان حاكيم شرعي",
    titleTranslit: "Garis Panduan Hakim Syarie",
    titleBm: "Garis Panduan Hakim Syarie (JKSM)",
    author: "Jabatan Kehakiman Syariah Malaysia (JKSM)",
    school: "Malaysian Shariah Judicial Practice",
    description: "Official judicial guidelines issued by the Department of Shariah Judiciary Malaysia (JKSM) for Mahkamah Syariah judges across Malaysia. Codifies procedural standards, evidentiary requirements, sentencing guidelines and case management practices specific to Malaysian Shariah courts.",
    relevanceToMalaysia: "Binding internal practice directives for all Mahkamah Syariah judges in Malaysia. Indispensable reference for Shariah counsel appearing before Mahkamah Rendah Syariah, Mahkamah Tinggi Syariah and Mahkamah Rayuan Syariah at federal and state levels.",
    keyTopics: ["Prosedur Mahkamah Syariah", "Pengurusan kes munakahat", "Pengurusan kes jenayah syariah", "Garis panduan hukuman", "Mediasi/sulh", "Penghakiman dan rayuan"],
    volumes: 1,
    category: "Malaysian Judicial Practice Guideline",
    notableRulings: [
      "Codifies the sulh (Islamic mediation) procedure mandatory for many Malaysian family disputes — operationalises Section 99 Islamic Family Law (Federal Territories) Act 1984",
      "Sentencing tariffs for syariah criminal offences (khalwat, zina, drinking) consistent with state Syariah Criminal Offences enactments",
      "Mandatory case management timelines for Mahkamah Syariah — applied uniformly across all states"
    ],
    sampleQuestions: [
      "Apakah prosedur sulh wajib mengikut Garis Panduan JKSM untuk kes nafkah isteri?",
      "What are the JKSM sentencing tariffs for khalwat under state Syariah Criminal Offences enactments?"
    ]
  },
];

// Lightweight integrity guard: every kitab id must be unique and have all
// canonical metadata fields populated. Throws at module load if violated.
{
  const seenIds = new Set<number>();
  const seenTranslit = new Set<string>();
  for (const k of KITAB_DATABASE) {
    if (seenIds.has(k.id)) throw new Error(`KITAB_DATABASE: duplicate id ${k.id}`);
    seenIds.add(k.id);
    const tlKey = k.titleTranslit.toLowerCase().trim();
    if (seenTranslit.has(tlKey)) throw new Error(`KITAB_DATABASE: duplicate work titleTranslit "${k.titleTranslit}"`);
    seenTranslit.add(tlKey);
    if (!k.titleArabic || !k.titleTranslit || !k.titleBm || !k.author || !k.school) {
      throw new Error(`KITAB_DATABASE: id ${k.id} is missing required identity fields`);
    }
  }
}

router.get("/kitab/list", (_req, res): void => {
  res.json(KITAB_DATABASE.map(k => ({
    id: k.id,
    titleArabic: k.titleArabic,
    titleTranslit: k.titleTranslit,
    titleBm: k.titleBm,
    author: k.author,
    school: k.school,
    category: k.category,
    volumes: k.volumes,
    keyTopics: k.keyTopics,
    sampleQuestions: (k as any).sampleQuestions ?? [],
  })));
});

router.get("/kitab/:id", (req, res): void => {
  const id = Number(req.params.id);
  const kitab = KITAB_DATABASE.find(k => k.id === id);
  if (!kitab) {
    res.status(404).json({ error: "Kitab not found" });
    return;
  }
  res.json(kitab);
});

router.post("/kitab/analyze", async (req, res): Promise<void> => {
  const { query, kitabIds, language } = req.body;
  if (!query || typeof query !== "string") {
    res.status(400).json({ error: "query is required" });
    return;
  }

  const lang = language === "bm" ? "bm" : "en";
  const selectedKitab = kitabIds?.length
    ? KITAB_DATABASE.filter((k: any) => kitabIds.includes(k.id))
    : KITAB_DATABASE;

  const kitabContext = selectedKitab.map((k: any) =>
    `[KID:${k.id}] ${k.titleArabic} (${k.titleTranslit}) by ${k.author}\nSchool: ${k.school}\nDescription: ${k.description}\nRelevance to Malaysia: ${k.relevanceToMalaysia}\nKey Topics: ${k.keyTopics.join(", ")}`
  ).join("\n\n");

  const KITAB_PROMPT = `You are an expert Islamic legal scholar specializing in the classical Arabic kitab (legal texts) used in Malaysian Shariah courts and legal practice. You have deep knowledge of Shafi'i fiqh and how these texts are applied in modern Malaysian Islamic law.

CRITICAL RESTRICTIONS:
- ONLY discuss Shariah/Islamic law matters and classical Islamic legal texts. NEVER reference civil law instruments (SRO, SPA conveyancing, Legal Profession Act, civil court fees, stamp duty).
- Do NOT fabricate kitab references, page numbers, or scholarly attributions. Only reference texts from the database below.

KITAB DATABASE:
${kitabContext}

USER'S QUESTION: ${query}

INSTRUCTIONS:
1. Analyze the legal question through the lens of the classical kitab literature
2. Cite specific kitab, chapters (bab), and discussions relevant to the query
3. Explain how the classical position relates to modern Malaysian Shariah law
4. If different kitab have nuanced positions, explain the differences
5. Include relevant Arabic legal terminology with translations
6. ${lang === "bm" ? "Respond in Bahasa Melayu with Arabic terms" : "Respond in English with Arabic terms"}
7. Return ONLY valid JSON:

{
  "analysis": "<comprehensive analysis of the legal question>",
  "kitabReferences": [
    {
      "id": <kitab id>,
      "title": "<kitab title>",
      "relevantChapter": "<specific bab/chapter>",
      "position": "<what the kitab says about this issue>",
      "arabicExcerpt": "<relevant Arabic phrase/principle if applicable>",
      "translation": "<translation of the Arabic>"
    }
  ],
  "legalMaxims": [
    {
      "arabic": "<qaidah in Arabic>",
      "transliteration": "<transliteration>",
      "translation": "<English/BM translation>",
      "application": "<how this maxim applies to the question>"
    }
  ],
  "modernApplication": "<how the classical position is applied in modern Malaysian Shariah courts>",
  "comparativeNotes": "<any differences between scholars/kitab on this issue>",
  "practicalGuidance": "<practical advice for the Shariah lawyer>"
}

Return ONLY the JSON object.`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user" as const, parts: [{ text: KITAB_PROMPT }] },
        { role: "model" as const, parts: [{ text: "I will analyze the question using the classical kitab references and provide a structured response with Arabic citations and modern Malaysian application." }] },
        { role: "user" as const, parts: [{ text: `Please analyze this question now.` }] },
      ],
      config: { maxOutputTokens: 8192, systemInstruction: PRACTICAL_GUIDANCE },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
    res.end();
  }
});

export default router;
