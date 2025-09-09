import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useAfterPhysicsStep, useRapier } from "@react-three/rapier";

const up = new THREE.Vector3(0, 1, 0);
const _wheelSteeringQuat = new THREE.Quaternion();
const _wheelRotationQuat = new THREE.Quaternion();

export const useVehicleController = (chassisRef, wheelsRef, wheelsInfo) => {
  const { world } = useRapier();
  const vehicleController = useRef(null);

  useEffect(() => {
    const chassis = chassisRef.current;
    const wheels = wheelsRef.current;
    if (!chassis || !wheels) return;

    const vehicle = world.createVehicleController(chassis);
    const suspensionDirection = new THREE.Vector3(0, -1, 0);

    // 바퀴 등록
    wheelsInfo.forEach((wheel) => {
      vehicle.addWheel(
        wheel.position,
        suspensionDirection,
        wheel.axleCs,
        wheel.suspensionRestLength,
        wheel.radius
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

  // 물리 스텝 이후 바퀴 시각 상태 동기화
  useAfterPhysicsStep((rapierWorld) => {
    const controller = vehicleController.current;
    if (!controller) return;

    controller.updateVehicle(rapierWorld.timestep);

    const wheels = wheelsRef.current;
    if (!wheels || !Array.isArray(wheels)) return;

    wheels.forEach((wheel, index) => {
      if (!wheel) return;

      const axle = controller.wheelAxleCs(index);
      const connection = controller.wheelChassisConnectionPointCs(index)?.y ?? 0;
      const suspension = controller.wheelSuspensionLength(index) ?? 0;
      const steering = controller.wheelSteering(index) ?? 0;
      const rotationRad = controller.wheelRotation(index) ?? 0;

      // 서스펜션 압축량 → y 위치
      wheel.position.y = connection - suspension;

      // 조향(Y축) + 회전(바퀴축) 적용
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