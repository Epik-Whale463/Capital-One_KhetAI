/**
 * Autonomous Agent Service for Khet AI
 * Implements ReAct (Reasoning + Acting) pattern with advanced chain-of-thought reasoning
 * Based on latest best practices from Claude, OpenAI, GPT-4o, and Grok
 * 
 * Key Features:
 * - Step-by-step reasoning with visible thought process
 * - Dynamic tool selection and execution
 * - Self-reflection and error correction
 * - Multi-turn conversation memory
 * - Autonomous planning and strategy adjustment
 */

import GroqAdapterService from './GroqAdapterService';

class AutonomousAgentService {
    constructor() {
        this.groq = new GroqAdapterService();
        this.conversationHistory = new Map(); // Thread-based memory
        this.agentState = {
            currentTask: null,
            executionPlan: [],
            executedSteps: [],
            availableTools: [],
            reflections: [],
            confidence: 0
        };

        // Agent personality and capabilities
        this.agentPersona = {
            name: "Khet Assistant",
            expertise: ["farming", "agriculture", "crop management", "weather analysis", "market insights"],
            reasoning_style: "methodical_analytical",
            confidence_threshold: 0.7
        };
    }

    /**
     * Main entry point for autonomous agent reasoning
     * Implements ReAct pattern: Reason → Act → Observe → Reflect → Plan
     */
    async processQuery(query, context = {}) {
        const threadId = context.threadId || 'default';

        try {
            // Import standardized animation service
            const ReasoningAnimationService = (await import('./ReasoningAnimationService')).default;
            
            // Create standardized callback with progress tracking
            const reasoningCallback = ReasoningAnimationService.createProgressCallback(
                context.onReasoningStep, 
                5 // Total steps: Reason, Act, Observe, Reflect, Respond
            );

            // Initialize conversation thread if new
            if (!this.conversationHistory.has(threadId)) {
                this.conversationHistory.set(threadId, {
                    messages: [],
                    context: {},
                    taskHistory: [],
                    learnings: []
                });
            }

            const thread = this.conversationHistory.get(threadId);

            // Step 1: REASON - Understand and plan
            reasoningCallback({
                id: 'reason',
                title: 'Deep Reasoning',
                description: 'Analyzing query with chain of thought process',
                status: ReasoningAnimationService.PHASES.ACTIVE,
                icon: ReasoningAnimationService.ICONS.REASONING
            });
            
            const planningResult = await this.reasonAndPlan(query, thread, reasoningCallback);
            
            reasoningCallback({
                id: 'reason',
                title: 'Reasoning Complete',
                description: `Generated ${planningResult.plan.actions.length} step execution plan`,
                status: ReasoningAnimationService.PHASES.COMPLETED,
                duration: ReasoningAnimationService.TIMINGS.SLOW,
                icon: ReasoningAnimationService.ICONS.SUCCESS
            });

            // Step 2: ACT - Execute planned actions
            reasoningCallback({
                id: 'execute',
                title: 'Executing Actions',
                description: 'Running tools and gathering information',
                status: ReasoningAnimationService.PHASES.ACTIVE,
                icon: ReasoningAnimationService.ICONS.TOOLS
            });
            
            const executionResult = await this.executeActions(planningResult.plan, context, reasoningCallback);
            
            reasoningCallback({
                id: 'execute',
                title: 'Actions Complete',
                description: `Executed ${executionResult.results.length} actions successfully`,
                status: ReasoningAnimationService.PHASES.COMPLETED,
                duration: ReasoningAnimationService.TIMINGS.VERY_SLOW,
                icon: ReasoningAnimationService.ICONS.SUCCESS
            });

            // Step 3: OBSERVE - Analyze results
            reasoningCallback({
                id: 'observe',
                title: 'Observing Results',
                description: 'Analyzing gathered information and findings',
                status: ReasoningAnimationService.PHASES.ACTIVE,
                icon: ReasoningAnimationService.ICONS.ANALYSIS
            });
            
            const observationResult = await this.observeAndAnalyze(executionResult, reasoningCallback);
            
            reasoningCallback({
                id: 'observe',
                title: 'Analysis Complete',
                description: `Found ${observationResult.keyFindings.length} key insights`,
                status: ReasoningAnimationService.PHASES.COMPLETED,
                duration: ReasoningAnimationService.TIMINGS.SLOW,
                icon: ReasoningAnimationService.ICONS.SUCCESS
            });

            // Step 4: REFLECT - Self-assessment and learning
            reasoningCallback({
                id: 'reflect',
                title: 'Self-Reflection',
                description: 'Evaluating approach and learning from results',
                status: ReasoningAnimationService.PHASES.ACTIVE,
                icon: '🎯'
            });
            
            const reflectionResult = await this.reflectAndLearn(observationResult, thread, reasoningCallback);
            
            reasoningCallback({
                id: 'reflect',
                title: 'Reflection Complete',
                description: `Generated ${reflectionResult.learnings.length} new insights`,
                status: ReasoningAnimationService.PHASES.COMPLETED,
                duration: ReasoningAnimationService.TIMINGS.NORMAL,
                icon: ReasoningAnimationService.ICONS.SUCCESS
            });

            // Step 5: RESPOND - Generate final response
            await ReasoningAnimationService.animateResponse(reasoningCallback, 'Crafting Response');
            
            const response = await this.generateFinalResponse(reflectionResult, reasoningCallback);

            // Update conversation history
            thread.messages.push(
                { role: 'user', content: query, timestamp: Date.now() },
                { role: 'assistant', content: response.content, reasoning: response.reasoning, timestamp: Date.now() }
            );

            return {
                content: response.content,
                reasoning: response.reasoning,
                confidence: response.confidence,
                toolsUsed: executionResult.toolsUsed,
                metadata: {
                    threadId,
                    steps: response.steps,
                    reflections: reflectionResult.reflections
                }
            };

        } catch (error) {
            console.error('❌ Autonomous agent error:', error);

            // Import animation service for error handling
            const ReasoningAnimationService = (await import('./ReasoningAnimationService')).default;
            ReasoningAnimationService.animateError(
                ReasoningAnimationService.createCallback(context.onReasoningStep),
                'Attempting to recover and provide helpful response'
            );

            // Error recovery with graceful degradation
            return await this.handleError(error, query, context, reasoningCallback);
        }
    }

