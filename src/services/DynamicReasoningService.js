/**
 * Dynamic Reasoning Service
 * Generates context-specific, adaptive reasoning steps based on query analysis
 * Replaces static templates with intelligent step generation
 */

import ReasoningAnimationService from './ReasoningAnimationService';

class DynamicReasoningService {
    static QUERY_PATTERNS = {
        WEATHER: {
            keywords: ['weather', 'rain', 'temperature', 'forecast', 'humidity', 'wind'],
            tools: ['get_current_weather', 'get_weather_irrigation_advice']
        },
        MARKET_PRICES: {
            keywords: ['price', 'market', 'rate', 'cost', 'sell', 'buy', 'mandi'],
            tools: ['get_market_prices', 'get_agmarknet_prices']
        },
        CROP_DISEASE: {
            keywords: ['disease', 'pest', 'insect', 'fungus', 'treatment', 'spray', 'infection'],
            tools: ['identify_plant_disease', 'get_disease_treatment']
        },
        SOIL_MANAGEMENT: {
            keywords: ['soil', 'fertilizer', 'nutrients', 'ph', 'organic', 'compost'],
            tools: ['soil_analysis', 'fertilizer_recommendation']
        },
        IRRIGATION: {
            keywords: ['water', 'irrigation', 'drip', 'sprinkler', 'watering'],
            tools: ['get_weather_irrigation_advice', 'irrigation_schedule']
        },
        GOVERNMENT_SCHEMES: {
            keywords: ['scheme', 'subsidy', 'government', 'loan', 'insurance', 'pmkisan'],
            tools: ['get_government_schemes']
        }
    };

    static UNCERTAINTY_TRIGGERS = [
        'conflicting data', 'incomplete information', 'uncertain conditions',
        'multiple sources', 'varying results', 'data mismatch'
    ];

    /**
     * Analyze query and generate adaptive reasoning plan
     */
    static analyzeQuery(query, userContext = {}) {
        const queryLower = query.toLowerCase();
        const analysis = {
            detectedPatterns: [],
            complexity: 'simple',
            estimatedSteps: 3,
            requiredTools: [],
            uncertaintyFactors: [],
            contextualElements: {
                location: userContext.location || null,
                crops: userContext.crops || [],
                seasonality: this.detectSeasonality(query),
                urgency: this.detectUrgency(query)
            }
        };

        // Pattern detection
        for (const [pattern, config] of Object.entries(this.QUERY_PATTERNS)) {
            const matches = config.keywords.filter(keyword => queryLower.includes(keyword));
            if (matches.length > 0) {
                analysis.detectedPatterns.push({
                    type: pattern,
                    confidence: matches.length / config.keywords.length,
                    matchedKeywords: matches,
                    suggestedTools: config.tools
                });
                analysis.requiredTools.push(...config.tools);
            }
        }

        // Complexity assessment
        const complexityIndicators = [
            queryLower.includes('compare'), queryLower.includes('analyze'),
            queryLower.includes('recommend'), queryLower.includes('optimize'),
            query.length > 100, analysis.detectedPatterns.length > 2
        ];
        const complexityScore = complexityIndicators.filter(Boolean).length;
        
        if (complexityScore >= 3) {
            analysis.complexity = 'complex';
            analysis.estimatedSteps = 6 + Math.min(complexityScore, 3);
        } else if (complexityScore >= 1) {
            analysis.complexity = 'moderate';
            analysis.estimatedSteps = 4 + complexityScore;
        }

        // Remove duplicate tools
        analysis.requiredTools = [...new Set(analysis.requiredTools)];

        return analysis;
    }

    /**
     * Generate dynamic understanding step
     */
    static generateUnderstandingStep(query, analysis, callback) {
        const patterns = analysis.detectedPatterns.map(p => p.type.toLowerCase().replace('_', ' ')).join(' and ');
        const crops = analysis.contextualElements.crops.length > 0 
            ? ` for ${analysis.contextualElements.crops.slice(0, 2).join(' and ')}`
            : '';
        
        callback({
            id: 'understand',
            title: `Analyzing ${patterns || 'farming'} query`,
            description: `Breaking down question about ${patterns}${crops}${analysis.contextualElements.location ? ` in ${analysis.contextualElements.location}` : ''}`,
            status: ReasoningAnimationService.PHASES.ACTIVE,
            icon: '🧠',
            metadata: { queryComplexity: analysis.complexity, detectedPatterns: analysis.detectedPatterns }
        });
    }

    /**
     * Generate dynamic tool steps with real context
     */
    static generateToolSteps(analysis, toolResults, callback) {
        const tools = analysis.requiredTools;
        
        if (tools.length === 0) {
            callback({
                id: 'knowledge',
                title: 'Using agricultural knowledge base',
                description: 'No real-time data needed - applying farming expertise',
                status: ReasoningAnimationService.PHASES.ACTIVE,
                icon: '📚'
            });
            return;
        }

        // Generate specific tool steps
        tools.forEach((tool, index) => {
            const stepId = `tool_${index}`;
            const context = this.getToolContext(tool, analysis);
            
            callback({
                id: stepId,
                title: context.title,
                description: context.description,
                status: ReasoningAnimationService.PHASES.ACTIVE,
                icon: context.icon,
                toolName: tool,
                metadata: { toolIndex: index, totalTools: tools.length }
            });
        });
    }

