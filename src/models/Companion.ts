import mongoose, { Schema } from "mongoose";
import { ICompanion } from "../types";

const companionSchema = new Schema<ICompanion>({
  name: {
    type: String,
    required: [true, "Companion name is required"],
    trim: true,
    maxlength: [100, "Name cannot be more than 100 characters"],
  },
  description: {
    type: String,
    required: [true, "Description is required"],
    trim: true,
    maxlength: [500, "Description cannot be more than 500 characters"],
  },
  personality: {
    type: String,
    required: [true, "Personality is required"],
    trim: true,
    maxlength: [1000, "Personality cannot be more than 1000 characters"],
  },
  avatar: {
    type: String,
    default: "",
    trim: true,
  },
  category: {
    type: String,
    required: [true, "Category is required"],
    trim: true,
    maxlength: [50, "Category cannot be more than 50 characters"],
  },
  instructions: {
    type: String,
    default: "",
    trim: true,
    maxlength: [2000, "Instructions cannot be more than 2000 characters"],
  },
  seed: {
    type: String,
    default: "",
    trim: true,
    maxlength: [200, "Seed cannot be more than 200 characters"],
  },
  userId: {
    type: String,
    required: [true, "User ID is required"],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field before saving
companionSchema.pre<ICompanion>("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Index for better query performance
companionSchema.index({ userId: 1, isActive: 1 });
companionSchema.index({ name: 1, userId: 1 });

export default mongoose.model<ICompanion>("Companion", companionSchema);
