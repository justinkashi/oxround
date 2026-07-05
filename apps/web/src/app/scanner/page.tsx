"use client";
// QR check-in scanner (Step 6D). Runs inside the CRM on the gym's iPad/phone (staff logged in).
// Reads the member's on-screen QR via the device camera → checkInMember → green/red result.
// QR payload format: "oxround:checkin:<gym_member_id>".

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { checkInMember, type CheckInResult } from "@/lib/data";

type Flash = CheckInResult & { at: number };

export default function ScannerPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const busyRef = useRef(false);
  const lastCodeRef = useRef<string>("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;

    const parseId = (text: string): string | null => {
      const m = text.match(/^oxround:checkin:(.+)$/);
      return m ? m[1] : null;
    };

    const tick = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && !busyRef.current) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(img.data, img.width, img.height);
          if (code && code.data && code.data !== lastCodeRef.current) {
            const id = parseId(code.data);
            if (id) {
              lastCodeRef.current = code.data;
              busyRef.current = true;
              const result = await checkInMember(id);
              setFlash({ ...result, at: Date.now() });
              setTimeout(() => { busyRef.current = false; lastCodeRef.current = ""; }, 2500);
            }
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setRunning(true);
          raf = requestAnimationFrame(tick);
        }
      } catch {
        setError("Camera access was blocked. Allow the camera for this site, then reload.");
      }
    })();

    return () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Scan check-in</h1>
      <p className="mb-6 text-sm text-neutral-500">Point the camera at a member&apos;s QR code.</p>

      <div className="relative mx-auto max-w-md overflow-hidden rounded-xl bg-neutral-900">
        <video ref={videoRef} className="w-full" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />
        {!running && !error && <div className="p-10 text-center text-sm text-neutral-400">Starting camera…</div>}
        <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-white/60" />

        {flash && (
          <div
            key={flash.at}
            className={`absolute inset-0 flex flex-col items-center justify-center text-center ${
              flash.ok ? "bg-green-600/95" : "bg-red-600/95"
            }`}
          >
            <div className="text-5xl">{flash.ok ? "✓" : "✗"}</div>
            <div className="mt-2 text-xl font-bold text-white">{flash.name || "Not recognized"}</div>
            <div className="text-sm text-white/90">
              {flash.ok ? (flash.duplicate ? "Already checked in" : "Welcome!") : flash.reason}
            </div>
          </div>
        )}
      </div>

      {error && <p className="mx-auto mt-4 max-w-md rounded-md bg-red-50 p-3 text-center text-sm text-red-700">{error}</p>}
      <p className="mx-auto mt-4 max-w-md text-center text-xs text-neutral-400">
        Green = checked in. Red = inactive or payment due. Members show their QR from the OxRound app.
      </p>
    </div>
  );
}
