# AI Job Harvester - Browser Extension

A powerful Edge/Chrome extension that harvests job leads from Upwork, LinkedIn, Indeed, and Wellfound directly into your Job Monitor dashboard.

## Features

- 🔍 **Multi-Platform Support** - Upwork, LinkedIn, Indeed, Wellfound
- 🤖 **AI Classification** - Jobs are automatically categorized by agency
- ⏰ **Auto-Refresh** - Periodically checks for new jobs
- 📊 **Dashboard Integration** - Jobs appear instantly in Job Monitor

## Installation

### Step 1: Open Edge Extension Settings
1. Open Microsoft Edge
2. Go to `edge://extensions/`
3. Enable "Developer mode" (toggle in bottom-left)

### Step 2: Load the Extension
1. Click "Load unpacked"
2. Navigate to: `C:\UserMS\environment\job-monitor\extension`
3. Click "Select Folder"

### Step 3: Pin the Extension
1. Click the puzzle icon in the toolbar
2. Pin "AI Job Harvester" for easy access

## Usage

### Start Monitoring
1. Click the extension icon
2. Select which platforms to monitor
3. Click "Start Monitoring"
4. The extension will open tabs and start harvesting

### Manual Harvest
1. Navigate to any job page (Upwork, LinkedIn, etc.)
2. Click the extension icon
3. Click "Harvest Current Page"
4. Jobs are sent to your dashboard

## Requirements

- Job Monitor backend running on `localhost:8002`
- Job Monitor frontend running on `localhost:3000`

## Supported Sites

| Site | URL Pattern |
|------|-------------|
| Upwork | upwork.com/nx/search/jobs |
| LinkedIn | linkedin.com/jobs/* |
| Indeed | indeed.com/jobs* |
| Wellfound | wellfound.com/jobs* |

## Icons

Note: You need to create PNG icons for the extension:
- `icon16.png` (16x16)
- `icon48.png` (48x48)  
- `icon128.png` (128x128)

You can use the included `icon.svg` and convert it to PNG online.