    /**
     * Step 1: REASON AND PLAN
     * Chain of thought reasoning to understand query and create execution plan
     */
    async reasonAndPlan(query, thread, reasoningCallback) {
        reasoningCallback({
            id: 'reason',
            title: '🧠 Deep Reasoning',
            description: 'Analyzing query with chain of thought process',
            status: 'active'
        });

        // Construct reasoning prompt with chain of thought
        const reasoningPrompt = this.buildReasoningPrompt(query, thread);

        try {
            const reasoningResponse = await this.groq.generateFarmingAdvice(reasoningPrompt, {
                model: 'openai/gpt-oss-20b', // Use most capable model for reasoning
                maxTokens: 2000,
                temperature: 0.1 // Low temperature for logical reasoning
            });

            // Parse reasoning into structured plan
            const plan = this.parseReasoningIntoPlan(reasoningResponse.advice);

            reasoningCallback({
                id: 'reason',
                title: '🧠 Reasoning Complete',
                description: `Generated ${plan.actions.length} step execution plan`,
                status: 'completed',
                duration: 800
            });

            return {
                reasoning: reasoningResponse.advice,
                plan: plan,
                confidence: this.assessPlanConfidence(plan)
            };

        } catch (error) {
            console.error('❌ Reasoning step failed:', error);
            throw new Error(`Reasoning failed: ${error.message}`);
        }
    }

