const express = require('express');
const router = express.Router();
const { dbRun, dbAll, dbGet, supabase } = require('../db/connection');
const aiService = require('../services/ai');
const { developerOnly } = require('../middleware/auth');

/**
 * GET all knowledge facts
 */
router.get('/facts', async (req, res) => {
  if (req.tutor.role !== 'admin' && req.tutor.role !== 'developer') return res.status(403).json({ error: 'Forbidden' });
  try {
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('id, content, category, metadata')
      .order('id', { ascending: false });

    if (error) throw error;
    res.json({ facts: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * CLEAR facts by category (Bulk Delete)
 */
router.post('/facts/clear', async (req, res) => {
  if (req.tutor.role !== 'admin' && req.tutor.role !== 'developer') return res.status(403).json({ error: 'Forbidden' });
  const { category, subCategory } = req.body;
  if (!category) return res.status(400).json({ error: 'Category is required' });

  try {
    let query = supabase
      .from('knowledge_base')
      .delete()
      .eq('category', category.toUpperCase());
    
    if (subCategory) {
      query = query.eq('metadata->>sub_category', subCategory);
    }

    const { error } = await query;

    if (error) throw error;
    res.json({ success: true, message: `Knowledge cleared.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE a knowledge fact
 */
router.delete('/facts/:id', async (req, res) => {
  if (req.tutor.role !== 'admin' && req.tutor.role !== 'developer') return res.status(403).json({ error: 'Forbidden' });
  try {
    const { error } = await supabase
      .from('knowledge_base')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * ADD a manual fact
 */
router.post('/facts', async (req, res) => {
  if (req.tutor.role !== 'admin' && req.tutor.role !== 'developer') return res.status(403).json({ error: 'Forbidden' });
  const { content, category = 'FAQ', subCategory, topic } = req.body;
  try {
    const embedding = await aiService.getEmbedding(content);
    const { error } = await supabase
      .from('knowledge_base')
      .insert([{ 
        content, 
        category: category.toUpperCase(),
        embedding, 
        metadata: { 
          source: 'Manual Dashboard', 
          added_at: new Date().toISOString(),
          sub_category: subCategory,
          topic: topic
        } 
      }]);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET all training examples (Few-Shot)
 */
router.get('/examples', async (req, res) => {
  try {
    const examples = await dbAll('SELECT * FROM knowledge_examples ORDER BY id DESC');
    res.json({ examples });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * ADD a new training example (Manual Teaching)
 */
router.post('/teach', developerOnly, async (req, res) => {
  const { student_message, ideal_reply, intent } = req.body;
  const tutor_id = req.tutor.id;

  try {
    await dbRun(`
      INSERT INTO knowledge_examples (tutor_id, intent, student_message, ideal_reply)
      VALUES (?, ?, ?, ?)
    `, [tutor_id, intent || 'GENERAL', student_message, ideal_reply]);

    res.json({ success: true, message: 'AI has learned this example! ✅' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE a training example
 */
router.delete('/examples/:id', developerOnly, async (req, res) => {
  try {
    await dbRun('DELETE FROM knowledge_examples WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * EXPORT chat logs for fine-tuning (Downloadable File)
 */
router.get('/export', developerOnly, async (req, res) => {
  try {
    const logs = await dbAll(`
      SELECT whatsapp_chat_id, direction, content, created_at 
      FROM message_logs 
      WHERE tutor_id = ?
      ORDER BY whatsapp_chat_id, created_at ASC
    `, [req.tutor.id]);

    const conversations = {};
    logs.forEach(log => {
      if (!conversations[log.whatsapp_chat_id]) conversations[log.whatsapp_chat_id] = [];
      conversations[log.whatsapp_chat_id].push({
        role: log.direction === 'incoming' ? 'user' : 'assistant',
        content: log.content
      });
    });

    let jsonlContent = '';
    Object.values(conversations).forEach(conv => {
      if (conv.length >= 2) {
        jsonlContent += JSON.stringify({ messages: conv }) + '\n';
      }
    });

    const fileName = `chat_backup_${new Date().toISOString().split('T')[0]}.jsonl`;
    res.setHeader('Content-Type', 'application/jsonl');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(jsonlContent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
