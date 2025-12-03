const cron = require('node-cron');
const { processBolnaCalls } = require('./services/bolnaService');
require('dotenv').config();

console.log('=== Bolna AI Scheduler Started ===\n');

async function runBolnaScraping() {
  try {
    console.log(`[${new Date().toLocaleString()}] Starting Bolna scraping...`);
    const result = await processBolnaCalls();
    
    if (result.success) {
      console.log(`[${new Date().toLocaleString()}] ✓ Scraping completed!`);
      console.log(`  - Processed: ${result.processed}`);
      console.log(`  - Saved: ${result.saved}`);
      if (result.errors && result.errors.length > 0) {
        console.log(`  - Errors: ${result.errors.length}`);
      }
    } else {
      console.log(`[${new Date().toLocaleString()}] ✗ Scraping failed: ${result.error}`);
    }
  } catch (error) {
    console.error(`[${new Date().toLocaleString()}] Error during scraping:`, error.message);
  }
}

console.log('Scheduling Bolna scraping...');
console.log('Schedule: Every day at 2:00 AM\n');

const task = cron.schedule('0 2 * * *', () => {
  runBolnaScraping();
}, {
  scheduled: true,
  timezone: 'Asia/Kolkata'
});

console.log('✓ Scheduler is running and will automatically scrape Bolna calls daily at 2 AM');
console.log('\nSchedule patterns:');
console.log('  0 2 * * *    = Every day at 2 AM');
console.log('  0 */2 * * *  = Every 2 hours');
console.log('  0 9 * * 1-5  = Weekdays at 9 AM');
console.log('  */30 * * * * = Every 30 minutes\n');

console.log('To change the schedule, edit the cron pattern above.');
console.log('Press Ctrl+C to stop the scheduler.\n');

process.on('SIGINT', () => {
  console.log('\nScheduler stopped');
  task.stop();
  process.exit(0);
});
