# 🚀 Job Monitor V3: 100% Free Hosting Guide

This guide explains how to deploy your Job Monitor V3 application using entirely free-tier services.

## 🏗️ Architecture
1.  **Frontend**: [Vercel](https://vercel.com/) (Free Tier)
2.  **Backend**: [Render](https://render.com/) (Free Tier - Web Service)
3.  **Database**: [Supabase](https://supabase.com/) (Free Tier - PostgreSQL)

---

## 1. 💾 Database Setup (Supabase)
Supabase provides a free PostgreSQL database that persists your data.

1.  Sign up at [supabase.com](https://supabase.com/).
2.  Create a new project.
3.  Go to **Project Settings** > **Database**.
4.  Copy the **Connection String** (use the "URI" format). It will look like: 
    `postgresql://postgres:[YOUR-PASSWORD]@db.[REF].supabase.co:5432/postgres`
    *   **Pro Tip**: Ensure you replace `[YOUR-PASSWORD]` with your actual database password.

---

## 2. ⚙️ Backend Deployment (Render)
Render allows you to host Python APIs for free.

1.  Push your code to a GitHub repository.
2.  Sign up at [render.com](https://render.com/) and connect your GitHub.
3.  Create a **New Web Service**.
4.  Select your repository.
5.  **Settings**:
    *   **Runtime**: `Python 3`
    *   **Build Command**: `pip install -r requirements.txt`
    *   **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6.  **Environment Variables**:
    *   `DATABASE_URL`: Your Supabase URI string.
    *   `API_KEY`: A secure random string (e.g., `my-super-secret-key`).
    *   `GROQ_API_KEY`: Your Groq/OpenAI key.

---

## 3. 🖥️ Frontend Deployment (Vercel)
Vercel is the easiest place to host Next.js apps.

1.  Sign up at [vercel.com](https://vercel.com/) and connect GitHub.
2.  Import your repository.
3.  **Environment Variables**:
    *   `NEXT_PUBLIC_API_URL`: Your Render Web Service URL (e.g., `https://your-app.onrender.com`).
4.  **Deploy**.

---

## 4. 🧩 Extension Configuration
1.  Open Chrome and go to `chrome://extensions`.
2.  Reload the **Job Monitor V3 Extension**.
3.  Click the extension icon and click **Settings**.
4.  Enter your **Render URL** (e.g., `https://your-app.onrender.com`) in the "Backend API URL" field.
5.  Enter your **API Key** in the "API Key" field.
6.  Click **Save**.

---

## 5. 🤝 Team Collaboration & Access
1.  **Sharing**: Give your teammate the Vercel URL and the API Key.
2.  **Login**: Visit the Vercel URL. You'll be prompted for the API Key. Once entered, it's saved in your browser.
3.  **Syncing**: Any action taken (like marking a job as "Applied") reflects instantly for everyone using the same database.

🚀 **Your SaaS is now live, secure, and costing you $0/month!**
