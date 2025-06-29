import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { body, validationResult, ValidationError } from "express-validator";
import User from "../models/User";
import auth from "../middleware/auth";
import {
  RegisterRequest,
  LoginRequest,
  ApiResponse,
  JWTSignOptions,
} from "../types";

const router = express.Router();

// Generate JWT Token
const generateToken = (id: string): string => {
  return jwt.sign({ id }, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRE || "30d",
  } as jwt.SignOptions);
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Please enter a valid email"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
  ],
  async (
    req: Request<{}, ApiResponse, RegisterRequest>,
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

      const { name, email, password } = req.body;

      // Check if user already exists
      let user = await User.findOne({ email });
      if (user) {
        res.status(400).json({
          success: false,
          message: "User already exists with this email",
        });
        return;
      }

      // Create new user
      user = new User({
        name,
        email,
        password,
      });

      await user.save();

      // Generate token
      const token = generateToken(user._id.toString());

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          token,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        },
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

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Please enter a valid email"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (
    req: Request<{}, ApiResponse, LoginRequest>,
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

      const { email, password } = req.body;

      // Check if user exists and get password
      const user = await User.findOne({ email, isActive: true }).select(
        "+password",
      );
      if (!user) {
        res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
        return;
      }

      // Check password
      if (!user.matchPassword) {
        res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
        return;
      }

      const isMatch = await (user as any).matchPassword(password);
      if (!isMatch) {
        res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
        return;
      }

      // Generate token
      const token = generateToken(user._id.toString());

      res.json({
        success: true,
        message: "Login successful",
        data: {
          token,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        },
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

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
router.get(
  "/me",
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

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post(
  "/logout",
  auth,
  (req: Request, res: Response<ApiResponse>): void => {
    res.json({
      success: true,
      message:
        "Logout successful. Please remove the token from client-side storage.",
    });
  },
);

export default router;
