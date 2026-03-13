"use client";

import React, { useEffect, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

// ── Landmark indices ─────────────────────────────────────────────
const L_SHOULDER = 11, R_SHOULDER = 12;
const L_HIP = 23, R_HIP = 24;
const L_KNEE = 25, R_KNEE = 26;
const L_ANKLE = 27, R_ANKLE = 28;

const CONNECTIONS = [
  [11, 13], [13, 15], [12, 14], [14, 16],   // arms
  [11, 12], [11, 23], [12, 24], [23, 24],   // torso
  [23, 25], [25, 27], [24, 26], [26, 28],   // legs
  [27, 29], [29, 31], [28, 30], [30, 32],   // feet
];

function calcAngle(a: number[], b: number[], c: number[]) {
  const rad = Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(a[1] - b[1], a[0] - b[0]);
  let angle = Math.abs((rad * 180.0) / Math.PI);
  if (angle > 180) {
    angle = 360 - angle;
  }
  return angle;
}

export default function SquatTracker({ onRep, onStatsUpdate, isPaused = false }: { onRep: (num: number) => void, onStatsUpdate: (stats: any) => void, isPaused?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const reqFrameRef = useRef<number | null>(null);
  
  const [isLoaded, setIsLoaded] = useState(false);
  
  const stateRef = useRef({
    counter: 0,
    stage: "up",
    feedback: "Stand in front of the camera"
  });

  const isPausedRef = useRef(isPaused);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        
        if (!active) return;
        
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.7,
          minPosePresenceConfidence: 0.7,
          minTrackingConfidence: 0.7,
        });

        landmarkerRef.current = landmarker;
        
        if (!active) return;
        
        if (videoRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "user" } 
          });
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
             videoRef.current?.play();
             setIsLoaded(true);
             detectFrame();
          };
        }
      } catch (e) {
        console.error("Camera or MediaPipe error:", e);
      }
    }
    
    init();

    return () => {
      active = false;
      if (reqFrameRef.current) cancelAnimationFrame(reqFrameRef.current);
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
      }
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const detectFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !landmarkerRef.current) return;

    if (video.videoWidth > 0 && video.videoHeight > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      
      if (ctx) {
        // Draw mirrored camera feed
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        const ts = performance.now();
        const results = landmarkerRef.current.detectForVideo(video, ts);

        const state = stateRef.current;
        let kneeAngle = 0;

        if (results.landmarks && results.landmarks.length > 0) {
          const lms = results.landmarks[0];
          const w = canvas.width;
          const h = canvas.height;

          // Helper to map 0..1 to canvas pixel coords (FLIPPED for mirroring)
          const pt = (idx: number) => [(1 - lms[idx].x) * w, lms[idx].y * h];

          const leftVis = lms[L_HIP].visibility || 0;
          const rightVis = lms[R_HIP].visibility || 0;

          let hip, knee, ankle, shoulder;
          if (leftVis >= rightVis) {
            hip = pt(L_HIP);
            knee = pt(L_KNEE);
            ankle = pt(L_ANKLE);
            shoulder = pt(L_SHOULDER);
          } else {
            hip = pt(R_HIP);
            knee = pt(R_KNEE);
            ankle = pt(R_ANKLE);
            shoulder = pt(R_SHOULDER);
          }

          kneeAngle = calcAngle(hip, knee, ankle);
          const hipAngle = calcAngle(shoulder, hip, knee);

          let feedback_lines: string[] = [];

          let flippedKneeX, flippedAnkleX;
          if (leftVis >= rightVis) {
            flippedKneeX = 1 - lms[L_KNEE].x;
            flippedAnkleX = 1 - lms[L_ANKLE].x;
          } else {
            flippedKneeX = 1 - lms[R_KNEE].x;
            flippedAnkleX = 1 - lms[R_ANKLE].x;
          }

          if (flippedKneeX - flippedAnkleX > 0.05) {
             feedback_lines.push("Knees going too far forward!");
          }
          if (hipAngle < 60) {
             feedback_lines.push("Keep your back more upright!");
          }

          if (kneeAngle > 160) {
             if (state.stage === "down") {
                 if (!isPausedRef.current) {
                     state.counter += 1;
                     onRep(1);
                 }
                 state.feedback = "Rep complete! Good job";
             }
             state.stage = "up";
             if (feedback_lines.length === 0 && state.stage === "up" && !state.feedback.includes("complete")) {
                 state.feedback = "Standing - go down to squat";
             }
          }
          if (kneeAngle < 90 && state.stage === "up") {
             state.stage = "down";
             if (feedback_lines.length === 0) {
                 state.feedback = "Good depth! Now push back up";
             }
          }

          if (feedback_lines.length > 0) {
             state.feedback = feedback_lines.join(" | ");
          }

          ctx.strokeStyle = "white";
          ctx.lineWidth = 2;
          for (const [i, j] of CONNECTIONS) {
             if (i < lms.length && j < lms.length) {
                 ctx.beginPath();
                 ctx.moveTo((1 - lms[i].x) * w, lms[i].y * h);
                 ctx.lineTo((1 - lms[j].x) * w, lms[j].y * h);
                 ctx.stroke();
             }
          }
          
          ctx.fillStyle = "#0f0";
          for (const lm of lms) {
              ctx.beginPath();
              ctx.arc((1 - lm.x) * w, lm.y * h, 4, 0, 2 * Math.PI);
              ctx.fill();
          }

          ctx.font = "18px Arial";
          ctx.fillStyle = "yellow";
          ctx.fillText(`${Math.floor(kneeAngle)} deg`, knee[0] + 10, knee[1]);
        }

        onStatsUpdate({
          exercise: "squat",
          count: state.counter,
          stage: state.stage,
          feedback: state.feedback.split(" | "),
          angles: { knee_angle: Math.floor(kneeAngle) }
        });
      }
    }

    reqFrameRef.current = requestAnimationFrame(detectFrame);
  };

  return (
    <div style={{ position: "relative", width: "100%", maxHeight: "480px", overflow: "hidden", borderRadius: "16px", background:"#000" }}>
       {!isLoaded && <div style={{position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", color:"white"}}>Loading AI Model...</div>}
       
       <video 
         ref={videoRef} 
         playsInline 
         autoPlay 
         style={{ display: "none" }} 
       />
       <canvas 
         ref={canvasRef} 
         style={{ width: "100%", height: "auto", display: "block", objectFit:"contain", maxHeight:"480px" }} 
       />
       
       {isLoaded && (
          <div style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '20px',
            background: 'rgba(255,50,50,0.85)',
            color: '#fff',
            fontSize: '0.75rem',
            fontWeight: 'bold',
          }}>
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: '#fff',
              animation: 'pulse 1.5s infinite',
            }}></span>
            LIVE
          </div>
       )}
    </div>
  );
}
