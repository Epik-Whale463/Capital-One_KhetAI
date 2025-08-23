/**
 * Standardized Reasoning Animation Service for Khet AI
 * Provides consistent, pristine animations across all AI services
 */

class ReasoningAnimationService {
    // Enhanced animation timings for smoother user experience with increased latency
    static TIMINGS = {
        INSTANT: 100,    // Ultra-fast micro-interactions (increased from 50ms)
        MICRO: 250,      // Smooth micro-animations (increased from 150ms)
        FAST: 450,       // Quick, snappy operations (increased from 250ms)
        NORMAL: 700,     // Standard operations with smooth feel (increased from 400ms)
        SLOW: 1000,      // Complex operations, still responsive (increased from 600ms)
        VERY_SLOW: 1400, // Heavy operations (increased from 900ms)
        STAGGER: 120,    // Stagger delay between step animations (increased from 80ms)
        PULSE: 1500,     // Breathing pulse animation (increased from 1200ms)
        TRANSITION: 500, // Smooth state transitions (increased from 320ms)
        STATUS_TRANSITION: 350, // Dedicated timing for status changes
        FADE_TRANSITION: 400    // Smooth fade transitions between states
    };

    // Standard step IDs for consistent animation flow
    static STEP_IDS = {
        UNDERSTAND: 'understand',
        TOOLS: 'tools',
        ANALYSIS: 'analysis',
        REASONING: 'reasoning',
        SYNTHESIS: 'synthesis',
        RESPONSE: 'response',
        TRANSLATE: 'translate',
        TTS: 'tts',
        STT: 'stt',
        ERROR: 'error'
    };

    // Enhanced animation phases with intermediate states
    static PHASES = {
        PENDING: 'pending',     // Step is queued
        STARTING: 'starting',   // Step is beginning (micro-transition)
        ACTIVE: 'active',       // Step is actively running
        PROCESSING: 'processing', // Heavy processing indicator
        FINISHING: 'finishing', // Step is completing (micro-transition)
        COMPLETED: 'completed', // Step is done
        ERROR: 'error',         // Step failed
        UNCERTAIN: 'uncertain', // Step has uncertain/conflicting data
        SKIPPED: 'skipped'      // Step was bypassed
    };

    // Icons for different step types (using Ionicons names)
    static ICONS = {
        UNDERSTAND: 'brain',
        TOOLS: 'settings',
        ANALYSIS: 'search',
        REASONING: 'bulb',
        SYNTHESIS: 'link',
        RESPONSE: 'chatbubble',
        TRANSLATE: 'globe',
        TTS: 'volume-high',
        STT: 'mic',
        ERROR: 'close-circle',
        SUCCESS: 'checkmark-circle'
    };

    /**
     * Create a standardized reasoning callback with consistent timing
     */
    static createCallback(userCallback = () => { }) {
        const activeSteps = new Map();

        return (step) => {
            // Validate step structure
            const validatedStep = this.validateStep(step);

            // Track timing for active steps
            if (validatedStep.status === this.PHASES.ACTIVE) {
                activeSteps.set(validatedStep.id, Date.now());
            } else if (validatedStep.status === this.PHASES.COMPLETED && activeSteps.has(validatedStep.id)) {
                // Calculate actual duration if not provided
                if (!validatedStep.duration) {
                    const startTime = activeSteps.get(validatedStep.id);
                    validatedStep.duration = Date.now() - startTime;
                }
                activeSteps.delete(validatedStep.id);
            }

            // Add timestamp
            validatedStep.timestamp = Date.now();

            // Call user callback with validated step
            userCallback(validatedStep);
        };
    }

