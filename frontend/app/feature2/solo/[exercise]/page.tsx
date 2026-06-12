"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import PushupTracker from "../../[id]/PushupTracker";
import SquatTracker from "../../[id]/SquatTracker";

type ExerciseId =
  | "squat"
  | "pushup"
  | "jumping_jack"
  | "burpee"
  | "lunge"
  | "plank"
  | "mountain_climber";

type ExerciseConfig = {
  id: ExerciseId;
  name: string;
  tracking: "ai" | "manual";
  tips: string;
  unit: "reps" | "seconds";
};

type AiStats = {
  feedback?: string[];
};

const EXERCISES: Record<ExerciseId, ExerciseConfig> = {
  squat: {
    id: "squat",
    name: "Squats",
    tracking: "ai",
    tips: "Keep chest up and knees tracking over toes.",
    unit: "reps",
  },
  pushup: {
    id: "pushup",
    name: "Push-ups",
    tracking: "ai",
    tips: "Keep body straight and control your depth.",
    unit: "reps",
  },
  jumping_jack: {
    id: "jumping_jack",
    name: "Jumping Jacks",
    tracking: "manual",
    tips: "Land softly and keep a steady rhythm.",
    unit: "reps",
  },
  burpee: {
    id: "burpee",
    name: "Burpees",
    tracking: "manual",
    tips: "Stay controlled through each transition.",
    unit: "reps",
  },
  lunge: {
    id: "lunge",
    name: "Lunges",
    tracking: "manual",
    tips: "Step long enough to keep front knee stable.",
    unit: "reps",
  },
  plank: {
    id: "plank",
    name: "Plank",
    tracking: "manual",
    tips: "Maintain a straight line from shoulders to heels.",
    unit: "seconds",
  },
  mountain_climber: {
    id: "mountain_climber",
    name: "Mountain Climbers",
    tracking: "manual",
    tips: "Brace your core and keep hips level.",
    unit: "reps",
  },
};

