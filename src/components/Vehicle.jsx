import React, { useRef, useEffect, useState, useMemo } from "react";
import { RigidBody, CuboidCollider, useRapier } from "@react-three/rapier";
import { useKeyboardControls, useGLTF, Clone } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useVehicleController } from "@/utils/useVehicleController";
import { useInputStore } from "@/store/useInputStore";

const isMobile =
  typeof navigator !== "undefined" &&
  /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);

const _cameraPosition = new THREE.Vector3();
const _cameraTarget = new THREE.Vector3();
const cameraTargetOffset = new THREE.Vector3(0, 1.5, 0); // look-at offset

const _bodyPosition = new THREE.Vector3();
const _forwardDir = new THREE.Vector3();
const _shakeOffset = new THREE.Vector3();
const _rand = new THREE.Vector3();
const _quatTmp = new THREE.Quaternion();

// temp vectors (reuse each frame to avoid GC churn)
const _tmpUpWorld = new THREE.Vector3();
const _tmpAxis = new THREE.Vector3();
const _tmpYawAxis = new THREE.Vector3(0, 1, 0);
const _tmpAv = new THREE.Vector3();
const _tmpAvYaw = new THREE.Vector3();

const _forwardLocalNegX = new THREE.Vector3(-1, 0, 0);
const _forwardLocalPosX = new THREE.Vector3(1, 0, 0);
const _forwardLocalNegZ = new THREE.Vector3(0, 0, -1);

