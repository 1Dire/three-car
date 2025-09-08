import Floor from "@/components/floor/Floor";
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";
import { Pane } from "tweakpane";
import { useState, useEffect, useRef } from "react";

export default function Experience() {
  const floorSize = 50;

  const [floorParams, setFloorParams] = useState({
    // grid
    colorMinor: "#d2d2d2",
    colorMajor: "#ffffff",
    lineWidth1: 2.0,
    lineWidth10: 3.0,
    // cross
    crossColor: "#705df2",
    crossScale: 1.0,
    crossSize: 0.08,
    crossThick: 2.0,
    crossIntensity: 1.0,
    // fade
    fadeDistance: 140.0,
  });

  const paneRef = useRef(null);

  useEffect(() => {
    if (paneRef.current) return;
    const pane = new Pane({ title: "Floor Debug" });
    paneRef.current = pane;

    // helper: 바인딩 + 상태 업데이트
    const bind = (folder, key, opt = {}) => {
      const ctrl = folder.addBinding(floorParams, key, opt);
      ctrl.on("change", (ev) =>
        setFloorParams((p) => ({ ...p, [key]: ev.value }))
      );
    };

    // Grid
    const fGrid = pane.addFolder({ title: "Grid", expanded: true });
    bind(fGrid, "colorMinor", { view: "color" });
    bind(fGrid, "colorMajor", { view: "color" });
    bind(fGrid, "lineWidth1", {
      min: 0.5,
      max: 6,
      step: 0.1,
      label: "line 1u",
    });
    bind(fGrid, "lineWidth10", {
      min: 0.5,
      max: 8,
      step: 0.1,
      label: "line 10u",
    });

    // Cross
    const fCross = pane.addFolder({ title: "Cross (+)", expanded: true });
    bind(fCross, "crossColor", { view: "color" });
    bind(fCross, "crossScale", {
      min: 0.25,
      max: 10,
      step: 0.01,
      label: "spacing",
    });
    bind(fCross, "crossSize", {
      min: 0.01,
      max: 0.5,
      step: 0.001,
      label: "arm len",
    });
    bind(fCross, "crossThick", {
      min: 0.2,
      max: 6,
      step: 0.1,
      label: "thickness(px)",
    });
    bind(fCross, "crossIntensity", { min: 0.0, max: 2.0, step: 0.01 });

    // Fade
    const fFade = pane.addFolder({ title: "Fade", expanded: false });
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
        <RigidBody
          type="dynamic"
          colliders="cuboid"
          restitution={0.2}
          friction={0.8}
          position={[0, 2, 0]}
        >
          <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color="#7cc5ff"
              roughness={0.6}
              metalness={0.1}
            />
          </mesh>
        </RigidBody>

        <RigidBody type="fixed">
          <CuboidCollider
            args={[floorSize / 2, 0.1, floorSize / 2]}
            position={[0, 0, 0]}
          />
        </RigidBody>
      </Physics>

      <Floor
        size={floorSize}
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
    </>
  );
}
