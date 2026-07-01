/* COURSE DATA: Fixed first-semester list from the registration document. */
export const firstSemesterCourses = [
  { code: "PHY 101", title: "General Physics I", type: "Compulsory", units: 2 },
  { code: "PHY 103", title: "General Physics III", type: "Required", units: 2 },
  { code: "CHM 101", title: "General Chemistry I", type: "Compulsory", units: 2 },
  { code: "BIO 101", title: "General Biology I", type: "Compulsory", units: 2 },
  { code: "BOT 102", title: "Introductory Botany", type: "Required", units: 2 },
  {
    code: "MTH 101",
    title: "Elementary Mathematics I: Algebra and Trigonometry",
    type: "Compulsory",
    units: 2,
  },
  {
    code: "MTH 102",
    title: "Elementary Mathematics II: Calculus",
    type: "Compulsory",
    units: 2,
  },
  {
    code: "GES 107",
    title: "Reproductive Health, STIs, Drugs and Mankind",
    type: "Required",
    units: 1,
  },
  { code: "GES 108", title: "Introduction to French", type: "Required", units: 1 },
  { code: "GST 111", title: "Communication in English I", type: "Compulsory", units: 2 },
  { code: "GST 112", title: "Nigerian Peoples and Culture", type: "Compulsory", units: 2 },
  { code: "CHM 107", title: "General Chemistry Practical I", type: "Compulsory", units: 1 },
  { code: "BIO 107", title: "General Biology Practical I", type: "Compulsory", units: 1 },
  { code: "PHY 107", title: "General Practical Physics I", type: "Compulsory", units: 1 },
  { code: "COS 101", title: "Introduction to Computing Sciences", type: "Compulsory", units: 3 },
];

/* RESUMPTION DATA: Exams are over; the portal now counts down to second-semester resumption. */
export const secondSemesterResumption = {
  title: "Second semester resumption",
  date: "2026-07-13T00:00:00+01:00",
  displayDate: "Monday, July 13, 2026",
  message:
    "Exams are done. Unwind, refresh, sleep properly, and give yourself room to breathe before second semester begins.",
};

/* TIMETABLE DATA: Cleared after the end of first-semester exams. */
export const cbtTimetable = [];

export const resourceTypes = ["Slide", "Note", "Textbook", "Practical", "Past Question", "Assignment", "Link"];

export function findCourse(courseCode) {
  return firstSemesterCourses.find((course) => course.code === courseCode);
}
