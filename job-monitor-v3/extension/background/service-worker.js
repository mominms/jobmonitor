// Background Service Worker for AI Job Harvester V2

let API_BASE = 'http://localhost:8002';
let DASHBOARD_URL = 'http://localhost:3001';

// --- Configuration ---
let REFRESH_INTERVAL_MINUTES = 15;
let MAX_TABS_PHASE_1 = 5;  // User requested 5 tabs at a time
const MAX_TABS_PHASE_2 = 5;  // Deep Scrape tabs
let SEARCH_KEYWORDS = {};     // Loaded from storage

// --- State ---
let isMonitoring = false;
let phase = 'idle'; // 'idle', 'discovery', 'deep_scrape'
let discoveryQueue = []; // { site, keyword, url }
let linkQueue = [];      // { url, site } (Unique URLs to deep scrape)
let activeTabIds = new Set();
let deepScrapeBatch = []; // Current batch of 5
let stats = {
    discovered: 0,
    processed: 0,
    totalToProcess: 0
};

// --- Initialization ---

async function loadConfig() {
    const data = await chrome.storage.local.get(['refreshInterval', 'maxTabs', 'customKeywords', 'apiUrl', 'dashboardUrl']);
    if (data.refreshInterval) REFRESH_INTERVAL_MINUTES = parseInt(data.refreshInterval);
    if (data.maxTabs) MAX_TABS_PHASE_1 = parseInt(data.maxTabs);
    if (data.customKeywords) SEARCH_KEYWORDS = data.customKeywords;
    if (data.apiUrl) API_BASE = data.apiUrl;
    if (data.dashboardUrl) DASHBOARD_URL = data.dashboardUrl;
}

chrome.runtime.onInstalled.addListener(loadConfig);
chrome.runtime.onStartup.addListener(loadConfig);

// --- Message Handling ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startMonitoring') {
        const sites = message.sites || { upwork: true };
        const customKeywords = message.keywords || {}; // Support instant overrides
        startHarvestingCycle(sites, customKeywords);
        sendResponse({ success: true });
    } else if (message.action === 'stopMonitoring' || message.action === 'stopHarvest') {
        stopHarvesting();
        sendResponse({ success: true });
    } else if (message.action === 'reloadConfig') {
        loadConfig();
        sendResponse({ success: true });
    } else if (message.action === 'openDashboard') {
        chrome.tabs.create({ url: DASHBOARD_URL });
        sendResponse({ success: true });
    } else if (message.action === 'getStatus') {
        // Immediate status check
        sendResponse(getProgressPayload());
    }
    return true;
});

// --- Scheduler (Alarms) ---
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'harvestCycle') {
        console.log('⏰ Alarm Triggered: Starting Scheduled Harvest');
        // Retrieve configs again to be sure
        chrome.storage.local.get(['enabledSites', 'customKeywords'], (data) => {
            if (data.enabledSites) {
                startHarvestingCycle(data.enabledSites, data.customKeywords || {});
            }
        });
    }
});


// --- Core Logic: Phase 1 (Link Discovery) ---

async function startHarvestingCycle(enabledSites, customKeywords = {}) {
    if (isMonitoring) return;
    isMonitoring = true;
    stats.discovered = 0;
    stats.processed = 0;
    stats.totalToProcess = 0;

    console.log('🚀 Starting Harvesting Cycle V2');
    console.log('🔹 Loaded Defaults:', SEARCH_KEYWORDS);
    console.log('🔹 Instant Overrides:', customKeywords);
    broadcastProgress();

    if (enabledSites.rss) {
        console.log('📡 Triggering RSS Fetch...');
        const state = await chrome.storage.local.get(['apiKey']);
        fetch(`${API_BASE}/leads/refresh`, {
            headers: { 'Authorization': `Bearer ${state.apiKey || ''}` }
        }).catch(err => console.error('RSS Error:', err));
    }

    // 2. Build Discovery Queue
    discoveryQueue = [];
    linkQueue = []; // Reset link queue
    activeTabIds.clear();

    for (const [site, enabled] of Object.entries(enabledSites)) {
        if (!enabled || site === 'rss') continue;

        // Load keywords: Override -> Storage -> Default
        const keywords = customKeywords[site] || SEARCH_KEYWORDS[site] || getDefaultKeywords(site);
        console.log(`🔸 Site: ${site}, Keywords:`, keywords);

        for (const kw of keywords) {
            const url = buildSearchUrl(site, kw);
            if (url) {
                console.log(`   ➡ URL built: ${url}`);
                discoveryQueue.push({ site, keyword: kw, url });
            } else {
                console.warn(`   ❌ Invalid URL for ${site} keyword: ${kw}`);
            }
        }
    }

    console.log(`📋 Phase 1: Discovered ${discoveryQueue.length} search pages to scan.`);

    if (discoveryQueue.length === 0) {
        console.warn("⚠️ No keywords configured! Stopping.");

        if (chrome.notifications) {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'No Keywords Configured',
                message: 'Please update settings with keywords.'
            });
        } else {
            console.error("❌ chrome.notifications API not available. Cannot notify user.");
        }

        stopHarvesting();
        return;
    }

    phase = 'discovery';
    broadcastProgress();
    processDiscoveryQueue();
}

