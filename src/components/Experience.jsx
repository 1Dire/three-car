import Floor from "@/components/floor/Floor";
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";
import { Pane } from "tweakpane";
import { useState, useEffect, useRef } from "react";
import Vehicle from "./Vehicle";

export default function Experience() {
  const [debugPane, setDebugPane] = useState(null);

  const [floorParams, setFloorParams] = useState({
    floorSize: 20,
    display: true,
    colorMinor: "#d2d2d2",
    colorMajor: "#ffffff",
    lineWidth1: 2.0,
    lineWidth10: 3.0,
    crossColor: "#705df2",
    crossScale: 1.0,
    crossSize: 0.08,
    crossThick: 2.0,
    crossIntensity: 1.0,
    fadeDistance: 140.0,
  });

  const paneRef = useRef(null);

  useEffect(() => {
    // URL에 #debug 있을 때만 Pane 생성
    if (!location.hash.includes("debug")) return;
    if (paneRef.current) return;

    const pane = new Pane({ title: "Debug" });
    setDebugPane(pane);
    paneRef.current = pane;

    const fFloor = pane.addFolder({ title: "Floor", expanded: false });

    const bind = (folder, key, opt = {}) => {
      const ctrl = folder.addBinding(floorParams, key, opt);
      ctrl.on("change", (ev) => setFloorParams((p) => ({ ...p, [key]: ev.value })));
    };

    bind(fFloor, "display");
    bind(fFloor, "floorSize", { min: 2, max: 1000, step: 1, label: "size" });

    const fGrid = fFloor.addFolder({ title: "Grid", expanded: true });
    bind(fGrid, "colorMinor", { view: "color" });
    bind(fGrid, "colorMajor", { view: "color" });
    bind(fGrid, "lineWidth1", { min: 0.5, max: 6, step: 0.1, label: "line 1u" });
    bind(fGrid, "lineWidth10", { min: 0.5, max: 8, step: 0.1, label: "line 10u" });

    const fCross = fFloor.addFolder({ title: "Cross (+)", expanded: true });
    bind(fCross, "crossColor", { view: "color" });
    bind(fCross, "crossScale", { min: 0.25, max: 10, step: 0.01, label: "spacing" });
    bind(fCross, "crossSize", { min: 0.01, max: 0.5, step: 0.001, label: "arm len" });
    bind(fCross, "crossThick", { min: 0.2, max: 6, step: 0.1, label: "thickness(px)" });
    bind(fCross, "crossIntensity", { min: 0.0, max: 2.0, step: 0.01 });

    const fFade = fFloor.addFolder({ title: "Fade", expanded: false });
    bind(fFade, "fadeDistance", { min: 20, max: 400, step: 1 });

    return () => {
      pane.dispose();
      paneRef.current = null;
    };
  }, []);

  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 5, 2]} intensity={1.2} />

      <Physics debug={location.hash.includes("debug")} gravity={[0, -9.81, 0]}>
        {/* 바닥 충돌체 (half-extents) */}
        <RigidBody type="fixed">
          <CuboidCollider
            args={[floorParams.floorSize / 2, 0.1, floorParams.floorSize / 2]}
            position={[0, 0, 0]}
          />
        </RigidBody>

        <Vehicle debugPane={debugPane} position={[0, 1, 0]} rotation={[0, 0, 0]} />
      </Physics>

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