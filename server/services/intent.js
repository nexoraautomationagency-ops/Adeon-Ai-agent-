/**
 * Intent Detection Module (v2)
 * Uses semantic similarity to identify student intent.
 */

const retrievalService = require('./retrieval');

class IntentService {
  async detect(text) {
    if (!text) return 'UNKNOWN';
    
    // First, try semantic matching against our examples database
    const semanticIntent = await retrievalService.matchIntent(text);
    if (semanticIntent !== 'UNKNOWN') return semanticIntent;

    // Fallback: Basic keyword matching for very simple cases (Hi, Thanks)
    const lower = text.toLowerCase();
    if (lower.includes('hi') || lower.includes('hello') || lower.includes('hay')) return 'GREETING';
    if (lower.includes('thanks') || lower.includes('sthuthi')) return 'THANKS';

    return 'GENERAL';
  }

  /**
   * Check if a message likely contains a payment slip/confirmation
   */
  async isPaymentConfirmation(text, messageType) {
    if (messageType === 'image') return true;
    const intent = await this.detect(text);
    return intent === 'PAYMENT_CONFIRMATION';
  }
}

module.exports = new IntentService();
