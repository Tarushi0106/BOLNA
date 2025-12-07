const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// MSG91 Configuration
const MSG91_API_KEY = process.env.MSG91_API_KEY;
const MSG91_TEMPLATE_NAME = process.env.MSG91_TEMPLATE_NAME || 'welcome3';
const MSG91_NUMBER = process.env.MSG91_NUMBER || '919820708573';

// MongoDB
const MONGODB_URI = process.env.MONGODB_URI;

console.log('=================================');
console.log('Starting MSG91 WhatsApp Service...');
console.log('=================================\n');

// Send WhatsApp via MSG91
async function sendWhatsApp(phoneNumber, name) {
  try {
    let cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    
    if (cleanNumber.length === 10) {
      cleanNumber = '91' + cleanNumber;
    }
    
    const response = await axios.post(
      'https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/',
      {
        integrated_number: MSG91_NUMBER,
        content_type: 'template',
        payload: {
          messaging_product: 'whatsapp',
          type: 'template',
          template: {
            name: MSG91_TEMPLATE_NAME,
            language: {
              code: 'en',
              policy: 'deterministic'
            },
            to_and_components: [
              {
                to: [cleanNumber],
                components: {
                  body_1: {
                    type: 'text',
                    value: name || 'Customer'
                  }
                }
              }
            ]
          }
        }
      },
      {
        headers: {
          'authkey': MSG91_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return { success: true, data: response.data };
    
  } catch (error) {
    return { success: false, error: error.response?.data || error.message };
  }
}

// Main function
async function main() {
  try {
    console.log('Connecting to MongoDB.. .');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const callSchema = new mongoose.Schema({}, { strict: false });
    let BolnaCall;
    try {
      BolnaCall = mongoose.model('BolnaCall');
    } catch {
      BolnaCall = mongoose.model('BolnaCall', callSchema, 'bolnaCalls');
    }
    
    // GET ALL CONTACTS with phone numbers
    const contacts = await BolnaCall.find({
      phone_number: { $exists: true, $ne: null, $ne: '', $ne: 'Not provided' }
    }).sort({ createdAt: -1 });
    
    console. log('Found ' + contacts.length + ' contacts\n');
    
    if (contacts.length === 0) {
      console. log('No contacts to message! ');
      await mongoose.connection. close();
      return;
    }
    
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      
      console.log('\n--- Sending ' + (i + 1) + ' of ' + contacts. length + ' ---');
      console.log('Name:', contact.name || 'Not provided');
      console.log('Phone:', contact. phone_number);
      
      // Skip if no valid phone number
      if (!contact. phone_number || contact.phone_number === 'Not provided' || contact.phone_number. length < 10) {
        console.log('⏭️ Skipping - invalid phone number');
        skippedCount++;
        continue;
      }
      
      const result = await sendWhatsApp(contact.phone_number, contact.name);
      
      if (result.success) {
        console.log('✅ Message sent to:', contact.phone_number);
        
        // Update status in database
        await BolnaCall.findByIdAndUpdate(contact._id, {
          whatsapp_status: 'sent',
          whatsapp_sent_at: new Date(),
          whatsapp_message_id: result.data?.message_id || null
        });
        
        successCount++;
      } else {
        console.log('❌ Failed:', JSON.stringify(result.error));
        
        // Update status in database
        await BolnaCall.findByIdAndUpdate(contact._id, {
          whatsapp_status: 'failed',
          whatsapp_error: JSON.stringify(result.error)
        });
        
        failCount++;
      }
      
      // Wait 2 seconds between messages (avoid rate limiting)
      if (i < contacts.length - 1) {
        console.log('⏳ Waiting 2 seconds.. .');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('\n========================================');
    console.log('✅ COMPLETED! ');
    console.log('========================================');
    console.log('Total Contacts:', contacts.length);
    console.log('✅ Sent:', successCount);
    console.log('❌ Failed:', failCount);
    console.log('⏭️ Skipped:', skippedCount);
    console.log('========================================\n');
    
    await mongoose.connection.close();
    console.log('Done!');
    
  } catch (error) {
    console. error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();