// LinkedIn Content Script - Parses job listings from LinkedIn Jobs

console.log('🔍 LinkedIn Job Harvester loaded');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'harvestPage') {
        const url = window.location.href;

        // Decide what to harvest based on URL or Content
        if (url.includes('/jobs/') || url.includes('/jobs/search')) {
            const jobs = harvestJobs();
            sendResponse({ jobs, type: 'jobs' });
        } else if (url.includes('/search/results/people') || url.includes('/in/')) {
            const people = harvestPeople();
            sendResponse({ people, type: 'people' });
        } else {
            // Try both?
            const jobs = harvestJobs();
            if (jobs.length > 0) {
                sendResponse({ jobs, type: 'jobs' });
            } else {
                const people = harvestPeople();
                sendResponse({ people, type: 'people' });
            }
        }
    }
    return true;
});

function harvestPeople() {
    console.log('🕵️ Harvesting People...');
    const people = [];

    // Search Results
    const personCards = document.querySelectorAll('.reusable-search__result-container, .entity-result');

    personCards.forEach(card => {
        try {
            const nameEl = card.querySelector('.entity-result__title-text a span[aria-hidden="true"]');
            const name = nameEl?.textContent?.trim();

            if (!name || name === 'LinkedIn Member') return;

            const linkEl = card.querySelector('.app-aware-link');
            const url = linkEl?.href || '';

            const roleEl = card.querySelector('.entity-result__primary-subtitle');
            const role = roleEl?.textContent?.trim() || '';

            const locEl = card.querySelector('.entity-result__secondary-subtitle');
            const location = locEl?.textContent?.trim() || '';

            people.push({
                name,
                role,
                location,
                url,
                source: 'LinkedIn'
            });
        } catch (e) {
            console.error('Error parsing person:', e);
        }
    });

    // Profile Page
    if (window.location.href.includes('/in/') && people.length === 0) {
        try {
            // Basic Profile Scrape
            const name = document.querySelector('h1.text-heading-xlarge')?.textContent?.trim();
            const role = document.querySelector('div.text-body-medium')?.textContent?.trim();
            const location = document.querySelector('span.text-body-small.inline')?.textContent?.trim();

            if (name) {
                people.push({
                    name,
                    role: role || 'Unknown',
                    location: location || '',
                    url: window.location.href,
                    source: 'LinkedIn'
                });
            }
        } catch (e) {
            console.error('Error parsing profile:', e);
        }
    }

    console.log(`🕵️ Found ${people.length} people`);
    return people;
}

function harvestJobs() {
    const jobs = [];

    // Job cards in search results
    const jobCards = document.querySelectorAll('.job-card-container, .jobs-search-results__list-item, .scaffold-layout__list-item');

    jobCards.forEach(card => {
        try {
            // Title
            const titleEl = card.querySelector('.job-card-list__title, .job-card-container__link, a[data-control-name="job_card_title"]');
            const title = titleEl?.textContent?.trim();

            // URL
            const url = titleEl?.href || window.location.href;

            // Company
            const companyEl = card.querySelector('.job-card-container__company-name, .job-card-container__primary-description');
            const company = companyEl?.textContent?.trim() || 'Unknown';

            // Location
            const locationEl = card.querySelector('.job-card-container__metadata-item, .artdeco-entity-lockup__caption');
            const location = locationEl?.textContent?.trim() || '';

            // Description (usually need to click into job for full desc)
            const description = `Company: ${company}\nLocation: ${location}`;

            if (!title) return;

            jobs.push({
                source: 'LinkedIn',
                external_id: extractJobId(url),
                title,
                description,
                url,
                budget: 'N/A',
                company,
                posted_at: new Date().toISOString()
            });
        } catch (err) {
            console.error('Error parsing LinkedIn job:', err);
        }
    });

    // Also try to get the selected job details panel
    const detailsPanel = document.querySelector('.jobs-unified-top-card, .job-details-jobs-unified-top-card');
    if (detailsPanel) {
        try {
            const title = detailsPanel.querySelector('h1, h2')?.textContent?.trim();
            const company = detailsPanel.querySelector('.jobs-unified-top-card__company-name, a[data-tracking-control-name="public_jobs_topcard-org-name"]')?.textContent?.trim();
            const description = document.querySelector('.jobs-description, .jobs-box__html-content')?.textContent?.trim() || '';

            if (title && !jobs.find(j => j.title === title)) {
                jobs.push({
                    source: 'LinkedIn',
                    external_id: extractJobId(window.location.href),
                    title,
                    description: description.substring(0, 1500),
                    url: window.location.href,
                    budget: 'N/A',
                    company: company || 'Unknown',
                    posted_at: new Date().toISOString()
                });
            }
        } catch (err) {
            console.error('Error parsing LinkedIn details:', err);
        }
    }

    console.log(`📦 Harvested ${jobs.length} jobs from LinkedIn`);
    return jobs;
}

function extractJobId(url) {
    const match = url?.match(/\/(\d+)\/?/);
    return match ? match[1] : url || `linkedin-${Date.now()}`;
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
