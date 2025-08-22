/**
 * TelemetryService
 * Lightweight structured event + metrics capture for AI interactions.
 * - In-memory ring buffer (bounded) + AsyncStorage persistence snapshot
 * - Pluggable sinks (console, remote endpoint placeholder)
 * - Event schema versioning
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

class TelemetryService {
  static VERSION = 1;
  static MEMORY_LIMIT = 400; // number of events kept in memory
  static PERSIST_KEY = 'telemetry_events_v1';
  static _buffer = [];
  static _initialized = false;
  static _flushScheduled = false;
  static _sinks = [];

  /** Initialize by loading persisted tail */
  static async init() {
    if (this._initialized) return;
    try {
      const raw = await AsyncStorage.getItem(this.PERSIST_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Keep only most recent within limit
          this._buffer = parsed.slice(-this.MEMORY_LIMIT);
        }
      }
    } catch (e) {
      console.warn('Telemetry init failed:', e.message);
    }
    this._initialized = true;
  }

  /** Add external sink function(event) */
  static registerSink(fn) {
    if (typeof fn === 'function') this._sinks.push(fn);
  }

  /** Core emit */
  static async emit(type, data = {}, opts = {}) {
    if (!this._initialized) await this.init();
    const evt = {
      v: this.VERSION,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2,8),
      ts: new Date().toISOString(),
      type,
      ...data
    };

    this._buffer.push(evt);
    if (this._buffer.length > this.MEMORY_LIMIT) this._buffer.shift();

    // Console sink (dev only)
    if (opts.console !== false) {
      // eslint-disable-next-line no-console
      console.log(`📡 [TELEMETRY] ${type}`, data.summary || '', { id: evt.id });
    }

    // Custom sinks
    for (const sink of this._sinks) {
      try { sink(evt); } catch (_) { /* ignore sink errors */ }
    }

    // Schedule async persistence (debounced)
    if (!this._flushScheduled) {
      this._flushScheduled = true;
      setTimeout(() => this._flush().catch(()=>{}), 1500);
    }
    return evt.id;
  }

  static async _flush() {
    this._flushScheduled = false;
    try {
      await AsyncStorage.setItem(this.PERSIST_KEY, JSON.stringify(this._buffer));
    } catch (e) {
      console.warn('Telemetry flush failed:', e.message);
    }
  }

  static getRecent(limit = 100) {
    return this._buffer.slice(-limit).reverse();
  }

  /** Convenience wrappers */
  static startRequest(context = {}) {
    return this.emit('ai.request.start', { summary: context.query?.slice(0,80), context });
  }
  static classify(summary) { return this.emit('ai.intent', summary); }
  static toolInvoke(data) { return this.emit('ai.tool.invoke', data); }
  static toolResult(data) { return this.emit('ai.tool.result', data); }
  static translation(data) { return this.emit('ai.translation', data); }
  static response(data) { return this.emit('ai.response.final', data); }
  static error(data) { return this.emit('ai.error', data, { console: true }); }
  static cache(data) { return this.emit('ai.cache', data, { console: false }); }
}

export default TelemetryService;
