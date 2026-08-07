"use client";

import { createContext } from "react";
import * as THREE from "three";

export const ClipPlanesContext = createContext<THREE.Plane[]>([]);
