import express, { Request, Response, NextFunction } from "express";
import cors from "cors";

import syncRouter from "./v1/auth/sync";

import {
  InvalidTokenError,
  InsufficientScopeError,
  UnauthorizedError,
} from "express-oauth2-jwt-bearer";

const app = express();

app.use(cors());
app.use(express.json());

app.use(
  cors({
    origin: ["https://usaii.darkermine.dev"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  }),
);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof UnauthorizedError) {
    res
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
});

app.use("/v1/auth", syncRouter);

app.listen(3001, () => {
  console.log(`🚀 Server running on port 3001`);
});
