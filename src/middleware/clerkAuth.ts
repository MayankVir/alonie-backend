import { Request, Response, NextFunction } from "express";
import { clerkClient } from "@clerk/clerk-sdk-node";

interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: any;
}

const clerkAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.header("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      res.status(401).json({
        success: false,
        message: "No token provided",
      });
      return;
    }

    // Verify the token with Clerk
    const payload = await clerkClient.verifyToken(token);

    if (!payload || !payload.sub) {
      res.status(401).json({
        success: false,
        message: "Invalid token",
      });
      return;
    }

    // Get user information from Clerk
    const user = await clerkClient.users.getUser(payload.sub);

    // Add user info to request
    req.userId = payload.sub;
    req.user = {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
    };

    next();
  } catch (error) {
    console.error("Clerk auth error:", error);
    res.status(401).json({
      success: false,
      message: "Token verification failed",
    });
  }
};

export default clerkAuth;
