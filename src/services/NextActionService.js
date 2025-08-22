/**
 * NextActionService
 * Central, data-driven prioritization of farmer guidance.
 * Order: criticalAlert > timeSensitiveTask > stageProactive > planningGap > gentleTip
 * No hardcoded dummy data: relies on real stored project workflows + weather service.
 */
import FarmerCropProjectsService from './FarmerCropProjectsService';
import WeatherToolsService from './WeatherToolsService';

class NextActionService {
	/**
	 * Compute global next action for the Home screen
	 * @param {string} userId
	 * @param {{latitude:number, longitude:number}|null} coordinates
	 * @returns {Promise<{text:string, loading:boolean, cropId?:string, priority?:string}>}
	 */
	static async computeGlobalNextAction(userId, coordinates) {
		try {
			if (!userId) return { text: 'Sign in to get personalized guidance.', loading: false };

			const projects = await FarmerCropProjectsService.getFarmerProjects(userId);
			const active = projects.filter(p => p.status === 'active');
			if (active.length === 0) return { text: 'Add a crop to start receiving next actions.', loading: false };

			let weather = null;
			if (coordinates?.latitude && coordinates?.longitude) {
				try {
					const w = await WeatherToolsService.getAgricultureWeather(coordinates.latitude, coordinates.longitude);
					if (w?.success) weather = w.current;
				} catch (e) { /* ignore weather failure */ }
			}

			// Priority chain
			const critical = this._criticalAlert(active, weather);
			if (critical) return critical;

			const timeSensitive = this._timeSensitiveTask(active);
			if (timeSensitive) return timeSensitive;

			const stageTask = this._stageProactive(active, weather);
			if (stageTask) return stageTask;

			const planningGap = this._planningGap(active);
			if (planningGap) return planningGap;

			return this._gentleTip(active);
		} catch (err) {
			console.error('NextActionService.computeGlobalNextAction error', err);
			return { text: 'Unable to compute next action now.', loading: false };
		}
	}

	/** Derive per-crop next task (for crop cards) */
	static deriveNextTask(project) {
		if (!project) return 'No data';

		// Alerts precedence
		const alerts = project.workflows?.alerts || [];
		const urgent = alerts.find(a => a.severity === 'critical' || a.severity === 'high');
		if (urgent) return `⚠️ ${urgent.message || 'Check alert'}`;
		if (alerts.length) return `${alerts.length} alert${alerts.length>1?'s':''}`;

		// Tasks
		const tasks = project.workflows?.tasks || [];
		const now = Date.now();
		const overdue = tasks.find(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate).getTime() < now);
		if (overdue) return `🔥 ${overdue.label}`;
		const todayIso = new Date().toISOString().split('T')[0];
		const dueToday = tasks.find(t => t.status !== 'completed' && t.dueDate && t.dueDate.startsWith(todayIso));
		if (dueToday) return `📅 ${dueToday.label}`;

