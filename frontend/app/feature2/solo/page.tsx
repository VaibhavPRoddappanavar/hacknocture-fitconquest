"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MouseEvent } from "react";

type Exercise = {
  id: string;
  name: string;
  category: string;
  tracking: "ai" | "manual";
  description: string;
};

const FALLBACK_EXERCISES: Exercise[] = [
  {
    id: "squat",
    name: "Squats",
    category: "lower-body",
    tracking: "ai",
    description: "AI-tracked lower-body strength builder.",
  },
  {
    id: "pushup",
    name: "Push-ups",
    category: "upper-body",
    tracking: "ai",
    description: "AI-tracked upper-body strength and core.",
  },
  {
    id: "jumping_jack",
    name: "Jumping Jacks",
    category: "cardio",
    tracking: "manual",
    description: "Simple cardio warm-up and stamina booster.",
  },
  {
    id: "burpee",
    name: "Burpees",
    category: "full-body",
    tracking: "manual",
    description: "High intensity full-body conditioning.",
  },
  {
    id: "lunge",
    name: "Lunges",
    category: "lower-body",
    tracking: "manual",
    description: "Leg strength, control, and stability work.",
  },
  {
    id: "plank",
    name: "Plank",
    category: "core",
    tracking: "manual",
    description: "Timed core stability hold.",
  },
  {
    id: "mountain_climber",
    name: "Mountain Climbers",
    category: "cardio-core",
    tracking: "manual",
    description: "Core + cardio movement for fast pacing.",
  },
];

export default function SoloWorkoutsPage() {
  const [exercises, setExercises] = useState<Exercise[]>(FALLBACK_EXERCISES);

  useEffect(() => {
    const loadExercises = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/workouts/exercises`,
          {
            headers: { "ngrok-skip-browser-warning": "true" },
          },
        );

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setExercises(data);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    loadExercises();
  }, []);

  return (
    <div
      className="feature-page"
      style={{ padding: "8rem 5% 4rem", alignItems: "flex-start" }}
    >
      <Link
        href="/feature2"
        className="back-link"
        style={{ marginBottom: "2rem" }}
      >
        ← Back to Challenges
      </Link>

      <div
        style={{ width: "100%", textAlign: "center", marginBottom: "2.2rem" }}
      >
        <div className="page-icon" style={{ margin: "0 auto 1rem" }}>
          🏋️
        </div>
        <h1>Individual Workouts</h1>
        <p
          className="subtitle"
          style={{ margin: "0.75rem auto 0", maxWidth: "640px" }}
        >
          Choose any exercise and train solo. Squats and push-ups use AI camera
          tracking, while the others use quick manual logging.
        </p>
      </div>

      <div
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "1.25rem",
        }}
      >
        {exercises.map((exercise) => (
          <Link
            key={exercise.id}
            href={`/feature2/solo/${exercise.id}`}
            style={{
              textDecoration: "none",
              color: "inherit",
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              borderRadius: "16px",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              transition: "transform 0.2s ease, border-color 0.2s ease",
            }}
            onMouseEnter={(e: MouseEvent<HTMLAnchorElement>) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
            }}
            onMouseLeave={(e: MouseEvent<HTMLAnchorElement>) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.borderColor = "var(--card-border)";
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "1.05rem" }}>
                {exercise.name}
              </h3>
            </div>

            <p
              style={{
                margin: 0,
                fontSize: "0.9rem",
                color: "#9ca3af",
                lineHeight: 1.5,
              }}
            >
              {exercise.description}
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "0.3rem",
              }}
            >
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {exercise.category}
              </span>
              <span
                style={{
                  fontSize: "0.85rem",
                  color: "#e2e8f0",
                  fontWeight: "bold",
                }}
              >
                Start →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
