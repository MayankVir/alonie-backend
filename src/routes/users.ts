import express, { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import User from "../models/User";
import auth from "../middleware/auth";
import { UpdateProfileRequest, ApiResponse } from "../types";
import { sendError, sendSuccess } from "../utils/corsHelper";

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Private/Admin
router.get(
  "/",
  auth,
  async (req: Request, res: Response<ApiResponse>): Promise<void> => {
    try {
      // Check if user is admin
      if (req.user!.role !== "admin") {
        sendError(res, 403, "Access denied. Admin only.");
        return;
      }

      const users = await User.find({ isActive: true }).select("-password");
      sendSuccess(res, users, `Found ${users.length} users`);
    } catch (error) {
      console.error((error as Error).message);
      sendError(res, 500, "Server error");
    }
  },
);

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get(
  "/profile",
  auth,
  async (req: Request, res: Response<ApiResponse>): Promise<void> => {
    try {
      const user = await User.findById(req.user!.id).select("-password");
      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }
      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      console.error((error as Error).message);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  },
);

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get(
  "/:id",
  auth,
  async (
    req: Request<{ id: string }>,
    res: Response<ApiResponse>,
  ): Promise<void> => {
    try {
      const user = await User.findById(req.params.id).select("-password");
      if (!user) {
        sendError(res, 404, "User not found");
        return;
      }
      sendSuccess(res, user);
    } catch (error) {
      console.error((error as Error).message);
      if ((error as any).kind === "ObjectId") {
        sendError(res, 404, "User not found");
        return;
      }
      sendError(res, 500, "Server error");
    }
  },
);

// @route   PUT /api/users/profile
// @desc    Update current user profile
// @access  Private
router.put(
  "/profile",
  auth,
  [
    body("name")
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage("Name must be between 1 and 50 characters"),
    body("email")
      .optional()
      .isEmail()
      .withMessage("Please enter a valid email"),
    body("avatar").optional().isURL().withMessage("Avatar must be a valid URL"),
  ],
  async (
    req: Request<{}, ApiResponse, UpdateProfileRequest>,
    res: Response<ApiResponse>,
  ): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array().map((err) => ({
            field: (err as any).path || (err as any).param || "unknown",
            message: err.msg,
          })),
        });
        return;
      }

      const { name, email, avatar } = req.body;
      const updateFields: Partial<UpdateProfileRequest> = {};

      if (name) updateFields.name = name;
      if (email) updateFields.email = email;
      if (avatar) updateFields.avatar = avatar;

      const user = await User.findByIdAndUpdate(req.user!.id, updateFields, {
        new: true,
        runValidators: true,
      }).select("-password");

      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      console.error((error as Error).message);
      if ((error as any).code === 11000) {
        res.status(400).json({
          success: false,
          message: "Email already exists",
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  },
);

// @route   DELETE /api/users/:id
// @desc    Delete user (admin only)
// @access  Private/Admin
router.delete(
  "/:id",
  auth,
  async (
    req: Request<{ id: string }>,
    res: Response<ApiResponse>,
  ): Promise<void> => {
    try {
      // Check if user is admin
      if (req.user!.role !== "admin") {
        res.status(403).json({
          success: false,
          message: "Access denied. Admin only.",
        });
        return;
      }

      const user = await User.findById(req.params.id);
      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      // Soft delete - set isActive to false
      await User.findByIdAndUpdate(req.params.id, { isActive: false });

      res.json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      console.error((error as Error).message);
      if ((error as any).kind === "ObjectId") {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  },
);

export default router;
