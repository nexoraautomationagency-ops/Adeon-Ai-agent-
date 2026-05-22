const express = require('express');
const router = express.Router();
const { dbRun, dbAll, dbGet, supabase } = require('../db/connection');
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

    // 2. Automatically add to knowledge base (Supabase) for future smart RAG
    const log = await dbGet('SELECT content, detected_intent FROM message_logs WHERE id = ?', [message_log_id]);
    if (log && log.content) {
      const contentStr = `Student: ${log.content}\nAdmin: ${corrected_reply}`;
      const embedding = await aiService.getEmbedding(contentStr);

      await supabase.from('knowledge_base').insert([{
        content: contentStr,
        tutor_id,
        category: 'STYLE',
        embedding,
        metadata: {
          student_message: log.content,
          ideal_reply: corrected_reply,
          intent: log.detected_intent || 'GENERAL',
          source: 'AI Feedback Correction'
        }
      }]);
    }

    res.json({ success: true, message: 'Feedback stored and knowledge base updated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * FAQ Management
 * Reads/writes to knowledge_base (category='FAQ') so the AI can find them via vector search.
 */
router.get('/faqs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('id, content, metadata')
      .eq('tutor_id', req.tutor.id)
      .eq('category', 'FAQ')
      .order('id', { ascending: false });

    if (error) throw error;

    // Map to the same shape the dashboard expects
    const faqs = (data || []).map(row => ({
      id: row.id,
      question: row.metadata?.question || '',
      answer: row.metadata?.answer || row.content || '',
      keywords: row.metadata?.keywords || ''
    }));
    res.json({ faqs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/faqs', async (req, res) => {
  const { question, answer, keywords } = req.body;
  if (!question || !answer) {
    return res.status(400).json({ error: 'Question and answer are required' });
  }
  try {
    // Combine Q&A into a single text for embedding — this is what the AI will search against
    const content = `Q: ${question}\nA: ${answer}`;
    const embedding = await aiService.getEmbedding(content);

    const { error } = await supabase
      .from('knowledge_base')
      .insert([{
        content,
        tutor_id: req.tutor.id,
        category: 'FAQ',
        embedding,
        metadata: {
          question,
          answer,
          keywords: keywords || '',
          source: 'Dashboard FAQ',
          added_at: new Date().toISOString()
        }
      }]);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Knowledge Base Management
 */
router.get('/knowledge', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('id, content, metadata')
      .eq('tutor_id', req.tutor.id)
      .eq('category', 'STYLE')
      .order('id', { ascending: false });

    if (error) throw error;

    const examples = (data || []).map(row => ({
      id: row.id,
      student_message: row.metadata?.student_message || '',
      ideal_reply: row.metadata?.ideal_reply || '',
      intent: row.metadata?.intent || 'GENERAL'
    }));

    res.json({ examples });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
