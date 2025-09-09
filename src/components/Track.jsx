import { useLoader } from "@react-three/fiber";
import React, { useEffect } from "react";
import { TextureLoader } from "three";
import { GLTFLoader } from "three/examples/jsm/Addons.js";

const Track = () => {
  const resuit = useLoader(GLTFLoader, "models/track.glb");
  const colorMap = useLoader(TextureLoader, "textures/track.png");
  useEffect(() => {
    colorMap.anisotropy = 16;
    console.log(resuit);
  }, [colorMap]);

  let geometry = resuit.scene.children[0].geometry;
  return (
    <mesh>
      <primitive object={geometry} attach={"geometry"} />
      <meshBasicMaterial map={colorMap} toneMapped={false} />
    </mesh>
  );
};

export default Track;
