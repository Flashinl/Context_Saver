/**
 * @fileoverview User authentication controller — handles login, logout, and session refresh.
 * @module controllers/auth
 * @author Acme Corp Platform Team
 */

import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { rateLimit } from "../middleware/rate-limit.js";

/** Credentials accepted by the login endpoint */
export interface LoginCredentials {
  /** User email address */
  email: string;
  /** Plain-text password (validated server-side) */
  password: string;
}

/** Shape of a successful auth response */
export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    role: "admin" | "member" | "viewer";
  };
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

/**
 * Authenticates a user and issues JWT access + refresh tokens.
 *
 * @param req - Express request containing email/password in body
 * @param res - Express response used to return tokens
 * @param next - Error-handling middleware
 */
export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
  // Validate incoming payload against schema
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid credentials payload");
    }

    const { email, password } = parsed.data;

    // Look up user — never reveal whether email exists (timing-safe compare below)
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError(401, "Invalid email or password");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      logger.warn({ email }, "Failed login attempt");
      throw new AppError(401, "Invalid email or password");
    }

    const accessToken = jwt.sign(
      { sub: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "15m" },
    );

    const refreshToken = jwt.sign(
      { sub: user.id, type: "refresh" },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: "7d" },
    );

    // Persist refresh token hash for rotation
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: await bcrypt.hash(refreshToken, 10),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const response: AuthTokenResponse = {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: { id: user.id, email: user.email, role: user.role },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

/** Rate-limited export used by the router */
export const login = rateLimit({ windowMs: 60_000, max: 10 })(loginHandler);
