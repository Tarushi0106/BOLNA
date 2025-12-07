const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  bolna_call_id: { type: String }, // ✅ remove index:true
  name: String,
  email: String,
  phone_number: String,
  best_time_to_call: String,
  summary: String,
  transcript: String,
  call_duration: Number,
  call_timestamp: Date,
  user_number: String,
  source: { type: String, default: 'bolna-ai' },
  whatsapp_status: {
    type: String,
    enum: ['not_sent', 'pending', 'sent', 'failed'],
    default: 'pending'
  },
  whatsapp_message_id: String,
  whatsapp_sent_at: Date,
  whatsapp_error: String
}, { timestamps: true });

// ✅ UNIQUE + DUPLICATE PROTECTION
callSchema.index({ bolna_call_id: 1 }, { unique: true, sparse: true });
callSchema.index(
  { phone_number: 1, call_timestamp: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.model('BolnaCall', callSchema, 'bolnaCalls');
