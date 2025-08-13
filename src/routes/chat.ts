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

type AIModel = "openai" | "gemini";

interface ChatRequest {
  companionId: string;
  message: string;
  model?: AIModel;
  conversationHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

// AI Service interfaces
interface AIServiceConfig {
  model: string;
  maxTokens: number;
  temperature: number;
}

// OpenAI specific interfaces
interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIRequestBody {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAIChoice {
  index: number;
  message: {
    role: "assistant";
    content: string;
  };
  finish_reason: "stop" | "length" | "function_call" | "content_filter" | null;
}

interface OpenAIResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: OpenAIUsage;
}

interface OpenAIErrorResponse {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}

type OpenAIConfig = AIServiceConfig;
type GeminiConfig = AIServiceConfig;

// Gemini specific interfaces
interface GeminiContent {
  parts: Array<{
    text: string;
  }>;
}

interface GeminiRequestBody {
  contents: GeminiContent[];
  generationConfig?: {
    temperature: number;
    maxOutputTokens: number;
    topP: number;
    topK: number;
  };
}

interface GeminiCandidate {
  content: {
    parts: Array<{
      text: string;
    }>;
    role: string;
  };
  finishReason: string;
  index: number;
  safetyRatings: Array<{
    category: string;
    probability: string;
  }>;
}

interface GeminiResponse {
  candidates: GeminiCandidate[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

interface GeminiErrorResponse {
  error: {
    code: number;
    message: string;
    status: string;
  };
}

// Helper function to get random dummy response
function getRandomDummyResponse(): string {
  const randomIndex = Math.floor(Math.random() * dummyResponses.length);
  return dummyResponses[randomIndex];
}

// Helper function to build system prompt
function buildSystemPrompt(companion: any): string {
  return `You are ${
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
}

// Helper function to get OpenAI response
async function getOpenAIResponse(
  companion: any,
  userMessage: string,
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<{ response: string; metadata: any }> {
  const fetch = require("node-fetch");

  const systemPrompt = buildSystemPrompt(companion);

  // Build messages array with conversation history
  const messages: OpenAIMessage[] = [{ role: "system", content: systemPrompt }];

  // Add conversation history if provided
  if (conversationHistory && conversationHistory.length > 0) {
    // Take last 10 messages to avoid token limits
    const recentHistory = conversationHistory.slice(-10);
    messages.push(...recentHistory);
  }

  // Add current user message
  messages.push({ role: "user", content: userMessage });

  const config: OpenAIConfig = {
    model: (process.env.OPENAI_MODEL as string) || "gpt-3.5-turbo",
    maxTokens: 200,
    temperature: 0.7,
  };

  const requestBody: OpenAIRequestBody = {
    model: config.model,
    messages: messages,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
  };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      try {
        // Read response body as text first to avoid "body used already" error
        const responseText = await response.text();

        try {
          // Try to parse as JSON
          const errorData: OpenAIErrorResponse = JSON.parse(responseText);
          throw new Error(
            `OpenAI API error: ${response.status} - ${errorData.error.message}`,
          );
        } catch (jsonParseError) {
          // If JSON parsing fails, use the raw text
          throw new Error(
            `OpenAI API error: ${response.status} - ${responseText}`,
          );
        }
      } catch (readError) {
        // Fallback if we can't read the response at all
        throw new Error(
          `OpenAI API error: ${response.status} - Unable to read response`,
        );
      }
    }

    const data: OpenAIResponse = await response.json();

    // Validate response structure

    if (
      !data.choices ||
      !Array.isArray(data.choices) ||
      data.choices.length === 0
    ) {
      throw new Error(
        "Invalid response structure from OpenAI API - no choices",
      );
    }

    const choice = data.choices[0];
    if (!choice.message || !choice.message.content) {
      throw new Error(
        "Invalid response structure from OpenAI API - no message content",
      );
    }

    const responseContent = choice.message.content.trim();
    if (responseContent === "") {
      throw new Error("Empty response from OpenAI API");
    }

    return {
      response: responseContent,
      metadata: {
        model: data.model,
        usage: data.usage,
        finish_reason: choice.finish_reason,
        response_id: data.id,
        created: data.created,
      },
    };
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error(
      `Failed to get response from OpenAI model: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

// Helper function to get Gemini response
async function getGeminiResponse(
  companion: any,
  userMessage: string,
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<{ response: string; metadata: any }> {
  const fetch = require("node-fetch");

  const systemPrompt = buildSystemPrompt(companion);

  // Build conversation context for Gemini
  let conversationContext = systemPrompt + "\n\n";

  if (conversationHistory && conversationHistory.length > 0) {
    // Take last 10 messages to avoid token limits
    const recentHistory = conversationHistory.slice(-10);
    conversationContext += "Previous conversation:\n";
    recentHistory.forEach((msg) => {
      conversationContext += `${msg.role === "user" ? "User" : "Assistant"}: ${
        msg.content
      }\n`;
    });
    conversationContext += "\n";
  }

  conversationContext += `User: ${userMessage}\nAssistant:`;

  const config: GeminiConfig = {
    model: (process.env.GEMINI_MODEL as string) || "gemini-1.5-flash",
    maxTokens: 200,
    temperature: 0.7,
  };

  const requestBody: GeminiRequestBody = {
    contents: [
      {
        parts: [
          {
            text: conversationContext,
          },
        ],
      },
    ],
    // generationConfig: {
    //   temperature: config.temperature,
    //   maxOutputTokens: config.maxTokens,
    //   topP: 0.95,
    //   topK: 64,
    // },
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
    );

    console.log({ response: JSON.stringify(response) });

    if (!response.ok) {
      try {
        // Read response body as text first to avoid "body used already" error
        const responseText = await response.text();

        console.log({ responseText });

        try {
          // Try to parse as JSON
          const errorData: GeminiErrorResponse = JSON.parse(responseText);
          throw new Error(
            `Gemini API error: ${response.status} - ${errorData.error.message}`,
          );
        } catch (jsonParseError) {
          // If JSON parsing fails, use the raw text
          throw new Error(
            `Gemini API error: ${response.status} - ${responseText}`,
          );
        }
      } catch (readError) {
        // Fallback if we can't read the response at all
        throw new Error(
          `Gemini API error: ${response.status} - Unable to read response`,
        );
      }
    }

    const data: GeminiResponse = await response.json();

    console.log({ data: JSON.stringify(data) });

    // Validate response structure
    if (
      !data.candidates ||
      !Array.isArray(data.candidates) ||
      data.candidates.length === 0
    ) {
      throw new Error(
        "Invalid response structure from Gemini API - no candidates",
      );
    }

    const candidate = data.candidates[0];
    if (
      !candidate.content ||
      !candidate.content.parts ||
      candidate.content.parts.length === 0
    ) {
      // Check if this is due to a specific finish reason
      if (candidate.finishReason === "MAX_TOKENS") {
        throw new Error(
          "Response was truncated due to token limit. Try reducing the conversation history or using a shorter prompt.",
        );
      } else if (candidate.finishReason === "SAFETY") {
        throw new Error(
          "Response was blocked due to safety filters. Please try rephrasing your message.",
        );
      } else if (candidate.finishReason === "RECITATION") {
        throw new Error(
          "Response was blocked due to recitation concerns. Please try a different message.",
        );
      } else {
        throw new Error(
          `Invalid response structure from Gemini API - no content parts (finish reason: ${candidate.finishReason})`,
        );
      }
    }

    const generatedText = candidate.content.parts[0].text;
    if (!generatedText) {
      throw new Error("No text generated from Gemini API");
    }

    const trimmedResponse = generatedText.trim();
    if (trimmedResponse === "") {
      throw new Error("Empty response from Gemini API");
    }

    return {
      response: trimmedResponse,
      metadata: {
        model: config.model,
        finishReason: candidate.finishReason,
        safetyRatings: candidate.safetyRatings,
        usage: data.usageMetadata,
        index: candidate.index,
      },
    };
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error(
      `Failed to get response from Gemini model: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
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

      // Verify companion exists and belongs to user or is default
      const companion = await Companion.findOne({
        _id: companionId,
        $or: [{ userId: req.userId! }, { isDefault: true }],
        isActive: true,
      });

      if (!companion) {
        res.status(404).json({
          success: false,
          message: "Companion not found",
        });
        return;
      }

      // Find conversation
      const conversation = await Conversation.findOne({
        userId: req.userId!,
        companionId,
        isActive: true,
      });

      if (!conversation) {
        res.json({
          success: true,
          data: [],
          message: "No conversation found",
        });
        return;
      }

      // Get messages with pagination
      const skip = (Number(page) - 1) * Number(limit);
      const messages = await Message.find({
        conversationId: conversation._id,
      })
        .sort({ timestamp: -1 }) // Most recent first for pagination
        .skip(skip)
        .limit(Number(limit))
        .lean();

      // Reverse to show oldest first in chat
      const reversedMessages = messages.reverse();

      res.json({
        success: true,
        data: reversedMessages,
        count: reversedMessages.length,
      });
    } catch (error) {
      console.error("Error fetching conversation history:", error);
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
      console.error("Error fetching conversations:", error);
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
    body("model")
      .optional()
      .isIn(["openai", "gemini"])
      .withMessage("Model must be either 'openai' or 'gemini'"),
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

      const {
        companionId,
        message,
        model = "openai",
        conversationHistory,
      } = req.body;

      // Verify companion exists and belongs to user or is default
      const companion = await Companion.findOne({
        _id: companionId,
        $or: [{ userId: req.userId! }, { isDefault: true }],
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

      // Get AI response based on selected model
      let response: string;
      let responseMetadata: any = {};

      try {
        if (model === "gemini" && process.env.GEMINI_API_KEY) {
          const result = await getGeminiResponse(
            companion,
            message,
            conversationHistory,
          );
          response = result.response;
          responseMetadata = { model: "gemini", ...result.metadata };
        } else if (model === "openai" && process.env.OPENAI_API_KEY) {
          const result = await getOpenAIResponse(
            companion,
            message,
            conversationHistory,
          );
          response = result.response;
          responseMetadata = { model: "openai", ...result.metadata };
        } else {
          // Return error if no API keys available
          res.status(500).json({
            success: false,
            message: "No API keys configured for the selected model",
            errors: [
              {
                field: "model",
                message: "API_KEY_MISSING",
              },
            ],
          });
          return;
        }
      } catch (error) {
        console.error(`${model} API error:`, error);
        // Return error instead of dummy response
        res.status(500).json({
          success: false,
          message: `Failed to get response from ${model} model`,
          errors: [
            {
              field: "model",
              message: error instanceof Error ? error.message : "Unknown error",
            },
          ],
        });
        return;
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
          conversationId: conversation._id,
          metadata: responseMetadata,
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

export default router;
