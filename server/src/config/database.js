import mongoose from 'mongoose'
import { env } from './env.js'

/**
 * Single place that owns the MongoDB connection. The server boots whether or
 * not a database is reachable — a missing or broken MONGODB_URI degrades the
 * API to a clear configuration error instead of crashing the process, so the
 * frontend can show "backend not configured" rather than a blank screen.
 */

const STATES = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' }

export function databaseStatus() {
  const state = mongoose.connection.readyState
  return {
    configured: Boolean(env.mongoUri),
    connected: state === 1,
    state: STATES[state] || 'unknown',
    name: state === 1 ? mongoose.connection.name : null,
  }
}

/**
 * A ready-to-send description of why persistence is unavailable, or null when
 * everything is fine. Route handlers use this so they never have to guess and
 * never leak the connection string.
 */
export function databaseProblem() {
  if (!env.mongoUri) {
    return {
      status: 503,
      error: 'Database not configured',
      detail: 'Set MONGODB_URI in the server environment to enable accounts and stored habits.',
      missing: ['MONGODB_URI'],
    }
  }
  if (mongoose.connection.readyState !== 1) {
    return {
      status: 503,
      error: 'Database unavailable',
      detail: `The MongoDB connection is ${databaseStatus().state}. The app keeps working locally; account features are paused.`,
    }
  }
  return null
}

/**
 * Connects without ever throwing. Returns the connection, or null when there is
 * nothing to connect to or the attempt failed.
 */
export async function connectDatabase() {
  if (!env.mongoUri) {
    console.warn('MONGODB_URI is not configured; running the API without a database')
    return null
  }

  try {
    // Fail fast rather than hanging a request for the 30s default.
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 })
    console.log(`MongoDB connected (${mongoose.connection.name})`)
    return mongoose.connection
  } catch (error) {
    // Deliberately swallowed: a database outage must not stop the API serving
    // /api/health or the browser's local-only mode.
    console.error(`MongoDB unavailable: ${error.message}`)
    return null
  }
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
}
