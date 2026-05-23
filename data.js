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
  { code: "GST 112", title: "Nigerian Peoples and Culture", type: "Compulsory", units: 2 },
  { code: "CHM 107", title: "General Chemistry Practical I", type: "Compulsory", units: 1 },
  { code: "BIO 107", title: "General Biology Practical I", type: "Compulsory", units: 1 },
  { code: "PHY 107", title: "General Practical Physics I", type: "Compulsory", units: 1 },
  { code: "COS 101", title: "Introduction to Computing Sciences", type: "Compulsory", units: 3 },
];

/* TIMETABLE DATA: CBT rows that match the registered first-semester GES/GST courses. */
export const cbtTimetable = [
  {
    course: "GES 107",
    day: "Tuesday / Morning",
    date: "26/05/2026",
    batch: "Batch 1",
    duration: "1 hour",
    time: "8:00am - 9:00am",
  },
  {
    course: "GES 107",
    day: "Tuesday / Morning",
    date: "26/05/2026",
    batch: "Batch 2",
    duration: "1 hour",
    time: "9:30am - 10:30am",
  },
  {
    course: "GST 112",
    day: "Saturday / Morning, Afternoon",
    date: "30/05/2026",
    batch: "Batch 1",
    duration: "1 hour",
    time: "8:00am - 9:00am",
  },
  {
    course: "GST 112",
    day: "Saturday / Morning, Afternoon",
    date: "30/05/2026",
    batch: "Batch 2",
    duration: "1 hour",
    time: "9:30am - 10:30am",
  },
  {
    course: "GST 112",
    day: "Saturday / Morning, Afternoon",
    date: "30/05/2026",
    batch: "Batch 3",
    duration: "1 hour",
    time: "11:00am - 12:00pm",
  },
  {
    course: "GST 112",
    day: "Saturday / Morning, Afternoon",
    date: "30/05/2026",
    batch: "Batch 4",
    duration: "1 hour",
    time: "12:30pm - 1:30pm",
  },
  {
    course: "GES 108",
    day: "Monday / Afternoon",
    date: "01/06/2026",
    batch: "Batch 1",
    duration: "1 hour",
    time: "1:30pm - 2:30pm",
  },
  {
    course: "GES 108",
    day: "Monday / Afternoon",
    date: "01/06/2026",
    batch: "Batch 2",
    duration: "1 hour",
    time: "3:00pm - 4:00pm",
  },
];

export const resourceTypes = ["Slide", "Note", "Textbook", "Practical", "Past Question", "Assignment", "Link"];

export function findCourse(courseCode) {
  return firstSemesterCourses.find((course) => course.code === courseCode);
}
