export type DiscType = "D" | "I" | "S" | "C";

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  avatarColor: string;
  status: "Completed" | "Pending" | "In Progress" | "Not Started";
  disc: DiscType | null;
  scores: { D: number; I: number; S: number; C: number } | null;
  lastAssessment: string | null;
}

const DEPARTMENTS = [
  "Engineering",
  "Product",
  "Design",
  "Marketing",
  "Sales",
  "People Ops",
  "Finance",
  "Customer Success",
];

const POSITIONS = [
  "Senior Engineer",
  "Product Manager",
  "Design Lead",
  "Growth Marketer",
  "Account Executive",
  "Talent Partner",
  "Financial Analyst",
  "CS Manager",
  "Staff Engineer",
  "UX Researcher",
];

const FIRST = [
  "Ava",
  "Liam",
  "Sophia",
  "Noah",
  "Isabella",
  "Ethan",
  "Mia",
  "Lucas",
  "Amelia",
  "Mason",
  "Harper",
  "Elijah",
  "Evelyn",
  "James",
  "Charlotte",
  "Oliver",
  "Aria",
  "Benjamin",
  "Layla",
  "Henry",
  "Zoe",
  "Daniel",
  "Priya",
  "Kai",
  "Yuki",
  "Rohan",
  "Sara",
  "Marco",
  "Chen",
  "Nadia",
];
const LAST = [
  "Chen",
  "Patel",
  "Kim",
  "Garcia",
  "Nguyen",
  "Rossi",
  "Silva",
  "Ahmed",
  "Ivanov",
  "Okafor",
  "Kowalski",
  "Bianchi",
  "Novak",
  "Yamamoto",
  "Fischer",
  "Martin",
  "Dupont",
  "Andersen",
];

const COLORS = [
  "oklch(0.7 0.15 25)",
  "oklch(0.7 0.15 75)",
  "oklch(0.7 0.15 155)",
  "oklch(0.7 0.15 258)",
  "oklch(0.7 0.15 300)",
  "oklch(0.7 0.15 200)",
];

