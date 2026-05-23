const { dbGet, dbAll, dbRun } = require('../db/connection');
const whatsappService = require('./whatsapp');

class CronService {
  constructor() {
    this.intervalId = null;
  }

  start() {
    // Run every hour to check for scheduled tasks
    this.intervalId = setInterval(() => this.runTasks(), 60 * 60 * 1000);
    // Also run once on startup (with a delay so DB/WhatsApp can init)
    setTimeout(() => this.runTasks(), 5 * 60 * 1000);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  async runTasks() {
    console.log('[Cron] Running scheduled tasks...');
    await this.processPaymentReminders();
  }

  _buildPaymentReminderText(studentName, month, amount, settings) {
    const bankName = settings?.bank_name?.trim() || '—';
    const accountName = settings?.bank_account_holder?.trim() || '—';
    const accountNumber = settings?.bank_account?.trim() || '—';
    const branch = settings?.bank_branch?.trim() || '—';
    const fee = parseFloat(amount) || 0;

    return `Hi ${studentName} 😊

${month} month class fee Rs.${fee} payment එක තවම receive වෙලා නැති නිසා මේ reminder message එක එවන්නේ.

කරුණාකර පහත bank account එකට payment එක කරලා, receipt photo එක මෙතනට එවන්න 👍

🏦 Bank: ${bankName}
👤 Account Name: ${accountName}
💳 Account Number: ${accountNumber}
📍 Branch: ${branch}

⚠️ Receipt එකේ ඔයාගේ Name, Grade සහ Phone Number එක ලියලා එවන්න.

ස්තූතියි 😊`;
  }

  async processPaymentReminders() {
    try {
      const now = new Date();
      const currentDay = now.getDate();
      const currentMonth = now.toLocaleString('en-US', { month: 'long' });
      const currentYear = now.getFullYear();

      // Get all tutors with payment reminders enabled for TODAY
      const todayStr = now.toISOString().split('T')[0];
      const settings = await dbAll('SELECT * FROM settings WHERE payment_reminder_enabled = 1 AND payment_reminder_day = ? AND (last_reminder_date IS NULL OR last_reminder_date != ?)', [currentDay, todayStr]);
      
      for (const setting of settings) {
        // Find unpaid students for this tutor for the current month
        const unpaidPayments = await dbAll(`
          SELECT p.*, s.phone, s.name, s.whatsapp_id 
          FROM payments p 
          JOIN students s ON s.id = p.student_id 
          WHERE p.tutor_id = ? AND p.month = ? AND p.year = ? AND p.status = 'unpaid' AND s.status = 'active'
        `, [setting.tutor_id, currentMonth, currentYear]);

        if (unpaidPayments.length > 0) {
          console.log(`[Cron] Sending ${unpaidPayments.length} payment reminders for tutor ${setting.tutor_id}`);

          for (const payment of unpaidPayments) {
            const chatId = payment.whatsapp_id || whatsappService._normalizePhone(payment.phone);
            if (!chatId) continue;
            try {
              const reminderText = this._buildPaymentReminderText(
                payment.name,
                currentMonth,
                payment.amount,
                setting
              );
              await whatsappService.sendMessage(chatId, reminderText, 1);
              await new Promise(r => setTimeout(r, 3000));
            } catch (err) {
              console.error(`[Cron] Failed to send reminder to ${chatId}:`, err.message);
            }
          }
        }

        // Mark as sent for today even if no payments were found (to avoid repeated checks)
        await dbRun('UPDATE settings SET last_reminder_date = ? WHERE id = ?', [todayStr, setting.id]);
      }
    } catch (error) {
      console.error('[Cron] Error processing payment reminders:', error.message);
    }
  }
}

module.exports = new CronService();
