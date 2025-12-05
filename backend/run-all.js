#!/usr/bin/env node

/**
 * Main orchestration script for Bolna + WhatsApp Service
 * Runs the complete workflow: Fetch calls → Extract data → Send WhatsApp messages
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const bolnaService = require('./services/bolnaService');
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

console.log('\n╔════════════════════════════════════════════════════════╗');
console.log('║   BOLNA + WHATSAPP INTEGRATED SERVICE                 ║');
console.log('║   Fetch Calls → Extract Data → Send Messages          ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

async function runAllServices() {
  try {
    // Step 1: Connect to MongoDB
    console.log('📡 Step 1: Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Step 2: Run Bolna Service (Fetch and Extract)
    console.log('📡 Step 2: Fetching calls from Bolna AI and extracting data...');
    await bolnaService.processBolnaCalls();
    console.log('✅ Bolna data extraction completed\n');

    // Step 3: Fetch saved data and prepare for WhatsApp
    console.log('📡 Step 3: Fetching contacts from MongoDB...');
    const callSchema = new mongoose.Schema({}, { strict: false });
    let BolnaCall;
    try {
      BolnaCall = mongoose.model('BolnaCall');
    } catch {
      BolnaCall = mongoose.model('BolnaCall', callSchema, 'bolnaCalls');
    }

    const contacts = await BolnaCall.find({
      phone_number: { $exists: true, $ne: 'Not provided' }
    }).sort({ createdAt: -1 }).limit(5); // Limit to 5 for testing

    console.log(`✅ Found ${contacts.length} contacts\n`);

    if (contacts.length === 0) {
      console.log('⚠️  No contacts to send WhatsApp messages\n');
      await mongoose.connection.close();
      console.log('✅ Workflow completed!\n');
      process.exit(0);
    }

    // Step 4: Send WhatsApp Messages
    console.log('📡 Step 4: Preparing to send WhatsApp messages...\n');
    
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      
      console.log(`\n--- Sending ${i + 1} of ${contacts.length} ---`);
      console.log('Name:', contact.name);
      console.log('Phone:', contact.phone_number);
      
      if (!contact.phone_number || contact.phone_number === 'Not provided') {
        console.log('⏭️  Skipping - no phone number');
        failCount++;
        continue;
      }

      // Create WhatsApp message
      const name = contact.name || 'there';
      const bestTime = contact.best_time_to_call || 'soon';
      
      let message = `Hello ${name}! 👋\n\n`;
      message += 'Thank you for your interest in *DCRA* from *Shaurrya TeleServices*.\n\n';
      message += `📞 Your callback is scheduled for: *${bestTime}*\n\n`;
      message += 'Our team will contact you to discuss:\n';
      message += '✅ Digital Certification Ratings & Assessments\n';
      message += '✅ TRAI empanelled services\n';
      message += '✅ Telecom coverage evaluation\n\n';
      message += '🌐 Visit: www.shaurryatele.com\n\n';
      message += 'Best regards,\n';
      message += '*Shaurrya TeleServices Team*';

      try {
        // Clean phone number
        let cleanNumber = contact.phone_number.replace(/[^0-9]/g, '');
        if (cleanNumber.length === 10) {
          cleanNumber = '91' + cleanNumber;
        }

        // Here you would integrate with WhatsApp/MSG91 service
        // For now, just log it
        console.log(`📤 Message prepared for: +${cleanNumber}`);
        console.log(`✅ Ready to send!`);
        successCount++;

      } catch (error) {
        console.error('❌ Error:', error.message);
        failCount++;
      }

      // Wait between messages
      if (i < contacts.length - 1) {
        console.log('⏳ Waiting 3 seconds before next message...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║   WORKFLOW COMPLETED!                                  ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    console.log('📊 Summary:');
    console.log(`   Total Contacts: ${contacts.length}`);
    console.log(`   ✅ Ready to Send: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log('');

    await mongoose.connection.close();
    console.log('✅ Database connection closed\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Fatal Error:', error.message);
    console.error(error.stack);
    try {
      await mongoose.connection.close();
    } catch (e) {
      // ignore
    }
    process.exit(1);
  }
}

// Run the complete workflow
runAllServices();