    /**
     * Validate and standardize step structure
     */
    static validateStep(step) {
        // Ensure valid timestamp (13 digits for milliseconds since epoch)
        let timestamp = step.timestamp || Date.now();
        
        // Convert to number if it's a string
        if (typeof timestamp === 'string') {
            timestamp = parseInt(timestamp, 10);
        }
        
        // Validate timestamp range (must be 13 digits, between 2020-2030)
        if (typeof timestamp !== 'number' || 
            timestamp < 1577836800000 || // 2020-01-01
            timestamp > 1893456000000 || // 2030-01-01  
            timestamp.toString().length !== 13) {
            console.warn('Invalid timestamp detected, using current time:', timestamp);
            timestamp = Date.now();
        }
        
        // Fix common typos in step data
        const title = (step.title || step.tittle || 'Processing').toString();
        const id = (step.id || 'unknown').toString().replace(/ll$/, 'l'); // Fix "toolls" -> "tools"
        
        return {
            id: id,
            title: title,
            description: (step.description || 'Working...').toString(),
            status: step.status || this.PHASES.ACTIVE,
            duration: (typeof step.duration === 'number' && step.duration >= 0) ? step.duration : null,
            progress: (typeof step.progress === 'number' && step.progress >= 0 && step.progress <= 100) ? step.progress : null,
            icon: step.icon || this.getIconForStep(id),
            timestamp: timestamp
        };
    }

    /**
     * Get appropriate icon for step ID
     */
    static getIconForStep(stepId) {
        const upperStepId = stepId.toUpperCase();
        return this.ICONS[upperStepId] || 'settings';
    }

    /**
     * Enhanced Understanding Phase Animation with micro-transitions
     */
    static async animateUnderstanding(callback, query) {
        // Micro-transition: Step starting
        callback({
            id: this.STEP_IDS.UNDERSTAND,
            title: 'Reading Your Question',
            description: 'Initializing analysis...',
            status: this.PHASES.STARTING,
            icon: this.ICONS.UNDERSTAND
        });

        await this.delay(this.TIMINGS.MICRO);

        // Main active phase
        callback({
            id: this.STEP_IDS.UNDERSTAND,
            title: 'Understanding Question',
            description: query ? `Analyzing: "${query.slice(0, 50)}${query.length > 50 ? '...' : ''}"` : 'Analyzing your farming question and context',
            status: this.PHASES.ACTIVE,
            icon: this.ICONS.UNDERSTAND
        });

        // Simulate processing time with better pacing
        await this.delay(this.TIMINGS.NORMAL);

        // Micro-transition: Finishing
        callback({
            id: this.STEP_IDS.UNDERSTAND,
            title: 'Question Analyzed',
            description: 'Processing complete',
            status: this.PHASES.FINISHING,
            icon: this.ICONS.UNDERSTAND
        });

        await this.delay(this.TIMINGS.MICRO);

        // Completion
        callback({
            id: this.STEP_IDS.UNDERSTAND,
            title: 'Question Analyzed',
            description: 'Farming context and requirements identified',
            status: this.PHASES.COMPLETED,
            duration: this.TIMINGS.NORMAL + this.TIMINGS.MICRO * 2,
            icon: this.ICONS.SUCCESS
        });
    }

