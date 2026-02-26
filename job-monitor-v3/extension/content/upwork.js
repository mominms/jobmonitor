// Prevent double execution
if (window.upworkScraperLoaded) {
    console.log('♻️ Scraper already loaded, skipping execution.');
    // return; // Cannot return from top-level in non-module? 
    // Actually, in Chrome Extensions content scripts are isolated worlds, but duplicate injection runs in same context?
    // Yes, multiple executeScript calls run in same context.
    // We wrap everything in an IIFE or just check flag.
    throw new Error("Scraper already loaded"); // Cleanest way to stop execution
}
window.upworkScraperLoaded = true;

console.log('🔍 Upwork Job Harvester loaded on:', window.location.href);
// DEBUG: Notify Service Worker of load
chrome.runtime.sendMessage({
    action: 'contentScriptLoaded',
    url: window.location.href
});
// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'harvestPage') {
        const jobs = harvestJobs();
        sendResponse({ jobs });
    } else if (message.action === 'harvestLinks') { // Phase 1: Links Only
        const links = harvestLinks();
        sendResponse({ links });
    }
    return true;
});

// Check for 404 - polling for SPA load
const check404 = setInterval(() => {
    const textContent = document.body.textContent;
    const is404 = document.title.includes('404') ||
        textContent.includes("Looking for something?") ||
        textContent.includes("We can't find this page") ||
        textContent.includes("Error 404") ||
        document.querySelector('img[alt="404"]') ||
        document.querySelector('.up-error-page') ||
        document.querySelector('.error-footer-code');

    if (is404) {
        console.log('⚠️ Detected 404, redirecting to search fallback...');
        clearInterval(check404);

        // Regex to robustly capture slug with optional trailing slash
        const match = window.location.pathname.match(/freelance-jobs\/([^\/]+)/);

        if (match && match[1]) {
            const keyword = match[1].replace(/-/g, ' ');
            console.log(`Redirecting for keyword: ${keyword}`);
            window.location.href = `https://www.upwork.com/nx/search/jobs/?q=${encodeURIComponent(keyword)}&sort=recency`;
        }
    }
}, 1000);

// Stop checking after 10 seconds to save resources
setTimeout(() => clearInterval(check404), 10000);

// Harvest jobs from current page
function harvestJobs() {
    const jobs = [];
    const isSearchPage = window.location.pathname.includes('/search/jobs') ||
        (window.location.pathname.includes('/freelance-jobs/') && !window.location.href.includes('~'));
    const isJobPage = window.location.href.includes('~');

    if (isSearchPage) {
        // Search results page - multiple jobs
        const jobCards = document.querySelectorAll('[data-test="job-tile-list"] article, .job-tile');

        if (jobCards.length === 0) {
            // Try alternate selectors
            const altCards = document.querySelectorAll('.up-card-section');
            altCards.forEach(card => {
                const job = parseJobCard(card);
                if (job) jobs.push(job);
            });
        } else {
            jobCards.forEach(card => {
                const job = parseJobCard(card);
                if (job) jobs.push(job);
            });
        }
    } else if (isJobPage) {
        // Single job page
        const job = parseJobPage();
        if (job) jobs.push(job);
    }

    console.log(`📦 Harvested ${jobs.length} jobs from Upwork`);
    return jobs;
}

// Phase 1: Harvest only links (fast)
function harvestLinks() {
    const links = [];
    // Select all job cards
    const jobCards = document.querySelectorAll('[data-test="job-tile-list"] article, .job-tile, .up-card-section');

    jobCards.forEach(card => {
        try {
            const titleEl = card.querySelector('h2 a, .job-tile-title a, [data-test="job-tile-title-link"]');
            if (titleEl && titleEl.href) {
                links.push(titleEl.href);
            }
        } catch (e) {
            console.error('Error extracting link:', e);
        }
    });

    console.log(`🔗 Harvested ${links.length} links`);
    return links;
}

