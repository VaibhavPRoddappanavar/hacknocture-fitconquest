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
      <div
        className="feature-page"
        style={{ padding: "8rem 5% 4rem", textAlign: "center" }}
      >
        <h1>Exercise not found</h1>
        <p style={{ color: "#94a3b8", marginTop: "0.5rem" }}>
          Choose a valid exercise from the solo section.
        </p>
        <Link
          href="/feature2/solo"
          className="back-link"
          style={{ marginTop: "1.5rem", display: "inline-block" }}
        >
          ← Back to Individual Workouts
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
    <div
      className="feature-page"
      style={{ padding: "8rem 5% 4rem", alignItems: "flex-start" }}
    >
      <Link
        href="/feature2/solo"
        className="back-link"
        style={{ marginBottom: "1.5rem" }}
      >
        ← Back to Individual Workouts
      </Link>

      <div
        style={{
          width: "100%",
          maxWidth: "920px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        <div
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            borderRadius: "18px",
            padding: "1.4rem",
          }}
        >
          <h1 style={{ marginBottom: "0.5rem" }}>{config.name}</h1>
          <p style={{ color: "#94a3b8", lineHeight: 1.55 }}>{config.tips}</p>
        </div>

        <div
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            borderRadius: "18px",
            padding: "1.4rem",
          }}
        >
          {config.tracking === "ai" ? (
            <>
              {!cameraActive ? (
                <button
                  onClick={startAiSession}
                  style={{
                    padding: "0.8rem 1.2rem",
                    borderRadius: "10px",
                    border: "none",
                    fontWeight: "bold",
                    color: "#fff",
                    background: "linear-gradient(135deg, #6366f1, #22d3ee)",
                    cursor: "pointer",
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
                      <strong style={{ color: "#818cf8", fontSize: "1.3rem" }}>
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
                      <strong style={{ color: "#22d3ee", fontSize: "1.3rem" }}>
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
                padding: "0.72rem 1.2rem",
                borderRadius: "10px",
                border: "none",
                background: "linear-gradient(135deg, #6366f1, #818cf8)",
                color: "#fff",
                fontWeight: "bold",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
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
  );
}