    /**
     * Step 2: EXECUTE ACTIONS
     * Dynamic tool selection and execution based on plan
     */
    async executeActions(plan, context, reasoningCallback) {
        reasoningCallback({
            id: 'execute',
            title: '⚡ Executing Actions',
            description: 'Running tools and gathering information',
            status: 'active'
        });

        const executionResults = [];
        const toolsUsed = [];

        try {
            // Import tools dynamically
            const AgentToolsService = (await import('./AgentToolsService')).default;

            for (let i = 0; i < plan.actions.length; i++) {
                const action = plan.actions[i];

                reasoningCallback({
                    id: 'execute',
                    title: '⚡ Executing Actions',
                    description: `Step ${i + 1}/${plan.actions.length}: ${action.description}`,
                    status: 'active'
                });

                if (action.type === 'tool_use') {
                    // Execute specific tool
                    const toolResult = await this.executeTool(action, context, AgentToolsService);
                    executionResults.push(toolResult);
                    if (toolResult.success) {
                        toolsUsed.push(toolResult.tool);
                    }
                } else if (action.type === 'reasoning') {
                    // Pure reasoning step
                    const reasoningResult = await this.executeReasoning(action, context);
                    executionResults.push(reasoningResult);
                } else if (action.type === 'search') {
                    // Information gathering
                    const searchResult = await this.executeSearch(action, context, AgentToolsService);
                    executionResults.push(searchResult);
                    if (searchResult.success) {
                        toolsUsed.push({ name: 'search', type: 'information_gathering' });
                    }
                }

                // Brief pause between actions for UX
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            reasoningCallback({
                id: 'execute',
                title: '⚡ Actions Complete',
                description: `Executed ${executionResults.length} actions successfully`,
                status: 'completed',
                duration: 1200
            });

            return {
                results: executionResults,
                toolsUsed: toolsUsed,
                success: executionResults.every(r => r.success)
            };

        } catch (error) {
            console.error('❌ Action execution failed:', error);
            throw new Error(`Action execution failed: ${error.message}`);
        }
    }

    /**
     * Step 3: OBSERVE AND ANALYZE
     * Analyze execution results and synthesize information
     */
    async observeAndAnalyze(executionResult, reasoningCallback) {
        reasoningCallback({
            id: 'observe',
            title: '👁️ Observing Results',
            description: 'Analyzing gathered information and findings',
            status: 'active'
        });

        try {
            // Synthesize all execution results
            const synthesis = {
                successes: executionResult.results.filter(r => r.success),
                failures: executionResult.results.filter(r => !r.success),
                keyFindings: [],
                patterns: [],
                gaps: []
            };

            // Extract key findings from successful results
            synthesis.successes.forEach(result => {
                if (result.data) {
                    synthesis.keyFindings.push({
                        source: result.tool || result.type,
                        finding: result.data,
                        confidence: result.confidence || 0.8
                    });
                }
            });

            // Identify patterns and relationships
            synthesis.patterns = this.identifyPatterns(synthesis.keyFindings);

            // Identify information gaps
            synthesis.gaps = this.identifyGaps(synthesis.successes, synthesis.failures);

            reasoningCallback({
                id: 'observe',
                title: '👁️ Analysis Complete',
                description: `Found ${synthesis.keyFindings.length} key insights`,
                status: 'completed',
                duration: 600
            });

            return synthesis;

        } catch (error) {
            console.error('❌ Observation failed:', error);
            throw new Error(`Observation failed: ${error.message}`);
        }
    }

    /**
     * Step 4: REFLECT AND LEARN
     * Self-assessment and strategy adjustment
     */
    async reflectAndLearn(observationResult, thread, reasoningCallback) {
        reasoningCallback({
            id: 'reflect',
            title: '🎯 Self-Reflection',
            description: 'Evaluating approach and learning from results',
            status: 'active'
        });

        try {
            const reflection = {
                effectiveness: this.assessEffectiveness(observationResult),
                learnings: this.extractLearnings(observationResult),
                improvements: this.identifyImprovements(observationResult),
                confidence: this.calculateConfidence(observationResult)
            };

            // Update agent state with learnings
            this.agentState.reflections.push({
                timestamp: Date.now(),
                reflection: reflection,
                context: observationResult
            });

            // Store learnings in conversation thread
            thread.learnings.push(...reflection.learnings);

            reasoningCallback({
                id: 'reflect',
                title: '🎯 Reflection Complete',
                description: `Generated ${reflection.learnings.length} new insights`,
                status: 'completed',
                duration: 400
            });

            return reflection;

        } catch (error) {
            console.error('❌ Reflection failed:', error);
            throw new Error(`Reflection failed: ${error.message}`);
        }
    }

    /**
     * Step 5: GENERATE FINAL RESPONSE
     * Create comprehensive, helpful response with visible reasoning
     */
    async generateFinalResponse(reflectionResult, reasoningCallback) {
        reasoningCallback({
            id: 'respond',
            title: '📝 Crafting Response',
            description: 'Synthesizing insights into actionable advice',
            status: 'active'
        });

        try {
            // Build comprehensive response prompt
            const responsePrompt = this.buildResponsePrompt(reflectionResult);

            const finalResponse = await this.groq.generateFarmingAdvice(responsePrompt, {
                model: 'qwen2.5:7b-instruct-q5_K_M',
                maxTokens: 1500,
                temperature: 0.3 // Slightly higher for natural language
            });

            reasoningCallback({
                id: 'respond',
                title: '📝 Response Ready',
                description: 'Complete analysis and recommendations prepared',
                status: 'completed',
                duration: 500
            });

            return {
                content: finalResponse.advice,
                reasoning: this.formatReasoningTrace(reflectionResult),
                confidence: reflectionResult.confidence,
                steps: this.formatExecutionSteps(reflectionResult)
            };

        } catch (error) {
            console.error('❌ Response generation failed:', error);
            throw new Error(`Response generation failed: ${error.message}`);
        }
    }

    /**
     * Build chain-of-thought reasoning prompt
     */
    buildReasoningPrompt(query, thread) {
        const conversationContext = thread.messages.slice(-4); // Last 4 messages
        const pastLearnings = thread.learnings.slice(-3); // Last 3 learnings

        return `<thinking>
You are Khet Assistant, an autonomous AI farming expert. Use step-by-step reasoning to analyze this query and create an execution plan.

QUERY: "${query}"

CONVERSATION CONTEXT:
${conversationContext.map(m => `${m.role}: ${m.content}`).join('\n')}

PAST LEARNINGS:
${pastLearnings.map(l => `- ${l.insight}`).join('\n')}

REASONING PROCESS:
1. What is the farmer really asking for?
2. What information do I need to provide a complete answer?
3. What tools or data sources should I consult?
4. What are the potential challenges or edge cases?
5. How can I structure my response to be most helpful?

Think through each step carefully and create a detailed execution plan.
</thinking>

Based on the query "${query}", I need to think through this systematically:

**Understanding the Query:**
- What specific farming challenge or question is being asked?
- What's the farmer's likely context and urgency level?
- Are there any implicit requirements or constraints?

**Information Requirements:**
- What real-time data might be needed (weather, market prices, etc.)?
- What domain knowledge should I apply?
- Are there seasonal or location-specific factors to consider?

**Execution Plan:**
Please provide a structured plan with specific actions to take, tools to use, and reasoning steps to follow.`;
    }

    /**
     * Parse reasoning response into structured execution plan
     */
    parseReasoningIntoPlan(reasoningText) {
        const plan = {
            objective: '',
            actions: [],
            expectedOutcome: '',
            risks: []
        };

        // Extract objective (look for patterns like "Goal:", "Objective:", etc.)
        const objectiveMatch = reasoningText.match(/(?:objective|goal|aim):\s*([^\n]+)/i);
        if (objectiveMatch) {
            plan.objective = objectiveMatch[1].trim();
        }

        // Extract actions (look for numbered lists, bullet points, etc.)
        const actionPatterns = [
            /\d+\.\s*([^\n]+)/g,
            /[-•]\s*([^\n]+)/g,
            /Step \d+:\s*([^\n]+)/gi
        ];

        for (const pattern of actionPatterns) {
            const matches = [...reasoningText.matchAll(pattern)];
            if (matches.length > 0) {
                plan.actions = matches.map((match, index) => ({
                    id: `action_${index + 1}`,
                    description: match[1].trim(),
                    type: this.classifyActionType(match[1]),
                    priority: index + 1
                }));
                break;
            }
        }

        // If no structured actions found, create default plan
        if (plan.actions.length === 0) {
            plan.actions = [
                {
                    id: 'action_1',
                    description: 'Analyze query and gather relevant information',
                    type: 'reasoning',
                    priority: 1
                },
                {
                    id: 'action_2',
                    description: 'Check for real-time data requirements',
                    type: 'tool_use',
                    priority: 2
                },
                {
                    id: 'action_3',
                    description: 'Synthesize comprehensive response',
                    type: 'reasoning',
                    priority: 3
                }
            ];
        }

        return plan;
    }

    /**
     * Classify action type based on description
     */
    classifyActionType(description) {
        const lowerDesc = description.toLowerCase();

        if (lowerDesc.includes('weather') || lowerDesc.includes('market') ||
            lowerDesc.includes('price') || lowerDesc.includes('data')) {
            return 'tool_use';
        }

        if (lowerDesc.includes('search') || lowerDesc.includes('find') ||
            lowerDesc.includes('lookup') || lowerDesc.includes('check')) {
            return 'search';
        }

        return 'reasoning';
    }

    /**
     * Execute individual tool with error handling
     */
    async executeTool(action, context, AgentToolsService) {
        try {
            // Determine which tool to use based on action description
            const toolQuery = this.extractToolQuery(action.description);

            // Enrich context with default values if missing
            const enrichedContext = {
                ...context,
                // Add default location if not provided
                location: context.location || null,
                // Add default crops if not provided
                crops: context.crops || [],
                // Add mode for tool processing
                mode: context.mode || 'data_synthesis'
            };

            const toolResult = await AgentToolsService.processQueryWithTools(toolQuery, enrichedContext);

            return {
                success: true,
                tool: action.id,
                data: toolResult,
                confidence: 0.8,
                description: action.description
            };

        } catch (error) {
            console.error(`❌ Tool execution failed for ${action.id}:`, error);
            return {
                success: false,
                tool: action.id,
                error: error.message,
                description: action.description
            };
        }
    }

    /**
     * Execute reasoning step
     */
    async executeReasoning(action, context) {
        try {
            const reasoningPrompt = `Think through this step: ${action.description}
            
            Consider:
            - Current context and constraints
            - Available information
            - Best practices in farming
            - Potential outcomes and recommendations
            
            Provide clear, actionable insights.`;

            const result = await this.groq.generateFarmingAdvice(reasoningPrompt, {
                model: 'qwen2.5:7b-instruct-q5_K_M',
                maxTokens: 500,
                temperature: 0.2
            });

            return {
                success: true,
                type: 'reasoning',
                data: result.advice,
                confidence: 0.9,
                description: action.description
            };

        } catch (error) {
            console.error(`❌ Reasoning step failed:`, error);
            return {
                success: false,
                type: 'reasoning',
                error: error.message,
                description: action.description
            };
        }
    }

    /**
     * Execute search/information gathering
     */
    async executeSearch(action, context, AgentToolsService) {
        try {
            // Convert action description to search query
            const searchQuery = this.extractSearchQuery(action.description);

            // Use available tools for information gathering
            const searchResult = await AgentToolsService.processQueryWithTools(searchQuery, {
                ...context,
                searchFocus: true
            });

            return {
                success: true,
                type: 'search',
                data: searchResult,
                confidence: 0.7,
                description: action.description
            };

        } catch (error) {
            console.error(`❌ Search failed:`, error);
            return {
                success: false,
                type: 'search',
                error: error.message,
                description: action.description
            };
        }
    }

    /**
     * Extract tool query from action description
     */
    extractToolQuery(description) {
        // Convert action descriptions to appropriate tool queries
        const lowerDesc = description.toLowerCase();

        if (lowerDesc.includes('weather')) {
            return 'current weather conditions';
        }
        if (lowerDesc.includes('market') || lowerDesc.includes('price')) {
            return 'current market prices';
        }
        if (lowerDesc.includes('scheme') || lowerDesc.includes('government')) {
            return 'government farming schemes';
        }

        return description; // Fallback to original description
    }

    /**
     * Extract search query from action description
     */
    extractSearchQuery(description) {
        // Remove action words and extract core search terms
        return description
            .replace(/^(search|find|lookup|check|analyze|determine)\s+/i, '')
            .replace(/\s+(for|about|regarding)\s+/i, ' ')
            .trim();
    }

    /**
     * Identify patterns in findings
     */
    identifyPatterns(findings) {
        const patterns = [];

        // Look for recurring themes
        const themes = {};
        findings.forEach(finding => {
            const words = finding.finding.toString().toLowerCase().split(/\s+/);
            words.forEach(word => {
                if (word.length > 3) {
                    themes[word] = (themes[word] || 0) + 1;
                }
            });
        });

        // Identify frequently mentioned concepts
        Object.entries(themes)
            .filter(([word, count]) => count >= 2)
            .forEach(([word, count]) => {
                patterns.push({
                    type: 'recurring_theme',
                    pattern: word,
                    frequency: count,
                    confidence: 0.6
                });
            });

        return patterns;
    }

    /**
     * Identify information gaps
     */
    identifyGaps(successes, failures) {
        const gaps = [];

        // Check for failed tool executions
        failures.forEach(failure => {
            gaps.push({
                type: 'missing_data',
                source: failure.tool || failure.type,
                description: `Could not retrieve: ${failure.description}`,
                impact: 'medium'
            });
        });

        // Check for incomplete information
        if (successes.length < 2) {
            gaps.push({
                type: 'insufficient_data',
                description: 'Limited information sources available',
                impact: 'low'
            });
        }

        return gaps;
    }

    /**
     * Assess plan effectiveness
     */
    assessEffectiveness(observationResult) {
        const totalFindings = observationResult.keyFindings.length;
        const totalGaps = observationResult.gaps.length;

        let effectiveness = 0.5; // Base effectiveness

        // Increase based on successful findings
        if (totalFindings > 0) {
            effectiveness += Math.min(0.4, totalFindings * 0.1);
        }

        // Decrease based on gaps
        if (totalGaps > 0) {
            effectiveness -= Math.min(0.3, totalGaps * 0.1);
        }

        return Math.max(0.1, Math.min(1.0, effectiveness));
    }

    /**
     * Extract learnings from execution
     */
    extractLearnings(observationResult) {
        const learnings = [];

        // Learn from successful patterns
        observationResult.patterns.forEach(pattern => {
            learnings.push({
                type: 'pattern_recognition',
                insight: `${pattern.pattern} is a recurring theme in farming queries`,
                confidence: pattern.confidence,
                source: 'pattern_analysis'
            });
        });

        // Learn from gaps
        observationResult.gaps.forEach(gap => {
            learnings.push({
                type: 'gap_awareness',
                insight: `Need better handling for: ${gap.description}`,
                confidence: 0.7,
                source: 'gap_analysis'
            });
        });

        // Learn from key findings
        if (observationResult.keyFindings.length > 2) {
            learnings.push({
                type: 'multi_source_validation',
                insight: 'Multiple data sources improve response quality',
                confidence: 0.8,
                source: 'execution_analysis'
            });
        }

        return learnings;
    }

    /**
     * Identify potential improvements
     */
    identifyImprovements(observationResult) {
        const improvements = [];

        // Improve based on gaps
        observationResult.gaps.forEach(gap => {
            if (gap.type === 'missing_data') {
                improvements.push({
                    area: 'tool_reliability',
                    suggestion: `Implement fallback for ${gap.source}`,
                    priority: 'medium'
                });
            }
        });

        // Improve based on low finding count
        if (observationResult.keyFindings.length < 2) {
            improvements.push({
                area: 'information_gathering',
                suggestion: 'Use more diverse data sources',
                priority: 'high'
            });
        }

        return improvements;
    }

    /**
     * Calculate overall confidence score
     */
    calculateConfidence(observationResult) {
        const findingsWeight = 0.4;
        const patternsWeight = 0.3;
        const gapsWeight = 0.3;

        const findingsScore = Math.min(1.0, observationResult.keyFindings.length / 3);
        const patternsScore = Math.min(1.0, observationResult.patterns.length / 2);
        const gapsScore = Math.max(0.0, 1.0 - (observationResult.gaps.length / 3));

        return (findingsScore * findingsWeight) +
            (patternsScore * patternsWeight) +
            (gapsScore * gapsWeight);
    }

    /**
     * Build response generation prompt
     */
    buildResponsePrompt(reflectionResult) {
        return `Based on my comprehensive analysis and reflection, I need to provide a helpful response to the farmer.

ANALYSIS SUMMARY:
- Effectiveness: ${(reflectionResult.effectiveness * 100).toFixed(0)}%
- Confidence: ${(reflectionResult.confidence * 100).toFixed(0)}%
- Key Learnings: ${reflectionResult.learnings.length} insights gained
- Improvements Identified: ${reflectionResult.improvements.length} areas

RESPONSE REQUIREMENTS:
1. Be practical and actionable
2. Address the farmer's specific needs
3. Include relevant data and insights
4. Provide clear next steps
5. Acknowledge any limitations or uncertainties

Please provide a comprehensive, helpful response that demonstrates the depth of analysis while remaining accessible to farmers.`;
    }

    /**
     * Format reasoning trace for display
     */
    formatReasoningTrace(reflectionResult) {
        return {
            effectiveness: reflectionResult.effectiveness,
            confidence: reflectionResult.confidence,
            learnings: reflectionResult.learnings,
            improvements: reflectionResult.improvements
        };
    }

    /**
     * Format execution steps for display
     */
    formatExecutionSteps(reflectionResult) {
        return [
            { step: 'Reasoning', status: 'completed', insights: reflectionResult.learnings.length },
            { step: 'Execution', status: 'completed', effectiveness: reflectionResult.effectiveness },
            { step: 'Observation', status: 'completed', patterns: reflectionResult.learnings.filter(l => l.type === 'pattern_recognition').length },
            { step: 'Reflection', status: 'completed', confidence: reflectionResult.confidence },
            { step: 'Response', status: 'completed', improvements: reflectionResult.improvements.length }
        ];
    }

    /**
     * Assess plan confidence
     */
    assessPlanConfidence(plan) {
        let confidence = 0.5; // Base confidence

        // Increase confidence based on plan structure
        if (plan.actions.length >= 2) confidence += 0.2;
        if (plan.objective) confidence += 0.1;
        if (plan.actions.some(a => a.type === 'tool_use')) confidence += 0.1;
        if (plan.actions.some(a => a.type === 'reasoning')) confidence += 0.1;

        return Math.min(1.0, confidence);
    }

    /**
     * Error handling with graceful degradation
     */
    async handleError(error, query, context, reasoningCallback) {
        reasoningCallback({
            id: 'error',
            title: '⚠️ Error Recovery',
            description: 'Providing fallback response',
            status: 'completed',
            duration: 300
        });

        try {
            // Attempt simplified response using basic Groq functionality
            const fallbackResponse = await this.groq.generateFarmingAdvice(
                `The user asked: "${query}". Please provide a helpful farming response despite technical limitations.`,
                { model: 'qwen2.5:3b', maxTokens: 800, temperature: 0.3 }
            );

            return {
                content: fallbackResponse.advice || "I apologize, but I'm experiencing technical difficulties. Please try rephrasing your question.",
                reasoning: { error: error.message, recovery: 'fallback_mode' },
                confidence: 0.3,
                toolsUsed: [],
                metadata: {
                    threadId: context.threadId || 'default',
                    error: true,
                    recovery: 'graceful_degradation'
                }
            };

        } catch (fallbackError) {
            console.error('❌ Fallback also failed:', fallbackError);

            return {
                content: "I'm currently experiencing technical difficulties. Please ensure your connection is stable and try again. If the problem persists, please restart the application.",
                reasoning: { error: error.message, fallbackError: fallbackError.message },
                confidence: 0.1,
                toolsUsed: [],
                metadata: {
                    threadId: context.threadId || 'default',
                    error: true,
                    recovery: 'hard_fallback'
                }
            };
        }
    }

    /**
     * Get agent status and capabilities
     */
    async getStatus() {
        const groqStatus = await this.groq.getStatus();

        return {
            agentName: this.agentPersona.name,
            isAvailable: groqStatus.isAvailable,
            capabilities: this.agentPersona.expertise,
            reasoningStyle: this.agentPersona.reasoning_style,
            activeThreads: this.conversationHistory.size,
            currentTask: this.agentState.currentTask,
            lastUpdate: new Date().toISOString(),
            groqStatus: groqStatus
        };
    }

    /**
     * Clear conversation history for a thread
     */
    clearThread(threadId) {
        if (this.conversationHistory.has(threadId)) {
            this.conversationHistory.delete(threadId);
            return true;
        }
        return false;
    }

    /**
     * Get conversation history for a thread
     */
    getThreadHistory(threadId) {
        return this.conversationHistory.get(threadId) || null;
    }
}

export default AutonomousAgentService;
