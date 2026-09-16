import { env } from '../config/env.js'

export function getConnectionStatus() {
  return { connected: false, configured: env.googleConfigured, message: 'Google Health not connected' }
}

export async function getFitnessSummary() {
  if (!env.googleConfigured) return { connected: false, data: null, message: 'Google Health not connected' }
  return { connected: false, data: null, message: 'Google Health connection is not implemented yet' }
}
