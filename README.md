# KhetAI Mobile & Web

Professional, AI‑augmented agriculture assistant: real‑time market data, weather, crop insights, news, autonomous reasoning chains, tool orchestration, and safety filtering, packaged as an Expo (React Native) application with optional web export and Android distribution.

---

## Core Value

Provide farmers, agronomists, and demo stakeholders with an integrated, explainable AI system that:

- Answers agriculture & context questions via Groq LLM + live tool data
- Surfaces commodity prices (Agmarknet / data.gov.in), weather, and news
- Generates next actions, alerts, and project tracking insights
- Demonstrates transparent multi‑phase reasoning (Understanding → Tools → Analysis → Response)

---

## High‑Level Architecture

<img width="983" height="473" alt="image" src="https://github.com/user-attachments/assets/f970948e-d693-4912-bc7a-2abe3e8983af" />


```text
+------------------+        +-----------------------+        +--------------------+
|  UI (Screens &   |  uses  |   Services Layer      |  calls | External Providers  |
|  Components)     +------->+  (Domain + Integr.)   +------->+  (APIs / Models)    |
|  Chat, News,     |        |  GroqAI, Tools, Data  |        |  Groq, Weather,     |
|  Crop Projects   |        |  Orchestration        |        |  Agmarknet, News    |
+---------+--------+        +-----------+-----------+        +---------+----------+
          ^                             |                              |
          | context / events            | telemetry / safety           |
          |                             v                              v
          |                 +--------------------+         +--------------------+
          |                 |  Safety & Filtering|         |  Telemetry / Logs  |
          |                 +--------------------+         +--------------------+
          |                             ^                              
          +-----------------------------+ (Reasoning Steps callbacks)
```

## Key Features

| Domain | Capability | Description |
|--------|------------|-------------|
| Conversational AI | Multi‑phase reasoning | Animation + structured steps (Understanding, Tools, Analysis, Response) via `ReasoningAnimationService` & callbacks. |
| Conversational AI | Tool‑enhanced replies | `AgentToolsService` aggregates weather, prices, news, plant health, etc. before LLM synthesis. |
| AI Models | Groq cloud integration | `GroqAIService` central model selection (full vs lightweight) + key validation & status. |
| AI Models | Hybrid fallback scaffolding | `HybridAIService` prepared for Groq cloud and legacy local model adapters. |
| Reasoning Transparency | Live chain & inline steps | Components: `LiveReasoningDisplay`, `DynamicReasoningDisplay`, `InlineReasoningRow`, `ReasoningChain`. |
| Safety | Content filtering | `SafetyFilterService` screens harmful / disallowed content before model output usage. |
| Intelligent Routing | Query classification | `IntelligentQueryClassifier` categorizes prompt intent for tool selection. |
| Farmer Context | Project & crop tracking | `FarmerCropProjectsService`, `FarmerContextService` manage session & crop metadata. |
| Market Intelligence | Commodity prices | `AgmarknetPriceService`, `MarketDataService` pull APMC / agri price feeds. |
| Government Schemes | Scheme discovery | `GovernmentSchemesService` placeholder / integration for program awareness. |
| Weather | Forecast + conditions | `WeatherToolsService` obtains current weather keyed by geolocation. |
| Location | Device location gating | `LocationService` abstracts permission & coordinate retrieval. |
| Plant Health | Plant disease assist | `PlantDiseaseService` (image / classification scaffolding). |
| News | Agri headlines & flashcards | `NewsFlashcardService` + `AgriNewsScreen` render curated domain news. |
| Alerts & Actions | Smart alerts / next steps | `AlertGeneratorService` + `NextActionService` surface proactive suggestions. |
| Autonomous Ops | Multi‑step agent loops | `AutonomousAgentService` (iterative reasoning + tool use loops). |
| Audio | Voice capture scaffolding | `AudioService` integration for future speech input. |
| Telemetry | Usage + health logging | `TelemetryService` collects structured timing / status events. |
| UI Components | Rich card & chat UI | Chat bubbles, typing indicators, weather cards, project cards, flashcards. |
| Auth (Basic) | Session entry screen | `LoginScreen` placeholder for future auth provider. |
| Config & Environment | Centralized key access | `environment.js` + `.env` + dynamic Expo `extra`. |
| Localization Ready | Translation map | `localization/translations.js` scaffolds multi‑language support. |
| Animation | Reasoning step visuals | `ReasoningAnimationService` standardized durations, icons, phases. |
| Safety Telemetry | Test harness | `test_safety_telemetry.js` & `test-agmarknet-scraper.js` validate data flows. |

