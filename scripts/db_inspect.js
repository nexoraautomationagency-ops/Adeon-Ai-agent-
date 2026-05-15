const { dbAll } = require('../server/db/connection');
dbAll("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'knowledge_base'")
  .then(data => console.log(JSON.stringify(data, null, 2)))
  .catch(err => console.error(err));
