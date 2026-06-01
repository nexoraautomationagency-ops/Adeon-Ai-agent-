const aiService = require('d:/Adeon ai agent/server/services/ai');
const fs = require('fs');

const questions = [
  // Greetings / General
  "Hi",
  "Mage details monawada?",
  "Kohomada",
  "Sir innawada?",
  "English ok?",
  "Oya kauda?",
  "Class duration eka kochcharada?",
  "Class ekata join wenne kohomada?",
  "Admin ekkada katha karanne?",
  
  // Admission / Classes
  "Grade 10 class thiyenawada?",
  "Grade 6 science theory clz eka kiyatada?",
  "Science paper class thiyenawada?",
  "Mama Richmond college eke, grade 10, online clz join wenna puluwanda?",
  "Physical to online yanna puluwanda?",
  "Ayet details denna onada?",
  "Admission fee thiyenawada?",
  "Details sent",
  "My name is Kamal, I am in grade 11",
  "Class time eka kiyatada?",
  "Mage number eka 0771234567",
  
  // Payments
  "Payment how?",
  "Discount ekak denna puluwanda?",
  "Two months pay karannada?",
  "Payment verify karanna wela yanawada?",
  "Scholarship thiyenawada?",
  "How to send receipt?",
  "Can I pay by cash?",
  "Fees kochcharada grade 10 ekata?",
  "Mama salli damma, dan mokada karanne?",
  "Bank account details dennako",
  "Mama heta salli dannam",
  
  // Schedules / Classes
  "Is there a class today?",
  "Next class eka kiyatada?",
  "Link eka ewannako",
  "Ada class nadda?",
  "Recording eka ganna puluwanda?",
  "Class link eka wada na",
  "Sir ada clz eka thiyenawada?",
  "Tute eka labun na",
  
  // Issues / Changes
  "Mage school eka change una",
  "Change grade",
  "Address eka wenas karanna one",
  "Mama class eken ain wenawa",
  "Group eken left wela ayeth join wenne kohomada?",
  "Phone num eka change karanna one",
  
  // Complex / Edge Cases
  "Mata grade 9 and 10 dekama karanna one",
  "Malli grade 6, mama grade 11 clz thiyenawada?",
  "Mama last month salli dila na, me mase ekka danna puluwanda?",
  "Mata online be physical one",
  "Sirge personal number eka diyanko",
  "Zoom link eka password illanawa",
  "Sir mawa clz eken ain karalada?",
  "Class eka boring"
];

async function runTests() {
  const results = [];
  console.log(`Starting test for ${questions.length} questions...`);
  
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`Testing [${i+1}/${questions.length}]: ${q}`);
    
    // We use a dummy test ID
    const dummyId = `test_${Date.now()}_${i}@c.us`;
    
    try {
      // processMessage(chatId, text, tutorId = 2)
      // Assuming tutorId = 2 as per db dump
      const res = await aiService.processMessage(q, dummyId, 2);
      results.push({
        question: q,
        full_response: res
      });
      console.log(`  -> Reply: ${res?.reply || res?.text || JSON.stringify(res)}`);
    } catch (e) {
      console.log(`  -> Error: ${e.message}`);
      results.push({
        question: q,
        error: e.message
      });
    }
    
    // small delay to prevent rate limits
    await new Promise(r => setTimeout(r, 1000));
  }
  
  fs.writeFileSync('test-results.json', JSON.stringify(results, null, 2));
  console.log('Tests completed. Saved to test-results.json');
}

runTests();
