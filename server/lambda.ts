import express, { type Request, Response, NextFunction } from "express";
import serverless from "serverless-http";
import { registerRoutes } from "./routes";

// Lazily initialized — persists across warm Lambda invocations
let serverlessHandler: ReturnType<typeof serverless> | null = null;

async function getHandler() {
  if (serverlessHandler) return serverlessHandler;

  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: false, limit: "10mb" }));

  await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  serverlessHandler = serverless(app, {
    binary: ["image/*", "multipart/form-data"],
  });

  return serverlessHandler;
}

export const handler = async (event: any, context: any) => {
  const h = await getHandler();
  return h(event, context);
};
