# AI-Based Dropout Prediction & Counseling System — v2.0
### Smart India Hackathon 2026 | Problem Statement SIH25102 (Government of Rajasthan)

---

## 1. Problem Statement Recap

By the time term-end marks reveal failures, many struggling students have already disengaged beyond recovery. Attendance, test scores, and fee-payment data live in separate spreadsheets — no single view exists to signal that a learner is slipping across multiple areas at once. The system must merge existing data, apply clear rule-based logic to flag risk, and notify mentors on a predictable schedule — without demanding heavy infrastructure or replacing the mentor's own judgment.

---

## 2. What We're Building

A web platform that ingests student data from a single CSV, calculates a dropout risk score per student with full explainability, routes flagged students to their assigned mentor for intervention, and gives students an AI mentor chatbot for day-to-day support — with automatic escalation to a real human when the situation calls for it.

**v1 → v2 changes at a glance:**

| Area | v1 (Python/Flask) | v2 (MERN) |
|---|---|---|
| Backend | Flask, in-memory data | Node.js + Express, MongoDB (persistent) |
| Auth | Hardcoded `mentor`/`admin` | JWT + bcrypt, 3 real roles |
| Risk engine | Rule-based, no persistence | Rule-based first (ML-ready later), risk history stored |
| Mentor assignment | None — one shared view | Students linked to specific mentors |
| Intervention notes | Logged, no follow-through tracking | Open/Resolved status tracking |
| AI | None | RAG-based student chatbot with escalation |
| Notifications | UI only (simulated) | Stretch goal — real email/WhatsApp |

---

## 3. User Roles

### Admin
- Institution-wide view: all students, all mentors, risk distribution
- Assigns/reassigns students to mentors
- Views summary statistics and trend charts
- Monitors intervention follow-through (which notes are still open, for how long)

### Mentor
- Sees only their assigned students
- Views color-coded risk dashboard, sorted by risk score
- Opens student profiles to see risk breakdown and recommendations
- Logs intervention notes, marks them open/resolved
- Receives escalation alerts when the AI chatbot can't handle a student's conversation

### Student
- Logs in to see their own basic profile (attendance, scores — read-only)
- Chats with the AI mentor for study help, stress, or general concerns
- Gets connected to their real mentor automatically if the conversation needs it

---

## 4. Core Features

### 4.1 Risk Prediction Engine
A weighted heuristic score (0–1) computed from four signals, ported directly from the v1 formula (kept as-is for v2 MVP; ML swap-in is a stretch goal):

| Component | Weight | Formula |
|---|---|---|
| Attendance | 50% | `max(0, (75 − attendance%) / 75)` |
| Score trend | 30% | `min(max((prev_avg − curr_avg) / 100, 0), 1)` |
| Fee overdue | 15% | `min(fees_due_days / 90, 1)` |
| Subject attempts | 5% | `min((attempts − 1) / 4, 1)` |

**Risk levels:** High ≥ 0.70 (red) · Medium 0.40–0.69 (yellow) · Low < 0.40 (green)

The calculator is built so risk history is saved on every computation (`Student.riskHistory[]`), enabling trend charts over time — something v1 didn't have.

### 4.2 Explainability
Each student's risk isn't just a number — the profile page shows:
- Per-factor contribution (which of the 4 signals is driving the score)
- Severity per factor (Low/Medium/High)
- Top 2 reasons, plain-language ("Attendance 58% — below threshold", "Test scores dropped 18 points")
- Auto-generated recommendations for the mentor, tailored to severity (e.g. "Schedule immediate parent-teacher meeting" vs "Monitor attendance closely")

### 4.3 Single-File Data Ingestion
One CSV upload per batch, containing all required fields (see Section 6). Validation on upload:
- Reject if any required column is missing
- If a row's `mentor_id` doesn't match a real mentor account, that student goes into an "Unassigned" bucket instead of failing the whole upload
- Success response shows row count processed and any skipped/flagged rows

