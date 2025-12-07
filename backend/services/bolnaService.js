const axios = require('axios');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BOLNA_AGENT_ID = process.env.BOLNA_AGENT_ID;
const BOLNA_API_KEY = process.env.BOLNA_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;

if (!BOLNA_AGENT_ID || !BOLNA_API_KEY || !GROQ_API_KEY || !MONGODB_URI) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const BOLNA_API_URL = `https://api.bolna.ai/agent/${BOLNA_AGENT_ID}/executions`;

let groq;
function initGroq() {
  if (!groq) {
    const Groq = require('groq-sdk');
    groq = new Groq({ apiKey: GROQ_API_KEY });
  }
  return groq;
}

/* -------------------- DATABASE -------------------- */

async function connectDB() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ MongoDB connected');
}

function getBolnaCallModel() {
  try {
    return mongoose.model('BolnaCall');
  } catch {
    const schema = new mongoose.Schema({
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
      whatsapp_error: String,
      createdAt: { type: Date, default: Date.now }
    });

    return mongoose.model('BolnaCall', schema, 'bolnaCalls');
  }
}

/* -------------------- BOLNA FETCH -------------------- */

/**
 * fetchBolnaCalls - fetch executions from Bolna API.
 * - Accepts an optional `options` object so the caller can request upcoming/scheduled executions.
 * - Be tolerant to API shapes by returning the raw response for inspection when debugging.
 */
