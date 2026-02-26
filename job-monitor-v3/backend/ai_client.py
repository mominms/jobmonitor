import os
import random
import time
from groq import Groq
import httpx
from dotenv import load_dotenv

load_dotenv()

# Load all available Groq keys
GROQ_KEYS = []
for i in range(1, 10):
    key = os.getenv(f"GROQ_API_KEY_{i}")
    if key:
        GROQ_KEYS.append(key)

if not GROQ_KEYS and os.getenv("GROQ_API_KEY"):
    GROQ_KEYS.append(os.getenv("GROQ_API_KEY"))

_groq_clients = [Groq(api_key=key) for key in GROQ_KEYS]

def get_groq_client():
    if not _groq_clients:
        return None
    return random.choice(_groq_clients)

def generate_with_retry(prompt: str, is_json: bool = False, max_retries: int = 3, model: str = "llama-3.3-70b-versatile"):
    """
    Unified interface to generate completions.
    Handles rotating Groq keys automatically via random.choice and retries on 429.
    """
    # Default to Groq
    for attempt in range(max_retries):
        try:
            client = get_groq_client()
            if not client:
                return "{}" if is_json else "Error: No API keys configured"
                
            completion = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"} if is_json else None
            )
            return completion.choices[0].message.content
        except Exception as e:
            err_msg = str(e)
            if "429" in err_msg or "rate limit" in err_msg.lower():
                print(f"[Attempt {attempt+1}/{max_retries}] Groq rate limit hit. Retrying...")
                time.sleep(1 + attempt)
                continue
            print(f"Groq API Error: {err_msg}")
            return "{}" if is_json else "Error generating response"
            
    return "{}" if is_json else "Error: Rate limit exceeded on all keys."
