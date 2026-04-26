const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/connection');
const aiService = require('../services/ai');
const router = express.Router();

router.post('/generate', async (req, res, next) => {
  try {
    const { type, instruction, data } = req.body;
    if (!type && !instruction) return res.status(400).json({ error: 'type or instruction required' });
    let result;
    switch (type) {
      case 'announcement': result = await aiService.generateAnnouncement(data || instruction); break;
      case 'rephrase': result = await aiService.rephraseMessage(instruction); break;
      case 'payment_reminder': result = await aiService.generatePaymentReminder(data.student_name, data.amount, data.month); break;
      case 'summary': result = await aiService.summarizeData(data, instruction || 'general'); break;
      default: result = await aiService.generateCustomMessage(instruction);
    }
    res.json({ message: result.text, fromCache: result.fromCache, tokensUsed: result.tokens });
  } catch (err) { next(err); }
});

router.post('/rephrase', async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });
    const result = await aiService.rephraseMessage(message);
    res.json({ original: message, rephrased: result.text, fromCache: result.fromCache });
  } catch (err) { next(err); }
});

router.get('/templates', (req, res) => {
  const templates = dbAll('SELECT * FROM message_templates WHERE tutor_id = ? ORDER BY category, name', [req.tutor.id]);
  res.json({ templates });
});

router.post('/templates', (req, res) => {
  const { name, category, template, variables } = req.body;
  if (!name || !template) return res.status(400).json({ error: 'name and template required' });
  const result = dbRun('INSERT INTO message_templates (tutor_id,name,category,template,variables) VALUES (?,?,?,?,?)',
    [req.tutor.id, name, category||'general', template, JSON.stringify(variables||[])]);
  res.status(201).json({ template: dbGet('SELECT * FROM message_templates WHERE id=?', [result.lastInsertRowid]) });
});

router.post('/templates/:id/fill', (req, res) => {
  const tmpl = dbGet('SELECT * FROM message_templates WHERE id=? AND tutor_id=?', [req.params.id, req.tutor.id]);
  if (!tmpl) return res.status(404).json({ error: 'Template not found' });
  const filled = aiService.fillTemplate(tmpl.template, req.body.variables || {});
  res.json({ message: filled, template: tmpl.name });
});

module.exports = router;