async function fetchBolnaCalls(options = {}) {
  // options can include: { status: 'upcoming' } or any query params Bolna supports.
  try {
    const res = await axios.get(BOLNA_API_URL, {
      headers: {
        Authorization: `Bearer ${BOLNA_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      // pass through any query params (e.g., { status: 'upcoming', include: 'whatsapp' })
      params: options
    });

    // If you're debugging what's returned by the API, uncomment this:
    // console.log('DEBUG: bolna response keys:', Object.keys(res.data || {}));
    // console.dir(res.data, { depth: 2 });

    return Array.isArray(res.data) ? res.data : (Array.isArray(res.data.executions) ? res.data.executions : []);
  } catch (err) {
    console.error('❌ fetchBolnaCalls error:', err.message);
    // rethrow or return empty to let the caller handle it
    return [];
  }
}

/* -------------------- GROQ EXTRACTION -------------------- */

async function extractDataWithGroq(transcript, userNumber) {
  if (!transcript || transcript.length < 50) {
    return {
      name: null,
      email: null,
      phone_number: userNumber || null,
      best_time_to_call: null,
      summary: 'Call too short or no transcript available'
    };
  }

  try {
    const groqInstance = initGroq();

    const completion = await groqInstance.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      temperature: 0.1,
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content:
            'Extract call details and return ONLY valid JSON. Use null for missing fields.'
        },
        {
          role: 'user',
          content: `
Extract the following from this call transcript:

JSON FORMAT:
{
  "name": null,
  "email": null,
  "phone_number": null,
  "best_time_to_call": null,
  "summary": ""
}

TRANSCRIPT:
${transcript}
          `
        }
      ]
    });

    const text = completion.choices[0].message.content;
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) throw new Error('Invalid JSON from Groq');

    const data = JSON.parse(match[0]);

    return {
      name: data.name ?? null,
      email: data.email ?? null,
      phone_number: data.phone_number || userNumber || null,
      best_time_to_call: data.best_time_to_call ?? null,
      summary: data.summary ?? null
    };
  } catch (err) {
    console.error('❌ Groq error:', err.message);
    return {
      name: null,
      email: null,
      phone_number: userNumber || null,
      best_time_to_call: null,
      summary: 'Extraction failed'
    };
  }
}

/* -------------------- SAVE TO DB -------------------- */

/**
 * saveToDB - more tolerant mapping for whatsapp fields:
 * - Bolna API may return whatsapp fields nested (e.g. call.whatsapp.messageId or call.whatsapp.message_id)
 * - This function attempts multiple keys and falls back to sensible defaults.
 */
async function saveToDB(extractedData, call) {
  const BolnaCall = getBolnaCallModel();

  // Normalize user_number (strip country prefix if present)
  const normalizedUserNumber = call.user_number ? call.user_number.replace(/^\+?91/, '') : null;

  // Try multiple possible shapes for whatsapp fields
  const whatsappMessageId =
    call.whatsapp_message_id ||
    (call.whatsapp && (call.whatsapp.message_id || call.whatsapp.messageId)) ||
    null;

  const whatsappSentAt =
    call.whatsapp_sent_at ||
    (call.whatsapp && (call.whatsapp.sent_at || call.whatsapp.sentAt)) ||
    call.whatsapp_sent_at || // keep original fallback
    null;

  const whatsappError =
    call.whatsapp_error ||
    (call.whatsapp && (call.whatsapp.error || (call.whatsapp.error && call.whatsapp.error.message))) ||
    null;

  // Prefer explicit top-level status, else look into possible nested field, else keep schema default ('pending')
  const whatsappStatus = (typeof call.whatsapp_status !== 'undefined' && call.whatsapp_status !== null)
    ? call.whatsapp_status
    : (call.whatsapp && call.whatsapp.status) ? call.whatsapp.status : 'pending';

  return await BolnaCall.create({
    name: extractedData.name,
    email: extractedData.email,
    phone_number: extractedData.phone_number,
    best_time_to_call: extractedData.best_time_to_call,
    summary: extractedData.summary,
    transcript: call.transcript || '',
    call_duration: call.conversation_duration || 0,
    call_timestamp: call.created_at ? new Date(call.created_at) : new Date(),
    user_number: normalizedUserNumber,
    source: 'bolna-ai',
    whatsapp_status: whatsappStatus,
    whatsapp_message_id: whatsappMessageId,
    whatsapp_sent_at: whatsappSentAt ? new Date(whatsappSentAt) : null,
    whatsapp_error: whatsappError
  });
}

/* -------------------- PROCESS -------------------- */
// backend/services/bolnaService.js - UPDATE the processBolnaCalls function to return stats

async function processBolnaCalls() {
  await connectDB();

  const calls = await fetchBolnaCalls();

  if (!calls || calls.length === 0) {
    console.log('⚠️ No calls found from Bolna API');
    await mongoose.connection.close();
    return { new_calls: 0, duplicate_calls: 0, total_from_api: 0 };
  }

  console.log(`📞 Fetched ${calls.length} calls from Bolna API`);

  let newCount = 0;
  let duplicateCount = 0;
  const BolnaCall = getBolnaCallModel();

  for (const call of calls) {
    try {
      // Use bolna call ID or user_number + timestamp as unique identifier
      const callId = call.id || `${call.user_number}_${call.created_at}`;
      
      const existingCall = await BolnaCall.findOne({
        $or: [
          { bolna_call_id: callId },
          { phone_number: call.user_number ? String(call.user_number).replace(/^\+91/, '') : null, call_timestamp: call.created_at ? new Date(call.created_at) : null }
        ]
      });

      if (existingCall) {
        console.log(`⏭️ Duplicate: ${call.user_number}`);
        duplicateCount++;
        continue;
      }

      const transcript = call.transcript
        || (call.transcripts && Array.isArray(call.transcripts) && (call.transcripts[0] && (call.transcripts[0].text || call.transcripts[0].transcript)))
        || call.output?.transcript
        || '';

      const userNumber = call.user_number ? String(call.user_number).replace(/^\+91/, '') : null;
      console.log(`🔄 Processing call - phone: ${userNumber}, transcript length: ${(transcript || '').length}`);

      // Extract with AI
      const extracted = await extractDataWithGroq(transcript || '', userNumber);
      console.log('✅ AI Extraction:', extracted);

      // Save to DB
      await saveToDB(extracted, call);
      newCount++;

      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error('❌ Error:', err.message);
    }
  }

  console.log('\n========== SYNC SUMMARY ==========');
  console.log(`✅ New calls saved: ${newCount}`);
  console.log(`⏭️ Duplicates skipped: ${duplicateCount}`);
  console.log(`📊 Total from Bolna API: ${calls.length}`);
  console.log('===================================\n');

  await mongoose.connection.close();
  
  return {
    new_calls: newCount,
    duplicate_calls: duplicateCount,
    total_from_api: calls.length
  };
}

/* -------------------- RUN -------------------- */

processBolnaCalls()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

module.exports = {
  processBolnaCalls,
  extractDataWithGroq,
  fetchBolnaCalls
};