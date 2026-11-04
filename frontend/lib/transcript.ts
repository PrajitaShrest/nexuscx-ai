// A sample academic transcript for the demo (Northbridge University is not real).
// Built from the course, the start date and the study load the student gave on the form.
// Marks are made up but always the same for the same student and unit.

type Unit = { code: string; name: string };

// Units in study order (4 a semester full-time)
const UNITS: Record<string, Unit[]> = {
  "Bachelor of Information Technology": [
    { code: "NIT101", name: "Introduction to Programming" }, { code: "NIT102", name: "Computer Systems" }, { code: "NIT103", name: "Web Fundamentals" }, { code: "NIT104", name: "Professional Communication in IT" },
    { code: "NIT111", name: "Object-Oriented Programming" }, { code: "NIT112", name: "Database Systems" }, { code: "NIT113", name: "Networks and Communications" }, { code: "NIT114", name: "Discrete Mathematics" },
    { code: "NIT201", name: "Data Structures and Algorithms" }, { code: "NIT202", name: "Systems Analysis and Design" }, { code: "NIT203", name: "Operating Systems" }, { code: "NIT204", name: "User Experience Design" },
    { code: "NIT211", name: "Cyber Security Fundamentals" }, { code: "NIT212", name: "Cloud Computing" }, { code: "NIT213", name: "Mobile App Development" }, { code: "NIT214", name: "Software Testing" },
    { code: "NIT301", name: "Artificial Intelligence" }, { code: "NIT302", name: "Project Management" }, { code: "NIT303", name: "IT Ethics and Law" }, { code: "NIT304", name: "Data Analytics" },
    { code: "NIT311", name: "Capstone Project A" }, { code: "NIT312", name: "Capstone Project B" }, { code: "NIT313", name: "Machine Learning" }, { code: "NIT314", name: "Industry Placement" },
  ],
  "Bachelor of Business": [
    { code: "NBS101", name: "Principles of Management" }, { code: "NBS102", name: "Accounting for Business" }, { code: "NBS103", name: "Microeconomics" }, { code: "NBS104", name: "Business Communication" },
    { code: "NBS111", name: "Marketing Principles" }, { code: "NBS112", name: "Macroeconomics" }, { code: "NBS113", name: "Business Statistics" }, { code: "NBS114", name: "Business Law" },
    { code: "NBS201", name: "Organisational Behaviour" }, { code: "NBS202", name: "Financial Management" }, { code: "NBS203", name: "Consumer Behaviour" }, { code: "NBS204", name: "Business Information Systems" },
    { code: "NBS211", name: "Human Resource Management" }, { code: "NBS212", name: "Operations Management" }, { code: "NBS213", name: "Digital Marketing" }, { code: "NBS214", name: "Business Analytics" },
    { code: "NBS301", name: "Strategic Management" }, { code: "NBS302", name: "International Business" }, { code: "NBS303", name: "Entrepreneurship and Innovation" }, { code: "NBS304", name: "Corporate Governance" },
    { code: "NBS311", name: "Business Capstone" }, { code: "NBS312", name: "Leadership and Change" }, { code: "NBS313", name: "Sustainability in Business" }, { code: "NBS314", name: "Work-Integrated Learning" },
  ],
  "Bachelor of Nursing": [
    { code: "NNU101", name: "Foundations of Nursing Practice" }, { code: "NNU102", name: "Human Anatomy and Physiology 1" }, { code: "NNU103", name: "Communication in Health Care" }, { code: "NNU104", name: "Health and Wellbeing" },
    { code: "NNU111", name: "Human Anatomy and Physiology 2" }, { code: "NNU112", name: "Clinical Skills 1" }, { code: "NNU113", name: "Aboriginal and Torres Strait Islander Health" }, { code: "NNU114", name: "Evidence-Based Practice" },
    { code: "NNU201", name: "Pharmacology for Nurses" }, { code: "NNU202", name: "Medical-Surgical Nursing 1" }, { code: "NNU203", name: "Mental Health Nursing" }, { code: "NNU204", name: "Clinical Placement 1" },
    { code: "NNU211", name: "Medical-Surgical Nursing 2" }, { code: "NNU212", name: "Maternal and Child Health" }, { code: "NNU213", name: "Aged Care Nursing" }, { code: "NNU214", name: "Clinical Placement 2" },
    { code: "NNU301", name: "Acute Care Nursing" }, { code: "NNU302", name: "Community and Primary Health" }, { code: "NNU303", name: "Ethics and Law in Nursing" }, { code: "NNU304", name: "Clinical Placement 3" },
    { code: "NNU311", name: "Leadership in Nursing" }, { code: "NNU312", name: "Complex Care" }, { code: "NNU313", name: "Transition to Practice" }, { code: "NNU314", name: "Clinical Placement 4" },
  ],
  "Diploma of Information Technology": [
    { code: "NDT101", name: "Programming Basics" }, { code: "NDT102", name: "IT Support Essentials" }, { code: "NDT103", name: "Web Design" }, { code: "NDT104", name: "Workplace Communication" },
    { code: "NDT111", name: "Database Basics" }, { code: "NDT112", name: "Networking Basics" }, { code: "NDT113", name: "Cyber Security Awareness" }, { code: "NDT114", name: "IT Project" },
  ],
  "Master of Information Technology": [
    { code: "NMT501", name: "Programming for IT Professionals" }, { code: "NMT502", name: "Enterprise Databases" }, { code: "NMT503", name: "Networking and Cloud" }, { code: "NMT504", name: "IT Project Management" },
    { code: "NMT511", name: "Cyber Security Management" }, { code: "NMT512", name: "Artificial Intelligence and Machine Learning" }, { code: "NMT513", name: "Systems Architecture" }, { code: "NMT514", name: "Research Methods in IT" },
    { code: "NMT601", name: "Data Science and Analytics" }, { code: "NMT602", name: "IT Governance and Ethics" }, { code: "NMT603", name: "Advanced Network Security" }, { code: "NMT604", name: "IT Project Part A" },
    { code: "NMT611", name: "Post-Quantum Cryptography" }, { code: "NMT612", name: "Digital Transformation" }, { code: "NMT613", name: "IT Capstone Project" }, { code: "NMT614", name: "IT Project Part B" },
  ],
  "Master of Business Administration": [
    { code: "NMB501", name: "Leading People" }, { code: "NMB502", name: "Accounting for Managers" }, { code: "NMB503", name: "Managerial Economics" }, { code: "NMB504", name: "Marketing Management" },
    { code: "NMB511", name: "Corporate Finance" }, { code: "NMB512", name: "Operations and Supply Chain" }, { code: "NMB513", name: "Business Analytics for Decisions" }, { code: "NMB514", name: "Ethics and Sustainability" },
    { code: "NMB601", name: "Strategy" }, { code: "NMB602", name: "Innovation and Entrepreneurship" }, { code: "NMB603", name: "Negotiation" }, { code: "NMB604", name: "Global Business" },
    { code: "NMB611", name: "Change Leadership" }, { code: "NMB612", name: "Digital Business" }, { code: "NMB613", name: "Consulting Project" }, { code: "NMB614", name: "MBA Capstone" },
  ],
};

