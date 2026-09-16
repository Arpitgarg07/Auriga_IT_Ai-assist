import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import { env } from './config/env.js'
import { attachUser, requireAuth } from './middleware/auth.js'
import { getConnectionStatus, getFitnessSummary } from './services/googleHealthService.js'

const app = express()
app.use(cors({ origin: env.clientUrl }))
app.use(express.json())
app.use(attachUser)

app.get('/api/health', (_request, response) => response.json({ ok: true, database: mongoose.connection.readyState === 1 }))
app.get('/api/auth/me', requireAuth, (request, response) => response.json({ user: request.user }))
app.get('/api/fitness/status', (_request, response) => response.json(getConnectionStatus()))
app.get('/api/fitness/summary', async (_request, response) => response.json(await getFitnessSummary()))

app.use((error, _request, response, next) => { void next; return response.status(500).json({ error: error.message || 'Internal server error' }) })

if (env.mongoUri) {
  mongoose.connect(env.mongoUri).catch((error) => console.error(`MongoDB unavailable: ${error.message}`))
} else {
  console.warn('MONGODB_URI is not configured; running API without database')
}

app.listen(env.port, () => console.log(`Daymark API listening on port ${env.port}`))
