import { Request, Response, NextFunction } from "express";
import { clerkClient } from "@clerk/clerk-sdk-node";
import User from "../models/User";
import { IUser } from "../types";
import { createDefaultCompanions } from "../services/defaultCompanionService";
import { sendError } from "../utils/corsHelper";

// Extend the global Express Request interface to include localUser
declare global {
  namespace Express {
    interface Request {
      localUser?: IUser;
    }
  }
}

interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: any;
  localUser?: IUser;
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
      sendError(res, 401, "No token provided");
      return;
    }

    // Verify the token with Clerk
    const payload = await clerkClient.verifyToken(token);

    if (!payload || !payload.sub) {
      sendError(res, 401, "Invalid token");
      return;
    }

    // Get user information from Clerk
    const clerkUser = await clerkClient.users.getUser(payload.sub);
    const clerkUserId = payload.sub;

    // Prepare user data for potential sync (convert null to undefined)
    const clerkUserData = {
      id: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress,
      firstName: clerkUser.firstName ?? undefined,
      lastName: clerkUser.lastName ?? undefined,
      fullName: `${clerkUser.firstName || ""} ${
        clerkUser.lastName || ""
      }`.trim(),
    };

    // Add user info to request
    req.userId = clerkUserId;
    req.user = clerkUserData;

    // Auto-sync user to local database
    try {
      // Check if user already exists in local database
      let localUser = await User.findOne({ clerkId: clerkUserId });
      let isNewUser = false;

      if (!localUser) {
        // Create new user in local database
        console.log(
          `Auto-syncing new user to local DB: ${clerkUserData.email}`,
        );
        localUser = new User({
          clerkId: clerkUserId,
          name: clerkUserData.fullName || clerkUserData.email,
          email: clerkUserData.email,
          firstName: clerkUserData.firstName,
          lastName: clerkUserData.lastName,
          role: "user", // Default role
          isActive: true,
          lastLogin: new Date(),
        });
        await localUser.save();
        isNewUser = true;
        console.log(
          `User ${clerkUserData.email} successfully synced to local DB`,
        );
      }

      // Create default companions for new users
      if (isNewUser) {
        try {
          await createDefaultCompanions(clerkUserId);
          console.log(
            `Default companions created for new user: ${clerkUserData.email}`,
          );
        } catch (companionError) {
          console.error(
            `Failed to create default companions for user ${clerkUserData.email}:`,
            companionError,
          );
          // Don't fail the authentication if companion creation fails
        }
      }

      // Add local user info to request for use in routes
      req.localUser = localUser;
    } catch (syncError) {
      // Log the sync error but don't fail the authentication
      // This ensures that even if sync fails, the user can still access the app
      console.error(
        "Auto-sync error (continuing with authentication):",
        syncError,
      );
    }

    next();
  } catch (error) {
    console.error("Clerk auth error:", error);
    sendError(res, 401, "Token verification failed");
  }
};

export default clerkAuth;