export type TranscriptRow = Unit & { mark: number | null; grade: string; points: number };
export type TranscriptTerm = { label: string; rows: TranscriptRow[]; current: boolean };
export type Transcript = { terms: TranscriptTerm[]; creditDone: number; creditTotal: number; gpa: number | null; wam: number | null; status: string };

const gradeFor = (m: number) => (m >= 85 ? ["HD", 7] : m >= 75 ? ["D", 6] : m >= 65 ? ["C", 5] : m >= 50 ? ["P", 4] : ["N", 0]) as [string, number];

// Same number every time for the same text (so the transcript never changes between views)
function seeded(text: string) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  // spread similar inputs apart (MurmurHash3 finaliser)
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

export function buildTranscript(course: string, intake: string, load: string, studentNumber: string, today = new Date()): Transcript | null {
  const units = UNITS[course];
  const [month, y] = intake.split(" ");
  if (!units || !y) return null;
  const perTerm = load === "Part-time" ? 2 : 4;
  let year = Number(y);
  let sem = month === "July" ? 2 : 1;
  const terms: TranscriptTerm[] = [];
  let creditDone = 0, points = 0, marks = 0, graded = 0;

  for (let i = 0; i < units.length; i += perTerm) {
    // Semester 1 ends 30 June, semester 2 ends 30 November
    const ends = new Date(year, sem === 1 ? 5 : 10, 30);
    const starts = new Date(year, sem === 1 ? 1 : 6, 20);
    if (starts > today) break;
    const current = ends >= today;
    const rows = units.slice(i, i + perTerm).map((u) => {
      if (current) return { ...u, mark: null, grade: "Enrolled", points: 10 };
      const mark = Math.round(58 + seeded(studentNumber + u.code) * 38);
      const [grade, gp] = gradeFor(mark);
      creditDone += 10; points += gp; marks += mark; graded += 1;
      return { ...u, mark, grade, points: 10 };
    });
    terms.push({ label: `Semester ${sem}, ${year}`, rows, current });
    if (sem === 1) sem = 2; else { sem = 1; year += 1; }
  }
  const creditTotal = units.length * 10;
  return {
    terms, creditDone, creditTotal,
    gpa: graded ? Math.round((points / graded) * 100) / 100 : null,
    wam: graded ? Math.round((marks / graded) * 10) / 10 : null,
    status: creditDone >= creditTotal ? "Course completed" : "Currently enrolled",
  };
}
