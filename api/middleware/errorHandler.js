/**
 * Global Error Handler Middleware
 */

export function errorHandler(err, req, res, next) {
  console.error("API Error:", err);

  // Handle specific error types
  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Validation Error",
      message: err.message
    });
  }

  if (err.name === "NotFoundError") {
    return res.status(404).json({
      error: "Not Found",
      message: err.message
    });
  }

  if (err.status) {
    return res.status(err.status).json({
      error: err.error || "Error",
      message: err.message
    });
  }

  // Generic error
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? err.message : "An error occurred"
  });
}
