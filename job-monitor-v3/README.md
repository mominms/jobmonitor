# 🤖 AI Job Monitor (V3)

**The Ultimate Freelance Intelligence System.**
Harvests jobs from Upwork, LinkedIn, and RSS, classifies them using AI (Llama 3), and helps you generate winning proposals instantly.

---

## 🏗️ System Architecture

This system uses a **Hybrid Architecture**:
1.  **Passive Ingestion**: The **Backend** automatically pulls from RSS Feeds and APIs.
2.  **Active Harvesting**: The **Browser Extension** drives deeply into sites like Upwork/LinkedIn to "scrape" data that APIs miss (e.g., client budgets, verified status).
3.  **Intelligence Layer**: The **AI Engine** (Groq) scores and classifies every job based on your Agency Personas.

```text
                                         +------------------+
                                         |   USER BROWSER   |
                                         +--------+---------+
                                                  |
              +-----------------------------------+-----------------------------------+
              |                                   |                                   |
    +---------v---------+               +---------v----------+              +---------v---------+
    |   NEXT.JS DASH    |               |  CHROME EXTENSION  |              |   USER BROWSING   |
    | (localhost:3001)  |               |    (Background)    |              |  (Upwork/Indeed)  |
    +---------+---------+               +---------+----------+              +---------+---------+
              | (Polls)                           | (Ingests)                         | (Scrapes)
              |                                   |                                   |
              v (Read)                            v (Write)                           |
    +---------+---------+               +---------+----------+              +---------v---------+
    |   FASTAPI SERVER  |<--------------+   API GATEWAY      |<-------------+  CONTENT SCRIPTS  |
    | (localhost:8002)  |               |   (/leads/ingest)  |              |    (upwork.js)    |
    +---------+---------+               +---------+----------+              +-------------------+
              |                                   ^
              | Read/Write                        |
    +---------v---------+               +---------+----------+
    |     SQLITE DB     |               |  OUTSIDE WORLD     |
    | (jobs.db - WAL)   |               | (RSS, APIs, Groq)  |
    +---------+---------+               +--------------------+
              ^
              |
    +---------+---------+
    |    AI WORKERS     |
    |  (Score & Class)  |
    +-------------------+
```

---

## 🚀 Quick Start

### 1. Backend (The Brain)
Runs the database, AI logic, and API.
```bash
cd backend
# Create/Activate Virtual Env
python -m venv venv
venv\Scripts\activate

# Install Dependencies
pip install -r requirements.txt

# Configure AI
# Create a .env file with: GROQ_API_KEY=your_key_here

# Run Server
python main.py
```
*Port: `8002`*

### 2. Frontend (The Dashboard)
Visualizes jobs, scores, and proposals.
```bash
cd frontend
npm install
npm run dev
```
*Port: `3001`*

### 3. Extension (The Harvester)
Scrapes data while you browse or auto-harvests.
1.  Go to `chrome://extensions`.
2.  Turn on **Developer Mode**.
3.  Click **Load Unpacked**.
4.  Select the `extension/` folder in this project.
5.  **Pin** the extension to your toolbar.

---

## ✨ Features & Usage

### 1. 🔍 Job Harvesting
*   **Auto-Harvest**: Click "Start Harvesting" in the extension. It opens tabs, scrapes job details, budgets, and client stats, then closes them.
*   **Deep Scan**: Extracts "Client Spent", "Payment Verified", and "Hire Rate" from Upwork to calculate a `Connect Score`.
*   **Budget Search**: Intelligently parses "Hourly: $30-$50" or "Fixed: $500" formats.

### 2. 🧠 AI Intelligence
*   **Agency Match**: Auto-sorts jobs into:
    *   🔵 **Ascend** (Marketing/Growth)
    *   🟠 **Apex** (Executive/Strategic)
    *   🟢 **SocketLogic** (Tech/Dev/Automation)
*   **Smart Scoring**: Rates jobs 0-100 based on keyword fit and budget.
*   **Relative Time**: Shows "Posted 5m ago" so you can bid early.

### 3. 📊 Dashboard Control
*   **Smart Sort**:
    *   **✨ Smart**: Tiered sort (90+ Score First, then Newest). Best for "snipping" high-value roles.
    *   **📅 Newest**: Pure chronological order.
    *   **🏆 Score**: Pure quality order.
*   **Playbook**: Click "Generate Proposal" to get an AI-written cover letter tailored to the specific job. Use the **Proposal Voice** toggle to choose between an **Individual** freelancer pitch or a full **Agency** pitch.

---

## 🛠️ Troubleshooting

| Problem | Solution |
| :--- | :--- |
| **"System Connection Error"** | Ensure Backend is running (Port 8002). Check console for `Connection refused`. |
| **Extension Error (Red Box)** | Reload the extension in `chrome://extensions`. Check if `jobs.db` is locked. |
| **Wrong Time ("Just now")** | Backend was ignoring scraped time. Restart Backend to apply fix. |
| **"N/A" Budget** | Upgrade to latest `upwork.js` (Reload Extension). Supports complex budget text. |
| **Database Locked** | Restart Backend. The system now uses a Singleton DB Manager to prevent locks. |

---

*Verified V3.0 - 2026-02-25*
