import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { JWTPayload } from "../types";
import { sendError } from "../utils/corsHelper";

const auth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    let token: string | undefined;

    // Check for token in header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // Check if token exists
    if (!token) {
      sendError(res, 401, "Access denied. No token provided.");
      return;
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;

      // Get user from token
      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        sendError(res, 401, "Token is not valid. User not found.");
        return;
      }

      if (!user.isActive) {
        sendError(res, 401, "User account is deactivated.");
        return;
      }

      req.user = user;
      next();
    } catch (error) {
      sendError(res, 401, "Token is not valid.");
      return;
    }
  } catch (error) {
    console.error((error as Error).message);
    sendError(res, 500, "Server error");
  }
};

export default auth;
