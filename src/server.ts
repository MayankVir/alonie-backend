import express, { Application, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

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
  origin: function (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) {
    // Log the origin for debugging
    console.log(`CORS check for origin: ${origin || "undefined"}`);

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // In development, allow common frontend ports
    if (process.env.NODE_ENV === "development") {
      const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:8080", // Vue CLI default
        process.env.FRONTEND_URL,
      ].filter((url): url is string => Boolean(url)); // Type-safe filter

      console.log("Allowed origins in development:", allowedOrigins);

      if (
        allowedOrigins.some((allowedOrigin) => origin.startsWith(allowedOrigin))
      ) {
        console.log(`✅ CORS allowed for origin: ${origin}`);
        return callback(null, true);
      }
    } else {
      // In production, only allow the configured frontend URL
      if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
        console.log(`CORS allowed for production origin: ${origin}`);
        return callback(null, true);
      }
    }

    console.log(`CORS blocked for origin: ${origin}`);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));

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
  res.status(500).json({
    error: "Something went wrong!",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal Server Error",
  });
});

// 404 handler
app.use("*", (req: Request, res: Response) => {
  res.status(404).json({
    error: "Route not found",
    message: `The route ${req.originalUrl} does not exist on this server`,
  });
});

const PORT: number = parseInt(process.env.PORT || "3001", 10);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