    /**
     * Enhanced Tools Phase Animation with progressive loading
     */
    static async animateToolsPhase(callback, toolsNeeded = []) {
        // Initial setup
        callback({
            id: this.STEP_IDS.TOOLS,
            title: 'Preparing Data Sources',
            description: 'Initializing...',
            status: this.PHASES.STARTING,
            icon: this.ICONS.TOOLS
        });

        await this.delay(this.TIMINGS.MICRO);

        callback({
            id: this.STEP_IDS.TOOLS,
            title: 'Checking Data Sources',
            description: 'Evaluating real-time data requirements',
            status: this.PHASES.ACTIVE,
            icon: this.ICONS.TOOLS
        });

        // Quick evaluation phase
        await this.delay(this.TIMINGS.FAST);

        if (toolsNeeded.length > 0) {
            // Progressive tool gathering with micro-feedback
            callback({
                id: this.STEP_IDS.TOOLS,
                title: 'Gathering Live Data',
                description: `Connecting to ${toolsNeeded.length} data source${toolsNeeded.length > 1 ? 's' : ''}...`,
                status: this.PHASES.PROCESSING,
                icon: this.ICONS.TOOLS,
                tools: toolsNeeded
            });

            // Simulate progressive data fetching
            await this.delay(this.TIMINGS.SLOW);

            // Show completion with details
            callback({
                id: this.STEP_IDS.TOOLS,
                title: 'Data Sources Connected',
                description: `Fresh data retrieved from ${toolsNeeded.join(', ')}`,
                status: this.PHASES.FINISHING,
                icon: this.ICONS.TOOLS,
                tools: toolsNeeded
            });

            await this.delay(this.TIMINGS.MICRO);

            callback({
                id: this.STEP_IDS.TOOLS,
                title: 'Data Collection Complete',
                description: `Live data ready for analysis`,
                status: this.PHASES.COMPLETED,
                duration: this.TIMINGS.SLOW + this.TIMINGS.FAST + this.TIMINGS.MICRO * 2,
                icon: this.ICONS.SUCCESS,
                tools: toolsNeeded
            });
        } else {
            // No tools needed path
            callback({
                id: this.STEP_IDS.TOOLS,
                title: 'Using Knowledge Base',
                description: 'No real-time data needed for this query',
                status: this.PHASES.COMPLETED,
                duration: this.TIMINGS.FAST + this.TIMINGS.MICRO,
                icon: this.ICONS.SUCCESS
            });
        }
    }

    /**
     * Standard Analysis Phase Animation
     */
    static async animateAnalysis(callback, analysisType = 'Agricultural Analysis') {
        callback({
            id: this.STEP_IDS.ANALYSIS,
            title: analysisType,
            description: 'Processing data with agricultural expertise',
            status: this.PHASES.ACTIVE,
            icon: this.ICONS.ANALYSIS
        });

        // Simulate analysis time
        await this.delay(this.TIMINGS.VERY_SLOW);

        callback({
            id: this.STEP_IDS.ANALYSIS,
            title: 'Analysis Complete',
            description: 'Insights and recommendations generated',
            status: this.PHASES.COMPLETED,
            duration: this.TIMINGS.VERY_SLOW,
            icon: this.ICONS.SUCCESS
        });
    }

    /**
     * Standard Reasoning Phase Animation
     */
    static async animateReasoning(callback, reasoningType = 'AI Reasoning') {
        callback({
            id: this.STEP_IDS.REASONING,
            title: reasoningType,
            description: 'Applying agricultural knowledge and logic',
            status: this.PHASES.ACTIVE,
            icon: this.ICONS.REASONING
        });

        // Simulate reasoning time
        await this.delay(this.TIMINGS.VERY_SLOW);

        callback({
            id: this.STEP_IDS.REASONING,
            title: 'Reasoning Complete',
            description: 'Personalized recommendations ready',
            status: this.PHASES.COMPLETED,
            duration: this.TIMINGS.VERY_SLOW,
            icon: this.ICONS.SUCCESS
        });
    }

    /**
     * Standard Response Phase Animation
     */
    static async animateResponse(callback, responseType = 'Crafting Response') {
        callback({
            id: this.STEP_IDS.RESPONSE,
            title: responseType,
            description: 'Formatting farmer-friendly advice',
            status: this.PHASES.ACTIVE,
            icon: this.ICONS.RESPONSE
        });

        // Simulate response formatting time
        await this.delay(this.TIMINGS.NORMAL);

        callback({
            id: this.STEP_IDS.RESPONSE,
            title: 'Response Ready',
            description: 'Personalized farming guidance prepared',
            status: this.PHASES.COMPLETED,
            duration: this.TIMINGS.NORMAL,
            icon: this.ICONS.SUCCESS
        });
    }

