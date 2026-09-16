export function requireAuth(request, response, next) {
  if (!request.user) return response.status(401).json({ error: 'Authentication required' })
  return next()
}

export function attachUser(request, _response, next) {
  // OAuth session wiring will attach a verified user here.
  request.user = null
  next()
}
