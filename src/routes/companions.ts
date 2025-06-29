import express, { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import Companion from "../models/Companion";
import clerkAuth from "../middleware/clerkAuth";
import {
  CreateCompanionRequest,
  UpdateCompanionRequest,
  ApiResponse,
} from "../types";

const router = express.Router();

// @route   GET /api/companions
// @desc    Get all companions for the authenticated user
// @access  Private
router.get(
  "/",
  clerkAuth,
  async (req: Request, res: Response<ApiResponse>): Promise<void> => {
    try {
      const companions = await Companion.find({
        userId: req.userId!,
        isActive: true,
      }).sort({ createdAt: -1 });

      res.json({
        success: true,
        count: companions.length,
        data: companions,
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

// @route   GET /api/companions/:id
// @desc    Get companion by ID
// @access  Private
router.get(
  "/:id",
  clerkAuth,
  async (
    req: Request<{ id: string }>,
    res: Response<ApiResponse>,
  ): Promise<void> => {
    try {
      const companion = await Companion.findOne({
        _id: req.params.id,
        userId: req.userId!,
        isActive: true,
      });

      if (!companion) {
        res.status(404).json({
          success: false,
          message: "Companion not found",
        });
        return;
      }

      res.json({
        success: true,
        data: companion,
      });
    } catch (error) {
      console.error((error as Error).message);
      if ((error as any).kind === "ObjectId") {
        res.status(404).json({
          success: false,
          message: "Companion not found",
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

// @route   POST /api/companions
// @desc    Create a new companion
// @access  Private
router.post(
  "/",
  clerkAuth,
  [
    body("name")
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Name must be between 1 and 100 characters"),
    body("description")
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage("Description must be between 1 and 500 characters"),
    body("personality")
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage("Personality must be between 1 and 1000 characters"),
    body("category")
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage("Category must be between 1 and 50 characters"),
    body("avatar").optional().isURL().withMessage("Avatar must be a valid URL"),
    body("instructions")
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage("Instructions cannot be more than 2000 characters"),
    body("seed")
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage("Seed cannot be more than 200 characters"),
  ],
  async (
    req: Request<{}, ApiResponse, CreateCompanionRequest>,
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

      const {
        name,
        description,
        personality,
        avatar,
        category,
        instructions,
        seed,
      } = req.body;

      // Check if companion with same name already exists for this user
      const existingCompanion = await Companion.findOne({
        name,
        userId: req.userId!,
        isActive: true,
      });

      if (existingCompanion) {
        res.status(400).json({
          success: false,
          message: "A companion with this name already exists",
        });
        return;
      }

      const companion = new Companion({
        name,
        description,
        personality,
        avatar: avatar || "",
        category,
        instructions: instructions || "",
        seed: seed || "",
        userId: req.userId!,
      });

      const savedCompanion = await companion.save();

      res.status(201).json({
        success: true,
        message: "Companion created successfully",
        data: savedCompanion,
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

// @route   PUT /api/companions/:id
// @desc    Update companion
// @access  Private
router.put(
  "/:id",
  clerkAuth,
  [
    body("name")
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Name must be between 1 and 100 characters"),
    body("description")
      .optional()
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage("Description must be between 1 and 500 characters"),
    body("personality")
      .optional()
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage("Personality must be between 1 and 1000 characters"),
    body("category")
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage("Category must be between 1 and 50 characters"),
    body("avatar").optional().isURL().withMessage("Avatar must be a valid URL"),
    body("instructions")
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage("Instructions cannot be more than 2000 characters"),
    body("seed")
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage("Seed cannot be more than 200 characters"),
  ],
  async (
    req: Request<{ id: string }, ApiResponse, UpdateCompanionRequest>,
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

      const {
        name,
        description,
        personality,
        avatar,
        category,
        instructions,
        seed,
      } = req.body;
      const updateFields: Partial<UpdateCompanionRequest> = {};

      if (name !== undefined) updateFields.name = name;
      if (description !== undefined) updateFields.description = description;
      if (personality !== undefined) updateFields.personality = personality;
      if (avatar !== undefined) updateFields.avatar = avatar;
      if (category !== undefined) updateFields.category = category;
      if (instructions !== undefined) updateFields.instructions = instructions;
      if (seed !== undefined) updateFields.seed = seed;

      // Check if companion with same name already exists for this user (excluding current companion)
      if (name) {
        const existingCompanion = await Companion.findOne({
          name,
          userId: req.userId!,
          isActive: true,
          _id: { $ne: req.params.id },
        });

        if (existingCompanion) {
          res.status(400).json({
            success: false,
            message: "A companion with this name already exists",
          });
          return;
        }
      }

      const companion = await Companion.findOneAndUpdate(
        {
          _id: req.params.id,
          userId: req.userId!,
          isActive: true,
        },
        updateFields,
        { new: true, runValidators: true },
      );

      if (!companion) {
        res.status(404).json({
          success: false,
          message: "Companion not found",
        });
        return;
      }

      res.json({
        success: true,
        message: "Companion updated successfully",
        data: companion,
      });
    } catch (error) {
      console.error((error as Error).message);
      if ((error as any).kind === "ObjectId") {
        res.status(404).json({
          success: false,
          message: "Companion not found",
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

// @route   DELETE /api/companions/:id
// @desc    Delete companion (soft delete)
// @access  Private
router.delete(
  "/:id",
  clerkAuth,
  async (
    req: Request<{ id: string }>,
    res: Response<ApiResponse>,
  ): Promise<void> => {
    try {
      const companion = await Companion.findOne({
        _id: req.params.id,
        userId: req.userId!,
        isActive: true,
      });

      if (!companion) {
        res.status(404).json({
          success: false,
          message: "Companion not found",
        });
        return;
      }

      // Soft delete - set isActive to false
      await Companion.findByIdAndUpdate(req.params.id, { isActive: false });

      res.json({
        success: true,
        message: "Companion deleted successfully",
      });
    } catch (error) {
      console.error((error as Error).message);
      if ((error as any).kind === "ObjectId") {
        res.status(404).json({
          success: false,
          message: "Companion not found",
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
