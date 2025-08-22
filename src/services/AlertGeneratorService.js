/**
 * AlertGeneratorService
 * Lightweight dynamic alert derivation (no dummy hardcoded display data) based on real project state + weather.
 */
import FarmerCropProjectsService from './FarmerCropProjectsService';
import WeatherToolsService from './WeatherToolsService';
import GroqAIService from './GroqAIService';

class AlertGeneratorService {
  /** Generate / refresh alerts for all active projects */
  static async refreshAlerts(userId, coordinates) {
    if (!userId) return [];
    const projects = await FarmerCropProjectsService.getFarmerProjects(userId);
    const active = projects.filter(p => p.status === 'active');

  let weather = null;
  let daily = null;
    if (coordinates?.latitude && coordinates?.longitude) {
      try {
    const w = await WeatherToolsService.getAgricultureWeather(coordinates.latitude, coordinates.longitude);
    if (w?.success) { weather = w.current; daily = w.daily; }
      } catch (e) { /* non-blocking */ }
    }

  const updated = [];
  // Prepare Groq service once (LLM summaries). If it fails, we still keep alerts without summaries.
  let groq = null;
  try { groq = GroqAIService.getInstance(); } catch (e) { groq = null; }
    for (const p of active) {
      const alerts = p.workflows?.alerts || [];
      const existingKeys = new Set(alerts.map(a => a.key));
      const newAlerts = [];

  // Severe heat
      if (weather?.temp > 40) {
        const key = `heat_${new Date().toISOString().split('T')[0]}`;
        if (!existingKeys.has(key)) {
          newAlerts.push({
            id: Date.now().toString()+Math.random(),
            key,
            type: 'severe_weather',
            severity: weather.temp > 44 ? 'critical' : 'high',
    message: `High heat stress (${Math.round(weather.temp)}°C) for ${p.cropName}. Irrigate / shade mid-day.`,
            createdAt: new Date().toISOString()
          });
        }
      }

  // Humidity disease risk + broader pest risk (include vegetative high humidity & low wind stagnation)
  if (weather?.humidity > 85 && ['vegetative','flowering','fruiting'].includes(p.cropDetails?.growthStage)) {
        const key = `humidityDisease_${new Date().toISOString().split('T')[0]}`;
        if (!existingKeys.has(key)) {
          newAlerts.push({
            id: Date.now().toString()+Math.random(),
            key,
            type: 'disease_risk',
            severity: 'high',
    message: `High disease/pest risk (humidity ${weather.humidity}%). Scout ${p.cropName} foliage now.`,
            createdAt: new Date().toISOString()
          });
        }
      }

      // Overdue task
      const tasks = p.workflows?.tasks || [];
      const now = Date.now();
      const overdue = tasks.find(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate).getTime() < now);
      if (overdue) {
        const key = `task_${overdue.id}`;
        if (!existingKeys.has(key)) {
          newAlerts.push({
            id: Date.now().toString()+Math.random(),
            key,
            type: 'task_overdue',
            severity: 'medium',
            message: `Overdue: ${overdue.label} for ${p.cropName}.`,
            createdAt: new Date().toISOString()
          });
        }
      }

      // Rainfall deficit / excess (use next 3 day forecast aggregate if available)
      if (daily && daily.length) {
        const todayKey = new Date().toISOString().split('T')[0];
        const next3 = daily.slice(0,3);
        // approximate rain mm if available
        const totalRain = next3.reduce((sum,d)=> sum + (typeof d.rain === 'number' ? d.rain : (d.rain?.['1h']||0)),0);
        if (totalRain < 2) {
          const key = `rain_deficit_${todayKey}`;
            if (!existingKeys.has(key)) {
            newAlerts.push({
              id: Date.now().toString()+Math.random(),
              key,
              type: 'rain_deficit',
              severity: 'medium',
              message: `Low rainfall expected next 3 days (<2mm). Plan irrigation for ${p.cropName}.`,
              createdAt: new Date().toISOString()
            });
          }
        } else if (totalRain > 25) {
          const key = `rain_excess_${todayKey}`;
          if (!existingKeys.has(key)) {
            newAlerts.push({
              id: Date.now().toString()+Math.random(),
              key,
              type: 'rain_excess',
              severity: totalRain > 40 ? 'high' : 'medium',
              message: `Heavy rain (~${Math.round(totalRain)}mm) coming. Improve drainage for ${p.cropName}.`,
              createdAt: new Date().toISOString()
            });
          }
        }
      }

      // Extreme wind risk (spray drift)
      if (weather?.wind_speed && weather.wind_speed > 8) { // m/s (~28 km/h)
        const key = `wind_${new Date().toISOString().split('T')[0]}`;
        if (!existingKeys.has(key)) {
          newAlerts.push({
            id: Date.now().toString()+Math.random(),
            key,
            type: 'wind_risk',
            severity: weather.wind_speed > 12 ? 'high' : 'medium',
            message: `Strong winds (${Math.round(weather.wind_speed*3.6)} km/h). Delay spraying ${p.cropName}.`,
            createdAt: new Date().toISOString()
          });
        }
      }

      // Sowing window closing (planning stage with no plantingDate and approaching seasonal cut-off heuristic)
      if (p.cropDetails?.growthStage === 'planning' && !p.cropDetails?.plantingDate) {
        const month = new Date().getMonth(); // 0-11
        const lateKharif = month >= 7 && month <= 8; // Aug-Sep start risk
        if (lateKharif) {
          const key = `sowing_window_${new Date().toISOString().split('T')[0]}`;
          if (!existingKeys.has(key)) {
            newAlerts.push({
              id: Date.now().toString()+Math.random(),
              key,
              type: 'sowing_window',
              severity: 'medium',
              message: `Sowing window closing. Set planting date for ${p.cropName}.`,
              createdAt: new Date().toISOString()
            });
          }
        }
      }

      if (newAlerts.length) {
        // Generate concise AI summaries (5-10 words) for each new alert using real alert context
	if (groq?.isAvailable) {
          for (const alert of newAlerts) {
            try {
	  const prompt = `Return ONLY a concise imperative summary (5-10 words) for this farm alert. No punctuation at end, no extra text.\nAlert: ${alert.message}\nCrop: ${p.cropName}\nSummary:`;
	  const raw = await groq.callGroq(
                groq.models?.lightweight || groq.models?.chat,
                '',
                prompt,
                { maxTokens: 18, disableReasoning: true, temperature: 0.2, retries: 2, retryDelayMs: 700, timeoutMs: 10000 }
              );
              if (raw && typeof raw === 'string') {
                let cleaned = raw.replace(/^["']|["']$/g,'').replace(/\s+/g,' ').trim();
                cleaned = cleaned.replace(/^(alert|notification|update|note)[:\-\s]+/i,'');
                // Slice to max 10 words; if outside 5-10 range we discard to avoid manufactured fallback
                const words = cleaned.split(' ').filter(Boolean);
                if (words.length >= 5) {
                  cleaned = words.slice(0,10).join(' ');
                  alert.aiSummary = cleaned;
                }
              }
            } catch (e) {
              // On failure: no summary set (no fallback allowed)
            }
          }
        }
        const merged = { ...p, workflows: { ...p.workflows, alerts: [...newAlerts, ...alerts].slice(0,50) } };
        await FarmerCropProjectsService.updateProject(p.id, { workflows: merged.workflows });
        updated.push({ projectId: p.id, added: newAlerts.length });
      }
    }
    return updated;
  }
}

export default AlertGeneratorService;
