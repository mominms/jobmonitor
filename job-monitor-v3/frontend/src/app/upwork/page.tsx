"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const API_BASE = "http://localhost:8001";

interface Bid {
    id: string;
    job_url: string;
    job_title: string;
    agency: string;
    proposal: string;
    status: string;
    submitted_at: string | null;
    notes: string | null;
}

export default function UpworkPage() {
    const [jobUrl, setJobUrl] = useState("");
    const [detectedAgency, setDetectedAgency] = useState<string | null>(null);
    const [proposal, setProposal] = useState("");
    const [bids, setBids] = useState<Bid[]>([]);
    const [loading, setLoading] = useState(false);

    const [jobDescription, setJobDescription] = useState("");

    useEffect(() => {
        fetch(`${API_BASE}/upwork/bids`)
            .then((res) => res.json())
            .then(setBids)
            .catch(console.error);
    }, []);

    const generateProposal = async () => {
        setLoading(true);
        setProposal("");

        try {
            const res = await fetch(`${API_BASE}/upwork/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    job_url: jobUrl,
                    job_description: jobDescription || jobUrl,
                    agency: null, // Let API auto-detect
                }),
            });
            const data = await res.json();
            setProposal(data.proposal);
            setDetectedAgency(data.detected_agency);
        } catch (err) {
            console.error(err);
            setProposal("Error generating proposal. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const saveBid = async () => {
        try {
            await fetch(`${API_BASE}/upwork/bids`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    job_url: jobUrl,
                    job_title: "Upwork Job",
                    agency: detectedAgency,
                    proposal: proposal,
                }),
            });
            // Refresh bids
            const res = await fetch(`${API_BASE}/upwork/bids`);
            setBids(await res.json());
            // Reset form
            setJobUrl("");
            setProposal("");
            setDetectedAgency(null);
        } catch (err) {
            console.error(err);
        }
    };

    const updateBidStatus = async (bidId: string, status: string) => {
        try {
            await fetch(`${API_BASE}/upwork/bids/${bidId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            const res = await fetch(`${API_BASE}/upwork/bids`);
            setBids(await res.json());
        } catch (err) {
            console.error(err);
        }
    };

    const getAgencyBadge = (agency: string) => {
        switch (agency) {
            case "ascend":
                return "bg-blue-600";
            case "apex":
                return "bg-amber-600";
            case "socketlogic":
                return "bg-green-600";
            default:
                return "bg-gray-600";
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "draft":
                return "bg-gray-600";
            case "submitted":
                return "bg-blue-600";
            case "responded":
                return "bg-yellow-600";
            case "won":
                return "bg-green-600";
            case "lost":
                return "bg-red-600";
            default:
                return "bg-gray-600";
        }
    };

    return (
        <main className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <header className="border-b border-gray-800 px-6 py-4">
                <div className="max-w-4xl mx-auto">
                    <Link href="/" className="text-gray-400 hover:text-white text-sm mb-2 inline-block">
                        ← Back to Dashboard
                    </Link>
                    <h1 className="text-2xl font-bold">Upwork Proposal Generator</h1>
                    <p className="text-gray-400">Generate custom proposals for Upwork jobs</p>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-6 py-8">
                {/* Generator */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
                    <h2 className="font-bold mb-4">Generate Proposal</h2>

                    <div className="mb-4">
                        <label className="block text-sm text-gray-400 mb-2">Job URL</label>
                        <input
                            type="text"
                            value={jobUrl}
                            onChange={(e) => setJobUrl(e.target.value)}
                            placeholder="https://www.upwork.com/jobs/..."
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white"
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm text-gray-400 mb-2">Job Description (paste key requirements)</label>
                        <textarea
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                            rows={4}
                            placeholder="Paste the job description or key requirements here for better proposal generation..."
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white resize-none"
                        />
                    </div>

                    <button
                        onClick={generateProposal}
                        disabled={!jobUrl || loading}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-semibold transition"
                    >
                        {loading ? "Generating..." : "🤖 Generate Proposal"}
                    </button>

                    {detectedAgency && (
                        <div className="mt-4 flex items-center gap-2">
                            <span className="text-sm text-gray-400">Detected Agency:</span>
                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${getAgencyBadge(detectedAgency)}`}>
                                {detectedAgency}
                            </span>
                        </div>
                    )}

                    {proposal && (
                        <div className="mt-6">
                            <label className="block text-sm text-gray-400 mb-2">Generated Proposal</label>
                            <textarea
                                value={proposal}
                                onChange={(e) => setProposal(e.target.value)}
                                rows={12}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white font-mono text-sm"
                            />
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => navigator.clipboard.writeText(proposal)}
                                    className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition"
                                >
                                    📋 Copy
                                </button>
                                <button
                                    onClick={saveBid}
                                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm transition"
                                >
                                    💾 Save to Tracker
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Bid Tracker */}
                <div>
                    <h2 className="font-bold mb-4">Bid Tracker ({bids.length})</h2>
                    {bids.length === 0 ? (
                        <p className="text-gray-500">No bids tracked yet.</p>
                    ) : (
                        <div className="space-y-3">
                            {bids.map((bid) => (
                                <div key={bid.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${getAgencyBadge(bid.agency)}`}>
                                                {bid.agency}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(bid.status)}`}>
                                                {bid.status}
                                            </span>
                                        </div>
                                        <select
                                            value={bid.status}
                                            onChange={(e) => updateBidStatus(bid.id, e.target.value)}
                                            className="bg-gray-800 border border-gray-700 rounded text-sm px-2 py-1"
                                        >
                                            <option value="draft">Draft</option>
                                            <option value="submitted">Submitted</option>
                                            <option value="responded">Responded</option>
                                            <option value="won">Won</option>
                                            <option value="lost">Lost</option>
                                        </select>
                                    </div>
                                    <a
                                        href={bid.job_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400 hover:underline text-sm truncate block"
                                    >
                                        {bid.job_url}
                                    </a>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
