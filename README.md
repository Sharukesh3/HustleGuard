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

## 4. How the Dynamic Premium is Calculated & APIs Used

Our system calculates a highly personalized and dynamic weekly premium based on 4 layers of live risk assessment. Rather than a flat rate, our backend (`risk_model.py`) hits several real-time APIs to calculate a custom `base_multiplier` (applied to a base ₹25 premium) ranging from `0.8x` to `3.5x`. 

### Layer 1: Historical & Seasonal Risk (Baseline)
*   **APIs Used:** Groq API (LLaMA3), Firecrawl API, Tavily API.
*   **Logic:** Assesses baseline risk for the specific month/city (e.g., Monsoon in Mumbai, AQI in Delhi in November).
*   **Multiplier:** Heavy seasonal trends (`score >= 0.7`) add `+0.4`, while moderate risks add `+0.2`.

### Layer 2: Live Weather Anomalies
*   **APIs Used:** OpenWeatherMap API (`/weather` and `/air_pollution`).
*   **Logic:** Gig delivery is disproportionately impacted by severe immediate weather. 
*   **Multiplier:** 
    *   **Rain:** `> 5.0mm/h` (Heavy Rain) adds `+0.5`; `> 0.5mm/h` adds `+0.2`.
    *   **Air Quality (AQI):** Hazardous levels (Index 4 or 5) add `+0.3`; Poor (Index 3) adds `+0.1`.
    *   **Extreme Heat:** Temperature `> 40°C` adds `+0.2`.

### Layer 3: Real-Time Traffic & Congestion
*   **APIs Used:** Google Maps Distance Matrix API.
*   **Logic:** Compares real-time `duration_in_traffic` against expected baseline `duration` to calculate a `delay_factor`.
*   **Multiplier:** 
    *   `Delay >= 200%` (Traffic taking double the time) adds `+0.4`.
    *   `Delay >= 140%` adds `+0.15`.
    *   `Delay >= 120%` (Very common baseline congestion) adds `+0.05`.

### Layer 4: Social Disruption & Hyperlocal AI Scan
*   **APIs Used:** News API, Groq LLM NLP.
*   **Logic:** The system scans localized news streams for strikes, unmapped hazards, or VIP movements affecting the gig worker's specific pin code and outputs an anomaly float score (0.0 to 1.0).
*   **Multiplier:** 
    *   Severe disruptions (`score >= 0.8`) add `+0.8`.
    *   Moderate events (`score >= 0.5`) add `+0.4`.
    *   Low-level delays (`score >= 0.2`) add `+0.1`.

If the worker has already paid their dynamically tailored weekly premium, they are not redundantly charged upon restarting the app, conserving database read/writes and minimizing API calls.

---

## 4.1 Data Sources Matrix

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

![Concept Art 1](Photos/Gemini_Generated_Image_566yub566yub566y.png)

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

![Concept Art 2](Photos/Gemini_Generated_Image_g6cjr5g6cjr5g6cj.png)
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

## 7. Adversarial Defense & Anti-Spoofing Strategy

In a parametric insurance model where payouts trigger automatically, stopping intentional fraud rings is paramount. Our system assumes an active adversarial environment and employs multi-layered validation logic before any claim is processed.

### 7.1 The Differentiation: Genuine vs. Spoofed Delays
To distinguish between a genuinely stranded partner and a bad actor spoofing their location, our ML architecture analyzes **device telemetry patterns** rather than just static coordinates. GPS spoofing apps (like "Mock Locations") typically teleport the device or lack the natural micro-jitter (drift) of real GPS hardware filtering through urban canyons. Our model continuously checks the GPS `accuracy` radius and hardware sensor data (accelerometer/gyroscope zeroing out while moving) to classify movement as organic or mathematically spoofed.

