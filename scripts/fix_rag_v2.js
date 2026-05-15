const { dbRun, initDb } = require('../server/db/connection');
const { getEmbedding } = require('../server/services/ai-utils');

async function fix() {
  await initDb();
  console.log('Cleaning RAG...');
  await dbRun("DELETE FROM knowledge_base WHERE category = 'SOP'");
  
  console.log('Inserting Exact Master SOP...');
  const content = `Hari 😊 ඔයාව successfully register කරගත්තා.

🎓 [Grade] Grade සඳහා මාසික class fee එක Rs. [Fee]

Bank Details:
Bank: [Bank]
Account Number: [Account]
Account Holder: [Holder]
Branch: [Branch]

Payment Rules:
⭕ Class fee payment receipt එකේ [Name], [Phone], [Month], [Grade] කියන details pen එකෙන් ලියලා එවීම අනිවාර්යයි.
එසේ නොමැති slips accept කරන්නේ නැහැ.

🪯❌ Online Payment කරනවා නම්, payment කරන වෙලාවේ Description / Remark වලට class එකට සම්බන්ධ වෙන WhatsApp Number එක දාන්න.
එසේ නොමැති payments accept කරන්නේ නැහැ.

📝❌ Tippex කරපු, කුරුටු ගාපු හෝ පැහැදිලි නැති receipts භාරගන්නේ නැහැ.

📍🖊️ Details ලියද්දී වැරදුනොත්, single line එකකින් cut කරලා නිවැරදි කරන්න.

කරුණාකර payment එක කරලා receipt එක මෙතනට එවන්න. ඊට පස්සේ ඔයාව official WhatsApp group එකට add කරන්නම්. 😊`;

  const emb = await getEmbedding(content);
  await dbRun(
    'INSERT INTO knowledge_base (tutor_id, content, category, embedding, metadata) VALUES (?, ?, ?, ?, ?)',
    [1, content, 'SOP', JSON.stringify(emb), JSON.stringify({ title: 'MASTER_REGISTRATION_FLOW' })]
  );
  
  console.log('✨ Master SOP updated with EXACT wording.');
  process.exit(0);
}

fix().catch(err => {
    console.error(err);
    process.exit(1);
});
