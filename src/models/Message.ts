import mongoose, { Schema, Document } from "mongoose";

export interface IMessage extends Document {
  _id: string;
  conversationId: string;
  userId: string;
  companionId: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  createdAt: Date;
}

const messageSchema = new Schema<IMessage>({
  conversationId: {
    type: String,
    required: [true, "Conversation ID is required"],
    index: true,
  },
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
  content: {
    type: String,
    required: [true, "Message content is required"],
    trim: true,
    maxlength: [2000, "Message cannot be more than 2000 characters"],
  },
  isUser: {
    type: Boolean,
    required: [true, "Message type (user/companion) is required"],
    index: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound indexes for better query performance
messageSchema.index({ conversationId: 1, timestamp: 1 });
messageSchema.index({ userId: 1, timestamp: -1 });
messageSchema.index({ companionId: 1, timestamp: -1 });

export default mongoose.model<IMessage>("Message", messageSchema);
