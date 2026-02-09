/**
 * Authentication Middleware
 * Validates API key from header or environment variable
 * Set API_KEY env var to enable authentication (if not set, auth is disabled)
 */

export function authMiddleware(req, res, next) {
  // Skip auth for health check and WebSocket upgrades
  if (req.path === "/health" || req.headers.upgrade === "websocket") {
    return next();
  }

  const apiKey = process.env.API_KEY;

  // If no API key is configured, skip auth
  if (!apiKey) {
    return next();
  }

  // Check for API key in headers
  const providedKey = req.headers["x-api-key"];

  if (!providedKey || providedKey !== apiKey) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing or invalid X-API-Key header"
    });
  }

  next();
}