const Vehicle = ({ position, rotation, debugPane, bodyModelUrl, wheelModelUrl }) => {
  // Pane로 조절 가능한 기본 파라미터
  const INITIAL = {
    // === Suspension / wheels (물리 바퀴 기본값) ===
    suspensionRestLength: 0.125, // (m) 무부하 길이. 크면 차고↑/출렁임↑, 작으면 낮고 단단
    suspensionStiffness: 24,     // 스프링 강성. 크면 단단/롤·피치↓, 작으면 말랑/승차감↑
    maxSuspensionTravel: 1.0,    // (m) 최대 스트로크. 크면 요철 대응↑(과하면 배가 흔들림)
    radius: 0.15,                // (m) 바퀴 반지름(물리/시각 기준)
    width: 0.25,                 // (m) 바퀴 폭(주로 시각용; 간섭/룩 조절)

    // === Camera (3인칭 추적 카메라) ===
    cameraDist: 5.5,             // (m) 차량 뒤 카메라 거리
    cameraHeight: 2.2,           // (m) 차량 위 카메라 높이
    forwardAxis: "negX",        // 차의 전진 로컬 축: 'negX' | 'posX' | 'negZ'

    // === FOV auto zoom (속도 기반 시야각 자동 보간) ===
    enableFovAuto: true,         // 활성화 여부
    fovMin: 60,                  // (deg) 최소 FOV
    fovMax: 85,                  // (deg) 최대 FOV
    fovNeutral: 5,               // (m/s) 이 속도에서 FOV가 중립
    fovGain: 1.2,                // 속도 변화→FOV 변화 감도

    // === Screen shake (충돌시 흔들림) ===
    enableShake: true,           // 활성화 여부
    shakeAmp: 0.15,              // 진폭 (세게 흔들 정도)
    shakeDecay: 10,              // (1/s) 감쇠율 (클수록 빨리 가라앉음)

    // === Air control (공중에서 차체 각속도 보정) ===
    enableAir: true,             // 활성화 여부
    airPitch: 1.6,               // 앞/뒤 입력 → pitch 각속도 게인
    airYaw: 1.2,                 // 좌/우 입력 → yaw 각속도 게인
    airRoll: 0.0,                // 롤 입력 게인(필요시 사용)
    airMaxAngVel: 6.0,           // (rad/s) 공중에서 허용되는 최대 각속도
    airDamping: 0.02,            // 각속도 감쇠(0~0.2 정도)
    groundRayDist: 1.0,          // (m) 지면 감지 레이 길이(접지 판단)

    // === Wheel positions (앞/뒤 독립 위치) ===
    frontX: 0.75,                // (m) 앞축 X 거리(현재 셋업: -X가 전방이므로 내부에서 -적용)
    rearX: 0.55,                 // (m) 뒤축 X 거리(+X가 후방)
    frontTrack: 0.36,            // (m) 앞 트랙(절대 Z 반폭)
    rearTrack: 0.36,             // (m) 뒤 트랙(절대 Z 반폭)
    wheelY: -0.15,               // (m) 바퀴 중심 높이(차체 로컬)

    // === Wheel visual alignment (휠 GLTF 정렬) ===
    wheelRotX: 0,                // (deg) 휠 모델 X 회전 보정(많은 모델이 -90 필요)
    wheelRotY: 0,                // (deg) 휠 모델 Y 회전 보정
    wheelRotZ: 0,                // (deg) 휠 모델 Z 회전 보정
    wheelOffX: 0,                // (m) 시각 휠 오프셋 X
    wheelOffY: 0,                // (m) 시각 휠 오프셋 Y
    wheelOffZ: 0,                // (m) 시각 휠 오프셋 Z
    wheelScaleMul: 1.2,          // 시각 휠 스케일 곱(물리 반지름 대비 미세조정)
    wheelFlipLeft: false,        // 왼쪽 휠 림 방향 뒤집기(Yaw 180°)
    wheelFlipRight: true,        // 오른쪽 휠 림 방향 뒤집기(Yaw 180°)

    // === Body visual alignment (차체 GLTF 정렬; 물리엔 영향 X) ===
    bodyOffX: -0.185,            // (m) 차체 시각 오프셋 X
    bodyOffY: -0.261,            // (m) 차체 시각 오프셋 Y
    bodyOffZ: 0,                 // (m) 차체 시각 오프셋 Z
    bodyScaleMul: 0.78,          // 차체 시각 스케일 배수
    bodyTiltPitch: 0,            // (deg) 차체 시각 기울기: pitch
    bodyTiltYaw: 0,              // (deg) 차체 시각 기울기: yaw
    bodyTiltRoll: 1.5,           // (deg) 차체 시각 기울기: roll

    // === Wheel spin axis (컨트롤러 바퀴 회전축 선택) ===
    wheelSpinAxis: "negZ",      // 'negZ' | 'posZ' | 'negX' | 'posX'

    // === Upright spring (부드러운 롤/피치 복원) ===
    uprightEnabled: true,        // 활성화 여부
    uprightStrength: 8.0,        // P 게인(클수록 자세 복원 힘↑)
    uprightDamping: 1.5,         // D 게인(클수록 과도응답 억제)
    uprightMaxTorque: 80.0,      // (N·m) 토크 상한(클램프)
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

    // Suspension
    bind(fSusp, "suspensionRestLength", { min: 0.05, max: 0.4, step: 0.005, label: "restLength (m)" });
    bind(fSusp, "suspensionStiffness", { min: 4, max: 60, step: 1, label: "stiffness" });
    bind(fSusp, "maxSuspensionTravel", { min: 0.1, max: 2.0, step: 0.05, label: "maxTravel (m)" });

    // Wheel
    bind(fWheel, "radius", { min: 0.05, max: 0.6, step: 0.005, label: "radius (m)" });
    bind(fWheel, "width", { min: 0.05, max: 0.6, step: 0.01, label: "width (m)" });
    bind(fWheel, "wheelRotX", { min: -180, max: 180, step: 1, label: "rotX (deg)" });
    bind(fWheel, "wheelRotY", { min: -180, max: 180, step: 1, label: "rotY (deg)" });
    bind(fWheel, "wheelRotZ", { min: -180, max: 180, step: 1, label: "rotZ (deg)" });
    bind(fWheel, "wheelOffX", { min: -0.5, max: 0.5, step: 0.001, label: "offX (m)" });
    bind(fWheel, "wheelOffY", { min: -0.5, max: 0.5, step: 0.001, label: "offY (m)" });
    bind(fWheel, "wheelOffZ", { min: -0.5, max: 0.5, step: 0.001, label: "offZ (m)" });
    bind(fWheel, "wheelScaleMul", { min: 0.2, max: 3.0, step: 0.01, label: "scale mul" });
    bind(fWheel, "wheelSpinAxis", { options: { "-Z": "negZ", "+Z": "posZ", "-X": "negX", "+X": "posX" }, label: "spin axis" });
    bind(fWheel, "wheelFlipLeft", { label: "flip LEFT yaw 180°" });
    bind(fWheel, "wheelFlipRight", { label: "flip RIGHT yaw 180°" });
    // Wheel Positions subfolder
    const fWheelPos = fWheel.addFolder({ title: 'Wheel Positions', expanded: true });
    bind(fWheelPos, 'frontX', { min: 0.1, max: 2.0, step: 0.01, label: 'front X (m)' });
    bind(fWheelPos, 'rearX', { min: 0.1, max: 2.0, step: 0.01, label: 'rear X (m)' });
    bind(fWheelPos, 'frontTrack', { min: 0.1, max: 1.5, step: 0.01, label: 'front track (|z|)' });
    bind(fWheelPos, 'rearTrack', { min: 0.1, max: 1.5, step: 0.01, label: 'rear track (|z|)' });
    bind(fWheelPos, 'wheelY', { min: -0.6, max: 0.3, step: 0.005, label: 'wheel Y' });

    // Camera
    const fCam = fVehicle.addFolder({ title: "Camera", expanded: true });
    bind(fCam, "cameraDist", { min: 2, max: 15, step: 0.1, label: "distance" });
    bind(fCam, "cameraHeight", { min: 0.5, max: 6, step: 0.05, label: "height" });
    bind(fCam, "forwardAxis", { options: { "-X": "negX", "+X": "posX", "-Z": "negZ" }, label: "forward axis" });

    // FOV auto zoom
    const fFov = fVehicle.addFolder({ title: "FOV Auto Zoom", expanded: false });
    bind(fFov, "enableFovAuto", { label: "enabled" });
    bind(fFov, "fovMin", { min: 40, max: 80, step: 1, label: "min" });
    bind(fFov, "fovMax", { min: 60, max: 110, step: 1, label: "max" });
    bind(fFov, "fovNeutral", { min: 0, max: 20, step: 0.5, label: "neutral m/s" });
    bind(fFov, "fovGain", { min: 0.2, max: 3.0, step: 0.05, label: "gain" });

    // Effects
    const fFx = fVehicle.addFolder({ title: "Effects", expanded: false });
    bind(fFx, "enableShake", { label: "shake enabled" });
    bind(fFx, "shakeAmp", { min: 0, max: 0.6, step: 0.01, label: "shake amp" });
    bind(fFx, "shakeDecay", { min: 1, max: 30, step: 0.5, label: "shake decay" });

    // Air control
    const fAir = fVehicle.addFolder({ title: "Air Control", expanded: false });
    bind(fAir, "enableAir", { label: "enabled" });
    bind(fAir, "airPitch", { min: 0, max: 5, step: 0.05, label: "pitch" });
    bind(fAir, "airYaw", { min: 0, max: 5, step: 0.05, label: "yaw" });
    bind(fAir, "airRoll", { min: 0, max: 5, step: 0.05, label: "roll" });
    bind(fAir, "airMaxAngVel", { min: 0.5, max: 20, step: 0.5, label: "max ang vel" });
    bind(fAir, "airDamping", { min: 0.0, max: 0.2, step: 0.005, label: "damping" });
    bind(fAir, "groundRayDist", { min: 0.2, max: 3.0, step: 0.05, label: "ground ray" });

    // Body Visual
    const fBody = fVehicle.addFolder({ title: "Body Visual", expanded: false });
    bind(fBody, "bodyOffX", { min: -0.5, max: 0.5, step: 0.001, label: "offX (m)" });
    bind(fBody, "bodyOffY", { min: -0.5, max: 0.5, step: 0.001, label: "offY (m)" });
    bind(fBody, "bodyOffZ", { min: -0.5, max: 0.5, step: 0.001, label: "offZ (m)" });
    bind(fBody, "bodyScaleMul", { min: 0.2, max: 3.0, step: 0.01, label: "scale mul" });
    bind(fBody, "bodyTiltPitch", { min: -45, max: 45, step: 0.5, label: "pitch (deg)" });
    bind(fBody, "bodyTiltYaw",   { min: -45, max: 45, step: 0.5, label: "yaw (deg)" });
    bind(fBody, "bodyTiltRoll",  { min: -45, max: 45, step: 0.5, label: "roll (deg)" });

    // Upright Spring tuning folder
    const fUpright = fVehicle.addFolder({ title: 'Upright Spring', expanded: false });
    bind(fUpright, 'uprightEnabled', { label: 'enabled' });
    bind(fUpright, 'uprightStrength', { min: 0.0, max: 40.0, step: 0.5, label: 'strength' });
    bind(fUpright, 'uprightDamping', { min: 0.0, max: 10.0, step: 0.1, label: 'damping' });
    bind(fUpright, 'uprightMaxTorque', { min: 5.0, max: 200.0, step: 1.0, label: 'max torque' });

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

  // Optional GLTF Models
  const bodyGltf  = bodyModelUrl ? useGLTF(bodyModelUrl) : null;
  const wheelGltf = wheelModelUrl ? useGLTF(wheelModelUrl) : null;

  // Wheel model auto-centering & scaling
  const wheelBounds = useMemo(() => {
    if (!wheelGltf) return null;
    const box = new THREE.Box3().setFromObject(wheelGltf.scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const diameter = Math.max(size.x, size.y, size.z);
    return { size, center, diameter };
  }, [wheelGltf]);

  // 시각 정렬(필요시 조정)
  const BODY_MODEL_OFFSET  = new THREE.Vector3(0, -0.1, 0);
  const BODY_MODEL_SCALE   = 0.7;  // initial smaller visual scale; fine-tune via bodyScaleMul
  const WHEEL_MODEL_OFFSET = new THREE.Vector3(0, 0, 0);
  const WHEEL_MODEL_SCALE  = 1.0;

  // Smooth camera buffers
  const [smoothedCameraPosition] = useState(() => new THREE.Vector3(0, 3, -6));
  const [smoothedCameraTarget] = useState(() => new THREE.Vector3());

  // Spawn (reset) support
  const spawnRef = useRef({
    pos: new THREE.Vector3(...position),
    rot: new THREE.Euler(...rotation),
  });
  const resetLatch = useRef(false);

  useEffect(() => {
    spawnRef.current.pos.set(...position);
    spawnRef.current.rot.set(...rotation);
  }, [position, rotation]);

  const [, getKeyboardControls] = useKeyboardControls();
  const store = useInputStore();

  // 바퀴 파라미터
  const wheelInfo = useMemo(
    () => ({
      axleCs: (() => {
        const a = params.wheelSpinAxis;
        if (a === "posZ") return new THREE.Vector3(0, 0,  1);
        if (a === "negZ") return new THREE.Vector3(0, 0, -1);
        if (a === "posX") return new THREE.Vector3(1, 0,  0);
        if (a === "negX") return new THREE.Vector3(-1, 0, 0);
        return new THREE.Vector3(0, 0, -1);
      })(),
      suspensionRestLength: params.suspensionRestLength,
      suspensionStiffness: params.suspensionStiffness,
      maxSuspensionTravel: params.maxSuspensionTravel,
      radius: params.radius,
      width: params.width,
    }),
    [params]
  );

  // 바퀴 위치 (차체 로컬 좌표)
  const wheels = useMemo(() => {
    const y = params.wheelY;
    const fx = -Math.abs(params.frontX); // forward is -X in current setup
    const rx =  Math.abs(params.rearX);
    const ft = Math.abs(params.frontTrack);
    const rt = Math.abs(params.rearTrack);
    return [
      { position: new THREE.Vector3(fx, y, -ft), ...wheelInfo }, // front-left
      { position: new THREE.Vector3(fx, y,  ft), ...wheelInfo }, // front-right
      { position: new THREE.Vector3(rx, y, -rt), ...wheelInfo }, // rear-left
      { position: new THREE.Vector3(rx, y,  rt), ...wheelInfo }, // rear-right
    ];
  }, [wheelInfo, params.frontX, params.rearX, params.frontTrack, params.rearTrack, params.wheelY]);

  // 레이캐스트 차량 컨트롤러 연결
  const { vehicleController } = useVehicleController(
    chassisBodyRef,
    wheelsRef,
    wheels
  );

  // 입력 → 물리값
  useFrame((state, delta) => {
    const ctrl = vehicleController.current;
    if (!ctrl || !chassisMeshRef.current) return;

    const k = isMobile ? store.keys : getKeyboardControls();

    const forward = Number(k.forward) || 0;
    const back = Number(k.back || k.backward) || 0;
    const left = Number(k.left) || 0;
    const right = Number(k.right) || 0;
    const brakeKey = Number(k.brake) || 0;

    // --- Reset handling ---
    const doReset = !!k.reset;
    if (doReset && !resetLatch.current && chassisBodyRef.current) {
      resetLatch.current = true;
      const body = chassisBodyRef.current;
      const { pos, rot } = spawnRef.current;
      const quat = new THREE.Quaternion().setFromEuler(rot);
      body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
      body.setRotation(quat, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    if (!doReset) resetLatch.current = false;

    // 기본 튜닝값
    const accelerateForce = isMobile ? 1.5 : 1.0;
    const brakeForce = 0.08;
    const steerAngle = Math.PI / 18;

    // 엔진: 앞바퀴(0,1)
    const engineForce = forward * accelerateForce - back * accelerateForce;
    ctrl.setWheelEngineForce(0, engineForce);
    ctrl.setWheelEngineForce(1, engineForce);

    // 브레이크: 모든 바퀴
    const wheelBrake = brakeKey * brakeForce;
    for (let i = 0; i < 4; i++) ctrl.setWheelBrake(i, wheelBrake);

    // 조향: 앞바퀴만
    const currentSteering = ctrl.wheelSteering(0) || 0;
    const steerDir = left - right;
    const steering = THREE.MathUtils.lerp(currentSteering, steerAngle * steerDir, 0.5);
    ctrl.setWheelSteering(0, steering);
    ctrl.setWheelSteering(1, steering);

    // --- Ground check ---
    let isGrounded = false;
    if (chassisBodyRef.current && world && rapier) {
      const t = chassisBodyRef.current.translation();
      const ray = new rapier.Ray({ x: t.x, y: t.y, z: t.z }, { x: 0, y: -1, z: 0 });
      const hit = world.castRay(ray, paramsRef.current.groundRayDist, true);
      isGrounded = !!hit;
      ground.current = hit ? hit.collider : null;
    }

    // --- Air control ---
    if (paramsRef.current.enableAir && !isGrounded && chassisBodyRef.current) {
      const pitchIn = forward - back;
      const yawIn   = left - right;
      const rollIn  = 0;

      _cameraTarget.set(
        paramsRef.current.airPitch * pitchIn,
        paramsRef.current.airYaw   * yawIn,
        paramsRef.current.airRoll  * rollIn
      );
      const q = chassisMeshRef.current.quaternion;
      _cameraTarget.applyQuaternion(q);

      const av = chassisBodyRef.current.angvel();
      _cameraPosition.set(av.x, av.y, av.z);
      _cameraPosition.addScaledVector(_cameraTarget, delta);
      _cameraPosition.multiplyScalar(1.0 - paramsRef.current.airDamping);

      const maxW = paramsRef.current.airMaxAngVel;
      if (_cameraPosition.length() > maxW) _cameraPosition.setLength(maxW);
      chassisBodyRef.current.setAngvel({ x: _cameraPosition.x, y: _cameraPosition.y, z: _cameraPosition.z }, true);
    }

    // --- Upright spring (soft roll/pitch stabilization) ---
    if (paramsRef.current.uprightEnabled && chassisBodyRef.current) {
      // current up vector in world space (reuse temp vectors)
      const q = chassisMeshRef.current.quaternion;
      _tmpUpWorld.set(0, 1, 0).applyQuaternion(q);
      // torque axis to reduce tilt: cross(currentUp, worldUp)
      _tmpAxis.crossVectors(_tmpUpWorld, _tmpYawAxis.set(0, 1, 0));

      const kp = paramsRef.current.uprightStrength; // proportional gain
      const kd = paramsRef.current.uprightDamping;  // derivative gain

      // derivative term ~ angular velocity (only roll/pitch components)
      const av = chassisBodyRef.current.angvel();
      _tmpAv.set(av.x, av.y, av.z);
      _tmpAvYaw.copy(_tmpYawAxis).multiplyScalar(_tmpAv.dot(_tmpYawAxis));
      _tmpAv.sub(_tmpAvYaw); // remove yaw component

      // torque = kp * axis - kd * av_no_yaw
      _tmpAxis.multiplyScalar(kp).add(_tmpAv.multiplyScalar(-kd));

      // clamp & apply as impulse (frame-rate independent)
      const maxT = paramsRef.current.uprightMaxTorque;
      if (_tmpAxis.length() > maxT) _tmpAxis.setLength(maxT);
      _tmpAxis.multiplyScalar(delta);
      chassisBodyRef.current.applyTorqueImpulse({ x: _tmpAxis.x, y: _tmpAxis.y, z: _tmpAxis.z }, true);
    }

    // --- Follow camera ---
    const t = 1.0 - Math.pow(0.01, delta);
    const DIST = Math.abs(paramsRef.current.cameraDist);
    const HEIGHT = paramsRef.current.cameraHeight;

    const bodyPos = chassisMeshRef.current.getWorldPosition(_bodyPosition);

    // Select local forward axis
    let fLocal = _forwardLocalNegX;
    if (paramsRef.current.forwardAxis === "posX") fLocal = _forwardLocalPosX;
    else if (paramsRef.current.forwardAxis === "negZ") fLocal = _forwardLocalNegZ;

    _forwardDir.copy(fLocal).applyQuaternion(chassisMeshRef.current.quaternion).normalize();

    const desiredCamPos = _cameraPosition.copy(bodyPos).addScaledVector(_forwardDir, -DIST);
    desiredCamPos.y = Math.max(desiredCamPos.y + HEIGHT, (chassisBodyRef.current?.translation().y ?? 0) + 1.0);

    if (paramsRef.current.enableShake && shakeRef.current > 0) {
      shakeRef.current = Math.max(0, shakeRef.current - paramsRef.current.shakeDecay * delta);
      _rand.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      _shakeOffset.copy(_rand).multiplyScalar(paramsRef.current.shakeAmp * shakeRef.current);
      desiredCamPos.add(_shakeOffset);
    }

    smoothedCameraPosition.lerp(desiredCamPos, t);
    state.camera.position.copy(smoothedCameraPosition);

    const desiredTarget = _cameraTarget.copy(bodyPos).add(cameraTargetOffset);
    smoothedCameraTarget.lerp(desiredTarget, t);
    state.camera.lookAt(smoothedCameraTarget);

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
      onCollisionEnter={() => {
        if (paramsRef.current.enableShake) shakeRef.current = Math.min(shakeRef.current + 0.6, 1);
      }}
    >
     
      <CuboidCollider args={[1, 0.2, 0.4]} rotation={[0, 0, 0]} />

      {/* 차체 (바디 모델 사용, 없으면 기본 박스) */}
      <group ref={chassisMeshRef}>
        {bodyGltf ? (
          <group
            position={[
              0 + (0) + (0 + (params.bodyOffX || 0)), // BODY_MODEL_OFFSET.x + bodyOffX
              -0.1 + (params.bodyOffY || 0),
              0 + (params.bodyOffZ || 0),
            ]}
            rotation={new THREE.Euler(
              THREE.MathUtils.degToRad(params.bodyTiltPitch || 0),
              THREE.MathUtils.degToRad(params.bodyTiltYaw || 0),
              THREE.MathUtils.degToRad(params.bodyTiltRoll || 0)
            )}
            scale={0.7 * (params.bodyScaleMul || 1.0)} // BODY_MODEL_SCALE * bodyScaleMul
          >
            <primitive object={bodyGltf.scene} />
          </group>
        ) : (
          <group
            rotation={new THREE.Euler(
              THREE.MathUtils.degToRad(params.bodyTiltPitch || 0),
              THREE.MathUtils.degToRad(params.bodyTiltYaw || 0),
              THREE.MathUtils.degToRad(params.bodyTiltRoll || 0)
            )}
          >
            <mesh>
              <boxGeometry args={[1.6, 0.4, 0.8]} />
              <meshStandardMaterial color="#7cc5ff" />
            </mesh>
          </group>
        )}
      </group>

      {/* 바퀴 (휠 모델 사용, 없으면 실린더) */}
      {wheelGltf
        ? wheels.map((wheel, index) => (
            <group
              key={index}
              ref={(ref) => (wheelsRef.current[index] = ref)}
              position={wheel.position}
            >
              <group
                position={[
                  (params.wheelOffX || 0),
                  (params.wheelOffY || 0),
                  (params.wheelOffZ || 0),
                ]}
                scale={(() => {
                  const d = wheelBounds?.diameter || 1;
                  const targetDiameter = (params.radius || 0.15) * 2;
                  const auto = targetDiameter / d;
                  return auto * (params.wheelScaleMul || 1.0);
                })()}
                rotation={new THREE.Euler(
                  THREE.MathUtils.degToRad(params.wheelRotX || 0),
                  THREE.MathUtils.degToRad(
                    (params.wheelRotY || 0)
                    + ((wheel.position.z < 0 && params.wheelFlipLeft) ? 180 : 0)
                    + ((wheel.position.z >= 0 && params.wheelFlipRight) ? 180 : 0)
                  ),
                  THREE.MathUtils.degToRad(params.wheelRotZ || 0)
                )}
              >
                <group position={wheelBounds ? [-wheelBounds.center.x, -wheelBounds.center.y, -wheelBounds.center.z] : [0,0,0]}>
                  <Clone object={wheelGltf.scene} />
                </group>
              </group>
            </group>
          ))
        : wheels.map((wheel, index) => (
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