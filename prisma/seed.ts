import { PrismaClient, Difficulty } from "@prisma/client";

const prisma = new PrismaClient();

const canonicalProfiles: Array<{
  slug: string;
  name: string;
  avatar: string;
  difficulty: Difficulty;
  sortOrder: number;
  context: string;
  scenario: string;
  clues: string[];
  answerDR: "Surface" | "Intermediate" | "Deep" | "Meta";
  answerSE: "Single" | "DualTrack" | "MultiTrack" | "Divergent";
  answerSR: "Rare" | "Selective" | "Regular" | "Constant";
  answerCV: "Deadline" | "Clarity" | "InfoExhaustion" | "Intuition";
}> = [
  {
    slug: "the-investor",
    name: "The Investor",
    avatar: "💼",
    difficulty: "EASY",
    sortOrder: 1,
    context: "Financial decision-making under uncertainty",
    scenario:
      "When I'm deciding whether to invest in something, I usually get a gut feeling pretty quickly. If it feels right, I go for it. Sometimes I'll ask a friend what they think, but mostly I trust my instincts. Life's too short to overthink everything.",
    clues: ["gut feeling pretty quickly", "trust my instincts", "life's too short to overthink"],
    answerDR: "Surface",
    answerSE: "Single",
    answerSR: "Rare",
    answerCV: "Intuition",
  },
  {
    slug: "the-deadline-runner",
    name: "The Deadline Runner",
    avatar: "⏰",
    difficulty: "EASY",
    sortOrder: 2,
    context: "Consumer decision under time pressure",
    scenario:
      "I had to pick a new laptop for work. I googled 'best laptops 2024', clicked the first article, saw the top pick was $999, and bought it that afternoon. My boss needed me up and running by Monday - I didn't have time to compare specs or read reviews.",
    clues: ["first article", "bought it that afternoon", "didn't have time to compare"],
    answerDR: "Surface",
    answerSE: "Single",
    answerSR: "Rare",
    answerCV: "Deadline",
  },
  {
    slug: "the-job-switcher",
    name: "The Job Switcher",
    avatar: "🧭",
    difficulty: "MEDIUM",
    sortOrder: 3,
    context: "Career decision with moderate stakes",
    scenario:
      "I was considering leaving my job. I made a pros/cons list, researched salary data on three different sites, and talked to two friends who'd made similar moves. I kept going back and forth until my partner said 'just decide already' - and that's when I finally committed.",
    clues: ["pros/cons list", "three different sites", "going back and forth", "finally committed when pushed"],
    answerDR: "Intermediate",
    answerSE: "DualTrack",
    answerSR: "Selective",
    answerCV: "Deadline",
  },
  {
    slug: "the-product-designer",
    name: "The Product Designer",
    avatar: "🎨",
    difficulty: "MEDIUM",
    sortOrder: 4,
    context: "Creative problem-solving workflow",
    scenario:
      "Before I design anything, I write down 5 different ways to solve the problem. Then I prototype the two most promising ones. I regularly ask myself mid-project: 'am I solving the right problem or just the obvious one?' Usually I spot at least one assumption I'd gotten wrong.",
    clues: ["5 different ways", "two most promising", "regularly ask myself", "spot assumptions"],
    answerDR: "Deep",
    answerSE: "MultiTrack",
    answerSR: "Regular",
    answerCV: "Clarity",
  },
  {
    slug: "the-conflict-avoider",
    name: "The Conflict Avoider",
    avatar: "🕊️",
    difficulty: "MEDIUM",
    sortOrder: 5,
    context: "Interpersonal conflict management",
    scenario:
      "When my roommate does something that bothers me, I usually wait to see if it happens again before saying anything. If it becomes a pattern, I'll mention it - but only after I've thought about whether I'm overreacting. I try not to bring things up until I'm sure it's a real issue.",
    clues: [
      "wait to see if it happens again",
      "only after I've thought about whether I'm overreacting",
      "sure it's a real issue",
    ],
    answerDR: "Intermediate",
    answerSE: "Single",
    answerSR: "Selective",
    answerCV: "Clarity",
  },
  {
    slug: "the-systems-philosopher",
    name: "The Systems Philosopher",
    avatar: "🔭",
    difficulty: "HARD",
    sortOrder: 6,
    context: "Abstract meta-cognitive processing",
    scenario:
      "Every decision I make, I try to trace back: what assumptions am I carrying that I didn't choose? I model how I model things - like, what are the meta-rules I'm using to evaluate my own rules? I never feel like I have enough information, but I eventually commit when I realize more data won't change the essential structure of the problem.",
    clues: ["trace back assumptions", "model how I model", "meta-rules", "more data won't change the essential structure"],
    answerDR: "Meta",
    answerSE: "Divergent",
    answerSR: "Constant",
    answerCV: "InfoExhaustion",
  },
  {
    slug: "the-startup-founder",
    name: "The Startup Founder",
    avatar: "🚀",
    difficulty: "HARD",
    sortOrder: 7,
    context: "High-stakes entrepreneurial decision-making",
    scenario:
      "I run weekly retrospectives on my own thinking - not just the business decisions, but how I made them. Was I anchored to first impressions? Did I discount weak signals? I generate at least 4 hypotheses before committing to any strategy, and I keep a decision journal to audit myself. I only stop exploring when I've genuinely exhausted the search space.",
    clues: [
      "weekly retrospectives on my own thinking",
      "4 hypotheses",
      "decision journal to audit myself",
      "exhausted the search space",
    ],
    answerDR: "Meta",
    answerSE: "Divergent",
    answerSR: "Constant",
    answerCV: "InfoExhaustion",
  },
  {
    slug: "the-er-doctor",
    name: "The ER Doctor",
    avatar: "🩺",
    difficulty: "HARD",
    sortOrder: 8,
    context: "High-stakes professional triage",
    scenario:
      "In the ER, you build a differential diagnosis fast - I'm already running 3-4 possibilities in parallel as the patient walks in. I check my assumptions constantly because a missed diagnosis costs a life. But when the data converges, I act decisively. I don't wait for certainty. I act when I'm confident enough, and adjust if new information breaks the pattern.",
    clues: [
      "3-4 possibilities in parallel",
      "check my assumptions constantly",
      "when the data converges",
      "confident enough, and adjust",
    ],
    answerDR: "Deep",
    answerSE: "MultiTrack",
    answerSR: "Constant",
    answerCV: "Clarity",
  },
];

async function main() {
  for (const profile of canonicalProfiles) {
    await prisma.profile.upsert({
      where: { slug: profile.slug },
      create: profile,
      update: profile,
    });
  }
}

main()
  .catch((error) => {
    throw error;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
