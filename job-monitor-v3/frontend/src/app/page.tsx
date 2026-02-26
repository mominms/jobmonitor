"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";

const getApiBase = () => {
  // Use environment variable if available, fallback to 127.0.0.1 for local dev
  return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8002";
};

const getHeaders = () => {
  const key = localStorage.getItem("job_monitor_api_key");
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${key}`
  };
};

interface JobLead {
  id: string;
  source: string;
  title: string;
  description: string;
  url: string;
  agency_match: string;
  match_score: number;
  status: string;
  posted_at: string;
  company?: string;
  budget?: string;
  applied?: number;
  applied_at?: string;
  applied_by?: string;
  connect_score?: number;
  client_proposal?: string;
  client_plan?: string;
}

interface SystemHealth {
  status: string;
  metrics: {
    avg_ai_time_sec: number;
    throughput_jobs_min: number;
    queue_length: number;
  };
  recommendation: string;
}

interface CompanyAnalysis {
  company_name: string;
  industry: string;
  targets: string[];
}

// Helper: Relative Time
const timeAgo = (dateStr: string) => {
  const diff = (new Date().getTime() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const key = localStorage.getItem("job_monitor_api_key");
    if (!key) {
      router.push("/login");
    }
  }, [router]);
  // ... existing Home component code ...

  // In Job Card (around line 800 originally):
  // <span className="font-mono text-emerald-400 font-bold">{timeAgo(lead.posted_at)}</span>

  // I will apply the specific replacements below using the context.

  const [leads, setLeads] = useState<JobLead[]>([]);
  const [filter, setFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("jobs"); // "jobs" | "notifications"
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<JobLead | null>(null);
  const [aiProposal, setAiProposal] = useState("");
  const [aiPlan, setAiPlan] = useState("");
  const [companyAnalysis, setCompanyAnalysis] = useState<CompanyAnalysis | null>(null);
  const [generating, setGenerating] = useState(false);
  const [analyzingCompany, setAnalyzingCompany] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [enhancedDescription, setEnhancedDescription] = useState("");
  const [proposalPersona, setProposalPersona] = useState<"agency" | "individual">("agency");

  const suggestAgency = async () => {
    if (!selectedLead || (!selectedLead.title && !selectedLead.description)) return;
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/leads/classify`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          title: selectedLead.title || "Unknown Title",
          description: selectedLead.description || "No description provided."
        }),
      });
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      if (data.agency) {
        setSelectedLead({ ...selectedLead, agency_match: data.agency });
      }
    } catch (err) {
      console.error("Failed to suggest agency", err);
    }
  };

  // Phase 11: Manual Mode
  const [isManual, setIsManual] = useState(false);
  const [manualLead] = useState<JobLead>({
    id: 'manual',
    source: 'Manual Input',
    title: '',
    description: '',
    url: '#',
    agency_match: 'socketlogic', // Default
    match_score: 1.0,
    status: 'new',
    applied: 0,
    posted_at: new Date().toISOString()
  });

  const toggleManualMode = () => {
    if (isManual) {
      setIsManual(false);
      setSelectedLead(null);
    } else {
      setIsManual(true);
      setSelectedLead(manualLead);
      // Reset outputs
      setAiPlan("");
      setAiProposal("");
      setCompanyAnalysis(null);
      setEnhancedDescription("");
    }
  };

  const saveManualLead = async () => {
    if (!selectedLead?.title) {
      alert("Please enter a job title.");
      return;
    }
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/leads/manual`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          title: selectedLead.title,
          description: selectedLead.description,
          agency_match: selectedLead.agency_match,
          url: selectedLead.url || "#",
          company: selectedLead.company || "Unknown"
        }),
      });
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      if (data.success) {
        const newLead = {
          ...selectedLead,
          id: data.id,
          source: "Manual Input",
          posted_at: new Date().toISOString()
        };
        setLeads([newLead, ...leads]);
        setIsManual(false);
        setSelectedLead(newLead);
      } else {
        alert("Failed to save job lead.");
      }
    } catch (err) {
      console.error("Failed to save manual lead", err);
      alert("An error occurred while saving the job lead.");
    }
  };

  const saveDraft = async () => {
    if (!selectedLead?.id || selectedLead.id === 'manual') {
      alert("Please save the manual job lead first.");
      return;
    }
    if (!aiProposal && !aiPlan) return;
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/leads/${selectedLead.id}/save-draft`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          client_proposal: aiProposal,
          client_plan: aiPlan
        }),
      });
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      if (data.success) {
        setLeads(leads.map(l =>
          l.id === selectedLead.id ? { ...l, client_proposal: aiProposal, client_plan: aiPlan } : l
        ));
        setSelectedLead({ ...selectedLead, client_proposal: aiProposal, client_plan: aiPlan });
        alert("Drafts saved successfully!");
      } else {
        alert("Failed to save drafts.");
      }
    } catch (err) {
      console.error("Failed to save drafts", err);
      alert("An error occurred while saving drafts.");
    }
  };

  const [error, setError] = useState("");

  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [showHealth, setShowHealth] = useState(false);

  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");

  // Phase 2 Extension Progress State
  const [extProgress, setExtProgress] = useState({
    isMonitoring: false,
    phase: 'idle',
    discovered: 0,
    processed: 0,
    totalToProcess: 0,
    eta: 0
  });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.action === 'extensionProgress') {
        setExtProgress(event.data);
        // Also update main loading state if active
        if (event.data.isMonitoring) setLoading(true);
        else {
          setLoading(false);
          if (extProgress.isMonitoring) fetchLeads(); // Refresh on finish
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [extProgress.isMonitoring]);

  const stopHarvesting = () => {
    window.postMessage({ action: 'stopHarvest' }, '*');
    // Optimistic update
    setExtProgress(prev => ({ ...prev, isMonitoring: false, phase: 'idle' }));
  };

  const fetchLeads = () => {
    // Only show loading if we have no data yet to keep view stable
    if (leads.length === 0) setLoading(true);
    setError("");

    const apiBase = getApiBase();

    fetch(`${apiBase}/leads`, {
      headers: getHeaders()
    })
      .then(res => {
        if (res.status === 401) { router.push("/login"); throw new Error("Unauthorized"); }
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setLeads(data);
        } else {
          console.error("API returned non-array data:", data);
          setLeads([]);
          setError("Invalid data received from server");
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch leads", err);
        setError(`Failed to reach ${apiBase}: ${err.message}`);
        setLoading(false);
      });
  };

  const refreshJobs = async () => {
    // Don't clear view, just show progress bar
    if (leads.length === 0) setLoading(true);
    setError("");

    const apiBase = getApiBase();

    setProgress(5);
    setProgressMsg("Initializing...");

    // Trigger Extension (Upwork)
    // Uses keywords configured in the Extension Popup
    window.postMessage({ action: "startMonitoring" }, "*");

    // UI Feedback (Polling for results instead of streaming)
    setProgress(10);
    setProgressMsg("Extension started. Waiting for results...");

    // Fallback: Check for new leads after 5 seconds then 15 seconds
    setTimeout(() => fetchLeads(), 5000);
    setTimeout(() => fetchLeads(), 15000);
  };

  const fetchSystemHealth = () => {
    const apiBase = getApiBase();
    fetch(`${apiBase}/system/health`, {
      headers: getHeaders()
    })
      .then(res => {
        if (res.status === 401) { router.push("/login"); return; }
        return res.json();
      })
      .then(data => setSystemHealth(data))
      .catch(err => console.error("Failed to fetch system health", err));
  };

  useEffect(() => {
    fetchLeads();
    fetchSystemHealth();
    const interval = setInterval(fetchLeads, 60000); // Poll every minute
    const healthInterval = setInterval(fetchSystemHealth, 30000); // Poll health every 30s
    return () => {
      clearInterval(interval);
      clearInterval(healthInterval);
    };
    return () => {
      clearInterval(interval);
      clearInterval(healthInterval);
    };
  }, []);

  // Phase 13: Advanced Sorting
  const [sortMode, setSortMode] = useState<'recency' | 'score' | 'smart'>('smart');

  // Filter Logic
  const filteredLeads = leads.filter(lead => {
    const matchesFilter = filter === "all"
      ? true
      : filter === "applied"
        ? lead.applied === 1
        : lead.agency_match === filter;

    const matchesSource = sourceFilter === "all"
      ? true
      : lead.source === sourceFilter;

    return matchesFilter && matchesSource;
  }).sort((a, b) => {
    // 1. Score Sort
    if (sortMode === 'score') {
      return (b.match_score || 0) - (a.match_score || 0);
    }

    // 2. Smart Sort (Double Filter: Tiered Score + Recency)
    // Tier 1: 90+ Score
    // Tier 2: 70-89 Score
    // Tier 3: Others
    if (sortMode === 'smart') {
      const scoreA = a.match_score || 0;
      const scoreB = b.match_score || 0;

      const getTier = (s: number) => s >= 90 ? 3 : (s >= 70 ? 2 : 1);
      const tierA = getTier(scoreA);
      const tierB = getTier(scoreB);

      if (tierA !== tierB) return tierB - tierA; // Higher tier first
      // Same tier? Fall through to Recency
    }

    // 3. Recency (Default & Tie-breaker)
    return new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime();
  });



  const generateProposal = async () => {
    if (!selectedLead) return;
    setGenerating(true);
    setAiProposal("");

    try {
      const apiBase = getApiBase();
      const payload = {
        job_id: selectedLead.id === 'manual' ? null : selectedLead.id,
        title: selectedLead.id === 'manual' ? selectedLead.title : null,
        description: selectedLead.id === 'manual' ? selectedLead.description : null,
        enhanced_description: enhancedDescription,
        agency: selectedLead.agency_match || 'socketlogic',
        proposal_persona: proposalPersona
      };

      const res = await fetch(`${apiBase}/generate-proposal`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAiProposal(data.proposal);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const generatePlan = async () => {
    if (!selectedLead) return;
    setGenerating(true);
    setAiPlan("");

    try {
      const apiBase = getApiBase();
      const payload = {
        job_id: selectedLead.id === 'manual' ? null : selectedLead.id,
        title: selectedLead.id === 'manual' ? selectedLead.title : null,
        description: selectedLead.id === 'manual' ? selectedLead.description : null,
        enhanced_description: enhancedDescription,
        agency: selectedLead.agency_match || 'socketlogic'
      };

      const res = await fetch(`${apiBase}/generate-action-plan`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAiPlan(data.plan);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const analyzeCompany = async () => {
    if (!selectedLead) return;
    setAnalyzingCompany(true);
    setCompanyAnalysis(null);

    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/analyze-company`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          job_id: selectedLead.id,
          description: enhancedDescription || selectedLead.description
        }),
      });
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setCompanyAnalysis(data);
    } catch (err) {
      console.error("Failed to analyze company", err);
    }
    setAnalyzingCompany(false);
  };

  // State for Apply Confirmation Modal
  const [applyConfirmLead, setApplyConfirmLead] = useState<JobLead | null>(null);

  const initiateApply = (lead: JobLead, e: React.MouseEvent) => {
    e.stopPropagation();
    if (lead.applied === 1) {
      // If already applied, just toggle off (unapply) without confirmation
      toggleApplied(lead, "socketlogic"); // Agency doesn't matter for unapply
    } else {
      // If applying, show confirmation modal
      setApplyConfirmLead({ ...lead });
    }
  };

  const confirmApply = async () => {
    if (!applyConfirmLead) return;
    await toggleApplied(applyConfirmLead, applyConfirmLead.agency_match);
    setApplyConfirmLead(null);
  };

  const toggleApplied = async (lead: JobLead, confirmedAgency: string) => {
    const currentlyApplied = lead.applied === 1;
    const apiBase = getApiBase();
    const endpoint = currentlyApplied
      ? `${apiBase}/leads/${lead.id}/unapply`
      : `${apiBase}/leads/${lead.id}/update-status`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(currentlyApplied ? {} : {
          applied_by: "User",
          agency_match: confirmedAgency,
          client_proposal: aiProposal,
          client_plan: aiPlan
        }),
      });
      if (res.status === 401) { router.push("/login"); return; }

      // Update local state
      setLeads(leads.map(l =>
        l.id === lead.id
          ? { ...l, applied: currentlyApplied ? 0 : 1, agency_match: confirmedAgency, applied_at: new Date().toISOString(), client_proposal: aiProposal, client_plan: aiPlan }
          : l
      ));

      if (selectedLead?.id === lead.id) {
        setSelectedLead({ ...selectedLead, applied: currentlyApplied ? 0 : 1, agency_match: confirmedAgency, client_proposal: aiProposal, client_plan: aiPlan });
      }
    } catch (err) {
      console.error('Error toggling applied status:', err);
    }
  };

  const downloadCsv = () => {
    const apiBase = getApiBase();
    const key = localStorage.getItem("job_monitor_api_key");
    window.open(`${apiBase}/leads/export-csv?api_key=${key}`, '_blank');
  };

  // Open Lead Modal
  const openLead = (lead: JobLead) => {
    setSelectedLead(lead);
    setAiProposal(lead.client_proposal || "");
    setAiPlan(lead.client_plan || "");
    setCompanyAnalysis(null);
    setEnhancedDescription("");
  };

  // Computed Stats
  const stats = {
    total: leads.length,
    ascend: leads.filter(l => l.agency_match === 'ascend').length,
    apex: leads.filter(l => l.agency_match === 'apex').length,
    socket: leads.filter(l => l.agency_match === 'socketlogic').length,
    applied: leads.filter(l => l.applied === 1).length
  };

  // Calculate Source Counts
  const sources = Array.from(new Set(leads.map(l => l.source)));
  const sourceCounts = sources.reduce((acc, source) => {
    acc[source] = leads.filter(l => l.source === source).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <main className="min-h-screen bg-gray-950 text-white font-sans flex flex-col">
      {/* Apply Confirmation Modal */}
      {applyConfirmLead && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold">Confirm Agency</h3>
            <p className="text-sm text-gray-400">Classify this job before marking as applied:</p>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-white truncate">{applyConfirmLead.title}</div>
              <div className="grid grid-cols-1 gap-2">
                {['ascend', 'apex', 'socketlogic'].map(agency => (
                  <button
                    key={agency}
                    onClick={() => setApplyConfirmLead({ ...applyConfirmLead, agency_match: agency })}
                    className={`p-3 rounded-lg border text-left capitalize transition-all ${applyConfirmLead.agency_match === agency
                      ? 'bg-blue-600/20 border-blue-500 text-blue-400 font-bold'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                      }`}
                  >
                    {applyConfirmLead.agency_match === agency ? '✓ ' : ''} {agency}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setApplyConfirmLead(null)}
                className="flex-1 py-2 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmApply}
                className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 font-bold shadow-lg shadow-emerald-900/20"
              >
                Confirm & Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Header */}
      <div className="md:hidden bg-gray-900 border-b border-gray-800 p-4 flex justify-between items-center sticky top-0 z-40">
        <h1 className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
          Job Monitor
        </h1>
        <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="text-gray-400">
          ☰
        </button>
      </div>

      {/* Main Content Area (Centered) */}
      <div className={`flex-1 transition-all duration-300 ${selectedLead ? 'md:pr-[400px]' : ''}`}>

        {/* Main Feed - Centered Container */}
        <div className="w-full max-w-5xl mx-auto p-4 md:p-6 pb-20">

          {/* Header Controls */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              {/* Applied Filters Button */}
              <button
                onClick={() => setFilter(filter === 'applied' ? 'all' : 'applied')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 border ${filter === 'applied'
                  ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/50'
                  : 'bg-gray-900 text-gray-400 border-gray-800 hover:border-gray-600'
                  }`}
              >
                {filter === 'applied' ? '✓ Viewing Applied' : '📋 View Applied'}
              </button>

              {/* Export Button (only visible when viewing applied) */}
              {filter === 'applied' && (
                <button
                  onClick={downloadCsv}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-900 text-gray-300 border border-gray-700 hover:bg-gray-800 flex items-center gap-2"
                >
                  ⬇ Export CSV
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={toggleManualMode}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 border ${isManual
                  ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-900/40'
                  : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'
                  }`}
              >
                {isManual ? '✏️ Manual Active' : '➕ Manual Input'}
              </button>
            </div>
          </div>

          {/* Tab Bar Navigation */}
          <div className="flex justify-center mb-8 sticky top-0 md:relative z-30 pt-4 md:pt-0 bg-gray-950/95 backdrop-blur md:bg-transparent pb-4 md:pb-0">
            <div className="bg-gray-900 p-1 rounded-full border border-gray-800 flex gap-1 shadow-lg">
              <button
                className={`px-8 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${activeTab === 'jobs'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 scale-[1.02]'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
              >
                Job Feed ({filteredLeads.length})
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`px-8 py-2.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${activeTab === 'notifications'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 scale-[1.02]'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
              >
                Activity Log
                {filteredLeads.length > 0 && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse ring-2 ring-green-500/30"></span>}
              </button>
            </div>

            {/* System Health Pulse */}
            <button
              onClick={() => setShowHealth(!showHealth)}
              className="absolute right-0 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-gray-900 border border-gray-800 hover:border-gray-600 transition"
            >
              <div className={`w-2 h-2 rounded-full ${systemHealth?.status === 'Healthy' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-xs text-gray-400 font-mono">System: {systemHealth?.status || '...'}</span>
            </button>
          </div>

          {/* System Health Modal */}
          {showHealth && systemHealth && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowHealth(false)}>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  🩺 System Health Monitor
                </h3>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                    <div className="text-xs text-gray-500 uppercase mb-1">Avg AI Time</div>
                    <div className="text-xl font-mono text-blue-400">{systemHealth.metrics.avg_ai_time_sec}s</div>
                  </div>
                  <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                    <div className="text-xs text-gray-500 uppercase mb-1">Throughput</div>
                    <div className="text-xl font-mono text-emerald-400">{systemHealth.metrics.throughput_jobs_min}/min</div>
                  </div>
                  <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                    <div className="text-xs text-gray-500 uppercase mb-1">Queue Depth</div>
                    <div className="text-xl font-mono text-amber-400">{systemHealth.metrics.queue_length}</div>
                  </div>
                  <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                    <div className="text-xs text-gray-500 uppercase mb-1">Status</div>
                    <div className={`text-xl font-bold ${systemHealth.status === 'Healthy' ? 'text-emerald-500' : 'text-red-500'}`}>{systemHealth.status}</div>
                  </div>
                </div>

                <div className="bg-blue-900/20 border border-blue-900/50 p-4 rounded-xl">
                  <div className="text-xs font-bold text-blue-400 uppercase mb-2">💡 Optimization Tip</div>
                  <p className="text-sm text-gray-300">{systemHealth.recommendation}</p>
                </div>

                <button
                  onClick={() => setShowHealth(false)}
                  className="absolute top-4 right-4 text-gray-500 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {activeTab === 'jobs' ? (
            /* JOBS VIEW */
            <>
              {/* Desktop Header */}
              <header className="hidden md:flex mb-8 justify-between items-center bg-gray-900/30 p-6 rounded-2xl border border-gray-800/50 backdrop-blur-sm">
                <div>
                  <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
                    Job Lead Monitor
                  </h1>
                  <p className="text-gray-400 text-sm">Real-time freelance opportunities</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {progress > 0 && (
                    <div className="w-64">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>{progressMsg}</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-500 h-2 transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Extension Progress Bar (Phase 1 & 2) */}
                  {extProgress.isMonitoring && (
                    <div className="w-64 bg-gray-800/80 p-3 rounded-lg border border-blue-900/50 shadow-lg animate-pulse">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                          {extProgress.phase === 'discovery' ? 'Phase 1: Discovery' : 'Phase 2: Deep Scan'}
                        </span>
                        <span className="text-xs text-gray-400 font-mono">ETA: {extProgress.eta}s</span>
                      </div>

                      {/* Progress Line */}
                      <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden mb-2">
                        <div
                          className={`h-full transition-all duration-500 ${extProgress.phase === 'discovery' ? 'bg-purple-500' : 'bg-emerald-500'}`}
                          style={{
                            width: extProgress.phase === 'deep_scrape'
                              ? `${(extProgress.processed / (extProgress.totalToProcess || 1)) * 100}%`
                              : '100%'
                          }} // Indeterminate for discovery, real for scrape
                        ></div>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-300">
                          {extProgress.phase === 'discovery'
                            ? `Found ${extProgress.discovered} links...`
                            : `Scraping ${extProgress.processed}/${extProgress.totalToProcess}`}
                        </span>
                        <button
                          onClick={stopHarvesting}
                          className="text-[10px] bg-red-900/50 text-red-400 px-2 py-0.5 rounded border border-red-900 hover:bg-red-900 hover:text-white transition-colors"
                        >
                          STOP
                        </button>
                      </div>
                    </div>
                  )}

                  {!extProgress.isMonitoring && (
                    <button
                      onClick={refreshJobs}
                      disabled={progress > 0}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-semibold transition shadow-lg shadow-blue-900/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {progress > 0 ? (
                        <span className="animate-spin text-white">⟳</span>
                      ) : (
                        <span>⚡ Harvest Jobs</span>
                      )}
                    </button>
                  )}

                  {/* Sorting Controls */}
                  <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700 items-center h-10">
                    <button
                      onClick={() => setSortMode('recency')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all h-full flex items-center gap-2 ${sortMode === 'recency'
                        ? 'bg-gray-700 text-white shadow-sm ring-1 ring-white/10'
                        : 'text-gray-500 hover:text-gray-300'}`}
                      title="Sort by Time Posted (Early Bird Strategy)"
                    >
                      📅 Newest
                    </button>
                    <div className="w-px h-4 bg-gray-700 mx-1"></div>
                    <button
                      onClick={() => setSortMode('smart')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all h-full flex items-center gap-2 ${sortMode === 'smart'
                        ? 'bg-gradient-to-r from-blue-900/40 to-emerald-900/40 text-emerald-400 border border-emerald-500/30'
                        : 'text-gray-500 hover:text-gray-300'}`}
                      title="Smart Sort: High scores first, then recent"
                    >
                      ✨ Smart
                    </button>
                    <div className="w-px h-4 bg-gray-700 mx-1"></div>
                    <button
                      onClick={() => setSortMode('score')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all h-full flex items-center gap-2 ${sortMode === 'score'
                        ? 'bg-blue-900/40 text-blue-400 shadow-sm ring-1 ring-blue-500/50'
                        : 'text-gray-500 hover:text-gray-300'}`}
                      title="Sort by Strategic Score (Best Match)"
                    >
                      🏆 Score
                    </button>
                  </div>

                  <button
                    onClick={toggleManualMode}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 border ${isManual
                      ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-900/40'
                      : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'
                      }`}
                  >
                    {isManual ? '✏️ Manual Mode Active' : '➕ Manual Input'}
                  </button>
                </div>
              </header>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-8">
                {[
                  { id: 'all', label: 'All Leads', count: stats.total, color: 'text-white', bg: 'bg-gray-800' },
                  { id: 'ascend', label: 'Ascend', count: stats.ascend, color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-900/50' },
                  { id: 'apex', label: 'Apex', count: stats.apex, color: 'text-amber-400', bg: 'bg-amber-900/20 border-amber-900/50' },
                  { id: 'socketlogic', label: 'SocketLogic', count: stats.socket, color: 'text-emerald-400', bg: 'bg-emerald-900/20 border-emerald-900/50' },
                  { id: 'applied', label: 'Applied', count: stats.applied, color: 'text-gray-300', bg: 'bg-gray-800 border-gray-700' },
                ].map((stat) => (
                  <button
                    key={stat.id}
                    onClick={() => setFilter(stat.id)}
                    className={`p-3 md:p-4 rounded-xl border text-left transition-all duration-200 ${filter === stat.id
                      ? 'ring-2 ring-blue-500 bg-gray-800 border-transparent shadow-lg transform scale-[1.02]'
                      : `border-gray-800 hover:border-gray-700 ${stat.bg}`
                      }`}
                  >
                    <div className={`text-xl md:text-2xl font-bold ${stat.color}`}>{stat.count}</div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold mt-1">{stat.label}</div>
                  </button>
                ))}
              </div>

              {/* Source Filters - Horizontal Scroll */}
              <div className="mb-6 flex overflow-x-auto pb-2 gap-2 custom-scrollbar">
                <button
                  onClick={() => setSourceFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${sourceFilter === "all"
                    ? "bg-gray-700 text-white border-gray-600"
                    : "bg-gray-900 text-gray-400 border-gray-800 hover:bg-gray-800"
                    }`}
                >
                  All Sources
                </button>
                {Object.entries(sourceCounts).map(([source, count]) => (
                  <button
                    key={source}
                    onClick={() => setSourceFilter(source)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border flex items-center gap-2 ${sourceFilter === source
                      ? "bg-gray-700 text-white border-gray-600"
                      : "bg-gray-900 text-gray-400 border-gray-800 hover:bg-gray-800"
                      }`}
                  >
                    {source}
                    <span className="bg-gray-800 px-1.5 rounded text-[10px] text-gray-500">{count}</span>
                  </button>
                ))}
              </div>

              {/* Error Banner */}
              {error && (
                <div className="bg-red-900/50 border border-red-500/50 text-red-200 px-6 py-4 rounded-xl mb-6 flex items-center gap-3 animate-slide-in">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <h3 className="font-bold text-red-100">Connection Error</h3>
                    <p className="text-sm">{error}</p>
                    <button onClick={() => window.location.reload()} className="text-xs underline mt-1 hover:text-white">Tap to Reload</button>
                  </div>
                </div>
              )}

              {/* Main Job List */}
              <div className="space-y-4">
                {loading && leads.length === 0 ? (
                  <div className="text-center py-20 text-gray-500 animate-pulse">
                    <div className="text-4xl mb-4">📡</div>
                    Fetching opportunities...
                  </div>
                ) : filteredLeads.length === 0 ? (
                  <div className="text-center py-20 bg-gray-900/50 rounded-2xl border border-dashed border-gray-800">
                    <div className="text-4xl mb-4">🔍</div>
                    <p className="text-gray-400 font-medium">No jobs found matching your criteria.</p>
                    <button onClick={() => { setFilter('all'); setSourceFilter('all'); }} className="text-blue-400 text-sm mt-2 hover:underline">
                      Reset Filters
                    </button>
                  </div>
                ) : (
                  filteredLeads.map((lead) => (
                    <div
                      key={lead.id}
                      onClick={() => openLead(lead)}
                      className={`group bg-gray-900/50 border border-gray-800 rounded-xl p-4 md:p-6 transition-all duration-200 hover:bg-gray-800 hover:border-gray-700 hover:shadow-xl cursor-pointer relative overflow-hidden ${lead.applied === 1 ? 'opacity-75 bg-gray-900/20' : ''
                        }`}
                    >
                      {/* Status Stripe */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all group-hover:w-1.5 ${lead.agency_match === 'ascend' ? 'bg-blue-500' :
                        lead.agency_match === 'apex' ? 'bg-amber-500' :
                          lead.agency_match === 'infrastructure' ? 'bg-red-500' :
                            'bg-emerald-500'
                        }`}></div>

                      <div className="flex flex-col md:flex-row gap-4 justify-between items-start pl-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${lead.agency_match === 'ascend' ? 'border-blue-900/50 text-blue-400 bg-blue-900/10' :
                              lead.agency_match === 'apex' ? 'border-amber-900/50 text-amber-400 bg-amber-900/10' :
                                lead.agency_match === 'infrastructure' ? 'border-red-900/50 text-red-400 bg-red-900/10' :
                                  'border-emerald-900/50 text-emerald-400 bg-emerald-900/10'
                              }`}>
                              {lead.agency_match}
                            </span>
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              {lead.source} • <span className="font-mono text-emerald-400 font-bold">{timeAgo(lead.posted_at)}</span>
                            </span>
                            {/* Unified Score Badge (0-100) */}
                            {((lead.match_score || 0) > 0) && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${(lead.match_score || 0) >= 80 ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800' :
                                (lead.match_score || 0) >= 50 ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-800' :
                                  'bg-red-900/30 text-red-400 border border-red-800'
                                }`} title={`Fit Score: ${lead.match_score}/100`}>
                                🎯 {lead.match_score}
                              </span>
                            )}
                          </div>

                          <h3 className={`text-lg md:text-xl font-semibold text-gray-200 group-hover:text-white mb-2 leading-tight ${lead.applied === 1 ? 'line-through text-gray-500' : ''}`}>
                            {lead.title}
                          </h3>

                          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                            {lead.company && lead.company !== 'Unknown' && (
                              <span className="flex items-center gap-1.5">
                                <span className="text-blue-500">🏢</span> {lead.company}
                              </span>
                            )}
                            {lead.budget && lead.budget !== 'N/A' && (
                              <span className="flex items-center gap-1.5">
                                <span className="text-emerald-500">💰</span> <span className="text-gray-300">{lead.budget}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 self-center opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                          {/* Deep Scan Button */}
                          <button
                            onClick={(e) => { e.stopPropagation(); window.open(lead.url, '_blank'); }}
                            className="hidden md:flex items-center justify-center w-8 h-8 rounded-full bg-gray-700 text-amber-400 hover:bg-amber-900/50 hover:text-amber-300 hover:shadow-lg transition-all"
                            title="Deep Scan (Enrich Data)"
                          >
                            ⚡
                          </button>

                          {/* Apply Button */}
                          <button
                            onClick={(e) => initiateApply(lead, e)}
                            className={`hidden md:flex items-center justify-center w-8 h-8 rounded-full transition-all ${lead.applied === 1
                              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 opacity-100 !flex'
                              : 'bg-gray-700 text-gray-400 hover:bg-blue-600 hover:text-white'
                              }`}
                            title={lead.applied === 1 ? "Mark Unapplied" : "Mark Applied"}
                          >
                            {lead.applied === 1 ? '✓' : '↗'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            /* ACTIVITY LOG VIEW */
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-200">Activity Stream</h2>
                  <p className="text-xs text-gray-500">Real-time alerts from all sources</p>
                </div>
                <div className="text-xs text-gray-500 bg-gray-900 border border-gray-800 px-3 py-1 rounded-full">
                  {filteredLeads.length} Alerts
                </div>
              </div>

              {filteredLeads.length === 0 ? (
                <div className="text-center py-20 bg-gray-900/30 rounded-2xl border border-dashed border-gray-800">
                  <div className="text-4xl mb-4 grayscale opacity-50">🔕</div>
                  <p className="text-gray-500 font-medium">No activity yet</p>
                  <p className="text-xs text-gray-600 mt-1">New alerts will appear here in real-time</p>
                </div>
              ) : (
                filteredLeads.map((lead) => (
                  <div
                    key={lead.id}
                    onClick={() => {
                      setSelectedLead(lead);
                    }}
                    className="group bg-gray-900/50 border border-gray-800 p-4 rounded-xl cursor-pointer hover:bg-gray-800 hover:border-gray-700 hover:shadow-lg transition-all duration-200 flex gap-4 items-start relative overflow-hidden"
                  >
                    <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all group-hover:w-1.5 ${lead.agency_match === 'ascend' ? 'bg-blue-500' :
                      lead.agency_match === 'apex' ? 'bg-amber-500' :
                        lead.agency_match === 'infrastructure' ? 'bg-red-500' :
                          'bg-emerald-500'
                      }`}></div>

                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 mt-1 transition-all group-hover:scale-110 ${lead.agency_match === 'ascend' ? 'bg-blue-900/20 text-blue-500' :
                      lead.agency_match === 'apex' ? 'bg-amber-900/20 text-amber-500' :
                        lead.agency_match === 'infrastructure' ? 'bg-red-900/20 text-red-500' :
                          'bg-emerald-900/20 text-emerald-500'
                      }`}>
                      {lead.agency_match === 'ascend' ? 'A' : lead.agency_match === 'apex' ? '▲' : lead.agency_match === 'infrastructure' ? '🛡️' : 'S'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1 gap-2">
                        <h4 className="font-semibold text-gray-200 group-hover:text-white truncate pr-4 text-sm md:text-base">{lead.title}</h4>
                        <span className="text-[10px] text-gray-500 font-mono whitespace-nowrap bg-gray-950 px-1.5 py-0.5 rounded border border-gray-800">{timeAgo(lead.posted_at)}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                          {lead.source}
                        </span>
                        {lead.company && lead.company !== 'Unknown' && (
                          <span className="flex items-center gap-1.5 text-blue-400/80">
                            <span className="w-1 h-1 rounded-full bg-blue-500/50"></span>
                            {lead.company}
                          </span>
                        )}
                        {lead.budget && lead.budget !== 'N/A' && (
                          <span className="flex items-center gap-1.5 text-emerald-400/80">
                            <span className="w-1 h-1 rounded-full bg-emerald-500/50"></span>
                            {lead.budget}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity self-center text-gray-500">
                      →
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lead Detail Modal (Responsive) */}
      {selectedLead && (
        <div
          className="fixed inset-0 bg-black/90 md:bg-black/80 flex items-center justify-center p-0 md:p-4 z-50 overflow-y-auto cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedLead(null);
          }}
        >
          <div className="bg-gray-900 w-full md:max-w-7xl h-full md:h-[90vh] md:rounded-2xl border-none md:border border-gray-800 shadow-2xl flex flex-col cursor-default overflow-hidden">
            <div className="p-4 md:p-6 border-b border-gray-800 flex justify-between items-start bg-gray-900 z-10 shrink-0">
              <div>
                <h2 className="text-lg md:text-2xl font-bold mb-1 md:mb-2 line-clamp-1">{selectedLead.title}</h2>
                <div className="flex gap-2 md:gap-3 text-xs md:text-sm text-gray-400 items-center">
                  <span>{selectedLead.source}</span>
                  <span className="hidden md:inline">•</span>
                  <span className={`uppercase font-semibold px-2 py-0.5 rounded ${selectedLead.agency_match === 'ascend' ? 'bg-blue-900/50 text-blue-400' :
                    selectedLead.agency_match === 'apex' ? 'bg-amber-900/50 text-amber-400' :
                      selectedLead.agency_match === 'infrastructure' ? 'bg-red-900/50 text-red-400' :
                        'bg-emerald-900/50 text-emerald-400'
                    }`}>{selectedLead.agency_match} Match</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="bg-gray-800 p-2 rounded-full text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 pb-20 md:pb-6 overflow-y-auto flex-1 custom-scrollbar">
              {/* Left: Job Details */}
              <div>
                {/* Lead Details / Manual Form */}
                <div className="bg-gray-800 rounded-xl p-4 md:p-6 border border-gray-700 shadow-xl mb-4"> {/* Added mb-4 here */}
                  {isManual ? (
                    // Manual Mode Form
                    <div className="space-y-4">
                      <div className="flex justify-between items-center mb-2">
                        <h2 className="text-xl font-bold text-purple-400 flex items-center gap-2">
                          <span>✏️</span> Manual Job Input
                        </h2>
                        <span className="text-xs text-gray-500 bg-gray-900 px-2 py-1 rounded">No DB Record</span>
                      </div>

                      {/* Title Input */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Job Title</label>
                        <input
                          type="text"
                          className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:border-purple-500 outline-none"
                          placeholder="e.g. Senior Python Developer for AI Project"
                          value={selectedLead.title}
                          onChange={(e) => setSelectedLead({ ...selectedLead, title: e.target.value })}
                        />
                      </div>

                      {/* Agency Selector */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-xs text-gray-400">Target Agency Persona</label>
                          <button onClick={suggestAgency} className="text-[10px] bg-blue-900/40 text-blue-400 hover:bg-blue-800/60 px-2 py-0.5 rounded transition">
                            Suggest ✨
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {['ascend', 'apex', 'socketlogic'].map(agency => (
                            <button
                              key={agency}
                              onClick={() => setSelectedLead({ ...selectedLead, agency_match: agency })}
                              className={`p-2 rounded text-sm capitalize border transition-all ${selectedLead.agency_match === agency
                                ? 'bg-purple-600 border-purple-500 text-white'
                                : 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600'
                                }`}
                            >
                              {agency}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Description Input */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Job Description / Context</label>
                        <textarea
                          className="w-full h-64 bg-gray-900 border border-gray-700 rounded p-3 text-gray-300 text-sm focus:border-purple-500 outline-none resize-none font-mono"
                          placeholder="Paste job description here..."
                          value={selectedLead.description}
                          onChange={(e) => setSelectedLead({ ...selectedLead, description: e.target.value })}
                        />
                      </div>

                      <button
                        onClick={saveManualLead}
                        className="w-full bg-emerald-600 text-white rounded-lg p-3 font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/40 mt-4"
                      >
                        💾 Save Job Lead
                      </button>
                    </div>
                  ) : (
                    // Standard Read-Only Mode
                    <>
                      {/* Client Info Card */}
                      <div className="bg-gray-800/50 rounded-lg p-4 mb-4 border border-gray-700">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <div className="text-xs text-gray-500 uppercase mb-1">Client</div>
                            <div className="text-sm font-medium text-blue-400">🏢 {selectedLead.company || 'Unknown'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 uppercase mb-1">Their Budget</div>
                            <div className="text-sm font-medium text-emerald-400">💰 {selectedLead.budget || 'Not specified'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 uppercase mb-1">Status</div>
                            <div className="flex items-center space-x-2">
                              <span className={`text-sm font-bold ${selectedLead.applied === 1 ? 'text-emerald-400' : 'text-gray-500'}`}>
                                {selectedLead.applied === 1 ? 'Applied' : 'New'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="prose prose-sm prose-invert max-w-none text-gray-300 mb-6">
                        <h3 className="text-gray-200 font-bold mb-2">Description</h3>
                        <div
                          className="whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{ __html: selectedLead.description }}
                        />
                      </div>

                      {/* Enhanced Description Input */}
                      {selectedLead.applied !== 1 && (
                        <div className="mb-4">
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Enhanced Context</label>
                            <span className="text-[10px] text-gray-600">📝 Paste full description for better AI results</span>
                          </div>
                          <textarea
                            value={enhancedDescription}
                            onChange={(e) => setEnhancedDescription(e.target.value)}
                            className="w-full h-40 bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-gray-300 resize-none focus:outline-none focus:border-blue-500"
                            placeholder="Paste the full job description here for better AI proposals..."
                          />
                        </div>
                      )}

                      {selectedLead.applied !== 1 ? (
                        <a
                          href={selectedLead.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full text-center bg-white text-gray-900 hover:bg-gray-200 py-3 rounded-lg font-bold transition mb-4 md:mb-0"
                        >
                          Apply Now ↗
                        </a>
                      ) : (
                        <div className="text-center bg-emerald-900/20 text-emerald-400 border border-emerald-900 py-3 rounded-lg font-bold transition mb-4 md:mb-0">
                          You have applied to this job ✓
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              {/* Right: AI Actions */}
              <div className="bg-gray-950 rounded-xl p-4 md:p-6 border border-gray-800 flex flex-col gap-4 shadow-2xl relative overflow-hidden">
                {/* Premium Background Glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-900/10 rounded-full blur-3xl -z-10 mix-blend-screen pointer-events-none"></div>

                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400 flex items-center gap-2">
                    <span className="text-white">✨</span> AI Strategy Engine
                  </h3>
                </div>

                {/* Persona Toggle */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 font-medium">Proposal Voice:</span>
                  <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800 shadow-inner flex-1">
                    <button
                      onClick={() => setProposalPersona("individual")}
                      className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${proposalPersona === "individual"
                        ? "bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-lg shadow-cyan-900/40"
                        : "text-gray-500 hover:text-gray-300"
                        }`}
                    >
                      👤 Individual
                    </button>
                    <button
                      onClick={() => setProposalPersona("agency")}
                      className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${proposalPersona === "agency"
                        ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-900/40"
                        : "text-gray-500 hover:text-gray-300"
                        }`}
                    >
                      🏢 Agency
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 relative z-10">
                  <button
                    onClick={generatePlan}
                    disabled={generating}
                    className="bg-blue-900/20 hover:bg-blue-900/40 border border-blue-800/50 py-3 rounded-lg text-sm font-semibold transition disabled:opacity-50 text-blue-300"
                  >
                    {generating ? "..." : "Generate Plan"}
                  </button>
                  <button
                    onClick={generateProposal}
                    disabled={generating}
                    className="bg-emerald-900/20 hover:bg-emerald-900/40 border border-emerald-800/50 py-3 rounded-lg text-sm font-semibold transition disabled:opacity-50 text-emerald-300"
                  >
                    {generating ? "..." : "Write Proposal"}
                  </button>
                  <button
                    onClick={analyzeCompany}
                    disabled={analyzingCompany}
                    className="col-span-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-800/50 py-3 rounded-lg text-sm font-semibold transition disabled:opacity-50 text-purple-300 flex items-center justify-center gap-2"
                  >
                    {analyzingCompany ? "Analyzing..." : "🔎 Find Decision Makers"}
                  </button>
                </div>

                {/* Company Analysis Results */}
                {companyAnalysis && (
                  <div className="bg-gray-900 rounded-lg border border-purple-900/30 p-4 space-y-3 animate-slide-in">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xs uppercase text-purple-400 font-bold mb-1">Target Company</div>
                        <div className="font-bold text-white text-lg">{companyAnalysis.company_name}</div>
                        <div className="text-xs text-gray-500">{companyAnalysis.industry}</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs uppercase text-gray-500 font-bold">Recommended Contacts</div>
                      {companyAnalysis.targets.map((role, idx) => (
                        <a
                          key={idx}
                          href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(companyAnalysis.company_name + " " + role)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between bg-gray-800 hover:bg-gray-700 p-2 rounded border border-gray-700 transition group"
                        >
                          <span className="text-sm text-gray-300">{role}</span>
                          <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded group-hover:bg-blue-500">Connect ↗</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Output Area */}
                {(aiPlan || aiProposal) && (
                  <div className="mt-4 p-4 bg-gray-900 rounded-lg border border-gray-800 text-sm space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {aiPlan && (
                      <div>
                        <h4 className="font-bold text-blue-400 mb-2 text-xs uppercase tracking-wider">Strategic Plan</h4>
                        <div className="prose prose-sm prose-invert max-w-none">
                          <ReactMarkdown>{aiPlan}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                    {aiPlan && aiProposal && <hr className="border-gray-800" />}
                    {aiProposal && (
                      <div>
                        <h4 className="font-bold text-emerald-400 mb-2 text-xs uppercase tracking-wider">Draft Proposal</h4>
                        <div className="prose prose-sm prose-invert max-w-none bg-black/50 p-4 rounded border border-gray-800">
                          <ReactMarkdown>{aiProposal}</ReactMarkdown>
                        </div>
                        <button
                          onClick={() => navigator.clipboard.writeText(aiProposal)}
                          className="mt-2 text-xs bg-gray-800 px-3 py-1 rounded text-gray-400 hover:text-white w-full"
                        >
                          Copy to clipboard
                        </button>
                      </div>
                    )}

                    {selectedLead && selectedLead.id !== 'manual' && (
                      <button
                        onClick={saveDraft}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg p-3 font-bold transition-all shadow-lg mt-4 cursor-pointer"
                      >
                        💾 Save Generated Strategy to Job
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
