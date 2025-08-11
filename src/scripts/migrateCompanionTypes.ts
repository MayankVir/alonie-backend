import mongoose from "mongoose";
import Companion from "../models/Companion";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const migrateCompanionTypes = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI not found in environment variables");
    }

    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    // Update all companions that don't have a type field
    const result = await Companion.updateMany(
      { type: { $exists: false } },
      { $set: { type: "custom" } },
    );

    console.log(
      `Migration completed: ${result.modifiedCount} companions updated`,
    );

    // Close the connection
    await mongoose.connection.close();
    console.log("Database connection closed");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

// Run the migration
if (require.main === module) {
  migrateCompanionTypes()
    .then(() => {
      console.log("Migration script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration script failed:", error);
      process.exit(1);
    });
}

export default migrateCompanionTypes;
