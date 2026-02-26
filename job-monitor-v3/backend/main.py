from fastapi import FastAPI, HTTPException, Body, BackgroundTasks, Depends, Security, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import os
import json
import time
from datetime import datetime
from typing import List, Optional, Dict
from groq import Groq
from dotenv import load_dotenv
from config import DB_PATH, AGENCY_CONTEXT, API_KEY
import fetchers
from ai_client import generate_with_retry
import asyncio
from contextlib import asynccontextmanager
from database import get_read_connection, get_write_connection

load_dotenv()

def verify_api_key(request: Request):
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        if token == API_KEY:
            return token
            
    query_key = request.query_params.get("api_key")
    if query_key == API_KEY:
        return query_key

    raise HTTPException(
        status_code=401,
        detail="Invalid or missing API Key"
    )

@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    init_db()
    seed_sources()
    asyncio.create_task(worker())
    asyncio.create_task(ai_analysis_worker())
    yield

app = FastAPI(title="Job Lead Monitor V2", lifespan=lifespan, dependencies=[Depends(verify_api_key)])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# client initialized dynamically per request via generate_with_retry

def init_db():
    # Use write connection for schema creation to be safe
    with get_write_connection() as conn:
        c = conn.cursor()

        c.execute("""
            CREATE TABLE IF NOT EXISTS job_leads (
                id TEXT PRIMARY KEY,
                source TEXT,
                external_id TEXT,
                title TEXT,
                description TEXT,
                url TEXT,
                budget TEXT,
                company TEXT,
                posted_at TEXT,
                agency_match TEXT,
                match_score REAL,
                ai_confidence REAL,
                match_reasoning TEXT,
                status TEXT DEFAULT 'new',
                applied INTEGER DEFAULT 0,
                applied_at TEXT,
                applied_by TEXT,
                connect_score INTEGER DEFAULT 0,
                client_signals TEXT,
                client_proposal TEXT,
                client_plan TEXT,
                created_at TEXT
            )
        """)

        c.execute("""
            CREATE TABLE IF NOT EXISTS job_sources (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                url TEXT,
                parsing_config TEXT,
                enabled INTEGER DEFAULT 1,
                last_checked TEXT
            )
        """)
        
        # Migrations
        try:
            c.execute("ALTER TABLE job_leads ADD COLUMN ai_confidence REAL")
            c.execute("ALTER TABLE job_leads ADD COLUMN match_reasoning TEXT")
        except: pass

        try:
            c.execute("ALTER TABLE job_leads ADD COLUMN client_proposal TEXT")
            c.execute("ALTER TABLE job_leads ADD COLUMN client_plan TEXT")
        except: pass
        
        try:
            c.execute("ALTER TABLE job_sources ADD COLUMN parsing_config TEXT")
        except: pass

        c.execute("""
            CREATE TABLE IF NOT EXISTS system_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                metric_type TEXT, value REAL, timestamp TEXT
            )
        """)

        c.execute("""
            CREATE TABLE IF NOT EXISTS contacts (
                id TEXT PRIMARY KEY, name TEXT, role TEXT, location TEXT, url TEXT,
                email_guess TEXT, validation_status TEXT DEFAULT 'pending', source TEXT, created_at TEXT
            )
        """)
        # Context manager handles commit/close automatically

def seed_sources():
    with get_write_connection() as conn:
        c = conn.cursor()
        c.execute("SELECT count(*) FROM job_sources")
        if c.fetchone()[0] == 0:
            sources = [
                ("wwr_marketing", "We Work Remotely - Marketing", "rss", "https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss", "{}"),
                ("wwr_design", "We Work Remotely - Design", "rss", "https://weworkremotely.com/categories/remote-design-jobs.rss", "{}"),
                ("freelancer_api", "Freelancer.com (Python/Marketing)", "api", 
                 "https://www.freelancer.com/api/projects/0.1/projects/active?compact=true&limit=20&query=python%20marketing",
                 json.dumps({
                     "root_key": "result.projects",
                     "id_key": "id",
                     "title_key": "title",
                     "desc_key": "preview_description",
                     "url_key": "seo_url", 
                     "company_key": "owner_id"
                 })
                ),
                 ("remoteok", "RemoteOK (Python)", "api", "https://remoteok.com/api?tag=python", json.dumps({"root_key": "", "title_key": "position"}))
            ]
            c.executemany("INSERT INTO job_sources (id, name, type, url, parsing_config) VALUES (?, ?, ?, ?, ?)", sources)
            print("✅ Seeded V2 job sources")
        # Context manager handles commit/close automatically