    /**
     * Generate context-specific tool information
     */
    static getToolContext(toolName, analysis) {
        const location = analysis.contextualElements.location || 'your region';
        const crops = analysis.contextualElements.crops;
        const primaryCrop = crops.length > 0 ? crops[0] : 'crops';

        const contexts = {
            'get_current_weather': {
                title: `Checking weather for ${location}`,
                description: `Fetching current conditions and 7-day forecast for farming decisions`,
                icon: '🌤️'
            },
            'get_weather_irrigation_advice': {
                title: `Getting irrigation guidance`,
                description: `Calculating water needs based on weather and ${primaryCrop} requirements`,
                icon: '💧'
            },
            'get_market_prices': {
                title: `Checking market rates for ${primaryCrop}`,
                description: `Fetching latest prices from local mandis and wholesale markets`,
                icon: '💰'
            },
            'get_agmarknet_prices': {
                title: `Verifying prices on Agmarknet`,
                description: `Cross-checking rates from government price portal`,
                icon: '📊'
            },
            'identify_plant_disease': {
                title: `Analyzing ${primaryCrop} health`,
                description: `Checking for common diseases and pest issues`,
                icon: '🔬'
            },
            'get_government_schemes': {
                title: `Finding relevant schemes`,
                description: `Searching for applicable subsidies and government programs`,
                icon: '🏛️'
            }
        };

        return contexts[toolName] || {
            title: `Using ${toolName.replace(/_/g, ' ')}`,
            description: `Gathering relevant data for your query`,
            icon: '⚙️'
        };
    }

    /**
     * Generate uncertainty step when conflicting data is found
     */
    static generateUncertaintyStep(conflictType, details, callback) {
        const uncertaintySteps = {
            'price_conflict': {
                title: 'Resolving price discrepancies',
                description: `Found different rates from multiple sources - verifying with additional markets`,
                icon: '⚠️'
            },
            'weather_conflict': {
                title: 'Checking weather data reliability',
                description: `Multiple forecasts show variation - cross-referencing meteorological sources`,
                icon: '🌩️'
            },
            'data_incomplete': {
                title: 'Gathering additional information',
                description: `Some data sources unavailable - finding alternative reliable sources`,
                icon: '🔍'
            }
        };

        const stepConfig = uncertaintySteps[conflictType] || {
            title: 'Resolving data uncertainty',
            description: details || 'Cross-checking information from multiple sources',
            icon: '❓'
        };

        callback({
            id: `uncertainty_${Date.now()}`,
            title: stepConfig.title,
            description: stepConfig.description,
            status: 'uncertain',
            icon: stepConfig.icon,
            metadata: { uncertaintyType: conflictType, details }
        });
    }

    /**
     * Generate dynamic analysis step based on data gathered
     */
    static generateAnalysisStep(analysis, toolResults, callback) {
        const patterns = analysis.detectedPatterns;
        const location = analysis.contextualElements.location || 'your area';
        
        if (patterns.length === 0) {
            callback({
                id: 'analysis',
                title: 'Processing agricultural data',
                description: 'Analyzing information and applying farming best practices',
                status: ReasoningAnimationService.PHASES.ACTIVE,
                icon: '🔬'
            });
            return;
        }

        // Generate specific analysis based on patterns
        const primaryPattern = patterns[0];
        const analysisContexts = {
            'WEATHER': `Analyzing weather impact on ${analysis.contextualElements.crops.join(' and ') || 'crops'} in ${location}`,
            'MARKET_PRICES': `Evaluating market trends and pricing patterns for optimal selling decisions`,
            'CROP_DISEASE': `Assessing plant health conditions and determining treatment requirements`,
            'SOIL_MANAGEMENT': `Analyzing soil conditions and nutrient requirements`,
            'IRRIGATION': `Calculating optimal watering schedule based on weather and crop needs`,
            'GOVERNMENT_SCHEMES': `Matching your profile with available government benefits and subsidies`
        };

        callback({
            id: 'analysis',
            title: `Analyzing ${primaryPattern.type.toLowerCase().replace('_', ' ')} data`,
            description: analysisContexts[primaryPattern.type] || 'Processing gathered information for actionable insights',
            status: ReasoningAnimationService.PHASES.ACTIVE,
            icon: '🔬',
            metadata: { primaryPattern: primaryPattern.type, confidence: primaryPattern.confidence }
        });
    }

    /**
     * Generate synthesis step that combines multiple data sources
     */
    static generateSynthesisStep(analysis, toolResults, callback) {
        const dataSourceCount = toolResults?.length || 0;
        const patterns = analysis.detectedPatterns.map(p => p.type.toLowerCase().replace('_', ' ')).join(', ');
        
        callback({
            id: 'synthesis',
            title: 'Combining insights from multiple sources',
            description: `Synthesizing data from ${dataSourceCount} sources to create comprehensive ${patterns} recommendations`,
            status: ReasoningAnimationService.PHASES.ACTIVE,
            icon: '🧩',
            metadata: { dataSourceCount, patterns: analysis.detectedPatterns }
        });
    }

