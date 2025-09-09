import { Canvas } from "@react-three/fiber";
import { OrbitControls, KeyboardControls } from "@react-three/drei";
import Experience from "@/components/Experience";
import Keyboard from "@/components/keyboard";
import MobileControls from "@/components/controls/MobileControls";

// 간단한 모바일 판별 (SSR 안전)
const isMobile =
  typeof navigator !== "undefined" &&
  /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);

// KeyboardControls 맵 (데스크톱)
const controls = [
  { name: "forward",  keys: ["ArrowUp", "KeyW"] },
  { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "left",     keys: ["ArrowLeft", "KeyA"] },
  { name: "right",    keys: ["ArrowRight", "KeyD"] },
  { name: "brake",    keys: ["Space"] },
  { name: "reset",    keys: ["KeyR"] },
];

export default function App() {
  return (
    <KeyboardControls map={controls}>
      <Canvas
        dpr={[1, 1.5]}
        gl={{ powerPreference: "high-performance", antialias: false }}
        camera={{ position: [3, 2, 5], fov: 60 }}
        style={{
          width: "100vw", height: "100vh", position: "fixed",
          top: 0, left: 0, backgroundColor: "#000"
        }}
        onCreated={({ gl }) => {
          const el = gl.domElement;
          el.style.webkitTouchCallout = "none";
          el.style.webkitUserSelect = "none";
          el.style.userSelect = "none";
          el.style.webkitTapHighlightColor = "transparent";

          const preventDefault = (e) => e.preventDefault();

          el.addEventListener("contextmenu", preventDefault);
          el.addEventListener("touchstart", preventDefault);

          return () => {
            el.removeEventListener("contextmenu", preventDefault);
            el.removeEventListener("touchstart", preventDefault);
          };
        }}
      >
        <Experience />
        <OrbitControls enableDamping />
      </Canvas>

      {/* 모바일에서만 표시 (조이스틱/버튼) */}
      {isMobile && <MobileControls style={{ touchAction: "none", pointerEvents: "auto" }} />}

      {/* 데스크톱에서만 표시 (키보드 HUD) */}
      {!isMobile && (
        <div style={{ position: "absolute", zIndex: 10, bottom: 20, left: 20 }}>
          <Keyboard />
        </div>
      )}
    </KeyboardControls>
  );
}