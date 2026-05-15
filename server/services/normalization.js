/**
 * Singlish Normalization Module
 * Handles preprocessing of common Singlish terms into English/Sinhala equivalents
 * to improve AI understanding.
 */

class NormalizationService {
  constructor() {
    this.map = {
      'clz': 'class',
      'clzs': 'classes',
      'thyenwada': 'thiyenawada',
      'thyenwa': 'thiyenawa',
      'koheda': 'where is',
      'khmda': 'kohomada',
      'mka': 'mokada',
      'nadda': 'nethda',
      'puluwanda': 'can you',
      'ewanna': 'send',
      'danna': 'put',
      'kiyanna': 'tell',
      'ganan': 'fees',
      'fee': 'fee',
      'kochchrda': 'kochchara da',
      'keeyada': 'how much',
      'koyeda': 'koheda',
      'kawada': 'when',
      'welawa': 'time',
      'eka': 'the',
      'ada': 'today',
      'heta': 'tomorrow',
      'enawa': 'coming',
      'awilla': 'came',
      'naha': 'not',
      'nehe': 'not',
      'bahe': 'cannot',
      'behe': 'cannot',
      'puluwan': 'can',
      'thnx': 'thanks',
      'ty': 'thank you',
      'gm': 'good morning',
      'gn': 'good night',
      'supiri': 'great',
      'machan': 'bro',
      'ado': 'friend',
      'oi': 'hey',
      'sir': 'sir',
      'teacher': 'teacher',
      'msg': 'message',
      'sirwa': 'sir',
      'keeyda': 'keeyada',
      'happly': 'apply',
      'paly': 'apply',
      'admit': 'register',
      'enrol': 'enroll',
      'pay': 'payment',
      'slip': 'receipt',
      'mke': 'meke',
      'puluwn': 'puluwan',
      'thynwda': 'thiyenawada',
      'hbly': 'hebei'
    };
  }

  /**
   * Normalize a text string by replacing common Singlish abbreviations
   */
  normalize(text) {
    if (!text) return '';
    let normalized = text.toLowerCase().trim();

    // Word by word replacement for precise matching
    const words = normalized.split(/\s+/);
    const result = words.map(word => {
      // Remove punctuation for matching
      const cleanWord = word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");
      if (this.map[cleanWord]) {
        return word.replace(cleanWord, this._isLikelySinhala(this.map[cleanWord]) ? this.map[cleanWord] : this.map[cleanWord]);
      }
      return word;
    });

    return result.join(' ');
  }

  /**
   * Normalize month names to Title Case (e.g., "January", "May")
   */
  normalizeMonth(month) {
    if (!month) return new Date().toLocaleString('en-US', { month: 'long' });
    
    // Remove year if present (e.g. "May 2024" -> "May")
    const cleanMonth = month.split(/\s+/)[0].trim();
    
    if (!cleanMonth) return new Date().toLocaleString('en-US', { month: 'long' });
    
    return cleanMonth.charAt(0).toUpperCase() + cleanMonth.slice(1).toLowerCase();
  }

  /**
   * Normalize grade to numeric string (e.g., "Grade 11" -> "11")
   */
  normalizeGrade(grade) {
    if (!grade) return '';
    return grade.toString().replace(/grade/gi, '').trim();
  }

  /**
   * Normalize phone number to local format (0777123456)
   */
  normalizePhone(phone) {
    if (!phone) return '';
    let c = phone.replace(/[^0-9]/g, '');
    
    // Normalize country code
    if (c.startsWith('94') && c.length === 11) c = '0' + c.substring(2);
    
    // Validate length - should be exactly 10 digits starting with 0
    if (c.length !== 10 || !c.startsWith('0')) {
      return null;
    }
    
    return c;
  }

  _isLikelySinhala(text) {
    // Basic check if it contains characters that usually map to Sinhala in our logic
    return /^[a-zA-Z]+$/.test(text) === false;
  }
}

module.exports = new NormalizationService();
