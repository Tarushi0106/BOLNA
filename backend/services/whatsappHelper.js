const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const MSG91_API_KEY = process.env.MSG91_API_KEY;
const MSG91_TEMPLATE_NAME = process.env.MSG91_TEMPLATE_NAME || 'welcome3';
const MSG91_NUMBER = process.env.MSG91_NUMBER || '919820708573';

/**
 * Send WhatsApp message to a single contact
 * @param {string} phoneNumber - Phone number (10 digits or with country code)
 * @param {string} name - Contact name
 * @returns {Promise<{success: boolean, data?: any, error?: any}>}
 */
async function sendWhatsAppMessage(phoneNumber, name) {
  try {
    // Clean and format phone number
    let cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    
    if (cleanNumber.length === 10) {
      cleanNumber = '91' + cleanNumber;
    }
    
    console.log(`📱 Sending WhatsApp to: ${cleanNumber} (${name})`);
    
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
    
    console.log(`✅ WhatsApp sent successfully to ${cleanNumber}`);
    return { success: true, data: response.data };
    
  } catch (error) {
    console.error(`❌ WhatsApp failed for ${phoneNumber}:`, error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
}

module.exports = { sendWhatsAppMessage };
