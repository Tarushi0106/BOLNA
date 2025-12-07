const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const MSG91_API_KEY = process.env.MSG91_API_KEY;

async function testSend() {
  try {
    const response = await axios.post(
      'https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/',
      {
        integrated_number: '919820708573',
        content_type: 'template',
        payload: {
          messaging_product: 'whatsapp',
          type: 'template',
          template: {
            name: 'welcome3',
            language: {
              code: 'en',
              policy: 'deterministic'
            },
            to_and_components: [
              {
                to: ['919910205084'], 
                components: {}
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
    
    console. log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('Error:', error. response?.data || error.message);
  }
}

testSend();