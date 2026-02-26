// Dashboard Bridge - Relays messages from the frontend to the extension
console.log('🔌 Job Monitor Dashboard Bridge Loaded');

// Safety check: Verify extension context is valid
if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
    console.error('❌ Extension context invalid! Please reload this page after reloading the extension.');
    const banner = document.createElement('div');
    banner.innerHTML = '⚠️ Extension disconnected. Please <a href="javascript:location.reload()" style="color:yellow">reload this page</a>.';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:red;color:white;padding:10px;text-align:center;z-index:99999;font-weight:bold;';
    document.body.appendChild(banner);
}

// 1. Listen for messages from the Extension Backend (Background Script)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extensionProgress') {
        // Forward progress updates to the webpage (Frontend)
        window.postMessage(message, '*');
    }
});


// 2. Listen for messages from the Web Page (Frontend)
window.addEventListener('message', (event) => {
    // Security check: Only accept messages from the same window
    if (event.source !== window) return;

    // Safety check before sending
    if (!chrome?.runtime?.sendMessage) {
        console.error('❌ Cannot send message - extension context lost. Reload page.');
        return;
    }

    if (event.data.action === 'startMonitoring') {
        console.log('🔌 Bridge: Start Monitoring', event.data);
        chrome.runtime.sendMessage(event.data);
    }
    else if (event.data.action === 'stopHarvest') {
        console.log('🔌 Bridge: STOP Harvest');
        chrome.runtime.sendMessage({ action: 'stopHarvest' });
    }
    else if (event.data.action === 'getStatus') {
        // Optional: Manual status poll
        chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
            if (response) window.postMessage(response, '*');
        });
    }
});
