// Wellfound (AngelList) Content Script - Parses startup job listings

console.log('🔍 Wellfound Job Harvester loaded');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'harvestPage') {
        const jobs = harvestJobs();
        sendResponse({ jobs });
    }
    return true;
});

function harvestJobs() {
    const jobs = [];

    // Job cards on search/browse pages
    const jobCards = document.querySelectorAll('[data-test="StartupResult"], .styles_component__1n_x_, .styles_jobSearchResult__');

    jobCards.forEach(card => {
        try {
            // Title
            const titleEl = card.querySelector('h2 a, .styles_title__, a[data-test="Role-title"]');
            const title = titleEl?.textContent?.trim();

            // URL
            const url = titleEl?.href || window.location.href;

            // Company
            const companyEl = card.querySelector('.styles_startupName__, h1, [data-test="Startup-name"]');
            const company = companyEl?.textContent?.trim() || 'Startup';

            // Salary
            const salaryEl = card.querySelector('.styles_compensation__, [data-test="Salary"]');
            const budget = salaryEl?.textContent?.trim() || 'Equity + Salary';

            // Tags/Skills
            const tagsEl = card.querySelectorAll('.styles_tag__, .styles_skill__');
            const tags = Array.from(tagsEl).map(t => t.textContent?.trim()).join(', ');

            // Description
            const descEl = card.querySelector('.styles_description__, .styles_text__');
            const description = descEl?.textContent?.trim() || tags;

            if (!title) return;

            jobs.push({
                source: 'Wellfound',
                external_id: extractJobId(url),
                title,
                description: `${description}\n\nSkills: ${tags}`.substring(0, 1000),
                url,
                budget,
                company,
                posted_at: new Date().toISOString()
            });
        } catch (err) {
            console.error('Error parsing Wellfound job:', err);
        }
    });

    // Also check for job detail page
    if (jobs.length === 0) {
        try {
            const title = document.querySelector('h1[data-test="Role-title"], .styles_roleTitle__')?.textContent?.trim();
            const company = document.querySelector('[data-test="Startup-name"], .styles_startupName__')?.textContent?.trim();
            const description = document.querySelector('.styles_roleDescription__, [data-test="Role-description"]')?.textContent?.trim();
            const salary = document.querySelector('[data-test="Salary"]')?.textContent?.trim();

            if (title) {
                jobs.push({
                    source: 'Wellfound',
                    external_id: extractJobId(window.location.href),
                    title,
                    description: description?.substring(0, 1500) || '',
                    url: window.location.href,
                    budget: salary || 'Equity + Salary',
                    company: company || 'Startup',
                    posted_at: new Date().toISOString()
                });
            }
        } catch (err) {
            console.error('Error parsing Wellfound detail:', err);
        }
    }

    console.log(`📦 Harvested ${jobs.length} jobs from Wellfound`);
    return jobs;
}

function extractJobId(url) {
    const match = url?.match(/\/l\/([^\/\?]+)/);
    return match ? match[1] : url || `wellfound-${Date.now()}`;
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
