// Revised Compendium of Personal Injury Awards (Bar Council Malaysia, 2018)
// Source: Circular No 255/2018 dated 16 Oct 2018 — Revised Compendium of Personal
// Injury Awards, prepared by the Task Force to Review the Compendium of Personal
// Injury Awards, Bar Council Malaysia (6 July 2018). Quanta agreed by the Judiciary
// (Registrar of the High Court of Malaya, letter dated 4 Oct 2018).
//
// All figures are in Ringgit Malaysia (RM) and represent the LOW–HIGH range for
// general damages (pain, suffering and loss of amenities) for each injury. A
// single figure (high = null) denotes a fixed guideline quantum.
//
// IMPORTANT: The Compendium is a GUIDELINE only — a quick reference for judges and
// lawyers. It does not fetter the court's discretion; parties may submit above or
// below the stipulated quantum where case law or factual circumstances so dictate
// (per the obiter in Abdul Waffiy bin Wahubbi & Anor v A K Nazaruddi bin Ahmad
// [2017] 2 PIR 1). Awards must be supported by medical evidence. The principle of
// overlapping injuries applies where injuries overlap.

export interface CompendiumItem {
  injury: string;
  low: number;
  high: number | null;
  notes?: string;
}

export type CompendiumGroup =
  | "Orthopaedic Injuries"
  | "Internal Injuries"
  | "External Injuries"
  | "Miscellaneous Conditions";

export interface CompendiumCategory {
  slug: string;
  name: string;
  group: CompendiumGroup;
  description: string;
  items: CompendiumItem[];
  factors?: string[];
  note?: string;
}

export interface CompendiumMeta {
  title: string;
  source: string;
  approvedBy: string;
  effectiveYear: number;
  currency: string;
  guideline: string;
  leadingCase: string;
  overlapPrinciple: string;
}

export const compendiumMeta: CompendiumMeta = {
  title: "Revised Compendium of Personal Injury Awards",
  source:
    "Bar Council Malaysia — Circular No 255/2018 (16 Oct 2018); Task Force to Review the Compendium of Personal Injury Awards (6 July 2018)",
  approvedBy:
    "Agreed by the Judiciary (Registrar of the High Court of Malaya, letter dated 4 Oct 2018)",
  effectiveYear: 2018,
  currency: "RM",
  guideline:
    "A guideline and quick reference only — it does not fetter the court's discretion. Parties may submit above or below the stipulated quantum where case law or factual circumstances so dictate, supported by medical evidence.",
  leadingCase:
    "Abdul Waffiy bin Wahubbi & Anor v A K Nazaruddi bin Ahmad [2017] 2 PIR 1 — courts should endeavour to award within the Compendium range and counsel must guide the court accordingly; compelling medical evidence is needed to depart from it.",
  overlapPrinciple:
    "Where injuries (external or internal) overlap, the principle of overlapping injuries applies — awards are not simply added up. As a rule of thumb, no award should exceed that for an above-knee amputation unless the disability is worse than amputation.",
};

const AGE_SEX_MARRIAGE_FACTORS = [
  "Age of the plaintiff (infant, young person, middle-aged, or in the prime of life)",
  "Whether the plaintiff is male or female",
  "Whether the plaintiff is married or unmarried, and whether the injuries would affect prospects of marriage",
];