// Parse a job card from search results
function parseJobCard(card) {
    try {
        // Title
        const titleEl = card.querySelector('h2 a, .job-tile-title a, [data-test="job-tile-title-link"]');
        const title = titleEl?.textContent?.trim();

        // URL
        const url = titleEl?.href || window.location.href;

        // Description
        const descEl = card.querySelector('.job-description, [data-test="job-description-text"], .text-body');
        const description = descEl?.textContent?.trim() || '';

        // Budget / Job Type
        let budget = 'N/A';
        const budgetEl = card.querySelector('[data-test="budget"], [data-test="job-type"], .job-type, strong[data-test="job-type-label"]');
        if (budgetEl) {
            budget = budgetEl.textContent.trim();
        } else {
            // Text Search Fallback for List View
            const textContent = card.textContent;
            const hourlyMatch = textContent.match(/Hourly:?\s*(\$\d+[.\d]*\s*-\s*\$\d+[.\d]*|\$\d+[.\d]*)/i);
            const fixedMatch = textContent.match(/Fixed-price:?\s*(\$\d+[kKmM,\d]*)/i); // e.g. $500, $5k, $1,000
            const estBudgetMatch = textContent.match(/Est\. Budget:?\s*(\$\d+[kKmM,\d]*)/i);

            if (hourlyMatch) budget = `Hoverly: ${hourlyMatch[1]}`; // Typo fix: Hourly
            else if (fixedMatch) budget = `Fixed: ${fixedMatch[1]}`;
            else if (estBudgetMatch) budget = `Est: ${estBudgetMatch[1]}`;
        }

        // Clean up common label noise
        budget = budget.replace('Hourly: ', '').replace('Fixed-price: ', '');


        // Posted time
        const postedEl = card.querySelector('[data-test="posted-on"], .job-tile-header-meta, [data-test="UpworkJobTile-posted-on"]');
        let posted = postedEl?.textContent?.trim() || '';
        // If relative time string found, convert to ISO immediately for sorting
        const postedIso = parseRelativeTime(posted) || new Date().toISOString();

        // ===== CONNECT SCORE SIGNALS =====

        // Payment Verified (look for verified badge/icon)
        const paymentVerified = !!card.querySelector('[data-test="payment-verified"], .payment-verified, .up-icon-filled-payment-verified, [aria-label*="Payment verified"]');

        // Client Total Spent
        const spentEl = card.querySelector('[data-test="client-spent"], .up-client-stats-row:first-child, [data-cy="client-total-spent"]');
        const clientSpentRaw = spentEl?.textContent?.trim() || '';
        const clientSpent = parseSpentAmount(clientSpentRaw);

        // Proposal Count
        const proposalEl = card.querySelector('[data-test="proposals"], .proposals-count, [data-cy="proposals"]');
        const proposalRaw = proposalEl?.textContent?.trim() || '';
        const proposalCount = parseProposalCount(proposalRaw);

        // Hire Rate
        const hireRateEl = card.querySelector('[data-test="hire-rate"], .up-client-stats-row, [data-cy="hire-rate"]');
        const hireRateRaw = hireRateEl?.textContent?.trim() || '';
        const hireRate = parseHireRate(hireRateRaw);

        // Client Location
        const locationEl = card.querySelector('[data-test="client-location"], .up-client-info-location, [data-cy="client-location"]');
        const clientLocation = locationEl?.textContent?.trim() || '';

        // Job Type (Hourly vs Fixed)
        const isHourly = budget.toLowerCase().includes('hourly') || budget.toLowerCase().includes('/hr');

        if (!title) return null;

        return {
            source: 'Upwork',
            external_id: extractJobId(url),
            title,
            description: description.substring(0, 1000),
            url,
            description: description.substring(0, 1000),
            url,
            budget,
            company: 'Upwork Client',
            posted_at: postedIso,
            // Connect Score Signals
            client_signals: {
                payment_verified: paymentVerified,
                client_spent: clientSpent,
                proposal_count: proposalCount,
                hire_rate: hireRate,
                client_location: clientLocation,
                is_hourly: isHourly
            }
        };
    } catch (err) {
        console.error('Error parsing job card:', err);
        return null;
    }
}

// Helper: Parse "$50K+" or "$1,000 spent" → number
// Helper: Parse "$50K+" or "$1,000 spent" or "$6.1K" → number
function parseSpentAmount(text) {
    if (!text) return 0;
    const match = text.match(/\$?([\d,.]+)([kK])?/i);
    if (!match) return 0;

    let rawNum = match[1].replace(/,/g, '');
    let amount = parseFloat(rawNum);

    if (match[2] && match[2].toLowerCase() === 'k') {
        amount *= 1000;
    } else if (match[2] && match[2].toLowerCase() === 'm') {
        amount *= 1000000;
    }

    return Math.round(amount);
}

