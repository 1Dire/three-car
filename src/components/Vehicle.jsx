// Vehicle.jsx
import React, { useRef, useEffect, useState, useMemo } from "react";
import { RigidBody, CuboidCollider } from "@react-three/rapier"; // Rapier 물리 컴포넌트
import { useKeyboardControls } from "@react-three/drei"; // 키보드 입력 Hook
import { useVehicleController } from "@/utils/useVehicleController"; // 커스텀 Hook
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const Vehicle = ({ position, rotation, debugPane }) => {
  // -----------------------------
  // 1) 디버그 파라미터 정의
  // -----------------------------
  const INITIAL = {
    suspensionRestLength: 0.125, // 서스펜션 기본 길이 (차체-바퀴 평형 거리)
    suspensionStiffness: 24,     // 서스펜션 강도 (클수록 딱딱)
    maxSuspensionTravel: 1.0,    // 최대 스트로크 (압축/신장 허용치)
    radius: 0.15,                // 바퀴 반지름
    width: 0.25,                 // 바퀴 폭
  };
  const [params, setParams] = useState(INITIAL); // 렌더링에 사용
  const paramsRef = useRef({ ...INITIAL });      // tweakpane 바인딩 소스
  const vehicleFolderRef = useRef(null);         // Vehicle 폴더 (중복 생성 방지)

  // -----------------------------
  // 2) Vehicle 폴더 & 컨트롤 바인딩 (tweakpane)
  // -----------------------------
  useEffect(() => {
    if (!debugPane || vehicleFolderRef.current) return; // 이미 생성됨

    const fVehicle = debugPane.addFolder({ title: "Vehicle", expanded: true });
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

    // Suspension
    bind(fSusp, "suspensionRestLength", { min: 0.05, max: 0.4, step: 0.005, label: "restLength (m)" });
    bind(fSusp, "suspensionStiffness",  { min: 4,    max: 60,  step: 1,     label: "stiffness" });
    bind(fSusp, "maxSuspensionTravel",   { min: 0.1,  max: 2.0, step: 0.05,  label: "maxTravel (m)" });

    // Wheel
    bind(fWheel, "radius", { min: 0.05, max: 0.6, step: 0.005, label: "radius (m)" });
    bind(fWheel, "width",  { min: 0.05, max: 0.6, step: 0.01,  label: "width (m)" });

    return () => {
      vehicleFolderRef.current?.dispose();
      vehicleFolderRef.current = null;
    };
  }, [debugPane]);

  // -----------------------------
  // 3) Rapier refs & 입력 훅
  // -----------------------------
  const chassisBodyRef = useRef(null);  // 차체 RigidBody ref
  const chassisMeshRef = useRef(null);  // 차체 mesh ref
  const wheelsRef = useRef([]);         // 바퀴 그룹 refs
  const [, getKeyboardControls] = useKeyboardControls();

  // -----------------------------
  // 4) 바퀴 정보 (Pane 값 반영)
  // -----------------------------
  const wheelInfo = useMemo(() => ({
    axleCs: new THREE.Vector3(0, 0, -1),
    suspensionRestLength: params.suspensionRestLength,
    suspensionStiffness: params.suspensionStiffness,
    maxSuspensionTravel: params.maxSuspensionTravel,
    radius: params.radius,
    width: params.width,
  }), [
    params.suspensionRestLength,
    params.suspensionStiffness,
    params.maxSuspensionTravel,
    params.radius,
    params.width,
  ]);

  const wheels = useMemo(() => ([
    { position: new THREE.Vector3(-0.65, -0.15, -0.45), ...wheelInfo }, // front-left
    { position: new THREE.Vector3(-0.65, -0.15,  0.45), ...wheelInfo }, // front-right
    { position: new THREE.Vector3( 0.65, -0.15, -0.45), ...wheelInfo }, // rear-left
    { position: new THREE.Vector3( 0.65, -0.15,  0.45), ...wheelInfo }, // rear-right
  ]), [wheelInfo]);

  // -----------------------------
  // 5) 레이캐스트 차량 컨트롤러 연결 (휠 시각 동기화는 훅 내부에서 처리)
  // -----------------------------
  const { vehicleController } = useVehicleController(chassisBodyRef, wheelsRef, wheels);

  // -----------------------------
  // 6) 키 입력 → 엔진/브레이크/조향 적용 (간단 버전)
  // -----------------------------
  useFrame((state, delta) => {
    const ctrl = vehicleController.current;
    if (!ctrl || !chassisMeshRef.current) return;

    const keys = getKeyboardControls();
    const forward = Number(keys.forward) || 0;
    const back    = Number(keys.back || keys.backward) || 0;
    const left    = Number(keys.left) || 0;
    const right   = Number(keys.right) || 0;
    const brakeKey= Number(keys.brake) || 0;

    // 간단 파라미터 (원하면 Pane으로 이관 가능)
    const accelerateForce = 1.0;
    const brakeForce      = 0.05;
    const steerAngle      = Math.PI / 24;

    // 엔진: 앞바퀴(0,1)
    const engineForce = forward * accelerateForce - back * accelerateForce;
    ctrl.setWheelEngineForce(0, engineForce);
    ctrl.setWheelEngineForce(1, engineForce);

    // 브레이크: 모든 바퀴
    const wheelBrake = brakeKey * brakeForce;
    ctrl.setWheelBrake(0, wheelBrake);
    ctrl.setWheelBrake(1, wheelBrake);
    ctrl.setWheelBrake(2, wheelBrake);
    ctrl.setWheelBrake(3, wheelBrake);

    // 조향: 앞바퀴만
    const currentSteering = ctrl.wheelSteering(0) || 0;
    const steerDir = left - right; // -1..1
    const steering = THREE.MathUtils.lerp(currentSteering, steerAngle * steerDir, 0.5);
    ctrl.setWheelSteering(0, steering);
    ctrl.setWheelSteering(1, steering);
  });

  // -----------------------------
  // 7) 렌더링
  // -----------------------------
  return (
    <RigidBody
      position={position}
      rotation={rotation}
      canSleep={false}
      ref={chassisBodyRef}
      colliders={false}
      type="dynamic"
    >
      {/* Collider: 절반 크기 → 실제 박스 1.6 x 0.4 x 0.8 */}
      <CuboidCollider args={[0.8, 0.2, 0.4]} />

      {/* Chassis 시각화 */}
      <mesh ref={chassisMeshRef}>
        <boxGeometry args={[1.6, 0.4, 0.8]} />
        <meshStandardMaterial color="#7cc5ff" />
      </mesh>

      {/* Wheels: radius/width는 Pane 값으로 동적 반영 */}
      {wheels.map((wheel, index) => (
        <group
          key={index}
          ref={(ref) => (wheelsRef.current[index] = ref)}
          position={wheel.position}
        >
          {/* 수평 회전축 정렬: X축 -90도 */}
          <group rotation-x={-Math.PI / 2}>
            {/* 타이어 본체 */}
            <mesh>
              <cylinderGeometry args={[params.radius, params.radius, params.width, 20]} />
              <meshStandardMaterial color="#222" />
            </mesh>
            {/* 타이어 와이어프레임 (디버그) */}
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