export const compendium: CompendiumCategory[] = [
  // ─── ORTHOPAEDIC INJURIES ──────────────────────────────────────────────────
  {
    slug: "skull",
    name: "Skull (Cranium)",
    group: "Orthopaedic Injuries",
    description:
      "The skull protects the brain. Different areas attract similar quanta as the pain from a fracture is comparable. A shattered skull requiring removal of fragments and replacement with an artificial substance (cranioplasty) attracts a higher figure.",
    items: [
      {
        injury:
          "Parietal / Temporal / Frontal / Occipital / Sphenoid bone or base of skull and other related fractures",
        low: 12000,
        high: 18000,
      },
      {
        injury: "Any of these fractures requiring a cranioplasty",
        low: 18000,
        high: 30000,
      },
      { injury: "Mastoid and/or styloid processes", low: 9000, high: 14000 },
    ],
    factors: [...AGE_SEX_MARRIAGE_FACTORS, "Whether the injuries would affect head asymmetry"],
  },
  {
    slug: "facial-bones",
    name: "Facial Bones",
    group: "Orthopaedic Injuries",
    description:
      "Facial bones are often referred to in groups or 'complexes' (e.g. the zygomatic complex includes the zygoma, orbit and part of the maxilla). Facial fractures give rise to much overlap in awards. A bilateral fracture affects both sides of the facial asymmetry.",
    items: [
      { injury: "Mandible", low: 14500, high: 30000 },
      { injury: "Maxilla, Le Fort I, II, or III", low: 14500, high: 30000 },
      { injury: "Zygoma", low: 9000, high: 12000 },
      { injury: "Orbit", low: 7000, high: 9500 },
      { injury: "Alveolus", low: 7000, high: 9500 },
      { injury: "Nasal Bone", low: 7000, high: 12000 },
    ],
    factors: [...AGE_SEX_MARRIAGE_FACTORS, "The extent of facial distortion"],
  },
  {
    slug: "teeth",
    name: "Teeth",
    group: "Orthopaedic Injuries",
    description:
      "Teeth may be chipped, fractured, partially broken or lost. Dental work and cosmetic effects of losing front teeth are taken into account. The number and type of teeth (incisor, molar, pre-molar) lost affects the award, and extensive loss may attract an aggravated award for loss of the ability to chew.",
    items: [
      { injury: "Broken / Fractured tooth", low: 2500, high: 3000 },
      { injury: "Loss of tooth", low: 3000, high: 3500 },
      { injury: "1–5 teeth affected", low: 3000, high: 12000 },
      { injury: "5–10 teeth affected", low: 12000, high: 21500 },
      { injury: "10–20 teeth affected", low: 21500, high: 36000 },
    ],
    factors: [...AGE_SEX_MARRIAGE_FACTORS, "Whether the loss of teeth would affect facial asymmetry"],
  },
  {
    slug: "clavicle-shoulder",
    name: "Clavicle and Shoulder",
    group: "Orthopaedic Injuries",
    description:
      "The clavicle (collar bone) and scapula (shoulder bone) generally heal with insignificant disability. The most common sequela of a fractured clavicle is overlapping of the fractured ends causing some shortening and slight difficulty lifting the arm overhead.",
    items: [
      { injury: "Scapula", low: 12000, high: 21500 },
      { injury: "Clavicle", low: 13000, high: 28000 },
      { injury: "Dislocation of acromio-clavicular joint", low: 12000, high: 21500 },
    ],
    factors: [
      "Whether the plaintiff is male or female",
      "Whether the injuries would affect upper body asymmetry",
      "Whether there is any shortening",
      "Whether the injuries would affect the nature of the plaintiff's work or employment",
    ],
  },
  {
    slug: "arm",
    name: "Arm in General",
    group: "Orthopaedic Injuries",
    description:
      "The arm comprises the upper arm (humerus), lower arm (radius and ulna) and the hand (carpals, metacarpals and phalanges). Loss of amenities is significant given reliance on finger dexterity, especially the dominant arm. Modern treatment uses internal fixation with titanium screws/plates.",
    items: [
      { injury: "Humerus", low: 12000, high: 27500 },
      { injury: "Olecranon", low: 12000, high: 30000 },
      { injury: "Radius", low: 12000, high: 30000 },
      { injury: "Ulna", low: 9500, high: 27500 },
      { injury: "Radius and ulna", low: 21500, high: 36000 },
      { injury: "Carpal (scaphoid / lunate / pisiform)", low: 5000, high: 8500 },
      { injury: "Metacarpal (hand)", low: 4000, high: 6000 },
      { injury: "Phalange (finger)", low: 4000, high: 14500 },
    ],
    factors: [
      ...AGE_SEX_MARRIAGE_FACTORS,
      "Whether the injuries would affect body asymmetry",
      "Whether the injuries would affect the nature of the plaintiff's work or employment",
    ],
  },
  {
    slug: "amputations-arm",
    name: "Amputations of Arm",
    group: "Orthopaedic Injuries",
    description:
      "Amputations attract awards proportional to the number of joints lost, given the hand's paramount importance. An amputation at the wrist is almost as devastating as through the upper arm; a shoulder amputation attracts the higher end as prosthesis fitting is very difficult.",
    items: [
      { injury: "Amputation of any 1 finger at proximal phalange", low: 12000, high: 18500 },
      { injury: "Amputation of any 1 finger at distal phalange", low: 9500, high: 12000 },
      { injury: "Amputation of middle and ring fingers at proximal phalange", low: 21500, high: 24000 },
      { injury: "Amputation of middle and ring fingers at distal phalanges", low: 14500, high: 17000 },
      { injury: "Amputation of 3–4 fingers", low: 24000, high: 36000 },
      { injury: "Amputation of thumb at proximal phalange", low: 18000, high: 24000 },
      { injury: "Amputation of thumb at distal phalange", low: 14500, high: 18000 },
      { injury: "Amputation of all fingers and thumb", low: 36000, high: 55000 },
      { injury: "Amputation of whole hand at wrist joint", low: 41500, high: 60000 },
      { injury: "Amputation through elbow joint", low: 55000, high: 60000 },
      { injury: "Amputation at mid upper arm level", low: 71500, high: 84000 },
      { injury: "Amputation at shoulder", low: 90000, high: 95000 },
    ],
    factors: [
      ...AGE_SEX_MARRIAGE_FACTORS,
      "Whether the amputation would affect body asymmetry",
      "Whether the amputation would affect the nature of work or employment",
      "Whether the amputation in a female plaintiff would affect her ability to perform household chores",
    ],
  },
  {
    slug: "rib-cage",
    name: "Rib Cage",
    group: "Orthopaedic Injuries",
    description:
      "Ribs protect the thorax. Treatment is usually conservative (binding for ~3 weeks). A fractured rib may puncture a lung, requiring surgery and re-inflation. Multiple rib fractures involve a degree of overlapping in the award.",
    items: [
      { injury: "Per rib", low: 4000, high: 5000 },
      { injury: "Sternum", low: 9500, high: 12000 },
    ],
    factors: [
      "Age of the plaintiff",
      "Whether the injuries would affect the plaintiff's normal breathing",
    ],
  },
  {
    slug: "pelvis",
    name: "Pelvis",
    group: "Orthopaedic Injuries",
    description:
      "The pelvis comprises the iliac wings and pubic rami, joined by the sacrum and pubic symphysis, with the femur attaching via the acetabulum (hip joint). Severe disruption may cause a pelvic 'tilt' affecting gait, or affect child-bearing in a female.",
    items: [
      { injury: "Iliac crescent", low: 9500, high: 14500 },
      { injury: "Sacro-iliac joint", low: 9500, high: 12000 },
      { injury: "Superior or inferior pubic rami", low: 14500, high: 21500 },
      { injury: "Diasthesis symphysis pubis", low: 12000, high: 24000 },
      { injury: "Bilateral fractures of iliac / pubic rami", low: 18000, high: 30000 },
      { injury: "Sacrum", low: 12000, high: 14500 },
      { injury: "Acetabulum", low: 24000, high: 35500 },
      { injury: "Multiple hip fractures with hip disabilities", low: 43000, high: 72500 },
      { injury: "Hip dislocation with disabilities (minor–major)", low: 15000, high: 40000 },
    ],
    factors: [
      "Whether the injuries would affect the waist asymmetry of a female plaintiff",
      "Whether the injuries would affect child birth of a biologically active female",
      "The age of the female plaintiff and whether she has passed child-bearing age",
    ],
  },
  {
    slug: "leg",
    name: "Leg in General",
    group: "Orthopaedic Injuries",
    description:
      "The leg comprises the femur (longest bone), patella, tibia and fibula, and the foot (tarsals, metatarsals, phalanges). Long bones are usually treated by internal fixation. Shortening, restriction of joint movement and torn knee ligaments (instability) are the main sequelae.",
    items: [
      { injury: "Femur", low: 21500, high: 48500 },
      { injury: "Patella", low: 14500, high: 18500 },
      { injury: "Knee ligaments (anterior / posterior cruciate)", low: 18000, high: 30000 },
      { injury: "Tibia (simple fracture)", low: 18000, high: 30000 },
      { injury: "Fibula", low: 12000, high: 14500 },
      { injury: "Tibia and fibula", low: 21500, high: 42000 },
      { injury: "Femur / tibia and fibula (with shortening)", low: 36000, high: 60000 },
      { injury: "Femur (with shortening)", low: 36000, high: 60000 },
      { injury: "Tibia and fibula (with shortening)", low: 36000, high: 60000 },
      { injury: "Medial / lateral malleoli", low: 14500, high: 26500 },
      { injury: "Tarsal (navicular, cuneiform, cuboid)", low: 9500, high: 14500 },
      { injury: "Metatarsal", low: 7000, high: 12000 },
      { injury: "Phalange", low: 4000, high: 7000 },
      { injury: "Calcaneum", low: 12000, high: 18000 },
      { injury: "Loss of heel pad", low: 12000, high: 30000 },
    ],
    factors: [
      ...AGE_SEX_MARRIAGE_FACTORS,
      "Whether the injuries would affect lower-limb asymmetry",
      "The type of fracture",
      "The extent of shortening",
      "Whether the injuries would affect the squatting activities of an active sportsperson",
    ],
    note: "Awards adjust for the degree of disability and do not simply add up (overlapping applies). As a rule of thumb, no award should exceed that for an above-knee amputation save in exceptional circumstances.",
  },
  {
    slug: "amputations-leg",
    name: "Amputations of Leg / Legs",
    group: "Orthopaedic Injuries",
    description:
      "Amputation awards for one leg and for both legs, from toes through to amputation at the hip.",
    items: [
      { injury: "Big toe", low: 12000, high: 14500, notes: "One leg" },
      { injury: "Little toe", low: 7000, high: 9500, notes: "One leg" },
      { injury: "2–4 toes", low: 14500, high: 30000, notes: "One leg" },
      { injury: "All toes", low: 21500, high: 36500, notes: "One leg" },
      { injury: "Foot", low: 30000, high: 48500, notes: "One leg" },
      { injury: "At ankle", low: 55000, high: 60500, notes: "One leg" },
      { injury: "Below knee", low: 66500, high: 79000, notes: "One leg" },
      { injury: "Through knee", low: 79000, high: 84000, notes: "One leg" },
      { injury: "Above knee", low: 84000, high: 90000, notes: "One leg" },
      { injury: "At hip", low: 120000, high: 145000, notes: "One leg" },
      { injury: "At ankle", low: 110000, high: 120000, notes: "Both legs" },
      { injury: "Below knee", low: 130000, high: 142000, notes: "Both legs" },
      { injury: "Through knee", low: 150000, high: 165000, notes: "Both legs" },
      { injury: "Above knee", low: 175000, high: 195000, notes: "Both legs" },
      { injury: "At hip", low: 255000, high: 310000, notes: "Both legs" },
    ],
    factors: [
      ...AGE_SEX_MARRIAGE_FACTORS,
      "Whether the amputation would affect body asymmetry",
      "Whether the amputation would affect the nature of work or employment",
      "Whether the amputation in a female plaintiff would affect her ability to perform household chores",
    ],
  },
  {
    slug: "spinal-nerve",
    name: "Spinal / Nerve Injuries",
    group: "Orthopaedic Injuries",
    description:
      "The spinal column runs from the base of the skull to the coccyx (cervical C1–C7, thoracic T1–T12, lumbar L1–L5). Damage to the spinal cord causes paralysis below the level of trauma (Grade 5 = full power; Grade 0 = complete paralysis). Brachial plexus injury affects the nerves to the arm without cord damage.",
    items: [
      { injury: "Simple fracture of the body of a vertebra (wedge / compression)", low: 14500, high: 18000 },
      { injury: "Fractures of 2–5 vertebrae", low: 22000, high: 42000 },
      { injury: "Fractures of vertebra causing restriction of movement of neck or back", low: 22000, high: 42000 },
      { injury: "Fracture of the vertebra causing quadraplegia", low: 300000, high: 420000 },
      { injury: "Fracture of the vertebra causing paraplegia", low: 220000, high: 300000 },
      { injury: "Brachial plexus injury to upper limb", low: 50000, high: 80000 },
      { injury: "Whiplash injury", low: 9000, high: 14500 },
      { injury: "Sympathetic dystrophy (single–multiple)", low: 3000, high: 8000 },
    ],
    factors: [
      ...AGE_SEX_MARRIAGE_FACTORS,
      "Whether the injuries would affect overall body asymmetry",
      "Whether the injuries would affect the nature of work or employment",
    ],
  },
  // ─── INTERNAL INJURIES ─────────────────────────────────────────────────────
  {
    slug: "brain",
    name: "Brain",
    group: "Internal Injuries",
    description:
      "Brain injuries are caused by blunt or velocity-related trauma and are among the hardest to quantify due to the subjective range of sequelae (personality change, memory and intellectual impairment, paralysis, vegetative state). When assessing multiple neurological disabilities, there should be ONE global award reflecting overlapping functions.",
    items: [
      { injury: "Cerebral concussion / loss of consciousness", low: 6000, high: null },
      { injury: "Sub-dural haematoma with burr-hole craniotomy", low: 18000, high: 30000 },
      { injury: "Mild personality or behavioural changes", low: 24000, high: 48500 },
      { injury: "Memory impairment", low: 24000, high: 55000 },
      { injury: "Intellectual impairment", low: 60000, high: 180000 },
      { injury: "Motor impairment — paralysis on one side of body (hemiplegia)", low: 48000, high: 80000 },
      { injury: "Bedridden state with awareness", low: 300000, high: 420000 },
      { injury: "Persistent vegetative state (coma)", low: 180000, high: 240000 },
    ],
    factors: [
      ...AGE_SEX_MARRIAGE_FACTORS,
      "Whether the injuries would affect overall intellectual / mental capacity",
      "Whether the injuries would affect the nature of work or employment",
    ],
    note: "Multiple neurological disabilities attract ONE global award (loss of memory, behavioural/personality change, intellectual impairment), not separate cumulative awards.",
  },
  {
    slug: "eyes",
    name: "Eyes",
    group: "Internal Injuries",
    description:
      "Eye damage may arise from a brain injury affecting the optic nerve or direct traumatic impact. Enucleation is complete removal of the eyeball. A specialist's report stating the percentage loss of vision is a good guideline for the award.",
    items: [
      { injury: "Haematoma in 1 eye", low: 3000, high: 4000 },
      { injury: "Haematoma in both eyes", low: 3500, high: 4500 },
      { injury: "Loss of peripheral vision", low: 12000, high: 24000 },
      { injury: "Diplopia (double vision)", low: 12000, high: 24000 },
      { injury: "Traumatic cataract", low: 6000, high: 9500 },
      { injury: "20%–50% loss of vision in 1 eye", low: 24000, high: 36000 },
      { injury: "20%–50% loss of vision in both eyes", low: 42000, high: 85000 },
      { injury: "50%–80% loss of vision in 1 eye", low: 30000, high: 72000 },
      { injury: "50%–80% loss of vision in both eyes", low: 60000, high: 145000 },
      { injury: "Blindness in 1 eye", low: 84000, high: 90000 },
      { injury: "Blindness in both eyes", low: 210000, high: 220000 },
      { injury: "Loss of eye", low: 90000, high: 100000 },
      { injury: "Loss of both eyes", low: 220000, high: 230000 },
    ],
    factors: [
      ...AGE_SEX_MARRIAGE_FACTORS,
      "Whether the injuries would affect overall facial asymmetry",
      "Whether the injuries would affect the nature of work or employment",
    ],
  },
  {
    slug: "ears-hearing",
    name: "Ears / Hearing",
    group: "Internal Injuries",
    description:
      "Ear damage may be caused by impact or nerve damage. The tympanic membrane may be perforated, or the cochlea affected, causing varying deafness. Tinnitus is a constant 'ringing' in the ear.",
    items: [
      { injury: "Ear ripped off", low: 6000, high: 18000 },
      { injury: "Tinnitus", low: 12000, high: 24000 },
      { injury: "Partial loss of hearing in 1 ear", low: 12000, high: 30000 },
      { injury: "Partial loss of hearing in both ears", low: 36000, high: 55000 },
      { injury: "Complete loss of hearing in 1 ear", low: 42000, high: 48500 },
      { injury: "Complete loss of hearing in both ears", low: 110000, high: 120000 },
    ],
    factors: [
      ...AGE_SEX_MARRIAGE_FACTORS,
      "Whether the injuries would affect overall facial asymmetry",
      "Whether the injuries would affect the nature of work or employment",
    ],
  },
  {
    slug: "smell-taste",
    name: "Sense of Smell / Taste",
    group: "Internal Injuries",
    description:
      "Loss of smell (olfactory nerve) or taste (9th cranial nerve) usually results from head trauma and may be complete or partial. The award reflects the loss of the amenity of enjoying food and pleasant odours.",
    items: [
      { injury: "Complete loss of sense of smell", low: 42000, high: 48500 },
      { injury: "Complete loss of sense of taste", low: 42000, high: 48500 },
      { injury: "Partial loss of sense of smell", low: 12000, high: 36500 },
      { injury: "Partial loss of sense of taste", low: 12000, high: 36500 },
    ],
    factors: [...AGE_SEX_MARRIAGE_FACTORS, "Whether the injuries would affect the nature of work or employment"],
  },
  {
    slug: "larynx",
    name: "Voice Box (Larynx)",
    group: "Internal Injuries",
    description:
      "The larynx sits at the upper end of the trachea. Neck trauma may cause a hoarse or soft voice, or total loss of speech. The type of victim matters (an opera singer suffers a greater loss of amenities than a bus conductor).",
    items: [
      { injury: "Hoarseness", low: 12000, high: 30000 },
      { injury: "Whisper", low: 24000, high: 42000 },
      { injury: "Loss of voice", low: 96500, high: 145000 },
    ],
    factors: [...AGE_SEX_MARRIAGE_FACTORS, "Whether the injuries would affect the nature of work or employment"],
  },
  {
    slug: "lungs",
    name: "Lungs",
    group: "Internal Injuries",
    description:
      "The lungs are surrounded by the pleura and separated from the abdomen by the diaphragm. Lung damage is associated with chest trauma, a rib puncturing a lobe, and haemopneumothorax (blood and gas in the pleural cavity).",
    items: [
      { injury: "Collapse of lung (puncture)", low: 6000, high: 7500 },
      { injury: "Diaphragm damage", low: 18000, high: 22000 },
      { injury: "Haemopneumothorax", low: 6000, high: 7500 },
    ],
    factors: [
      ...AGE_SEX_MARRIAGE_FACTORS,
      "Whether the injuries would affect normal breathing",
      "Whether the injuries would affect the nature of work or employment",
    ],
  },
  {
    slug: "abdomen",
    name: "Abdomen",
    group: "Internal Injuries",
    description:
      "The abdomen houses the digestive and excretory organs. A laporotomy is the operation to investigate abdominal trauma. Effects range from minimal (splenectomy) to devastating (nephrectomy requiring lifelong dialysis, or a permanent colostomy bag).",
    items: [
      { injury: "Laporotomy", low: 9500, high: 12000 },
      { injury: "Removal of spleen", low: 12000, high: 14500 },
      { injury: "Removal of 1 kidney", low: 36000, high: 42000 },
      { injury: "Removal of 2 kidneys", low: 120000, high: 145000 },
      { injury: "Removal of part of liver", low: 18000, high: 30000 },
      { injury: "Removal of portion of small intestine", low: 18000, high: 48500 },
      { injury: "Removal of portion of colon", low: 24000, high: 48500 },
      { injury: "Bladder rupture", low: 18000, high: 24000 },
      { injury: "Rupture of ureter / urethra", low: 12000, high: 18000 },
      { injury: "Liver laceration", low: 12000, high: 18000 },
    ],
    factors: [...AGE_SEX_MARRIAGE_FACTORS],
  },
  {
    slug: "sexual-organs",
    name: "Sexual Organs",
    group: "Internal Injuries",
    description:
      "Fully functional sex organs matter more the younger the victim, especially in the child-bearing age. In males, paraplegia often results in impotency, which is taken into account in that injury's award.",
    items: [
      { injury: "Erectile dysfunction", low: 24000, high: 60000 },
      { injury: "Loss of one testicle", low: 18000, high: 30000 },
      { injury: "Loss of both testicles / complete impotency", low: 71500, high: 97000 },
      { injury: "Laceration of scrotum / perineum", low: 7000, high: 9500 },
      { injury: "Amputation of penis", low: 71500, high: 97000 },
      { injury: "Loss of an ovary", low: 18000, high: 48500 },
      { injury: "Loss of both ovaries", low: 71500, high: 97000 },
    ],
    factors: [...AGE_SEX_MARRIAGE_FACTORS, "If married, the number of surviving children"],
  },
  // ─── EXTERNAL INJURIES ─────────────────────────────────────────────────────
  {
    slug: "external",
    name: "External Injuries",
    group: "External Injuries",
    description:
      "External injuries affect the skin — soft tissue injuries, lacerations, haematomas, degloving (skin ripped off like a glove), skin grafts, abrasions and scarring. Cosmetic effect, disfigurement, keloid propensity and the pain of reconstructive surgery all bear on the award; loss of amenities is increased for those whose appearance is part of their livelihood (e.g. an actress or model).",
    items: [
      { injury: "Degloving injury to leg", low: 12000, high: 24000 },
      { injury: "Degloving injury to arm", low: 14500, high: 30000 },
      { injury: "Lacerations (single to multiple)", low: 2500, high: 9500 },
      { injury: "Abrasions (single to multiple)", low: 1300, high: 5000 },
      { injury: "Minor scarring to leg", low: 1300, high: 3300 },
      { injury: "Minor scarring to arm", low: 2200, high: 3850 },
      { injury: "Extensive scarring to leg", low: 9500, high: 18000 },
      { injury: "Extensive scarring to arm", low: 12000, high: 24000 },
      { injury: "Facial scarring", low: 6000, high: 36500 },
      { injury: "Operation scars", low: 2750, high: 12000 },
      { injury: "Haematoma / contusion", low: 1200, high: 2500 },
      { injury: "Skin grafting", low: 12000, high: 30000 },
      { injury: "Lip laceration", low: 1000, high: 3000 },
      { injury: "Avulsion of fingernails (1–2)", low: 1500, high: 2000 },
      { injury: "Avulsion of fingernails (3–5)", low: 3000, high: 5000 },
      { injury: "Avulsion of toe nails (1–2)", low: 1000, high: 2000 },
      { injury: "Avulsion of toe nails (3–5)", low: 3000, high: 5000 },
    ],
    factors: [
      ...AGE_SEX_MARRIAGE_FACTORS,
      "Whether the injuries would affect overall body asymmetry",
      "The sensitivity of the plaintiff in relation to the injuries",
      "Whether the plaintiff is a sportsperson",
    ],
  },
  // ─── MISCELLANEOUS CONDITIONS ──────────────────────────────────────────────
  {
    slug: "miscellaneous",
    name: "Miscellaneous Conditions",
    group: "Miscellaneous Conditions",
    description:
      "Conditions that may arise as sequelae of injury, including psychiatric conditions and burns. For burns, the award is decided based on the degree of burn and the Total Body Surface Area (TBSA) affected.",
    items: [
      { injury: "Osteoarthritis", low: 5000, high: null },
      { injury: "Osteomyelitis", low: 3000, high: 8000 },
      { injury: "Soft tissue injury", low: 3000, high: 5000 },
      { injury: "Muscle wasting", low: 3000, high: 5000 },
      { injury: "Fat embolism syndrome", low: 5000, high: null },
      { injury: "Depression (mild–major)", low: 5000, high: 25000 },
      { injury: "Post-traumatic stress disorder", low: 15000, high: null },
      { injury: "Retrograde amnesia", low: 1000, high: 3000 },
      { injury: "Tendon / muscle cut", low: 8000, high: 10000 },
      { injury: "Burn injury up to 30% of TBSA", low: 3000, high: 45000 },
      { injury: "Burn injury up to 60% of TBSA", low: 45000, high: 100000 },
      { injury: "Burn injury up to 90% of TBSA", low: 100000, high: 200000 },
    ],
    note: "Burns: award decided by Degree of Burn and TBSA (Total Body Surface Area). Percentage refers to the area of burn over body surface.",
  },
];