// Helper: Parse "Less than 5" or "5 to 10" → midpoint number
function parseProposalCount(text) {
    if (!text) return 50; // Unknown = assume crowded
    const lower = text.toLowerCase();
    if (lower.includes('less than 5') || lower.includes('0 to 5')) return 3;
    if (lower.includes('5 to 10')) return 7;
    if (lower.includes('10 to 15')) return 12;
    if (lower.includes('15 to 20')) return 17;
    if (lower.includes('20 to 50')) return 35;
    if (lower.includes('50+') || lower.includes('more than 50')) return 60;
    const numMatch = text.match(/(\d+)/);
    return numMatch ? parseInt(numMatch[1], 10) : 50;
}

// Helper: Parse "90% hire rate" → 90
function parseHireRate(text) {
    if (!text) return 0;
    const match = text.match(/(\d+)%/);
    return match ? parseInt(match[1], 10) : 0;
}

// Parse single job page
function parseJobPage() {
    try {
        let title = document.querySelector('h1, .job-details-header h2')?.textContent?.trim();
        let description = '';
        const descSelectors = [
            '.text-body-sm.multiline-text',
            '.multiline-text',
            '.job-description',
            '[data-test="description"]',
            '.text-body',
            '.up-job-details .break',
            'div[data-test="job-description-text"]'
        ];

        for (const sel of descSelectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent.trim().length > 50) {
                description = el.textContent.trim();
                break;
            }
        }

        // Fallback: Find "Job Description" header and grab usually the next sibling or parent text
        if (!description) {
            const headers = Array.from(document.querySelectorAll('h2, h3, h4'));
            const descHeader = headers.find(h => h.textContent.includes('Job Description') || h.textContent.includes('Description'));
            if (descHeader) {
                // Try next sibling
                let sibling = descHeader.nextElementSibling;
                if (sibling) description = sibling.textContent.trim();
                // Or parent's text if structure is weird
                else description = descHeader.parentElement.textContent.trim();
            }
        }


        // ===== ROBUST BUDGET EXTRACTION =====
        let budget = 'N/A';
        // 1. Selector Search
        const budgetSelectors = [
            '[data-test="job-budget"]',
            '[data-test="budget"]',
            '.budget',
            '[data-test="job-type-label"] + small',
            '[data-test="job-type-label"] + div',
            '.job-type'
        ];

        for (const sel of budgetSelectors) {
            const el = document.querySelector(sel);
            if (el) {
                const text = el.textContent.trim();
                // Validate it looks like a price or rate
                if (text.includes('$') || text.toLowerCase().includes('hourly') || text.toLowerCase().includes('fixed')) {
                    budget = text;
                    break;
                }
            }
        }

        // 2. Text Search Fallback (if still N/A)
        if (budget === 'N/A') {
            const bodyText = document.body.textContent; // Uses textContent to avoid hidden element noise
            // Normalize whitespace for easier regex
            const cleanText = bodyText.replace(/\s+/g, ' ');

            // Patterns
            // 1. "Hourly: $30.00-$50.00" or "$30.00-$50.00 Hourly"
            const rangeMatch = cleanText.match(/(\$[0-9,.]+\s*-\s*\$[0-9,.]+)\s*(Hourly)?/i);
            // 2. "Hourly: $30.00"
            const hourlyLabelMatch = cleanText.match(/Hourly:?\s*(\$[0-9,.]+)/i);
            // 3. "$30.00 Hourly"
            const hourlySuffixMatch = cleanText.match(/(\$[0-9,.]+)\s*Hourly/i);

            // 4. Fixed Price
            const fixedMatch = cleanText.match(/Fixed-price:?\s*(\$[0-9,.]+[kKmM]?)/i);
            const estBudgetMatch = cleanText.match(/Est\. Budget:?\s*(\$[0-9,.]+[kKmM]?)/i);

            if (rangeMatch) {
                budget = rangeMatch[1];
                if (rangeMatch[2] || cleanText.includes(rangeMatch[0] + ' Hourly')) {
                    budget += ' /hr';
                }
            }
            else if (hourlyLabelMatch) budget = hourlyLabelMatch[1] + ' /hr';
            else if (hourlySuffixMatch) budget = hourlySuffixMatch[1] + ' /hr';
            else if (fixedMatch) budget = fixedMatch[1] + ' (Fixed)';
            else if (estBudgetMatch) budget = estBudgetMatch[1] + ' (Est)';
        }

        // Cleanup
        budget = budget.replace(/\s+/g, ' ').trim();


        const url = window.location.href;

        // ===== DEEP SIGNALS (Sidebar/Content) =====

        // 1. Payment Verified (Selector + Text Fallback)
        let paymentVerified = !!document.querySelector('[data-test="payment-verified"], .payment-verified, .up-icon-filled-payment-verified');
        if (!paymentVerified) {
            // Text fallback (Robust for 'Apply' page)
            paymentVerified = document.body.textContent.includes('Payment method verified') ||
                document.body.textContent.includes('Payment verified');
        }
        console.log(`🔎 Scraper Debug: Payment Verified? ${paymentVerified}`);

        // 2. Client Total Spent (Selector + Text Search)
        let clientSpent = 0;
        let hireRate = 0;
        let clientLocation = '';

        // Try standard Stats Section first
        const statsSection = document.querySelector('.client-activity-stats, .up-client-stats');

        if (statsSection) {
            // Spend
            const spentEl = Array.from(statsSection.querySelectorAll('div, span, strong'))
                .find(el => el.textContent.includes('spent'));
            if (spentEl) {
                // Usually "Over $10K total spent" or "$500 total spent"
                // Extract number near it
                const parent = spentEl.closest('li, div') || spentEl;
                console.log(`🔎 Scraper Debug: Raw Spend Text: "${parent.textContent}"`);
                clientSpent = parseSpentAmount(parent.textContent);
            } else {
                console.log(`🔎 Scraper Debug: 'spent' keyword not found in stats section`);
            }

            // Hire Rate
            const hireEl = Array.from(statsSection.querySelectorAll('div, span'))
                .find(el => el.textContent.includes('hire rate'));
            if (hireEl) {
                console.log(`🔎 Scraper Debug: Raw Hire Text: "${hireEl.textContent}"`);
                hireRate = parseHireRate(hireEl.textContent);
            }
        } else {
            console.log(`🔎 Scraper Debug: Stats Section (.client-activity-stats) NOT found`);
        }

        // TEXT SEARCH FAILSAFE (Iterate interesting elements)
        // Find elements containing "spent" to capture "$10K+ total spent"
        if (clientSpent === 0) {
            const potentialSpendEls = Array.from(document.querySelectorAll('div, span, strong, li')).filter(el =>
                el.textContent.toLowerCase().includes('total spent') && el.textContent.length < 100
            );

            for (const el of potentialSpendEls) {
                const amount = parseSpentAmount(el.textContent);
                if (amount > 0) {
                    clientSpent = amount;
                    console.log(`🔎 Scraper Debug: Found spent via text search: "${el.textContent}" -> ${clientSpent}`);
                    break;
                }
            }
        }

        // Hire Rate Text Search
        if (hireRate === 0) {
            const potentialHireEls = Array.from(document.querySelectorAll('div, span, li')).filter(el =>
                el.textContent.includes('hire rate') && el.textContent.length < 50
            );
            for (const el of potentialHireEls) {
                const rate = parseHireRate(el.textContent);
                if (rate > 0) {
                    hireRate = rate;
                    break;
                }
            }
        }

        // Proposal Count Text Search
        const proposalEl = document.querySelector('[data-test="proposals"], .proposals-count');
        let proposalCount = parseProposalCount(proposalEl?.textContent || '');
        if (proposalCount === 50) { // Default/Fallback
            // Try searching text "Proposals: 10 to 15"
            const propText = document.body.textContent.match(/Proposals:?\s*(\d+\s*to\s*\d+|Less than \d+|\d+\+)/i);
            if (propText) {
                proposalCount = parseProposalCount(propText[1]);
            }
        }
        // Fallback or additional sidebar checks (Upwork layout varies)
        if (clientSpent === 0) {
            const sideBarText = document.querySelector('.up-sidebar')?.textContent || '';
            clientSpent = parseSpentAmount(sideBarText);
        }

        const locationEl = document.querySelector('[data-test="client-country"], .client-location');
        clientLocation = locationEl?.textContent?.trim() || '';



        if (!title) {
            title = document.title.replace(' - Upwork', '').trim() || 'Unknown Job';
        }

        // Parse Posted Time
        let postedAt = new Date().toISOString(); // Default to now
        const postedSelectors = [
            '[itemprop="datePosted"]',
            '[data-test="PostedOn"] span',
            '#posted-on',
            '.up-active-context-title .text-muted',
            '[data-test="job-tile-header-meta"]'
        ];

        let timeText = '';
        for (const sel of postedSelectors) {
            const el = document.querySelector(sel);
            if (el) {
                timeText = el.textContent.trim();
                break;
            }
        }

        if (timeText) {
            console.log(`🔎 Scraper Debug: Check Posted Time Text: "${timeText}"`);
            const relativeTime = parseRelativeTime(timeText);
            if (relativeTime) {
                postedAt = relativeTime;
            }
        } else {
            // Text fallback: "Posted 5 minutes ago"
            const bodyText = document.body.textContent;
            const postedMatch = bodyText.match(/Posted\s+(\d+\s+\w+)\s+ago/i);
            if (postedMatch) {
                const relativeTime = parseRelativeTime(postedMatch[1]);
                if (relativeTime) postedAt = relativeTime;
            }
        }

        return {
            source: 'Upwork',
            external_id: extractJobId(url),
            title,
            description: description.substring(0, 2000),
            url,
            budget,
            company: 'Upwork Client',
            posted_at: postedAt,
            // Connect Score Signals
            client_signals: {
                payment_verified: paymentVerified,
                client_spent: clientSpent,
                proposal_count: proposalCount,
                hire_rate: hireRate,
                client_location: clientLocation,
                is_hourly: budget.toLowerCase().includes('hourly'),
                posted_time_text: timeText || '' // Backup text
            }
        };
    } catch (err) {
        console.error('Error parsing job page:', err);
        return null;
    }
}