		// Stage suggestion
		const stage = project.cropDetails?.growthStage || 'planning';
		const map = {
			planning: 'Set planting date',
			sowing: 'Monitor germination',
			vegetative: 'Check weeds & nutrients',
			flowering: 'Monitor pollination',
			fruiting: 'Nutrient spray plan',
			maturity: 'Prepare harvest',
			harvest: 'Record yield',
			postharvest: 'Store & dry produce'
		};
		return map[stage] || 'Review crop status';
	}

	// --- Private prioritization helpers ---
	static _criticalAlert(projects, weather) {
		// Stored alerts first
		for (const p of projects) {
			const alerts = p.workflows?.alerts || [];
			const crit = alerts.find(a => a.severity === 'critical' || a.type === 'disease_risk' || a.type === 'severe_weather');
			if (crit) return { text: `URGENT: ${crit.message || `Issue in ${p.cropName}`}`, loading: false, cropId: p.id, priority: 'critical' };
		}
		if (weather) {
			const primary = projects[0];
			if (weather.temp > 42) return { text: `CRITICAL: ${Math.round(weather.temp)}°C heat stress. Shade/irrigate ${primary.cropName}.`, loading: false, cropId: primary.id, priority: 'critical' };
			if (weather.humidity > 90 && ['flowering','fruiting'].includes(primary.cropDetails?.growthStage)) {
				return { text: `High disease risk for ${primary.cropName} (humidity ${weather.humidity}%). Inspect foliage.`, loading: false, cropId: primary.id, priority: 'critical' };
			}
		}
		return null;
	}

	static _timeSensitiveTask(projects) {
		const now = Date.now();
		const today = new Date().toISOString().split('T')[0];
		for (const p of projects) {
			const tasks = p.workflows?.tasks || [];
			const overdue = tasks.find(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate).getTime() < now);
			if (overdue) {
				const days = Math.floor((now - new Date(overdue.dueDate).getTime()) / 86400000);
				return { text: `Overdue: ${overdue.label} for ${p.cropName} (${days}d)`, loading: false, cropId: p.id, priority: 'urgent' };
			}
			const dueToday = tasks.find(t => t.status !== 'completed' && t.dueDate && t.dueDate.startsWith(today));
			if (dueToday) return { text: `Due today: ${dueToday.label} (${p.cropName})`, loading: false, cropId: p.id, priority: 'urgent' };
		}
		return null;
	}

	static _stageProactive(projects, weather) {
		const stageOrder = ['sowing','vegetative','flowering','fruiting','maturity','harvest'];
		const sorted = [...projects].sort((a,b)=> stageOrder.indexOf(a.cropDetails?.growthStage) - stageOrder.indexOf(b.cropDetails?.growthStage));
		const primary = sorted[0];
		if (!primary) return null;
		const stage = primary.cropDetails?.growthStage;
		if (weather) {
			if (weather.humidity < 45 && ['vegetative','flowering','fruiting'].includes(stage)) {
				return { text: `Irrigate ${primary.cropName} soon (humidity ${weather.humidity}%)`, loading: false, cropId: primary.id, priority: 'proactive' };
			}
			if (weather.humidity > 80 && stage === 'vegetative') {
				return { text: `Scout ${primary.cropName} for pests (humid conditions)`, loading: false, cropId: primary.id, priority: 'proactive' };
			}
			if (weather.temp > 35 && stage !== 'harvest') {
				return { text: `Prepare heat mitigation for ${primary.cropName} (${Math.round(weather.temp)}°C)`, loading: false, cropId: primary.id, priority: 'proactive' };
			}
		}
		const map = {
			sowing: `Check germination for ${primary.cropName}`,
			vegetative: `Plan weeding/nutrient top-dress for ${primary.cropName}`,
			flowering: `Monitor pollination & flower drop (${primary.cropName})`,
			fruiting: `Balance nutrient spray for ${primary.cropName}`,
			maturity: `Line up harvest labour & crates (${primary.cropName})`,
			harvest: `Record yield & storage plan (${primary.cropName})`
		};
		return { text: map[stage] || `Review status of ${primary.cropName}` , loading:false, cropId: primary.id, priority: 'proactive' };
	}

	static _planningGap(projects) {
		const planting = projects.find(p => p.cropDetails?.growthStage === 'planning' && !p.cropDetails?.plantingDate);
		if (planting) return { text: `Set planting date for ${planting.cropName} to optimize season start`, loading:false, cropId: planting.id, priority: 'planning' };
		const noStage = projects.find(p => !p.cropDetails?.growthStage);
		if (noStage) return { text: `Update growth stage for ${noStage.cropName} for better guidance`, loading:false, cropId: noStage.id, priority: 'planning' };
		return null;
	}

	static _gentleTip(projects) {
		const tips = [
			'Capture a photo to build disease prevention history',
			'Review notes to spot growth trends',
			'Check market prices for upcoming sales',
			'Plan next spray schedule based on current stage',
			'Explore government support schemes available now'
		];
		return { text: tips[Math.floor(Math.random()*tips.length)], loading:false, priority:'tip' };
	}
}

export default NextActionService;

