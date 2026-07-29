import { Router } from "express";
import { getAdapter } from "../lib/dbManager.js";

const router = Router();

router.get("/teachers", async (_req, res) => {
  const rows = await getAdapter().teachers.list();
  res.json(rows);
});

router.post("/teachers", async (req, res) => {
  const body = req.body;
  if (!body.name || !body.username || !Number.isInteger(body.salary) || body.salary <= 0) {
    res.status(400).json({ error: "name, username, and a positive monthly salary are required" });
    return;
  }
  const row = await getAdapter().teachers.create(body);
  res.status(201).json(row);
});

router.put("/teachers/:id", async (req, res) => {
  if (req.body.salary !== undefined && (!Number.isInteger(req.body.salary) || req.body.salary <= 0)) {
    res.status(400).json({ error: "monthly salary must be a positive integer" });
    return;
  }
  const row = await getAdapter().teachers.update(req.params.id, req.body);
  if (!row) { res.status(404).json({ error: "Teacher not found" }); return; }
  res.json(row);
});

router.delete("/teachers/:id", async (req, res) => {
  await getAdapter().teachers.delete(req.params.id);
  res.status(204).send();
});

export default router;