---

## Directory Overview (Selected)

```text
src/
  components/        # UI building blocks (chat, reasoning displays, cards, inputs)
  screens/           # Feature-level screens (Chat, News, Projects, Insights, Home, Settings, Login)
  services/          # Domain + integration services (AI, tools, data, safety, telemetry)
  config/            # Environment resolution & runtime configuration
  context/           # React contexts (auth, chat state)
  prompts/           # System prompt templates
  localization/      # Translation scaffolding
  utils/             # App initialization helpers
  styles/            # Central color palette and layout metrics
scripts/             # Build / env scripts
```

---

## Environment & Keys

Use `.env` at project root. Example keys:

```env
OPENWEATHER_API_KEY=...
GROQ_API_KEY=...
NEWS_API_KEY=...
PLANTNET_API_KEY=...
DATA_GOV_API_KEY=...
```

Sarvam API intentionally excluded from automatic `.env` loading (must be injected via Expo `extra` if used).

`app.config.js` loads keys with `dotenv` and exposes them to the app via `extra`. `environment.js` centralizes lookup (process.env -> Expo extra).

---

## Run (Development)

```bash
npm install
npm start           # Expo dev server (choose platform)
```

Android (cloud build for demo):

```bash
npm run build:apk:cloud
```

Web export (static demo):

```bash
npm run build:web   # Exports static web bundle (dist/)
```

---

## Local Android APK (WSL Linux) Quick Steps

```bash
npm run build:apk    # Uses EAS local (Docker + credentials) for APK
```

Provide `credentials.json` with keystore if not auto-configured.

---

## Reasoning Lifecycle (Phases)

1. Understanding: parse intent, classify.
2. Tools: execute selected domain tools (weather, prices, news, plant health).
3. Analysis: consolidate + model synthesis (Groq model selection heuristic).
4. Response: finalize + animations, truncation guard, safety filter.

Callbacks from services drive UI components to display each phase incrementally giving transparency.

---

## Tool Orchestration Flow

```text
User Query -> IntelligentQueryClassifier -> AgentToolsService
  -> (WeatherToolsService | MarketDataService | NewsFlashcardService | PlantDiseaseService | ...)
  -> Aggregated Context -> GroqAIService (model selection) -> ReasoningAnimationService events -> UI
  -> SafetyFilterService -> Final Chat Response
```

---

## Safety & Filtering

- Pre-output inspection for disallowed / risky content.
- Telemetry captures filter decisions for audit.

---

## Telemetry

`TelemetryService` records:

- Tool durations
- Model selection metadata
- Error events / availability checks
- (Extensible) for future dashboard or analytics export.

---

## Extensibility Points

| Area | How to Extend |
|------|---------------|
| New Tool | Add service returning { name, contextFragment }; register in `AgentToolsService`. |
| New Model | Implement service with `getInstance`, `selectModelForQuery`, adapt `HybridAIService`. |
| New Screen | Create screen component, add to navigation stack / tab bar. |
| Additional Language | Expand `localization/translations.js`, wrap text in i18n hooks. |
| Custom Safety Rules | Extend `SafetyFilterService` rule set & thresholds. |

---

## Testing & Validation

Scripts / test harness files: `test-agmarknet-scraper.js`, `test_safety_telemetry.js`. Expand with formal test runner (Jest) as needed.

---

## Deployment Options

| Target | Method |
|--------|--------|
| Android APK | `npm run build:apk:cloud` (EAS) share URL. |
| Android Local | WSL + Docker `npm run build:apk`. |
| Web Demo | `npm run build:web` then host `dist/` on static host (GitHub Pages / Netlify / Vercel). |

---

## Roadmap (Suggested)

- Add proper authentication & role-based access
- Implement persistent storage for projects & alerts
- Integrate plant image diagnosis model
- Add multilingual support (Hindi & regional languages)
- Formalize automated tests & CI
- Dashboard for telemetry & usage analytics

---

## License / Usage

Internal demo / evaluation build. Add license file before external distribution.

---

## Contact

Core maintainers: (update with names / emails). For credentials rotation or incidents, rotate `.env` keys and rebuild.

---
