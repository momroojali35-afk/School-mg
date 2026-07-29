import { Router } from "express";
import { getAdapter } from "../lib/dbManager.js";
import { z } from "zod";

const router = Router();

const CreateSchema = z.object({
  studentId: z.string().min(1),
  studentName: z.string().min(1),
  studentClass: z.string().min(1),
  teacherId: z.string().min(1),
  teacherName: z.string().min(1),
  reason: z.string().min(1, "Reason is required"),
  documentBase64: z.string().optional().nullable(),
  documentName: z.string().optional().nullable(),
  documentMimeType: z.string().optional().nullable(),
});

const ReviewSchema = z.object({
  adminNote: z.string().optional(),
});

// List all inactivation requests
router.get("/inactivation-requests", async (_req, res) => {
  const rows = await getAdapter().inactivationRequests.list();
  res.json(rows);
});

// List requests for a specific student
router.get("/inactivation-requests/student/:studentId", async (req, res) => {
  const rows = await getAdapter().inactivationRequests.listByStudent(req.params.studentId);
  res.json(rows);
});

// Teacher submits a reactivation request for an inactive student
router.post("/inactivation-requests", async (req, res) => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  // Check that the student is currently inactive
  const students = await getAdapter().students.list();
  const student = students.find((s: any) => s.id === parsed.data.studentId);
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }
  if ((student.status ?? "active") !== "inactive") {
    res.status(409).json({ error: "Student is not inactive — no reactivation request needed" });
    return;
  }

  // Check for existing pending request
  const existing = await getAdapter().inactivationRequests.listByStudent(parsed.data.studentId);
  const hasPending = existing.some((r: any) => r.status === "pending");
  if (hasPending) {
    res.status(409).json({ error: "A pending reactivation request already exists for this student" });
    return;
  }

  const row = await getAdapter().inactivationRequests.create(parsed.data);
  res.status(201).json(row);
});

// Admin approves a reactivation request → student becomes active
router.put("/inactivation-requests/:id/approve", async (req, res) => {
  const parsed = ReviewSchema.safeParse(req.body);
  const adminNote = parsed.success ? parsed.data.adminNote : undefined;
  const row = await getAdapter().inactivationRequests.updateStatus(req.params.id, "approved", adminNote);
  if (!row) { res.status(404).json({ error: "Request not found" }); return; }
  res.json(row);
});

// Admin rejects a reactivation request
router.put("/inactivation-requests/:id/reject", async (req, res) => {
  const parsed = ReviewSchema.safeParse(req.body);
  const adminNote = parsed.success ? parsed.data.adminNote : undefined;
  const row = await getAdapter().inactivationRequests.updateStatus(req.params.id, "rejected", adminNote);
  if (!row) { res.status(404).json({ error: "Request not found" }); return; }
  res.json(row);
});

export default router;
