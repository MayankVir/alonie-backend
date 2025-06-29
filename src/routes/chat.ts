import express, { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import clerkAuth from "../middleware/clerkAuth";
import Companion from "../models/Companion";
import Conversation from "../models/Conversation";
import Message from "../models/Message";
import { ApiResponse } from "../types";

const router = express.Router();

// Array of dummy responses for AI companion
const dummyResponses = [
  "That's really interesting! Tell me more about how you're feeling.",
  "I understand what you're going through. It's completely normal to feel this way.",
  "Thank you for sharing that with me. I'm here to listen and support you.",
  "That sounds challenging. How are you coping with the situation?",
  "I appreciate you opening up to me. Your feelings are valid.",
  "What you're experiencing is more common than you might think.",
  "I'm here to help you work through this. What would be most helpful right now?",
  "That must be difficult for you. I'm glad you're talking about it.",
  "You're showing great courage by discussing this. How can I best support you?",
  "I hear you, and I want you to know that you're not alone in this.",
  "It's okay to feel overwhelmed sometimes. What usually helps you feel better?",
  "Thank you for trusting me with your thoughts. What's been on your mind lately?",
  "I can sense that this is important to you. Let's explore this together.",
  "Your perspective is valuable. I'd love to hear more about your experience.",
  "That's a thoughtful question. What do you think would help in this situation?",
];

interface ChatRequest {
  companionId: string;
  message: string;
}

// @route   GET /api/chat/:companionId/messages
// @desc    Get conversation history for a companion
// @access  Private
router.get(
  "/:companionId/messages",
  clerkAuth,
  async (req: Request, res: Response<ApiResponse>): Promise<void> => {
    try {
      const { companionId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      // Verify companion exists and belongs to user
      const companion = await Companion.findOne({
        _id: companionId,
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

      // Find or create conversation
      let conversation = await Conversation.findOne({
        userId: req.userId!,
        companionId,
        isActive: true,
      });

      if (!conversation) {
        // No conversation exists yet, return empty array
        res.json({
          success: true,
          data: [],
          count: 0,
        });
        return;
      }

      // Get messages for this conversation
      const skip = (Number(page) - 1) * Number(limit);
      const messages = await Message.find({
        conversationId: conversation._id,
      })
        .sort({ timestamp: 1 }) // Oldest first
        .skip(skip)
        .limit(Number(limit));

      const totalMessages = await Message.countDocuments({
        conversationId: conversation._id,
      });

      res.json({
        success: true,
        data: messages,
        count: totalMessages,
      });
    } catch (error) {
      console.error("Get messages error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  },
);

// @route   GET /api/chat/conversations
// @desc    Get all conversations for the current user
// @access  Private
router.get(
  "/conversations",
  clerkAuth,
  async (req: Request, res: Response<ApiResponse>): Promise<void> => {
    try {
      const { page = 1, limit = 20 } = req.query;

      // Get all conversations for the user
      const skip = (Number(page) - 1) * Number(limit);
      const conversations = await Conversation.find({
        userId: req.userId!,
        isActive: true,
      })
        .sort({ lastMessageAt: -1 }) // Most recent first
        .skip(skip)
        .limit(Number(limit))
        .lean();

      // Get companion details and last message for each conversation
      const conversationsWithDetails = await Promise.all(
        conversations.map(async (conversation) => {
          // Get companion details
          const companion = await Companion.findById(
            conversation.companionId,
          ).lean();

          // Get last message
          const lastMessage = await Message.findOne({
            conversationId: conversation._id,
          })
            .sort({ timestamp: -1 })
            .lean();

          return {
            _id: conversation._id,
            companionId: conversation.companionId,
            companion: companion,
            title: conversation.title,
            lastMessage:
              lastMessage?.content || companion?.seed || "No messages yet",
            lastMessageTime: lastMessage?.timestamp || conversation.createdAt,
            lastMessageAt: conversation.lastMessageAt,
            hasUnread: false, // TODO: Implement unread message tracking
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
          };
        }),
      );

      const totalConversations = await Conversation.countDocuments({
        userId: req.userId!,
        isActive: true,
      });

      res.json({
        success: true,
        data: conversationsWithDetails,
        count: totalConversations,
      });
    } catch (error) {
      console.error("Get conversations error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  },
);

// @route   POST /api/chat
// @desc    Send a message to a companion and get a response
// @access  Private
router.post(
  "/",
  clerkAuth,
  [
    body("companionId")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Companion ID is required"),
    body("message")
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage("Message must be between 1 and 1000 characters"),
  ],
  async (
    req: Request<{}, ApiResponse, ChatRequest>,
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

      const { companionId, message } = req.body;

      // Verify companion exists and belongs to user
      const companion = await Companion.findOne({
        _id: companionId,
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

      // Find or create conversation
      let conversation = await Conversation.findOne({
        userId: req.userId!,
        companionId,
        isActive: true,
      });

      if (!conversation) {
        conversation = new Conversation({
          userId: req.userId!,
          companionId,
          title: `Chat with ${companion.name}`,
          lastMessageAt: new Date(),
        });
        await conversation.save();
      }

      // Save user message
      const userMessage = new Message({
        conversationId: conversation._id,
        userId: req.userId!,
        companionId,
        content: message,
        isUser: true,
        timestamp: new Date(),
      });
      await userMessage.save();

      // Try OpenAI integration first, fallback to dummy responses
      let response: string;

      if (process.env.OPENAI_API_KEY) {
        try {
          response = await getOpenAIResponse(companion, message);
        } catch (error) {
          console.error("OpenAI API error:", error);
          response = getRandomDummyResponse();
        }
      } else {
        response = getRandomDummyResponse();
      }

      // Save AI response
      const aiMessage = new Message({
        conversationId: conversation._id,
        userId: req.userId!,
        companionId,
        content: response,
        isUser: false,
        timestamp: new Date(),
      });
      await aiMessage.save();

      // Update conversation's last message time
      conversation.lastMessageAt = new Date();
      await conversation.save();

      res.json({
        success: true,
        data: {
          response,
          companionId,
          timestamp: new Date().toISOString(),
          userMessage: userMessage,
          aiMessage: aiMessage,
        },
      });
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  },
);

// Helper function to get random dummy response
function getRandomDummyResponse(): string {
  const randomIndex = Math.floor(Math.random() * dummyResponses.length);
  return dummyResponses[randomIndex];
}

// Helper function to get OpenAI response
async function getOpenAIResponse(
  companion: any,
  userMessage: string,
): Promise<string> {
  const fetch = require("node-fetch");

  const systemPrompt = `You are ${
    companion.name
  }, an AI companion with the following characteristics:
- Category: ${companion.category}
- Personality: ${companion.personality}
- Description: ${companion.description}
${
  companion.instructions
    ? `- Special instructions: ${companion.instructions}`
    : ""
}

Respond to the user's message in a way that's consistent with your personality and purpose. Keep responses conversational, empathetic, and helpful. Limit responses to 150 words or less.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 200,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || getRandomDummyResponse();
}

export default router;
