// src/components/Experience.jsx
import Floor from "@/components/floor/Floor";
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";
import { Pane } from "tweakpane";
import { useState, useEffect, useRef } from "react";
import Vehicle from "./Vehicle";

export default function Experience() {
  // 디버그 패널(전역): Vehicle 같은 하위 컴포넌트에도 폴더를 열어주기 위해 전달
  const [debugPane, setDebugPane] = useState(null);

  // 바닥(Floor) 관련 파라미터: Pane으로 실시간 조절
  const [floorParams, setFloorParams] = useState({
    floorSize: 10,         // ← 그리드 사이즈(렌더 & 물리 둘 다 영향)
    display: true,         // ← 그리드 표시 on/off
    // grid line
    colorMinor: "#d2d2d2",
    colorMajor: "#ffffff",
    lineWidth1: 2.0,
    lineWidth10: 3.0,
    // cross mark
    crossColor: "#705df2",
    crossScale: 1.0,
    crossSize: 0.08,
    crossThick: 2.0,
    crossIntensity: 1.0,
    // distance fade
    fadeDistance: 140.0,
  });

  // Pane 인스턴스 1회 생성 보장
  const paneRef = useRef(null);

  useEffect(() => {
    if (paneRef.current) return; // 중복 생성 방지

    const pane = new Pane({ title: "Debug" });
    setDebugPane(pane);
    paneRef.current = pane;

    // Floor 폴더
    const fFloor = pane.addFolder({ title: "Floor", expanded: false });

    // helper: tweakpane 바인딩 → React state 반영
    const bind = (folder, key, opt = {}) => {
      // 주의: 바인딩 대상은 "값 스냅샷"이므로 state 갱신 시 매핑을 다시 만들 필요는 없음
      const ctrl = folder.addBinding(floorParams, key, opt);
      ctrl.on("change", (ev) => setFloorParams((p) => ({ ...p, [key]: ev.value })));
    };

    // 표시 on/off + 사이즈
    bind(fFloor, "display");
    bind(fFloor, "floorSize", { min: 2, max: 1000, step: 1, label: "size" });

    // Grid 라인
    const fGrid = fFloor.addFolder({ title: "Grid", expanded: true });
    bind(fGrid, "colorMinor", { view: "color" });
    bind(fGrid, "colorMajor", { view: "color" });
    bind(fGrid, "lineWidth1", { min: 0.5, max: 6, step: 0.1, label: "line 1u" });
    bind(fGrid, "lineWidth10", { min: 0.5, max: 8, step: 0.1, label: "line 10u" });

    // Cross (+) 마커
    const fCross = fFloor.addFolder({ title: "Cross (+)", expanded: true });
    bind(fCross, "crossColor", { view: "color" });
    bind(fCross, "crossScale", { min: 0.25, max: 10, step: 0.01, label: "spacing" });
    bind(fCross, "crossSize", { min: 0.01, max: 0.5, step: 0.001, label: "arm len" });
    bind(fCross, "crossThick", { min: 0.2, max: 6, step: 0.1, label: "thickness(px)" });
    bind(fCross, "crossIntensity", { min: 0.0, max: 2.0, step: 0.01 });

    // Fade
    const fFade = fFloor.addFolder({ title: "Fade", expanded: false });
    bind(fFade, "fadeDistance", { min: 20, max: 400, step: 1 });

    // 언마운트 시 정리
    return () => {
      pane.dispose();
      paneRef.current = null;
    };
  }, []);

  return (
    <>
      {/* 기본 조명 */}
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 5, 2]} intensity={1.2} />

      {/* 물리 월드: debug는 URL에 #debug 있을 때만 표시 */}
      <Physics debug={location.hash.includes("debug")} gravity={[0, -9.81, 0]}>
        {/* 바닥 콜라이더(고정체): CuboidCollider의 args는 half-extents이므로 /2 */}
        <RigidBody type="fixed">
          <CuboidCollider
            args={[floorParams.floorSize / 2, 0.1, floorParams.floorSize / 2]}
            position={[0, 0, 0]}
          />
        </RigidBody>

        {/* 차량: debugPane 전달해서 Vehicle 측에서 자체 폴더를 열 수 있게 함 */}
        <Vehicle debugPane={debugPane} position={[0, 1, 0]} rotation={[0, 0, 0]} />
      </Physics>

      {/* 바닥 그리드 셰이더: 표시 토글 가능 */}
      {floorParams.display && (
        <Floor
          size={floorParams.floorSize}              
          colorMinor={floorParams.colorMinor}
          colorMajor={floorParams.colorMajor}
          lineWidth1={floorParams.lineWidth1}
          lineWidth10={floorParams.lineWidth10}
          fadeDistance={floorParams.fadeDistance}
          crossColor={floorParams.crossColor}
          crossScale={floorParams.crossScale}
          crossSize={floorParams.crossSize}
          crossThick={floorParams.crossThick}
          crossIntensity={floorParams.crossIntensity}
        />
      )}
    </>
  );
}