const express = require('express')
const router = express.Router()
const User = require('../models/User')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || 'change_this'
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body
  if (!name || !email || !password) return res.status(400).json({ message: 'Missing fields' })
  const existing = await User.findOne({ email })
  if (existing) return res.status(409).json({ message: 'User already exists' })
  const hash = await bcrypt.hash(password, 10)
  const user = await User.create({ name, email, password: hash })
  const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' })
  res.json({ token, user: { id: user._id, name: user.name, email: user.email } })
})
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ message: 'Missing fields' })
  const user = await User.findOne({ email })
  if (!user) return res.status(401).json({ message: 'Invalid credentials' })
  const ok = await bcrypt.compare(password, user.password)
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' })
  const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' })
  res.json({ token, user: { id: user._id, name: user.name, email: user.email } })
})
module.exports = router
