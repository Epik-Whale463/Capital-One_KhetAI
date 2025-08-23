/**
 * Groq AI Service for Khet AI
 * Provides Groq LLM integration for reliable cloud-based AI
 * Uses Groq's fast inference for agricultural advice
 */

import EnvironmentConfig from '../config/environment.js';

class GroqAIService {
    constructor() {
        this.baseUrl = 'https://api.groq.com/openai/v1';
        this.apiKey = this.getApiKey();
        this.models = {
            chat: 'openai/gpt-oss-120b',           // Primary chat model
            reasoning: 'openai/gpt-oss-120b',     // Tool-capable model for complex queries
            analysis: 'openai/gpt-oss-120b',     // Tool-capable model for analysis
            lightweight: 'llama-3.1-8b-instant',     // Fast responses for simple queries
            toolCapable: 'openai/gpt-oss-120b'   // Specifically for tool use
        };
        this.isAvailable = true; // Groq is cloud-based, always available
        this.lastChecked = Date.now();

        console.log('🚀 GroqAI Service initialized');
    }

    // Simple singleton accessor to avoid repeated construction & redundant availability checks
    static getInstance() {
        if (!global.__groqServiceInstance) {
            global.__groqServiceInstance = new GroqAIService();
        }
        return global.__groqServiceInstance;
    }

    // Get Groq API key
    getApiKey() {
        // Try environment variable first
        if (typeof process !== 'undefined' && process.env?.GROQ_API_KEY) {
            return process.env.GROQ_API_KEY;
        }

        // Try from environment config
        const envKey = EnvironmentConfig.getGroqApiKey?.();
        if (envKey) return envKey;

        // No fallback: must be set in .env or config
        return null;
    }

