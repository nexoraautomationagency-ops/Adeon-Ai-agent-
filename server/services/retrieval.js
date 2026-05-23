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
  async matchIntent(queryOrEmbedding, tutorId = null, matchThreshold = 0.50) {
    try {
      let embedding;

      if (Array.isArray(queryOrEmbedding)) {
        embedding = queryOrEmbedding;
      } else {
        const { getEmbedding } = require('./ai-utils');
        embedding = await getEmbedding(queryOrEmbedding);
      }

      if (!embedding) return 'UNKNOWN';

      let intentCountQuery = supabase.from('knowledge_base').select('*', { count: 'exact', head: true }).eq('category', 'INTENT');
      if (tutorId) intentCountQuery = intentCountQuery.eq('tutor_id', tutorId);
      const { count } = await intentCountQuery;
      if (!count || count === 0) return 'UNKNOWN';

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
        dbAll('SELECT id, name, subject, grade, day_of_week, start_time, end_time, location, fee FROM classes WHERE tutor_id = ? AND is_active = 1', [tutorId])
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
    return this.vectorSearch(queryOrEmbedding, 'FAQ', tutorId, 0.28, 3);
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
    return this.vectorSearch(queryOrEmbedding, 'SOP', tutorId, 0.45, 2);
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

      const recentPayments = await dbAll('SELECT month, status, receipt_url, year FROM payments WHERE student_id = ? ORDER BY year DESC, month DESC LIMIT 3', [student.id]);
      const hasPendingPayment = recentPayments.some(p => p.status === 'unpaid' || p.status === 'pending');
      const payStatus = recentPayments.map(p => `${p.month}: ${p.status}`).join(', ');

      const regMonth = student.pending_month || recentPayments[0]?.month || null;
      const regYear = new Date().getFullYear();
      const regPayment = regMonth
        ? recentPayments.find(p => String(p.month).toLowerCase() === String(regMonth).toLowerCase()) ||
          await dbGet('SELECT status, receipt_url, month FROM payments WHERE student_id = ? AND LOWER(month) = LOWER(?) AND year = ?', [student.id, regMonth, regYear])
        : null;

      // Fix 3: 48-Hour Context Trap Timeout
      let activeState = student.conversation_state || 'NEW_LEAD';
      if (activeState === 'COLLECTING_DETAILS' || student.status === 'lead') {
          const lastUpdated = new Date(student.updated_at || Date.now()).getTime();
          if (Date.now() - lastUpdated > 48 * 60 * 60 * 1000) {
              activeState = 'NEW_LEAD'; // Reset the lock so the AI can answer normal questions again
          }
      }

      return {
        id: student.id,
        name: student.name || null,
        grade: student.grade || null,
        school: student.school || null,
        phone: student.phone || null,
        address: student.address || null,
        pending_month: student.pending_month || null,
        notes: student.notes || '',
        studentStatus: student.status || 'lead',
        paymentStatus: regPayment?.status || null,
        paymentMonth: regMonth,
        receiptUploaded: !!(regPayment?.receipt_url),
        hasPendingPayment,
        state: activeState,
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
   * Layer 5: Intent-Specific Few-Shot Examples (Local SQLite + Supabase)
   * Retrieves relevant "style" examples based on vector search OR intent/keyword matching.
   */
  async getIntentExamples(intent, query = '', limit = 3, embedding = null, tutorId = null) {
    try {
      let examples = [];
      
      // 1. Try Vector Search on Supabase Knowledge Base (STYLE category) first
      if (embedding) {
        const styleResults = await this.vectorSearch(embedding, 'STYLE', tutorId, 0.3, limit);
        examples = styleResults.map(ex => ({
          student_message: 'Example',
          ideal_reply: ex.content
        }));
      } else {
        // Fallback: plain fetch if no embedding available
        let queryObj = supabase.from('knowledge_base').select('content').eq('category', 'STYLE');
        if (tutorId) queryObj = queryObj.eq('tutor_id', tutorId);
        const { data: styleEx } = await queryObj.limit(limit);
        
        if (styleEx) {
          examples = styleEx.map(ex => ({
            student_message: 'Example',
            ideal_reply: ex.content
          }));
        }
      }

      // 2. Keyword fallback on Supabase STYLE if vector search returned fewer than limit
      if (examples.length < limit && query) {
        const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        if (words.length > 0) {
          let queryObj = supabase.from('knowledge_base').select('content, metadata').eq('category', 'STYLE');
          if (tutorId) queryObj = queryObj.eq('tutor_id', tutorId);
          const { data: extra } = await queryObj.limit(limit - examples.length);
          if (extra) {
            const moreExamples = extra.map(ex => ({
              student_message: ex.metadata?.student_message || 'Example',
              ideal_reply: ex.metadata?.ideal_reply || ex.content
            }));
            examples = [...examples, ...moreExamples];
          }
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
