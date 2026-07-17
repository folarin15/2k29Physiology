/* COURSE DATA: Second-semester courses displayed after break lock releases on July 11. */
export const firstSemesterCourses = [
  { code: "PHY 102", title: "General Physics II", type: "Compulsory", units: 2 },
  { code: "PHY 104", title: "Waves, Optics and Oscillations", type: "Required", units: 2 },
  { code: "CHM 102", title: "General Chemistry II", type: "Compulsory", units: 2 },
  { code: "BIO 102", title: "General Biology II", type: "Compulsory", units: 2 },
  { code: "ZOO 101", title: "General Zoology I", type: "Compulsory", units: 2 },
  { code: "ZOO 102", title: "General Zoology II", type: "Compulsory", units: 2 },
  { code: "GST 111", title: "Communication in English I", type: "Compulsory", units: 2 },
  { code: "CHM 108", title: "General Chemistry Practical II", type: "Compulsory", units: 1 },
  { code: "BIO 108", title: "General Biology Practical II", type: "Compulsory", units: 1 },
  { code: "PHY 108", title: "General Practical Physics II", type: "Compulsory", units: 1 },
];

/* BREAK LOCK: Now expired — all content is fully open. */
export const BREAK_LOCK_UNTIL = new Date("2026-06-01T00:00:00+01:00");

/* RESUMPTION DATA: Semester-break message and second-semester countdown. */
export const secondSemesterResumption = {
  title: "Second semester resumption",
  date: "2026-07-13T00:00:00+01:00",
  displayDate: "Monday, July 13, 2026",
  message:
    "Take time to rest, reconnect with the people you love, and recharge at your own pace. When it is time to return, we will be right here with your notes, quizzes, and everything you need for another successful semester.",
};

/* TIMETABLE DATA: Cleared now that the portal is in semester-break mode. */
export const cbtTimetable = [];

export const resourceTypes = ["Slide", "Note", "Textbook", "Practical", "Past Question", "Assignment", "Link"];

export const secondSemesterCourses = [
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

export function findCourse(courseCode) {
  return firstSemesterCourses.find((course) => course.code === courseCode);
}
