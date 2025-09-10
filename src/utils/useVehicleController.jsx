// src/utils/useVehicleController.jsx
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useAfterPhysicsStep, useRapier } from "@react-three/rapier";

const up = new THREE.Vector3(0, 1, 0);
const _wheelSteeringQuat = new THREE.Quaternion();
const _wheelRotationQuat = new THREE.Quaternion();

// Idle damping & auto-stop (부드럽게)
const LINEAR_DAMPING_DEFAULT = 0.25; // 낮을수록 관성 유지, 출렁임↑
const ANGULAR_DAMPING_DEFAULT = 0.6;  // 낮을수록 차체 롤/피치 허용
const SPEED_EPS = 0.02;               // 정말 멈춘 수준에서만 0으로 스냅
const ANG_EPS = 0.02;

/**
 * chassisRef: RigidBody ref
 * wheelsRef:  [Group, Group, Group, Group] ref
 * wheelsInfo: [{ position, axleCs, suspensionRestLength, suspensionStiffness, maxSuspensionTravel, radius, width }, ...]
 */
export const useVehicleController = (chassisRef, wheelsRef, wheelsInfo) => {
  const { world } = useRapier();
  const vehicleController = useRef(null);

  useEffect(() => {
    const chassis = chassisRef.current;
    const wheels = wheelsRef.current;
    if (!chassis || !wheels) return;

    const vehicle = world.createVehicleController(chassis);

    // 기본 감쇠 (관성으로 계속 미끄러지지 않게 + 너무 딱딱하지 않게)
    try {
      chassis.setLinearDamping?.(LINEAR_DAMPING_DEFAULT);
      chassis.setAngularDamping?.(ANGULAR_DAMPING_DEFAULT);
    } catch {}

    const suspensionDirection = new THREE.Vector3(0, -1, 0);

    // 휠 추가
    wheelsInfo.forEach((wheel) => {
      vehicle.addWheel(
        wheel.position,              // 섀시 로컬에서의 연결점 (x,y,z)
        suspensionDirection,         // 서스펜션 방향 (로컬 -Y)
        wheel.axleCs,                // 바퀴 회전축 (로컬)
        wheel.suspensionRestLength,  // 무부하 길이
        wheel.radius                 // 바퀴 반지름(물리)
      );
    });

    // 서스펜션 파라미터
    wheelsInfo.forEach((wheel, index) => {
      vehicle.setWheelSuspensionStiffness(index, wheel.suspensionStiffness);
      vehicle.setWheelMaxSuspensionTravel(index, wheel.maxSuspensionTravel);
    });

    vehicleController.current = vehicle;

    return () => {
      vehicleController.current = null;
      world.removeVehicleController(vehicle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 물리 스텝 이후: 시각 휠 업데이트
  useAfterPhysicsStep((rapierWorld) => {
    const controller = vehicleController.current;
    if (!controller) return;

    // 아주 느린 속도 자동 정지(떠다니는 거 방지)
    const body = chassisRef.current;
    if (body) {
      const lv = body.linvel?.();
      const av = body.angvel?.();
      if (lv && av) {
        const speed = Math.hypot(lv.x, lv.y, lv.z);
        const aspeed = Math.hypot(av.x, av.y, av.z);
        if (speed < SPEED_EPS) body.setLinvel?.({ x: 0, y: 0, z: 0 }, true);
        if (aspeed < ANG_EPS) body.setAngvel?.({ x: 0, y: 0, z: 0 }, true);
      }
    }

    controller.updateVehicle(rapierWorld.timestep);

    const wheels = wheelsRef.current;
    if (!wheels || !Array.isArray(wheels)) return;

    wheels.forEach((wheel, index) => {
      if (!wheel) return;

      // 섀시 기준의 연결점 전체(x,y,z)를 사용해 자연스러운 위치 갱신
      const axle = controller.wheelAxleCs(index);
      const conn = controller.wheelChassisConnectionPointCs(index) || { x: 0, y: 0, z: 0 };
      const suspension = controller.wheelSuspensionLength(index) ?? 0;
      const steering = controller.wheelSteering(index) ?? 0;
      const rotationRad = controller.wheelRotation(index) ?? 0;

      // 수직 변위(서스펜션): 연결점에서 로컬 -Y 방향으로 suspension 만큼 내려감
      wheel.position.set(conn.x, conn.y - suspension, conn.z);

      // 조향(Y축) + 바퀴축 회전
      _wheelSteeringQuat.setFromAxisAngle(up, steering);
      if (axle) {
        _wheelRotationQuat.setFromAxisAngle(axle, rotationRad);
        wheel.quaternion.multiplyQuaternions(_wheelSteeringQuat, _wheelRotationQuat);
      } else {
        wheel.quaternion.copy(_wheelSteeringQuat);
      }
    });
  });

  return { vehicleController };
};

export default useVehicleController;