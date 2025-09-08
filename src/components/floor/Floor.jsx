// Floor.jsx
import { useMemo, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { createFloorMaterial } from "@/materials/floorMaterial";

export default function Floor(props) {
  const { camera } = useThree();
  const material = useMemo(() => createFloorMaterial(props), [props]);

  // 🔧 부모에게 머티리얼 전달
  useEffect(() => {
    props.onMaterial?.(material);
    return () => props.onMaterial?.(null);
  }, [material]);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      frustumCulled={false}
      onBeforeRender={() => {
        material.uniforms.uCamPos.value.copy(camera.position);
      }}
    >
      <planeGeometry args={[props.size ?? 5000, props.size ?? 5000, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}