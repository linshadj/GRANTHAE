const DEFAULT_MESSAGE = "Something went wrong. Please try again.";
const MAX_ADMIN_UPLOAD_MB = 5;

const TECHNICAL_MESSAGE_PATTERNS = [
  /buffering timed out/i,
  /cannot read/i,
  /cast to .* failed/i,
  /e11000/i,
  /mongo/i,
  /mongoose/i,
  /next is not a function/i,
  /objectid/i,
  /validation failed/i,
];

export const getFriendlyErrorMessage = (error, fallback = DEFAULT_MESSAGE) => {
  if (!error) return fallback;

  if (error.userMessage) return error.userMessage;
  if (error.code === "LIMIT_FILE_SIZE") return `Each image must be ${MAX_ADMIN_UPLOAD_MB}MB or smaller.`;
  if (error.code === "LIMIT_FILE_COUNT") return "Too many images selected.";
  if (error.code === "LIMIT_UNEXPECTED_FILE") return "Unexpected image upload field.";
  if (error.code === 11000) return "A record with these details already exists.";
  if (error.name === "ValidationError") {
    return Object.values(error.errors || {})[0]?.message || "Please check the entered details.";
  }
  if (error.name === "CastError") return "Invalid request details.";
  if (error.name === "MongooseServerSelectionError") return "Service is temporarily unavailable. Please try again.";

  const message = String(error.message || "").trim();
  if (!message) return fallback;

  const isTechnicalMessage = TECHNICAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
  return isTechnicalMessage ? fallback : message;
};