# --- Models ---
class IngestJob(BaseModel):
    source: str
    external_id: str
    title: str
    description: str = ""
    url: str
    budget: str = "N/A"
    company: str = "Unknown"
    posted_at: Optional[str] = None
    client_signals: Optional[Dict] = None

class IngestRequest(BaseModel):
    jobs: List[IngestJob]

class JobLead(BaseModel):
    id: str
    source: Optional[str]
    external_id: Optional[str]
    title: Optional[str]
    description: Optional[str]
    url: Optional[str]
    budget: Optional[str]
    company: Optional[str]
    posted_at: Optional[str]
    agency_match: Optional[str]
    match_score: Optional[float] = 0.0
    ai_confidence: Optional[float] = 0.0
    match_reasoning: Optional[str]
    status: Optional[str]
    applied: Optional[int] = 0
    applied_at: Optional[str]
    applied_by: Optional[str]
    connect_score: Optional[int] = 0
    client_signals: Optional[str]  # Stored as JSON string in DB
    client_proposal: Optional[str] = None
    client_plan: Optional[str] = None
    created_at: Optional[str]

# --- Endpoints ---

@app.get("/system/health")
def get_system_health():
    """Analyze performance metrics and return health status."""
    try:
        with get_read_connection() as conn:
            c = conn.cursor()
        
        # Simple queue check
        queue_length = job_queue.qsize()
        
        # Calculate approximate processing time (placeholder)
        avg_process_time = 0.5 
        
        conn.close()

        status = "Healthy"
        recommendation = "System running smoothly."

        if queue_length > 20:
            status = "Congested"
            recommendation = "High load. Maintain current refresh interval."
            
        return {
            "status": status,
            "metrics": {
                "avg_ai_time_sec": avg_process_time,
                "throughput_jobs_min": 60,
                "queue_length": queue_length,
            },
            "recommendation": recommendation,
        }
    except Exception as e:
        return {"status": "Error", "message": str(e)}

@app.get("/leads/refresh")
def refresh_leads():
    from fastapi.responses import StreamingResponse
    def event_stream():
        for msg in fetchers.run_all_fetchers():
            yield f"{msg}\n"
    return StreamingResponse(event_stream(), media_type="text/plain")

@app.post("/leads/ingest")
async def ingest_leads(req: IngestRequest):
    count = 0
    for job in req.jobs:
        await job_queue.put(job.dict())
        count += 1
    return {"status": "queued", "count": count}

class ManualLeadRequest(BaseModel):
    title: str
    description: str
    agency_match: str
    url: str = "#"
    company: str = "Unknown"

