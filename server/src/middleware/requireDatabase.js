import mongoose from 'mongoose'

// Every data route sits behind this. Without MONGODB_URI the API still starts —
// it just reports that persistence is unavailable instead of pretending to work.
export function requireDatabase(_request, response, next) {
  if (mongoose.connection.readyState !== 1) {
    return response.status(503).json({
      error: 'Database unavailable',
      detail: 'MONGODB_URI is not configured or the connection has not been established.',
    })
  }
  return next()
}
