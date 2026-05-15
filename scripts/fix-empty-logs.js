const { dbRun } = require('../server/db/connection');
dbRun("DELETE FROM message_logs WHERE content IS NULL OR content = ''")
  .then(r => { console.log('Cleared', r.changes, 'empty logs'); process.exit(0); });
