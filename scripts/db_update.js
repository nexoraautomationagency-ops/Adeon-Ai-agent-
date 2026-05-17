const db = require('./server/db/connection').getDb();

async function runUpdates() {
    try {
        console.log("Starting RAG and Intent Database Upgrades...");

        // ==========================================
        // 1. KNOWLEDGE BASE UPGRADES (FAQ & SOP)
        // ==========================================

        const kbUpdates = [
            {
                topic: "Tute Delivery Tracking",
                content: "Printed tutes වල home delivery එක payment එක verify වෙලා දවස් 3-5ක් ඇතුළත ලැබෙනවා 😊. Dispatch කරාම tracking details WhatsApp එකට එවන්නම්."
            },
            {
                topic: "Printed Tute Request",
                content: "Online students ලට සාමාන්‍යයෙන් PDFs එවන්නේ WhatsApp එකට 😊. Printed tutes විශේෂයෙන් ඕන නම් Sir ව direct contact කරලා අහන්න. Eligible students ලට payment එකෙන් පස්සේ gedaratama deliver කරනවා."
            },
            {
                topic: "Student Profile Update",
                content: "ඔයාගේ update වෙන්න ඕන අලුත් details ටික මෙතනට එවන්න 😊. මම system එකේ profile එක update කරන්නම්."
            },
            {
                topic: "Subject Information",
                content: "අපි කරන්නේ O/L Sinhala Medium Science 😊. Biology, Physics, Chemistry වගේම revision, model papers සහ past papers discussions ඔක්කොම cover කරනවා."
            },
            {
                topic: "Tutor Details",
                content: "Science classes කරන්නේ ගොඩක් experience තියෙන Sir කෙනෙක් 😊. O/L Science වලට 'A' result එකක් ගන්න අවශ්‍ය හොඳම මගපෙන්වීම මෙතනින් ලැබෙනවා."
            },
            {
                topic: "Requesting Recordings",
                content: "Zoom class එක miss වුණොත් official WhatsApp group එකට recording link එක දානවා 😊. ඒක දවස් 30ක් ඇතුළත බලන්න පුළුවන්."
            },
            {
                topic: "Refund Request",
                content: "Class fees refund කරන්නේ නැහැ 😊. Payment එක ගැන විශේෂ ප්‍රශ්නයක් තියෙනවා නම් Sir ට direct message එකක් දාලා අහන්න."
            },
            {
                topic: "WhatsApp Group Locked",
                content: "Spam messages නවත්තන්න තමයි group එක Admin Only කරලා තියෙන්නේ 😊. ප්‍රශ්නයක් තියෙනවා නම් මෙතනට message කරන්න නැත්නම් live class එකේදී අහන්න පුළුවන්."
            },
            {
                topic: "Discount Request",
                content: "Standard class fee එක හැමෝටම සමානයි 😊. විශේෂ සහනයක් ඕනේ නම් විතරක් Sir ට direct message එකක් දාලා අහන්න."
            },
            {
                topic: "Missing Materials",
                content: "PDFs සාමාන්‍යයෙන් class එකට පැයකට කලින් WhatsApp group එකට දානවා 😊. Group එකේ 'Media/Docs' section එකත් check කරන්න. Physical එන අයට entrance එකෙන් tutes දෙනවා."
            },
            {
                topic: "Class Schedule Inquiry",
                content: "Group එකේ pinned message එක check කරන්න 😊. විශේෂ වෙනසක් group එකේ දැම්මේ නැත්නම් හැමදාම තියෙන වෙලාවටම class එක තියෙනවා."
            },
            {
                topic: "Student Complaint",
                content: "අපි මේ ගැන check කරනවා 😊. ඉක්මනටම Admin කෙනෙක් ඔයාව contact කරයි."
            },
            {
                topic: "Student Support",
                content: "Subject එක ගැන ප්‍රශ්න තියෙනවා නම් මෙතනින් අහන්න පුළුවන් 😊. ඒවා Sir ට forward කරලා answer එක අරන් දෙන්නම්."
            }
        ];

        for (const update of kbUpdates) {
            await db.query(`UPDATE knowledge_base SET content = $1 WHERE metadata->>'topic' = $2`, [update.content, update.topic]);
            console.log(`Updated KB: ${update.topic}`);
        }

        // ==========================================
        // 2. KNOWLEDGE BASE DELETIONS
        // ==========================================
        
        const kbDeletions = [
            "Missed Class Recording", // Duplicate of Requesting Recordings
            "Contact & Admission",    // Redundant and hallucination risk
            "Payment Receipt Sent"    // Competes with prompt workflow
        ];

        for (const topic of kbDeletions) {
            await db.query(`DELETE FROM knowledge_base WHERE metadata->>'topic' = $1`, [topic]);
            console.log(`Deleted KB: ${topic}`);
        }

        // ==========================================
        // 3. MASTER STYLE UPGRADE
        // ==========================================

        const masterStyleContent = `*Class Details*
Grade 6-11 Students (Sinhala Medium)
📞 0771234567

*Monthly Class Fees*
Grade 6-9: Rs.1200/-
Grade 10 & 11: Rs.1500/-

*Bank Details*
Bank of Ceylon (BOC)
Account No: 1234567890
Name: adeon class
Branch: Colombo

*New students la registration complete කරලා payment කරන්න 😊*

*Payment Instructions*
📌 Bank slip එකේ Name, WhatsApp Number, Paid Month, Grade pen එකෙන් ලියලා එවන්න. 
📌 Online Pay කරනවා නම් Description එකට WhatsApp Number එක දාන්න.
📌 Tippex කරපු හෝ පැහැදිලි නැති receipts භාරගන්නේ නැහැ. වැරදුනොත් single line එකකින් කපලා ලියන්න.

Sampath Kumara
BSc.(Sp) University of Peradeniya`;

        await db.query(`UPDATE knowledge_base SET content = $1 WHERE metadata->>'topic' = 'Master Class Details'`, [masterStyleContent]);
        console.log(`Updated KB: Master Class Details`);

        // ==========================================
        // 4. INTENT EXAMPLES UPGRADES
        // ==========================================

        // a) Delete dead-end examples
        const deadEndMessages = ["Got it", "Hame", "Welcome", "Appreciated", "Nice talking to you"];
        for (const msg of deadEndMessages) {
            await db.query(`DELETE FROM knowledge_examples WHERE student_message = $1`, [msg]);
            console.log(`Deleted Dead-End Intent: ${msg}`);
        }

        // b) Remove exact duplicates in intent examples by keeping the MIN(id)
        const duplicateQuery = `
            DELETE FROM knowledge_examples 
            WHERE id IN (
                SELECT id 
                FROM (
                    SELECT id, ROW_NUMBER() OVER (PARTITION BY student_message ORDER BY id) as rnum 
                    FROM knowledge_examples
                ) t 
                WHERE t.rnum > 1
            );
        `;
        const dupRes = await db.query(duplicateQuery);
        console.log(`Deleted ${dupRes.rowCount} Duplicate Intents.`);

        // c) Update Hardcoded Workflow Intents
        const hardcodedIntents = [
            {
                msg: "May month join wenne",
                reply: "හරි 😊 Payment එක කරලා receipt එක එවන්න, මම group එකට add කරන්නම්."
            },
            {
                msg: "Can I join today?",
                reply: "ඔව් පුළුවන් 😊 Details එවලා payment එක කරන්න."
            },
            {
                msg: "How to join paper class?",
                reply: "මුලින්ම Grade එක කියන්න 😊"
            },
            {
                msg: "Join process?",
                reply: "මුලින්ම ඔයාගේ Grade එක කියන්න 😊"
            }
        ];

        for (const intent of hardcodedIntents) {
            await db.query(`UPDATE knowledge_examples SET ideal_reply = $1 WHERE student_message = $2`, [intent.reply, intent.msg]);
            console.log(`Updated Intent: ${intent.msg}`);
        }

        console.log("Database Upgrades Completed Successfully.");
        process.exit(0);

    } catch (e) {
        console.error("Error during execution:", e);
        process.exit(1);
    }
}

runUpdates();
