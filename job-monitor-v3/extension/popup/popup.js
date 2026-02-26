// Popup Controller for AI Job Harvester

const API_BASE = 'http://localhost:8002';

// DOM Elements
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const harvestBtn = document.getElementById('harvest-btn');
const openDashboardBtn = document.getElementById('open-dashboard');
const statusEl = document.getElementById('status');
const harvestedCountEl = document.getElementById('harvested-count');
const tabsCountEl = document.getElementById('tabs-count');

// Settings Elements
const settingsLink = document.getElementById('settings-link');
const settingsView = document.getElementById('settings-view');
const backBtn = document.getElementById('back-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const settingInterval = document.getElementById('setting-interval');
const settingMaxTabs = document.getElementById('setting-max-tabs');
const kwInputs = {
    upwork: document.getElementById('kw-upwork'),
    linkedin: document.getElementById('kw-linkedin'),
    indeed: document.getElementById('kw-indeed'),
    wellfound: document.getElementById('kw-wellfound')
};

const settingApiUrl = document.getElementById('setting-api-url');
const settingApiKey = document.getElementById('setting-api-key');

// Site checkboxes
const siteUpwork = document.getElementById('site-upwork');
const siteLinkedin = document.getElementById('site-linkedin');
const siteIndeed = document.getElementById('site-indeed');
const siteWellfound = document.getElementById('site-wellfound');
const siteRss = document.getElementById('site-rss');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadState();
    await updateStats();
    await updateStats();

    // Settings Listeners
    settingsLink.addEventListener('click', () => toggleSettings(true));
    backBtn.addEventListener('click', () => toggleSettings(false));
    saveSettingsBtn.addEventListener('click', saveSettings);
});

function toggleSettings(show) {
    if (show) {
        settingsView.classList.remove('hidden');
    } else {
        settingsView.classList.add('hidden');
    }
}

// Load saved state
async function loadState() {
    const state = await chrome.storage.local.get([
        'isMonitoring', 'harvested', 'enabledSites',
        'refreshInterval', 'maxTabs', 'customKeywords',
        'apiUrl', 'apiKey'
    ]);

    if (state.isMonitoring) {
        setMonitoringState(true);
    }

    if (state.harvested) {
        harvestedCountEl.textContent = state.harvested;
    }

    if (state.enabledSites) {
        siteUpwork.checked = state.enabledSites.upwork ?? true;
        siteLinkedin.checked = state.enabledSites.linkedin ?? true;
        siteIndeed.checked = state.enabledSites.indeed ?? true;
        siteWellfound.checked = state.enabledSites.wellfound ?? false;
        siteRss.checked = state.enabledSites.rss ?? true;
    }

    // Load Settings Inputs
    settingInterval.value = state.refreshInterval || 15;
    settingMaxTabs.value = state.maxTabs || 3;
    settingApiUrl.value = state.apiUrl || 'http://localhost:8002';
    settingApiKey.value = state.apiKey || '';

    // Load Keywords
    if (state.customKeywords) {
        for (const [site, keywords] of Object.entries(state.customKeywords)) {
            if (kwInputs[site]) {
                kwInputs[site].value = keywords.join(', ');
            }
        }
    } else {
        // Defaults (broad coverage of AI + Marketing services + Industries)
        const defaults = {
            upwork: [
                'Automation', 'GoHighLevel', 'AI', 'Python', 'Zapier', 'Make', 'Chatbot', 'LLM',
                'Strategy', 'Executive', 'Consultant', 'Founder', 'CMO', 'Growth',
                'Cybersecurity', 'SOC Analyst', 'Penetration Testing', 'SIEM', 'Information Security',
                'System Administrator', 'Linux Admin', 'Windows Server', 'DevOps', 'Network Engineer',
                'Network Design', 'Cisco', 'Ubiquiti', 'IT Support', 'Help Desk', 'MSP',
                'Zabbix', 'Prometheus', 'Grafana', 'Datadog', 'Monitoring', 'Alerting'
            ],
            linkedin: [
                'Marketing Automation', 'Growth Engineer', 'AI Specialist',
                'Head of Growth', 'Fractional CMO', 'Technical Marketing',
                'Director of Operations', 'VP Finance',
                'Cybersecurity Consultant', 'Network Architect', 'SRE', 'Site Reliability Engineer',
                'IT Director', 'Head of IT', 'Security Engineer'
            ],
            indeed: [
                'Marketing Technologist', 'Automation Engineer', 'Growth Marketing',
                'Operations Manager', 'System Engineer', 'Network Administrator', 'IT Manager'
            ],
            wellfound: [
                'Growth Hacker', 'Marketing Automation', 'AI Engineer', 'Founder',
                'Chief of Staff', 'Head of Product', 'DevOps Engineer', 'Security Engineer'
            ]
        };
        for (const [site, kws] of Object.entries(defaults)) {
            if (kwInputs[site] && !kwInputs[site].value) {
                kwInputs[site].value = kws.join(', ');
            }
        }
    }
}

// Update stats
async function updateStats() {
    const tabs = await chrome.tabs.query({});
    const jobTabs = tabs.filter(t =>
        t.url?.includes('upwork.com') ||
        t.url?.includes('linkedin.com/jobs') ||
        t.url?.includes('indeed.com') ||
        t.url?.includes('wellfound.com')
    );
    tabsCountEl.textContent = jobTabs.length;
}

