import express, { Request, Response } from "express";
import { clerkClient } from "@clerk/clerk-sdk-node";
import User from "../models/User";
import clerkAuth from "../middleware/clerkAuth";
import { ApiResponse } from "../types";

const router = express.Router();

interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: any;
}

// @route   POST /api/clerk-auth/sync-user
// @desc    Sync user data from Clerk to local database
// @access  Private (requires Clerk token)
router.post(
  "/sync-user",
  clerkAuth,
  async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
  ): Promise<void> => {
    try {
      const clerkUserId = req.userId!;
      const clerkUserData = req.user!;

      // Check if user already exists in local database
      let localUser = await User.findOne({ clerkId: clerkUserId });

      if (!localUser) {
        // Create new user in local database
        localUser = new User({
          clerkId: clerkUserId,
          name:
            clerkUserData.fullName ||
            `${clerkUserData.firstName} ${clerkUserData.lastName}`.trim(),
          email: clerkUserData.email,
          firstName: clerkUserData.firstName,
          lastName: clerkUserData.lastName,
          role: "user", // Default role
          isActive: true,
        });
        await localUser.save();
      } else {
        // Update existing user data
        localUser.name =
          clerkUserData.fullName ||
          `${clerkUserData.firstName} ${clerkUserData.lastName}`.trim();
        localUser.email = clerkUserData.email;
        localUser.firstName = clerkUserData.firstName;
        localUser.lastName = clerkUserData.lastName;
        localUser.lastLogin = new Date();
        await localUser.save();
      }

      res.json({
        success: true,
        message: "User synced successfully",
        data: {
          user: {
            id: localUser._id,
            clerkId: localUser.clerkId,
            name: localUser.name,
            email: localUser.email,
            firstName: localUser.firstName,
            lastName: localUser.lastName,
            role: localUser.role,
            isActive: localUser.isActive,
            createdAt: localUser.createdAt,
            lastLogin: localUser.lastLogin,
          },
        },
      });
    } catch (error) {
      console.error("User sync error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to sync user data",
      });
    }
  },
);

// @route   GET /api/clerk-auth/me
// @desc    Get current user profile
// @access  Private (requires Clerk token)
router.get(
  "/me",
  clerkAuth,
  async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
  ): Promise<void> => {
    try {
      const clerkUserId = req.userId!;

      // Get user from local database
      const localUser = await User.findOne({ clerkId: clerkUserId });

      if (!localUser) {
        res.status(404).json({
          success: false,
          message:
            "User not found in local database. Please sync your profile first.",
        });
        return;
      }

      // Get fresh data from Clerk
      const clerkUser = await clerkClient.users.getUser(clerkUserId);

      res.json({
        success: true,
        data: {
          user: {
            id: localUser._id,
            clerkId: localUser.clerkId,
            name: localUser.name,
            email: localUser.email,
            firstName: localUser.firstName,
            lastName: localUser.lastName,
            role: localUser.role,
            isActive: localUser.isActive,
            createdAt: localUser.createdAt,
            lastLogin: localUser.lastLogin,
            // Include some Clerk-specific data
            clerk: {
              profileImageUrl: clerkUser.profileImageUrl,
              emailVerified:
                clerkUser.emailAddresses[0]?.verification?.status ===
                "verified",
              lastSignInAt: clerkUser.lastSignInAt,
            },
          },
        },
      });
    } catch (error) {
      console.error("Get user profile error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get user profile",
      });
    }
  },
);

// @route   PUT /api/clerk-auth/profile
// @desc    Update user profile in local database
// @access  Private (requires Clerk token)
router.put(
  "/profile",
  clerkAuth,
  async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
  ): Promise<void> => {
    try {
      const clerkUserId = req.userId!;
      const { preferences, bio, website } = req.body;

      // Find and update user in local database
      const localUser = await User.findOneAndUpdate(
        { clerkId: clerkUserId },
        {
          ...(preferences && { preferences }),
          ...(bio && { bio }),
          ...(website && { website }),
          lastLogin: new Date(),
        },
        { new: true, select: "-password" },
      );

      if (!localUser) {
        res.status(404).json({
          success: false,
          message: "User not found in local database",
        });
        return;
      }

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: { user: localUser },
      });
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update profile",
      });
    }
  },
);

// @route   POST /api/clerk-auth/webhook
// @desc    Handle Clerk webhooks for user events
// @access  Public (webhook)
router.post("/webhook", async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, data } = req.body;

    switch (type) {
      case "user.created":
        // Handle new user creation
        console.log("New user created:", data.id);
        break;

      case "user.updated":
        // Handle user updates
        const user = await User.findOne({ clerkId: data.id });
        if (user) {
          user.email = data.email_addresses[0]?.email_address || user.email;
          user.firstName = data.first_name || user.firstName;
          user.lastName = data.last_name || user.lastName;
          user.name =
            `${data.first_name} ${data.last_name}`.trim() || user.name;
          await user.save();
        }
        break;

      case "user.deleted":
        // Handle user deletion
        await User.findOneAndUpdate(
          { clerkId: data.id },
          { isActive: false, deletedAt: new Date() },
        );
        break;
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
