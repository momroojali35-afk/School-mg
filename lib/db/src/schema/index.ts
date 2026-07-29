import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  serial,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Helper ───────────────────────────────────────────────────────────────────
const genId = sql`gen_random_uuid()`;

// ─── Classes ──────────────────────────────────────────────────────────────────
export const classesTable = pgTable("classes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Sections ─────────────────────────────────────────────────────────────────
export const sectionsTable = pgTable("sections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Students ────────────────────────────────────────────────────────────────
export const studentsTable = pgTable("students", {
  id: text("id").primaryKey().default(genId),
  name: text("name").notNull(),
  fatherName: text("father_name").notNull(),
  motherName: text("mother_name").notNull(),
  mobileNumber: text("mobile_number").notNull(),
  class: text("class").notNull(),
  section: text("section"),
  admissionNo: text("admission_no"),
  rollNumber: text("roll_number").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  address: text("address"),
  photo: text("photo"),
  annualFee: integer("annual_fee"),
  discountType: text("discount_type"), // 'fixed' | 'percent'
  discountValue: integer("discount_value"),
  status: text("status").notNull().default("active"), // 'active' | 'inactive'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Teachers ────────────────────────────────────────────────────────────────
export const teachersTable = pgTable("teachers", {
  id: text("id").primaryKey().default(genId),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  mobileNumber: text("mobile_number").notNull(),
  salary: integer("salary").notNull(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  joinDate: text("join_date").notNull(),
  photo: text("photo"),
  // { addStudent, feeCollection, manageClasses, manageExams, manageResults, promoteStudents, sendFeeReminder }
  permissions: jsonb("permissions").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── App Settings ──────────────────────────────────────────────────────────────
export const appSettingsTable = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Subjects ────────────────────────────────────────────────────────────────
export const subjectsTable = pgTable("subjects", {
  id: text("id").primaryKey().default(genId),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Attendance Records ───────────────────────────────────────────────────────
export const attendanceRecordsTable = pgTable("attendance_records", {
  id: text("id").primaryKey().default(genId),
  studentId: text("student_id").notNull(),
  studentName: text("student_name").notNull(),
  class: text("class").notNull(),
  date: text("date").notNull(), // ISO date string YYYY-MM-DD
  status: text("status").notNull(), // 'present' | 'absent' | 'leave'
  takenBy: text("taken_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Inactivation Requests ────────────────────────────────────────────────────
export const inactivationRequestsTable = pgTable("inactivation_requests", {
  id: text("id").primaryKey().default(genId),
  studentId: text("student_id").notNull(),
  studentName: text("student_name").notNull(),
  studentClass: text("student_class").notNull(),
  teacherId: text("teacher_id").notNull(),
  teacherName: text("teacher_name").notNull(),
  reason: text("reason").notNull(),
  documentBase64: text("document_base64"), // base64-encoded file content
  documentName: text("document_name"),     // original filename
  documentMimeType: text("document_mime_type"),
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
});

// ─── Exams ───────────────────────────────────────────────────────────────────
export const examsTable = pgTable("exams", {
  id: text("id").primaryKey().default(genId),
  name: text("name").notNull(),
  class: text("class").notNull(),
  subjects: jsonb("subjects").notNull(), // string[]
  subjectSchedule: jsonb("subject_schedule"), // SubjectSchedule[] | null
  classSubjects: jsonb("class_subjects"), // ClassSubjectAssignment[] | null — multi-class support
  date: text("date").notNull(),
  maxMarks: integer("max_marks").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Exam Results ─────────────────────────────────────────────────────────────
export const examResultsTable = pgTable(
  "exam_results",
  {
    id: text("id").primaryKey().default(genId),
    examId: text("exam_id").notNull(),
    studentId: text("student_id").notNull(),
    studentName: text("student_name").notNull(),
    class: text("class").notNull(),
    rollNumber: text("roll_number").notNull(),
    marks: jsonb("marks").notNull(), // Record<string, number>
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique("exam_results_exam_student").on(t.examId, t.studentId)],
);

// ─── Mark Submissions ─────────────────────────────────────────────────────────
export const markSubmissionsTable = pgTable(
  "mark_submissions",
  {
    id: text("id").primaryKey().default(genId),
    examId: text("exam_id").notNull(),
    class: text("class").notNull(),
    subject: text("subject").notNull(),
    // 'draft' | 'submitted' | 'locked'
    status: text("status").notNull().default("draft"),
    teacherId: text("teacher_id"),
    teacherName: text("teacher_name"),
    submittedAt: timestamp("submitted_at"),
    lockedBy: text("locked_by"),
    lockedAt: timestamp("locked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique("mark_submissions_exam_class_subject").on(t.examId, t.class, t.subject)],
);

// ─── Mark Audit Log ───────────────────────────────────────────────────────────
export const markAuditLogTable = pgTable("mark_audit_log", {
  id: text("id").primaryKey().default(genId),
  examId: text("exam_id").notNull(),
  class: text("class").notNull(),
  subject: text("subject").notNull(),
  // 'submit' | 'lock' | 'unlock'
  action: text("action").notNull(),
  actorId: text("actor_id").notNull(),
  actorName: text("actor_name").notNull(),
  // 'teacher' | 'admin'
  actorRole: text("actor_role").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Fee Types ───────────────────────────────────────────────────────────────
export const feeTypesTable = pgTable("fee_types", {
  id: text("id").primaryKey().default(genId),
  name: text("name").notNull(),
  amount: integer("amount").notNull(),
  description: text("description").notNull().default(""),
  category: text("category"), // 'annual' | 'additional' | null
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Fee Records ──────────────────────────────────────────────────────────────
export const feeRecordsTable = pgTable("fee_records", {
  id: text("id").primaryKey().default(genId),
  studentId: text("student_id").notNull(),
  studentName: text("student_name").notNull(),
  class: text("class").notNull(),
  amount: integer("amount").notNull(),
  date: text("date").notNull(),
  description: text("description").notNull().default(""),
  feeTypeId: text("fee_type_id"),
  feeTypeName: text("fee_type_name"),
  collectedBy: text("collected_by").notNull(),
  receiptNumber: text("receipt_number"),
  paymentMethod: text("payment_method"),
  feeCategory: text("fee_category"), // 'annual' | 'additional' | null
  discountApplied: integer("discount_applied"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Salary Records ───────────────────────────────────────────────────────────
export const salaryRecordsTable = pgTable("salary_records", {
  id: text("id").primaryKey().default(genId),
  teacherId: text("teacher_id").notNull(),
  teacherName: text("teacher_name").notNull(),
  month: text("month").notNull(),
  year: integer("year").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("pending"), // 'paid' | 'pending'
  paidDate: text("paid_date"),
  receiptNumber: text("receipt_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Expenses ─────────────────────────────────────────────────────────────────
export const expensesTable = pgTable("expenses", {
  id: text("id").primaryKey().default(genId),
  description: text("description").notNull(),
  amount: integer("amount").notNull(),
  date: text("date").notNull(),
  category: text("category").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Alumni ───────────────────────────────────────────────────────────────────
export const alumniTable = pgTable("alumni", {
  id: text("id").primaryKey().default(genId),
  name: text("name").notNull(),
  fatherName: text("father_name").notNull().default(""),
  mobileNumber: text("mobile_number").notNull().default(""),
  batch: text("batch").notNull(), // e.g. "2023-24"
  passOutClass: text("pass_out_class").notNull(), // e.g. "Class 10"
  rollNumber: text("roll_number").notNull().default(""),
  admissionNo: text("admission_no"),
  dateOfBirth: text("date_of_birth").notNull().default(""),
  address: text("address"),
  photo: text("photo"),
  achievements: text("achievements"),
  currentStatus: text("current_status"), // 'Studying' | 'Working' | 'Other'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Promotion Records ────────────────────────────────────────────────────────
export const promotionRecordsTable = pgTable("promotion_records", {
  id: text("id").primaryKey().default(genId),
  studentId: text("student_id").notNull(),
  studentName: text("student_name").notNull(),
  fromClass: text("from_class").notNull(),
  toClass: text("to_class").notNull(),
  promotedBy: text("promoted_by").notNull(),
  promotedAt: text("promoted_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────
export type Class = typeof classesTable.$inferSelect;
export type InsertClass = typeof classesTable.$inferInsert;

export type Section = typeof sectionsTable.$inferSelect;
export type InsertSection = typeof sectionsTable.$inferInsert;

export type Student = typeof studentsTable.$inferSelect;
export type InsertStudent = typeof studentsTable.$inferInsert;

export type Teacher = typeof teachersTable.$inferSelect;
export type InsertTeacher = typeof teachersTable.$inferInsert;

export type Subject = typeof subjectsTable.$inferSelect;
export type InsertSubject = typeof subjectsTable.$inferInsert;

export type AttendanceRecord = typeof attendanceRecordsTable.$inferSelect;
export type InsertAttendanceRecord = typeof attendanceRecordsTable.$inferInsert;

export type InactivationRequest = typeof inactivationRequestsTable.$inferSelect;
export type InsertInactivationRequest = typeof inactivationRequestsTable.$inferInsert;

export type Exam = typeof examsTable.$inferSelect;
export type InsertExam = typeof examsTable.$inferInsert;

export type ExamResult = typeof examResultsTable.$inferSelect;
export type InsertExamResult = typeof examResultsTable.$inferInsert;

export type FeeType = typeof feeTypesTable.$inferSelect;
export type InsertFeeType = typeof feeTypesTable.$inferInsert;

export type FeeRecord = typeof feeRecordsTable.$inferSelect;
export type InsertFeeRecord = typeof feeRecordsTable.$inferInsert;

export type SalaryRecord = typeof salaryRecordsTable.$inferSelect;
export type InsertSalaryRecord = typeof salaryRecordsTable.$inferInsert;

export type Expense = typeof expensesTable.$inferSelect;
export type InsertExpense = typeof expensesTable.$inferInsert;

export type Alumni = typeof alumniTable.$inferSelect;
export type InsertAlumni = typeof alumniTable.$inferInsert;

export type PromotionRecord = typeof promotionRecordsTable.$inferSelect;
export type InsertPromotionRecord = typeof promotionRecordsTable.$inferInsert;

export type MarkSubmission = typeof markSubmissionsTable.$inferSelect;
export type InsertMarkSubmission = typeof markSubmissionsTable.$inferInsert;

export type MarkAuditEntry = typeof markAuditLogTable.$inferSelect;
export type InsertMarkAuditEntry = typeof markAuditLogTable.$inferInsert;
