const express = require('express');
const router = express.Router();
const { dbRun, dbAll, dbGet } = require('../db/connection');
const aiService = require('../services/ai');

/**
 * Save AI Feedback (Correction)
 * When a tutor edits an AI response in the dashboard
 */
router.post('/feedback', async (req, res) => {
  const { message_log_id, original_ai_reply, corrected_reply, correction_type } = req.body;
  const tutor_id = req.tutor.id;

  try {
    // 1. Store feedback
    await dbRun(`
      INSERT INTO ai_feedback (message_log_id, original_ai_reply, corrected_reply, correction_type, tutor_id)
      VALUES (?, ?, ?, ?, ?)
    `, [message_log_id, original_ai_reply, corrected_reply, correction_type, tutor_id]);

    // 2. Automatically add to knowledge examples for future RAG
    const log = await dbGet('SELECT content, detected_intent FROM message_logs WHERE id = ?', [message_log_id]);
    if (log && log.detected_intent) {
      await dbRun(`
        INSERT INTO knowledge_examples (tutor_id, intent, student_message, ideal_reply)
        VALUES (?, ?, ?, ?)
      `, [tutor_id, log.detected_intent, log.content, corrected_reply]);
    }

    res.json({ success: true, message: 'Feedback stored and knowledge base updated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * FAQ Management
 */
router.get('/faqs', async (req, res) => {
  const faqs = await dbAll('SELECT * FROM faqs WHERE tutor_id = ? ORDER BY created_at DESC', [req.tutor.id]);
  res.json({ faqs });
});

router.post('/faqs', async (req, res) => {
  const { question, answer, keywords } = req.body;
  try {
    await dbRun(`
      INSERT INTO faqs (tutor_id, question, answer, keywords)
      VALUES (?, ?, ?, ?)
    `, [req.tutor.id, question, answer, keywords]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Knowledge Base Management
 */
router.get('/knowledge', async (req, res) => {
  const examples = await dbAll('SELECT * FROM knowledge_examples WHERE tutor_id = ? ORDER BY created_at DESC', [req.tutor.id]);
  res.json({ examples });
});

/**
 * Generate AI Message
 */
router.post('/generate', async (req, res) => {
  try {
    const { prompt, context } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const result = await aiService.generateCustomMessage(prompt, null, req.tutor.id);
    res.json({ 
      success: true, 
      response: result.text,
      intent: result.intent,
      fromCache: result.fromCache,
      tokens: result.tokens
    });
  } catch (err) {
    console.error('[AI Route] Generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Rephrase AI Message
 */
router.post('/rephrase', async (req, res) => {
  try {
    const { message, tone } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const instruction = `Rephrase this message with ${tone || 'friendly'} tone: ${message}`;
    const result = await aiService.generateCustomMessage(instruction, null, req.tutor.id);
    
    res.json({ 
      success: true, 
      rephrased: result.text,
      fromCache: result.fromCache,
      tokens: result.tokens
    });
  } catch (err) {
    console.error('[AI Route] Rephrase error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
