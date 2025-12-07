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

async function saveToDB(extractedData, call) {
  const BolnaCall = getBolnaCallModel();

  const normalizedUserNumber = call.user_number
    ? String(call.user_number).replace(/^\+?91/, '')
    : null;

  return await BolnaCall.create({
    bolna_call_id: call.id || null, // ✅ STORE THIS
    name: extractedData.name,
    email: extractedData.email,
    phone_number: extractedData.phone_number,
    best_time_to_call: extractedData.best_time_to_call,
    summary: extractedData.summary,
    transcript:
      call.transcript ||
      call.output?.transcript ||
      '',
    call_duration: call.conversation_duration || 0,
    call_timestamp: call.created_at
      ? new Date(call.created_at)
      : new Date(),
    user_number: normalizedUserNumber,
    source: 'bolna-ai',
    whatsapp_status:
      call.whatsapp_status ||
      call.whatsapp?.status ||
      'pending',
    whatsapp_message_id:
      call.whatsapp_message_id ||
      call.whatsapp?.messageId ||
      null,
    whatsapp_sent_at:
      call.whatsapp_sent_at
        ? new Date(call.whatsapp_sent_at)
        : null,
    whatsapp_error:
      call.whatsapp_error || null
  });
}

/* -------------------- PROCESS -------------------- */
// backend/services/bolnaService.js - UPDATE the processBolnaCalls function to return stats

async function processBolnaCalls() {
  await connectDB();

  const calls = await fetchBolnaCalls();
  if (!Array.isArray(calls) || calls.length === 0) {
    console.log('⚠️ No calls from Bolna');
    await mongoose.connection.close();
    return;
  }

  console.log(`📞 Bolna returned ${calls.length} calls`);

  const BolnaCall = getBolnaCallModel();

  let newCount = 0;
  let duplicateCount = 0;

  for (const call of calls) {
    try {
      const bolnaId = call.id || null;

      const phone = call.user_number
        ? String(call.user_number).replace(/^\+91/, '')
        : null;

      const timestamp = call.created_at
        ? new Date(call.created_at)
        : null;

      // ✅ STRONG DUPLICATE CHECK
      const exists = await BolnaCall.findOne({
        $or: [
          bolnaId ? { bolna_call_id: bolnaId } : {},
          phone && timestamp
            ? { phone_number: phone, call_timestamp: timestamp }
            : {}
        ]
      });

      if (exists) {
        duplicateCount++;
        continue;
      }

      const transcript =
        call.transcript ||
        call.output?.transcript ||
        '';

      const extracted = await extractDataWithGroq(transcript, phone);

      await saveToDB(extracted, call);
      newCount++;

      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      // ✅ Ignore duplicate index errors safely
      if (err.code === 11000) {
        duplicateCount++;
      } else {
        console.error('❌ Save error:', err.message);
      }
    }
  }

  console.log('✅ SYNC COMPLETE');
  console.log('New:', newCount);
  console.log('Duplicates:', duplicateCount);

  await mongoose.connection.close();
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