### 7.2 The Data: Beyond Basic GPS Coordinates
When assessing a cluster of payouts, our fraud ring detection algorithm looks for coordinating metadata anomalies:
- **WebSocket Disconnection Clusters:** If 10 riders drop connection in the exact same 10-meter block, but Google Maps Traffic API shows normal flow and local cellular towers show 100% uptime, it's flagged as an orchestrated airplane-mode farm.
- **Battery & Charging Telemetry:** Fraud farms often run on devices plugged into a single power strip at a constant 100% battery state. We flag active-shift clusters of identical hardware states in identical locations.
- **Image Metadata (EXIF/Hash):** For user-uploaded hazards, we hash the image to prevent fraud rings from sharing the same "flooded road" picture on Telegram, and cross-check EXIF anomalies (missing device orientation, altered timestamps).

### 7.3 The UX Balance: Handling Flagged Claims Fairly
Parametric insurance must remain frictionless. If an honest worker enters a true dead zone or building with bad reception, their claim could temporarily resemble a "flagged" fraud pattern. 
- **Grace Periods (Pending State):** Flagged claims are not outright rejected. They enter a "Pending Verification" queue. The payout is escrowed rather than denied.
- **Asynchronous Corroboration:** Once the worker reconnects to a stable network, the app seamlessly uploads cached background telemetry packets. If the timestamped internal data validates they were genuinely navigating a complex building, the escalated claim is automatically cleared and paid out immediately.
- **Human-in-the-Loop Threshold:** Only severe, repeat anomalies lead to account suspension. A single flagged shift never penalizes an honest driver trying to make a living; they simply receive an off-cycle payout.

---

## 8. Phase 1 Deliverables Checklist (Due: March 20)
- [x] Idea Document (this README in GitHub repo)
  - [x] Persona-based scenarios & workflow
  - [x] Weekly premium model explained
  - [x] Parametric triggers defined
  - [x] AI/ML integration plans
  - [x] Tech stack outlined
  - [x] Platform choice justification (Web vs Mobile)
- [x] GitHub Repository with README.md
- [x] 2-minute strategy/prototype video: [Watch on YouTube](https://youtu.be/dUENxGHLdxc)

## 9. Phase 2 Deliverables Checklist
- [x] Registration Process
- [x] Provide Policy Details
- [x] Dynamic Premium Feature
- [x] Display Past & Open Claims
- [x] 3-5 Automated Triggers with Public APIs
- [x] Implement Zero-Touch Claims
- [x] 2-minute strategy/prototype video: [Watch on YouTube](https://youtu.be/tfYiDm5c4Fo)

## 10. Phase 3 Deliverables Checklist (Due: April 17)
- [x] **Advanced Fraud Detection:** Implemented YOLOv11 for hazard image verification, ML autoencoder models for GPS spoofing detection, and highly-scalable Redis GEO spatial tracking to isolate and catch anomalies.
- [x] **Instant Payout System (Simulated):** Integrated a mock payment service (Stripe) to demonstrate instant wage compensation triggered seamlessly via distributed Celery background workers.
- [x] **Intelligent Dashboard (Workers):** Built distinct React Native screens showing protected earnings, wallet balances, and active weekly coverage.
- [x] **Intelligent Dashboard (Admin):** Created comprehensive Admin frontend screens showcasing loss ratios and predictive AI analytics for estimating upcoming localized disruption claims.
- [x] **The Final Submission Package:** 5-minute screen-capture demo video: [Watch on YouTube](https://youtu.be/Owr5L4jn4hI)
- [x] **Final Pitch Deck:** Presentation (PDF) detailing the delivery persona, our multi-layered AI & fraud architecture, and the business viability of the Weekly parametric pricing model. [Download Pitch Deck](https://drive.google.com/file/d/1ez1-w5--OWChqQ_YtkoBhOc-03_9qUh5/view?usp=sharing)

## Pitch Deck
[Download Pitch Deck](https://drive.google.com/file/d/1ez1-w5--OWChqQ_YtkoBhOc-03_9qUh5/view?usp=sharing)