@app.post("/leads/manual")
def add_manual_lead(req: ManualLeadRequest):
    import time
    lid = f"manual_{int(time.time())}"
    with get_write_connection() as conn:
        conn.execute("""
            INSERT INTO job_leads (
                id, source, external_id, title, description, url, 
                budget, company, posted_at, status, created_at, match_score, agency_match
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            lid, "Manual Input", lid, req.title, req.description, req.url,
            "N/A", req.company, datetime.now().isoformat(),
            'new', datetime.now().isoformat(), 100, req.agency_match
        ))
    return {"success": True, "id": lid}

@app.get("/leads", response_model=List[JobLead])
async def get_leads():
    try:
        with get_read_connection() as conn:
            # Sort by Match Score (0-100)
            rows = conn.execute("SELECT * FROM job_leads WHERE status='new' ORDER BY match_score DESC, posted_at DESC").fetchall()
            results = [dict(row) for row in rows]
        return results
    except Exception as e:
        import traceback
        # In production we might not want to return tracebacks, but for user debugging its safer
        print(f"Error in /leads: {e}")
        print(traceback.format_exc())
        return []

# --- Workers ---
job_queue = asyncio.Queue()

async def worker():
    print("👷 Ingest Worker Started")
    while True:
        try:
            job_data = await job_queue.get()
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, fetchers.save_lead, job_data)
            await asyncio.sleep(0.5)
            job_queue.task_done()
        except Exception as e:
            print(f"Ingest Error: {e}")
            job_queue.task_done()

async def ai_analysis_worker():
    print("🧠 AI Analysis Worker Started")
    while True:
        try:
            row = None
            with get_read_connection() as conn:
                row = conn.execute("SELECT * FROM job_leads WHERE match_score = 0 AND description != '' LIMIT 1").fetchone()

            if row:
                lead = dict(row)
                print(f"🧠 Scoring: {lead['title'][:30]}...")
                
                agency, confidence, score = fetchers.classify_with_ai(lead['title'], lead['description'])
                
                agency, confidence, score = fetchers.classify_with_ai(lead['title'], lead['description'])
                
                with get_write_connection() as conn:
                    conn.execute(
                        "UPDATE job_leads SET agency_match=?, match_score=?, ai_confidence=? WHERE id=?", 
                        (agency, score, confidence, lead['id'])
                    )
                await asyncio.sleep(1.0) 
            else:
                await asyncio.sleep(5.0)

        except Exception as e:
            print(f"AI Worker Error: {e}")
            await asyncio.sleep(5.0)

# --- Enrichment & AI Tools ---

@app.post("/leads/enrich")
@app.post("/leads/enrich")
def enrich_job(req: IngestJob): 
    # Update client signals and recalculate score
    
    score = 0
    if req.client_signals:
        s = req.client_signals
        if s.get('payment_verified'): score += 15
        if s.get('client_spent', 0) > 10000: score += 20
        if s.get('hire_rate', 0) > 50: score += 15
        if s.get('proposal_count', 99) < 5: score += 20
    
    with get_write_connection() as conn:
        conn.execute(
            "UPDATE job_leads SET client_signals=?, connect_score=? WHERE external_id=?",
            (json.dumps(req.client_signals), score, req.external_id)
        )
    return {"success": True}

class AIRequest(BaseModel):
    job_id: Optional[str] = None
    agency: str
    title: Optional[str] = None
    description: Optional[str] = None
    enhanced_description: Optional[str] = None
    proposal_persona: Optional[str] = "agency"

AGENCY_KNOWLEDGE = {
    "ascend": "Growth Engineering, Marketing Automation, and AI-driven growth strategies. We specialize in GoHighLevel, ActiveCampaign, Zapier, Make, and building scalable marketing systems that drive revenue.",
    "apex": "Strategic consulting, fractional CMO/COO services, and high-level business transformation. We help companies restructure operations, optimize processes, and scale efficiently.",
    "socketlogic": "Full-stack software development, custom AI solutions, and robust web applications. We specialize in Python, React, Next.js, FastAPI, and building scalable SaaS platforms.",
    "infrastructure": "Cloud Engineering, DevOps, Cybersecurity, and IT Systems. We handle AWS, Azure, CI/CD pipelines, network architecture, and security audits."
}

@app.post("/generate-proposal")
def generate_proposal(req: AIRequest):
    if req.job_id:
        with get_read_connection() as conn:
            row = conn.execute("SELECT * FROM job_leads WHERE id=?", (req.job_id,)).fetchone()
        if not row: return {"error": "Not found"}
        title = row[3]
        desc = req.enhanced_description if req.enhanced_description else row[4]
    else:
        title = req.title
        desc = req.description
        
    agency_info = AGENCY_KNOWLEDGE.get(req.agency.lower(), f"{req.agency} agency")
    persona = req.proposal_persona or "agency"
    
    if persona == "individual":
        persona_instruction = f"""You are writing this proposal as an individual professional (first person 'I').
    Crucially, you have deep personal expertise in ALL of these specific services: {agency_info}.
    Make sure to frame these services as your own core competencies.
    NEVER mention any agency name (like Apex or Ascend). Write as a skilled solo professional.
    NEVER say 'myself or a dedicated team'. You act alone.
    Use 'I' and 'my experience' throughout. Present yourself as a senior expert who has personally delivered results in these areas.
    Sign off with just [Your Name]."""
    else:
        persona_instruction = f"""You are writing this proposal on behalf of {req.agency} agency.
    Use 'we' and 'our team' throughout. Reference {req.agency} by name.
    Our agency specializes in: {agency_info}.
    Sign off with [Your Name], {req.agency}."""
    
    prompt = f"""
    You are an expert sales executive and proposal writer.
    
    {persona_instruction}
    
    Write a persuasive Upwork proposal (cover letter) for this job.

    JOB TITLE: {title}
    JOB DESCRIPTION: {desc}
    
    === STRICT OUTPUT RULES ===
    - Output ONLY the proposal text itself. Start directly with the first sentence of the proposal.
    - Do NOT include any preamble like "Here is a draft...", "Okay, here is...", "Sure, here's..." etc.
    - Do NOT include "Subject:", "---", "End of Proposal", or any wrapper/separator.
    - Do NOT sign off with placeholder links like "[Link to profile]" or "[Your Upwork profile]".
    - Do NOT use bracket labels like "[Their need: X]" or "[Action]" anywhere. Write naturally.
    - Do NOT use cliché phrases like 'well-oiled machine', 'transform your business', 'synergy', 'seamless transition', or 'exponential growth' even if the client used them.
    
    === YOUR BACKGROUND (WEAVE THIS IN EXACTLY AS SHOWN) ===
    - Bitstop & Margo: Built automated KPI dashboards and forecasting tools giving leadership real-time visibility without manual reporting.
    - Continuum VP & Mindbridge: Embedded in ops projects, mapped workflows, resolved bottlenecks across cross-functional teams.
    - Zoho CRM: Hands-on experience optimizing it and coordinating cross-functional projects.
    
    === PROPOSAL STRUCTURE ===
    
    HOOK (Exactly 2-3 sentences):
    - Sentence 1: Make a strong, insightful claim about how founder-led businesses often suffer from a "visibility problem" or operational bottlenecks, rather than just an "operations problem". Do NOT use exact cliché phrasing, make it original.
    - Sentence 2: Connect this insight to the specific needs in their job description.
    - Sentence 3: Confidently state that building this infrastructure is exactly what you do.
    
    BRIDGE (Exactly 2 short paragraphs):
    - Paragraph 1: Mention your 5+ years of experience in financial services and BPO environments designing operational backbones. Briefly weave in your work at Bitstop, Margo, Continuum VP, and Mindbridge based on the Background section above.
    - Paragraph 2: Explain your "process-first mindset"—that you don't just fix things, you document and systematize them so the team can own them. Write this organically.
    
    VALUE BULLETS (Exactly 3-4 bullets, preceded by "Specifically relevant to your role:"):
    - Start the section with exactly: "Specifically relevant to your role:"
    - Bullet 1: Focus on dashboards/automated reporting (Bitstop).
    - Bullet 2: Focus on Zoho CRM and cross-functional coordination.
    - Bullet 3/4: Tie another background skill directly to a need in their job description.
    - Write the bullets naturally (e.g., "I've built...", "I have hands-on experience...", "My background in..."). Do NOT start with action verbs.
    
    QUICK WIN (Exactly 1 sentence):
    - Describe how, within the first week, your priority would be a full process audit (mapping workflows, identifying automation opportunities, and removing founder involvement). Write this in your own natural phrasing.
    
    CLOSE (Exactly 1 sentence):
    - Express your interest in discussing how your background translates into the operational transformation they are looking for. Keep it natural and concise.
    
    === TONE ===
    - Write like a sharp, confident peer who is already doing the work in their head. 
    - No fluff. Absolutely NO corporate double-speak. 
    - Extremely punchy. 150-200 words total.
    - Do NOT add any other intro or outro text. Output ONLY the proposal.
    """
    
    proposal = generate_with_retry(prompt, is_json=False)
    return {"proposal": proposal}

@app.post("/generate-action-plan")
def generate_action_plan(req: AIRequest):
    # Similar logic for action plan
    if req.job_id:
        with get_read_connection() as conn:
            row = conn.execute("SELECT * FROM job_leads WHERE id=?", (req.job_id,)).fetchone()
        if not row: return {"error": "Not found"}
        title = row[3]
        desc = req.enhanced_description if req.enhanced_description else row[4]
    else:
        title = req.title
        desc = req.description
    agency_info = AGENCY_KNOWLEDGE.get(req.agency.lower(), f"{req.agency} agency")
    persona = req.proposal_persona or "agency"
    
    if persona == "individual":
        background_context = f"You are advising a highly skilled individual professional. Their core competencies include: {agency_info}."
        perspective = "Write this plan addressing the individual directly ('You should...', 'Your first week...')."
    else:
        background_context = f"You are advising the {req.agency} agency, which specializes in: {agency_info}."
        perspective = "Write this plan addressing the agency team directly ('Your team should...', 'Your first week...')."

    prompt = f"""
    You are an expert internal strategist and mentor. Your job is to prepare the candidate for exactly how to execute this role if they win the job.
    Analyze this job opportunity and create a highly specific, chronological INTERNAL execution roadmap for them to follow.
    
    {background_context}

    JOB DETAILS:
    Title: {title}
    Description: {desc}

    OUTPUT FORMAT:
    
    Structure the response as 4 to 6 chronological phases. 
    Crucially, EVERY Phase title MUST include a specific timeframe (e.g., "Phase 1: First 2 Weeks — [Specific Action]", "Phase 2: Month 2 — [Specific Action]"). Do NOT use generic Phase titles. 
    
    Under each Phase title, write EXACTLY 3-4 short, punchy bullet points detailing the specific actions you will take. DO NOT write long block paragraphs.
    
    RULES:
    1. {perspective} Write it as a realistic, actionable battle plan, not a corporate summary.
    2. Explicitly leverage your specific skills and services ({agency_info}) into the steps. Detail EXACTLY how you will use them to solve the client's problems.
    3. Mention 1 or 2 specific tools (e.g., Notion, Zapier) organically to show you know *how* to execute, but DO NOT keyword stuff or list 5 different tools. It must sound natural.
    4. Make the steps incredibly specific to the job description. Do not give generic advice.
    5. Drop generic headers like "The Real Problem" or "Winning Strategy". Just output the chronological phases directly.
    6. BAN CORPORATE FLUFF. Do not say "We will begin by conducting..." or "Our team of experts will work closely...". Write direct, punchy, expert-level instructions. (e.g., "Interview all 10 team members 1-on-1 to document existing bottlenecks.")
    7. NO BLOCK PARAGRAPHS. Everything must be highly skimmable bullet points.
    """

    plan = generate_with_retry(prompt, is_json=False)
    return {"plan": plan}

class CompanyAnalysisRequest(BaseModel):
    job_id: str
    description: str

@app.post("/analyze-company")
def analyze_company(req: CompanyAnalysisRequest):
    prompt = f"Extract the company name, industry, and likely decision maker roles from this job description. Return JSON with keys: company_name, industry, targets (list of roles).\n\nJob: {req.description[:1000]}"
    
    content = generate_with_retry(prompt, is_json=True, model="llama-3.1-8b-instant")
    try:
        data = json.loads(content)
        # Ensure keys exist
        return {
            "company_name": data.get("company_name", "Unknown"),
            "industry": data.get("industry", "General"),
            "targets": data.get("targets", ["Hiring Manager"])
        }
    except:
        return {"company_name": "Unknown", "industry": "General", "targets": ["Hiring Manager"]}

@app.post("/leads/{lead_id}/update-status")
def update_application_status(lead_id: str, req: dict):
    with get_write_connection() as conn:
        conn.execute(
            "UPDATE job_leads SET applied = 1, applied_at = ?, agency_match = ?, client_proposal = ?, client_plan = ? WHERE id = ?",
            (datetime.now().isoformat(), req.get('agency_match'), req.get('client_proposal'), req.get('client_plan'), lead_id)
        )
    return {"success": True}

@app.post("/leads/{lead_id}/save-draft")
def save_draft(lead_id: str, req: dict):
    with get_write_connection() as conn:
        conn.execute(
            "UPDATE job_leads SET client_proposal = ?, client_plan = ? WHERE id = ?",
            (req.get('client_proposal'), req.get('client_plan'), lead_id)
        )
    return {"success": True}

class ClassifyRequest(BaseModel):
    title: str
    description: str

@app.post("/leads/classify")
def classify_job(req: ClassifyRequest):
    agency, confidence, score = fetchers.classify_with_ai(req.title, req.description)
    return {
        "agency": agency,
        "confidence": confidence,
        "score": score
    }

@app.post("/leads/{lead_id}/unapply")
def unmark_applied(lead_id: str):
    with get_write_connection() as conn:
        conn.execute(
            "UPDATE job_leads SET applied = 0, applied_at = NULL WHERE id = ?",
            (lead_id,)
        )
    return {"success": True}

@app.get("/leads/export-csv")
def export_applied_leads_csv():
    import csv
    import io
    from fastapi.responses import StreamingResponse

    with get_read_connection() as conn:
        rows = conn.execute("SELECT * FROM job_leads WHERE applied = 1 ORDER BY applied_at DESC").fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    if rows:
        writer.writerow(rows[0].keys())
        for row in rows: text_row = [str(x) for x in list(row)]; writer.writerow(text_row)
    else:
        writer.writerow(["No data"])

    output.seek(0)
    response = StreamingResponse(iter([output.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=applied_jobs.csv"
    return response

# Root
@app.get("/")
def read_root():
    return {"status": "Job Monitor V2 Active", "version": "2.0"}
