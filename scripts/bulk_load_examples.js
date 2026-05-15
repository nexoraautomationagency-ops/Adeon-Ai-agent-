const { initDb, dbRun, dbExec, dbGet } = require('../server/db/connection');

const EXAMPLES = [
  // ADMISSION
  { intent: 'ADMISSION', q: "Hi, join wenna puluwanda?", a: "ආයුබෝවන් 😊 Join වෙන්න පුළුවන්. ඔයා දැනට ඉගෙන ගන්නේ මොන Grade එකේද?" },
  { intent: 'ADMISSION', q: "Grade 10", a: "හොඳයි 😊 Full Name, School, Phone Number සහ join වෙන්න ඕනේ month එක එවන්න පුළුවන්ද?" },
  { intent: 'ADMISSION', q: "My school change", a: "හරි 😊 New school එක එවන්න, මම system එක update කරන්නම්." },
  { intent: 'ADMISSION', q: "Phone number change", a: "හරි 😊 New number එක send කරන්න, මම update කරන්නම්." },
  { intent: 'ADMISSION', q: "Join process?", a: "මුලින්ම ඔයාගේ Grade එක කියන්න 😊 ඊට පස්සේ details අරගෙන bank info දෙන්නම්." },
  { intent: 'ADMISSION', q: "Change grade", a: "ඔයා join වෙන්න ඕනේ new Grade එක කියන්න 😊 මම update කරන්නම්." },
  { intent: 'ADMISSION', q: "Can I join late?", a: "ඔව් පුළුවන් 😊 missed topics recordings වලින් cover කරගන්න පුළුවන්." },
  { intent: 'ADMISSION', q: "Wrong info sent", a: "ප්රශ්නයක් නැහැ 😊 නිවැරදි විස්තර ටික මෙතනට එවන්න." },
  { intent: 'ADMISSION', q: "Can I switch online?", a: "ඔව් පුළුවන් 😊 Grade එකයි school එකයි නැවත එවන්න, මම update කරන්නම්." },
  { intent: 'ADMISSION', q: "Physical to online?", a: "පුළුවන් 😊 details ටික එවන්න, මම system එක update කරන්නම්." },
  { intent: 'ADMISSION', q: "Online to physical?", a: "Nugegoda physical class එකේ seats තියෙනවද කියලා check කරලා කියන්නම් 😊" },
  { intent: 'ADMISSION', q: "Register wenna ona", a: "හරි 😊 මුලින්ම ඔයාගේ Grade එක කියන්න." },
  { intent: 'ADMISSION', q: "I am in Grade 11", a: "හොඳයි 😊 Full Name, School, සහ Phone Number එක එවන්න." },
  { intent: 'ADMISSION', q: "Amila Perera, Ananda College, 0771234567", a: "ස්තුතියි Amila 😊 ඔයා join වෙන්නේ මොන month එකටද?" },
  { intent: 'ADMISSION', q: "May month join wenne", a: "හරි 😊 bank details එවන්නම්, payment කරලා receipt එක එවන්න." },
  { intent: 'ADMISSION', q: "Ayet details denna onada?", a: "ඔයාගේ details change වුණා නම් විතරක් එවන්න 😊" },
  { intent: 'ADMISSION', q: "How to join paper class?", a: "මුලින්ම Grade එක කියන්න 😊 ඊට පස්සේ details දෙන්නම්." },
  { intent: 'ADMISSION', q: "Grade 11 Theory & Paper dekama ona", a: "හොඳයි 😊 details ටික එවන්න, register කරන්නම්." },
  { intent: 'ADMISSION', q: "Admission fee thiyenawada?", a: "නැහැ 😊 monthly class fee විතරයි තියෙන්නේ." },
  { intent: 'ADMISSION', q: "Mama 2026 O/L", a: "හරි 😊 ඒ කියන්නේ Grade 10 නේද? details එවන්න." },
  { intent: 'ADMISSION', q: "Details sent", a: "ස්තුතියි 😊 system එකට add කරනවා." },
  { intent: 'ADMISSION', q: "Can I join today?", a: "ඔව් පුළුවන් 😊 details එවන්න, payment කරලා link එක දෙන්නම්." },
  { intent: 'ADMISSION', q: "I'm a new student", a: "Welcome 😊 ඔයා දැනට ඉගෙන ගන්නේ මොන Grade එකේද?" },
  { intent: 'ADMISSION', q: "Register karanna", a: "හරි 😊 Grade එක සහ school එක මුලින්ම කියන්න." },
  { intent: 'ADMISSION', q: "Update my phone", a: "හරි 😊 new phone number එක එවන්න, update කරන්නම්." },
  { intent: 'ADMISSION', q: "Can I register my brother?", a: "ඔයාගේ brother ව register කරන්න වෙනම WhatsApp number එකක් ඕනේ 😊 අපේ system එකේ හැමෝටම separate profiles තියෙන්න ඕනේ නිසා එයාගේ phone no එකෙන් අපිට message එකක් එවන්න කියන්න." },
  { intent: 'ADMISSION', q: "Mata mage ayyawa add karanna one", a: "ඔයාගේ brother ව register කරන්න වෙනම WhatsApp number එකක් ඕනේ 😊 අපේ system එකේ හැමෝටම separate profiles තියෙන්න ඕනේ නිසා එයාගේ phone no එකෙන් අපිට message එකක් එවන්න කියන්න." },
  { intent: 'ADMISSION', q: "Nangiwa add karanna puluwanda?", a: "ඔයාගේ sister ව register කරන්න වෙනම WhatsApp number එකක් ඕනේ 😊 අපේ system එකේ හැමෝටම separate profiles තියෙන්න ඕනේ නිසා එයාගේ phone no එකෙන් අපිට message එකක් එවන්න කියන්න." },
  { intent: 'ADMISSION', q: "Mata mage yaluwekwa register karanna ona", a: "ඔයාගේ friend ව register කරන්න වෙනම WhatsApp number එකක් ඕනේ 😊 අපේ system එකේ හැමෝටම separate profiles තියෙන්න ඕනේ නිසා එයාගේ phone no එකෙන් අපිට message එකක් එවන්න කියන්න." },

  // PAYMENT
  { intent: 'PAYMENT', q: "Payment how?", a: "Bank details වලට payment කරලා receipt photo එක එවන්න 😊" },
  { intent: 'PAYMENT', q: "Receipt sent", a: "ස්තුතියි 😊 24 hours ඇතුළත verify කරලා group එකට add කරනවා." },
  { intent: 'PAYMENT', q: "Discount ekak denna puluwanda?", a: "Standard fee එක තමයි තියෙන්නේ 😊 Sir ට message එකක් දාලා අහන්න." },
  { intent: 'PAYMENT', q: "Refund one", a: "Fees non-refundable 😊 අවශ්ය නම් next month එකට transfer කරන්න පුළුවන්." },
  { intent: 'PAYMENT', q: "Printed tute one", a: "Online students ලට PDF දෙනවා 😊 printed tutes ගැන Sir ගෙන් අහන්න." },
  { intent: 'PAYMENT', q: "Payment receipt lost", a: "Bank app screenshot එකක් එවන්න 😊 අපි verify කරන්නම්." },
  { intent: 'PAYMENT', q: "Late payment ok?", a: "ප්රශ්නයක් නැහැ 😊 class එකට කලින් pay කරන්න පුළුවන්." },
  { intent: 'PAYMENT', q: "Wrong payment sent", a: "අපි check කරන්නම් 😊 Admin කෙනෙක් ඔයාට contact කරයි." },
  { intent: 'PAYMENT', q: "Can I pay later?", a: "සාමාන්යයෙන් class එකට කලින් pay කරන්න ඕනේ 😊" },
  { intent: 'PAYMENT', q: "No access after payment", a: "හරි 😊 receipt එක නැවත check කරන්නම්." },
  { intent: 'PAYMENT', q: "Payment confirmed?", a: "Admin verify කරනවා 😊 confirm වුණාම message එක එවන්නම්." },
  { intent: 'PAYMENT', q: "Bank info please", a: "මෙන්න bank details 😊 [Bank Details]" },
  { intent: 'PAYMENT', q: "Fee for Grade 10?", a: "Grade 10 monthly fee Rs. 1500/= 😊" },
  { intent: 'PAYMENT', q: "Two months pay karන්නද?", a: "පුළුවන් 😊 receipt එකේ months mention කරන්න." },
  { intent: 'PAYMENT', q: "Card payment thiyenawada?", a: "දැනට bank transfer/deposit විතරයි 😊" },
  { intent: 'PAYMENT', q: "Payment verify karanna kela wenawada?", a: "24 hours ඇතුළත verify කරනවා 😊" },
  { intent: 'PAYMENT', q: "Mistake in receipt", a: "ප්රශ්නයක් නැහැ 😊 correct details එවන්න." },
  { intent: 'PAYMENT', q: "Scholarship thiyenawada?", a: "ඒ ගැන Sir ට direct message එකක් දාන්න 😊" },
  { intent: 'PAYMENT', q: "Monthly fee change?", a: "නැහැ 😊 same fee එක තියෙන්නේ." },
  { intent: 'PAYMENT', q: "How to send receipt?", a: "WhatsApp එකට photo එකක් විදිහට එවන්න 😊" },
  { intent: 'PAYMENT', q: "Is it paid?", a: "ඔයාගේ name එක එවන්න 😊 check කරන්නම්." },
  { intent: 'PAYMENT', q: "Pay kela, link na", a: "receipt එක එවන්න 😊 link එක දෙන්නම්." },
  { intent: 'PAYMENT', q: "Online vs Physical fee?", a: "දෙකටම same fee එක 😊" },
  { intent: 'PAYMENT', q: "Can I pay by cash?", a: "Physical class එකේදී cash pay කරන්න පුළුවන් 😊" },
  { intent: 'PAYMENT', q: "Payment deadline?", a: "සෑම month එකේම first week එක ඇතුළත 😊" },

  // SCHEDULE
  { intent: 'SCHEDULE', q: "Next class kada?", a: "Pinned message එක check කරන්න 😊 updates තිබ්බොත් Sir announce කරයි." },
  { intent: 'SCHEDULE', q: "Class schedule?", a: "Standard schedule එක තියෙන්නේ 😊 pinned message එක බලන්න." },
  { intent: 'SCHEDULE', q: "Teacher who?", a: "Science classes කරන්නේ Mr. Sampath Kumara 😊" },
  { intent: 'SCHEDULE', q: "Subjects mokakda?", a: "O/L Science (Biology, Physics, Chemistry) 😊" },
  { intent: 'SCHEDULE', q: "Physical location?", a: "Nugegoda physical class 😊" },
  { intent: 'SCHEDULE', q: "Holiday class thiyenawada?", a: "පෝය දවස් වල සාමාන්යයෙන් නිවාඩු 😊" },
  { intent: 'SCHEDULE', q: "Grade 11 class time?", a: "Sunday 8 AM 😊 pinned message එක check කරන්න." },
  { intent: 'SCHEDULE', q: "Is there a class today?", a: "ඔව් 😊 changes තිබ්බොත් විතරයි announce කරන්නේ." },
  { intent: 'SCHEDULE', q: "Tutor's background?", a: "Mr. Sampath Kumara experienced Science teacher කෙනෙක් 😊" },
  { intent: 'SCHEDULE', q: "What do you cover?", a: "Full O/L syllabus + past papers 😊" },
  { intent: 'SCHEDULE', q: "Extra class thiyeda?", a: "Group එක check කරන්න 😊 announce කරනවා." },
  { intent: 'SCHEDULE', q: "Syllabus cover wenawada?", a: "අනිවාර්යයෙන් 😊 full syllabus cover කරනවා." },
  { intent: 'SCHEDULE', q: "When is revision?", a: "Exam එකට කලින් revision පටන් ගන්නවා 😊" },
  { intent: 'SCHEDULE', q: "Grade 10 physical?", a: "ඔව් 😊 Nugegoda physical class තියෙනවා." },
  { intent: 'SCHEDULE', q: "Zoom classes only?", a: "නැහැ 😊 physical + online දෙකම තියෙනවා." },
  { intent: 'SCHEDULE', q: "Medium mokakda?", a: "Sinhala Medium 😊" },
  { intent: 'SCHEDULE', q: "Class duration?", a: "2-3 hours 😊" },
  { intent: 'SCHEDULE', q: "Recording link kada?", a: "Class එකෙන් පස්සේ group එකට link එවෙනවා 😊" },
  { intent: 'SCHEDULE', q: "Can I see a demo?", a: "YouTube lectures තියෙනවා 😊" },
  { intent: 'SCHEDULE', q: "Subject chapters?", a: "All chapters step by step 😊" },
  { intent: 'SCHEDULE', q: "Next month schedule?", a: "Month end එකේ publish කරනවා 😊" },
  { intent: 'SCHEDULE', q: "Online vs Physical syllabus?", a: "Same syllabus 😊" },
  { intent: 'SCHEDULE', q: "Tutor qualification?", a: "10+ years experience teacher 😊" },
  { intent: 'SCHEDULE', q: "Is it Sinhala Medium?", a: "ඔව් 😊 Sinhala Medium Science." },
  { intent: 'SCHEDULE', q: "Class start time?", a: "Pinned message එකේ තියෙනවා 😊" },

  // TECHNICAL
  { intent: 'TECHNICAL', q: "Zoom join wenna ba", a: "Exit වෙලා නැවත join වෙන්න 😊 audio settings check කරන්න." },
  { intent: 'TECHNICAL', q: "Audio wada na", a: "Internet check කරලා rejoin වෙන්න 😊" },
  { intent: 'TECHNICAL', q: "Tute eka awilla na", a: "PDFs group එකේ media section එකේ තියෙනවා 😊" },
  { intent: 'TECHNICAL', q: "Group locked why?", a: "Spam avoid කරන්න Admin only කරලා තියෙන්නේ 😊" },
  { intent: 'TECHNICAL', q: "Missed Zoom link", a: "Pinned messages check කරන්න 😊" },
  { intent: 'TECHNICAL', q: "Recording not working", a: "නැවත try කරන්න හෝ වෙන browser එකක් use කරන්න 😊" },
  { intent: 'TECHNICAL', q: "Science doubt help", a: "මේක note කරගන්නවා 😊 Sir explain කරයි." },
  { intent: 'TECHNICAL', q: "Hard question help", a: "මේක Sir ට forward කරනවා 😊" },
  { intent: 'TECHNICAL', q: "Recording limited time?", a: "30 days access තියෙනවා 😊" },
  { intent: 'TECHNICAL', q: "App not working", a: "App update හෝ restart කරන්න 😊" },
  { intent: 'TECHNICAL', q: "No reply in group", a: "Group එක Admin only 😊 මෙතන message කරන්න." },
  { intent: 'TECHNICAL', q: "Slow internet Zoom", a: "Audio only use කරන්න 😊" },
  { intent: 'TECHNICAL', q: "Link update pls", a: "Pinned message එක check කරන්න 😊" },
  { intent: 'TECHNICAL', q: "Can I ask science doubt?", a: "ඔව් 😊 question එක එවන්න." },
  { intent: 'TECHNICAL', q: "Explain this topic", a: "Sir ට forward කරනවා 😊" },
  { intent: 'TECHNICAL', q: "Recording extension ona", a: "30 days limit තියෙනවා 😊" },
  { intent: 'TECHNICAL', q: "PDF missing", a: "Media/Docs section එක බලන්න 😊" },
  { intent: 'TECHNICAL', q: "Login issue", a: "Zoom email check කරලා login වෙන්න 😊" },
  { intent: 'TECHNICAL', q: "Tute delivered?", a: "3-5 days ඇතුළත deliver කරනවා 😊" },
  { intent: 'TECHNICAL', q: "Support thiyenawada?", a: "ඔව් 😊 technical help තියෙනවා." },
  { intent: 'TECHNICAL', q: "Mic issue in Zoom", a: "Mic permissions enable කරන්න 😊" },
  { intent: 'TECHNICAL', q: "Can't download PDF", a: "Storage check කරන්න 😊" },
  { intent: 'TECHNICAL', q: "Recording buffer wenawa", a: "Internet speed check කරන්න 😊" },
  { intent: 'TECHNICAL', q: "Urgent technical help", a: "Admin team එක check කරනවා 😊" },
  { intent: 'TECHNICAL', q: "Subject problem", a: "Sir ට forward කරනවා 😊" },

  // GREETING
  { intent: 'GREETING', q: "Hi", a: "ආයුබෝවන් 😊 Adeon Science Class Admin මම. මොනවද help කරන්න?" },
  { intent: 'GREETING', q: "Hello", a: "Hello 😊 කොහොමද help කරන්න පුළුවන්?" },
  { intent: 'GREETING', q: "Thanks", a: "Welcome 😊 ඕනෑම වෙලාවක help එකක් ඕනේ නම් කියන්න." },
  { intent: 'GREETING', q: "Ok understood", a: "හොඳයි 😊" },
  { intent: 'GREETING', q: "Bye", a: "Bye 😊 සුබ දවසක්!" },
  { intent: 'GREETING', q: "Ayubowan", a: "ආයුබෝවන් 😊 කොහොමද help කරන්න?" },
  { intent: 'GREETING', q: "Good morning", a: "Good morning 😊 මොනවද දැනගන්න ඕනේ?" },
  { intent: 'GREETING', q: "Sinhala puluwanda?", a: "ඔව් 😊 Sinhala වලින් අහන්න පුළුවන්." },
  { intent: 'GREETING', q: "English ok?", a: "Yes 😊 I can help in English too." },
  { intent: 'GREETING', q: "Wait a minute", a: "හරි 😊 take your time." },
  { intent: 'GREETING', q: "Is this Admin?", a: "ඔව් 😊 official Admin මම." },
  { intent: 'GREETING', q: "Thanks for help", a: "ස්තුතියි 😊 Good luck!" },
  { intent: 'GREETING', q: "I'm clear now", a: "හොඳයි 😊 තවත් ප්රශ්න තියෙනවා නම් අහන්න." },
  { intent: 'GREETING', q: "Good night", a: "Good night 😊" },
  { intent: 'GREETING', q: "Hame", a: "හරි 😊" },
  { intent: 'GREETING', q: "Got it", a: "Ok 😊" },
  { intent: 'GREETING', q: "Appreciated", a: "ස්තුතියි 😊" },
  { intent: 'GREETING', q: "Can you talk?", a: "ඔව් 😊 message කරන්න." },
  { intent: 'GREETING', q: "Nice talking to you", a: "ස්තුතියි 😊" },
  { intent: 'GREETING', q: "Welcome", a: "😊" },
  { intent: 'GREETING', q: "Understood well", a: "හොඳයි 😊" },
  { intent: 'GREETING', q: "See you", a: "හරි 😊 පස්සේ හමුවෙමු." },
  { intent: 'GREETING', q: "Take care", a: "ඔයාටත් එසේම වේවා 😊" },
  { intent: 'GREETING', q: "Great service", a: "ස්තුතියි 😊" },
  { intent: 'GREETING', q: "Hi Sir", a: "මම Admin 😊 Sir ට message එකක් forward කරන්නම්." }
];

async function run() {
  await initDb();
  console.log('🚀 Starting bulk load of 125 conversational examples...');

  // Remove the DELETE line to preserve custom UI-added examples
  // await dbExec('DELETE FROM knowledge_examples WHERE tutor_id = 1');

  let successCount = 0;
  let skippedCount = 0;

  for (const ex of EXAMPLES) {
    try {
      // Check if this exact example already exists
      const existing = await dbGet(
        'SELECT id FROM knowledge_examples WHERE tutor_id = ? AND student_message = ? AND ideal_reply = ?',
        [1, ex.q, ex.a]
      );

      if (existing) {
        skippedCount++;
        continue;
      }

      await dbRun(
        'INSERT INTO knowledge_examples (tutor_id, intent, student_message, ideal_reply) VALUES (?, ?, ?, ?)',
        [1, ex.intent, ex.q, ex.a]
      );
      successCount++;
    } catch (e) {
      console.error(`❌ Failed to insert: ${ex.q}`, e.message);
    }
  }

  console.log(`✅ Finished! Added: ${successCount}, Skipped (duplicates): ${skippedCount}`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
