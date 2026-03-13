"use client";

import React, { useEffect, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

// ── Landmark indices ─────────────────────────────────────────────
const L_SHOULDER = 11, R_SHOULDER = 12;
const L_ELBOW = 13, R_ELBOW = 14;
const L_WRIST = 15, R_WRIST = 16;
const L_HIP = 23, R_HIP = 24;
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

export default function PushupTracker({ onRep, onStatsUpdate, isPaused = false }: { onRep: (num: number) => void, onStatsUpdate: (stats: any) => void, isPaused?: boolean }) {
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
        let elbowAngle = 0;
        let bodyAngle = 0;

        if (results.landmarks && results.landmarks.length > 0) {
          const lms = results.landmarks[0];
          const w = canvas.width;
          const h = canvas.height;

          // Helper to map 0..1 to canvas pixel coords (FLIPPED for mirroring)
          const pt = (idx: number) => [(1 - lms[idx].x) * w, lms[idx].y * h];

          const leftVis = lms[L_SHOULDER].visibility || 0;
          const rightVis = lms[R_SHOULDER].visibility || 0;

          let shoulder, elbow, wrist, hip, ankle;
          if (leftVis >= rightVis) {
            shoulder = pt(L_SHOULDER);
            elbow = pt(L_ELBOW);
            wrist = pt(L_WRIST);
            hip = pt(L_HIP);
            ankle = pt(L_ANKLE);
          } else {
            shoulder = pt(R_SHOULDER);
            elbow = pt(R_ELBOW);
            wrist = pt(R_WRIST);
            hip = pt(R_HIP);
            ankle = pt(R_ANKLE);
          }

          elbowAngle = calcAngle(shoulder, elbow, wrist);
          bodyAngle = calcAngle(shoulder, hip, ankle);

          let feedback_lines: string[] = [];

          const DOWN_ANGLE = 90;
          const UP_ANGLE = 160;
          const HIP_SAG_LIMIT = 150;

          if (elbowAngle < DOWN_ANGLE) {
            state.stage = "down";
          }
          if (elbowAngle > UP_ANGLE && state.stage === "down") {
            state.stage = "up";
            if (!isPausedRef.current) {
              state.counter += 1;
              onRep(1);
            }
          }

          if (state.stage === "down") {
            if (elbowAngle > 110) {
              feedback_lines.push("Go lower - chest should nearly touch the ground");
            } else {
              feedback_lines.push("Good depth!");
            }
          }

          if (bodyAngle < HIP_SAG_LIMIT) {
            feedback_lines.push("Hips sagging - tighten your core!");
          } else if (bodyAngle > 175) {
            feedback_lines.push("Hips piking up - lower your hips in line");
          } else {
            feedback_lines.push("Good body alignment!");
          }

          if (state.stage === "up" && elbowAngle < 155) {
            feedback_lines.push("Fully extend your arms at the top");
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
          ctx.fillStyle = "aqua";
          ctx.fillText(`${Math.floor(elbowAngle)} deg`, elbow[0] + 10, elbow[1]);
          ctx.fillStyle = "orange";
          ctx.fillText(`${Math.floor(bodyAngle)} deg`, hip[0] + 10, hip[1]);
        }

        onStatsUpdate({
          exercise: "pushup",
          count: state.counter,
          stage: state.stage,
          feedback: state.feedback.split(" | "),
          angles: { elbow_angle: Math.floor(elbowAngle), body_angle: Math.floor(bodyAngle) }
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