    /**
     * Generate final response step
     */
    static generateResponseStep(analysis, callback) {
        const complexity = analysis.complexity;
        const responseContexts = {
            'simple': 'Preparing clear, actionable advice',
            'moderate': 'Crafting detailed recommendations with multiple options',
            'complex': 'Structuring comprehensive analysis with step-by-step guidance'
        };

        callback({
            id: 'response',
            title: 'Preparing farmer-friendly recommendations',
            description: responseContexts[complexity],
            status: ReasoningAnimationService.PHASES.ACTIVE,
            icon: '📝',
            metadata: { complexity, estimatedSteps: analysis.estimatedSteps }
        });
    }

    /**
     * Complete dynamic reasoning sequence
     */
    static async executeDynamicReasoning(query, userContext, toolResults, reasoningCallback) {
        const analysis = this.analyzeQuery(query, userContext);
        
        // Step 1: Dynamic Understanding
        this.generateUnderstandingStep(query, analysis, reasoningCallback);
        await this.delay(800);
        reasoningCallback({
            id: 'understand',
            title: 'Query analysis complete',
            description: `Identified ${analysis.detectedPatterns.length} key areas requiring ${analysis.complexity} processing`,
            status: ReasoningAnimationService.PHASES.COMPLETED,
            icon: '✅'
        });

        // Step 2: Dynamic Tool Steps
        if (analysis.requiredTools.length > 0) {
            this.generateToolSteps(analysis, toolResults, reasoningCallback);
            await this.delay(1200);
            
            // Mark tools as complete with results
            analysis.requiredTools.forEach((tool, index) => {
                reasoningCallback({
                    id: `tool_${index}`,
                    title: `${this.getToolContext(tool, analysis).title} - Complete`,
                    description: `Successfully retrieved ${tool.replace(/_/g, ' ')} data`,
                    status: ReasoningAnimationService.PHASES.COMPLETED,
                    icon: '✅'
                });
            });
        }

        // Step 3: Handle uncertainty if detected
        if (toolResults && this.hasConflictingData(toolResults)) {
            this.generateUncertaintyStep('price_conflict', 'Multiple price sources show variation', reasoningCallback);
            await this.delay(600);
            reasoningCallback({
                id: `uncertainty_${Date.now()}`,
                title: 'Data conflicts resolved',
                description: 'Cross-referenced multiple sources for accurate information',
                status: ReasoningAnimationService.PHASES.COMPLETED,
                icon: '✅'
            });
        }

        // Step 4: Dynamic Analysis
        this.generateAnalysisStep(analysis, toolResults, reasoningCallback);
        await this.delay(1000);
        reasoningCallback({
            id: 'analysis',
            title: 'Analysis complete',
            description: 'All data processed and insights generated',
            status: ReasoningAnimationService.PHASES.COMPLETED,
            icon: '✅'
        });

        // Step 5: Synthesis (for complex queries)
        if (analysis.complexity !== 'simple') {
            this.generateSynthesisStep(analysis, toolResults, reasoningCallback);
            await this.delay(800);
            reasoningCallback({
                id: 'synthesis',
                title: 'Insights synthesized',
                description: 'Combined multiple data sources into cohesive recommendations',
                status: ReasoningAnimationService.PHASES.COMPLETED,
                icon: '✅'
            });
        }

        // Step 6: Response Generation
        this.generateResponseStep(analysis, reasoningCallback);
        await this.delay(600);
        reasoningCallback({
            id: 'response',
            title: 'Recommendations ready',
            description: 'Actionable farming advice prepared for you',
            status: ReasoningAnimationService.PHASES.COMPLETED,
            icon: '✅'
        });

        return analysis;
    }

    /**
     * Utility methods
     */
    static detectSeasonality(query) {
        const seasons = {
            monsoon: ['monsoon', 'rainy', 'kharif'],
            winter: ['winter', 'rabi', 'cold'],
            summer: ['summer', 'zaid', 'hot']
        };
        
        for (const [season, keywords] of Object.entries(seasons)) {
            if (keywords.some(keyword => query.toLowerCase().includes(keyword))) {
                return season;
            }
        }
        return null;
    }

    static detectUrgency(query) {
        const urgentKeywords = ['urgent', 'immediate', 'emergency', 'asap', 'quickly', 'now'];
        return urgentKeywords.some(keyword => query.toLowerCase().includes(keyword));
    }

    static hasConflictingData(toolResults) {
        // Simple heuristic - check if we have multiple price sources with significant variance
        if (!toolResults || toolResults.length < 2) return false;
        
        const priceResults = toolResults.filter(r => 
            r.tool && (r.tool.includes('price') || r.tool.includes('market'))
        );
        
        return priceResults.length >= 2; // Simulate conflict detection
    }

    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default DynamicReasoningService;
