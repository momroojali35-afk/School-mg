import { Router } from "express";
import { getAdapter } from "../lib/dbManager.js";

const router = Router();

router.get("/alumni", async (_req, res) => {
  const rows = await getAdapter().alumni.list();
  res.json(rows);
});

router.post("/alumni", async (req, res) => {
  const body = req.body;
  if (!body.name || !body.batch || !body.passOutClass) {
    res.status(400).json({ error: "name, batch, and passOutClass are required" });
    return;
  }
  const row = await getAdapter().alumni.create(body);
  res.status(201).json(row);
});

router.put("/alumni/:id", async (req, res) => {
  const row = await getAdapter().alumni.update(req.params.id, req.body);
  if (!row) { res.status(404).json({ error: "Alumni not found" }); return; }
  res.json(row);
});

router.post("/alumni/bulk", async (req, res) => {
  const { records } = req.body ?? {};
  if (!Array.isArray(records) || records.length === 0) {
    res.status(400).json({ error: "records array is required" });
    return;
  }
  const rows = await getAdapter().alumni.bulkCreate(records);
  res.status(201).json(rows);
});

router.delete("/alumni/:id", async (req, res) => {
  await getAdapter().alumni.delete(req.params.id);
  res.status(204).send();
});

export default router;
