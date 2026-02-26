# 🚀 Cloud Deployment & Setup Guide

This guide will help you bring your Job Monitor V3 online so multiple people can access it. We are using **Option A**: Hosting the Backend with a Persistent Disk for your SQLite database.

## 1. Backend Deployment (Railway.app)
Railway is the easiest way to host a FastAPI backend with a persistent SQLite database.

1.  **Create a Account**: Go to [Railway.app](https://railway.app/) and sign up with GitHub.
2.  **Create New Project**: Click "New Project" -> "Deploy from GitHub repo".
3.  **Select Repo**: Choose the repository containing your `job-monitor-v3` code.
4.  **Configure Root**: In settings, set the **Root Directory** to `backend`.
5.  **Add persistent storage**:
    *   Go to the "Volumes" tab for your backend service.
    *   Create a New Volume. Name it `backend_data`.
    *   Mount it to `/app/data` (this is where `jobs.db` will live).
6.  **Environment Variables**: Go to the "Variables" tab and add:
    *   `PORT`: `8002`
    *   `API_KEY`: `<YourSecretKey>` (Choose a strong code)
    *   `GROQ_API_KEY_1`: `<YourKey>`
    *   `DISCORD_WEBHOOK_URL`: `<YourWebhookURL>`
7.  **Command**: Railway should auto-detect, but if not, the start command is:
    `uvicorn main:app --host 0.0.0.0 --port 8002`

---

## 2. Frontend Deployment (Vercel)
Vercel is free and optimized for Next.js.

1.  **Signup**: Go to [Vercel](https://vercel.com/).
2.  **Import Project**: Import your GitHub repo.
3.  **Configure**:
    *   **Framework Preset**: Next.js
    *   **Root Directory**: `frontend`
4.  **Environment Variables**:
    *   `NEXT_PUBLIC_API_URL`: `https://your-backend-url.railway.app` (The URL Railway gives you).
5.  **Deploy**: Click Deploy.

---

## 3. Extension Configuration
Since only you will run the harvester, you need to tell your extension where the new cloud backend is.

1.  Open Chrome and go to your **Extension Settings**.
2.  Click **Load Unpacked** (select the `extension/` folder).
3.  Click the extension icon in your toolbar and click **Settings**.
4.  **Cloud Configuration**:
    *   **Backend API URL**: `https://your-backend-url.railway.app`
    *   **API Key / Access Code**: `<YourSecretKey>` (Must match what you put in Railway).
5.  Click **Save Changes**.

---

## 4. How to Access
*   **For You and the Other Person**:
    *   Visit your Vercel URL (e.g., `job-monitor-v3.vercel.app`).
    *   You will see a login screen. Enter your `<YourSecretKey>`.
    *   You can now see leads, generate proposals, and mark jobs as **Applied**.
*   **Syncing**: Because you are both on the same website talking to the same Railway database, any action one person takes (like marking a job as applied) will instantly reflect for the other person when they refresh.

> [!IMPORTANT]
> **Only you** should run "Harvest Jobs" from the dashboard or "Start Monitoring" in the extension. The extension runs on your local browser and sends the found data to the shared cloud database.
