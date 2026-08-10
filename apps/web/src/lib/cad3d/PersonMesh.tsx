"use client";

import { Suspense, useLayoutEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  personPalette,
  type PersonOutfitId,
  type PersonSex,
} from "@pool-design/shared";

const MALE_GLB = "/models/people/realistic-male.glb";
const FEMALE_GLB = "/models/people/realistic-female.glb";

type PersonMeshProps = {
  heightM: number;
  sex: PersonSex;
  outfitId: PersonOutfitId;
  selected: boolean;
  groupProps: Record<string, unknown>;
};

function meshRole(mesh: THREE.Mesh): string {
  return `${mesh.name} ${
    Array.isArray(mesh.material)
      ? mesh.material.map((m) => m?.name ?? "").join(" ")
      : (mesh.material?.name ?? "")
  }`.toLowerCase();
}

function deg(x: number, y: number, z: number): THREE.Euler {
  return new THREE.Euler(
    THREE.MathUtils.degToRad(x),
    THREE.MathUtils.degToRad(y),
    THREE.MathUtils.degToRad(z),
  );
}

/**
 * These GLBs ship in T-pose with no clips. Drop arms to a relaxed stand
 * so scale figures don't look mid-rig.
 */
function applyStandingPose(root: THREE.Object3D) {
  const bones = new Map<string, THREE.Object3D>();
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone || /Arm|Shoulder|Hand|ForeArm/i.test(o.name)) {
      bones.set(o.name, o);
    }
  });

  const set = (name: string, e: THREE.Euler) => {
    const b = bones.get(name);
    if (!b) return;
    b.rotation.copy(e);
  };

  // RPM bind is T-pose (arms along ±X). Negative LeftArm.z drops the arm.
  set("LeftShoulder", deg(0, 0, -6));
  set("RightShoulder", deg(0, 0, 6));
  set("LeftArm", deg(0, 0, -72));
  set("RightArm", deg(0, 0, 72));
  set("LeftForeArm", deg(0, 0, -14));
  set("RightForeArm", deg(0, 0, 14));
  set("LeftHand", deg(0, 0, -4));
  set("RightHand", deg(0, 0, 4));

  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    mesh.skeleton.update();
    mesh.computeBoundingSphere();
  });
}

function clearClothingMaps(mat: THREE.MeshStandardMaterial) {
  mat.map = null;
  mat.normalMap = null;
  mat.roughnessMap = null;
  mat.metalnessMap = null;
  mat.aoMap = null;
  mat.emissiveMap = null;
}

function applyPersonAppearance(
  root: THREE.Object3D,
  sex: PersonSex,
  outfitId: PersonOutfitId,
  selected: boolean,
) {
  const palette = personPalette(sex, outfitId);
  const bareChest = outfitId === "swimsuit" && sex === "male";
  const bareFeet = outfitId === "swimsuit";

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;

    const role = meshRole(mesh);
    const isTop = /outfit_top/.test(role);
    const isBottom = /outfit_bottom/.test(role);
    const isFootwear = /outfit_footwear|footwear/.test(role);
    const isGlasses = /glasses/.test(role);
    const isHair = /hair/.test(role);
    const isBody = /wolf3d_body|\bbody\b/.test(role) && !/outfit/.test(role);
    const isSkin =
      /wolf3d_skin|\bhead\b/.test(role) && !/outfit|hair|eye|teeth/.test(role);

    if (isGlasses) {
      mesh.visible = false;
      return;
    }

    mesh.visible = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;

    const mats = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const mat of mats) {
      if (!mat || !(mat instanceof THREE.MeshStandardMaterial)) continue;
      mat.transparent = false;
      mat.opacity = 1;
      mat.depthWrite = true;
      mat.side = THREE.FrontSide;
      mat.metalness = Math.min(mat.metalness ?? 0, 0.15);
      mat.roughness = Math.max(mat.roughness ?? 0.7, 0.55);

      if (isTop && bareChest) {
        // Outfit_Top *is* the torso mesh — don't hide it or the chest vanishes.
        // Paint it as skin so swimwear reads as a bare upper body.
        clearClothingMaps(mat);
        mat.color.set(palette.skin);
        mat.roughness = 0.62;
      } else if (isTop) {
        mat.color.set(palette.top);
      } else if (isBottom) {
        mat.color.set(palette.bottom);
      } else if (isFootwear) {
        if (bareFeet) {
          clearClothingMaps(mat);
          mat.color.set(palette.skin);
          mat.roughness = 0.62;
        } else {
          mat.color.set(palette.shoes);
        }
      } else if ((isHair || isBody || isSkin) && !mat.map) {
        mat.color.set(isHair ? palette.hair : palette.skin);
      }

      if (selected) {
        mat.emissive = new THREE.Color("#1f8a70");
        mat.emissiveIntensity = 0.12;
      } else {
        mat.emissive = new THREE.Color("#000000");
        mat.emissiveIntensity = 0;
      }
      mat.needsUpdate = true;
    }
  });
}

function PersonFromGltf({
  url,
  heightM,
  sex,
  outfitId,
  selected,
  groupProps,
}: PersonMeshProps & { url: string }) {
  // Draco + meshopt: these RPM GLBs use EXT_meshopt_compression + webp.
  const { scene } = useGLTF(url, true, true);

  const clone = useMemo(() => {
    const c = cloneSkinned(scene);
    c.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((m) => m.clone());
      } else if (mesh.material) {
        mesh.material = mesh.material.clone();
      }
    });
    applyStandingPose(c);
    c.updateMatrixWorld(true);
    return c;
  }, [scene]);

  const { nativeHeight, footLift } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clone);
    return {
      nativeHeight: Math.max(box.max.y - box.min.y, 0.5),
      footLift: -box.min.y,
    };
  }, [clone]);

  useLayoutEffect(() => {
    applyPersonAppearance(clone, sex, outfitId, selected);
  }, [clone, sex, outfitId, selected]);

  const s = heightM / nativeHeight;

  return (
    <group {...groupProps}>
      <group position={[0, -heightM / 2, 0]} scale={[s, s, s]}>
        <group position={[0, footLift, 0]}>
          <primitive object={clone} />
        </group>
      </group>
    </group>
  );
}

/** Standing adult avatars (male/female) with outfit-tinted clothing. */
export function PersonMesh(props: PersonMeshProps) {
  const url = props.sex === "male" ? MALE_GLB : FEMALE_GLB;
  return (
    <Suspense fallback={null}>
      <PersonFromGltf
        key={`${props.sex}-${props.outfitId}`}
        url={url}
        {...props}
      />
    </Suspense>
  );
}

useGLTF.preload(MALE_GLB, true, true);
useGLTF.preload(FEMALE_GLB, true, true);
