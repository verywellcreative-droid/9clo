// ============================================================
// 9CLO — Global Error Handler Middleware
// ============================================================

function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.url}:`, err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
}

function notFoundHandler(req, res) {
  // For API routes, return JSON
  if (req.url.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: `Route ${req.method} ${req.url} not found` });
  }
  // For all other routes, serve index.html (SPA fallback)
  res.status(404).sendFile('index.html', { root: 'public' });
}

module.exports = { errorHandler, notFoundHandler };
