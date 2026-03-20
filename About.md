## Inspiration
At DevTrails 2026, we reflected on the massive boom in Quick Commerce (Q-commerce) platforms in India. Gig workers are the backbone of this industry, yet they operate under extreme time pressure. Unexpected daily disruptions—such as unmapped road closures, sudden monsoon downpours, or even excessive wait times at apartment security gates—directly cost them money. They bear the financial burden of these external factors. We realized these workers need a safety net. This inspired us to build a fair, automated, and frictionless insurance system that compensates them for time and income lost out of their control, without the hassle of traditional insurance claims.

## What it does
HustleGuard is an AI-powered parametric insurance platform built specifically for gig delivery workers. Driven by a dynamic weekly premium model, the app actively monitors a gig worker's shift using continuous telemetry and live APIs. If a worker is caught in a verifiable disruption—like severe localized traffic, weather emergencies, or cellular dead zones—our system automatically triggers a micro-payout for their lost time.

For unmapped, sudden hazards (e.g., a burst pipe or fallen tree), the worker simply snaps a photo. Our system uses YOLOv11 AI logic paired with deep metadata and EXIF analysis to instantly validate the hazard and issue a payout, circumventing traditional, lengthy damage reports.

## How we built it
We developed a **React Native** application for the user interface because mobile native APIs are essential for continuous background GPS tracking, WebSocket liveness checks, and instant camera access. 

The backend runs on **Node.js/Express** and integrates with an ecosystem of external APIs, including Google Maps (for routing and traffic anomalies), OpenWeatherMap, and AQI monitors to ingest real-time disruption data. 

At the core of our platform is an AI pipeline:
- **PyTorch** handles the risk assessment engine, computing weekly premiums based on our unique "Product-Place" correlation and zone-based historical data.
- **YOLOv11** processes user-submitted images in real-time, functioning as our intelligent fraud detection gateway to dismiss deepfakes, recycled images, or loitering attempts.

## Challenges we ran into
Our biggest challenge was solving the fraud prevention puzzle. In a parametric system where payouts trigger automatically, stopping intentional misuse (such as a worker turning off their data or loitering near an apartment complex to feign delays) is critical. 

We had to design an intricate matrix of validation checks: using historical transit data to flag standard deviation anomalies in "huge building navigation", verifying EXIF/GPS timestamps on hazard photos, and ensuring cellular dropout claims were corroborated by a localized cluster of at least 50+ rider disconnections rather than isolated device failures.

## Accomplishments that we're proud of
We are particularly proud of our **Dynamic Premium Calculation Strategy**. Instead of standard, flat-rate insurance, we engineered a model that calculates a risk multiplier based on the *type* of deliveries a driver handles (e.g., highly time-sensitive Q-commerce items) and the *geospatial history* of their route.

We are also thrilled with the completely automated, "human-less" image verfication pipeline. Proving a hazard exists securely via a mobile upload directly into a YOLOv11 backend felt incredibly rewarding to pull off.

## What we learned
We gained profound insight into how vulnerable the gig economy is to micro-disruptions. Technically, we learned how to architect complex continuous-location mobile apps, manage real-time dual-path Websocket architectures, and deeply integrate computer vision (YOLOv11) into a fraud-detection workflow. We also grappled with the mathematical logic of parametric risk and dynamic premium pooling.

## What's next for HustleGuard
For Phase 2 of HustleGuard, we want to integrate Razorpay or Stripe to start simulating exact, split-second financial disbursements to gig workers via our mock system. We will expand our "Edge Cases" matrix to include integrations with local state electricity board APIs to track power grid failures as a proxy for restaurant order delays. We also aim to polish our React Admin Dashboard, allowing underwriters to visualize real-time heatmaps of disruption clusters across the city.
