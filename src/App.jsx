// src/App.jsx
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Experience from "@/components/Experience";
import Keyboard from "@/components/keyboard";
import { KeyboardControls } from "@react-three/drei";

// KeyboardControls mapping
const controls = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "left", keys: ["ArrowLeft", "KeyA"] },
  { name: "right", keys: ["ArrowRight", "KeyD"] },
  { name: "brake", keys: ["Space"] },
  { name: "reset", keys: ["KeyR"] },
];

export default function App() {
  return (
    <>
      <KeyboardControls map={controls}>
        <Canvas
          style={{
            width: "100vw",
            height: "100vh",
            position: "fixed",
            top: 0,
            left: 0,
          }}
          camera={{ position: [3, 2, 5], fov: 60 }}
          onCreated={({ gl }) => {
            gl.setClearColor("#0e0f12", 1);
          }}
        >
          <Experience />
          <OrbitControls enableDamping />
        </Canvas>

        <div
          style={{
            position: "absolute",
            zIndex: 10,
            bottom: 20,
            left: 20,
          }}
        >
          <Keyboard />
        </div>
      </KeyboardControls>
    </>
  );
}
