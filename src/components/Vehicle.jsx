import React, { useRef, useEffect, useState, useMemo } from "react";
import { RigidBody, CuboidCollider, useRapier } from "@react-three/rapier";
import { useKeyboardControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useVehicleController } from "@/utils/useVehicleController";
import { useInputStore } from "@/store/useInputStore";

const isMobile =
  typeof navigator !== "undefined" &&
  /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
const _cameraPosition = new THREE.Vector3();
const _cameraTarget = new THREE.Vector3();
const cameraOffset = new THREE.Vector3(0, 2.2, 5.5); // follow-cam offset (behind & above the car, in local space)  // z는 +로 (차의 뒤)
const cameraTargetOffset = new THREE.Vector3(0, 1.5, 0); // look-at offset (aim a bit above chassis center)
const _bodyPosition = new THREE.Vector3(); // temp: chassis world position
const _forwardDir = new THREE.Vector3();      // temp: world forward
const _shakeOffset = new THREE.Vector3();     // temp: camera shake
const _rand = new THREE.Vector3();            // temp: random unit vector
const _quatTmp = new THREE.Quaternion();      // temp: reuse quaternion
const _forwardLocalNegX = new THREE.Vector3(-1, 0, 0);
const _forwardLocalPosX = new THREE.Vector3(1, 0, 0);
const _forwardLocalNegZ = new THREE.Vector3(0, 0, -1);