function rand(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function pick<T>(arr: T[], seed: number) {
  return arr[Math.floor(rand(seed) * arr.length)];
}

function discFromScores(s: { D: number; I: number; S: number; C: number }): DiscType {
  return (Object.entries(s).sort((a, b) => b[1] - a[1])[0][0] as DiscType);
}

export const employees: Employee[] = Array.from({ length: 42 }).map((_, i) => {
  const first = pick(FIRST, i + 1);
  const last = pick(LAST, i + 7);
  const name = `${first} ${last}`;
  const department = pick(DEPARTMENTS, i + 3);
  const position = pick(POSITIONS, i + 11);
  const statusRoll = rand(i + 17);
  const status: Employee["status"] =
    statusRoll > 0.75
      ? "Pending"
      : statusRoll > 0.6
      ? "In Progress"
      : statusRoll > 0.15
      ? "Completed"
      : "Not Started";
  const hasScore = status === "Completed" || status === "In Progress";
  const scores = hasScore
    ? {
        D: Math.round(30 + rand(i + 21) * 65),
        I: Math.round(30 + rand(i + 29) * 65),
        S: Math.round(30 + rand(i + 37) * 65),
        C: Math.round(30 + rand(i + 43) * 65),
      }
    : null;
  const disc = scores ? discFromScores(scores) : null;
  const lastAssessment =
    status === "Completed"
      ? new Date(2026, 5 + Math.floor(rand(i + 51) * 2), 1 + Math.floor(rand(i + 59) * 28))
          .toISOString()
          .slice(0, 10)
      : null;

  return {
    id: `EMP-${1000 + i}`,
    name,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@acme.com`,
    department,
    position,
    avatarColor: COLORS[i % COLORS.length],
    status,
    disc,
    scores,
    lastAssessment,
  };
});

export const dashboardStats = {
  totalEmployees: employees.length,
  completed: employees.filter((e) => e.status === "Completed").length,
  pending: employees.filter((e) => e.status === "Pending" || e.status === "In Progress").length,
  averageScore: 76,
};

export const completionTrend = [
  { month: "Jan", completed: 12, invited: 18 },
  { month: "Feb", completed: 18, invited: 24 },
  { month: "Mar", completed: 22, invited: 28 },
  { month: "Apr", completed: 26, invited: 32 },
  { month: "May", completed: 31, invited: 38 },
  { month: "Jun", completed: 35, invited: 42 },
  { month: "Jul", completed: 42, invited: 48 },
];

export const discDistribution = [
  { type: "D", label: "Dominance", value: 24, color: "var(--disc-d)" },
  { type: "I", label: "Influence", value: 31, color: "var(--disc-i)" },
  { type: "S", label: "Steadiness", value: 28, color: "var(--disc-s)" },
  { type: "C", label: "Conscientiousness", value: 17, color: "var(--disc-c)" },
];

export const monthlyAssessments = [
  { month: "Jan", count: 18 },
  { month: "Feb", count: 24 },
  { month: "Mar", count: 22 },
  { month: "Apr", count: 30 },
  { month: "May", count: 28 },
  { month: "Jun", count: 34 },
  { month: "Jul", count: 41 },
];

export const departmentBreakdown = [
  { department: "Engineering", D: 18, I: 22, S: 34, C: 26 },
  { department: "Product", D: 26, I: 28, S: 24, C: 22 },
  { department: "Design", D: 14, I: 38, S: 28, C: 20 },
  { department: "Marketing", D: 22, I: 42, S: 20, C: 16 },
  { department: "Sales", D: 38, I: 34, S: 18, C: 10 },
  { department: "People Ops", D: 12, I: 30, S: 40, C: 18 },
  { department: "Finance", D: 16, I: 14, S: 30, C: 40 },
];

export const recentActivity = [
  { id: 1, who: "Ava Chen", action: "completed", target: "Leadership DISC 2026", time: "12m ago" },
  { id: 2, who: "Liam Patel", action: "started", target: "Team Culture Fit", time: "48m ago" },
  { id: 3, who: "Sophia Kim", action: "was invited to", target: "Q3 Development Review", time: "2h ago" },
  { id: 4, who: "Noah Garcia", action: "downloaded", target: "Sales Team Report", time: "5h ago" },
  { id: 5, who: "Mia Silva", action: "completed", target: "Onboarding DISC", time: "1d ago" },
];

export const upcomingAssessments = [
  { id: "A-201", title: "Q3 Leadership Review", due: "Aug 12", assignees: 24 },
  { id: "A-202", title: "Engineering Team Culture", due: "Aug 18", assignees: 42 },
  { id: "A-203", title: "New Hires Onboarding", due: "Aug 21", assignees: 8 },
];

export const latestReports = [
  { id: "R-9012", name: "Ava Chen", type: "D" as DiscType, score: 84, date: "Jul 18" },
  { id: "R-9011", name: "Liam Patel", type: "C" as DiscType, score: 79, date: "Jul 17" },
  { id: "R-9010", name: "Sophia Kim", type: "I" as DiscType, score: 88, date: "Jul 16" },
  { id: "R-9009", name: "Noah Garcia", type: "S" as DiscType, score: 74, date: "Jul 15" },
];

export const questions = Array.from({ length: 24 }).map((_, i) => ({
  id: i + 1,
  text: [
    "I take charge in team meetings and drive decisions forward.",
    "I energize others through enthusiasm and open conversation.",
    "I prefer stable environments where I can support my teammates.",
    "I focus on accuracy, details, and doing things the right way.",
    "I set ambitious goals and push through obstacles to reach them.",
    "I build relationships easily and enjoy collaborating openly.",
    "I stay calm under pressure and help others feel at ease.",
    "I analyze data thoroughly before making decisions.",
  ][i % 8],
}));

export const discProfile = {
  scores: { D: 78, I: 62, S: 48, C: 71 },
  dominant: "D" as DiscType,
  summary:
    "You lead with decisive action and results orientation. You thrive on challenges, ambitious goals, and fast-paced environments. Your natural intensity is balanced by strong analytical rigor, which helps you make confident, data-informed decisions.",
  strengths: [
    "Decisive under pressure",
    "Goal-oriented and driven",
    "Comfortable with change",
    "Analytical decision-making",
    "Direct and confident communicator",
  ],
  weaknesses: [
    "May appear impatient",
    "Can overlook team emotional cues",
    "Prone to micromanaging details",
    "Struggles with ambiguity delays",
  ],
  communication: "Direct, results-focused, prefers concise updates with clear next steps.",
  leadership: "Visionary and demanding — sets high standards and expects accountability.",
  work: "Fast-paced, autonomous work with measurable outcomes and defined milestones.",
  stress: "Under stress, may become blunt and take on too much personally.",
  improvements: [
    "Practice active listening in 1:1s",
    "Delegate execution details to teammates",
    "Invest in emotional awareness routines",
    "Slow down during ambiguous decisions",
  ],
  recommendedRoles: ["VP of Operations", "Head of Sales", "Program Director", "Chief of Staff"],
  teamRoles: ["Driver", "Challenger", "Executor"],
};

export const historyItems = Array.from({ length: 8 }).map((_, i) => ({
  id: `HIS-${100 + i}`,
  employee: pick(employees, i + 3).name,
  date: `2026-0${((i % 6) + 1)}-${10 + i}`,
  disc: (["D", "I", "S", "C"] as DiscType[])[i % 4],
  score: 65 + Math.round(rand(i + 91) * 30),
  duration: `${10 + Math.round(rand(i + 61) * 15)} min`,
}));

export const analyticsHeatmap = DEPARTMENTS.slice(0, 6).map((d, i) => ({
  department: d,
  D: Math.round(20 + rand(i + 1) * 40),
  I: Math.round(20 + rand(i + 2) * 40),
  S: Math.round(20 + rand(i + 3) * 40),
  C: Math.round(20 + rand(i + 4) * 40),
}));

export const discColorClass: Record<DiscType, string> = {
  D: "bg-[var(--disc-d)]/10 text-[var(--disc-d)] border-[var(--disc-d)]/25",
  I: "bg-[var(--disc-i)]/15 text-[var(--disc-i)] border-[var(--disc-i)]/30",
  S: "bg-[var(--disc-s)]/10 text-[var(--disc-s)] border-[var(--disc-s)]/25",
  C: "bg-[var(--disc-c)]/10 text-[var(--disc-c)] border-[var(--disc-c)]/25",
};

export const discFullName: Record<DiscType, string> = {
  D: "Dominance",
  I: "Influence",
  S: "Steadiness",
  C: "Conscientiousness",
};
