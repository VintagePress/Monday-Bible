# AI Bible for CSMs (prototype)

A prototype knowledge base built for the **AI Enablement Solutions Manager** home assignment at monday.com.

It's one source of truth for everything a CSM needs when helping a client adopt monday AI. It has four parts, matching the four types of AI objections CSMs hear:

1. **Information Gaps** - how monday AI works: data, security, models, pricing and agents
2. **Control** - every control the client has: on/off, permissions, usage limits, approvals, logs
3. **Trust** - how to prove value: reliability, ROI and pilots
4. **Readiness** - how to tell "not now" from "no"

Every section has an owner (Legal, Security, Finance, Product, CS Leadership) and a status (Verified, Needs owner review, Product gap, Draft).

## How it's built

- A single static `index.html` - no framework, no build step.
- Search and the "On this page" menu are built from the page content, so adding a section to the HTML is all it takes to update them.
- Content is based on monday.com's public help center and trust pages (October 2026).

## Coming next

A chatbot ("Ask the Bible bot") that answers CSM questions using only this Bible, with a link to the source section.

---

*Prototype - not an official monday.com resource.*
