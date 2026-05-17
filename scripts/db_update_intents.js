const db = require('./server/db/connection').getDb();

async function runUpdates() {
    try {
        console.log("Starting Intent Database Upgrades...");

        // ==========================================
        // 1. DELETE DEAD-END INTENTS
        // ==========================================
        const deadEndMessages = [
            "Great service",
            "Take care",
            "See you",
            "Understood well",
            "Good night",
            "I'm clear now",
            "Thanks for help",
            "Wait a minute",
            "Ok understood",
            "Thanks",
            "Got it",
            "Hame",
            "Welcome"
        ];

        let deletedCount = 0;
        for (const msg of deadEndMessages) {
            const res = await db.query(`DELETE FROM knowledge_examples WHERE student_message = $1`, [msg]);
            deletedCount += res.rowCount;
        }
        console.log(`Deleted ${deletedCount} Dead-End Intents.`);

        // ==========================================
        // 2. DELETE 3RD PARTY DUPLICATES
        // ==========================================
        const duplicateMessages = [
            "Nangiwa add karanna puluwanda?",
            "Mata mage ayyawa add karanna one",
            "Mata mage yaluwekwa register karanna ona"
        ];

        let deletedDups = 0;
        for (const msg of duplicateMessages) {
            const res = await db.query(`DELETE FROM knowledge_examples WHERE student_message = $1`, [msg]);
            deletedDups += res.rowCount;
        }
        console.log(`Deleted ${deletedDups} 3rd-Party Registration Duplicates.`);

        // ==========================================
        // 3. UPGRADE INTENTS
        // ==========================================
        const intentUpgrades = [
            {
                msg: "Can I register my brother?",
                reply: "වෙන කෙනෙක්ව register කරනවා නම් එයාගේ WhatsApp number එකෙන්ම message එකක් දාන්න කියන්න 😊."
            },
            {
                msg: "Register wenna ona",
                reply: "හරි 😊 ඔයාගේ details ටික මට එවන්න, මම register කරගන්නම්."
            },
            {
                msg: "I am in Grade 11",
                reply: "හොඳයි 😊 අනිත් details ටිකත් එවන්න, මම system එකට add කරන්නම්."
            },
            {
                msg: "Grade 10",
                reply: "හොඳයි 😊 Register වෙන්න අනිත් විස්තර ටිකත් මට එවන්න."
            },
            {
                msg: "Join process?",
                reply: "Register වෙන්න ඔයාගේ details ටික මට එවන්න 😊"
            },
            {
                msg: "Amila Perera, Ananda College, 0771234567",
                reply: "ස්තුතියි Amila 😊 මම මේ විස්තර ටික check කරගන්නම්."
            },
            {
                msg: "May month join wenne",
                reply: "හරි 😊 Payment details මම උඩ දාලා තියෙනවා. Payment කරලා receipt එක එවන්න."
            },
            {
                msg: "Fee for Grade 10?",
                reply: "Class fees ගැන විස්තර මම උඩ message එකේ දාලා තියෙනවා 😊 ඒක check කරන්න."
            },
            {
                msg: "Bank info please",
                reply: "Bank details ටික මම උඩ message එකේ දාලා තියෙනවා 😊 ඒකට payment එක කරලා receipt එක එවන්න."
            }
        ];

        for (const update of intentUpgrades) {
            await db.query(`UPDATE knowledge_examples SET ideal_reply = $1 WHERE student_message = $2`, [update.reply, update.msg]);
            console.log(`Updated Intent: ${update.msg}`);
        }

        console.log("Intent Database Upgrades Completed Successfully.");
        process.exit(0);

    } catch (e) {
        console.error("Error during execution:", e);
        process.exit(1);
    }
}

runUpdates();