### 4.4 Mentor Dashboard
- Table of assigned students only, sorted highest-risk-first
- Color-coded rows (red/yellow/green)
- Quick filters: by class, by risk level
- Pending escalation alerts shown prominently at the top

### 4.5 Admin Dashboard
- Total students, risk distribution (pie/bar chart)
- Class-wise breakdown
- Mentor assignment management (bulk reassign)
- Open interventions aging report (e.g. "3 notes open >30 days with no update") — proves the system drives actual follow-through, not just detection

### 4.6 Intervention Notes
- Free-text note tied to a student + mentor + timestamp
- Status: `open` / `resolved`
- Displayed as a running timeline on the student's profile
- Purpose: make sure flagged risk actually gets *acted on*, not just seen and forgotten

### 4.7 AI Mentor Chatbot (RAG-based)
- Student-facing chat interface, available anytime
- Powered by a knowledge base (study tips, stress/burnout guidance, attendance/fee policy info, subject-help resources) embedded into Qdrant
- On each message: retrieve relevant knowledge base chunks + inject the student's own live risk context (attendance %, recent score trend) → feed to Gemini for a personalized, grounded response
- Not a generic chatbot — answers are tied to that specific student's actual situation

### 4.8 Escalation to Human Mentor
Two triggers cause the AI to stop and hand off:
1. **Keyword/intent-based** — messages signaling distress, self-harm, harassment, or an explicit request to talk to a real person
2. **Low-confidence fallback** — when retrieval finds nothing relevant, or Gemini's response indicates it doesn't have a good answer

On escalation: the AI tells the student it's connecting them to their mentor, and an `Escalation` record is created — instantly visible on the assigned mentor's dashboard as a pending alert. This is the safety mechanism that keeps the AI advisory, not autonomous — directly answering the PS's requirement to "empower educators, not replace their judgment."

---

## 5. System Architecture

```
sih-dropout-v2/
├── server/                    Node.js + Express API
│   ├── models/                Mongoose schemas
│   │   ├── User.js
│   │   ├── Student.js
│   │   ├── Note.js
│   │   └── Escalation.js
│   ├── routes/                auth.js, students.js, notes.js, summary.js, upload.js
│   ├── middleware/            auth.js (JWT verify), roleCheck.js
│   ├── services/              riskCalculator.js
│   ├── config/                db.js
│   └── server.js
│
├── client/                    React + Vite frontend
│   └── src/
│       ├── pages/             Login, MentorDashboard, StudentProfile, AdminDashboard, StudentChat
│       ├── components/        RiskBadge, StudentTable, RiskFactorCard, NoteThread, TrendChart, ChatWindow
│       ├── api/                axios instance + endpoint calls
│       └── context/            AuthContext
│
└── ai-service/                RAG chatbot (separate service)
    ├── ingest/                 scripts to embed knowledge base docs into Qdrant
    ├── chat/                    RAG query handler + escalation classifier
    └── routes/                  /chat, /escalate
```

The `ai-service` is kept separate from the main Express server (same pattern used for the future ML microservice) — keeps concerns isolated and lets the AI mentor be demoed or scaled independently.

---

## 6. CSV Schema (Single-File Upload)

### Required columns
| Column | Type | Example | Used for |
|---|---|---|---|
| `student_id` | string, unique | S1001 | Primary key |
| `first_name` | string | Ramesh | Display |
| `last_name` | string | Kumar | Display |
| `class` | string | TE-IT-A | Grouping |
| `roll_no` | string | 23 | Display |
| `mentor_id` | string | M001 | Assigns student to mentor |
| `attendance_percent` | number (0–100) | 68 | Risk: attendance |
| `fees_due_days` | number | 45 | Risk: fees |
| `attempts_in_subject_x` | number | 2 | Risk: attempts |
| `last_test_1` | number | 55 | Detail view |
| `last_test_2` | number | 48 | Detail view |
| `last_test_3` | number | 52 | Detail view |
| `last_3_tests_avg` | number | 51.7 | Risk: score trend |
| `previous_3_tests_avg` | number | 70.0 | Risk: score trend |

