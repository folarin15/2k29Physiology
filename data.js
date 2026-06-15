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

/* TIMETABLE DATA: Final faculty examination rows for Physiology 2k29 first-semester courses. */
export const cbtTimetable = [
  {
    course: "BIO 101",
    day: "Tuesday",
    date: "16/06/2026",
    batch: "CBT Centre, Ajibode",
    duration: "3 hours",
    time: "12:00 PM - 3:00 PM",
  },
  {
    course: "MTH 102",
    day: "Thursday",
    date: "18/06/2026",
    batch: "CBN Lecture Theatre / FLT",
    duration: "3 hours",
    time: "12:00 PM - 3:00 PM",
  },
  {
    course: "MTH 101",
    day: "Saturday",
    date: "20/06/2026",
    batch: "CBN Lecture Theatre / FLT",
    duration: "3 hours",
    time: "12:00 PM - 3:00 PM",
  },
  {
    course: "PHY 101",
    day: "Tuesday",
    date: "23/06/2026",
    batch: "CBT Exam Only",
    duration: "3 hours",
    time: "8:00 AM - 11:00 AM",
  },
  {
    course: "BOT 102",
    day: "Wednesday",
    date: "24/06/2026",
    batch: "CBN Lecture Theatre / FLT",
    duration: "3 hours",
    time: "3:30 PM - 6:30 PM",
  },
  {
    course: "COS 101",
    day: "Wednesday",
    date: "24/06/2026",
    batch: "CBT Exam",
    duration: "3 hours",
    time: "12:00 PM - 3:00 PM",
  },
  {
    course: "CHM 101",
    day: "Thursday",
    date: "25/06/2026",
    batch: "CBT Exam",
    duration: "3 hours",
    time: "12:00 PM - 3:00 PM",
  },
  {
    course: "PHY 103",
    day: "Monday",
    date: "29/06/2026",
    batch: "CBT DLC (Distance Learning Centre)",
    duration: "3 hours",
    time: "8:00 AM - 11:00 AM",
  },
];

export const resourceTypes = ["Slide", "Note", "Textbook", "Practical", "Past Question", "Assignment", "Link"];

export function findCourse(courseCode) {
  return firstSemesterCourses.find((course) => course.code === courseCode);
}
