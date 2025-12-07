const mongoose = require('mongoose');
require('dotenv').config();

console.log('🔧 Testing MongoDB Connection...');
console.log('MONGODB_URI exists?', !!process.env.MONGODB_URI);

if (!process.env.MONGODB_URI) {
  console.error('❌ ERROR: MONGODB_URI not found in .env file');
  console.log('💡 Create a .env file with:');
  console.log('MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/BolnaCalls');
  process.exit(1);
}

async function testConnection() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });
    
    console.log('✅ Connected to MongoDB!');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    
    const db = mongoose.connection.db;
    
    // List collections
    const collections = await db.listCollections().toArray();
    console.log('\n📁 Collections:');
    collections.forEach(c => console.log(`  - ${c.name}`));
    
    // Check bolnaCalls
    const hasBolnaCalls = collections.some(c => c.name === 'bolnaCalls');
    if (hasBolnaCalls) {
      console.log('\n✅ Found bolnaCalls collection!');
      const collection = db.collection('bolnaCalls');
      const count = await collection.countDocuments();
      console.log(`📊 Total documents: ${count}`);
      
      if (count > 0) {
        const sample = await collection.findOne();
        console.log('\n📝 Sample document fields:');
        Object.keys(sample).forEach(key => {
          if (key !== '_id') {
            const value = sample[key];
            console.log(`  ${key}: ${typeof value === 'string' ? value.substring(0, 100) + (value.length > 100 ? '...' : '') : value}`);
          }
        });
      }
    } else {
      console.log('\n❌ bolnaCalls collection NOT FOUND');
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Test completed!');
    
  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    
    if (error.message.includes('Authentication failed')) {
      console.log('💡 Check username/password in connection string');
    } else if (error.message.includes('getaddrinfo ENOTFOUND')) {
      console.log('💡 Check cluster URL in connection string');
    } else if (error.message.includes('timed out')) {
      console.log('💡 Check IP whitelist in MongoDB Atlas');
    }
    process.exit(1);
  }
}

testConnection();