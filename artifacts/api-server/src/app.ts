<<<<<<< HEAD
import express, { type Express } from "express";
=======
import express, { type Express, type Request, type Response, type NextFunction } from "express";
>>>>>>> github/main
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
<<<<<<< HEAD
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

=======
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "API server is running" });
});

app.use("/api", router);

// ── Global JSON error handler ─────────────────────────────────────────────────
// Express 5 forwards rejected async-route promises here automatically.
// Without this, unhandled errors produce an HTML page instead of JSON.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = typeof err?.status === "number" ? err.status
    : typeof err?.statusCode === "number" ? err.statusCode
    : err?.code === "NO_DB_CONNECTION" ? 503
    : 500;
  const message = err?.message ?? "Internal server error";
  logger.error({ err, status }, message);
  if (!res.headersSent) {
    res.status(status).json({ error: message });
  }
});

>>>>>>> github/main
export default app;
