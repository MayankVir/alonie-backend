import { Response } from "express";

// CORS headers that should be set on all responses
const setCorsHeaders = (res: Response) => {
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
};

// Helper function to send JSON responses with CORS headers
export const sendJsonResponse = (
  res: Response,
  statusCode: number,
  data: any,
) => {
  setCorsHeaders(res);
  return res.status(statusCode).json(data);
};

// Helper functions for common response types
export const sendError = (
  res: Response,
  statusCode: number,
  message: string,
  errors?: any[],
) => {
  return sendJsonResponse(res, statusCode, {
    success: false,
    message,
    ...(errors && { errors }),
  });
};

export const sendSuccess = (res: Response, data?: any, message?: string) => {
  return sendJsonResponse(res, 200, {
    success: true,
    ...(message && { message }),
    ...(data && { data }),
  });
};

export const sendValidationError = (res: Response, errors: any[]) => {
  return sendJsonResponse(res, 400, {
    success: false,
    errors: errors.map((err) => ({
      field: (err as any).path || (err as any).param || "unknown",
      message: err.msg,
    })),
  });
};