const Vehicle = ({ position, rotation, debugPane }) => {
  // Pane(선택)로 조절할 수 있는 기본 파라미터
  const INITIAL = {
    // Suspension / wheels
    suspensionRestLength: 0.125,
    suspensionStiffness: 24,
    maxSuspensionTravel: 1.0,
    radius: 0.15,
    width: 0.25,

    // Camera
    cameraDist: 5.5,
    cameraHeight: 2.2,
    forwardAxis: 'negX', // 'negX' | 'posX' | 'negZ'

    // FOV auto zoom
    enableFovAuto: true,
    fovMin: 60,
    fovMax: 85,
    fovNeutral: 5,   // m/s
    fovGain: 1.2,

    // Screen shake
    enableShake: true,
    shakeAmp: 0.15,
    shakeDecay: 10,

    // Air control
    enableAir: true,
    airPitch: 1.6,
    airYaw: 1.2,
    airRoll: 0.0,
    airMaxAngVel: 6.0,
    airDamping: 0.02,
    groundRayDist: 1.0,
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

    bind(fSusp, "suspensionRestLength", {
      min: 0.05,
      max: 0.4,
      step: 0.005,
      label: "restLength (m)",
    });
    bind(fSusp, "suspensionStiffness", {
      min: 4,
      max: 60,
      step: 1,
      label: "stiffness",
    });
    bind(fSusp, "maxSuspensionTravel", {
      min: 0.1,
      max: 2.0,
      step: 0.05,
      label: "maxTravel (m)",
    });

    bind(fWheel, "radius", {
      min: 0.05,
      max: 0.6,
      step: 0.005,
      label: "radius (m)",
    });
    bind(fWheel, "width", {
      min: 0.05,
      max: 0.6,
      step: 0.01,
      label: "width (m)",
    });

    // --- Camera ---
    const fCam = fVehicle.addFolder({ title: 'Camera', expanded: true });
    bind(fCam, 'cameraDist',  { min: 2, max: 15, step: 0.1, label: 'distance' });
    bind(fCam, 'cameraHeight',{ min: 0.5, max: 6, step: 0.05, label: 'height'  });
    bind(fCam, 'forwardAxis', { options: { '-X': 'negX', '+X': 'posX', '-Z': 'negZ' }, label: 'forward axis' });

    // --- FOV ---
    const fFov = fVehicle.addFolder({ title: 'FOV Auto Zoom', expanded: false });
    bind(fFov, 'enableFovAuto', { label: 'enabled' });
    bind(fFov, 'fovMin',       { min: 40, max: 80, step: 1, label: 'min' });
    bind(fFov, 'fovMax',       { min: 60, max: 110, step: 1, label: 'max' });
    bind(fFov, 'fovNeutral',   { min: 0, max: 20, step: 0.5, label: 'neutral m/s' });
    bind(fFov, 'fovGain',      { min: 0.2, max: 3.0, step: 0.05, label: 'gain' });

    // --- Effects ---
    const fFx = fVehicle.addFolder({ title: 'Effects', expanded: false });
    bind(fFx, 'enableShake', { label: 'shake enabled' });
    bind(fFx, 'shakeAmp',    { min: 0, max: 0.6, step: 0.01, label: 'shake amp' });
    bind(fFx, 'shakeDecay',  { min: 1, max: 30, step: 0.5, label: 'shake decay' });

    // --- Air Control ---
    const fAir = fVehicle.addFolder({ title: 'Air Control', expanded: false });
    bind(fAir, 'enableAir',     { label: 'enabled' });
    bind(fAir, 'airPitch',      { min: 0, max: 5, step: 0.05, label: 'pitch' });
    bind(fAir, 'airYaw',        { min: 0, max: 5, step: 0.05, label: 'yaw' });
    bind(fAir, 'airRoll',       { min: 0, max: 5, step: 0.05, label: 'roll' });
    bind(fAir, 'airMaxAngVel',  { min: 0.5, max: 20, step: 0.5, label: 'max ang vel' });
    bind(fAir, 'airDamping',    { min: 0.0, max: 0.2, step: 0.005, label: 'damping' });
    bind(fAir, 'groundRayDist', { min: 0.2, max: 3.0, step: 0.05, label: 'ground ray' });

    return () => {
      vehicleFolderRef.current?.dispose();
      vehicleFolderRef.current = null;
    };
  }, [debugPane]);

  // Rapier refs & 입력 훅
  const chassisBodyRef = useRef(null);
  const chassisMeshRef = useRef(null);
  const wheelsRef = useRef([]);
  const { world, rapier } = useRapier();
  const ground = useRef(null);
  const shakeRef = useRef(0);

  // Smooth camera buffers (reuse the same instances; created once)
  const [smoothedCameraPosition] = useState(() => new THREE.Vector3(0, 3, -6));
  const [smoothedCameraTarget] = useState(() => new THREE.Vector3());

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
  const wheelInfo = useMemo(
    () => ({
      axleCs: new THREE.Vector3(0, 0, -1),
      suspensionRestLength: params.suspensionRestLength,
      suspensionStiffness: params.suspensionStiffness,
      maxSuspensionTravel: params.maxSuspensionTravel,
      radius: params.radius,
      width: params.width,
    }),
    [params]
  );

  // 바퀴 위치 (차체 로컬 좌표)
  const wheels = useMemo(
    () => [
      { position: new THREE.Vector3(-0.65, -0.15, -0.45), ...wheelInfo }, // front-left
      { position: new THREE.Vector3(-0.65, -0.15, 0.45), ...wheelInfo }, // front-right
      { position: new THREE.Vector3(0.65, -0.15, -0.45), ...wheelInfo }, // rear-left
      { position: new THREE.Vector3(0.65, -0.15, 0.45), ...wheelInfo }, // rear-right
    ],
    [wheelInfo]
  );

  // 레이캐스트 차량 컨트롤러 연결 (휠 시각 동기화는 훅에서 처리)
  const { vehicleController } = useVehicleController(
    chassisBodyRef,
    wheelsRef,
    wheels
  );

  // 입력 → 물리값
  useFrame((state, delta) => {
    const ctrl = vehicleController.current;
    if (!ctrl || !chassisMeshRef.current) return;

    // 모바일이면 zustand의 keys, 아니면 drei의 getKeyboardControls()
    const k = isMobile ? store.keys : getKeyboardControls();

    const forward = Number(k.forward) || 0;
    const back = Number(k.back || k.backward) || 0;
    const left = Number(k.left) || 0;
    const right = Number(k.right) || 0;
    const brakeKey = Number(k.brake) || 0;

    // --- Reset handling (works for desktop R key and mobile pulse) ---
    const doReset = !!k.reset;
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
    const brakeForce = 0.08;
    const steerAngle = Math.PI / 18; // 조금 더 민감하게

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
    const steering = THREE.MathUtils.lerp(
      currentSteering,
      steerAngle * steerDir,
      0.5
    );
    ctrl.setWheelSteering(0, steering);
    ctrl.setWheelSteering(1, steering);
    
    // --- Ground check (simple downward ray) ---
    let isGrounded = false;
    if (chassisBodyRef.current && world && rapier) {
      const t = chassisBodyRef.current.translation();
      const ray = new rapier.Ray({ x: t.x, y: t.y, z: t.z }, { x: 0, y: -1, z: 0 });
      const hit = world.castRay(ray, paramsRef.current.groundRayDist, true);
      isGrounded = !!hit;
      ground.current = hit ? hit.collider : null;
    }

    // --- Air control (apply when NOT grounded) ---
    if (paramsRef.current.enableAir && !isGrounded && chassisBodyRef.current) {
      const pitchIn = forward - back;
      const yawIn   = left - right;
      const rollIn  = 0;

      _cameraTarget.set(
        paramsRef.current.airPitch * pitchIn,
        paramsRef.current.airYaw   * yawIn,
        paramsRef.current.airRoll  * rollIn
      );
      // Rotate to WORLD space using chassis orientation
      const q = chassisMeshRef.current.quaternion;
      _cameraTarget.applyQuaternion(q);

      // Current angular velocity (world)
      const av = chassisBodyRef.current.angvel();
      _cameraPosition.set(av.x, av.y, av.z);

      // Apply increment scaled by dt, add small damping
      _cameraPosition.addScaledVector(_cameraTarget, delta);
      _cameraPosition.multiplyScalar(1.0 - paramsRef.current.airDamping);

      // Clamp magnitude
      const maxW = paramsRef.current.airMaxAngVel;
      if (_cameraPosition.length() > maxW) _cameraPosition.setLength(maxW);

      chassisBodyRef.current.setAngvel({ x: _cameraPosition.x, y: _cameraPosition.y, z: _cameraPosition.z }, true);
    }
    
    // --- Follow camera ---
    // Exponential smoothing factor (frame-rate independent)
    const t = 1.0 - Math.pow(0.01, delta);
    
    // 카메라 거리/높이 (cameraOffset에서 파생)
    const DIST = Math.abs(paramsRef.current.cameraDist);
    const HEIGHT = paramsRef.current.cameraHeight;
    
    // 차체 월드 위치와 전방 벡터
    const bodyPos = chassisMeshRef.current.getWorldPosition(_bodyPosition);
    // Select local forward axis
    let fLocal = _forwardLocalNegX;
    if (paramsRef.current.forwardAxis === 'posX') fLocal = _forwardLocalPosX;
    else if (paramsRef.current.forwardAxis === 'negZ') fLocal = _forwardLocalNegZ;

    _forwardDir.copy(fLocal).applyQuaternion(chassisMeshRef.current.quaternion).normalize();
    
    // 원하는 카메라 위치 = 차의 뒤쪽(-forward) * 거리 + 높이
    const desiredCamPos = _cameraPosition.copy(bodyPos).addScaledVector(_forwardDir, -DIST);
    desiredCamPos.y = Math.max(desiredCamPos.y + HEIGHT, (chassisBodyRef.current?.translation().y ?? 0) + 1.0);

    // Optional screen shake
    if (paramsRef.current.enableShake && shakeRef.current > 0) {
      shakeRef.current = Math.max(0, shakeRef.current - paramsRef.current.shakeDecay * delta);
      _rand.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      _shakeOffset.copy(_rand).multiplyScalar(paramsRef.current.shakeAmp * shakeRef.current);
      desiredCamPos.add(_shakeOffset);
    }
    
    // 위치 스무딩
    smoothedCameraPosition.lerp(desiredCamPos, t);
    state.camera.position.copy(smoothedCameraPosition);
    
    // 타깃은 차체 중심 살짝 위
    const desiredTarget = _cameraTarget.copy(bodyPos).add(cameraTargetOffset);
    smoothedCameraTarget.lerp(desiredTarget, t);
    state.camera.lookAt(smoothedCameraTarget);

    // Speed-based FOV (optional)
    if (paramsRef.current.enableFovAuto) {
      const v = chassisBodyRef.current.linvel();
      const speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
      const targetFov = THREE.MathUtils.clamp(
        paramsRef.current.fovMin + (speed - paramsRef.current.fovNeutral) * paramsRef.current.fovGain,
        paramsRef.current.fovMin,
        paramsRef.current.fovMax
      );
      state.camera.fov += (targetFov - state.camera.fov) * (1.0 - Math.pow(0.01, delta));
      state.camera.updateProjectionMatrix();
    }
  });

  return (
    <RigidBody
      position={position}
      rotation={rotation}
      canSleep={false}
      ref={chassisBodyRef}
      colliders={false}
      type="dynamic"
      onCollisionEnter={() => { if (paramsRef.current.enableShake) shakeRef.current = Math.min(shakeRef.current + 0.6, 1); }}
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
              <cylinderGeometry
                args={[params.radius, params.radius, params.width, 20]}
              />
              <meshStandardMaterial color="#222" />
            </mesh>
            <mesh scale={1.01}>
              <cylinderGeometry
                args={[params.radius, params.radius, params.width, 6]}
              />
              <meshStandardMaterial color="#fff" wireframe />
            </mesh>
          </group>
        </group>
      ))}
    </RigidBody>
  );
};

export default Vehicle;
