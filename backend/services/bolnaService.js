const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const BOLNA_AGENT_ID = process.env.BOLNA_AGENT_ID;
const BOLNA_API_KEY = process.env.BOLNA_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;

if (!BOLNA_AGENT_ID || !BOLNA_API_KEY || !GROQ_API_KEY || !MONGODB_URI) {
  console.error('Missing required environment variables. Please check your .env file.');
  console.error('Required: BOLNA_AGENT_ID, BOLNA_API_KEY, GROQ_API_KEY, MONGODB_URI');
  process.exit(1);
}


const BOLNA_API_URL = 'https://api.bolna.ai/agent/' + BOLNA_AGENT_ID + '/executions';

console.log('Environment Variables Loaded:');
console.log('BOLNA_AGENT_ID:', BOLNA_AGENT_ID);
console.log('BOLNA_API_KEY:', BOLNA_API_KEY ? 'Set' : 'Not Set');
console.log('GROQ_API_KEY:', GROQ_API_KEY ? 'Set' : 'Not Set');
console.log('MONGODB_URI:', MONGODB_URI ? 'Set' : 'Not Set');
console.log('');

let groq;

function initGroq() {
  if (!groq) {
    const Groq = require('groq-sdk');
    groq = new Groq({
      apiKey: GROQ_API_KEY
    });
  }
  return groq;
}

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    throw error;
  }
}

function getBolnaCallModel() {
  try {
    return mongoose.model('BolnaCall');
  } catch {
    const callSchema = new mongoose.Schema({
      name: String,
      email: String,
      phone_number: String,
      best_time_to_call: String,
      summary: String,
      transcript: String,
      call_duration: Number,
      call_timestamp: Date,
      user_number: String,
      whatsapp_status: { type: String, default: 'not_sent', enum: ['not_sent', 'pending', 'sent', 'failed'] },
      whatsapp_message_id: String,
      whatsapp_sent_at: Date,
      whatsapp_error: String,
      createdAt: { type: Date, default: Date.now },
      source: { type: String, default: 'bolna-ai' }
    });
    return mongoose.model('BolnaCall', callSchema, 'bolnaCalls');
  }
}

async function fetchBolnaCalls() {
  try {
    console.log('Fetching Bolna calls...');
    
    const response = await axios.get(BOLNA_API_URL, {
      headers: {
        'Authorization': 'Bearer ' + BOLNA_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Found ' + (response.data.length || 0) + ' Bolna executions');
    return response.data;
  } catch (error) {
    console.error('Error fetching Bolna calls:', error.message);
    throw error;
  }
}

async function extractDataWithGroq(transcript, userNumber) {
  try {
    console.log('Extracting data with Groq LLM...');
    const groqInstance = initGroq();
    
    // Skip if transcript is empty or too short
    if (!transcript || transcript.length < 50) {
      console.log('Transcript too short, skipping extraction');
      return {
        name: 'Not provided',
        email: 'Not provided',
        phone_number: userNumber || 'Not provided',
        best_time_to_call: 'Not provided',
        summary: 'Call too short or no transcript available'
      };
    }

    const chatCompletion = await groqInstance.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a data extraction assistant. Extract information from call transcripts and return ONLY valid JSON. No explanations.'
        },
        {
          role: 'user',
          content: `Extract these details from the call transcript below:

1. name: The caller's name (NOT "Sia" who is the assistant)
2. email: Any email address mentioned
3. phone_number: Caller's phone number (10 digits)
4. best_time_to_call: When they want to be called back - MUST be in human-readable format like "tomorrow at 9 AM", "today at 5 PM", "next Monday at 10 AM", etc. NOT timestamps or ISO dates.
5. summary: Brief 2-3 sentence summary of the call

TRANSCRIPT:
${transcript}

If any field is not found, use "Not provided". 

Return ONLY this JSON format, nothing else:
{"name": "", "email": "", "phone_number": "", "best_time_to_call": "", "summary": ""}`
        }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.1,
      max_tokens: 500
    });

    const responseText = chatCompletion.choices[0]. message.content;
    console.log('Groq response:', responseText);
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      var extracted = JSON.parse(jsonMatch[0]);
      
      // Use user_number from Bolna if phone not extracted
      if (!extracted.phone_number || extracted.phone_number === 'Not provided') {
        extracted.phone_number = userNumber || 'Not provided';
      }
      
      return extracted;
    }
    
    return {
      name: 'Not provided',
      email: 'Not provided',
      phone_number: userNumber || 'Not provided',
      best_time_to_call: 'Not provided',
      summary: 'Extraction failed'
    };
  } catch (error) {
    console. error('Error extracting data with Groq:', error.message);
    return {
      name: 'Not provided',
      email: 'Not provided',
      phone_number: userNumber || 'Not provided',
      best_time_to_call: 'Not provided',
      summary: 'Extraction error: ' + error.message
    };
  }
}

