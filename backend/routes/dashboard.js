const express = require('express')
const router = express.Router()
const User = require('../models/User')
const Calls = require('../models/Calls')
const authMiddleware = require('../middleware/auth')

router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password')
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json(user)
  } catch (err) {
    res.status(500).json({ message: 'Error fetching profile' })
  }
})

router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    const totalUsers = await User.countDocuments()
    const totalCalls = await Calls.countDocuments()
    const stats = {
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      totalUsers: totalUsers,
      totalCalls: totalCalls,
      joinedAt: user.createdAt
    }
    res.json(stats)
  } catch (err) {
    res.status(500).json({ message: 'Error fetching stats' })
  }
})

router.get('/calls', authMiddleware, async (req, res) => {
  try {
    const calls = await Calls.find().limit(50).sort({createdAt: -1})
    res.json(calls)
  } catch (err) {
    res.status(500).json({ message: 'Error fetching calls' })
  }
})

router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body
    if (!name) return res.status(400).json({ message: 'Name is required' })
    const user = await User.findByIdAndUpdate(req.userId, { name }, { new: true }).select('-password')
    res.json(user)
  } catch (err) {
    res.status(500).json({ message: 'Error updating profile' })
  }
})

module.exports = router