// Set monitoring state
function setMonitoringState(isActive) {
    if (isActive) {
        startBtn.disabled = true;
        stopBtn.disabled = false;
        statusEl.classList.add('active');
        statusEl.querySelector('.text').textContent = 'Monitoring...';
    } else {
        startBtn.disabled = false;
        stopBtn.disabled = true;
        statusEl.classList.remove('active');
        statusEl.querySelector('.text').textContent = 'Ready';
    }
}

// Start Monitoring
startBtn.addEventListener('click', async () => {
    const enabledSites = {
        upwork: siteUpwork.checked,
        linkedin: siteLinkedin.checked,
        indeed: siteIndeed.checked,
        wellfound: siteWellfound.checked,
        rss: siteRss.checked
    };

    // Save state
    await chrome.storage.local.set({ isMonitoring: true, enabledSites });

    // Send message to background to start
    try {
        chrome.runtime.sendMessage({ action: 'startMonitoring', sites: enabledSites });
    } catch (e) {
        console.error("Failed to start monitoring:", e);
        statusEl.querySelector('.text').textContent = 'Error: Reload Ext';
    }

    setMonitoringState(true);
});

// Stop Monitoring
stopBtn.addEventListener('click', async () => {
    try {
        chrome.runtime.sendMessage({ action: 'stopMonitoring' });
    } catch (e) {
        console.error("Failed to stop monitoring:", e);
    }
    setMonitoringState(false);
});

// Harvest Current Page
harvestBtn.addEventListener('click', async () => {
    harvestBtn.textContent = '⏳ Harvesting...';
    harvestBtn.disabled = true;

    try {
        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tab) {
            // Send message to content script
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'harvestPage' });

            if (response) {
                if (response.type === 'jobs' && response.jobs.length > 0) {
                    await sendToBackend(response.jobs);
                    // Update count
                    const state = await chrome.storage.local.get(['harvested']);
                    const newCount = (state.harvested || 0) + response.jobs.length;
                    await chrome.storage.local.set({ harvested: newCount });
                    harvestedCountEl.textContent = newCount;
                    harvestBtn.textContent = `✅ Harvested ${response.jobs.length} jobs!`;

                } else if (response.type === 'people' && response.people.length > 0) {
                    await sendContactsToBackend(response.people);
                    harvestBtn.textContent = `✅ Harvested ${response.people.length} contacts!`;

                } else {
                    harvestBtn.textContent = '❌ No data found';
                }
            } else {
                harvestBtn.textContent = '❌ No response';
            }
        }
    } catch (err) {
        console.error('Harvest error:', err);
        harvestBtn.textContent = '❌ Error harvesting';
    }

    setTimeout(() => {
        harvestBtn.textContent = '🌾 Harvest Current Page';
        harvestBtn.disabled = false;
    }, 2000);
});

// Send contacts to backend
async function sendContactsToBackend(contacts) {
    try {
        const state = await chrome.storage.local.get(['apiUrl', 'apiKey']);
        const baseUrl = state.apiUrl || 'http://localhost:8002';

        const response = await fetch(`${baseUrl}/contacts/ingest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.apiKey || ''}`
            },
            body: JSON.stringify({ contacts })
        });
        return await response.json();
    } catch (err) {
        console.error('Backend error:', err);
        throw err;
    }
}

// Send jobs to backend
async function sendToBackend(jobs) {
    try {
        const state = await chrome.storage.local.get(['apiUrl', 'apiKey']);
        const baseUrl = state.apiUrl || 'http://localhost:8002';

        const response = await fetch(`${baseUrl}/leads/ingest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.apiKey || ''}`
            },
            body: JSON.stringify({ jobs })
        });
        return await response.json();
    } catch (err) {
        console.error('Backend error:', err);
        throw err;
    }
}

// Open Dashboard
openDashboardBtn.addEventListener('click', async () => {
    const state = await chrome.storage.local.get(['dashboardUrl']);
    const url = state.dashboardUrl || 'http://localhost:3001';
    chrome.tabs.create({ url });
});

// Save site preferences on change
[siteUpwork, siteLinkedin, siteIndeed, siteWellfound, siteRss].forEach(checkbox => {
    checkbox.addEventListener('change', async () => {
        const enabledSites = {
            upwork: siteUpwork.checked,
            linkedin: siteLinkedin.checked,
            indeed: siteIndeed.checked,
            wellfound: siteWellfound.checked,
            rss: siteRss.checked
        };
        await chrome.storage.local.set({ enabledSites });
    });
});


// Save Settings
async function saveSettings() {
    const interval = parseInt(settingInterval.value) || 15;
    const maxTabs = parseInt(settingMaxTabs.value) || 3;

    const customKeywords = {};
    for (const [site, input] of Object.entries(kwInputs)) {
        customKeywords[site] = input.value.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }

    await chrome.storage.local.set({
        refreshInterval: interval,
        maxTabs: maxTabs,
        customKeywords: customKeywords,
        apiUrl: settingApiUrl.value.trim(),
        apiKey: settingApiKey.value.trim()
    });

    // Notify background to reload config
    try {
        chrome.runtime.sendMessage({ action: 'reloadConfig' });
    } catch (e) {
        console.warn("Could not reload config (SW may be sleeping):", e);
    }

    // UI Feedback
    saveSettingsBtn.textContent = '✅ Saved!';
    setTimeout(() => {
        saveSettingsBtn.textContent = '💾 Save Changes';
        toggleSettings(false);
    }, 1000);
}
