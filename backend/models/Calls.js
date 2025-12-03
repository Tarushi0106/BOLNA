const mongoose = require('mongoose');

// Flexible schema that accepts any field structure
const callSchema = new mongoose.Schema({}, { 
  strict: false,
  timestamps: true
});

// Export model - using 'bolnaCalls' collection (lowercase b)
module.exports = mongoose.model('Calls', callSchema, 'bolnaCalls');