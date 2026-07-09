import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = resolve(__dirname, "..", "quiz-bank.json");

const raw = readFileSync(filePath, "utf-8");
const bank = JSON.parse(raw);

function quizTopicGroup(topic) {
  const t = String(topic || "General").trim().replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").replace(/\s+/g, " ").slice(0, 100);
  const normalized = t.toLowerCase();
  if (!t || normalized === "general") return "General";

  const groups = [
    ["Cell Biology", /\b(cell|membrane|cytosol|cytoplasm|organelle|ribosome|lysosome|peroxisome|mitochondria|chloroplast|golgi|reticulum|cytoskeleton|junction|transport|microscopy|prokary|eukary|plant cell)\b/i],
    ["Genetics And Molecular Biology", /\b(gene|genetic|dna|rna|chromosome|chromatin|replication|transcription|translation|codon|nucleic|purine|pyrimidine|histone|inheritance)\b/i],
    ["Biochemistry", /\b(protein|lipid|carbohydrate|enzyme|glycolysis|macromolecule|amino|phospholipid|triglyceride)\b/i],
    ["Botany", /\b(botany|plant|leaf|stem|root|flower|vascular|xylem|phloem|stomata|mesophyll|epidermis|raunkiaer)\b/i],
    ["Chemistry Basics", /\b(acid|base|salt|kinetic|rate|reaction|equilibrium|ph|poh|hydronium|chem)\b/i],
    ["Computer Fundamentals", /\b(computer|memory|storage|software|hardware|network|internet|binary|programming|processor|cpu|alu)\b/i],
    ["Physics", /\b(physics|heat|thermodynamic|wave|motion|force|energy|electric|magnet)\b/i],
    ["Mathematics", /\b(math|calculus|algebra|function|limit|differentiation|integration|matrix)\b/i],
    ["French", /\b(french|fran|greeting|number|culture)\b/i],
  ];

  for (const [group, pattern] of groups) {
    if (pattern.test(t)) return group;
  }

  return t
    .split(/\s[-–—:|/]\s|\s-\s|:/)[0]
    .replace(/\b(and|or|the|of|in)\b/g, (word) => word.toLowerCase())
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .slice(0, 60)
    .trim() || "General";
}

const courses = {};
for (const q of bank.questions) {
  const code = q.courseCode;
  const topic = quizTopicGroup(q.topic);
  courses[code] = courses[code] || { count: 0, topics: {} };
  courses[code].count += 1;
  courses[code].topics[topic] = (courses[code].topics[topic] || 0) + 1;
}

bank.courses = courses;
writeFileSync(filePath, JSON.stringify(bank, null, 2), "utf-8");
console.log("quiz-bank.json updated with correct courses summary");
console.log(JSON.stringify(courses, null, 2));
