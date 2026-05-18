/**
 * Retrieval Service (RAG v2)
 * Implements a 4-layer knowledge architecture: Structured, FAQ, Style, and SOP.
 */

const { dbAll, dbGet, supabase } = require('../db/connection');

class RetrievalService {
  constructor() {
    this._tutorCache = new Map();
    this._cacheTTL = 300000; // 5 minutes
  }

  clearTutorCache(tutorId) {
    if (tutorId) {
      this._tutorCache.delete(tutorId);
    } else {
      this._tutorCache.clear();
    }
  }

  /**
   * Universal Vector Search with Category Filtering
   */
  async vectorSearch(queryOrEmbedding, category = null, tutorId = null, matchThreshold = 0.5, matchCount = 3) {
    try {
      let embedding;
      
      if (Array.isArray(queryOrEmbedding)) {
        // Use pre-calculated embedding
        embedding = queryOrEmbedding;
      } else {
        // Calculate new embedding
        const { getEmbedding } = require('./ai-utils');
        embedding = await getEmbedding(queryOrEmbedding);
      }

      if (!embedding) return [];

      const { data, error } = await supabase.rpc('match_knowledge_v2', {
        query_embedding: embedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
        filter_category: category,
        filter_tutor_id: tutorId
      });

      if (error) {
        console.error(`[Retrieval] Search error (${category}):`, error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.error('[Retrieval] Vector search exception:', e.message);
      return [];
    }
  }

  /**
   * Semantic Intent Matching
   */
  async matchIntent(queryOrEmbedding, tutorId = null, matchThreshold = 0.7) {
    try {
      let embedding;

      if (Array.isArray(queryOrEmbedding)) {
        embedding = queryOrEmbedding;
      } else {
        const { getEmbedding } = require('./ai-utils');
        embedding = await getEmbedding(queryOrEmbedding);
      }

      if (!embedding) return 'UNKNOWN';

      const { data, error } = await supabase.rpc('match_intents', {
        query_embedding: embedding,
        match_threshold: matchThreshold,
        match_count: 1,
        filter_tutor_id: tutorId
      });

      if (error || !data || data.length === 0) return 'UNKNOWN';
      return data[0].intent;
    } catch (e) {
      console.error('[Retrieval] Intent matching error:', e.message);
      return 'UNKNOWN';
    }
  }

  /**
   * Layer 1: Structured Data (Source of Truth)
   */
  async getTutorContext(tutorId) {
    const now = Date.now();
    const cached = this._tutorCache.get(tutorId);
    if (cached && (now - cached.timestamp < this._cacheTTL)) {
      return cached.data;
    }

    try {
      const [tutor, settings, classes] = await Promise.all([
        dbGet('SELECT * FROM tutors WHERE id = ?', [tutorId]),
        dbGet('SELECT * FROM settings WHERE tutor_id = ?', [tutorId]),
        dbAll('SELECT id, subject, grade, day_of_week, start_time, end_time, location, fee FROM classes WHERE tutor_id = ? AND is_active = 1', [tutorId])
      ]);

      const data = {
        tutor,
        settings,
        classes,
        classLines: classes.map(c => `- [ID: ${c.id}] ${c.grade} ${c.subject}: ${c.day_of_week} ${c.start_time} (${c.location}) - Monthly Fee: Rs.${c.fee || 0}`).join('\n'),
        feeLines: classes.map(c => `Grade ${c.grade} [ID: ${c.id}]: Rs.${c.fee || 0}`).join('\n')
      };

      this._tutorCache.set(tutorId, { data, timestamp: now });
      return data;
    } catch (e) {
      console.error('[Retrieval] Context error:', e.message);
      return cached ? cached.data : null;
    }
  }

  /**
   * Layer 2: FAQ RAG
   */
  async searchFAQs(queryOrEmbedding, tutorId = null) {
    return this.vectorSearch(queryOrEmbedding, 'FAQ', tutorId, 0.35, 3);
  }

  /**
   * Layer 3: Style Examples RAG
   */
  async searchStyleExamples(queryOrEmbedding, tutorId = null) {
    return this.vectorSearch(queryOrEmbedding, 'STYLE', tutorId, 0.3, 2);
  }

  /**
   * Layer 4: SOP Rules RAG
   */
  async searchSOPRules(queryOrEmbedding, tutorId = null) {
    return this.vectorSearch(queryOrEmbedding, 'SOP', tutorId, 0.3, 2);
  }

  /**
   * Student Context & Conversation State
   */
  async getStudentContext(chatId) {
    if (!chatId) return { state: 'NEW_LEAD', score: 'COLD', profile: 'Unknown Student', name: null, grade: null, school: null, phone: null };
    try {
      const variants = [chatId, chatId.replace('@c.us', '@lid'), chatId.replace('@lid', '@c.us')];
      const phoneOnly = chatId.split('@')[0].split(':')[0];
      let normalized;
      try {
        const normalizationService = require('./normalization');
        normalized = normalizationService.normalizePhone(phoneOnly);
      } catch (e) {
        normalized = phoneOnly;
      }

      const student = await dbGet(`
        SELECT * FROM students 
        WHERE whatsapp_id IN (?, ?, ?) 
        OR normalized_phone = ?
      `, [...variants, normalized]);
      
      if (!student) return { state: 'NEW_LEAD', score: 'COLD', profile: 'Unknown Student', name: null, grade: null, school: null, phone: null };

      const recentPayments = await dbAll('SELECT month, status FROM payments WHERE student_id = ? ORDER BY year DESC, month DESC LIMIT 2', [student.id]);
      const hasPendingPayment = recentPayments.some(p => p.status === 'unpaid' || p.status === 'pending');
      const payStatus = recentPayments.map(p => `${p.month}: ${p.status}`).join(', ');

      return {
        id: student.id,
        name: student.name || null,
        grade: student.grade || null,
        school: student.school || null,
        phone: student.phone || null,
        notes: student.notes || '',
        hasPendingPayment,
        state: student.conversation_state || 'NEW_LEAD',
        score: student.lead_score || 'WARM',
        missingFields: student.missing_fields || [],
        profile: `Name: ${student.name}, Grade: ${student.grade}, Status: ${student.status}, Notes: ${student.notes || 'None'}, History: ${payStatus || 'None'}`
      };
    } catch (e) {
      return { state: 'NEW_LEAD', score: 'COLD', profile: 'Unknown Student', name: null, grade: null, school: null, phone: null };
    }
  }

  async getRecentHistory(chatId, limit = 10) {
    try {
      const history = await dbAll(`
        SELECT direction, content 
        FROM message_logs 
        WHERE whatsapp_chat_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `, [chatId, limit]);
      return history.reverse();
    } catch (e) {
      return [];
    }
  }

  /**
   * Layer 5: Intent-Specific Few-Shot Examples (Local SQLite)
   * Retrieves relevant "style" examples based on the detected intent OR keyword matching.
   */
  async getIntentExamples(intent, query = '', limit = 3) {
    try {
      let examples = [];
      
      // 1. Try Supabase Knowledge Base (STYLE category) first
      const { data: styleEx } = await supabase
        .from('knowledge_base')
        .select('content')
        .eq('category', 'STYLE')
        .limit(limit);
      
      if (styleEx) {
        examples = styleEx.map(ex => {
          // Attempt to parse "Student: ... Admin: ..." format if it exists, 
          // otherwise just return the content as a single block
          return { student_message: 'Example', ideal_reply: ex.content };
        });
      }

      // 2. Try local SQLite intent match
      if (examples.length < limit && intent && intent !== 'OTHER' && intent !== 'UNKNOWN') {
        const localEx = await dbAll(
          'SELECT student_message, ideal_reply FROM knowledge_examples WHERE intent = ? ORDER BY RANDOM() LIMIT ?',
          [intent, limit - examples.length]
        );
        examples = [...examples, ...localEx];
      }

      // 3. Fallback or Supplement: Keyword search on messages
      if (examples.length < limit && query) {
        const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        if (words.length > 0) {
          let searchSql = 'SELECT student_message, ideal_reply FROM knowledge_examples WHERE ';
          const conditions = words.map(() => '(student_message ILIKE ? OR ideal_reply ILIKE ?)').join(' OR ');
          searchSql += conditions + ' ORDER BY RANDOM() LIMIT ?';
          
          const params = [];
          words.forEach(w => { params.push(`%${w}%`); params.push(`%${w}%`); });
          params.push(limit - examples.length);

          const extra = await dbAll(searchSql, params);
          examples = [...examples, ...extra];
        }
      }

      return examples.slice(0, limit);
    } catch (e) {
      console.error('[Retrieval] Example search error:', e.message);
      return [];
    }
  }
}

module.exports = new RetrievalService();
