import { Request } from "express";
import { Document } from "mongoose";

// User interface for MongoDB document
export interface IUser extends Document {
  _id: string;
  name: string;
  email: string;
  password?: string; // Make optional for Clerk users
  role: "user" | "admin";
  isActive: boolean;
  avatar: string;
  // Clerk-specific fields
  clerkId?: string;
  firstName?: string;
  lastName?: string;
  lastLogin?: Date;
  bio?: string;
  website?: string;
  preferences?: any;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  matchPassword?(enteredPassword: string): Promise<boolean>;
}

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

// API Response interface
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Array<{
    field: string;
    message: string;
  }>;
  count?: number;
}

// Login request body
export interface LoginRequest {
  email: string;
  password: string;
}

// Register request body
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

// User profile update request
export interface UpdateProfileRequest {
  name?: string;
  email?: string;
  avatar?: string;
}

// JWT payload
export interface JWTPayload {
  id: string;
  iat?: number;
  exp?: number;
}

// JWT sign options
export interface JWTSignOptions {
  expiresIn: string | number;
}

// Environment variables interface
export interface EnvironmentVariables {
  NODE_ENV: string;
  PORT: string;
  MONGODB_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRE: string;
  FRONTEND_URL: string;
}