// Helper: Parse "Posted 5 minutes ago" or "5m ago" -> ISO String
function parseRelativeTime(text) {
    if (!text) return null;
    text = text.toLowerCase();
    const now = new Date();

    // Extract number
    const match = text.match(/(\d+)/);
    if (!match) return null;
    const num = parseInt(match[1], 10);

    // Std: minute, hour, day
    // Short: m, h, d
    if (text.includes('second') || text.match(/\d+s\b/)) now.setSeconds(now.getSeconds() - num);
    else if (text.includes('minute') || text.match(/\d+m\b/)) now.setMinutes(now.getMinutes() - num);
    else if (text.includes('hour') || text.match(/\d+h\b/)) now.setHours(now.getHours() - num);
    else if (text.includes('day') || text.match(/\d+d\b/)) now.setDate(now.getDate() - num);
    else if (text.includes('week') || text.match(/\d+w\b/)) now.setDate(now.getDate() - (num * 7));
    else if (text.includes('month') || text.match(/\d+mo\b/)) now.setMonth(now.getMonth() - num);
    else return null;

    return now.toISOString();
}

// Extract job ID from URL
function extractJobId(url) {
    const match = url.match(/~([0-9a-f]+)/i) || url.match(/\/(\d+)\/?$/);
    return match ? match[1] : url;
}

