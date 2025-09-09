import React, { useRef, useEffect, useState, useMemo } from "react";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { useKeyboardControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useVehicleController } from "@/utils/useVehicleController";
import { useInputStore } from "@/store/useInputStore";

const isMobile =
  typeof navigator !== "undefined" &&
  /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);

const Vehicle = ({ position, rotation, debugPane }) => {
  // Pane(선택)로 조절할 수 있는 기본 파라미터
  const INITIAL = {
    suspensionRestLength: 0.125,
    suspensionStiffness: 24,
    maxSuspensionTravel: 1.0,
    radius: 0.15,
    width: 0.25,
  };
  const [params, setParams] = useState(INITIAL);
  const paramsRef = useRef({ ...INITIAL });
  const vehicleFolderRef = useRef(null);

  // Debug Pane 항목들 (#debug 일 때만 생성)
  useEffect(() => {
    if (!debugPane || vehicleFolderRef.current) return;
    const fVehicle = debugPane.addFolder({ title: "Vehicle", expanded: false });
    vehicleFolderRef.current = fVehicle;

    const fSusp = fVehicle.addFolder({ title: "Suspension", expanded: true });
    const fWheel = fVehicle.addFolder({ title: "Wheel", expanded: true });

    const bind = (folder, key, opt = {}) => {
      const ctrl = folder.addBinding(paramsRef.current, key, opt);
      ctrl.on("change", (ev) => {
        paramsRef.current[key] = ev.value;
        setParams((p) => ({ ...p, [key]: ev.value }));
      });
    };

    bind(fSusp, "suspensionRestLength", { min: 0.05, max: 0.4, step: 0.005, label: "restLength (m)" });
    bind(fSusp, "suspensionStiffness",  { min: 4,    max: 60,  step: 1,     label: "stiffness" });
    bind(fSusp, "maxSuspensionTravel",   { min: 0.1,  max: 2.0, step: 0.05,  label: "maxTravel (m)" });

    bind(fWheel, "radius", { min: 0.05, max: 0.6, step: 0.005, label: "radius (m)" });
    bind(fWheel, "width",  { min: 0.05, max: 0.6, step: 0.01,  label: "width (m)" });

    return () => {
      vehicleFolderRef.current?.dispose();
      vehicleFolderRef.current = null;
    };
  }, [debugPane]);

  // Rapier refs & 입력 훅
  const chassisBodyRef = useRef(null);
  const chassisMeshRef = useRef(null);
  const wheelsRef = useRef([]);

  // Spawn (reset) support
  const spawnRef = useRef({
    pos: new THREE.Vector3(...position),
    rot: new THREE.Euler(...rotation),
  });
  const resetLatch = useRef(false); // avoid repeating reset while key is held

  useEffect(() => {
    // keep spawn in sync with props
    spawnRef.current.pos.set(...position);
    spawnRef.current.rot.set(...rotation);
  }, [position, rotation]);

  const [, getKeyboardControls] = useKeyboardControls();
  const store = useInputStore(); // 모바일 입력 저장소(Zustand)

  // 바퀴 파라미터
  const wheelInfo = useMemo(() => ({
    axleCs: new THREE.Vector3(0, 0, -1),
    suspensionRestLength: params.suspensionRestLength,
    suspensionStiffness: params.suspensionStiffness,
    maxSuspensionTravel: params.maxSuspensionTravel,
    radius: params.radius,
    width: params.width,
  }), [params]);

  // 바퀴 위치 (차체 로컬 좌표)
  const wheels = useMemo(() => ([
    { position: new THREE.Vector3(-0.65, -0.15, -0.45), ...wheelInfo }, // front-left
    { position: new THREE.Vector3(-0.65, -0.15,  0.45), ...wheelInfo }, // front-right
    { position: new THREE.Vector3( 0.65, -0.15, -0.45), ...wheelInfo }, // rear-left
    { position: new THREE.Vector3( 0.65, -0.15,  0.45), ...wheelInfo }, // rear-right
  ]), [wheelInfo]);

  // 레이캐스트 차량 컨트롤러 연결 (휠 시각 동기화는 훅에서 처리)
  const { vehicleController } = useVehicleController(chassisBodyRef, wheelsRef, wheels);

  // 입력 → 물리값
  useFrame(() => {
    const ctrl = vehicleController.current;
    if (!ctrl || !chassisMeshRef.current) return;

    // 모바일이면 zustand의 keys, 아니면 drei의 getKeyboardControls()
    const k = isMobile ? store.keys : getKeyboardControls();

    const forward = Number(k.forward) || 0;
    const back    = Number(k.back || k.backward) || 0;
    const left    = Number(k.left) || 0;
    const right   = Number(k.right) || 0;
    const brakeKey= Number(k.brake) || 0;

    // --- Reset handling (works for desktop R key and mobile pulse) ---
    const doReset = !!(k.reset);
    if (doReset && !resetLatch.current && chassisBodyRef.current) {
      resetLatch.current = true;
      const body = chassisBodyRef.current;
      const { pos, rot } = spawnRef.current;
      const quat = new THREE.Quaternion().setFromEuler(rot);
      // Teleport to spawn and stop
      body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
      body.setRotation(quat, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    if (!doReset) resetLatch.current = false;

    // 기본 튜닝값 (모바일 가속을 조금 더 키움)
    const accelerateForce = isMobile ? 1.5 : 1.0;
    const brakeForce      = 0.08;
    const steerAngle      = Math.PI / 18; // 조금 더 민감하게

    // 엔진: 앞바퀴(0,1)
    const engineForce = forward * accelerateForce - back * accelerateForce;
    ctrl.setWheelEngineForce(0, engineForce);
    ctrl.setWheelEngineForce(1, engineForce);

    // 브레이크: 모든 바퀴
    const wheelBrake = brakeKey * brakeForce;
    for (let i = 0; i < 4; i++) ctrl.setWheelBrake(i, wheelBrake);

    // 조향: 앞바퀴만
    const currentSteering = ctrl.wheelSteering(0) || 0;
    const steerDir = left - right; // -1..1
    const steering = THREE.MathUtils.lerp(currentSteering, steerAngle * steerDir, 0.5);
    ctrl.setWheelSteering(0, steering);
    ctrl.setWheelSteering(1, steering);
  });

  return (
    <RigidBody
      position={position}
      rotation={rotation}
      canSleep={false}
      ref={chassisBodyRef}
      colliders={false}
      type="dynamic"
    >
      {/* Collider: half extents → 시각 메쉬(1.6, 0.4, 0.8)와 일치 */}
      <CuboidCollider args={[0.8, 0.2, 0.4]} />

      {/* 차체 */}
      <mesh ref={chassisMeshRef}>
        <boxGeometry args={[1.6, 0.4, 0.8]} />
        <meshStandardMaterial color="#7cc5ff" />
      </mesh>

      {/* 바퀴 (반지름/폭은 Pane 반영) */}
      {wheels.map((wheel, index) => (
        <group
          key={index}
          ref={(ref) => (wheelsRef.current[index] = ref)}
          position={wheel.position}
        >
          <group rotation-x={-Math.PI / 2}>
            <mesh>
              <cylinderGeometry args={[params.radius, params.radius, params.width, 20]} />
              <meshStandardMaterial color="#222" />
            </mesh>
            <mesh scale={1.01}>
              <cylinderGeometry args={[params.radius, params.radius, params.width, 6]} />
              <meshStandardMaterial color="#fff" wireframe />
            </mesh>
          </group>
        </group>
      ))}
    </RigidBody>
  );
};

export default Vehicle;