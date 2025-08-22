/**
 * SafetyFilterService
 * Lightweight agricultural + generic content safety checks before final response display.
 * - Blocks or flags risky chemical recommendations, extreme dosages, unsafe storage/handling
 * - Generic harmful or self-harm content detection (basic regex)
 * - Returns action: allow | flag | block + applied rules
 */
import TelemetryService from './TelemetryService';

class SafetyFilterService {
  static RULE_VERSION = 1;

  static chemicalPatterns = [
    /(cyanide|strychnine|mercury|lead\s+acetate)/i,
    /(extremely\s+toxic|lethal\s+poison)/i
  ];

  static overdosePatterns = [
    /(\b\d{4,}\s*(kg|litre|liter|l|ml)\b)/i, // Only flag very large amounts (1000+ units)
    /(apply\s+.*every\s+few\s+minutes|hourly\s+application)/i
  ];

  static selfHarmPatterns = [
    /(suicide|kill\s+myself|end\s+my\s+life|self\s+harm)/i
  ];

  static bannedAdviceFragments = [
    'drink pesticide',
    'consume fertilizer',
    'ingest chemicals'
  ];

  static evaluate(text) {
    if (!text || typeof text !== 'string') return { action: 'allow', rules: [] };
    const rules = [];

    const matchAny = (arr, label) => {
      for (const p of arr) {
        if (p.test(text)) { rules.push(label); return true; }
      }
      return false;
    };

    matchAny(this.chemicalPatterns, 'chemicals');
    matchAny(this.overdosePatterns, 'overdose');
    matchAny(this.selfHarmPatterns, 'self_harm');
    for (const frag of this.bannedAdviceFragments) {
      if (text.toLowerCase().includes(frag)) rules.push('banned_phrase');
    }

    let action = 'allow';
    if (rules.includes('self_harm')) action = 'block';
    else if (rules.includes('chemicals') || rules.includes('overdose') || rules.includes('banned_phrase')) action = 'flag';

    if (action !== 'allow') {
      TelemetryService.error({ phase: 'safety', action, rules });
    }

    return { action, rules, version: this.RULE_VERSION };
  }

  static apply(text) {
    const result = this.evaluate(text);
    if (result.action === 'block') {
      return {
        safe: false,
        filteredText: 'Content withheld due to safety concerns. Please rephrase your request for safe agricultural guidance.',
        safety: result
      };
    }
    if (result.action === 'flag') {
      return {
        safe: true,
        filteredText: text + '',
        safety: result
      };
    }
    return { safe: true, filteredText: text, safety: result };
  }
}

export default SafetyFilterService;