// Auto-harvest on page load if monitoring is active
// Auto-harvest on page load
chrome.storage.local.get(['isMonitoring'], (state) => {
    // Robust detection of single job page (contains ~ID)
    const isJobPage = window.location.pathname.includes('~') &&
        (window.location.pathname.includes('/jobs/') || window.location.pathname.includes('/freelance-jobs/'));

    // Retry Logic (Poller)
    let attempts = 0;
    const maxAttempts = 20; // Increased to 40 seconds (Slow connection support)

    const poller = setInterval(() => {
        attempts++;
        const currentIsJobPage = window.location.href.includes('~');

        // Try to harvest
        const jobs = harvestJobs();

        if (jobs.length > 0) {
            const job = jobs[0];

            // Success Condition: Job data found AND Description is populated
            if (currentIsJobPage) {
                // Must have valuable content to be worth saving
                if (job.description && job.description.length > 50) {
                    console.log(`✨ Deep Scan Success (Attempt ${attempts}):`, job.title);

                    chrome.runtime.sendMessage({
                        action: 'jobEnriched',
                        external_id: job.external_id,
                        client_signals: job.client_signals,
                        posted_at: job.posted_at
                    });

                    clearInterval(poller); // Stop polling
                    return;
                } else {
                    console.log(`⏳ Waiting for description content... (${job.description.length} chars)`);
                }
            } else if (state.isMonitoring) {
                // List page - less strict, just need titles
                chrome.runtime.sendMessage({ action: 'jobsHarvested', jobs });
                clearInterval(poller);
                return;
            }
        }

        console.log(`⏳ Auto-harvest attempt ${attempts}/${maxAttempts}...`);

        if (attempts >= maxAttempts) {
            console.log('❌ Auto-harvest timed out. Content did not load or selectors failed.');
            clearInterval(poller);
        }
    }, 2000); // Check every 2s
});
