# AI-Powered Parametric Insurance for Gig Workers

## Brainstorming Phase 

* **Objective:** Develop a parametric insurance product that automatically compensates gig workers for income loss due to specific, verifiable disruption events.

---

## 1. Core Disruption Triggers & Fraud Mitigation
The following matrix outlines the primary income-loss events, how the platform will predict/detect them, and the intelligent fraud detection mechanisms required to validate claims automatically.

| Disruption Event | Data Source / Prediction Method | Potential Fraud Vector | AI/System Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Unexpected Road Closures** | Google Maps API / User-reported images / Previous road closure history | Deepfakes, recycled images from old closures. | Run uploaded photos through a YOLOv11 object detection model to verify the hazard and check image metadata (EXIF, timestamp, GPS) for authenticity. Cross-reference with AI-generated image detection. |
| **Apartment Complex Security** | Historical transit data / Geospatial clustering / Previous delay data | Falsified delay reports or GPS spoofing. | Cross-reference user coordinates with known high-friction geofences. Flag anomalies if the delay falls outside historical standard deviations. |
| **Huge Building Navigation** | Indoor mapping data / Average completion times per building | Intentional loitering to trigger an active-time payout. | Establish strict maximums for "last-mile" navigation based on historical app data for that specific building footprint. |
| **Severe Traffic / VIP Movements** | Google Maps Traffic API / Government VIP movement alerts | Drivers taking intentionally longer routes to claim delays. | Continuous route telemetry. If a driver deviates significantly from the algorithm's optimized route without a logged obstruction, the claim is flagged. |
| **Weather Events (Rainfall, Extreme Heat, AQI)** | Weather APIs (OpenWeatherMap, AccuWeather), AQI monitoring stations, Web crawlers for monsoon/storm alerts | Fake weather claims using historical data. | Hard-match the worker's real-time ping to the specific affected environmental polygon. No payout if outside the geofenced hazard zone. *India-focused: ruling out snowfall, focusing on monsoon, extreme heat, AQI.* |
| **Social Context (Strikes, Lockdowns)** | Web scrapers / News APIs / RSS feeds for localized alerts | Claiming inability to work when the strike is in a different district. | Use NLP to extract specific affected districts from news crawls and match them to the worker's assigned delivery zone. |

---

## 2. "Outside the Box" Edge Cases
Beyond standard weather and traffic, the platform will monitor for systemic infrastructure failures that completely halt a delivery partner's ability to operate. All triggers focus strictly on **loss of income**, excluding vehicle repairs or health coverage.

| Edge Case | Detection Method | Notes |
| :--- | :--- | :--- |
| **Cascading Power Grid Failures** | Local electricity board alerts / Sudden drop in active restaurant nodes on the delivery platform | Dark streets cause gridlock; restaurants cannot process orders. Track if restaurant-side order flow drops to near-zero in a zone. |
| **Cellular / ISP Failures** | WebSocket connection timeout clusters | If 50+ riders drop off the connection simultaneously in one area → trigger a localized "Network Dead Zone" protocol. Applies to both restaurant-side and rider-side outages. |
| **Sudden Unmapped Hazards** | User-submitted photos → YOLOv11 backend pipeline | Fallen tree, burst water pipe, etc. not yet on Google Maps. Validate hazard via image processing → micro-payout for route diversion. |
| **VIP Movements** | Comes under traffic prediction; Government/police advisories | Road blockages for VIP convoys — detectable via traffic API anomalies. |
| **Sudden Hazard Detection** | Google Maps obstruction data + user reports | Blocks roads but may not immediately appear on maps. |

---

## 3. Dynamic Premium Calculation Strategy
To align with the gig worker's financial reality, the premium model will be structured strictly on a **Weekly** basis. The dynamic pricing will be calculated using the following dimensions:

### 3.1 Delivery Persona / Product Category
| Persona | Risk Profile | Key Disruption Sensitivity |
| :--- | :--- | :--- |
| **Q-Commerce (Zepto/Blinkit/Instamart)** | Micro-radius (1-3 km), extremely high time-sensitivity | Apartment security & elevator delays, huge building navigation, localized waterlogging, extreme heat |

