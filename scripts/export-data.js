const { dbAll } = require('../server/db/connection');
const fs = require('fs');
const path = require('path');

async function exportData() {
  try {
    console.log('📦 Starting data export...');
    
    const students = await dbAll('SELECT * FROM students');
    const payments = await dbAll('SELECT * FROM payments');
    const classes = await dbAll('SELECT * FROM classes');
    
    const exportPath = path.join(__dirname, '../export_backup.json');
    const data = {
      exported_at: new Date().toISOString(),
      students,
      payments,
      classes
    };
    
    fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));
    console.log(`✅ Data exported to: ${exportPath}`);
    console.log(`📊 Stats: ${students.length} students, ${payments.length} payments, ${classes.length} classes.`);
  } catch (err) {
    console.error('❌ Export failed:', err.message);
  }
}

exportData().then(() => process.exit(0));