function formatSeconds(totalSeconds: number) {
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function SoloExercisePage({
  params,
}: {
  params: Promise<{ exercise: string }>;
}) {
  const { exercise } = use(params);
  const exerciseId = exercise as ExerciseId;
  const config = EXERCISES[exerciseId];

  const [cameraActive, setCameraActive] = useState(false);
  const [aiStats, setAiStats] = useState<AiStats | null>(null);
  const [sessionReps, setSessionReps] = useState(0);
  const [aiElapsedSec, setAiElapsedSec] = useState(0);
  const [manualCount, setManualCount] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const isPlank = config?.id === "plank";
  const feedbackLines = aiStats?.feedback ?? [];

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (timerRunning) {
      timer = setInterval(() => {
        setElapsedSec((sec) => sec + 1);
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [timerRunning]);

  useEffect(() => {
    if (!cameraActive) return;
    const timer = setInterval(() => {
      setAiElapsedSec((sec) => sec + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cameraActive]);

  if (!config) {
    return (
      <div className="min-h-screen bg-black text-white px-4 sm:px-6 lg:px-8 pt-24 pb-14 text-center">
        <h1 className="font-mono text-2xl sm:text-4xl font-bold uppercase tracking-tight">
          Exercise not found
        </h1>
        <p className="font-mono text-xs sm:text-sm text-zinc-400 mt-2">
          Choose a valid exercise from the solo section.
        </p>
        <Link
          href="/feature2/solo"
          className="inline-flex items-center font-mono text-xs font-bold text-zinc-300 border border-white/15 px-4 py-2 uppercase tracking-widest hover:text-white hover:border-white/35 transition-colors no-underline mt-6"
        >
          Back to Individual Workouts
        </Link>
      </div>
    );
  }

  const startAiSession = () => {
    setSaveMessage(null);
    setSessionReps(0);
    setAiElapsedSec(0);
    setAiStats(null);
    setCameraActive(true);
  };

  const stopAiSession = () => {
    setCameraActive(false);
  };

  const handleAiRep = (count: number) => {
    setSessionReps((value) => value + count);
  };

  const saveSession = async () => {
    setSaveMessage(null);

    const token = localStorage.getItem("fit_token");
    if (!token) {
      setSaveMessage("Please login first from Feature 2.");
      return;
    }

    const reps = config.tracking === "ai" ? sessionReps : manualCount;
    const durationSec = isPlank
      ? elapsedSec
      : config.tracking === "ai"
        ? aiElapsedSec
        : 0;

    if (isPlank && durationSec <= 0) {
      setSaveMessage("Start the timer before saving this plank session.");
      return;
    }

    if (!isPlank && reps <= 0) {
      setSaveMessage("Add at least 1 rep before saving.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/workouts/solo`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({
            exerciseType: config.id,
            reps,
            durationSec,
            source: config.tracking === "ai" ? "ai" : "manual",
          }),
        },
      );

      const data = await res.json();
      if (!res.ok) {
        setSaveMessage(data.error || "Unable to save workout.");
      } else {
        setSaveMessage("Workout saved successfully.");
      }
    } catch (err) {
      console.error(err);
      setSaveMessage("Unable to save workout.");
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-black text-white px-4 sm:px-6 lg:px-8 pt-24 pb-14">
      <div className="mx-auto w-full max-w-5xl">
        <Link
          href="/feature2/solo"
          className="inline-flex items-center font-mono text-xs font-bold text-zinc-300 border border-white/15 px-4 py-2 uppercase tracking-widest hover:text-white hover:border-white/35 transition-colors no-underline mb-6"
        >
          Back to Individual Workouts
        </Link>

        <div className="w-full max-w-5xl mx-auto flex flex-col gap-5">
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "14px",
              padding: "1.1rem 1.2rem",
            }}
          >
            <h1
              style={{
                marginBottom: "0.45rem",
                fontFamily: "var(--font-geist-mono), monospace",
                fontSize: "1.45rem",
                textTransform: "uppercase",
                letterSpacing: "-0.01em",
              }}
            >
              {config.name}
            </h1>
            <p
              style={{
                color: "#a1a1aa",
                lineHeight: 1.55,
                fontFamily: "var(--font-geist-mono), monospace",
                fontSize: "0.8rem",
              }}
            >
              {config.tips}
            </p>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "14px",
              padding: "1.1rem 1.2rem",
            }}
          >
            {config.tracking === "ai" ? (
              <>
                {!cameraActive ? (
                  <button
                    onClick={startAiSession}
                    style={{
                      padding: "0.7rem 1.05rem",
                      borderRadius: "8px",
                      border: "none",
                      fontWeight: 800,
                      color: "#04121a",
                      background: "linear-gradient(135deg, #67e8f9, #22d3ee)",
                      cursor: "pointer",
                      fontFamily: "var(--font-geist-mono), monospace",
                      textTransform: "uppercase",
                      fontSize: "0.72rem",
                    }}
                  >
                    Start AI Session
                  </button>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                    }}
                  >
                    <div
                      style={{
                        borderRadius: "14px",
                        overflow: "hidden",
                        border: "1px solid rgba(255,255,255,0.1)",
                        background: "#000",
                      }}
                    >
                      {config.id === "pushup" ? (
                        <PushupTracker
                          isPaused={false}
                          onRep={(n) => handleAiRep(n)}
                          onStatsUpdate={(stats) => setAiStats(stats)}
                        />
                      ) : (
                        <SquatTracker
                          isPaused={false}
                          onRep={(n) => handleAiRep(n)}
                          onStatsUpdate={(stats) => setAiStats(stats)}
                        />
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "0.75rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          padding: "0.7rem 1rem",
                          borderRadius: "10px",
                          background: "rgba(99,102,241,0.1)",
                          border: "1px solid rgba(99,102,241,0.25)",
                        }}
                      >
                        <strong
                          style={{ color: "#818cf8", fontSize: "1.3rem" }}
                        >
                          {sessionReps}
                        </strong>
                        <span
                          style={{
                            marginLeft: "0.4rem",
                            color: "#cbd5e1",
                            fontSize: "0.85rem",
                          }}
                        >
                          reps
                        </span>
                      </div>
                      <div
                        style={{
                          padding: "0.7rem 1rem",
                          borderRadius: "10px",
                          background: "rgba(6,182,212,0.1)",
                          border: "1px solid rgba(6,182,212,0.25)",
                        }}
                      >
                        <strong
                          style={{ color: "#22d3ee", fontSize: "1.3rem" }}
                        >
                          {formatSeconds(aiElapsedSec)}
                        </strong>
                        <span
                          style={{
                            marginLeft: "0.4rem",
                            color: "#cbd5e1",
                            fontSize: "0.85rem",
                          }}
                        >
                          time
                        </span>
                      </div>
                      <button
                        onClick={stopAiSession}
                        style={{
                          marginLeft: "auto",
                          padding: "0.65rem 1rem",
                          borderRadius: "10px",
                          border: "1px solid rgba(255,80,80,0.35)",
                          background: "rgba(255,80,80,0.15)",
                          color: "#fda4af",
                          fontWeight: "bold",
                          cursor: "pointer",
                        }}
                      >
                        Stop Session
                      </button>
                    </div>

                    {feedbackLines.length > 0 && (
                      <div
                        style={{
                          padding: "0.8rem",
                          borderRadius: "10px",
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        {feedbackLines.map((line: string, idx: number) => (
                          <p
                            key={`${line}-${idx}`}
                            style={{
                              margin: "0.2rem 0",
                              color: "#fbbf24",
                              fontSize: "0.85rem",
                            }}
                          >
                            {line}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {isPlank ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "2.1rem",
                        fontWeight: "bold",
                        color: "#f8fafc",
                      }}
                    >
                      {formatSeconds(elapsedSec)}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "0.75rem",
                        flexWrap: "wrap",
                      }}
                    >
                      {!timerRunning ? (
                        <button
                          onClick={() => setTimerRunning(true)}
                          style={{
                            padding: "0.65rem 1.1rem",
                            borderRadius: "10px",
                            border: "none",
                            background: "#22c55e",
                            color: "#052e16",
                            fontWeight: "bold",
                            cursor: "pointer",
                          }}
                        >
                          Start Timer
                        </button>
                      ) : (
                        <button
                          onClick={() => setTimerRunning(false)}
                          style={{
                            padding: "0.65rem 1.1rem",
                            borderRadius: "10px",
                            border: "none",
                            background: "#f59e0b",
                            color: "#1f2937",
                            fontWeight: "bold",
                            cursor: "pointer",
                          }}
                        >
                          Pause Timer
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setTimerRunning(false);
                          setElapsedSec(0);
                        }}
                        style={{
                          padding: "0.65rem 1.1rem",
                          borderRadius: "10px",
                          border: "1px solid rgba(255,255,255,0.2)",
                          background: "transparent",
                          color: "#cbd5e1",
                          fontWeight: "bold",
                          cursor: "pointer",
                        }}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "2.1rem",
                        fontWeight: "bold",
                        color: "#f8fafc",
                      }}
                    >
                      {manualCount} reps
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "0.75rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        onClick={() =>
                          setManualCount((value) => Math.max(0, value - 1))
                        }
                        style={{
                          padding: "0.65rem 1.1rem",
                          borderRadius: "10px",
                          border: "1px solid rgba(255,255,255,0.2)",
                          background: "transparent",
                          color: "#cbd5e1",
                          fontWeight: "bold",
                          cursor: "pointer",
                        }}
                      >
                        -1 Rep
                      </button>
                      <button
                        onClick={() => setManualCount((value) => value + 1)}
                        style={{
                          padding: "0.65rem 1.1rem",
                          borderRadius: "10px",
                          border: "none",
                          background: "#22c55e",
                          color: "#052e16",
                          fontWeight: "bold",
                          cursor: "pointer",
                        }}
                      >
                        +1 Rep
                      </button>
                      <button
                        onClick={() => setManualCount((value) => value + 5)}
                        style={{
                          padding: "0.65rem 1.1rem",
                          borderRadius: "10px",
                          border: "none",
                          background: "#06b6d4",
                          color: "#083344",
                          fontWeight: "bold",
                          cursor: "pointer",
                        }}
                      >
                        +5 Reps
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            <div
              style={{
                marginTop: "1.2rem",
                display: "flex",
                gap: "0.75rem",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={saveSession}
                disabled={saving}
                style={{
                  padding: "0.68rem 1.1rem",
                  borderRadius: "8px",
                  border: "none",
                  background: "linear-gradient(135deg, #fef08a, #facc15)",
                  color: "#111827",
                  fontWeight: 800,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                  fontFamily: "var(--font-geist-mono), monospace",
                  textTransform: "uppercase",
                  fontSize: "0.72rem",
                }}
              >
                {saving ? "Saving..." : "Finish and Save Session"}
              </button>

              {saveMessage && (
                <span
                  style={{
                    color: saveMessage.includes("successfully")
                      ? "#4ade80"
                      : "#fda4af",
                    fontSize: "0.9rem",
                  }}
                >
                  {saveMessage}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