const fmt = (n: number) => `RM${n.toLocaleString("en-MY")}`;

/** Format a single item's range as a display string, e.g. "RM12,000–RM18,000" or "RM6,000 (fixed)". */
export function formatRange(item: Pick<CompendiumItem, "low" | "high">): string {
  return item.high == null ? `${fmt(item.low)} (fixed)` : `${fmt(item.low)}–${fmt(item.high)}`;
}

/**
 * Condensed plain-text reference of every quantum range, for injecting into the
 * AI quantum prompt so the model cites EXACT Compendium figures rather than
 * relying on its training memory. Generated from `compendium` so it never drifts.
 */
export function compendiumReferenceText(): string {
  const lines: string[] = [
    `REVISED COMPENDIUM OF PERSONAL INJURY AWARDS (Bar Council Malaysia, 2018) — exact guideline ranges (general damages, RM). Source: ${compendiumMeta.source}.`,
    `These are GUIDELINE ranges only and do not fetter the court's discretion (${compendiumMeta.leadingCase.split(" — ")[0]}). Overlapping injuries are not simply added up.`,
    "",
  ];
  for (const cat of compendium) {
    lines.push(`### ${cat.name} (${cat.group})`);
    for (const item of cat.items) {
      const note = item.notes ? ` [${item.notes}]` : "";
      lines.push(`- ${item.injury}${note}: ${formatRange(item)}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
