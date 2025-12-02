const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || 'change_this'

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ message: 'No token provided' })
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.userId = decoded.id
    next()
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' })
  }
}

module.exports = authMiddleware
