import express, { Application, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { sendError } from "./utils/corsHelper";

// Import routes
import userRoutes from "./routes/users";
import authRoutes from "./routes/auth";
import clerkAuthRoutes from "./routes/clerkAuth";
import companionRoutes from "./routes/companions";
import chatRoutes from "./routes/chat";

// Load environment variables
dotenv.config();

const app: Application = express();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});

app.use(limiter);

// CORS configuration
const corsOptions = {
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));

// Handle preflight requests globally
app.options("*", (req: Request, res: Response) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,DELETE,PATCH,OPTIONS",
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type,Authorization,X-Requested-With",
  );
  res.sendStatus(200);
});

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// MongoDB connection
const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/alonie",
    );
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

// Connect to database
connectDB();

// Routes
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/clerk-auth", clerkAuthRoutes);
app.use("/api/companions", companionRoutes);
app.use("/api/chat", chatRoutes);

// Health check endpoint
app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Default route
app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "Welcome to Alonie Backend API",
    version: "1.0.0",
    endpoints: {
      health: "/api/health",
      users: "/api/users",
      auth: "/api/auth",
      clerkAuth: "/api/clerk-auth",
      companions: "/api/companions",
      chat: "/api/chat",
    },
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  const message =
    process.env.NODE_ENV === "development"
      ? err.message
      : "Internal Server Error";
  sendError(res, 500, message);
});

// 404 handler
app.use("*", (req: Request, res: Response) => {
  sendError(
    res,
    404,
    `The route ${req.originalUrl} does not exist on this server`,
  );
});

const PORT: number = parseInt(process.env.PORT || "3001", 10);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
