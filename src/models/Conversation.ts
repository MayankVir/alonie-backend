import mongoose, { Schema, Document } from "mongoose";

export interface IConversation extends Document {
  _id: string;
  userId: string;
  companionId: string;
  title?: string;
  lastMessageAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>({
  userId: {
    type: String,
    required: [true, "User ID is required"],
    index: true,
  },
  companionId: {
    type: String,
    required: [true, "Companion ID is required"],
    index: true,
  },
  title: {
    type: String,
    trim: true,
    maxlength: [100, "Title cannot be more than 100 characters"],
  },
  lastMessageAt: {
    type: Date,
    default: Date.now,
    index: true,
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
conversationSchema.pre<IConversation>("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Compound indexes for better query performance
conversationSchema.index({ userId: 1, companionId: 1 }, { unique: true });
conversationSchema.index({ userId: 1, lastMessageAt: -1 });
conversationSchema.index({ userId: 1, isActive: 1, lastMessageAt: -1 });

export default mongoose.model<IConversation>(
  "Conversation",
  conversationSchema,
);
