const { dbRun, dbExec, dbAll } = require('../server/db/connection');
const { getEmbedding } = require('../server/services/ai-utils');

async function modularize() {
  console.log('🚀 Starting RAG Modularization...');

  try {
    // 1. CLEANUP: Remove old enrollment/registration SOPs to avoid conflicts
    console.log('[1/4] Cleaning up conflicting SOPs...');
    await dbRun("DELETE FROM knowledge_base WHERE category = 'SOP' AND (content LIKE '%enrollment%' OR content LIKE '%register%')");
    await dbRun("DELETE FROM knowledge_base WHERE category = 'FAQ' AND (content LIKE '%how to join%')");

    // 2. INSERT MASTER SOPs
    console.log('[2/4] Inserting Master SOP Templates...');
    
    const masterSOPs = [
      {
        title: 'SOP_Registration_Success_Template',
        content: `Hari 😊 ඔයාව successfully register කරගත්තා.

🎓 [Grade] සඳහා මාසික class fee එක Rs. [Amount]

Bank Details:

Bank: [Bank Name]
Account Number: [Account Number]
Account Holder: [Holder Name]
Branch: [Branch]

Payment Rules:
⭕ Class fee payment receipt එකේ [Name], [WhatsApp Number], [Paid Month], [Grade] කියන details pen එකෙන් ලියලා එවීම අනිවාර්යයි.
එසේ නොමැති slips accept කරන්නේ නැහැ.

🪯❌ Online Payment කරනවා නම්, payment කරන වෙලාවේ Description / Remark වලට class එකට සම්බන්ධ වෙන WhatsApp Number එක දාන්න.
එසේ නොමැති payments accept කරන්නේ නැහැ.

📝❌ Tippex කරපු, කුරුටු ගාපු හෝ පැහැදිලි නැති receipts භාරගන්නේ නැහැ.

📍🖊️ Details ලියද්දී වැරදුනොත්, single line එකකින් cut කරලා නිවැරදි කරන්න.

{RECEIPT_INSTRUCTION}`,
        category: 'SOP'
      },
      {
        title: 'SOP_General_Class_Information_Template',
        content: `🛑 Class details සහ payment කරන විදිහ පහතින් බලන්න 😊

✅ Monthly Class Fees (Sinhala Medium)
Grade 6-9 ➖ Rs.1200/-
Grade 10 ➖ Rs.1500/-
Grade 11 ➖ Rs.1500/-

🏦 Bank Details
📌 Bank: [Bank Name]
Account No: [Account Number]
Name: [Holder Name]
Branch: [Branch]

🆕 New student කෙනෙක් නම්, මුලින්ම ඔයාගේ details (Name, Grade, School, Phone, Address) එවලා register වෙන්න 😊 ඊට පස්සේ payment එක කරන්න පුළුවන්.

⭕ Payment කරලා receipt එකේ ඔබගේ Name, Phone, Paid Month, Grade ලියලා photo එකක් එවන්න.

💙 ලංකාවේ quality ම ONLINE SCIENCE CLASS එක
🛑 Sampath Kumara BSc.(Sp)
📞 077 1234567 (Hotline)`,
        category: 'SOP'
      },
      {
        title: 'SOP_Sibling_Registration_Policy',
        content: `Never allow more than one student to be registered on a single WhatsApp account. If a student tries to add a sibling or another person, politely explain the "unique profile" rule and ask them to message from the other person's phone no. 
        Style: "ඔයාගේ [brother/sister/friend] ව register කරන්න වෙනම WhatsApp number එකක් ඕනේ 😊 අපේ system එකේ හැමෝටම separate profiles තියෙන්න ඕනේ නිසා එයාගේ phone no එකෙන් අපිට message එකක් එවන්න කියන්න."`,
        category: 'SOP'
      }
    ];

    for (const sop of masterSOPs) {
      const embedding = await getEmbedding(sop.content);
      await dbRun(
        'INSERT INTO knowledge_base (tutor_id, content, category, embedding, metadata) VALUES (?, ?, ?, ?, ?)',
        [1, sop.content, sop.category, JSON.stringify(embedding), JSON.stringify({ title: sop.title })]
      );
      console.log(`   ✅ Inserted SOP: ${sop.title}`);
    }

    // 3. INSERT STYLE EXAMPLES
    console.log('[3/4] Inserting Few-Shot Style Examples...');
    const styles = [
      { intent: 'ADMISSION', student: 'Mata mage yaluwekwa register karanna ona', reply: 'ඔයාගේ friend ව register කරන්න වෙනම WhatsApp number එකක් ඕනේ 😊 අපේ system එකේ හැමෝටම separate profiles තියෙන්න ඕනේ නිසා එයාගේ phone no එකෙන් අපිට message එකක් එවන්න කියන්න.' },
      { intent: 'ADMISSION', student: 'Nangiwa add karanna puluwanda?', reply: 'ඔයාගේ sister ව register කරන්න වෙනම WhatsApp number එකක් ඕනේ 😊 අපේ system එකේ හැමෝටම separate profiles තියෙන්න ඕනේ නිසා එයාගේ phone no එකෙන් අපිට message එකක් එවන්න කියන්න.' },
      { intent: 'GREETING', student: 'Hi Sir', reply: 'මම Admin 😊 Sir ට message එකක් forward කරන්නම්.' },
      { intent: 'GREETING', student: 'Ayubowan', reply: 'ආයුබෝවන් 😊 Adeon Science Class Admin මම. මොනවද help කරන්න?' },
      { intent: 'PAYMENT', student: 'Pay kela, link na', reply: 'receipt එක එවන්න 😊 link එක දෙන්නම්.' },
      { intent: 'OTHER', student: 'Explain this topic', reply: 'මේක subject එකට අදාළ ප්‍රශ්නයක් නිසා මම Sir ට forward කරන්නම් 😊 Sir ඒකට reply එකක් දෙයි.' }
    ];

    for (const style of styles) {
      await dbRun(
        'INSERT INTO knowledge_examples (tutor_id, intent, student_message, ideal_reply) VALUES (?, ?, ?, ?)',
        [1, style.intent, style.student, style.reply]
      );
    }
    console.log(`   ✅ Inserted ${styles.length} style examples.`);

    console.log('\n✨ RAG Modularization Complete! You can now clean up ai.js.');
  } catch (err) {
    console.error('❌ Modularization Failed:', err);
  } finally {
    process.exit();
  }
}

modularize();
