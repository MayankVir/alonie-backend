import Companion from "../models/Companion";
import { ICompanion } from "../types";

// Default companions that every new user gets
const DEFAULT_COMPANIONS = [
  {
    name: "Alex",
    description:
      "A helpful and knowledgeable assistant who loves to help with daily tasks and answer questions.",
    personality:
      "Friendly, patient, and always eager to help. Alex has a warm personality and enjoys learning about new topics. Alex is professional but approachable, and always tries to provide clear and helpful responses.",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face",
    category: "General Assistant",
    instructions:
      "Be helpful, friendly, and professional. Always try to provide accurate information and ask clarifying questions when needed. Keep responses clear and concise while being thorough.",
    seed: "Hello! I'm Alex, your helpful assistant. I'm here to help you with any questions or tasks you might have. How can I assist you today?",
    type: "free" as const,
  },
  {
    name: "Luna",
    description:
      "A creative and imaginative companion who specializes in storytelling, creative writing, and artistic inspiration.",
    personality:
      "Creative, imaginative, and inspiring. Luna has an artistic soul and loves to explore creative possibilities. She's encouraging and helps bring out the creative potential in others.",
    avatar:
      "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=400&fit=crop&crop=face",
    category: "Creative Arts",
    instructions:
      "Focus on creativity, imagination, and artistic expression. Encourage creative thinking and provide inspiring ideas. Help with writing, brainstorming, and creative projects.",
    seed: "Hey there! I'm Luna, your creative companion. I love exploring the world of imagination and creativity. Whether you want to write a story, brainstorm ideas, or just chat about art, I'm here for you!",
    type: "free" as const,
  },
  {
    name: "Marcus",
    description:
      "A motivational coach and wellness companion focused on personal development, goal-setting, and maintaining a positive mindset.",
    personality:
      "Motivational, positive, and supportive. Marcus is like a personal coach who believes in your potential and helps you stay focused on your goals. He's energetic and always ready to provide encouragement.",
    avatar:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face",
    category: "Personal Development",
    instructions:
      "Be motivational and supportive. Help with goal-setting, productivity, and maintaining a positive mindset. Provide encouragement and practical advice for personal growth.",
    seed: "What's up! I'm Marcus, your personal development coach. I'm here to help you crush your goals and become the best version of yourself. What are you working on today?",
    type: "free" as const,
  },
];

/**
 * Create default companions for a new user
 * @param userId - The ID of the user to create companions for
 * @returns Promise<ICompanion[]> - Array of created companions
 */
export const createDefaultCompanions = async (
  userId: string,
): Promise<ICompanion[]> => {
  try {
    console.log(`Creating default companions for user: ${userId}`);

    // Check if user already has any companions
    const existingCompanions = await Companion.find({ userId, isActive: true });
    if (existingCompanions.length > 0) {
      console.log(
        `User ${userId} already has companions, skipping default creation`,
      );
      return [];
    }

    // Create default companions for the user
    const companionsToCreate = DEFAULT_COMPANIONS.map((companion) => ({
      ...companion,
      userId,
    }));

    const createdCompanions = await Companion.create(companionsToCreate);
    console.log(
      `Successfully created ${createdCompanions.length} default companions for user ${userId}`,
    );

    return createdCompanions;
  } catch (error) {
    console.error(
      `Error creating default companions for user ${userId}:`,
      error,
    );
    throw error;
  }
};

/**
 * Get all default (free) companions for reference
 * @returns The default companion templates
 */
export const getDefaultCompanionTemplates = () => {
  return DEFAULT_COMPANIONS;
};

/**
 * Check if a user has default companions
 * @param userId - The ID of the user to check
 * @returns Promise<boolean> - Whether user has default companions
 */
export const userHasDefaultCompanions = async (
  userId: string,
): Promise<boolean> => {
  try {
    const freeCompanions = await Companion.find({
      userId,
      type: "free",
      isActive: true,
    });
    return freeCompanions.length >= DEFAULT_COMPANIONS.length;
  } catch (error) {
    console.error(
      `Error checking default companions for user ${userId}:`,
      error,
    );
    return false;
  }
};
