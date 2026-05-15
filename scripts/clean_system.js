const { dbRun } = require('../server/db/connection');

async function cleanSystem() {
  try {
    console.log('🧹 Starting system cleanup...');
    
    // 1. Clear Message Logs (Conversation History)
    const logsRes = await dbRun('DELETE FROM message_logs');
    console.log(`✅ Message logs cleared. (${logsRes.changes} entries removed)`);
    
    // 2. Clear AI Response Cache
    const cacheRes = await dbRun('DELETE FROM ai_cache');
    console.log(`✅ AI Cache cleared. (${cacheRes.changes} entries removed)`);

    // 3. Clear Attendance Logs (Optional - Keep this commented out if you want to keep attendance)
    // await dbRun('DELETE FROM attendance');
    
    console.log('✨ Cleanup complete!');
  } catch (err) {
    console.error('❌ Cleanup failed:', err.message);
  }
}

cleanSystem();
