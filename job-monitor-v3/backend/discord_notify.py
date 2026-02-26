import requests
from config import DISCORD_WEBHOOK_URL


def send_discord_notification(lead):
    """
    Sends a rich embed to Discord for a new job lead.
    """
    # Color logic
    color = 0x10B981  # Emerald (Default)
    if lead["agency_match"] == "ascend":
        color = 0x3B82F6  # Blue
    elif lead["agency_match"] == "apex":
        color = 0xF59E0B  # Amber

    embed = {
        "title": f"New Lead: {lead['title']}",
        "description": (
            lead["description"][:200] + "..."
            if lead["description"]
            else "No description"
        ),
        "url": lead["url"],
        "color": color,
        "fields": [
            {
                "name": "Agency Match",
                "value": lead["agency_match"].upper(),
                "inline": True,
            },
            {"name": "Source", "value": lead["source"], "inline": True},
            {
                "name": "AI Score",
                "value": f"{int(lead.get('match_score', 0) * 100)}%",
                "inline": True,
            },
        ],
        "footer": {"text": "Job Monitor AI • " + lead["posted_at"][:10]},
    }

    payload = {"username": "Job Monitor", "embeds": [embed]}

    try:
        requests.post(DISCORD_WEBHOOK_URL, json=payload)
        # print("  Sent Discord notification")
    except Exception as e:
        print(f"Failed to send Discord notification: {e}")