### Optional columns
| Column | Type | Example | Used for |
|---|---|---|---|
| `email` | string | ramesh@x.com | Login / notifications |
| `phone` | string | 9876543210 | WhatsApp/SMS alerts (stretch) |
| `guardian_contact` | string | 9998887776 | Parent notifications (stretch) |
| `semester` | string | 5 | Cross-term trend tracking |

---

## 7. Data Models (Mongoose)

**User** — `username`, `passwordHash`, `role` (admin/mentor/student)

**Student** — `studentId`, `firstName`, `lastName`, `class`, `rollNo`, `mentorId`, `attendancePercent`, `feesDueDays`, `attemptsInSubjectX`, `lastTest1/2/3`, `last3TestsAvg`, `previous3TestsAvg`, `riskHistory[]` (date, riskScore, riskLevel)

**Note** — `studentId`, `mentorId`, `note`, `status` (open/resolved), timestamps

**Escalation** — `studentId`, `mentorId`, `reason`, `chatSessionId`, `status` (pending/acknowledged)

**ChatSession** (phase 4) — `studentId`, `messages[]`, `status` (active/escalated/resolved)

**ChatMessage** (phase 4) — `role` (user/ai), `content`, `timestamp`, `retrievedContext[]`

---

## 8. Build Roadmap

**Phase 1 — Backend Foundation**
1. Project scaffold (folders, `package.json`, env config, MongoDB connection)
2. Models (User, Student, Note, Escalation)
3. Auth system (JWT, bcrypt, role middleware)

**Phase 2 — Data & Risk Core**
4. CSV upload endpoint (single-file schema, validation, unassigned-mentor bucket)
5. Sample CSV with ~15 dummy students
6. Risk calculator service (Node port of the formula)
7. Student API routes (list, detail, mentor-filtered, risk-sorted)

**Phase 3 — Mentor/Admin Core**
8. Notes/intervention API
9. Summary/stats API for admin
10. React app scaffold (routing, auth context, protected routes)
11. Login page + auth flow
12. Mentor dashboard UI
13. Student profile page UI
14. Admin dashboard UI

**Phase 4 — AI Mentor Chat**
15. Knowledge base content (study tips, counseling guidance, policy docs)
16. AI service scaffold (LangChain + Gemini + Qdrant)
17. Ingestion script (embed knowledge base into Qdrant)
18. RAG chat endpoint (retrieve + generate, personalized)
19. Escalation logic (keyword + low-confidence detection)
20. Student chat UI
21. Mentor "pending escalations" alert view

**Phase 5 — Polish**
22. Seed script (full realistic demo dataset)
23. Error/empty/loading states, responsive check
24. README + setup instructions + demo script for judges

**Phase 6 — Stretch Goals**
25. Real ML model swap-in for the risk engine (Random Forest/Logistic Regression, scikit-learn microservice)
26. Email/WhatsApp notifications on high-risk flag
27. Risk trend charts over time (using stored `riskHistory`)

---

## 9. Why This Wins

- **Directly answers the PS's exact pain point** (data scattered across sheets → merged, transparent, rule-based logic → mentor-actionable alerts) rather than a generic ML demo.
- **Explainability over black-box** — judges can see *why* a student is flagged, not just a score, which matches the PS's call for a system that "empowers educators, not replace their judgment."
- **Follow-through tracking** (open/resolved notes, aging report) — most teams will stop at detection; this proves the system drives action.
- **Responsible AI escalation** — the chatbot is genuinely useful for students day-to-day, but never operates unsupervised on serious issues, which is a strong, demonstrable safety story for judges.
- **Feasible in hackathon time** — MERN core is straightforward to build fast; ML and notifications are explicitly staged as stretch goals so the core demo is never at risk of being unfinished.
