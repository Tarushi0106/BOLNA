const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const { processBolnaCalls } = require('./services/bolnaService');

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('MONGODB_URI not found in .env file');
  process.exit(1);
}

mongoose.connect(mongoUri)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => {
    console.error('MongoDB Connection Error:', err.message);
    process.exit(1);
  });

const User = require('./models/User');

const callSchema = new mongoose.Schema({}, { strict: false });
const BolnaCall = mongoose.model('BolnaCall', callSchema, 'bolnaCalls');

let cronJobStatus = 'stopped';

async function runBolnaScraping() {
  try {
    const timestamp = new Date().toLocaleString();
    console.log(`[CRON] ${timestamp} - Starting Bolna scraping...`);
    const result = await processBolnaCalls();
    if (result.success) {
      console.log(`[CRON] ${timestamp} - Completed! Processed: ${result.processed}, Saved: ${result.saved}`);
    }
  } catch (error) {
    console.error(`[CRON] Error: ${error.message}`);
  }
}

console.log('Scheduling Bolna scraping for daily execution at 2 AM...');
const bolnaCronJob = cron.schedule('0 2 * * *', runBolnaScraping, {
  scheduled: true,
  timezone: 'Asia/Kolkata'
});
cronJobStatus = 'running';

app.get('/health', (req, res) => {
  res.json({ status: 'Server running', port: process.env.PORT || 4000 });
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed });
    
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'your-secret-key');
    
    res.json({ token, user: { id: user._id, name, email } });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Signup failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'your-secret-key');
    
    res.json({ token, user: { id: user._id, name: user.name, email } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Login failed' });
  }
});

app.get('/api/calls/raw', async (req, res) => {
  try {
    const calls = await BolnaCall.find({}).limit(10);
    res.json({ count: calls.length, data: calls });
  } catch (error) {
    console.error('Raw calls error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/calls', async (req, res) => {
  try {
    const calls = await BolnaCall.find({});
    
    const parsedCalls = calls.map(call => {
      const callObj = call.toObject ? call.toObject() : call;
      const keys = Object.keys(callObj);
      
      const dataKey = keys.find(key => typeof callObj[key] === 'string' && callObj[key]?.includes('\n'));
      
      if (dataKey) {
        const dataStr = callObj[dataKey];
        const parsed = {};
        
        const lines = dataStr.split('\n').filter(line => line.trim());
        lines.forEach(line => {
          const [key, value] = line.split(':').map(s => s.trim());
          if (key && value) {
            parsed[key] = value;
          }
        });
        
        return {
          _id: call._id,
          Name: parsed.Name || callObj.Name || callObj.name || 'N/A',
          Email: parsed.Email || callObj.Email || callObj.email || 'N/A',
          Phone: parsed.Phone || callObj.Phone || callObj.phone || callObj.phone_number || 'N/A',
          bestTimeToCall: parsed['Best Time to Call'] || callObj['Best Time to Call'] || callObj['Best_time_to_call'] || callObj.best_time_to_call || callObj.bestTimeToCall || 'N/A',
          Summary: parsed.Summary || callObj.Summary || callObj.summary || 'N/A'
        };
      }
      
      return {
        _id: call._id,
        Name: callObj.Name || callObj.name || 'N/A',
        Email: callObj.Email || callObj.email || 'N/A',
        Phone: callObj.Phone || callObj.phone || callObj.phone_number || 'N/A',
        bestTimeToCall: callObj['Best Time to Call'] || callObj['Best_time_to_call'] || callObj.best_time_to_call || callObj.bestTimeToCall || 'N/A',
        Summary: callObj.Summary || callObj.summary || 'N/A'
      };
    });
    
    res.json(parsedCalls);
  } catch (error) {
    console.error('Calls fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/calls/:id', async (req, res) => {
  try {
    const call = await BolnaCall.findById(req.params.id);
    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }
    res.json(call);
  } catch (error) {
    console.error('Get call error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/scheduler/status', (req, res) => {
  res.json({
    status: cronJobStatus,
    schedule: 'Daily at 2:00 AM (Asia/Kolkata)',
    nextRun: 'Scheduled automatically',
    message: 'Bolna scraping runs automatically every day'
  });
});

app.post('/api/scheduler/run-now', async (req, res) => {
  try {
    console.log('Manual trigger: Starting Bolna scraping...');
    const result = await processBolnaCalls();
    res.json({
      success: true,
      message: 'Scraping triggered manually',
      result: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/scrape-bolna', async (req, res) => {
  try {
    console.log('Starting Bolna scraping workflow...');
    const result = await processBolnaCalls();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Bolna calls scraped and processed successfully',
        processed: result.processed,
        saved: result.saved,
        errors: result.errors
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Scrape error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n=== Server Running on Port ${PORT} ===\n`);
  console.log('Available Endpoints:');
  console.log(`  Health check: http://localhost:${PORT}/health`);
  console.log(`  API Calls: http://localhost:${PORT}/api/calls`);
  console.log(`  Scrape Bolna: http://localhost:${PORT}/api/scrape-bolna`);
  console.log(`  Manual Trigger: POST http://localhost:${PORT}/api/scheduler/run-now`);
  console.log(`  Scheduler Status: http://localhost:${PORT}/api/scheduler/status`);
  console.log('\n=== Automatic Scheduler ===');
  console.log('Status: RUNNING');
  console.log('Schedule: Daily at 2:00 AM (Asia/Kolkata timezone)');
  console.log('Task: Automatically scrapes Bolna calls and saves to MongoDB\n');
});