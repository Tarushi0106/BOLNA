// backend/models/Calls.js
const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  Phone: String,
  Email: String,
  Name: String,
  'Best Time to Call': String,
  Summary: String,
  'Interested In': String,
  'enterprise network solutions including Digital Connectivity 50 MM': String,
  'MIT as a Service': String,
  'Low latency multi-cloud connectivity': String,
  'and Data Centres': String
}, { 
  strict: false,
  timestamps: true // This adds createdAt and updatedAt automatically
});

// Optional: Add virtuals or methods
callSchema.virtual('formattedPhone').get(function() {
  return this.Phone ? `+${this.Phone}` : 'Not provided';
});

callSchema.methods.getSummaryPreview = function() {
  return this.Summary ? this.Summary.substring(0, 100) + '...' : 'No summary';
};

module.exports = mongoose.model('Calls', callSchema, 'bolnaCalls');