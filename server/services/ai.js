const OpenAI = require('openai');
const crypto = require('crypto');
const { dbGet, dbRun } = require('../db/connection');

class AIService {
  constructor() {
    this.client = null;
    this.model = 'gpt-4o-mini';
    this.maxTokens = 250;
    this.cacheExpiryHours = 24;
    this.mockMode = false;
  }

  _isMockMode() {
    return !process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith('sk-your');
  }

  _getClient() {
    if (this._isMockMode()) {
      this.mockMode = true;
      return null;
    }
    if (!this.client) {
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return this.client;
  }

  // --- Mock AI responses (FREE — no API needed) ---

  _mockGenerate(prompt, type) {
    const mockResponses = {
      announcement: '📢 Dear Students! 🎓\n\nImportant announcement:\n\n• Next class schedule eka check karanna 📅\n• Notes ganna enna! 📚\n• Any questions tiyanawa nam message karanna 😊\n\nThank you! 🙏',
      payment_reminder: (prompt) => {
        // Try to extract name and amount from prompt
        const nameMatch = prompt.match(/\"([^"]+)\"/);
        const amountMatch = prompt.match(/Rs\.(\d[\d,]*)/);
        const monthMatch = prompt.match(/Month:\s*(\w+)/);
        const name = nameMatch ? nameMatch[1] : 'Student';
        const amount = amountMatch ? amountMatch[1] : '3,000';
        const month = monthMatch ? monthMatch[1] : 'this month';
        return `Hi ${name} 👋\n\nAne 😊 ${month} month payment eka Rs.${amount} thamath pending. Possible nam meka week eke settle karanna please 🙏\n\nBank details:\n🏦 BOC / 12345678\n\nThank you! ❤️`;
      },
      message_rephrase: (prompt) => {
        // Extract the original message
        const msgMatch = prompt.match(/\"([^"]+)\"/);
        const original = msgMatch ? msgMatch[1] : prompt;
        return `${original} 😊👍\n\n(Ane mock mode eke run wenawa - real AI ekata OPENAI_API_KEY set karanna!)`;
      },
      summary: '📊 Summary:\n• Total students: 5\n• Active classes: 3\n• Payment collection: On track 👍\n\n(Mock mode - set OPENAI_API_KEY for real summaries)',
      general: '🤖 Ayubowan! 🙏\n\nMeka mock AI response ekak. Real AI ekata .env file eke OPENAI_API_KEY set karanna.\n\nFree alternatives:\n• Google Gemini API (free tier)\n• Groq (free tier)\n• Ollama (local, fully free)\n\nBut template system eka use karanna puluwan - meka fully free! 🎉'
    };

    const handler = mockResponses[type] || mockResponses.general;
    if (typeof handler === 'function') return handler(prompt);
    return handler;
  }

  _getSystemPrompt(type = 'general') {
    const base = `You are a friendly Sri Lankan class secretary assistant for a tuition teacher. You communicate in a natural Sinhala-English mix (Singlish) that feels human and warm. Use emojis naturally. Keep messages short and clear. Examples: "Ane 😊 payment eka update kala. Thank you!", "Tomorrow clz 4.30pm confirm 👍"`;
    const prompts = {
      general: base,
      announcement: `${base}\nWrite a class announcement. Clear, friendly, with bullet points if needed.`,
      payment_reminder: `${base}\nWrite a polite payment reminder. Never aggressive. Include amount and deadline.`,
      message_rephrase: `${base}\nRephrase the message in natural Sinhala-English style. Keep meaning exactly the same.`,
      summary: `${base}\nSummarize data concisely for the tutor. Use numbers and key points.`,
    };
    return prompts[type] || base;
  }

  _getCacheKey(prompt, type) { return crypto.createHash('md5').update(`${type}:${prompt}`).digest('hex'); }

  _getCachedResponse(hash) {
    try {
      const cached = dbGet("SELECT response_text FROM ai_cache WHERE prompt_hash=? AND expires_at > datetime('now')", [hash]);
      return cached?.response_text || null;
    } catch { return null; }
  }

  _setCachedResponse(hash, promptText, responseText, tokens) {
    try { dbRun("INSERT OR REPLACE INTO ai_cache (prompt_hash,prompt_text,response_text,model,tokens_used,expires_at) VALUES (?,?,?,?,?,datetime('now','+24 hours'))", [hash, promptText, responseText, this.model, tokens]); }
    catch (err) { console.error('[AI] Cache write error:', err.message); }
  }

  async _callAI(prompt, type = 'general', useCache = true) {
    const hash = this._getCacheKey(prompt, type);
    if (useCache) {
      const cached = this._getCachedResponse(hash);
      if (cached) { console.log('[AI] Cache hit'); return { text: cached, fromCache: true, tokens: 0 }; }
    }

    // MOCK MODE — Free testing without API key
    if (this._isMockMode()) {
      console.log('[AI] 🆓 Mock mode — no API key set');
      const text = this._mockGenerate(prompt, type);
      if (useCache && text) this._setCachedResponse(hash, prompt, text, 0);
      return { text, fromCache: false, tokens: 0, mock: true };
    }

    const client = this._getClient();
    try {
      const response = await client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this._getSystemPrompt(type) },
          { role: 'user', content: prompt }
        ],
        max_tokens: this.maxTokens,
        temperature: 0.7
      });
      const text = response.choices[0]?.message?.content?.trim() || '';
      const tokens = response.usage?.total_tokens || 0;
      if (useCache && text) this._setCachedResponse(hash, prompt, text, tokens);
      return { text, fromCache: false, tokens };
    } catch (err) {
      console.error('[AI] API error:', err.message);
      throw new Error('AI generation failed: ' + err.message);
    }
  }

  async generateAnnouncement(details) { return this._callAI(`Write an announcement:\n${JSON.stringify(details)}`, 'announcement'); }
  async rephraseMessage(msg) { return this._callAI(`Rephrase: "${msg}"`, 'message_rephrase'); }
  async generatePaymentReminder(name, amount, month) { return this._callAI(`Payment reminder for "${name}". Rs.${amount}. Month: ${month}.`, 'payment_reminder'); }
  async summarizeData(data, ctx) { return this._callAI(`Summarize ${ctx} data:\n${JSON.stringify(data)}`, 'summary', false); }
  async generateCustomMessage(instruction) { return this._callAI(instruction, 'general'); }

  fillTemplate(template, variables) {
    let filled = template;
    for (const [key, value] of Object.entries(variables)) {
      filled = filled.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return filled;
  }

  cleanCache() {
    try { dbRun("DELETE FROM ai_cache WHERE expires_at < datetime('now')"); console.log('[AI] Cache cleaned'); }
    catch (err) { console.error('[AI] Cache cleanup error:', err.message); }
  }
}

module.exports = new AIService();
