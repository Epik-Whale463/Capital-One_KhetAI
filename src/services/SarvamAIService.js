import EnvironmentConfig from '../config/environment.js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class SarvamAIService {
    // In-memory translation cache (hashKey -> { text, source, target, ts })
    static _translationMemory = new Map();
    static _translationOrder = []; // maintain insertion order for simple LRU trimming
    static MAX_CACHE_ITEMS = 300;

    // Create deterministic short hash for caching (djb2)
    static _hash(str) {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
            // Convert to 32bit int
            hash = hash & 0xFFFFFFFF;
        }
        return (hash >>> 0).toString(36); // unsigned & base36 for compactness
    }

    static _makeCacheKey(text, source, target) {
        const trimmed = (text || '').trim();
        // For very long texts, hash only first + last 500 chars to keep key stable & short
        let basis = trimmed.length > 1200 ? (trimmed.slice(0,600) + '§' + trimmed.slice(-600)) : trimmed;
        return `tx_${target}_${source}_${this._hash(basis)}`;
    }

    static _addToMemoryCache(key, valueObj) {
        if (!this._translationMemory.has(key)) {
            this._translationOrder.push(key);
        }
        this._translationMemory.set(key, valueObj);
        // Simple LRU-like trim (remove oldest when exceeding)
        while (this._translationOrder.length > this.MAX_CACHE_ITEMS) {
            const oldest = this._translationOrder.shift();
            this._translationMemory.delete(oldest);
        }
    }

    static async _getCachedTranslation(text, source, target) {
        try {
            const key = this._makeCacheKey(text, source, target);
            if (this._translationMemory.has(key)) {
                return { key, cached: this._translationMemory.get(key) };
            }
            const stored = await AsyncStorage.getItem(key);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && parsed.text) {
                    this._addToMemoryCache(key, parsed);
                    return { key, cached: parsed };
                }
            }
            return { key, cached: null };
        } catch (e) {
            console.warn('Translation cache read failed:', e.message);
            return { key: null, cached: null };
        }
    }

    static async _storeCachedTranslation(key, obj) {
        try {
            this._addToMemoryCache(key, obj);
            // Fire & forget async store (no await needed but keep for ordering)
            await AsyncStorage.setItem(key, JSON.stringify(obj));
        } catch (e) {
            console.warn('Translation cache write failed:', e.message);
        }
    }
    // Normalize various language identifiers to Sarvam expected codes
    static LANGUAGE_ALIASES = {
        'english': 'en-IN', 'en': 'en-IN', 'en-IN': 'en-IN', 'eng': 'en-IN',
        'hindi': 'hi-IN', 'hi': 'hi-IN', 'hi-IN': 'hi-IN',
        'telugu': 'te-IN', 'te': 'te-IN', 'te-IN': 'te-IN'
    };

    static normalizeLanguageCode(lang) {
        if (!lang) return 'en-IN';
        const lower = String(lang).toLowerCase();
        return this.LANGUAGE_ALIASES[lower] || lang; // if already hi-IN/te-IN return as-is
    }

    static API_BASE_URL = 'https://api.sarvam.ai';
    
    static getApiKey() {
        return EnvironmentConfig.getSarvamApiKey() || 
               EnvironmentConfig.getApiKeysFromMemory().sarvam ||
               'sk_eiva2gau_o1ieX3tQ2xEmSWj6H3gfnXvd'; // Fallback
    }

    // Debug mode for logging
    static DEBUG = true;

    // Clean LLM response by removing thinking tags
    static cleanLLMResponse(response) {
        if (!response) return '';

        // Remove <think>...</think> blocks
        let cleaned = response.replace(/<think>[\s\S]*?<\/think>/gi, '');

        // Remove any remaining opening or closing think tags
        cleaned = cleaned.replace(/<\/?think>/gi, '');

        // Clean up extra whitespace and newlines
        cleaned = cleaned.trim().replace(/\n\s*\n/g, '\n\n');

        return cleaned;
    }

    // Smart text truncation for TTS (preserves sentence structure)
    static truncateForTTS(text, maxLength = 500) {
        if (text.length <= maxLength) return text;

        // Try to cut at sentence boundary
        const sentences = text.split(/[.!?]+/);
        let result = '';

        for (const sentence of sentences) {
            const nextResult = result + sentence + '.';
            if (nextResult.length > maxLength - 3) break;
            result = nextResult;
        }

        // If no complete sentence fits, just truncate
        if (result.length === 0) {
            result = text.substring(0, maxLength - 3);
        }

        return result.trim() + '...';
    }

    // Validate speaker compatibility with model
    static getValidSpeaker(language, preferredSpeaker = 'meera') {
        const availableSpeakers = this.VOICE_SPEAKERS[language] || this.VOICE_SPEAKERS['en-IN'];
        
        // Return preferred speaker if valid, otherwise return first available
        return availableSpeakers.includes(preferredSpeaker) 
            ? preferredSpeaker 
            : availableSpeakers[0];
    }

    // Language codes mapping
    static LANGUAGES = {
        english: 'en-IN',
        hindi: 'hi-IN',
        telugu: 'te-IN'
    };

    static VOICE_SPEAKERS = {
        'en-IN': ['meera', 'pavithra', 'maitreyi', 'amol', 'amartya', 'arvind', 'maya', 'arjun', 'diya', 'neel', 'misha', 'vian'],
        'hi-IN': ['meera', 'pavithra', 'maitreyi', 'amol', 'amartya', 'arvind', 'maya', 'arjun', 'diya', 'neel', 'misha', 'vian'],
        'te-IN': ['meera', 'pavithra', 'maitreyi', 'amol', 'amartya', 'arvind', 'maya', 'arjun', 'diya', 'neel', 'misha', 'vian']
    };

    // Text-to-Speech
    static async textToSpeech(text, language = 'en-IN', speaker = 'meera') {
        try {
            // Normalize language code
            const langCode = this.normalizeLanguageCode(language);

            // Clean the text before sending to TTS
            let cleanedText = this.cleanLLMResponse(text);

            // Smart truncation to 500 characters max for TTS API limit
            cleanedText = this.truncateForTTS(cleanedText, 500);
            
            // Validate and get compatible speaker
            const validSpeaker = this.getValidSpeaker(language, speaker);

            if (this.DEBUG) {
                console.log('TTS Request:', {
                    text: cleanedText.substring(0, 100),
                    length: cleanedText.length,
                    language,
                    requestedSpeaker: speaker,
                    validSpeaker: validSpeaker
                });
            }

            const requestBody = {
                inputs: [cleanedText],
                target_language_code: langCode,
                speaker: validSpeaker, // Use validated speaker
                pitch: 0,
                pace: 1.2,
                loudness: 1.5,
                speech_sample_rate: 16000,
                enable_preprocessing: true,
                model: 'bulbul:v1'
            };

            const response = await fetch(`${this.API_BASE_URL}/text-to-speech`, {
                method: 'POST',
                headers: {
                    'api-subscription-key': this.getApiKey(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('TTS API error response:', errorText);
                
                // Handle specific Sarvam AI error codes
                if (response.status === 400) {
                    if (errorText.includes('500 characters')) {
                        throw new Error('Text too long. Maximum 500 characters allowed.');
                    } else if (errorText.includes('Speaker')) {
                        throw new Error('Invalid speaker for this model. Please try again.');
                    } else {
                        throw new Error('Invalid text or parameters. Please try again.');
                    }
                } else if (response.status === 401) {
                    throw new Error('Authentication failed. Please check API key.');
                } else if (response.status >= 500) {
                    throw new Error('Server error. Please try again later.');
                } else {
                    throw new Error(`TTS API error: ${response.status} - ${errorText}`);
                }
            }

            const audioBlob = await response.blob();
            if (this.DEBUG) console.log('TTS raw response ok, blob size:', audioBlob.size);

            return {
                success: true,
                audioBlob: audioBlob
                // Don't create URL here - will be handled in React Native component
            };
        } catch (error) {
            console.error('Text-to-Speech error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Speech-to-Text
    static async speechToText(audioBlob, language = 'unknown') {
        try {
            // Normalize language code if provided
            const langCode = language && language !== 'unknown' ? this.normalizeLanguageCode(language) : 'unknown';

            if (!audioBlob || audioBlob.size === 0) {
                throw new Error('Invalid audio data');
            }

            // Check file size limit (5MB max as per Sarvam AI docs)
            const maxSizeBytes = 5 * 1024 * 1024; // 5MB
            if (audioBlob.size > maxSizeBytes) {
                throw new Error('Audio file too large. Maximum size is 5MB.');
            }

            if (this.DEBUG) {
                console.log('STT Request:', {
                    audioSize: audioBlob.size,
                    audioType: audioBlob.type,
                    language: langCode,
                    apiUrl: `${this.API_BASE_URL}/speech-to-text`,
                    hasApiKey: !!this.getApiKey()
                });
            }

            // Create proper FormData for file upload
            const formData = new FormData();
            
            // Ensure proper file format for Sarvam AI
            const audioFile = new File([audioBlob], 'audio.wav', {
                type: 'audio/wav'
            });
            
            formData.append('file', audioFile);
            formData.append('model', 'saarika:v2');
            
            // Only add language_code if not auto-detect
            if (langCode !== 'unknown') {
                formData.append('language_code', langCode);
            }

            console.log('Making STT request to:', `${this.API_BASE_URL}/speech-to-text`);
            console.log('FormData entries:', Array.from(formData.entries()));

            const response = await fetch(`${this.API_BASE_URL}/speech-to-text`, {
                method: 'POST',
                headers: {
                    'api-subscription-key': this.getApiKey(),
                    // Don't set Content-Type for FormData - let browser set it with boundary
                },
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('STT API error response:', errorText);
                
                // Handle specific Sarvam AI error codes
                if (response.status === 400) {
                    throw new Error('Invalid audio format or parameters. Please try again.');
                } else if (response.status === 401) {
                    throw new Error('Authentication failed. Please check API key.');
                } else if (response.status >= 500) {
                    throw new Error('Server error. Please try again later.');
                } else {
                    throw new Error(`STT API error: ${response.status} - ${errorText}`);
                }
            }

            const result = await response.json();
            return {
                success: true,
                transcript: result.transcript,
                language: result.language_code,
                raw: this.DEBUG ? result : undefined
            };
        } catch (error) {
            console.error('Speech-to-Text error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // LLM Chat Completion
    static async chatCompletion(messages, language = 'en-IN') {
        try {
            // Add system prompt for farming context
            const systemPrompt = this.getFarmingSystemPrompt(language);
            const fullMessages = [
                { role: 'system', content: systemPrompt },
                ...messages
            ];

            if (this.DEBUG) {
                console.log('LLM Request:', {
                    messageCount: fullMessages.length,
                    userMessage: messages[0]?.content?.substring(0, 100),
                    language
                });
            }

            const requestBody = {
                model: 'sarvam-m',
                messages: fullMessages,
                reasoning_effort: 'low',
                max_completion_tokens: 2048,
                temperature: 0.7
            };

            const response = await fetch(`${this.API_BASE_URL}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.getApiKey()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('LLM API error response:', errorText);
                throw new Error(`LLM API error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();

            // Clean the response by removing <think> tags and content
            let cleanedResponse = result.choices[0].message.content;
            cleanedResponse = this.cleanLLMResponse(cleanedResponse);

            if (this.DEBUG) {
                console.log('LLM Success: Response length:', cleanedResponse.length);
            }

            return {
                success: true,
                response: cleanedResponse,
                usage: result.usage
            };
        } catch (error) {
            console.error('LLM Chat error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Format-aware text translation that preserves structure
    static async translateTextWithFormatting(text, fromLang = 'auto', toLang = 'hi-IN') {
        try {
            // Input validation
            if (!text || typeof text !== 'string') {
                return {
                    success: true,
                    translatedText: text || '',
                    sourceLanguage: fromLang
                };
            }

            const target = this.normalizeLanguageCode(toLang);
            const source = fromLang === 'auto' ? 'auto' : this.normalizeLanguageCode(fromLang);

            // If source and target are the same, return original text
            if (source === target && source !== 'auto') {
                return {
                    success: true,
                    translatedText: text,
                    sourceLanguage: source
                };
            }

            console.log('🔄 Format-aware translation:', { fromLang: source, toLang: target, textLength: text.length });

            // Step 1: Extract and preserve formatting
            const formattingInfo = this.extractFormatting(text);
            
            // Step 2: Translate content while preserving structure
            const translatedText = await this.translateWithStructurePreservation(
                formattingInfo.segments, 
                source, 
                target
            );
            
            // Step 3: Reconstruct formatted text
            const finalText = this.reconstructFormatting(translatedText, formattingInfo.structure);

            return {
                success: true,
                translatedText: finalText,
                sourceLanguage: source,
                preservedFormatting: true
            };

        } catch (error) {
            console.error('Format-aware translation error:', error);
            // Fallback to regular translation
            return await this.translateText(text, fromLang, toLang);
        }
    }

    // Extract formatting structure from text
    static extractFormatting(text) {
        const segments = [];
        const structure = [];
        
        // Split by lines to preserve line breaks
        const lines = text.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.trim() === '') {
                // Empty line
                structure.push({ type: 'empty_line', index: segments.length });
                continue;
            }
            
            // Check for numbered lists (1. 2. 3.)
            const numberedMatch = line.match(/^(\s*)(\d+)\.\s*(.+)$/);
            if (numberedMatch) {
                structure.push({ 
                    type: 'numbered_list', 
                    index: segments.length,
                    indent: numberedMatch[1],
                    number: numberedMatch[2]
                });
                segments.push(numberedMatch[3].trim());
                continue;
            }
            
            // Check for bullet points (• - *)
            const bulletMatch = line.match(/^(\s*)[•\-\*]\s*(.+)$/);
            if (bulletMatch) {
                structure.push({ 
                    type: 'bullet_point', 
                    index: segments.length,
                    indent: bulletMatch[1]
                });
                segments.push(bulletMatch[2].trim());
                continue;
            }
            
            // Check for headers (text followed by colon)
            const headerMatch = line.match(/^(.+):(\s*)$/);
            if (headerMatch) {
                structure.push({ 
                    type: 'header', 
                    index: segments.length,
                    spacing: headerMatch[2]
                });
                segments.push(headerMatch[1].trim());
                continue;
            }
            
            // Regular text line
            structure.push({ 
                type: 'text', 
                index: segments.length 
            });
            segments.push(line.trim());
        }
        
        return { segments, structure };
    }

    // Translate segments while preserving structure
    static async translateWithStructurePreservation(segments, source, target) {
        const translatedSegments = [];
        
        // Translate in batches to avoid API limits
        const batchSize = 5;
        for (let i = 0; i < segments.length; i += batchSize) {
            const batch = segments.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(segment => this.translateText(segment, source, target, true)) // Skip chunking for segments
            );
            
            for (const result of batchResults) {
                if (result.success) {
                    translatedSegments.push(result.translatedText);
                } else {
                    translatedSegments.push(batch[translatedSegments.length % batch.length]); // Fallback to original
                }
            }
        }
        
        return translatedSegments;
    }

    // Reconstruct formatted text from translated segments
    static reconstructFormatting(translatedSegments, structure) {
        const lines = [];
        
        for (const item of structure) {
            switch (item.type) {
                case 'empty_line':
                    lines.push('');
                    break;
                    
                case 'numbered_list':
                    const numberedText = translatedSegments[item.index] || '';
                    lines.push(`${item.indent}${item.number}. ${numberedText}`);
                    break;
                    
                case 'bullet_point':
                    const bulletText = translatedSegments[item.index] || '';
                    lines.push(`${item.indent}• ${bulletText}`);
                    break;
                    
                case 'header':
                    const headerText = translatedSegments[item.index] || '';
                    lines.push(`${headerText}:${item.spacing || ''}`);
                    break;
                    
                case 'text':
                    lines.push(translatedSegments[item.index] || '');
                    break;
            }
        }
        
        return lines.join('\n');
    }

    // Text Translation with normalization, retry and better logging
    static async translateText(text, fromLang = 'auto', toLang = 'hi-IN', _skipChunking = false) {
        try {
            // Input validation
            if (!text || typeof text !== 'string') {
                return {
                    success: true,
                    translatedText: text || '',
                    sourceLanguage: fromLang
                };
            }

            const target = this.normalizeLanguageCode(toLang);
            const source = fromLang === 'auto' ? 'auto' : this.normalizeLanguageCode(fromLang);

            // If source and target are the same, return original text
            if (source === target && source !== 'auto') {
                return {
                    success: true,
                    translatedText: text,
                    sourceLanguage: source
                };
            }

            // Attempt cache retrieval (key based on original request params)
            const { key: cacheKey, cached } = await this._getCachedTranslation(text, source, target);
            if (cached) {
                if (this.DEBUG) console.log('🗃️ Translation cache hit:', cacheKey);
                return {
                    success: true,
                    translatedText: cached.text,
                    sourceLanguage: cached.source || source,
                    mode: cached.mode || 'cache',
                    cached: true
                };
            } else if (this.DEBUG) {
                console.log('🗃️ Translation cache miss:', cacheKey);
            }

            if (this.DEBUG) {
                console.log('Translation Request:', {
                    text: text.substring(0, 200),
                    fromLang: source,
                    toLang: target
                });
            }

            // Clean text before translation
            const cleanText = text.trim();
            if (!cleanText) {
                return {
                    success: true,
                    translatedText: '',
                    sourceLanguage: source
                };
            }

            // Check character limit for Sarvam API (1000 chars max) - only if chunking not disabled
            if (!_skipChunking && cleanText.length > 1000) {
                console.warn(`Translation text too long (${cleanText.length} chars), chunking...`);
                return await this.translateTextWithFormatting(cleanText, source, target);
            }

            // If text is still too long and chunking is disabled, truncate it
            const finalText = cleanText.length > 1000 ? cleanText.substring(0, 950) + '...' : cleanText;

            // Fallback modes to try in order
            const fallbackModes = ['formal', 'modern-colloquial', 'classic-colloquial'];
            
            // Simple retry strategy with mode fallback
            let attempt = 0;
            let lastError = null;

            while (attempt < fallbackModes.length) {
                const currentMode = fallbackModes[attempt];
                attempt++;
                
                try {
                    const requestBody = {
                        input: finalText,
                        source_language_code: source,
                        target_language_code: target,
                        model: 'mayura:v1'
                    };

                    // Only add mode for non-English targets (some API versions don't accept it for English)
                    if (target !== 'en-IN') {
                        requestBody.mode = currentMode;
                    }

                    if (this.DEBUG) {
                        console.log(`Translation attempt ${attempt} with mode: ${currentMode}`, {
                            source,
                            target,
                            textLength: finalText.length
                        });
                    }

                    const response = await fetch(`${this.API_BASE_URL}/translate`, {
                        method: 'POST',
                        headers: {
                            'api-subscription-key': this.getApiKey(),
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(requestBody)
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`Translation API error (attempt ${attempt}):`, errorText);
                        
                        // Handle character limit error specifically
                        if (errorText.includes('exceed 1000 characters') || errorText.includes('Input text must not exceed')) {
                            console.warn('Character limit exceeded, trying chunked translation...');
                            return await this.translateTextWithFormatting(cleanText, source, target);
                        }
                        
                        // If it's a mode error and we have more modes to try, continue
                        if (errorText.includes('body.mode') && attempt < fallbackModes.length) {
                            console.warn(`Mode '${currentMode}' rejected, trying next mode...`);
                            continue;
                        }
                        
                        throw new Error(`Translation API error: ${response.status} - ${errorText}`);
                    }

                    const result = await response.json();

                    if (this.DEBUG) {
                        console.log(`Translation Success with mode '${currentMode}':`, result.translated_text?.substring(0, 200));
                    }

                    // Store in cache
                    if (cacheKey && result.translated_text) {
                        this._storeCachedTranslation(cacheKey, {
                            text: result.translated_text,
                            source: result.source_language_code,
                            target,
                            mode: currentMode,
                            ts: Date.now()
                        });
                    }

                    return {
                        success: true,
                        translatedText: result.translated_text,
                        sourceLanguage: result.source_language_code,
                        mode: currentMode,
                        raw: this.DEBUG ? result : undefined
                    };
                } catch (err) {
                    lastError = err;
                    console.warn(`Translation attempt ${attempt} with mode '${currentMode}' failed:`, err.message);
                    
                    // If it's not a mode error, don't try other modes
                    if (!err.message.includes('body.mode')) {
                        break;
                    }
                }
            }

            // All modes failed, try one final attempt without mode parameter
            console.warn('All translation modes failed, trying without mode parameter...');
            try {
                const basicRequestBody = {
                    input: finalText,
                    source_language_code: source,
                    target_language_code: target,
                    model: 'mayura:v1'
                };

                const response = await fetch(`${this.API_BASE_URL}/translate`, {
                    method: 'POST',
                    headers: {
                        'api-subscription-key': this.getApiKey(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(basicRequestBody)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Final translation attempt error:', errorText);
                    
                    // Handle character limit - should not happen now with finalText truncation
                    if (errorText.includes('exceed 1000 characters') || errorText.includes('Input text must not exceed')) {
                        console.warn('Character limit in final attempt despite truncation, falling back to original text');
                        return {
                            success: false,
                            error: 'Text too long for translation',
                            translatedText: text,
                            sourceLanguage: fromLang
                        };
                    }
                    
                    throw new Error(`Translation API error: ${response.status} - ${errorText}`);
                }

                const result = await response.json();

                if (this.DEBUG) {
                    console.log('Translation Success (no mode):', result.translated_text?.substring(0, 200));
                }

                if (cacheKey && result.translated_text) {
                    this._storeCachedTranslation(cacheKey, {
                        text: result.translated_text,
                        source: result.source_language_code,
                        target,
                        mode: 'default',
                        ts: Date.now()
                    });
                }

                return {
                    success: true,
                    translatedText: result.translated_text,
                    sourceLanguage: result.source_language_code,
                    mode: 'default',
                    raw: this.DEBUG ? result : undefined
                };
            } catch (finalErr) {
                lastError = finalErr;
            }

            throw lastError;
        } catch (error) {
            console.error('Translation error:', error);
            
            // Return original text as fallback instead of failing completely
            return {
                success: false,
                error: error.message,
                translatedText: text, // Fallback to original text
                sourceLanguage: fromLang
            };
        }
    }

    // Get farming-specific system prompt based on language
    static getFarmingSystemPrompt(language) {
        try {
            // Lazy load externalized system prompts
            if (!this._cachedSystemPrompts) {
                // In React Native, require JSON for static asset
                this._cachedSystemPrompts = require('../prompts/systemPrompts.json');
            }
            const store = this._cachedSystemPrompts;
            const farming = store.prompts?.farming_assistant;
            const lang = this.normalizeLanguageCode(language);
            const text = farming?.languages?.[lang] || farming?.languages?.[farming?.defaultLanguage] || '';
            return text || 'You are a trusted farming advisor for small and medium farmers in India. Your advice should be practical, regionally relevant, and based on local conditions whenever possible. Use simple, clear language—avoid jargon and technical terms. If you don\'t know something, say so honestly and suggest how the farmer can find out locally (e.g., from a neighbor, local agri office, or market). Incorporate traditional wisdom and local practices when relevant. Never assume the farmer has advanced technology or internet access. Give 1-3 clear, actionable steps, and always prioritize safety and sustainability.';
        } catch (e) {
            console.warn('System prompt load failed, using fallback:', e.message);
            return 'You are a trusted farming advisor for small and medium farmers in India. Your advice should be practical, regionally relevant, and based on local conditions whenever possible. Use simple, clear language—avoid jargon and technical terms. If you don\'t know something, say so honestly and suggest how the farmer can find out locally (e.g., from a neighbor, local agri office, or market). Incorporate traditional wisdom and local practices when relevant. Never assume the farmer has advanced technology or internet access. Give 1-3 clear, actionable steps, and always prioritize safety and sustainability.';
        }
    }

    // Helper method to get farming advice
    static async getFarmingAdvice(question, userLanguage = 'en-IN', userLocation = null) {
        try {
            let contextualQuestion = question;

            // Add location context if available
            if (userLocation) {
                contextualQuestion = `Location: ${userLocation}\nQuestion: ${question}`;
            }

            const messages = [
                { role: 'user', content: contextualQuestion }
            ];

            const result = await this.chatCompletion(messages, userLanguage);

            if (result.success) {
                return {
                    success: true,
                    advice: result.response,
                    canSpeak: true // Indicates this can be converted to speech
                };
            }

            return result;
        } catch (error) {
            console.error('Farming advice error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Helper method for voice interaction (STT + LLM + TTS)
    static async processVoiceQuery(audioBlob, userLanguage = 'en-IN', userLocation = null) {
        try {
            // Step 1: Convert speech to text
            const sttResult = await this.speechToText(audioBlob, userLanguage);

            if (!sttResult.success) {
                return { success: false, error: 'Could not understand speech' };
            }

            // Step 2: Get farming advice
            const adviceResult = await this.getFarmingAdvice(
                sttResult.transcript,
                userLanguage,
                userLocation
            );

            if (!adviceResult.success) {
                return { success: false, error: 'Could not get farming advice' };
            }

            // Step 3: Convert response to speech
            const ttsResult = await this.textToSpeech(
                adviceResult.advice,
                userLanguage,
                'meera'
            );

            return {
                success: true,
                transcript: sttResult.transcript,
                advice: adviceResult.advice,
                audioUrl: ttsResult.success ? ttsResult.audioUrl : null,
                detectedLanguage: sttResult.language
            };
        } catch (error) {
            console.error('Voice query processing error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Update API key
    static setApiKey(apiKey) {
        EnvironmentConfig.setApiKeys({ 
            ...EnvironmentConfig.getApiKeysFromMemory(), 
            sarvam: apiKey 
        });
    }

    // Check if API key is set
    static isConfigured() {
        const apiKey = this.getApiKey();
        return apiKey && apiKey !== 'YOUR_API_KEY_HERE' && apiKey.length > 10;
    }

    // Test API connection
    static async testConnection() {
        try {
            console.log('Testing Sarvam AI connection...');

            // Test with a simple farming question
            const result = await this.getFarmingAdvice(
                'What is the best time to plant wheat?',
                'en-IN',
                'India'
            );

            if (result.success) {
                console.log('✅ Sarvam AI connection successful!');
                console.log('Sample response:', result.advice.substring(0, 100) + '...');
                return { success: true, message: 'Connection successful' };
            } else {
                console.log('❌ Sarvam AI connection failed:', result.error);
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.log('❌ Sarvam AI connection test error:', error);
            return { success: false, error: error.message };
        }
    }
}