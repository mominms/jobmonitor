"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const API_BASE = "http://localhost:8001";

interface Task {
    id: string;
    order_index: number;
    title: string;
    description: string;
    details: string;
    platform: string | null;
    duration_estimate: string;
    status: string;
    completed_at: string | null;
    notes: string | null;
    ai_context: string | null;
}

interface Playbook {
    id: string;
    name: string;
    agency: string;
    description: string;
    tasks: Task[];
}

export default function PlaybookPage() {
    const params = useParams();
    const [playbook, setPlaybook] = useState<Playbook | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedTask, setExpandedTask] = useState<string | null>(null);
    const [showAI, setShowAI] = useState(false);
    const [aiTask, setAiTask] = useState<Task | null>(null);

    useEffect(() => {
        if (params.id) {
            fetch(`${API_BASE}/playbooks/${params.id}`)
                .then((res) => res.json())
                .then((data) => {
                    setPlaybook(data);
                    setLoading(false);
                    // Auto-expand first non-completed task
                    const currentTask = data.tasks.find((t: Task) => t.status !== "completed");
                    if (currentTask) setExpandedTask(currentTask.id);
                })
                .catch((err) => {
                    console.error(err);
                    setLoading(false);
                });
        }
    }, [params.id]);

    const completeTask = async (taskId: string) => {
        try {
            await fetch(`${API_BASE}/tasks/${taskId}/complete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notes: null }),
            });
            // Refresh
            const res = await fetch(`${API_BASE}/playbooks/${params.id}`);
            const data = await res.json();
            setPlaybook(data);
            // Move to next task
            const nextTask = data.tasks.find((t: Task) => t.status !== "completed");
            if (nextTask) setExpandedTask(nextTask.id);
        } catch (err) {
            console.error(err);
        }
    };

    const openAIHelp = (task: Task) => {
        setAiTask(task);
        setShowAI(true);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
                Loading...
            </div>
        );
    }

    if (!playbook) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
                Playbook not found
            </div>
        );
    }

    const completedTasks = playbook.tasks.filter((t) => t.status === "completed");
    const pendingTasks = playbook.tasks.filter((t) => t.status !== "completed");
    const progress = Math.round((completedTasks.length / playbook.tasks.length) * 100);

    const getAgencyColor = (agency: string) => {
        switch (agency) {
            case "ascend": return "text-blue-400";
            case "apex": return "text-amber-400";
            case "socketlogic": return "text-green-400";
            default: return "text-gray-400";
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
                    <div className="flex justify-between items-start">
                        <div>
                            <span className={`text-xs font-bold uppercase tracking-wider ${getAgencyColor(playbook.agency)}`}>
                                {playbook.agency}
                            </span>
                            <h1 className="text-2xl font-bold">{playbook.name}</h1>
                            <p className="text-gray-400">{playbook.description}</p>
                        </div>
                    </div>

                    {/* Progress */}
                    <div className="mt-4">
                        <div className="flex justify-between text-sm mb-1">
                            <span>Progress</span>
                            <span>{completedTasks.length}/{playbook.tasks.length} tasks</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-3">
                            <div
                                className="bg-white rounded-full h-3 transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-6 py-8">
                {/* Completed Tasks (History) */}
                {completedTasks.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                            ✓ Completed ({completedTasks.length})
                        </h2>
                        <div className="space-y-2">
                            {completedTasks.map((task) => (
                                <div
                                    key={task.id}
                                    className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 opacity-60"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-green-500">✓</span>
                                        <span className="line-through text-gray-400">{task.title}</span>
                                        {task.completed_at && (
                                            <span className="text-xs text-gray-600 ml-auto">
                                                {new Date(task.completed_at).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Pending Tasks */}
                <div>
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                        Upcoming Tasks ({pendingTasks.length})
                    </h2>
                    <div className="space-y-3">
                        {pendingTasks.map((task, index) => {
                            const isCurrent = index === 0;
                            const isExpanded = expandedTask === task.id;

                            return (
                                <div
                                    key={task.id}
                                    className={`border rounded-xl transition ${isCurrent
                                        ? "border-white bg-gray-900"
                                        : "border-gray-800 bg-gray-900/30"
                                        }`}
                                >
                                    {/* Task Header */}
                                    <button
                                        onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                                        className="w-full p-4 flex items-center gap-4 text-left"
                                    >
                                        <span
                                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isCurrent ? "bg-white text-gray-900" : "bg-gray-800 text-gray-400"
                                                }`}
                                        >
                                            {task.order_index}
                                        </span>
                                        <div className="flex-1">
                                            <h3 className={`font-semibold ${isCurrent ? "text-white" : "text-gray-400"}`}>
                                                {task.title}
                                            </h3>
                                            <p className="text-sm text-gray-500">{task.description}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {task.platform && (
                                                <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400">
                                                    {task.platform}
                                                </span>
                                            )}
                                            <span className="text-xs text-gray-500">{task.duration_estimate}</span>
                                            <span className="text-gray-600">{isExpanded ? "▲" : "▼"}</span>
                                        </div>
                                    </button>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4 border-t border-gray-800 pt-4">
                                            <div
                                                className="prose prose-invert prose-sm max-w-none mb-4"
                                                dangerouslySetInnerHTML={{
                                                    __html: task.details?.replace(/\n/g, "<br/>") || "",
                                                }}
                                            />

                                            {/* Actions */}
                                            <div className="flex gap-3">
                                                {isCurrent && (
                                                    <button
                                                        onClick={() => completeTask(task.id)}
                                                        className="bg-white text-gray-900 px-4 py-2 rounded-lg font-semibold hover:bg-gray-200 transition"
                                                    >
                                                        ✓ Mark Complete
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => openAIHelp(task)}
                                                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold transition"
                                                >
                                                    🤖 I&apos;m Stuck - Ask AI
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* AI Modal */}
            {showAI && aiTask && (
                <AIModal
                    task={aiTask}
                    onClose={() => setShowAI(false)}
                />
            )}
        </main>
    );
}

function AIModal({ task, onClose }: { task: Task; onClose: () => void }) {
    const [response, setResponse] = useState<string>("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API_BASE}/tasks/${task.id}/ask-ai`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                task_title: task.title,
                task_description: task.description || "",
                ai_context: task.ai_context || "",
            }),
        })
            .then((res) => res.json())
            .then((data) => {
                setResponse(data.response);
                setLoading(false);
            })
            .catch((err: unknown) => {
                setResponse("Error getting AI response. Please try again.");
                setLoading(false);
            });
    }, [task]);

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                    <h3 className="font-bold">🤖 AI Assistant</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        ✕
                    </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1">
                    <div className="bg-gray-800 rounded-lg p-4 mb-4">
                        <p className="text-sm text-gray-400 mb-1">Getting help with:</p>
                        <p className="font-semibold">{task.title}</p>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                            <span className="ml-3 text-gray-400">Thinking...</span>
                        </div>
                    ) : (
                        <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4">
                            <div
                                className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap"
                                dangerouslySetInnerHTML={{ __html: response.replace(/\n/g, "<br/>") }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