    /**
     * Standard Translation Phase Animation
     */
    static async animateTranslation(callback, fromLang, toLang) {
        callback({
            id: this.STEP_IDS.TRANSLATE,
            title: 'Translating Response',
            description: `Converting from ${fromLang} to ${toLang}`,
            status: this.PHASES.ACTIVE,
            icon: this.ICONS.TRANSLATE
        });

        // Simulate translation time
        await this.delay(this.TIMINGS.NORMAL);

        callback({
            id: this.STEP_IDS.TRANSLATE,
            title: 'Translation Complete',
            description: `Response ready in ${toLang}`,
            status: this.PHASES.COMPLETED,
            duration: this.TIMINGS.NORMAL,
            icon: this.ICONS.SUCCESS
        });
    }

    /**
     * Immediate Translation Animation (no delay)
     */
    static animateTranslationImmediate(callback, fromLang, toLang) {
        callback({
            id: this.STEP_IDS.TRANSLATE,
            title: 'Translating Response',
            description: `Converting from ${fromLang} to ${toLang}`,
            status: this.PHASES.ACTIVE,
            icon: this.ICONS.TRANSLATE
        });

        callback({
            id: this.STEP_IDS.TRANSLATE,
            title: 'Translation Complete',
            description: `Response ready in ${toLang}`,
            status: this.PHASES.COMPLETED,
            duration: this.TIMINGS.NORMAL,
            icon: this.ICONS.SUCCESS
        });
    }

    /**
     * Standard Error Animation
     */
    static animateError(callback, errorMessage = 'Processing failed') {
        callback({
            id: this.STEP_IDS.ERROR,
            title: 'Processing Error',
            description: errorMessage,
            status: this.PHASES.ERROR,
            icon: this.ICONS.ERROR
        });
    }

    /**
     * Complete Animation Sequence for Standard AI Processing
     */
    static async animateStandardSequence(callback, options = {}) {
        const {
            query = '',
            toolsNeeded = [],
            analysisType = 'Agricultural Analysis',
            reasoningType = 'AI Reasoning',
            responseType = 'Crafting Response',
            skipSteps = []
        } = options;

        try {
            // Step 1: Understanding (unless skipped)
            if (!skipSteps.includes('understand')) {
                await this.animateUnderstanding(callback, query);
            }

            // Step 2: Tools (unless skipped)
            if (!skipSteps.includes('tools')) {
                await this.animateToolsPhase(callback, toolsNeeded);
            }

            // Step 3: Analysis (unless skipped)
            if (!skipSteps.includes('analysis')) {
                await this.animateAnalysis(callback, analysisType);
            }

            // Step 4: Reasoning (unless skipped)
            if (!skipSteps.includes('reasoning')) {
                await this.animateReasoning(callback, reasoningType);
            }

            // Step 5: Response (unless skipped)
            if (!skipSteps.includes('response')) {
                await this.animateResponse(callback, responseType);
            }

        } catch (error) {
            this.animateError(callback, `Animation error: ${error.message}`);
        }
    }

    /**
     * Utility: Delay function for animation timing
     */
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Utility: Calculate progress percentage
     */
    static calculateProgress(currentStep, totalSteps) {
        return Math.round((currentStep / totalSteps) * 100);
    }

    /**
     * Utility: Format duration for display
     */
    static formatDuration(ms) {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    }

    /**
     * Create a progress-aware callback that tracks overall completion
     */
    static createProgressCallback(userCallback = () => { }, totalSteps = 5) {
        let currentStep = 0;
        const stepOrder = [
            this.STEP_IDS.UNDERSTAND,
            this.STEP_IDS.TOOLS,
            this.STEP_IDS.ANALYSIS,
            this.STEP_IDS.REASONING,
            this.STEP_IDS.RESPONSE
        ];

        return (step) => {
            // Calculate progress based on completed steps
            if (step.status === this.PHASES.COMPLETED) {
                const stepIndex = stepOrder.indexOf(step.id);
                if (stepIndex !== -1) {
                    currentStep = Math.max(currentStep, stepIndex + 1);
                }
            }

            // Add progress information
            const enhancedStep = {
                ...step,
                progress: this.calculateProgress(currentStep, totalSteps),
                overallProgress: `${currentStep}/${totalSteps}`
            };

            userCallback(enhancedStep);
        };
    }
}

export default ReasoningAnimationService;