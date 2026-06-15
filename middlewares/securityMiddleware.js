import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

const isProduction = process.env.NODE_ENV === "production";

const wantsJsonResponse = (req) => req.xhr
  || req.headers.accept?.includes("application/json")
  || req.headers["content-type"]?.includes("application/json")
  || req.headers["content-type"]?.includes("multipart/form-data");

const rateLimitResponse = (message) => ({
  success: false,
  message,
});

const createRateLimiter = ({ windowMs, limit, message }) => rateLimit({
  windowMs,
  limit,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
  handler: (req, res) => {
    if (wantsJsonResponse(req)) {
      return res.status(429).json(rateLimitResponse(message));
    }

    return res
      .status(429)
      .type("html")
      .send(`<!doctype html><title>Too Many Requests</title><h1>Too Many Requests</h1><p>${message}</p>`);
  },
});

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      objectSrc: ["'none'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://unpkg.com",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://checkout.razorpay.com",
        "https://*.razorpay.com",
      ],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com",
        "https://*.razorpay.com",
      ],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://res.cloudinary.com",
        "https://www.svgrepo.com",
        "https://*.googleusercontent.com",
        "https://*.razorpay.com",
      ],
      connectSrc: [
        "'self'",
        "https://checkout.razorpay.com",
        "https://*.razorpay.com",
      ],
      frameSrc: [
        "'self'",
        "https://api.razorpay.com",
        "https://checkout.razorpay.com",
        "https://*.razorpay.com",
      ],
      upgradeInsecureRequests: isProduction ? [] : null,
    },
  },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginEmbedderPolicy: false,
});

export const generalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  message: "Too many requests from this network. Please wait a few minutes and try again.",
});

export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  message: "Too many authentication attempts. Please wait 15 minutes and try again.",
});

export const otpLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 6,
  message: "Too many OTP attempts. Please wait before trying again.",
});

export const writeLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  message: "Too many actions in a short period. Please slow down and try again.",
});

export const checkoutLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  message: "Too many checkout or payment attempts. Please wait and try again.",
});

export const adminWriteLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: "Too many admin actions in a short period. Please wait and try again.",
});