    // Check availability (always true for cloud service)
    async checkAvailability() {
        if (!this.apiKey || this.apiKey === 'YOUR_API_KEY_HERE') {
            console.error('❌ Groq API key not configured');
            this.isAvailable = false;
            return false;
        }

        // Quick test call to verify API key
        try {
            const testResponse = await fetch(`${this.baseUrl}/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (testResponse.ok) {
                console.log('✅ Groq AI service is available');
                this.isAvailable = true;
                return true;
            } else {
                console.error('❌ Groq API key validation failed');
                this.isAvailable = false;
                return false;
            }
        } catch (error) {
            console.error('❌ Groq availability check failed:', error.message);
            this.isAvailable = false;
            return false;
        }
    }

    // Manual configuration method (for compatibility)
    setGroqApiKey(apiKey) {
        console.log('🔧 Setting Groq API key');
        this.apiKey = apiKey;
        this.isAvailable = false;
        return this.checkAvailability();
    }

    // Get current status
    getStatus() {
        return {
            isAvailable: this.isAvailable,
            baseUrl: this.baseUrl,
            models: this.models,
            hasApiKey: !!this.apiKey,
            lastChecked: new Date(this.lastChecked).toLocaleTimeString()
        };
    }

    // Choose the best model based on query complexity and tool requirements
    selectModelForQuery(query, context = {}) {
        const queryLength = query.length;
        const hasToolContext = context.toolsUsed && context.toolsUsed.length > 0;
        const isComplex = query.includes('analyze') || query.includes('compare') ||
            query.includes('optimize') || query.includes('strategy') || query.includes('recommend');

        // Check for queries that need app context or UI understanding
        const needsContext = query.toLowerCase().includes('screen') ||
            query.toLowerCase().includes('chat') ||
            query.toLowerCase().includes('what') ||
            query.toLowerCase().includes('how') ||
            query.toLowerCase().includes('where') ||
            query.toLowerCase().includes('why') ||
            query.toLowerCase().includes('explain') ||
            query.toLowerCase().includes('tell me') ||
            query.toLowerCase().includes('show me');

        // If tools were used, query needs context, or is complex, use full model
        if (hasToolContext || isComplex || needsContext || queryLength > 100) {
            return this.models.toolCapable; // openai/gpt-oss-120b
        }

        // Use lightweight model for simple queries
        return this.models.lightweight; // llama-3.1-8b-instant
    }

    // Truncate response intelligently while preserving meaning
    truncateResponse(text, maxLength = 1500) {
        if (text.length <= maxLength) return text;

        // Try to cut at sentence boundary
        const sentences = text.split(/[.!?]+/);
        let result = '';

        for (const sentence of sentences) {
            const nextResult = result + sentence.trim() + '. ';
            if (nextResult.length > maxLength - 50) break; // Leave buffer for clean ending
            result = nextResult;
        }

        // If no complete sentence fits, just truncate at word boundary
        if (result.length === 0) {
            const words = text.split(' ');
            result = words.slice(0, Math.floor(words.length * 0.7)).join(' ');
        }

        return result.trim() + (result.endsWith('.') ? '' : '.');
    }

    // Core chat functionality using Groq with real tools - ENGLISH ONLY
    async generateFarmingAdvice(query, context = {}) {
        if (!this.isAvailable) {
            await this.checkAvailability();
            if (!this.isAvailable) {
                throw new Error('Groq AI service is not available. Please check your API key.');
            }
        }

        try {
            console.log(`🤖 Processing with Groq: ${this.baseUrl}`);

            // Import standardized animation service
            const ReasoningAnimationService = (await import('./ReasoningAnimationService')).default;

            // Create standardized callback
            const reasoningCallback = ReasoningAnimationService.createCallback(context.onReasoningStep);

            // Step 1: Understanding Phase
            await ReasoningAnimationService.animateUnderstanding(reasoningCallback, query);

            // Step 2: Tools Phase
            // Import AgentToolsService dynamically to avoid circular imports
            const AgentToolsService = (await import('./AgentToolsService')).default;

            console.log(`🔍 Checking tools for query: "${query}" with context:`, context);
            const toolsResult = await AgentToolsService.processQueryWithTools(query, context);
            console.log(`Tools result:`, toolsResult ? `${toolsResult.toolResults?.length || 0} tools executed` : 'null');

            let enhancedPrompt = query;
            let toolsUsed = [];

            if (toolsResult && toolsResult.toolResults && toolsResult.toolResults.length > 0) {
                // Enhance the query with real-time data
                let ctx = toolsResult.enhancedContext || '';
                // Strip any pre-existing heading duplicates
                ctx = ctx.replace(/^(Real-time data context:)+/gi, '').trim();
                if (ctx.length > 0) {
                    enhancedPrompt = `${query}\n\nReal-time data context:\n${ctx}`;
                }
                toolsUsed = toolsResult.toolsUsed || [];
                console.log(`Enhanced query with ${toolsUsed.length} tools: ${toolsUsed.join(', ')}`);

                await ReasoningAnimationService.animateToolsPhase(reasoningCallback, toolsUsed);
            } else {
                await ReasoningAnimationService.animateToolsPhase(reasoningCallback, []);
            }

            // Step 3: Analysis Phase
            reasoningCallback({
                id: ReasoningAnimationService.STEP_IDS.ANALYSIS,
                title: 'AI Analysis',
                description: 'Processing query with agricultural expertise',
                status: ReasoningAnimationService.PHASES.ACTIVE,
                icon: ReasoningAnimationService.ICONS.ANALYSIS
            });

            const selectedModel = this.selectModelForQuery(enhancedPrompt, { ...context, toolsUsed });
            const systemPrompt = this.buildFarmingSystemPrompt(context, toolsUsed);

            console.log(`📋 Using Groq model: ${selectedModel} for query length: ${enhancedPrompt.length}`);

            // Call Groq API with conversation history
            const response = await this.callGroq(selectedModel, systemPrompt, enhancedPrompt, {
                conversationHistory: context.conversationHistory
            });

            reasoningCallback({
                id: ReasoningAnimationService.STEP_IDS.ANALYSIS,
                title: 'AI Analysis Complete',
                description: 'Agricultural insights generated successfully',
                status: ReasoningAnimationService.PHASES.COMPLETED,
                duration: ReasoningAnimationService.TIMINGS.VERY_SLOW,
                icon: ReasoningAnimationService.ICONS.SUCCESS
            });

            // Step 4: Response Phase
            await ReasoningAnimationService.animateResponse(reasoningCallback);

            console.log(`✅ Groq response generated (${response.length} chars)`);
            return {
                success: true,
                advice: response,
                source: 'groq-with-tools',
                model: selectedModel,
                toolsUsed: toolsUsed,
                language: 'english',
                endpoint: this.baseUrl
            };
        } catch (error) {
            console.error('❌ Groq farming advice error:', error);

            // Import animation service for error handling
            const ReasoningAnimationService = (await import('./ReasoningAnimationService')).default;

            // Standardized error animation
            if (context.onReasoningStep) {
                ReasoningAnimationService.animateError(
                    ReasoningAnimationService.createCallback(context.onReasoningStep),
                    'Failed to generate response, please try again'
                );
            }

            // Propagate real service error (no fallback)
            throw new Error(`AI service error: ${error.message}`);
        }
    }

    // Simple response method for direct data queries (no reasoning steps)
    async getSimpleResponse(query, context = {}) {
        if (!this.isAvailable) {
            await this.checkAvailability();
            if (!this.isAvailable) {
                return {
                    success: false,
                    message: 'AI service is not available. Please check your API key.',
                    error: 'Service unavailable'
                };
            }
        }

        try {
            const selectedModel = this.models.lightweight; // Use lightweight model
            const farmCtx = context.__systemFarmContext ? `Farmer Profile: ${context.__systemFarmContext}` : '';
            const systemPrompt = `You are an agricultural assistant. ${farmCtx}

RESPONSE RULES:
• Be friendly and helpful to farmers
• Give focused, useful answers with key details
• Use specific numbers and data when available
• Keep responses natural and conversational
• Connect related information briefly
• Aim for 2-4 sentences for simple questions

FORMATTING:
• Write naturally like talking to a farmer
• Always use plain text only - no markdown formatting, headers, bold text, bullet points, or special formatting
• Keep explanations simple and practical
• End with one clear next step if relevant
• Keep responses simple and easy to read with clear line breaks`;

            console.log(`🤖 Simple response using ${selectedModel} for: "${query.substring(0, 50)}..."`);

            const response = await this.callGroq(selectedModel, systemPrompt, query, {
                maxTokens: 1200, // Increased token limit to prevent response truncation
                reasoningEffort: 'low', // Use low reasoning for simple queries
                conversationHistory: context.conversationHistory || []
            });

            return {
                success: true,
                message: response, // Return full response without truncation
                source: 'groq-simple',
                model: selectedModel
            };
        } catch (error) {
            console.error('Simple response error:', error);
            return {
                success: false,
                message: 'Unable to generate response at this time.',
                error: error.message
            };
        }
    }



    // Enhanced reasoning method for complex queries with step-by-step display
    async generateResponseWithReasoning(query, reasoningCallback = () => { }, context = {}) {
        return await this.generateFarmingAdvice(query, {
            ...context,
            onReasoningStep: reasoningCallback
        });
    }

    // Method to generate response with specific reasoning effort
    async generateResponseWithEffort(query, reasoningEffort = 'medium', context = {}) {
        const systemPrompt = this.buildFarmingSystemPrompt(context, []);
        const selectedModel = this.selectModelForQuery(query, context);

        console.log(`🧠 Generating response with ${reasoningEffort} reasoning effort`);

        return await this.callGroq(selectedModel, systemPrompt, query, {
            reasoningEffort: reasoningEffort,
            maxTokens: reasoningEffort === 'high' ? 1800 : reasoningEffort === 'medium' ? 1500 : 1000
        });
    }

    // Core Groq API call with reasoning capabilities
    async callGroq(model, systemPrompt, userPrompt, options = {}) {
        const messages = [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : [])
        ];

        // Add conversation history if provided
        if (options.conversationHistory && Array.isArray(options.conversationHistory)) {
            // Add recent conversation history (last 6 messages to stay within context limits)
            const recentHistory = options.conversationHistory.slice(-6);
            console.log(`💬 Adding ${recentHistory.length} conversation history messages`);
            messages.push(...recentHistory);
        }

        // Add current user message
        messages.push({ role: 'user', content: userPrompt });

        // Determine reasoning effort based on query complexity
        const reasoningEffort = this.determineReasoningEffort(userPrompt, options);

        const payload = {
            model: model,
            messages: messages,
            temperature: options.temperature ?? 0.3,
            max_tokens: options.maxTokens || 1500,           // Balanced token limit
            max_completion_tokens: options.maxTokens || 1500, // Balanced for good responses
            top_p: options.topP ?? 0.8,
            stream: false
        };
        // Conditionally attach reasoning effort (skip for terse summary calls)
        if (!options.disableReasoning) {
            const supportsReasoningEffort = /(o1|o3|reasoning|deepseek-reasoner|thinking)/i.test(model);
            if (supportsReasoningEffort) {
                payload.reasoning_effort = reasoningEffort;
                console.log(`🧠 Using reasoning effort: ${reasoningEffort} for ${model}`);
            } else if (options.reasoningEffort) {
                console.log(`ℹ️ Skipping reasoning_effort for model ${model} (not in allow-list)`);
            }
        }

        const maxRetries = options.retries ?? 2; // number of re-attempts after first try
        const retryDelayMs = options.retryDelayMs ?? 600;
        const timeoutMs = options.timeoutMs ?? 12000;
        let attempt = 0;
        let lastError = null;

        while (attempt <= maxRetries) {
            attempt += 1;
            const attemptLabel = `attempt ${attempt}/${maxRetries + 1}`;
            console.log(`📤 Groq request to ${this.baseUrl}/chat/completions with model: ${model} (${attemptLabel})`);
            console.log(`📝 Request payload:`, JSON.stringify(payload, null, 2));

            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timeoutHandle = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
            try {
                const response = await fetch(`${this.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload),
                    signal: controller?.signal
                });
                if (timeoutHandle) clearTimeout(timeoutHandle);

                if (!response.ok) {
                    const status = response.status;
                    const bodyText = await response.text();
                    const transient = status >= 500 || status === 429; // retry only server / rate / transient
                    const err = new Error(`Groq API error: ${status} - ${bodyText}`);
                    if (transient && attempt <= maxRetries) {
                        console.warn(`⚠️ Transient Groq error (${status}) – will retry after ${retryDelayMs}ms`);
                        lastError = err;
                        await new Promise(r => setTimeout(r, retryDelayMs * attempt));
                        continue;
                    }
                    throw err;
                }

                const data = await response.json();

                if (!data.choices || !data.choices[0]) {
                    console.error('❌ Invalid Groq response format (no choices):', data);
                    throw new Error('Invalid response format from Groq');
                }

                const primaryChoice = data.choices[0];
                let responseContent = primaryChoice?.message?.content;

                // If content is an array of parts, concatenate textual parts
                if (Array.isArray(responseContent)) {
                    responseContent = responseContent.map(part => (typeof part === 'string' ? part : part?.text || '')).join('\n').trim();
                }

                // Alternative extraction heuristics when content is empty
                if (!responseContent || typeof responseContent !== 'string' || responseContent.trim().length === 0) {
                    // Try reasoning object (some providers separate reasoning from final answer)
                    if (primaryChoice.message && primaryChoice.message.reasoning_content) {
                        responseContent = primaryChoice.message.reasoning_content;
                    }
                    else if (primaryChoice.reasoning && typeof primaryChoice.reasoning === 'object') {
                        // Flatten any textual fields in reasoning
                        const reasoningText = Object.values(primaryChoice.reasoning)
                            .filter(v => typeof v === 'string')
                            .join('\n');
                        if (reasoningText.trim().length > 20) {
                            responseContent = reasoningText.trim();
                        }
                    }
                    // Some implementations may put final answer inside usage or metadata (rare)
                    if ((!responseContent || responseContent.trim().length === 0) && primaryChoice.message && primaryChoice.message.content === '') {
                        console.warn('⚠️ Empty content field received. Full choice for diagnostics:', JSON.stringify(primaryChoice, null, 2).substring(0, 2000));
                    }
                }

                if (!responseContent || responseContent.trim().length === 0) {
                    const finishReason = primaryChoice.finish_reason;
                    console.error('❌ Empty or invalid response content after heuristics:', { finishReason, fullResponse: data });
                    throw new Error('Groq returned empty or invalid response content');
                }

                console.log(`📥 Raw Groq response: "${responseContent.substring(0, 200)}..." (${responseContent.length} chars)`);

                // Log reasoning information if available
                if (data.choices[0].reasoning) {
                    console.log(`🧠 Reasoning steps: ${data.choices[0].reasoning.length} steps`);
                }

                // Ensure response is under 1500 characters for translation API
                if (responseContent.length > 1500) {
                    console.log(`⚠️ Response too long (${responseContent.length} chars), truncating...`);
                    responseContent = this.truncateResponse(responseContent, 1500);
                }

                responseContent = this.sanitizeResponse(responseContent);

                // Double-check after sanitization
                if (!responseContent || responseContent.trim().length === 0) {
                    console.error('❌ Response became empty after sanitization');
                    throw new Error('Response was sanitized to empty content');
                }

                console.log(`📥 Groq response received (${responseContent.length} chars) after sanitization`);
                return responseContent;

            } catch (error) {
                if (timeoutHandle) clearTimeout(timeoutHandle);
                const isAbort = error?.name === 'AbortError';
                const isNetwork = /Network request failed/i.test(error?.message || '');
                if ((isAbort || isNetwork) && attempt <= maxRetries) {
                    console.warn(`⚠️ Network/timeout issue (${isAbort ? 'timeout' : 'network'}) – retrying after ${retryDelayMs}ms (attempt ${attempt}/${maxRetries + 1})`);
                    lastError = error;
                    await new Promise(r => setTimeout(r, retryDelayMs * attempt));
                    continue;
                }
                console.error('❌ Groq API call failed:', error);
                throw error;
            }
        }
        // Exhausted retries
        throw lastError || new Error('Groq request failed after retries');
    }

    // Determine appropriate reasoning effort based on query complexity
    determineReasoningEffort(query, options = {}) {
        if (options.reasoningEffort) {
            return options.reasoningEffort; // Manual override
        }

        const queryLower = query.toLowerCase();
        const complexKeywords = [
            'analyze', 'compare', 'strategy', 'optimize', 'complex', 'detailed',
            'comprehensive', 'plan', 'recommend', 'why', 'explain', 'calculate'
        ];

        const simpleKeywords = [
            'weather', 'price', 'when', 'what', 'where', 'quick', 'simple', 'brief'
        ];

        const complexCount = complexKeywords.filter(keyword => queryLower.includes(keyword)).length;
        const simpleCount = simpleKeywords.filter(keyword => queryLower.includes(keyword)).length;
        const queryLength = query.length;

        // High reasoning for complex agricultural planning
        if (complexCount >= 2 || queryLength > 200) {
            return 'high';
        }

        // Low reasoning for simple data queries
        if (simpleCount >= 1 && complexCount === 0 && queryLength < 50) {
            return 'low';
        }

        // Medium reasoning for most farming advice
        return 'medium';
    }

    // Build comprehensive farming system prompt - ENGLISH ONLY
    buildFarmingSystemPrompt(context, toolsUsed = []) {
        let userLine = `User Context: ${context.location || 'India'}, Crops: ${context.crops?.join(', ') || 'Mixed farming'}, Farm: ${context.farmSize || 'Unknown size'}`;
        if (context.__systemFarmContext) {
            userLine += `\nFarm Profile: ${context.__systemFarmContext}`;
        }
        // REMOVED conversation summary to prevent context bleeding for farmers

        // Use the friendly system prompt from external file
        let systemPrompt;
        try {
            const systemPrompts = require('../prompts/systemPrompts.json');
            systemPrompt = systemPrompts.prompts?.farming_assistant?.languages?.['en-IN'] ||
                "You are a trusted farming advisor for small and medium farmers in India. Your advice should be practical, regionally relevant, and based on local conditions whenever possible. Use simple, clear language—avoid jargon and technical terms. If you don't know something, say so honestly and suggest how the farmer can find out locally (e.g., from a neighbor, local agri office, or market). Incorporate traditional wisdom and local practices when relevant. Never assume the farmer has advanced technology or internet access. IMPORTANT: Keep responses natural and focused. Use plain text only - no markdown formatting, headers, bold text, bullet points, or special formatting. Give helpful details but stay concise.";
        } catch (e) {
            systemPrompt = "You are a trusted farming advisor for small and medium farmers in India. Your advice should be practical, regionally relevant, and based on local conditions whenever possible. Use simple, clear language—avoid jargon and technical terms. If you don't know something, say so honestly and suggest how the farmer can find out locally (e.g., from a neighbor, local agri office, or market). Incorporate traditional wisdom and local practices when relevant. Never assume the farmer has advanced technology or internet access. IMPORTANT: Keep responses natural and focused. Use plain text only - no markdown formatting, headers, bold text, bullet points, or special formatting. Give helpful details but stay concise.";
        }

        let prompt = `${systemPrompt}\n\n${userLine}`;

        if (toolsUsed.length > 0) {
            prompt += `\n\nI've got access to real-time data to give you the most current info. I'll share the exact numbers but won't bore you with technical details unless you ask.`;
        }

        prompt += `\n\nRESPONSE RULES:
• Be friendly and helpful to farmers
• Give complete but focused answers - include key details without rambling
• Use specific numbers and data when available
• Explain briefly what the information means for their farming
• Keep responses natural and conversational
• Aim for 3-5 sentences for most topics

COMMUNICATION STYLE:
• Write naturally like talking to a farmer friend
• Always use plain text only - no markdown, headers, bold, or special formatting
• Connect related information (weather + crops, prices + planning)
• Keep explanations simple and practical
• End with one clear recommendation or next step

Example response style:
"Today in Namburu it's 33°C and partly cloudy with 65% humidity, good conditions for your chilli sowing. Tomorrow expects 2mm light rain followed by sunny weather, so hold off watering until after the rain. Mirchi prices are currently 4,200 rupees per quintal, up 8% from last week. This is a good time to focus on proper plant spacing in your 2-acre field while prices are strong."`;

        return prompt;
    }

    // Remove internal or verbose phrases the model might still output
    sanitizeResponse(text) {
        if (!text) return text;
        const forbiddenPatterns = [
            /as an ai (language )?model[^.]*\.?/gi,
            /i (do not|don't) have (access|the ability)[^.]*\.?/gi,
            /model name:?\s*\w[^\n]*/gi,
            /provider:?\s*groq[^\n]*/gi,
            /(latency|token usage|connection (status|details))[^.]*\.?/gi,
            /this (response|answer) (was )?generated using[^.]*\.?/gi,
            /i used (the )?(following )?tools[^.]*\.?/gi,
            /internal tool context[^.]*\.?/gi
        ];
        let cleaned = text;
        forbiddenPatterns.forEach(p => { cleaned = cleaned.replace(p, '').trim(); });
        // Collapse multiple blank lines
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
        return cleaned;
    }

    // Extract structured recommendations from response
    extractRecommendations(response) {
        const lines = response.split('\n');
        const recommendations = [];

        lines.forEach(line => {
            if (line.includes('•') || line.includes('-') || line.includes('1.') || line.includes('2.')) {
                const clean = line.replace(/[•\-\d\.]/g, '').trim();
                if (clean.length > 10) {
                    recommendations.push(clean);
                }
            }
        });

        return recommendations.slice(0, 5); // Top 5 recommendations
    }

    // Weather analysis agent - uses real weather tools
    async analyzeWeatherForFarming(weatherData, cropData = []) {
        if (!this.isAvailable) {
            throw new Error('Groq service not available for weather analysis. Please check your API key.');
        }

        try {
            // Get real weather tools data first
            const WeatherToolsService = (await import('./WeatherToolsService')).default;
            const toolsData = await WeatherToolsService.getAgricultureWeather(
                weatherData.coordinates?.latitude || 28.6139,
                weatherData.coordinates?.longitude || 77.2090
            );

            if (!toolsData.success) {
                throw new Error(`Weather data unavailable: ${toolsData.error}`);
            }

            const prompt = `Analyze this real weather data for farming decisions:

Current: ${JSON.stringify(toolsData.current)}
7-day forecast: ${JSON.stringify(toolsData.daily)}
Crops: ${cropData.join(', ') || 'General farming'}

Provide specific actionable advice for:
1. Immediate actions needed
2. Irrigation recommendations  
3. Pest/disease risks
4. Optimal farming activities`;

            const response = await this.callGroq(this.models.reasoning, '', prompt);
            return {
                success: true,
                analysis: response,
                recommendations: this.extractRecommendations(response),
                source: 'groq-weather-agent-with-real-data',
                model: this.models.reasoning,
                dataSource: 'OpenWeather API'
            };
        } catch (error) {
            console.error('Weather analysis error:', error);
            throw error; // No fallback - let the error bubble up
        }
    }

    // Test connection
    async testConnection() {
        try {
            console.log('Testing Groq AI connection...');
            const result = await this.getSimpleResponse('What is the best time to plant wheat?', { location: 'India' });

            if (result.success) {
                console.log('✅ Groq AI connection successful!');
                console.log('Sample response:', result.message.substring(0, 100) + '...');
                return { success: true, message: 'Connection successful' };
            } else {
                console.log('❌ Groq AI connection failed:', result.error);
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.log('❌ Groq AI connection test error:', error);
            return { success: false, error: error.message };
        }
    }
}

export default GroqAIService;