async function saveToDB(extractedData, originalCall) {
  try {
    console.log('Saving to MongoDB...');
    const BolnaCall = getBolnaCallModel();
    
    const callData = {
      name: extractedData.name || 'Not provided',
      email: extractedData.email || 'Not provided',
      phone_number: extractedData.phone_number || originalCall.user_number || 'Not provided',
      best_time_to_call: extractedData.best_time_to_call || 'Not provided',
      summary: extractedData.summary || 'Not provided',
      transcript: originalCall.transcript || '',
      call_duration: originalCall.conversation_duration || 0,
      call_timestamp: originalCall.created_at || new Date(),
      user_number: originalCall.user_number || '',
      createdAt: new Date(),
      source: 'bolna-ai',
      whatsapp_status: 'pending'
    };
    
    const result = await BolnaCall.create(callData);
    console.log('Saved call record: ' + result._id);
    return result;
  } catch (error) {
    console.error('Error saving to MongoDB:', error.message);
    throw error;
  }
}

function delay(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

async function processBolnaCalls() {
  try {
    await connectDB();
    
    const bolnaCalls = await fetchBolnaCalls();
    
    if (! bolnaCalls || bolnaCalls. length === 0) {
      console. log('No calls found in Bolna');
      return { success: true, processed: 0, saved: 0 };
    }

    var processedCount = 0;
    var savedCount = 0;
    var errors = [];

    for (var i = 0; i < bolnaCalls.length; i++) {
      var call = bolnaCalls[i];
      try {
        console. log('\n--- Processing call ' + (i + 1) + ' of ' + bolnaCalls.length + ' ---');
        console.log('Call ID:', call.id);
        console.log('User number:', call.user_number);
        console.log('Transcript length:', call.transcript ?  call.transcript.length : 0);
        
        var transcript = call.transcript || '';
        var userNumber = call.user_number ?  call.user_number. replace('+91', '') : '';
        
        var extractedData = await extractDataWithGroq(transcript, userNumber);
        
        console.log('Extracted:', extractedData);
        
        await saveToDB(extractedData, call);
        
        processedCount++;
        savedCount++;
        
        // Rate limiting - wait 2 seconds between calls
        await delay(2000);
        
      } catch (error) {
        console.error('Error processing call:', error.message);
        processedCount++;
        errors.push({
          callId: call.id,
          error: error.message
        });
      }
    }

    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');

    return {
      success: true,
      processed: processedCount,
      saved: savedCount,
      errors: errors. length > 0 ? errors : null
    };
  } catch (error) {
    console.error('Error in processBolnaCalls:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

processBolnaCalls()
  .then(function(result) {
    console.log('\nFinal Result:', result);
    process.exit(0);
  })
  .catch(function(error) {
    console.error('Fatal error:', error);
    process.exit(1);
  });

module.exports = {
  fetchBolnaCalls: fetchBolnaCalls,
  extractDataWithGroq: extractDataWithGroq,
  saveToDB: saveToDB,
  processBolnaCalls: processBolnaCalls
};