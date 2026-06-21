import express, { Request, Response, NextFunction } from "express";
import cors from "cors";

import dotenv from "dotenv";
dotenv.config();

import syncRouter from "./v1/auth/sync";
import sessionsRouter from "./v1/sessions";
import { checkJwt } from "./middleware/auth";

import {
  InvalidTokenError,
  InsufficientScopeError,
  UnauthorizedError,
} from "express-oauth2-jwt-bearer";

const app = express();

app.use(
  cors({
    origin: ["https://launchify.darkermine.dev", "http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);
app.use(express.json());

app.use("/v1/auth", checkJwt, syncRouter);
app.use("/v1/sessions", checkJwt, sessionsRouter);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof UnauthorizedError) {
    return res
      .status(err.status)
      .set(err.headers)
      .json({
        error: err.statusCode || "unauthorized",
        message: "Authentication required",
      });
  }

  if (err instanceof InsufficientScopeError) {
    return res.status(403).json({
      error: "forbidden",
      message: "You do not have permission to access this resource",
      required_scopes: err.cause,
    });
  }

  if (err instanceof InvalidTokenError) {
    return res.status(401).json({
      error: "invalid_token",
      message: "The provided token is invalid or expired",
    });
  }

  console.error("[error]", err instanceof Error ? err.message : err);
  return res.status(500).json({ error: "internal_server_error" });
});

app.listen(3001, () => {
  console.log("🚀 Server running on port 3001");
});
