import feedparser
import requests
import sqlite3
import os
import json
import re
from datetime import datetime
from config import DB_PATH, AGENCY_KEYWORDS, REJECT_KEYWORDS, AGENCY_CONTEXT
from discord_notify import send_discord_notification
from ai_client import generate_with_retry
import time

from database import get_read_connection, get_write_connection, db_get_one, _translate_params

def should_reject_job(text):
    """Pre-filter: Check if job matches rejection criteria."""
# ... (rest of function is unchanged, but I need to make sure imports are right)

# ... (omitting middle parts, focusing on save_lead and imports)

def save_lead(lead_data):
    """Save lead to DB using Single-Writer Pipeline."""
    try:
        # 1. READ (Concurrent Check)
        exists = db_get_one("SELECT id FROM job_leads WHERE external_id = ?", (lead_data['external_id'],))
        if exists:
            return False

        # 2. WRITE (Serialized)
        lid = f"{lead_data['source']}_{lead_data['external_id']}"[:50]
        
        with get_write_connection() as conn:
            cur = conn.cursor()
            query = _translate_params("""
                INSERT INTO job_leads (
                    id, source, external_id, title, description, url, 
                    budget, company, posted_at, status, created_at, match_score
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, 0)
            """)
            cur.execute(query, (
                lid, lead_data['source'], lead_data['external_id'],
                lead_data['title'], lead_data['description'], lead_data['url'],
                lead_data.get('budget', 'N/A'), lead_data.get('company', 'Unknown'),
                lead_data.get('posted_at') or datetime.now().isoformat(), datetime.now().isoformat()
            ))
        return True

    except sqlite3.IntegrityError:
        return False
    except Exception as e:
        print(f"Save Error: {e}")
        return False



def build_ai_prompt(title, description):
    """Dynamically build AI prompt based on config.AGENCY_CONTEXT."""
    prompt = "Classify this job into ONE of the following business units:\n\n"
    
    for key, data in AGENCY_CONTEXT.items():
        prompt += f"{key.upper()} ({data['name']}):\n"
        prompt += f"  - Focus: {data['focus']}\n"
        prompt += f"  - Keywords: {', '.join(data.get('industries', [])[:5])}\n"
        prompt += f"  - Roles: {', '.join(data.get('target_roles', [])[:5])}\n\n"
        
    prompt += "If the job does not clearly fit ANY (e.g. entry level, low budget, unrelated), return REJECT.\n\n"
    prompt += f"JOB TITLE: {title}\n"
    prompt += f"JOB DESC: {description[:800]}\n\n" # Increased context
    
    prompt += "Return formatted JSON ONLY:\n"
    prompt += "{\n"
    prompt += '  "agency": "AGENCY_KEY" (or "reject"),\n'
    prompt += '  "confidence": 0.0 to 1.0,\n'
    prompt += '  "reasoning": "Short explanation",\n'
    prompt += '  "score": 0 to 100 (Fit Score independent of agency match)\n'
    prompt += "}"
    
    return prompt

def classify_with_ai(title, description):
    """Classify job using Groq with structured JSON output."""
    # 1. Pre-filter
    if should_reject_job(f"{title} {description}"):
        return "reject", 1.0, 0

    prompt = build_ai_prompt(title, description)
    content = generate_with_retry(prompt, is_json=True, model="llama-3.1-8b-instant")
    
    if not content or content.startswith("Error") or content == "{}":
        return "unassigned", 0.0, 0

    try:
        # Parse JSON
        data = json.loads(content)
        agency = data.get("agency", "unassigned").lower()
        confidence = float(data.get("confidence", 0.5))
        score = int(data.get("score", 50))
        
        # Map back to keys if AI output full name
        for key in AGENCY_CONTEXT.keys():
            if key in agency:
                agency = key
                break
                
        if agency not in AGENCY_CONTEXT and agency != "reject":
             agency = "unassigned"

        return agency, confidence, score

    except Exception as e:
        print(f"AI Classification Parsing Error: {e} - Content: {content}")
        return "unassigned", 0.0, 0

# --- Universal Fetchers ---

class UniversalRssFetcher:
    def __init__(self, source_config):
        self.config = source_config
        self.parsing_rules = json.loads(source_config['parsing_config'] or '{}')

    def fetch(self):
        print(f"Fetching RSS: {self.config['name']}...")
        try:
            feed = feedparser.parse(self.config['url'])
            count = 0
            for entry in feed.entries:
                # Apply filters if config has them
                if not self._passes_filter(entry):
                    continue

                lead = {
                    "source": self.config['name'],
                    "external_id": entry.id if 'id' in entry else entry.link,
                    "title": entry.title,
                    "description": entry.get("summary", "") or entry.get("description", ""),
                    "url": entry.link,
                    "company": self._extract_company(entry.title),
                    "budget": "N/A"
                }
                
                if save_lead(lead):
                    count += 1
            return count
        except Exception as e:
            print(f"Error fetching {self.config['name']}: {e}")
            return 0

    def _extract_company(self, title):
        # Common pattern "Company: Job Title" or "Job Title at Company"
        if ":" in title:
            return title.split(":")[0].strip()
        if " at " in title:
            return title.split(" at ")[-1].strip()
        return "Unknown"

    def _passes_filter(self, entry):
        # Implement keyword filtering from config if needed
        return True

class UniversalApiFetcher:
    def __init__(self, source_config):
        self.config = source_config
        self.parsing_rules = json.loads(source_config['parsing_config'] or '{}')

    def fetch(self):
        print(f"Fetching API: {self.config['name']}...")
        try:
            resp = requests.get(self.config['url'], headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
            data = resp.json()
            
            # Handle list location (root or nested key)
            items = data
            if self.parsing_rules.get('root_key'):
                items = data.get(self.parsing_rules['root_key'], [])
            
            count = 0
            for item in items:
                lead = self._map_item(item)
                if lead and save_lead(lead):
                    count += 1
            return count
        except Exception as e:
            print(f"Error fetching {self.config['name']}: {e}")
            return 0

    def _map_item(self, item):
        rules = self.parsing_rules
        try:
            return {
                "source": self.config['name'],
                "external_id": str(item.get(rules.get('id_key', 'id'))),
                "title": item.get(rules.get('title_key', 'title')),
                "description": item.get(rules.get('desc_key', 'description'), ""),
                "url": item.get(rules.get('url_key', 'url')),
                "company": item.get(rules.get('company_key', 'company'), "Unknown"),
                "budget": "N/A"
            }
        except:
            return None


def run_all_fetchers():
    """Executor for all configured sources."""
    # Use cursor to ensure compatibility
    with get_read_connection() as conn:
        cur = conn.cursor()
        query = _translate_params("SELECT * FROM job_sources WHERE enabled = 1")
        cur.execute(query)
        sources = cur.fetchall()

    total_new = 0
    yield f"progress:0:Starting fetch for {len(sources)} sources..."

    for i, source in enumerate(sources):
        try:
            result = 0
            if source['type'] == 'rss':
                result = UniversalRssFetcher(source).fetch()
            elif source['type'] == 'api':
                result = UniversalApiFetcher(source).fetch()
            
            total_new += result
            yield f"log:Fetched {result} from {source['name']}"
            
        except Exception as e:
            yield f"error:Failed {source['name']}: {e}"
            
        progress = int(((i + 1) / len(sources)) * 100)
        yield f"progress:{progress}:Processing..."

    yield f"done:{total_new}"



    