function processDiscoveryQueue() {
    if (!isMonitoring) return;
    broadcastProgress();

    // Check if done
    if (discoveryQueue.length === 0 && activeTabIds.size === 0) {
        console.log(`✅ Phase 1 Complete. Found ${linkQueue.length} links.`);
        startDeepScrapePhase();
        return;
    }

    // STRICT BATCHING: Only start next batch if NO tabs are active
    if (activeTabIds.size > 0) return;

    // Start next batch of 5
    const batchSize = Math.min(MAX_TABS_PHASE_1, discoveryQueue.length);
    console.log(`📋 Starting Batch: Opening ${batchSize} keyword tabs...`);

    for (let i = 0; i < batchSize; i++) {
        const task = discoveryQueue.shift();
        openDiscoveryTab(task);
    }
}

function openDiscoveryTab(task) {
    console.log(`🔓 Attempting to open tab for: ${task.url}`);
    // Reserve slot synchronously
    const placeholderId = 'pending_' + Date.now() + Math.random();
    activeTabIds.add(placeholderId);

    chrome.tabs.create({ url: task.url, active: false }, (tab) => {
        console.log('🟢 Create callback fired. Tab:', tab);
        // Swap placeholder for real ID
        activeTabIds.delete(placeholderId);
        if (!tab) {
            console.error("❌ Tab creation failed:", chrome.runtime.lastError);
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'Tab Opening Failed',
                message: 'Browser blocked tab creation. Please check popup settings.'
            });
            // Ensure slot is freed
            activeTabIds.delete(placeholderId);
            processDiscoveryQueue();
            return;
        }

        const tabId = tab.id;
        activeTabIds.add(tabId);
        console.log(`🔍 Scanning ${task.site}: ${task.keyword}`);

        // Inject & Scrape
        setTimeout(() => {
            // Check if tab still exists before messaging
            chrome.tabs.get(tabId, () => {
                if (chrome.runtime.lastError) {
                    console.warn(`Tab ${tabId} closed before scrape.`);
                    activeTabIds.delete(tabId);
                    processDiscoveryQueue();
                    return;
                }

                chrome.tabs.sendMessage(tabId, { action: 'harvestLinks' }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.warn('Scrape skipped (tab closed/error):', chrome.runtime.lastError.message);
                    } else if (response && response.links) {
                        console.log(`🔗 Got ${response.links.length} links from ${task.keyword}`);
                        // Add unique links
                        response.links.forEach(link => {
                            if (!linkQueue.includes(link)) {
                                linkQueue.push(link);
                                stats.discovered++;
                            }
                        });
                    }

                    // Cleanup safely
                    safelyRemoveTab(tabId);
                });
            });
        }, 12000);
    });
}


// --- Core Logic: Phase 2 (Deep Scrape) ---

function startDeepScrapePhase() {
    phase = 'deep_scrape';
    stats.totalToProcess = linkQueue.length;
    activeTabIds.clear();
    console.log(`🔬 Starting Phase 2: Deep Scrape of ${linkQueue.length} jobs.`);
    broadcastProgress();
    processDeepScrapeQueue();
}

function processDeepScrapeQueue() {
    if (!isMonitoring) return;
    broadcastProgress();

    // Check if done
    if (linkQueue.length === 0 && activeTabIds.size === 0) {
        console.log('🎉 Harvesting Cycle Complete!');
        scheduleNextRun();
        return;
    }

    // Strict batch of 5
    while (activeTabIds.size < MAX_TABS_PHASE_2 && linkQueue.length > 0) {
        const url = linkQueue.shift();
        openDeepScrapeTab(url);
    }
}

