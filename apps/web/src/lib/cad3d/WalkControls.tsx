"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import * as THREE from "three";
import {
  WALK_EYE_HEIGHT_M,
  walkBounds,
  type WalkSpawnPose,
} from "@/lib/cad3d/walkMode";

const WALK_SPEED = 2.6;
const SPRINT_SPEED = 5.2;
const ORBIT_FOV = 45;
const WALK_FOV = 70;

type LockControls = {
  isLocked: boolean;
};

type Props = {
  spawn: WalkSpawnPose;
  /** Bumps when the user re-enters Walk / clicks Respawn. */
  spawnToken: number;
  center: { x: number; z: number };
  groundSize: number;
  onLockChange?: (locked: boolean) => void;
};

/**
 * First-person walkthrough: click to lock mouse, WASD move, Shift sprint, Esc unlock.
 * Camera stays at standing eye height and slides on the ground plane.
 */
export function WalkControls({
  spawn,
  spawnToken,
  center,
  groundSize,
  onLockChange,
}: Props) {
  const { camera } = useThree();
  const controlsRef = useRef<LockControls | null>(null);
  const keys = useRef({
    forward: false,
    back: false,
    left: false,
    right: false,
    sprint: false,
  });
  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const wish = useRef(new THREE.Vector3());
  const bounds = walkBounds(center, groundSize);

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.set(...spawn.position);
    cam.lookAt(spawn.lookAt[0], spawn.lookAt[1], spawn.lookAt[2]);
    cam.fov = WALK_FOV;
    cam.near = 0.05;
    cam.updateProjectionMatrix();
    return () => {
      cam.fov = ORBIT_FOV;
      cam.near = 0.1;
      cam.updateProjectionMatrix();
    };
  }, [camera, spawn, spawnToken]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const k = e.code;
      if (
        k === "KeyW" ||
        k === "KeyA" ||
        k === "KeyS" ||
        k === "KeyD" ||
        k === "ArrowUp" ||
        k === "ArrowDown" ||
        k === "ArrowLeft" ||
        k === "ArrowRight" ||
        k === "ShiftLeft" ||
        k === "ShiftRight"
      ) {
        e.preventDefault();
      }
      if (k === "KeyW" || k === "ArrowUp") keys.current.forward = down;
      if (k === "KeyS" || k === "ArrowDown") keys.current.back = down;
      if (k === "KeyA" || k === "ArrowLeft") keys.current.left = down;
      if (k === "KeyD" || k === "ArrowRight") keys.current.right = down;
      if (k === "ShiftLeft" || k === "ShiftRight") keys.current.sprint = down;
    };
    const down = (e: KeyboardEvent) => onKey(e, true);
    const up = (e: KeyboardEvent) => onKey(e, false);
    const clear = () => {
      keys.current.forward = false;
      keys.current.back = false;
      keys.current.left = false;
      keys.current.right = false;
      keys.current.sprint = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      clear();
    };
  }, []);

  useFrame((_, dt) => {
    const ctrl = controlsRef.current;
    if (!ctrl?.isLocked) return;
    const t = Math.min(dt, 0.05);
    const k = keys.current;
    wish.current.set(0, 0, 0);

    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    if (forward.current.lengthSq() < 1e-6) {
      forward.current.set(0, 0, -1);
    } else {
      forward.current.normalize();
    }
    right.current
      .crossVectors(forward.current, THREE.Object3D.DEFAULT_UP)
      .normalize();

    if (k.forward) wish.current.add(forward.current);
    if (k.back) wish.current.sub(forward.current);
    if (k.right) wish.current.add(right.current);
    if (k.left) wish.current.sub(right.current);

    if (wish.current.lengthSq() > 1e-6) {
      wish.current.normalize();
      const speed = (k.sprint ? SPRINT_SPEED : WALK_SPEED) * t;
      camera.position.addScaledVector(wish.current, speed);
    }

    camera.position.y = WALK_EYE_HEIGHT_M;
    camera.position.x = THREE.MathUtils.clamp(
      camera.position.x,
      bounds.minX,
      bounds.maxX,
    );
    camera.position.z = THREE.MathUtils.clamp(
      camera.position.z,
      bounds.minZ,
      bounds.maxZ,
    );
  });

  return (
    <PointerLockControls
      ref={controlsRef as never}
      selector="canvas"
      makeDefault
      onLock={() => onLockChange?.(true)}
      onUnlock={() => onLockChange?.(false)}
    />
  );
}
