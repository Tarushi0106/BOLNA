// backend/index.js - UPDATED VERSION
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ---------- MongoDB ----------
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => {
    console.error('❌ MongoDB error:', err.message);
    process.exit(1);
  });

// ---------- User Model ----------
const User = require('./models/User');

// ---------- AUTH ROUTES ----------
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Signup successful',
      token,
      user: { id: user._id, name, email }
    });

  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Server error during signup' });
  }
});

// ---------- LOGIN ----------
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email }
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error during login' });
  }
});

// ---------- GET CALLS (NO LIMIT) ----------
const Calls = require('./models/Calls');

app.get('/api/calls', async (req, res) => {
  try {
    // REMOVED .limit(100) - now fetches ALL calls
    const calls = await Calls.find({})
      .sort({ createdAt: -1 });

    const normalized = calls.map(c => ({
      _id: c._id,
      name: c.name || 'N/A',
      phone_number: c.phone_number || 'N/A',
      email: c.email || 'N/A',
      summary: c.summary || 'N/A',
      best_time_to_call: c.best_time_to_call || 'N/A',
      whatsapp_status: c.whatsapp_status || 'pending',
      whatsapp_message_id: c.whatsapp_message_id || null,
      createdAt: c.createdAt
    }));

    res.json({
      total: normalized.length,
      calls: normalized
    });
  } catch (err) {
    console.error('Fetch calls error:', err);
    res.status(500).json({ message: 'Failed to fetch calls' });
  }
});

// ---------- SYNC DATA FROM BOLNA WITH AI EXTRACTION ----------
app.post('/api/sync-bolna', async (req, res) => {
  try {
    console.log('🔄 Starting Bolna sync...');
    const { processBolnaCalls } = require('./services/bolnaService');
    
    const result = await processBolnaCalls();
    
    res.json({
      message: 'Sync completed',
      ...result
    });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ 
      error: 'Sync failed',
      details: err.message 
    });
  }
});

// ---------- DEBUG: Count comparison ----------
app.get('/api/debug/count', async (req, res) => {
  try {
    const dbCount = await Calls.countDocuments();
    res.json({
      database_count: dbCount,
      message: `Total calls in database: ${dbCount}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- CLEAR ALL CALLS (for testing) ----------
app.post('/api/clear-calls', async (req, res) => {
  try {
    const result = await Calls.deleteMany({});
    res.json({
      message: 'All calls cleared',
      deleted: result.deletedCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- TEST ----------
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend working ✅' });
});

// ---------- 404 ----------
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// ---------- SERVER ----------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
);