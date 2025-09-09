import React from "react";
import { useKeyboardControls } from "@react-three/drei";
import "@/style/keyboard.css";

function Keyboard() {
  // Subscribe directly so the component re-renders on changes
  const forward = useKeyboardControls((s) => s.forward);
  const backward = useKeyboardControls((s) => s.backward);
  const left = useKeyboardControls((s) => s.left);
  const right = useKeyboardControls((s) => s.right);
  const brake = useKeyboardControls((s) => s.brake);
  const reset = useKeyboardControls((s) => s.reset);

  return (
    <div className="keyboard-container">
      <div className="legend">
        <div>WASD to drive</div>
        <div>Space to brake</div>
        <div>R to reset</div>
      </div>

      {/* WASD grid */}
      <div className="wasd-grid">
        <div className={`key ${forward ? "active" : ""}`} style={{ gridArea: "w" }}>W</div>
        <div className={`key ${left ? "active" : ""}`} style={{ gridArea: "a" }}>A</div>
        <div className={`key ${backward ? "active" : ""}`} style={{ gridArea: "s" }}>S</div>
        <div className={`key ${right ? "active" : ""}`} style={{ gridArea: "d" }}>D</div>
      </div>

      {/* Extras grid */}
      <div className="extras-grid">
        <div
          className={`key ${brake ? "active" : ""}`}
          style={{ gridArea: "space", gridColumn: "span 2", width: "86px" }}
        >
          ␣
        </div>
        <div className={`key ${reset ? "active" : ""}`} style={{ gridArea: "reset" }}>R</div>
      </div>
    </div>
  );
}

export default Keyboard;
