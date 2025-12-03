// backend/index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/BolnaCalls';

mongoose.connect(connectionString)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas');
    console.log(`📊 Database: ${mongoose.connection.name}`);
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('💡 Troubleshooting:');
    console.log('1. Check .env file has correct MONGODB_URI');
    console.log('2. Check IP is whitelisted in MongoDB Atlas');
    console.log('3. Check username/password in connection string');
  });

// Import model
const Calls = require('./models/Calls');

// ========== API ENDPOINTS ==========

// 1. ROOT ENDPOINT
app.get('/', (req, res) => {
  res.json({
    message: 'BolnaCalls API Server',
    status: 'running',
    database: mongoose.connection.name,
    connection: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    endpoints: {
      debug: '/api/debug',
      test: '/api/test',
      exactData: '/api/exact-data',
      calls: '/api/calls',
      simpleCalls: '/api/simple-calls',
      stats: '/api/dashboard/stats',
      rawData: '/api/raw-data',
      health: '/api/health'
    }
  });
});

// 2. DEBUG ENDPOINT - Shows exact data structure
app.get('/api/debug', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ error: 'MongoDB not connected', state: mongoose.connection.readyState });
    }

    const db = mongoose.connection.db;
    
    // List all collections
    const collections = await db.listCollections().toArray();
    
    // Get data from bolnaCalls collection
    let data = [];
    try {
      const collection = db.collection('bolnaCalls');
      data = await collection.find({}).limit(3).toArray();
    } catch (err) {
      console.log('Could not access bolnaCalls:', err.message);
    }

    res.json({
      timestamp: new Date().toISOString(),
      mongooseState: mongoose.connection.readyState,
      connectionStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
      currentDatabase: mongoose.connection.name,
      availableDatabases: ['bolnaCalls', 'sample_mflix', 'test', 'admin', 'local'],
      collections: collections.map(c => c.name),
      bolnaCalls: {
        exists: collections.some(c => c.name === 'bolnaCalls'),
        documentCount: data.length,
        sampleDocument: data[0] || null
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. EXACT DATA ENDPOINT - Shows exact structure
app.get('/api/exact-data', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    
    // Check both collections
    const results = {};
    
    for (const collectionName of ['bolnaCalls', 'bolnacalls']) {
      try {
        const collection = db.collection(collectionName);
        const data = await collection.find({}).limit(5).toArray();
        
        results[collectionName] = {
          count: data.length,
          documents: data.map(doc => {
            const simplified = { _id: doc._id.toString() };
            Object.keys(doc).forEach(key => {
              if (key !== '_id') {
                const value = doc[key];
                if (typeof value === 'string') {
                  simplified[key] = value.length > 100 ? value.substring(0, 100) + '...' : value;
                } else {
                  simplified[key] = value;
                }
              }
            });
            return simplified;
          })
        };
      } catch (err) {
        results[collectionName] = { error: err.message };
      }
    }
    
    res.json({
      timestamp: new Date().toISOString(),
      database: mongoose.connection.name,
      results: results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. GET ALL CALLS - Main endpoint with smart parsing
app.get('/api/calls', async (req, res) => {
  try {
    console.log('📞 Fetching calls from MongoDB...');
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ 
        error: 'MongoDB not connected',
        state: mongoose.connection.readyState 
      });
    }
    
    const db = mongoose.connection.db;
    
    // Try both collection names (bolnaCalls and bolnacalls)
    let collectionNames = ['bolnaCalls', 'bolnacalls'];
    let allData = [];
    
    for (const collectionName of collectionNames) {
      try {
        const collection = db.collection(collectionName);
        const data = await collection.find({}).limit(100).toArray();
        console.log(`✅ Found ${data.length} documents in collection: ${collectionName}`);
        
        if (data.length > 0) {
          // Parse each document based on actual structure
          const parsedData = data.map(doc => {
            // Create a clean document
            const cleanDoc = {
              _id: doc._id,
              Phone: '',
              Email: '',
              Name: '',
              'Best Time to Call': '',
              Summary: '',
              'Enterprise Network': ''
            };
            
            // Check ALL fields and map them
            Object.keys(doc).forEach(key => {
              if (key === '_id') return;
              
              const value = doc[key];
              const lowerKey = key.toLowerCase();
              
              // Phone mapping
              if (lowerKey.includes('phone') || lowerKey.includes('mobile') || lowerKey.includes('contact')) {
                cleanDoc.Phone = value;
              }
              
              // Email mapping
              if (lowerKey.includes('email') || lowerKey.includes('mail')) {
                cleanDoc.Email = value;
              }
              
              // Name mapping
              if (lowerKey.includes('name') || lowerKey.includes('fullname') || lowerKey.includes('person')) {
                cleanDoc.Name = value;
              }
              
              // Time mapping
              if (lowerKey.includes('time') || lowerKey.includes('best') || lowerKey.includes('call') || lowerKey.includes('schedule')) {
                cleanDoc['Best Time to Call'] = value;
              }
              
              // Summary mapping
              if (lowerKey.includes('summary') || lowerKey.includes('description') || lowerKey.includes('notes') || lowerKey.includes('details')) {
                cleanDoc.Summary = value;
              }
              
              // Enterprise mapping
              if (lowerKey.includes('enterprise') || lowerKey.includes('network') || lowerKey.includes('solution') || lowerKey.includes('business')) {
                cleanDoc['Enterprise Network'] = value;
              }
            });
            
            // If we still have no data, check if data is concatenated in one field
            if (!cleanDoc.Phone && !cleanDoc.Name && !cleanDoc.Email) {
              // Check if any field contains multiple pieces of data
              Object.keys(doc).forEach(key => {
                if (key !== '_id' && typeof doc[key] === 'string') {
                  const text = doc[key];
                  
                  // Try to extract phone (digits)
                  const phoneMatch = text.match(/(\d{10,})/);
                  if (phoneMatch) cleanDoc.Phone = phoneMatch[1];
                  
                  // Try to extract email
                  const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
                  if (emailMatch) cleanDoc.Email = emailMatch[1];
                  
                  // Try to extract name (capitalized words)
                  const nameMatch = text.match(/(?:Name|NAME|name):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
                  if (nameMatch) cleanDoc.Name = nameMatch[1];
                  
                  // Try to extract time
                  const timeMatch = text.match(/(?:Best Time|Time|Call Time):\s*([^,.]+)/);
                  if (timeMatch) cleanDoc['Best Time to Call'] = timeMatch[1];
                }
              });
            }
            
            return cleanDoc;
          });
          
          allData = [...allData, ...parsedData];
        }
      } catch (err) {
        console.log(`Could not access collection ${collectionName}:`, err.message);
      }
    }
    
    console.log(`Total parsed documents: ${allData.length}`);
    
    // If we got data, return it
    if (allData.length > 0) {
      res.json(allData);
    } else {
      // Return empty array
      res.json([]);
    }
  } catch (error) {
    console.error('Error in /api/calls:', error);
    res.status(500).json({ 
      error: 'Failed to fetch calls',
      details: error.message 
    });
  }
});

// 5. SIMPLE CALLS - Just display raw data as is
app.get('/api/simple-calls', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    
    // Try both collections
    let allData = [];
    
    for (const collectionName of ['bolnaCalls', 'bolnacalls']) {
      try {
        const collection = db.collection(collectionName);
        const data = await collection.find({}).limit(50).toArray();
        
        if (data.length > 0) {
          const simpleData = data.map(doc => {
            const simple = { 
              _id: doc._id.toString(),
              collection: collectionName
            };
            
            // Add all string fields
            Object.keys(doc).forEach(key => {
              if (key !== '_id' && typeof doc[key] === 'string' && doc[key].trim().length > 0) {
                simple[key] = doc[key].length > 50 ? doc[key].substring(0, 50) + '...' : doc[key];
              }
            });
            
            return simple;
          });
          
          allData = [...allData, ...simpleData];
        }
      } catch (err) {
        console.log(`Could not access ${collectionName}:`, err.message);
      }
    }
    
    res.json({
      message: `Found ${allData.length} documents`,
      data: allData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. TEST ENDPOINT
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Backend is working!',
    timestamp: new Date().toISOString(),
    mongooseState: mongoose.connection.readyState,
    database: mongoose.connection.name || 'Not connected'
  });
});

// 7. RAW DATA ENDPOINT - Get data without parsing
app.get('/api/raw-data', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    
    // Try both collections
    let allData = [];
    
    for (const collectionName of ['bolnaCalls', 'bolnacalls']) {
      try {
        const collection = db.collection(collectionName);
        const data = await collection.find({}).limit(20).toArray();
        
        if (data.length > 0) {
          const formattedData = data.map(doc => {
            const resultDoc = { 
              _id: doc._id.toString(),
              collection: collectionName
            };
            
            // Include all fields
            Object.keys(doc).forEach(key => {
              if (key !== '_id') {
                resultDoc[key] = doc[key];
              }
            });
            
            return resultDoc;
          });
          
          allData = [...allData, ...formattedData];
        }
      } catch (err) {
        console.log(`Could not access ${collectionName}:`, err.message);
      }
    }
    
    res.json({
      message: `Found ${allData.length} documents`,
      data: allData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. DASHBOARD STATS
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    let totalCalls = 0;
    
    if (mongoose.connection.readyState === 1) {
      try {
        const db = mongoose.connection.db;
        // Check both collections
        for (const collectionName of ['bolnaCalls', 'bolnacalls']) {
          try {
            const collection = db.collection(collectionName);
            const count = await collection.countDocuments();
            totalCalls += count;
          } catch (err) {
            console.log(`Cannot count ${collectionName}:`, err.message);
          }
        }
      } catch (err) {
        console.log('Cannot count documents:', err.message);
      }
    }
    
    res.json({
      totalCalls: totalCalls,
      storageSize: '36KB',
      logicalDataSize: '23KB',
      indexesSize: '44KB',
      recentCallsCount: totalCalls,
      databases: 1,
      collections: 3,
      status: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
  } catch (err) {
    console.error("Stats Error:", err);
    res.status(500).json({ 
      message: "Error fetching stats",
      error: err.message
    });
  }
});

// 9. HEALTH CHECK
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const statusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  res.json({ 
    status: 'OK', 
    mongodb: statusMap[dbStatus] || 'unknown',
    database: mongoose.connection.name,
    timestamp: new Date().toISOString()
  });
});

// ========== ERROR HANDLING ==========
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /',
      'GET /api/debug',
      'GET /api/exact-data',
      'GET /api/calls',
      'GET /api/simple-calls',
      'GET /api/test',
      'GET /api/raw-data',
      'GET /api/dashboard/stats',
      'GET /api/health'
    ]
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message
  });
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔧 Debug: http://localhost:${PORT}/api/debug`);
  console.log(`📊 Exact Data: http://localhost:${PORT}/api/exact-data`);
  console.log(`📞 API: http://localhost:${PORT}/api/calls`);
  console.log(`🏠 Home: http://localhost:${PORT}/`);
});