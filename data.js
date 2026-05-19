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
  { code: "ZOO 101", title: "The Mammalian Body", type: "Compulsory", units: 2 },
  { code: "GST 111", title: "Communication in English I", type: "Compulsory", units: 2 },
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
    time: "9:00am - 10:00am",
  },
  {
    course: "GES 107",
    day: "Tuesday / Morning",
    date: "26/05/2026",
    batch: "Batch 2",
    duration: "1 hour",
    time: "10:30am - 11:30am",
  },
  {
    course: "GST 111",
    day: "Tuesday / Afternoon",
    date: "26/05/2026",
    batch: "Batch 1",
    duration: "1 hour",
    time: "12:00pm - 1:00pm",
  },
  {
    course: "GST 111",
    day: "Tuesday / Afternoon",
    date: "26/05/2026",
    batch: "Batch 2",
    duration: "1 hour",
    time: "1:30pm - 2:30pm",
  },
  {
    course: "GES 108",
    day: "Friday / Morning",
    date: "29/05/2026",
    batch: "Batch 1",
    duration: "1 hour",
    time: "9:00am - 10:00am",
  },
  {
    course: "GES 108",
    day: "Friday / Morning",
    date: "29/05/2026",
    batch: "Batch 2",
    duration: "1 hour",
    time: "10:30am - 11:30am",
  },
  {
    course: "GST 112",
    day: "Saturday / Morning",
    date: "30/05/2026",
    batch: "Batch 1",
    duration: "1 hour",
    time: "9:00am - 10:00am",
  },
  {
    course: "GST 112",
    day: "Saturday / Morning",
    date: "30/05/2026",
    batch: "Batch 2",
    duration: "1 hour",
    time: "10:30am - 11:30am",
  },
  {
    course: "GST 112",
    day: "Saturday / Morning",
    date: "30/05/2026",
    batch: "Batch 3",
    duration: "1 hour",
    time: "11:30am - 12:30pm",
  },
  {
    course: "GST 112",
    day: "Saturday / Morning",
    date: "30/05/2026",
    batch: "Batch 4",
    duration: "1 hour",
    time: "1:00pm - 2:00pm",
  },
];

export const resourceTypes = ["Slide", "Note", "Practical", "Past Question", "Assignment", "Link"];

export function findCourse(courseCode) {
  return firstSemesterCourses.find((course) => course.code === courseCode);
}