function openDeepScrapeTab(url) {
    // Reserve slot synchronously
    const placeholderId = 'pending_' + Date.now() + Math.random();
    activeTabIds.add(placeholderId);

    chrome.tabs.create({ url: url, active: false }, (tab) => {
        // Swap placeholder
        activeTabIds.delete(placeholderId);
        if (!tab) return;

        const tabId = tab.id;
        activeTabIds.add(tabId);

        // Inject & Scrape Full Details
        setTimeout(() => {
            chrome.tabs.sendMessage(tabId, { action: 'harvestPage' }, async (response) => {
                if (response && response.jobs && response.jobs.length > 0) {
                    const job = response.jobs[0];
                    await ingestJobs([job]);
                    stats.processed++;
                }
                // Cleanup
                safelyRemoveTab(tabId);
                processDeepScrapeQueue();
            });
        }, 12000);
    });
}


// --- Helpers ---

function safelyRemoveTab(tabId) {
    if (activeTabIds.has(tabId)) {
        chrome.tabs.remove(tabId, () => {
            if (chrome.runtime.lastError) {
                // Ignore "No tab with id" errors as we just want it gone
                console.log(`Tab ${tabId} already closed.`);
            }
            activeTabIds.delete(tabId);
            // If in discovery phase, continue queue
            if (phase === 'discovery') processDiscoveryQueue();
            // If in deep scrape phase, continue queue
            if (phase === 'deep_scrape') processDeepScrapeQueue();
        });
    }
}

function stopHarvesting() {
    isMonitoring = false;
    // Clear any pending alarms
    chrome.alarms.clear('harvestCycle');

    // ... reset state ...
    phase = 'idle';
    discoveryQueue = [];
    linkQueue = [];
    // Use safelyRemoveTab to handle "No tab with id" errors
    activeTabIds.forEach(tid => safelyRemoveTab(tid));
    activeTabIds.clear();
    console.log('🛑 Harvesting Stopped.');
    broadcastProgress(); // Final update
}

function scheduleNextRun() {
    console.log(`⏳ Cycle done. Scheduling next run in ${REFRESH_INTERVAL_MINUTES} minutes.`);

    // We stay "isMonitoring = true" but phase becomes "waiting"
    phase = 'waiting';
    broadcastProgress();

    chrome.alarms.create('harvestCycle', { delayInMinutes: REFRESH_INTERVAL_MINUTES });
}

function getProgressPayload() {
    // Calculate ETA
    let etaSeconds = 0;
    if (phase === 'deep_scrape') {
        const remaining = linkQueue.length; // + active? roughly
        // 5 jobs every 10 seconds = 0.5 jobs/sec
        etaSeconds = Math.ceil(remaining / 0.5);
    } else if (phase === 'discovery') {
        // Rough estimate for discovery
        etaSeconds = (discoveryQueue.length / MAX_TABS_PHASE_1) * 10;
    }

    return {
        action: 'extensionProgress',
        isMonitoring,
        phase,
        discovered: stats.discovered,
        processed: stats.processed,
        totalToProcess: stats.totalToProcess,
        eta: etaSeconds
    };
}

function broadcastProgress() {
    const payload = getProgressPayload();
    // Send to all dashboard tabs
    chrome.tabs.query({ url: DASHBOARD_URL + "/*" }, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, payload, () => {
                // Ignore errors if dashboard tab was closed during broadcast
                if (chrome.runtime.lastError) return;
            });
        });
    });
}

async function ingestJobs(jobs) {
    try {
        const state = await chrome.storage.local.get(['apiKey']);
        await fetch(`${API_BASE}/leads/ingest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.apiKey || ''}`
            },
            body: JSON.stringify({ jobs })
        });
        const storageState = await chrome.storage.local.get(['harvested']);
        await chrome.storage.local.set({ harvested: (storageState.harvested || 0) + jobs.length });
    } catch (e) {
        console.error('Ingest Error:', e);
    }
}

function buildSearchUrl(platform, keyword) {
    const encoded = encodeURIComponent(keyword);
    switch (platform) {
        case 'upwork': return `https://www.upwork.com/nx/search/jobs/?q=${encoded}&sort=recency&per_page=20`;
        case 'linkedin': return `https://www.linkedin.com/jobs/search/?keywords=${encoded}`;
        case 'indeed': return `https://www.indeed.com/jobs?q=${encoded}`;
        case 'wellfound': return `https://wellfound.com/role/l/${encoded.replace(/ /g, '-')}`;
        default: return null;
    }
}

function getDefaultKeywords(site) {
    // User requested NO default keywords to force manual configuration
    return [];
}
