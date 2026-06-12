"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Dumbbell,
  ChevronRight,
  ArrowLeft,
  Cpu,
  PenLine,
  Zap,
} from "lucide-react";

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
    description:
      "AI-tracked lower-body strength builder. Real-time form feedback and automatic rep counting via camera.",
  },
  {
    id: "pushup",
    name: "Push-ups",
    category: "upper-body",
    tracking: "ai",
    description:
      "AI-tracked upper-body strength and core. Posture cues keep your form sharp throughout every set.",
  },
  {
    id: "jumping_jack",
    name: "Jumping Jacks",
    category: "cardio",
    tracking: "manual",
    description:
      "Simple cardio warm-up and stamina booster. Log your reps manually to track progress over time.",
  },
  {
    id: "burpee",
    name: "Burpees",
    category: "full-body",
    tracking: "manual",
    description:
      "High intensity full-body conditioning. Burns maximum calories in minimum time.",
  },
  {
    id: "lunge",
    name: "Lunges",
    category: "lower-body",
    tracking: "manual",
    description:
      "Leg strength, control, and stability work. Alternating legs for balanced muscle development.",
  },
  {
    id: "plank",
    name: "Plank",
    category: "core",
    tracking: "manual",
    description:
      "Timed core stability hold. Challenge yourself to beat your personal best duration each session.",
  },
  {
    id: "mountain_climber",
    name: "Mountain Climbers",
    category: "cardio-core",
    tracking: "manual",
    description:
      "Core + cardio movement for fast pacing. Elevates heart rate while building abdominal endurance.",
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
    <div className="min-h-screen bg-black text-white px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-20">
      <div className="mx-auto w-full max-w-6xl">
        {/* Nav */}
        <Link
          href="/feature2"
          className="inline-flex items-center gap-2 font-mono text-xs font-bold text-zinc-400 border border-white/10 px-4 py-2.5 uppercase tracking-widest hover:text-white hover:border-white/30 transition-colors no-underline mb-10"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Squads
        </Link>

        {/* Header */}
        <div className="mb-16 sm:mb-20 max-w-3xl">
          <span className="font-mono inline-block mb-5 px-4 py-1.5 border border-white/20 text-white text-sm font-bold tracking-widest uppercase">
            Solo Zone
          </span>
          <h1
            className="font-mono uppercase tracking-tighter text-white mb-6 font-bold"
            style={{ fontSize: "clamp(2.5rem, 5vw, 4.5rem)", lineHeight: 1.05 }}
          >
            Individual <br />
            <span className="text-zinc-500">Workouts</span>
          </h1>
          <p className="font-mono text-sm sm:text-lg text-zinc-400 leading-relaxed uppercase tracking-wide max-w-2xl">
            Choose any exercise and train solo. Squats and push-ups use AI
            camera tracking, while the others use quick manual logging.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-10">
          <div className="flex items-center gap-2 font-mono text-xs text-zinc-500 uppercase tracking-widest">
            <Cpu className="w-3.5 h-3.5 text-white" />
            <span>AI Tracked</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs text-zinc-500 uppercase tracking-widest">
            <PenLine className="w-3.5 h-3.5 text-zinc-400" />
            <span>Manual Logging</span>
          </div>
        </div>

        {/* Exercise Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
          {exercises.map((exercise) => (
            <Link
              key={exercise.id}
              href={`/feature2/solo/${exercise.id}`}
              className="no-underline text-inherit border border-white/10 bg-white/[0.03] p-7 sm:p-9 flex flex-col hover:border-white/25 transition-all relative group min-h-[260px]"
            >
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-white/20" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-white/20" />

              <div className="flex items-start justify-between mb-5">
                <div className="inline-flex h-11 w-11 items-center justify-center border border-white/15 text-zinc-300 bg-white/[0.04]">
                  {exercise.tracking === "ai" ? (
                    <Cpu className="h-5 w-5" />
                  ) : (
                    <Dumbbell className="h-5 w-5" />
                  )}
                </div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 border border-white/15 text-zinc-500">
                  {exercise.tracking}
                </span>
              </div>

              <h3 className="font-mono text-lg sm:text-xl font-bold uppercase tracking-tight text-white mb-2">
                {exercise.name}
              </h3>

              <p className="font-mono text-xs text-zinc-500 leading-relaxed mb-auto">
                {exercise.description}
              </p>

              <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/5">
                <span className="font-mono text-[10px] text-zinc-600 uppercase tracking-[0.2em]">
                  {exercise.category}
                </span>
                <span className="font-mono text-xs text-zinc-400 font-bold inline-flex items-center gap-1.5 group-hover:text-white transition-colors">
                  Start{" "}
                  <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}

          {/* Placeholder tiles to fill grid */}
          {exercises.length % 3 !== 0 &&
            Array.from({ length: 3 - (exercises.length % 3) }).map((_, i) => (
              <div
                key={`ph-${i}`}
                className="border border-white/5 bg-white/[0.01] p-7 sm:p-9 flex flex-col items-center justify-center text-center min-h-[260px] opacity-30"
              >
                <Zap className="w-6 h-6 text-zinc-700 mb-3" />
                <p className="font-mono text-[10px] text-zinc-700 uppercase tracking-[0.2em]">
                  More Coming Soon
                </p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
