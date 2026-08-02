import { Router } from "express";
import { getAdapter } from "../lib/dbManager.js";

const router = Router();

router.get("/fee-records", async (_req, res) => {
  const rows = await getAdapter().feeRecords.list();
  res.json(rows);
});

router.post("/fee-records", async (req, res) => {
  const body = req.body;
  if (!body.studentId || body.amount == null) {
    res.status(400).json({ error: "studentId and amount are required" });
    return;
  }
  const row = await getAdapter().feeRecords.create(body);
  res.status(201).json(row);
});

router.delete("/fee-records/:id", async (req, res) => {
  await getAdapter().feeRecords.delete(req.params.id);
  res.status(204).send();
});

export default router;
