const { dbGet, dbRun, dbAll } = require('../server/db/connection');
const normalizationService = require('../server/services/normalization');

async function backfillNormalizedPhone() {
  try {
    console.log('[Backfill] Starting normalized_phone backfill...');
    
    // Get all students with phone but missing normalized_phone
    const students = await dbAll(
      `SELECT id, tutor_id, phone FROM students WHERE phone IS NOT NULL AND phone != '' AND (normalized_phone IS NULL OR normalized_phone = '')`,
      []
    );
    
    console.log(`[Backfill] Found ${students.length} students needing normalization`);
    
    let updated = 0;
    let failed = 0;
    
    for (const student of students) {
      try {
        const normalizedPhone = normalizationService.normalizePhone(student.phone);
        
        if (normalizedPhone) {
          await dbRun(
            'UPDATE students SET normalized_phone = ? WHERE id = ?',
            [normalizedPhone, student.id]
          );
          updated++;
          console.log(`✅ [${student.id}] "${student.phone}" → "${normalizedPhone}"`);
        } else {
          console.log(`⚠️  [${student.id}] Could not normalize "${student.phone}"`);
          failed++;
        }
      } catch (e) {
        console.error(`❌ [${student.id}] Error:`, e.message);
        failed++;
      }
    }
    
    console.log(`\n[Backfill] Complete! Updated: ${updated}, Failed: ${failed}`);
    process.exit(0);
  } catch (e) {
    console.error('[Backfill] Fatal error:', e.message);
    process.exit(1);
  }
}

backfillNormalizedPhone();
