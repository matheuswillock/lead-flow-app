import type { Request, Response, NextFunction } from "express";
import { config } from "./config.js";

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apikey = req.headers["apikey"];
  if (!apikey || apikey !== config.apiKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
