const { dbRun, initDb } = require('../server/db/connection');

async function update() {
  await initDb();
  console.log('Cleaning old templates...');
  await dbRun("DELETE FROM knowledge_base WHERE category = 'STYLE'");
  
  // Cleaned Template: Replaced ** with * for correct WhatsApp bolding
  const content = `🛑 *Class Details*

📚 Grade 6-11 Students
📞 0771234567

✅💸 *Monthly Class Fees*

🏆 *Sinhala Medium*

▪️ Grade 6-9 ➖ Rs.1200/-
▪️ Grade 10 ➖ Rs.1500/-
▪️ Grade 11 ➖ Rs.1500/-

🏦 *Bank Details*

📌 Bank of Ceylon (BOC)
Account No: 1234567890
Name: adeon class
Branch: Colombo

🆕 New students නම්, registration complete කරලා පසුව payment කරන්න 😊

⭕ Payment receipt එකේ *Name, WhatsApp Number, Paid Month, Grade* කියන details *pen එකෙන්* ලියලා එවීම අනිවාර්යයි.
❌ *එසේ නොමැති slips accept කරන්නේ නැහැ.*

🪯 Online Payment කරනවා නම්, payment කරන වෙලාවේ *Description / Remark* වලට class එකට සම්බන්ධ වෙන *WhatsApp Number* එක දාන්න.
❌ *එසේ නොමැති payments accept කරන්නේ නැහැ.*

📝 Tippex කරපු, කුරුටු ගාපු හෝ *පැහැදිලි නැති receipts* භාරගන්නේ නැහැ.

📍 Details ලියද්දී වැරදුනොත්, *single line එකකින් cut කරලා* නිවැරදි කරන්න.

💙 ලංකාවේ quality ම ONLINE SCIENCE CLASS එක

🛑 *Sampath Kumara*
BSc.(Sp) University of Peradeniya
📞 0771234567 (Hotline)`;

  console.log('Inserting Cleaned Master Template...');
  await dbRun('INSERT INTO knowledge_base (tutor_id, category, content) VALUES (?, ?, ?)', 
    [1, 'STYLE', content]);
    
  console.log('✅ Success: Cleaned Master Template is now LIVE with correct bolding!');
  process.exit(0);
}

update().catch(err => {
    console.error(err);
    process.exit(1);
});
