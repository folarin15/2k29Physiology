// ============================================================
// PhysioK29 — Shared Course Data
// Used by both Student and Executive Portals
// ============================================================

export const firstSemesterCourses = [
  { code: "PHY 101", title: "General Physics I", type: "Core Science" },
  { code: "PHY 103", title: "Physics Laboratory I", type: "Lab" },
  { code: "CHM 101", title: "General Chemistry I", type: "Core Science" },
  { code: "CHM 107", title: "Chemistry Laboratory I", type: "Lab" },
  { code: "BIO 101", title: "General Biology I", type: "Core Science" },
  { code: "BIO 107", title: "Biology Laboratory I", type: "Lab" },
  { code: "GES 101", title: "Use of English I", type: "General Studies" },
  { code: "GES 103", title: "Philosophy and Logic", type: "General Studies" },
  { code: "GES 107", title: "Citizenship Education I", type: "General Studies" },
  { code: "MTH 101", title: "General Mathematics I", type: "Core Science" },
  { code: "PHY 105", title: "Physics III", type: "Core Science" },
];

export const secondSemesterCourses = [
  { code: "PHY 102", title: "General Physics II", type: "Core Science" },
  { code: "PHY 104", title: "Physics IV", type: "Core Science" },
  { code: "PHY 108", title: "Physics Laboratory II", type: "Lab" },
  { code: "CHM 102", title: "General Chemistry II", type: "Core Science" },
  { code: "CHM 108", title: "Chemistry Laboratory II", type: "Lab" },
  { code: "BIO 102", title: "General Biology II", type: "Core Science" },
  { code: "BIO 108", title: "Biology Laboratory II", type: "Lab" },
  { code: "GES 102", title: "Use of English II", type: "General Studies" },
  { code: "GES 108", title: "Citizenship Education II", type: "General Studies" },
  { code: "MTH 102", title: "General Mathematics II", type: "Core Science" },
  { code: "ZOO 101", title: "Zoology I", type: "Core Science" },
  { code: "ZOO 102", title: "Zoology II", type: "Core Science" },
  { code: "GES 104", title: "Science and Society", type: "General Studies" },
];

export const firstSemesterCoursesTotal = firstSemesterCourses.length;
export const secondSemesterCoursesTotal = secondSemesterCourses.length;

export function findCourse(courseCode) {
  const all = [...firstSemesterCourses, ...secondSemesterCourses];
  return all.find((c) => c.code === courseCode) || null;
}

export const resourceTypes = [
  "Resource",
  "Weekly Lecture",
  "Revision Material",
  "Practical Manual",
  "Test Material",
  "Lab Report",
  "Mid-Semester",
  "Assignment",
];

export const courseGrid = [
  { code: "PHY 101", title: "General Physics I (Mech & Heat)" },
  { code: "PHY 102", title: "General Physics II (Wave & Optics)" },
  { code: "PHY 104", title: "Physics IV (Electricity & Magnetism)" },
  { code: "PHY 105", title: "Physics III (Properties of Matter)" },
  { code: "CHM 101", title: "General Chemistry I" },
  { code: "CHM 102", title: "General Chemistry II" },
  { code: "BIO 101", title: "General Biology I" },
  { code: "BIO 102", title: "General Biology II" },
  { code: "ZOO 101", title: "Zoology I" },
  { code: "ZOO 102", title: "Zoology II" },
  { code: "MTH 101", title: "General Mathematics I" },
  { code: "MTH 102", title: "General Mathematics II" },
  { code: "GES 101", title: "Use of English I" },
  { code: "GES 102", title: "Use of English II" },
  { code: "GES 103", title: "Philosophy and Logic" },
  { code: "GES 104", title: "Science and Society" },
  { code: "GES 107", title: "Citizenship Education I" },
  { code: "GES 108", title: "Citizenship Education II" },
  { code: "PHY 103", title: "Physics Laboratory I" },
  { code: "PHY 108", title: "Physics Laboratory II" },
  { code: "CHM 107", title: "Chemistry Laboratory I" },
  { code: "CHM 108", title: "Chemistry Laboratory II" },
  { code: "BIO 107", title: "Biology Laboratory I" },
  { code: "BIO 108", title: "Biology Laboratory II" },
];

export function getResumptionDate() {
  return new Date("2026-08-25T00:00:00");
}
