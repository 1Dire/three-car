import { useRef, useState } from "react";
import { useInputStore } from "@/store/useInputStore";

export default function MobileControls() {
  const setKey  = useInputStore((s) => s.setKey);
  const setAxis = useInputStore((s) => s.setAxis);
  const [active, setActive] = useState(false);
  const stickRef = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [pressed, setPressed] = useState({ brake: false, reset: false });

  const R = 56;
  const dead = 0.12;
  const curve = (t) => Math.pow(Math.min(1, Math.max(0, t)), 1.15);

  // Keep the key true for a short time so Vehicle reliably catches the edge
  const pulse = (name, ms = 150) => {
    setKey(name, true);
    setTimeout(() => setKey(name, false), ms);
  };

  const updateFromPointer = (clientX, clientY) => {
    const box = stickRef.current.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const vx = (clientX - cx) / R;
    const vy = (clientY - cy) / R;

    let x = Math.max(-1, Math.min(1, vx));
    let y = Math.max(-1, Math.min(1, -vy));
    const mag = Math.hypot(x, y);
    const m = mag < dead ? 0 : curve((mag - dead) / (1 - dead));
    if (mag > 0) { x = (x / mag) * m; y = (y / mag) * m; } else { x = 0; y = 0; }

    setPos({ x, y });
    setAxis({ steer: x, throttle: y });
    setKey("forward",  y >  0.25);
    setKey("backward", y < -0.25);
    setKey("left",     x < -0.25);
    setKey("right",    x >  0.25);
  };

  const onStart = (e) => {
    e.preventDefault();
    setActive(true);
    const p = e.touches ? e.touches[0] : e;
    updateFromPointer(p.clientX, p.clientY);
  };
  const onMove = (e) => {
    e.preventDefault();
    if (!active) return;
    const p = e.touches ? e.touches[0] : e;
    updateFromPointer(p.clientX, p.clientY);
  };
  const onEnd = (e) => {
    e?.preventDefault?.();
    setActive(false);
    setPos({ x: 0, y: 0 });
    setKey("forward", false);
    setKey("backward", false);
    setKey("left", false);
    setKey("right", false);
    setAxis({ steer: 0, throttle: 0 });
    setPressed({ brake: false, reset: false });
  };

  const brakeDown = (e) => {
    e.preventDefault();
    setKey("brake", true);
    setPressed((p) => ({ ...p, brake: true }));
  };
  const brakeUp = (e) => {
    e.preventDefault();
    setKey("brake", false);
    setPressed((p) => ({ ...p, brake: false }));
  };

  return (
    <div style={wrap} onContextMenu={(e) => e.preventDefault()}>
      {/* Left: Joystick */}
      <div
        ref={stickRef}
        style={stick}
        onTouchStart={onStart}
        onTouchMove={onMove}
        onTouchEnd={onEnd}
        onTouchCancel={onEnd}
        onPointerDown={onStart}
        onPointerMove={onMove}
        onPointerUp={onEnd}
        onPointerCancel={onEnd}
      >
        <div
          style={{
            ...knob,
            transform: `translate(calc(-50% + ${pos.x * R * 0.6}px),
                                   calc(-50% + ${-pos.y * R * 0.6}px))`,
          }}
        />
      </div>

      {/* Right: Buttons */}
      <div style={btnCol}>
        <button
          style={{ ...btn, ...(pressed.brake ? btnPressed : {}) }}
          aria-pressed={pressed.brake}
          onTouchStart={brakeDown}
          onTouchEnd={brakeUp}
          onTouchCancel={brakeUp}
          onPointerDown={brakeDown}
          onPointerUp={brakeUp}
          onPointerCancel={brakeUp}
          onPointerLeave={brakeUp}
        >
          Brake
        </button>

        <button
          style={{ ...btn, ...(pressed.reset ? btnPressed : {}) }}
          onTouchStart={(e) => { e.preventDefault(); setPressed((p)=>({ ...p, reset: true })); pulse("reset"); }}
          onTouchEnd={(e)=>{ e.preventDefault(); setPressed((p)=>({ ...p, reset: false })); }}
          onPointerDown={(e) => { e.preventDefault(); setPressed((p)=>({ ...p, reset: true })); pulse("reset"); }}
          onPointerUp={(e)=>{ e.preventDefault(); setPressed((p)=>({ ...p, reset: false })); }}
          onPointerCancel={(e)=>{ e.preventDefault(); setPressed((p)=>({ ...p, reset: false })); }}
          onPointerLeave={(e)=>{ e.preventDefault(); setPressed((p)=>({ ...p, reset: false })); }}
          onClick={(e) => { e.preventDefault(); setPressed((p)=>({ ...p, reset: true })); setTimeout(()=> setPressed((p)=>({ ...p, reset: false })), 120); pulse("reset"); }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

/* --- styles --- */
const wrap = {
  position: "fixed",
  left: 0, right: 0, top: 0, bottom: 0,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  padding: 18,
  pointerEvents: "auto",   // ⬅️ 부모도 이벤트 받도록 수정
  touchAction: "none",
  zIndex: 1000,
};

const stick = {
  width: 140, height: 140, borderRadius: 999,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.15)",
  position: "relative",
  pointerEvents: "auto",
};

const knob = {
  width: 64, height: 64, borderRadius: 999,
  background: "rgba(112,93,242,0.9)",
  border: "2px solid rgba(255,255,255,0.4)",
  position: "absolute", left: "50%", top: "50%",
  transform: "translate(-50%,-50%)",
  transition: "transform 40ms linear",
};

const btnCol = {
  display: "flex",
  gap: 12,
  pointerEvents: "auto",
  background: "rgba(0,0,0,0.15)",
  borderRadius: 10,
  padding: 8,
};

const btn = {
  fontSize: 14,
  padding: "10px 14px",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.18)",
  color: "#fff",
  borderRadius: 8,
};

const btnPressed = {
  background: "rgba(255,255,255,0.16)",
  border: "1px solid rgba(255,255,255,0.35)",
  transform: "translateY(1px)",
  boxShadow: "0 0 0 2px rgba(112,93,242,0.4) inset",
};