// src/App.jsx
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Experience from "@/components/Experience";

export default function App() {
  return (
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
      <fog attach="fog" args={["#0e0f12", 12, 42]} />
      <Experience />
      <OrbitControls enableDamping />
    </Canvas>
  );
}