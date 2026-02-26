# Agency Classification Skill

This document defines the classification rules for routing job leads to the appropriate business unit.

---

## Business Units

### 1. ASCEND - Growth Marketing Agency

**Focus**: D2C & Growth Marketing, Paid Social, E-commerce Scaling

**Ideal Job Keywords** (Include):
- marketing, growth, ads, seo, content marketing
- paid media, ppc, facebook ads, tiktok ads, google ads
- shopify, d2c, direct to consumer, ecommerce, e-commerce
- klaviyo, funnel, landing page, conversion
- brand strategy, copywriting, email marketing
- social media, influencer, ugc, creative

**Industries**:
- Consumer Goods, Retail, E-commerce
- Health & Wellness, Food & Beverage
- Apparel & Fashion, Cosmetics

**Sample Job Titles**:
- CMO, VP Marketing, Head of Growth, Performance Marketing Manager
- Paid Media Manager, E-commerce Manager, Brand Strategist

---

### 2. APEX - Fractional C-Suite & Strategy

**Focus**: Executive Leadership, Strategic Planning, Operational Efficiency

**Ideal Job Keywords** (Include):
- executive, c-suite, fractional, interim
- ceo, cfo, coo, cmo, cto, chief
- vp, vice president, director, board, advisor
- strategy, strategic planning, operations, operational
- finance, financial, p&l, budgeting, forecast, estimations
- due diligence, m&a, private equity, portfolio, scaling

**Industries**:
- Venture Capital & Private Equity
- Investment Management, Professional Services
- Manufacturing, Consumer Products

**Sample Job Titles**:
- CEO, CFO, COO, Chief of Staff
- Operating Partner, VP Finance, Director of Operations
- Strategic Advisor, Board Member

---

### 3. SOCKETLOGIC - Tech & Automation Engineering

**Focus**: Custom Integrations, Backend Development, Process Automation

**Ideal Job Keywords** (Include):
- python, javascript, typescript, api, backend
- automation, integration, workflow, scripting
- developer, engineer, devops, cloud, aws, gcp
- saas, software, application, microservices
- zapier, make, n8n, airbyte, no-code, low-code
- chatbot, llm, ai, machine learning, data, scraping
- database, sql, mongodb, postgresql

**Industries**:
- Computer Software, Information Technology
- Financial Services (Fintech), Healthcare Tech
- Logistics and Supply Chain

**Sample Job Titles**:
- CTO, VP Engineering, Head of Engineering
- Automation Engineer, DevOps Manager, IT Director
- Data Engineer, Backend Developer, AI Specialist

---

### 4. THESHIELD - Legal & Compliance (Future)

**Focus**: Legal Documentation, Compliance, HR Policies

**Ideal Job Keywords** (Include):
- legal, compliance, gdpr, privacy policy
- terms of service, contracts, nda, agreement
- hr, human resources, employee handbook
- regulatory, audit, risk management

**Note**: This unit is currently in development. Jobs matching these keywords may be held for future processing.

---

## Rejection Criteria

Jobs matching these criteria should be **REJECTED** (not shown to user):

**Reject Keywords**:
- babysitter, nanny, childcare
- personal assistant (generic, low-value)
- data entry (grunt work, low margin)
- virtual assistant (generic)
- transcription, typing
- customer service representative (non-strategic)
- "looking for someone cheap"
- "need ASAP" + "budget $50" (low-value rush jobs)

**Reject Conditions**:
- Budget explicitly stated as < $100 for a project
- Job description < 50 characters (spam/low effort)
- Title contains "intern" or "unpaid"

---

## Classification Logic

1. **Pre-Filter**: Check for REJECT keywords first. If match → discard.
2. **AI Classification**: Send to Groq with this context:
   - Return: `AGENCY | CONFIDENCE` (e.g., `SOCKETLOGIC | 0.95`)
   - If no good match: `UNASSIGNED | 0.3`
3. **Fallback Keywords**: If AI fails, use keyword matching:
   - Count keyword hits per agency.
   - Highest score wins (ties go to first match).

---

## Example Classifications

| Job Title | Description Snippet | Result |
|-----------|---------------------|--------|
| "Python Developer for API Integration" | "Build REST API to connect our CRM..." | SOCKETLOGIC |
| "Facebook Ads Manager - D2C Brand" | "Scale our Shopify store from $1M to $5M..." | ASCEND |
| "Fractional CFO for Series A Startup" | "Need part-time finance leadership..." | APEX |
| "Looking for a nanny" | "Need someone to watch my kids..." | REJECT |
| "General Virtual Assistant" | "Data entry and scheduling..." | REJECT |

---

## Source Reference

This skill is derived from:
- `c:\UserMS\environment\agency\Lead_Search_Filters.txt`
- `c:\UserMS\environment\agency\SocketLogic\Plan.md`
- Internal agency positioning documents
