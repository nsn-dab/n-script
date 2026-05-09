# Mentor Requirements (Public Web App Ready)

## 1. Goal

`Mentor` is the critique and pitch-simulation workspace in N Script.  
It evaluates screenplay/proposal quality with strict producer-level logic, then runs interactive rehearsal to improve market readiness.

This document defines requirements with a **public web app release** as the target.

---

## 2. Core Product Structure

- `Discover`: movie discovery and stock management
- `Analyze`: 15-beat structure analysis
- `Mentor`: critique report and simulation chat

Mentor has three steps:

1. `Mode Select` (tone: praise/normal/strict)
2. `Review Report` (technical + market + structure evaluation)
3. `Simulation Chat` (pressure test with mentor persona)

---

## 3. Dual Chat Architecture (Must Have)

### A. Global Chat (Persistent Assistant)

- Placement: floating button at bottom-right, accessible from all screens
- Start: user-initiated prompt
- Role: broad co-pilot support (idea generation, editing support, translation of mentor feedback)
- Tone: constructive, supportive, practical
- Memory scope: long-lived cross-screen session memory

### B. Contextual Chat (Mentor-only)

- Placement: inside `Mentor` step 3 after a review is generated
- Start: AI-led first question (mentor-initiated)
- Role: stress-test before production/pitch
- Tone: critical, logical, high-pressure
- Memory scope: tied to a single review context only

### Separation Rules

- Prompts and memory stores must be fully separated between Global and Mentor chat
- No hidden automatic merge of histories
- UI must clearly indicate which persona/model is active

---

## 4. Mentor Input and Pre-Aggregation

When a script/proposal file is uploaded, run technical aggregation before critique text.

### Supported file formats

- `.pdf` (text-based PDFs only; OCR is out of scope)
- `.docx`
- `.pptx`
- `.txt`

### Pre-aggregation outputs

- Stage direction vs dialogue ratio
- Scene density and estimated runtime pacing
- Character count and relationship map signal

These values are shown first and then fed into review generation.

---

## 5. Five Evaluation Axes

Mentor review scores and comments must cover:

1. `Marketability`
   - High-concept hook strength
   - Audience/common-sense gap detection
   - Global market reach
2. `Emotional Engineering`
   - Physiological hook placement (fear/tension design)
   - Catharsis/payoff quality
3. `First 10 Pages`
   - Whether visual abnormality, mystery, or incident appears early enough
4. `Reality Check`
   - Plot holes and logical contradictions
   - Character motivation consistency
   - Rule consistency in-world
5. `Structure (15 Beats)`
   - Beat alignment
   - Mid-act drag, pacing rush, weak midpoint detection

---

## 6. Report Output Contract

Mentor output is a 3-stage bundle:

1. `Analysis Report`
   - Radar-ready 5-axis scores
   - Concrete issue list (logic holes, consistency, exposition overuse)
2. `Box Office Simulation`
   - Likely target audience segments
   - Revenue scale rough forecast
   - International expansion potential
3. `Decision`
   - `GO` / `REWRITE` / `PASS`

---

## 7. Public Web App Design Constraints (Release-Oriented)

### Authentication and Account Model

- Required before public launch
- User-level ownership for movies, analysis, mentor reviews, and both chat histories
- No mixed-tenant data reads/writes

### Data Storage

- Current localStorage model is prototype-only
- Migrate to server-side persistent storage (user-scoped)
- Keep clear schema separation:
  - `global_chat_sessions`
  - `mentor_reviews`
  - `mentor_context_chats`

### Security

- Gemini/TMDb keys must stay server-side only
- Input sanitization for uploads and prompts
- Upload size/type validation on server
- Rate limits per user/IP for upload and chat endpoints

### Reliability and Operations

- Job status handling for heavy file parsing/review generation
- Error taxonomy (user-fixable vs system errors)
- Structured logging and request tracing for production support

### Cost Control

- Token and model usage accounting per feature
- Per-user quotas (especially Mentor simulation loops)
- Fast/cheap fallback model strategy where quality permits

---

## 8. API Boundary (Recommended)

- `POST /api/mentor/upload`
  - parse file and return extracted text + pre-aggregation metrics
- `POST /api/mentor/review`
  - generate 5-axis review, simulation, and decision
- `POST /api/mentor/chat`
  - mentor-context chat turn (reviewId-bound)
- `POST /api/global-chat`
  - persistent assistant chat turn

All endpoints should enforce authenticated user context.

---

## 9. Acceptance Criteria (MVP -> Public Beta)

### MVP (private testing)

- Mentor 3-step flow works end-to-end
- Dual chat separation is implemented and visible
- Supported file formats parse and generate review output

### Public Beta Gate

- Auth + user data isolation enabled
- Server persistence enabled (no localStorage dependency for critical data)
- Monitoring, limits, and key management in place
- Clear ToS/privacy messaging for uploaded scripts

---

## 10. Prompt and Persona Policy

- Mentor persona should be strict and professional, not abusive
- Global chat should stay constructive and execution-oriented
- Internal producer philosophy can be encoded in system prompts
- Specific real-person naming should not be exposed in UI copy