### 3.2 Geospatial Operating Zone
Premiums will automatically adjust based on the risk profile of the zones the rider frequents (e.g., lower weekly premiums if they operate in areas historically immune to waterlogging).

### 3.3 Product-Place Premium Correlation *(New Idea)*
> **Insight:** The *type of product* a delivery driver chooses to carry vs. the *place they drive to deliver* can determine risk exposure. A premium multiplier can be calculated based on:
> - High-value deliveries to high-risk zones (longer routes, congested areas)
> - Short-radius deliveries in low-risk zones
> - This creates a personalized premium that reflects actual on-ground risk.

---

## 4. Data Sources & APIs

| Data Need | Source / API | Notes |
| :--- | :--- | :--- |
| Road closures & traffic | Google Maps Directions/Traffic API | Real-time + historical |
| Weather (temp, rainfall, AQI) | OpenWeatherMap / AccuWeather / AQI.in | Free tiers available; India-focused |
| Monsoon/storm alerts | Web crawler → news sites / IMD RSS | NLP extraction for affected regions |
| Social disruptions (strikes, lockdowns) | News API / Web scraper / Google Alerts | NLP for district-level matching |
| Power grid status | State electricity board APIs / alerts | Monitor restaurant node drop-off as proxy |
| Cellular/ISP outages | WebSocket liveness checks | Cluster-based dead zone detection |
| GPS & route telemetry | In-app location tracking | Continuous during active shift |
| Image verification | YOLOv11 + EXIF metadata analysis | For user-submitted hazard photos |

---

## 5. System Architecture (From Flowcharts)

### Phase 1 — Onboarding
Gig Worker → React App → Inputs Persona & Zones → **PyTorch Risk Assessment Engine** → Calculates Weekly Premium

### Phase 2 — Monitoring
Policy Created & Subscribed → Worker Starts Shift → **Real-Time Telemetry & WebSocket**

### Phase 3 — Triggers (Dual Path)
- **Path A (System-Automated):** System detects overlap with known disruption (weather, strikes, dead zones) → System Fraud Check (GPS spoofing, loitering)
- **Path B (User-Reported):** Encounters unmapped hazard → Snaps photo → YOLOv11 Image Processing & Metadata → Image Validity Check (deepfake, recycled image)

Both paths → **Valid** → Proceed to Payout | **Invalid/Fraud** → Flag Account / Reject Claim

### Phase 4 — AI Fraud Validation
Cross-reference with: Weather APIs, Traffic/G-Maps APIs, News Scrapers/Grid Data

### Phase 5 — Payout
Calculate Lost Income Duration → Simulated Payment Gateway (Razorpay/Stripe Mock) → Update React Dashboards (User & Admin)

---

## 6. Proposed Tech Stack
| Layer | Technology |
| :--- | :--- |
| **Frontend** | React Native (User App) + React (Admin Dashboard) |
| **Backend** | Node.js/Express or FastAPI |
| **AI/ML** | YOLOv11 (image hazard detection), PyTorch (risk modeling & premium calc) |
| **Real-Time** | WebSockets (telemetry + dead zone detection) |
| **APIs** | Google Maps, OpenWeatherMap, AQI, Web scrapers |
| **Payments** | Razorpay Test Mode / Stripe Sandbox (simulated) |
| **Database** | PostgreSQL or MongoDB |

### 6.1 Platform Choice Justification: Mobile App
We have chosen a **React Native Mobile App** as the core platform. Q-Commerce gig workers rely entirely on their smartphones during shifts. A mobile app provides crucial native features: continuous background GPS telemetry (for geofenced dynamic pricing), Camera API for YOLOv11 hazard photo uploads, and real-time push notifications for sudden disruptions—features that a web app cannot reliably perform on the move.

---

## 7. Phase 1 Deliverables Checklist (Due: March 20)
- [x] Idea Document (this README in GitHub repo)
  - [x] Persona-based scenarios & workflow
  - [x] Weekly premium model explained
  - [x] Parametric triggers defined
  - [x] AI/ML integration plans
  - [x] Tech stack outlined
  - [x] Platform choice justification (Web vs Mobile)
- [x] GitHub Repository with README.md
- [ ] 2-minute strategy/prototype video (publicly accessible link)