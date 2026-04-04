# HustleGuard: AI-Powered Parametric Insurance

## Inspiration
At DevTrails 2026, we reflected on the massive boom in Quick Commerce (Q-commerce) platforms in India. Gig workers are the backbone of this industry, yet they operate under extreme time pressure. Unexpected daily disruptions—such as unmapped road closures, sudden monsoon downpours, or even excessive wait times at apartment security gates—directly cost them money. They bear the financial burden of these external factors.

We realized these workers need a safety net. This inspired us to build a fair, automated, and frictionless insurance system that compensates them for time and income lost out of their control, without the hassle of traditional insurance claims.

## What it does
HustleGuard is an AI-powered parametric insurance platform built specifically for gig delivery workers. Driven by a dynamic weekly premium model, the app actively monitors a gig worker's shift using continuous telemetry and live APIs. If a worker is caught in a verifiable disruption—like severe localized floods, political protests, or platform outages—our system automatically triggers a micro-payout directly to their in-app wallet.

In Phase 2, we completely realized the "Zero-Touch Claims" philosophy. Riders don't need to push buttons for systemic disruptions; the backend central monitor continuously evaluates their location against live hazard data and uses WebSockets to instantly push funds to their account the moment a parameter is breached. For unmapped hazards, users can still upload a photo to immediately generate a claim based on visual validation.

## How we built it
We developed our frontend in **React Native (Expo)** to tap into native APIs for continuous background GPS tracking, seamless animations, and WebSocket liveness checks.

For Phase 2, we migrated our robust backend to **Python (FastAPI)** backed by a **PostgreSQL** database. This architecture is crucial for handling high-frequency asynchronous tasks and real-time WebSocket broadcasting.

Our dynamic risk engine ingests data from a web of external APIs:
* **Google Maps API:** For routing and real-time transit delay calculations.
* **OpenWeatherMap:** For live rainfall and AQI metrics.
* **Groq API (LLaMA 3) & Firecrawl/Tavily:** For running NLP scans on hyperlocal social disruptions (strikes, VIP movements).

## The Mathematics of Dynamic Premiums
Instead of flat-rate insurance, we engineered a parametric risk engine that calculates a dynamic weekly premium multiplier. The final premium is calculated using the following model:

$$P_{final} = P_{base} \times \min(\max(1.0 + \Delta H + \Delta W + \Delta T + \Delta S, 0.8), 3.5)$$

Where the total multiplier is bounded between $0.8$ and $3.5$, and the risk variables are defined as:

* **$\Delta H$:** Historical Baseline Risk (Seasonal trends, e.g., $+0.4$ for heavy monsoon cycles).
* **$\Delta W$:** Weather Anomaly ($\Delta W = 0.5$ if Rain $> 5.0\text{ mm/h}$, plus AQI and Heat penalties).
* **$\Delta T$:** Traffic Delay Factor based on $T_{real}/T_{expected}$ (e.g., $+0.4$ if delay factor $\geq 2.0$).
* **$\Delta S$:** Social Disruption Score outputted by our LLM ($+0.8$ for severe localized strikes).

## Challenges we ran into
Moving from a conceptual prototype to a fully persistent, real-time platform introduced significant challenges.

Managing state across a live WebSocket connection proved difficult. When a WebSocket disconnected unexpectedly, ASGI servers would crash tracking orphaned client IDs. We solved this by strictly tethering connections to authenticated user phone numbers and safely wrapping dictionary deletions.

Additionally, managing the financial logic state locally on the React Native app caused "double-charging" bugs if a user restarted the app. We overcame this by implementing a pre-calculation `GET /wallet` check against our PostgreSQL database to verify if an active cycle premium was already deducted, saving thousands of redundant API calls to our risk engine.

## Accomplishments that we're proud of
We are incredibly proud to have fully functional Zero-Touch Claims. Seeing a simulated server-side "Flood" or "Protest" event automatically detect an active rider and instantly increment their React Native wallet balance over WebSockets was a massive breakthrough.

We are also thrilled with our comprehensive UI/UX. The app seamlessly outlines policy inclusions/exclusions, visually tracks hazard logs from the cloud database, and features a highly intelligent onboarding sequence that only computes AI pricing when absolutely necessary.

## What we learned
We gained profound insight into the complexities of asynchronous Python APIs and WebSockets. We learned how to architect complex continuous-location mobile apps, securely manage `.env` secrets across a full-stack codebase, and seamlessly connect React Native to a persistent cloud database. Most importantly, we learned how to merge deterministic mathematics with predictive AI (LLMs) to output reliable financial logic.

## What's next for HustleGuard
Now that our zero-touch parametric foundation is proven, we want to integrate **Razorpay** or **Stripe** to facilitate actual, split-second bank disbursements. We aim to polish our computer vision (YOLOv11) pipeline to automatically process the unmapped user-uploaded hazards directly on the Edge. Finally, we plan to launch a React Admin Dashboard so underwriters can visualize real-time heatmaps of disruption clusters across the city.