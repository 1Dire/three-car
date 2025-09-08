import * as THREE from "three";
import vertexShader from "@/shaders/floor/floorVertex.glsl";
import fragmentShader from "@/shaders/floor/floorFragment.glsl";

export function createFloorMaterial(opts) {
  const {
    colorMinor = "#3a4356",
    colorMajor = "#ffffff",
    lineWidth1 = 2.0,
    lineWidth10 = 3.0,

    crossColor = "#705df2",
    crossScale = 1.0,
    crossSize = 0.03,
    crossThick = 0.003,
    crossIntensity = 0.8,

    fadeDistance = 120.0,
  } = opts;

  return new THREE.ShaderMaterial({
    uniforms: {
      uColorMinor:     { value: new THREE.Color(colorMinor) },
      uColorMajor:     { value: new THREE.Color(colorMajor) },
      uLineWidth1:     { value: lineWidth1 },
      uLineWidth10:    { value: lineWidth10 },

      uCrossColor:     { value: new THREE.Color(crossColor) },
      uCrossScale:     { value: crossScale },
      uCrossSize:      { value: crossSize },
      uCrossThick:     { value: crossThick },
      uCrossIntensity: { value: crossIntensity },

      uFadeDistance:   { value: fadeDistance },
      uCamPos:         { value: new THREE.Vector3() },
      uOffset:         { value: new THREE.Vector2(0, 0) },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    extensions: { derivatives: true }, // fwidth용
  });
}