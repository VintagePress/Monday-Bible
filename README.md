# AI Bible for CSMs (prototype)

A prototype knowledge base built for the **AI Enablement Solutions Manager** home assignment at monday.com.

The site has three parts:
- **Proposal** (`proposal.html`) - the written assignment, Phase 1 and Phase 2
- **Bible** (`index.html`) - the knowledge base
- **Chat** (`chat.html`) - the Bible bot

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

## The Bible bot

`chat.html` is a separate chat page. A CSM pastes what the client said and gets back the same structure every time: the objection type, what to say, what to ask next, and links to the Bible sections it used.

`api/chat.js` is a small Vercel serverless function. It reads the live Bible (`index.html`), sends it to Gemini with strict rules (answer only from the Bible, never guess, flag gaps), and returns a structured answer. The Gemini API key is stored as a Vercel environment variable (`GEMINI_API_KEY`) and never reaches the browser.

Because the bot reads the Bible page itself, updating the Bible updates the bot - one source of truth.

---

*Prototype - not an official monday.com resource.*
