// Indeed Content Script - Parses job listings from Indeed

console.log('🔍 Indeed Job Harvester loaded');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'harvestPage') {
        const jobs = harvestJobs();
        sendResponse({ jobs });
    }
    return true;
});

function harvestJobs() {
    const jobs = [];

    // Job cards on search results
    const jobCards = document.querySelectorAll('.job_seen_beacon, .jobsearch-ResultsList > li, [data-testid="job-result"]');

    jobCards.forEach(card => {
        try {
            // Title
            const titleEl = card.querySelector('h2 a, .jobTitle > a, [data-testid="job-title"]');
            const title = titleEl?.textContent?.trim();

            // URL
            let url = titleEl?.href;
            if (!url && titleEl) {
                const jobKey = card.getAttribute('data-jk');
                url = jobKey ? `https://www.indeed.com/viewjob?jk=${jobKey}` : window.location.href;
            }

            // Company
            const companyEl = card.querySelector('.companyName, [data-testid="company-name"]');
            const company = companyEl?.textContent?.trim() || 'Unknown';

            // Location
            const locationEl = card.querySelector('.companyLocation, [data-testid="text-location"]');
            const location = locationEl?.textContent?.trim() || '';

            // Salary
            const salaryEl = card.querySelector('.salary-snippet, .metadata.salary-snippet-container');
            const budget = salaryEl?.textContent?.trim() || 'N/A';

            // Description snippet
            const descEl = card.querySelector('.job-snippet, [data-testid="jobsnippet"]');
            const description = descEl?.textContent?.trim() || '';

            if (!title) return;

            jobs.push({
                source: 'Indeed',
                external_id: extractJobId(url),
                title,
                description: `${description}\n\nLocation: ${location}`.substring(0, 1000),
                url,
                budget,
                company,
                posted_at: new Date().toISOString()
            });
        } catch (err) {
            console.error('Error parsing Indeed job:', err);
        }
    });

    console.log(`📦 Harvested ${jobs.length} jobs from Indeed`);
    return jobs;
}

function extractJobId(url) {
    const match = url?.match(/jk=([a-f0-9]+)/i);
    return match ? match[1] : url || `indeed-${Date.now()}`;
}

// Auto-harvest if monitoring
chrome.storage.local.get(['isMonitoring'], (state) => {
    if (state.isMonitoring) {
        setTimeout(() => {
            const jobs = harvestJobs();
            if (jobs.length > 0) {
                chrome.runtime.sendMessage({ action: 'jobsHarvested', jobs });
            }
        }, 2000);
    }
});
