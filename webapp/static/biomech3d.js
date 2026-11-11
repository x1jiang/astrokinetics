// ============================================================================
// AstroKinetics v3.2 — Interactive 3D Volumetric Musculoskeletal, Force-Plate
// & 21-Joint Hand Dexterity Renderer (Inspired by Stanford OpenCap, OpenSim & DARI)
// - Pinhole 3D perspective camera with pointer-drag 360° orbit & preset views
// - Dual piezoelectric ARED force plates with 3D Ground Reaction Force (GRF) vectors
// - Z-sorted specular-lit 3D anatomical segments, 8-vertebra spine, ribcage & visor
// - Real-time inverse-kinematic muscle activation (%MVC) thermal heatmap spindles
// - 3D spatial joint goniometer rings, 3D trajectory ribbons & always-live 3D 21-pt hand
// ============================================================================

const HAND21_BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],       // Index
  [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
  [0, 13], [13, 14], [14, 15], [15, 16],// Ring
  [0, 17], [17, 18], [18, 19], [19, 20],// Pinky
  [5, 9], [9, 13], [13, 17],            // Metacarpal arch
];

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function vecSub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function vecAdd(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function vecScale(a, s) {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

function vecLerp(a, b, t) {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
}

function vecLen(v) {
  return Math.hypot(v.x, v.y, v.z) || 1e-6;
}

function vecNorm(v) {
  const l = vecLen(v);
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

function vecCross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

/**
 * Maps muscle activation [0..1] (%MVC) to an OpenCap / OpenSim thermal color palette:
 * 0.00 -> Cool Sapphire (#0ea5e9)
 * 0.35 -> Nominal Emerald (#10b981)
 * 0.68 -> High-Load Amber (#f59e0b)
 * 1.00 -> Asymmetric Overload Crimson (#f43f5e)
 */
export function activationToRgb(act01) {
  const t = clamp(act01, 0, 1);
  const stops = [
    { p: 0.0, r: 14, g: 165, b: 233 },
    { p: 0.36, r: 16, g: 185, b: 129 },
    { p: 0.68, r: 245, g: 158, b: 11 },
    { p: 1.0, r: 244, g: 63, b: 94 },
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (t >= a.p && t <= b.p) {
      const u = (t - a.p) / (b.p - a.p);
      return {
        r: Math.round(lerp(a.r, b.r, u)),
        g: Math.round(lerp(a.g, b.g, u)),
        b: Math.round(lerp(a.b, b.b, u)),
      };
    }
  }
  return { r: 244, g: 63, b: 94 };
}

function rgbCss(c, alpha = 1) {
  return alpha >= 0.999 ? `rgb(${c.r}, ${c.g}, ${c.b})` : `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha.toFixed(3)})`;
}

function shadeRgb(c, factor, boost = 0) {
  return {
    r: clamp(Math.round(c.r * factor + boost), 0, 255),
    g: clamp(Math.round(c.g * factor + boost), 0, 255),
    b: clamp(Math.round(c.b * factor + boost), 0, 255),
  };
}

export class Biomech3DStage {
  constructor() {
    this.yaw = -0.44;
    this.pitch = 0.2;
    this.targetYaw = -0.44;
    this.targetPitch = 0.2;
    this.zoom = 1.0;
    this.targetZoom = 1.0;
    this.autoOrbit = false;
    this.showMuscleHeatmap = true;
    this.showBaselineGhost = true;
    this.cameraPreset = "iso";

    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragStartYaw = 0;
    this.dragStartPitch = 0;

    this.wristTrail3D = [];
    this.kneeTrail3D = [];
    this.copTrail2D = [];
    this.lastTrailMs = 0;
  }

  attachControls(canvas) {
    if (!canvas || canvas.dataset.orbitBound === "true") return;
    canvas.dataset.orbitBound = "true";

    canvas.addEventListener("pointerdown", (e) => {
      this.isDragging = true;
      this.autoOrbit = false;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.dragStartYaw = this.targetYaw;
      this.dragStartPitch = this.targetPitch;
      canvas.setPointerCapture?.(e.pointerId);
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      this.targetYaw = this.dragStartYaw + dx * 0.0095;
      this.targetPitch = clamp(this.dragStartPitch + dy * 0.007, -0.22, 0.78);
    });

    const endDrag = (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      canvas.releasePointerCapture?.(e.pointerId);
    };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);

    canvas.addEventListener("dblclick", () => {
      this.setPreset("iso");
    });
  }

  setPreset(preset) {
    this.cameraPreset = preset;
    this.targetZoom = 1.0;
    if (preset === "front") {
      this.autoOrbit = false;
      this.targetYaw = 0.0;
      this.targetPitch = 0.14;
    } else if (preset === "side") {
      this.autoOrbit = false;
      this.targetYaw = -Math.PI / 2 + 0.08;
      this.targetPitch = 0.14;
    } else if (preset === "orbit") {
      this.autoOrbit = !this.autoOrbit;
    } else {
      this.autoOrbit = false;
      this.targetYaw = -0.44;
      this.targetPitch = 0.2;
    }
  }

  setScenarioCamera(scenarioId) {
    this.autoOrbit = false;
    if (scenarioId === "nominal_lunar") {
      this.cameraPreset = "iso";
      this.targetYaw = -0.46;
      this.targetPitch = 0.21;
      this.targetZoom = 1.0;
    } else if (scenarioId === "hypercapnia_drift") {
      this.cameraPreset = "front";
      this.targetYaw = -0.08;
      this.targetPitch = 0.28;
      this.targetZoom = 0.98;
    } else if (scenarioId === "spe_blackout") {
      this.cameraPreset = "custom";
      this.targetYaw = 0.34;
      this.targetPitch = 0.16;
      this.targetZoom = 1.1;
    } else {
      this.cameraPreset = "iso";
      this.targetYaw = -0.28;
      this.targetPitch = 0.19;
      this.targetZoom = 1.02;
    }
  }

  resetTrails() {
    this.wristTrail3D = [];
    this.kneeTrail3D = [];
    this.copTrail2D = [];
  }

  stepCamera(dtSec, reducedMotion = false) {
    if (this.autoOrbit && !this.isDragging && !reducedMotion) {
      this.targetYaw += dtSec * 0.38;
    }
    this.yaw = lerp(this.yaw, this.targetYaw, 0.16);
    this.pitch = lerp(this.pitch, this.targetPitch, 0.16);
    this.zoom = lerp(this.zoom, this.targetZoom, 0.16);
  }

  /**
   * Projects a 3D world point in meters (X right, Y up from floor=0, Z toward viewer)
   * into 2D logical canvas pixels + camera-space depth zCam.
   */
  project(pt, W, H) {
    // Center camera look-at at pelvis/mid-torso height y = 0.88m, shifted slightly left of hand inset
    const cxScreen = W * 0.37;
    const cyScreen = H * 0.445;
    const px = pt.x;
    const py = pt.y - 0.88;
    const pz = pt.z;

    const cosY = Math.cos(this.yaw);
    const sinY = Math.sin(this.yaw);
    const x1 = px * cosY + pz * sinY;
    const z1 = -px * sinY + pz * cosY;

    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);
    const y2 = py * cosP - z1 * sinP;
    const z2 = py * sinP + z1 * cosP;

    const camDist = 3.15;
    const focal = 545 * this.zoom;
    const depth = Math.max(0.65, camDist - z2);
    const scale = focal / depth;

    return {
      x: cxScreen + x1 * scale,
      y: cyScreen - y2 * scale,
      zCam: z2,
      scale,
    };
  }

  /**
   * Builds a complete 23-joint 3D anatomical humanoid pose + muscle activations (%MVC)
   * + dual force-plate GRF loads from active protocol, telemetry, and optional 62f empirical stream.
   */
  solveMusculoskeletalPose({
    protocol,
    telemetry,
    empKin = null,
    body18 = null,
    nowMs = 0,
    paused = false,
  }) {
    const tSec = paused ? 1.15 : nowMs / 1000;
    const cadenceHz = Math.max(0.14, (telemetry.cadence_rpm || 14) / 60);
    const cyc = 0.5 - 0.5 * Math.cos(2 * Math.PI * cadenceHz * tSec); // Smooth 0..1..0 cycle

    const symRatio = clamp((telemetry.bilateral_symmetry_pct || 85) / 100, 0.45, 1.0);
    const leanDeg = clamp(telemetry.trunk_lean_deg || 4, 0, 35);
    const leanRad = (leanDeg * Math.PI) / 180;
    const swayAmpM = clamp((telemetry.postural_sway_mms || 6) * 0.0014, 0.003, 0.055);
    const swayX = Math.sin(tSec * 2.1) * swayAmpM + Math.sin(leanRad) * 0.09;
    const swayZ = Math.cos(tSec * 1.65) * swayAmpM * 0.75;

    // Determine exercise-specific joint kinematics
    let squatDepth = 0;
    let rKneeFlexDeg = 14;
    let lKneeFlexDeg = 14;
    let rShoElevDeg = 22;
    let lShoElevDeg = 20;
    let rElbFlexDeg = 32;
    let lElbFlexDeg = 28;

    if (protocol === "ared_squat") {
      // In Recorded 62f Mocap mode (empKin present), drive joint trajectory directly from the recorded clip;
      // in Parametric Digital Twin mode (empKin null), drive from continuous biomechanical cadence + sliders.
      let phase;
      if (empKin) {
        const empWave = clamp(
          (empKin.rShoulderElev - 20) / 30 + (empKin.rElbowFlex - 35) / 150,
          0.06,
          0.98
        );
        phase = empWave;
      } else {
        phase = clamp(cyc * 0.96, 0.04, 1.0);
      }
      const targetPeak = clamp(telemetry.joint_rom_deg || 94, 35, 138);
      rKneeFlexDeg = 12 + (targetPeak - 12) * phase;
      lKneeFlexDeg = 12 + (targetPeak * symRatio - 12) * phase;
      squatDepth = ((rKneeFlexDeg + lKneeFlexDeg) * 0.5 - 12) / 120; // 0..1
      rShoElevDeg = empKin ? clamp(28 + empKin.rShoulderElev * 0.65, 28, 72) : 38 + squatDepth * 14;
      lShoElevDeg = empKin ? clamp(26 + empKin.lShoulderElev * 0.62 * symRatio, 24, 68) : 36 + squatDepth * 12 * symRatio;
      rElbFlexDeg = empKin ? clamp(74 + empKin.rElbowFlex * 0.34, 70, 122) : 98 + squatDepth * 10;
      lElbFlexDeg = empKin ? clamp(72 + empKin.lElbowFlex * 0.32, 68, 118) : 96 + squatDepth * 10;
    } else if (protocol === "eva_upper_reach") {
      if (empKin && body18 && body18.length >= 14) {
        const scaleRom = clamp((telemetry.joint_rom_deg || 145) / 118, 0.65, 1.45);
        rShoElevDeg = clamp(empKin.rShoulderElev * 1.75 * scaleRom, 16, 168);
        lShoElevDeg = clamp((empKin.lShoulderElev * 1.35 + 18) * symRatio, 14, 155);
        rElbFlexDeg = clamp(empKin.rElbowFlex, 18, 148);
        lElbFlexDeg = clamp(empKin.lElbowFlex * 0.85 + 20, 18, 140);
      } else {
        const peak = clamp(telemetry.joint_rom_deg || 148, 45, 172);
        rShoElevDeg = 20 + (peak - 20) * cyc;
        lShoElevDeg = 20 + (peak * symRatio - 20) * cyc;
        rElbFlexDeg = 28 + 46 * Math.sin(cyc * Math.PI);
        lElbFlexDeg = 28 + 42 * Math.sin(cyc * Math.PI);
      }
      rKneeFlexDeg = 14 + 5 * cyc;
      lKneeFlexDeg = 14 + 5 * cyc * symRatio;
      squatDepth = 0.04 * cyc;
    } else if (protocol === "fine_motor_hand") {
      rShoElevDeg = empKin ? clamp(empKin.rShoulderElev * 1.15, 24, 78) : 44 + 8 * cyc;
      lShoElevDeg = 24 + 5 * cyc;
      rElbFlexDeg = empKin ? clamp(empKin.rElbowFlex, 55, 118) : 86 + 10 * Math.sin(tSec * 2.4);
      lElbFlexDeg = 42;
      rKneeFlexDeg = 12;
      lKneeFlexDeg = 12;
    } else {
      // vestibular_sway (Romberg balance)
      rShoElevDeg = 26 + Math.sin(tSec * 2.3) * 8;
      lShoElevDeg = 26 - Math.sin(tSec * 2.3) * 8;
      rElbFlexDeg = 38;
      lElbFlexDeg = 38;
      rKneeFlexDeg = 15 + Math.max(0, swayX * 120);
      lKneeFlexDeg = 15 + Math.max(0, -swayX * 120);
    }

    // Solve 3D Metric Joint Positions (Y=0 is Force-Plate Deck; astronaut stature ~1.76m)
    const stanceHalfW = 0.19;
    // Viewer faces astronaut frontally: anatomical Right is at -X, anatomical Left is at +X
    const rAnkle = { x: -stanceHalfW, y: 0.07, z: 0.0 };
    const lAnkle = { x: stanceHalfW, y: 0.07, z: 0.0 };
    const rToe = { x: -stanceHalfW - 0.02, y: 0.02, z: 0.16 };
    const lToe = { x: stanceHalfW + 0.02, y: 0.02, z: 0.16 };
    const rHeel = { x: -stanceHalfW, y: 0.02, z: -0.06 };
    const lHeel = { x: stanceHalfW, y: 0.02, z: -0.06 };

    const shankLen = 0.43;
    const thighLen = 0.44;
    const rKRad = (rKneeFlexDeg * Math.PI) / 180;
    const lKRad = (lKneeFlexDeg * Math.PI) / 180;

    // Knee moves forward (+Z) and slightly outward during flexion
    const rShinPitch = rKRad * 0.46;
    const lShinPitch = lKRad * 0.46;
    const rKnee = {
      x: rAnkle.x - 0.03 * Math.sin(rKRad) + swayX * 0.35,
      y: rAnkle.y + shankLen * Math.cos(rShinPitch),
      z: rAnkle.z + shankLen * Math.sin(rShinPitch) + swayZ * 0.35,
    };
    const lKnee = {
      x: lAnkle.x + 0.03 * Math.sin(lKRad) + swayX * 0.35,
      y: lAnkle.y + shankLen * Math.cos(lShinPitch),
      z: lAnkle.z + shankLen * Math.sin(lShinPitch) + swayZ * 0.35,
    };

    // Hip moves backward (-Z) during squat counter-balance
    const rThighPitch = rKRad - rShinPitch;
    const lThighPitch = lKRad - lShinPitch;
    const pelvisHalfW = 0.145;
    const rHip = {
      x: -pelvisHalfW + swayX + Math.sin(leanRad) * 0.05,
      y: rKnee.y + thighLen * Math.cos(rThighPitch),
      z: rKnee.z - thighLen * Math.sin(rThighPitch) * 0.82 + swayZ,
    };
    const lHip = {
      x: pelvisHalfW + swayX + Math.sin(leanRad) * 0.05,
      y: lKnee.y + thighLen * Math.cos(lThighPitch),
      z: lKnee.z - thighLen * Math.sin(lThighPitch) * 0.82 + swayZ,
    };
    const midPelvis = vecLerp(rHip, lHip, 0.5);

    // Torso forward pitch during squat + lateral coronal lean compensation
    const forwardTorsoRad = squatDepth * 0.36;
    const torsoLen = 0.50;
    const spineDir = vecNorm({
      x: -Math.sin(leanRad), // Leaning toward anatomical right (-X) when trunk_lean_deg > 0
      y: Math.cos(leanRad) * Math.cos(forwardTorsoRad),
      z: Math.sin(forwardTorsoRad),
    });

    // 8 articulated vertebrae from sacrum (midPelvis) to C7 (neckBase)
    const vertebrae = [];
    for (let i = 0; i <= 7; i++) {
      const f = i / 7;
      // Slight physiological S-curve lordosis/kyphosis + lateral scoliotic bend under lean
      const curveZ = Math.sin(f * Math.PI) * -0.025;
      const curveX = Math.sin(f * Math.PI * 0.85) * -Math.sin(leanRad) * 0.03;
      vertebrae.push({
        x: midPelvis.x + spineDir.x * (torsoLen * f) + curveX,
        y: midPelvis.y + spineDir.y * (torsoLen * f),
        z: midPelvis.z + spineDir.z * (torsoLen * f) + curveZ,
      });
    }
    const midThorax = vertebrae[4];
    const neckBase = vertebrae[7];
    const headCenter = vecAdd(neckBase, vecScale(spineDir, 0.19));

    // Shoulder girdle perpendicular to lateral spine tilt
    const shoulderHalfW = 0.215;
    const shoulderDrop = Math.sin(leanRad) * 0.055;
    const rShoulder = {
      x: neckBase.x - shoulderHalfW * Math.cos(leanRad * 0.5),
      y: neckBase.y - 0.04 - shoulderDrop,
      z: neckBase.z - 0.01,
    };
    const lShoulder = {
      x: neckBase.x + shoulderHalfW * Math.cos(leanRad * 0.5),
      y: neckBase.y - 0.04 + shoulderDrop,
      z: neckBase.z - 0.01,
    };

    // Upper & lower arms in 3D
    const upperArmLen = 0.30;
    const forearmLen = 0.27;
    const solveArm = (sho, isRight, elevDeg, elbFlexDeg) => {
      const sgn = isRight ? -1 : 1;
      const elevR = (elevDeg * Math.PI) / 180;
      const elbR = (elbFlexDeg * Math.PI) / 180;

      let uDir;
      if (protocol === "ared_squat") {
        // Arms abducted & elbows flexed holding ARED shoulder harness/bar
        uDir = vecNorm({
          x: sgn * Math.sin(elevR) * 0.82,
          y: -Math.cos(elevR),
          z: 0.25,
        });
      } else if (protocol === "fine_motor_hand" && isRight) {
        uDir = vecNorm({
          x: sgn * 0.32,
          y: -Math.cos(elevR * 0.7),
          z: 0.52,
        });
      } else {
        // EVA reach / abduction-flexion plane (scapular plane ~32 deg forward)
        uDir = vecNorm({
          x: sgn * Math.sin(elevR) * 0.78,
          y: -Math.cos(elevR),
          z: Math.sin(elevR) * 0.48,
        });
      }
      const elbow = vecAdd(sho, vecScale(uDir, upperArmLen));

      let fDir;
      if (protocol === "ared_squat") {
        fDir = vecNorm({
          x: -sgn * 0.22,
          y: Math.sin(elbR * 0.75),
          z: 0.48,
        });
      } else {
        // Flex forearm forward & upward relative to humerus
        fDir = vecNorm({
          x: uDir.x * Math.cos(elbR) - sgn * 0.12 * Math.sin(elbR),
          y: uDir.y * Math.cos(elbR) + Math.sin(elbR) * 0.78,
          z: uDir.z * Math.cos(elbR) + Math.sin(elbR) * 0.62,
        });
      }
      const wrist = vecAdd(elbow, vecScale(fDir, forearmLen));
      const handTip = vecAdd(wrist, vecScale(fDir, 0.095));
      return { elbow, wrist, handTip };
    };

    const rArm = solveArm(rShoulder, true, rShoElevDeg, rElbFlexDeg);
    const lArm = solveArm(lShoulder, false, lShoElevDeg, lElbFlexDeg);

    // Biomechanical Muscle Activation (%MVC, 0..1) & Bilateral Force-Plate GRF Distribution
    // Right leg bears extra compensatory load when bilateral_symmetry_pct < 100 or leaning right
    const asymShift = clamp((1 - symRatio) * 0.65 + Math.sin(leanRad) * 0.35, -0.35, 0.38);
    const rightLoadShare = clamp(0.5 + asymShift * 0.55, 0.25, 0.78);
    const leftLoadShare = 1.0 - rightLoadShare;
    const dynamicAccelFactor = 1.0 + squatDepth * 0.32 * Math.sin(cyc * Math.PI);
    const totalForceN = 760 * dynamicAccelFactor; // ~77.5 kg astronaut under ARED resistive load

    const muscles = {
      quadR: clamp(0.14 + squatDepth * 0.78 * (rightLoadShare / 0.5), 0.1, 0.99),
      quadL: clamp(0.14 + squatDepth * 0.78 * (leftLoadShare / 0.5) * symRatio, 0.1, 0.95),
      gluteR: clamp(0.12 + squatDepth * 0.72 * (rightLoadShare / 0.5), 0.1, 0.96),
      gluteL: clamp(0.12 + squatDepth * 0.72 * (leftLoadShare / 0.5) * symRatio, 0.1, 0.92),
      calfR: clamp(0.15 + squatDepth * 0.42 + swayAmpM * 6.5, 0.1, 0.88),
      calfL: clamp(0.15 + squatDepth * 0.38 * symRatio + swayAmpM * 5.5, 0.1, 0.85),
      lumbar: clamp(0.16 + (leanDeg / 22) * 0.72 + squatDepth * 0.25, 0.12, 0.98),
      deltoidR: clamp(0.12 + (rShoElevDeg / 145) * 0.82, 0.1, 0.97),
      deltoidL: clamp(0.12 + (lShoElevDeg / 145) * 0.78, 0.1, 0.94),
      bicepsR: clamp(0.10 + ((rElbFlexDeg - 20) / 120) * 0.76, 0.08, 0.95),
      bicepsL: clamp(0.10 + ((lElbFlexDeg - 20) / 120) * 0.70, 0.08, 0.92),
    };

    const com3D = {
      x: midPelvis.x * 0.55 + midThorax.x * 0.45,
      y: midPelvis.y * 0.52 + midThorax.y * 0.48,
      z: midPelvis.z * 0.55 + midThorax.z * 0.45,
    };

    return {
      joints: {
        headCenter,
        neckBase,
        midThorax,
        midPelvis,
        rShoulder,
        lShoulder,
        rElbow: rArm.elbow,
        lElbow: lArm.elbow,
        rWrist: rArm.wrist,
        lWrist: lArm.wrist,
        rHand: rArm.handTip,
        lHand: lArm.handTip,
        rHip,
        lHip,
        rKnee,
        lKnee,
        rAnkle,
        lAnkle,
        rToe,
        lToe,
        rHeel,
        lHeel,
      },
      vertebrae,
      spineDir,
      com3D,
      angles: {
        rKneeFlexDeg,
        lKneeFlexDeg,
        rShoElevDeg,
        lShoElevDeg,
        rElbFlexDeg,
        lElbFlexDeg,
        leanDeg,
      },
      grf: {
        rightShare: rightLoadShare,
        leftShare: leftLoadShare,
        rightN: Math.round(totalForceN * rightLoadShare),
        leftN: Math.round(totalForceN * leftLoadShare),
      },
      muscles,
      squatDepth,
    };
  }

  /**
   * Renders a 3D specular-shaded volumetric limb/muscle fusiform capsule between 2 projected points.
   */
  drawVolumetricCapsule(ctx, pA, pB, radA, radB, baseRgb, bulgeFactor = 1.15, alpha = 0.92) {
    const dx = pB.x - pA.x;
    const dy = pB.y - pA.y;
    const len = Math.hypot(dx, dy);
    if (len < 1.5) return;

    const nx = -dy / len;
    const ny = dx / len;
    const midX = (pA.x + pB.x) * 0.5;
    const midY = (pA.y + pB.y) * 0.5;
    const rMid = ((radA + radB) * 0.5) * bulgeFactor;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pA.x + nx * radA, pA.y + ny * radA);
    ctx.quadraticCurveTo(midX + nx * rMid, midY + ny * rMid, pB.x + nx * radB, pB.y + ny * radB);
    ctx.arc(pB.x, pB.y, radB, Math.atan2(ny, nx), Math.atan2(-ny, -nx), false);
    ctx.quadraticCurveTo(midX - nx * rMid, midY - ny * rMid, pA.x - nx * radA, pA.y - ny * radA);
    ctx.arc(pA.x, pA.y, radA, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false);
    ctx.closePath();

    // Cylindrical 3D cross-sectional lighting gradient (shadow edge -> lit core -> specular highlight -> rim)
    const grad = ctx.createLinearGradient(
      midX - nx * rMid,
      midY - ny * rMid,
      midX + nx * rMid,
      midY + ny * rMid
    );
    const darkEdge = shadeRgb(baseRgb, 0.36);
    const midTone = shadeRgb(baseRgb, 0.92);
    const specHighlight = shadeRgb(baseRgb, 1.18, 62);
    const rimLight = shadeRgb(baseRgb, 0.68, 18);

    grad.addColorStop(0.0, rgbCss(darkEdge, alpha));
    grad.addColorStop(0.32, rgbCss(midTone, alpha));
    grad.addColorStop(0.58, rgbCss(specHighlight, alpha));
    grad.addColorStop(0.88, rgbCss(midTone, alpha));
    grad.addColorStop(1.0, rgbCss(rimLight, alpha));

    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = rgbCss(shadeRgb(baseRgb, 1.1, 45), alpha * 0.42);
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.restore();
  }

  drawLitJointSphere(ctx, p, radius, baseRgb, glow = false) {
    if (glow) {
      const halo = ctx.createRadialGradient(p.x, p.y, radius * 0.3, p.x, p.y, radius * 2.4);
      halo.addColorStop(0, rgbCss(baseRgb, 0.42));
      halo.addColorStop(1, rgbCss(baseRgb, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    const g = ctx.createRadialGradient(
      p.x - radius * 0.32,
      p.y - radius * 0.32,
      radius * 0.12,
      p.x,
      p.y,
      radius
    );
    g.addColorStop(0, rgbCss(shadeRgb(baseRgb, 1.2, 85), 1));
    g.addColorStop(0.55, rgbCss(baseRgb, 1));
    g.addColorStop(1, rgbCss(shadeRgb(baseRgb, 0.38), 1));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draws a perspective-projected 3D spatial goniometer ring around `vertex3D`
   * in the exact anatomical plane spanned by (armA3D - vertex3D) and (armB3D - vertex3D).
   */
  draw3DGoniometerRing(ctx, W, H, armA3D, vertex3D, armB3D, radiusM, colorHex, angleDeg, label, calloutSide = -1) {
    const u = vecNorm(vecSub(armA3D, vertex3D));
    const vRaw = vecNorm(vecSub(armB3D, vertex3D));
    const dotUV = clamp(u.x * vRaw.x + u.y * vRaw.y + u.z * vRaw.z, -0.999, 0.999);
    const sweepRad = Math.acos(dotUV);

    // Orthonormal basis (u, w) in the joint's 3D plane of flexion
    let normal = vecCross(u, vRaw);
    if (vecLen(normal) < 1e-4) normal = { x: 0, y: 0, z: 1 };
    normal = vecNorm(normal);
    const w = vecNorm(vecCross(normal, u));

    const pVert = this.project(vertex3D, W, H);

    // Full subtle 360° 3D gyroscopic ring
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i <= 36; i++) {
      const th = (i / 36) * Math.PI * 2;
      const pt3 = {
        x: vertex3D.x + (u.x * Math.cos(th) + w.x * Math.sin(th)) * radiusM,
        y: vertex3D.y + (u.y * Math.cos(th) + w.y * Math.sin(th)) * radiusM,
        z: vertex3D.z + (u.z * Math.cos(th) + w.z * Math.sin(th)) * radiusM,
      };
      const pr = this.project(pt3, W, H);
      if (i === 0) ctx.moveTo(pr.x, pr.y);
      else ctx.lineTo(pr.x, pr.y);
    }
    ctx.closePath();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.24)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Active shaded 3D angular sector between u and vRaw
    ctx.beginPath();
    ctx.moveTo(pVert.x, pVert.y);
    const steps = 18;
    for (let i = 0; i <= steps; i++) {
      const th = (i / steps) * sweepRad;
      const pt3 = {
        x: vertex3D.x + (u.x * Math.cos(th) + w.x * Math.sin(th)) * radiusM,
        y: vertex3D.y + (u.y * Math.cos(th) + w.y * Math.sin(th)) * radiusM,
        z: vertex3D.z + (u.z * Math.cos(th) + w.z * Math.sin(th)) * radiusM,
      };
      const pr = this.project(pt3, W, H);
      ctx.lineTo(pr.x, pr.y);
    }
    ctx.closePath();
    ctx.fillStyle = colorHex === "#fbbf24" ? "rgba(251, 191, 36, 0.24)" : "rgba(52, 211, 153, 0.24)";
    ctx.fill();

    // Highlighted arc edge
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const th = (i / steps) * sweepRad;
      const pt3 = {
        x: vertex3D.x + (u.x * Math.cos(th) + w.x * Math.sin(th)) * radiusM,
        y: vertex3D.y + (u.y * Math.cos(th) + w.y * Math.sin(th)) * radiusM,
        z: vertex3D.z + (u.z * Math.cos(th) + w.z * Math.sin(th)) * radiusM,
      };
      const pr = this.project(pt3, W, H);
      if (i === 0) ctx.moveTo(pr.x, pr.y);
      else ctx.lineTo(pr.x, pr.y);
    }
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Floating glassmorphic callout tag + leader line
    const tagW = 104;
    const tagH = 22;
    const tagX = clamp(pVert.x + calloutSide * (tagW * 0.5 + 34) - tagW * 0.5, 16, W - 295);
    const tagY = clamp(pVert.y - 12, 54, H - 138);

    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(pVert.x, pVert.y);
    ctx.lineTo(calloutSide < 0 ? tagX + tagW : tagX, tagY + tagH * 0.5);
    ctx.stroke();

    ctx.fillStyle = "rgba(8, 15, 30, 0.88)";
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, tagW, tagH, 5);
    ctx.fill();
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.fillStyle = colorHex;
    ctx.font = '700 10.5px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = "left";
    ctx.fillText(`${label} ${angleDeg.toFixed(1)}°`, tagX + 7, tagY + 14.5);
    ctx.restore();
  }

  /**
   * Renders the perspective 3D floor grid, dual piezoelectric force plates,
   * CoP postural sway trail, and 3D Ground Reaction Force (GRF) vectors.
   */
  drawForcePlateDeck(ctx, W, H, pose) {
    // 1. Perspective floor grid (X in [-1.05..1.05], Z in [-0.75..0.75])
    ctx.save();
    for (let xi = -5; xi <= 5; xi++) {
      const x = xi * 0.21;
      const a = this.project({ x, y: 0, z: -0.78 }, W, H);
      const b = this.project({ x, y: 0, z: 0.78 }, W, H);
      ctx.strokeStyle = xi === 0 ? "rgba(56, 189, 248, 0.24)" : "rgba(148, 163, 184, 0.09)";
      ctx.lineWidth = xi === 0 ? 1.3 : 0.9;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (let zi = -3; zi <= 3; zi++) {
      const z = zi * 0.24;
      const a = this.project({ x: -1.05, y: 0, z }, W, H);
      const b = this.project({ x: 1.05, y: 0, z }, W, H);
      ctx.strokeStyle = zi === 0 ? "rgba(56, 189, 248, 0.22)" : "rgba(148, 163, 184, 0.09)";
      ctx.lineWidth = zi === 0 ? 1.2 : 0.9;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // 2. Dual Piezoelectric Force Plates (Anatomical Right at -X, Anatomical Left at +X)
    const drawPlate = (xMin, xMax, share, label, forceN) => {
      const corners = [
        this.project({ x: xMin, y: 0.004, z: -0.22 }, W, H),
        this.project({ x: xMax, y: 0.004, z: -0.22 }, W, H),
        this.project({ x: xMax, y: 0.004, z: 0.26 }, W, H),
        this.project({ x: xMin, y: 0.004, z: 0.26 }, W, H),
      ];
      const overloaded = share > 0.56;
      ctx.beginPath();
      corners.forEach((c, idx) => (idx === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y)));
      ctx.closePath();
      ctx.fillStyle = overloaded ? "rgba(244, 63, 94, 0.14)" : "rgba(16, 185, 129, 0.12)";
      ctx.fill();
      ctx.strokeStyle = overloaded ? "rgba(251, 113, 133, 0.55)" : "rgba(52, 211, 153, 0.48)";
      ctx.lineWidth = 1.4;
      ctx.stroke();

      const frontMid = this.project({ x: (xMin + xMax) * 0.5, y: 0.004, z: 0.33 }, W, H);
      ctx.fillStyle = overloaded ? "#fda4af" : "#6ee7b7";
      ctx.font = '700 9.5px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = "center";
      ctx.fillText(`${label} ${(share * 100).toFixed(0)}%`, frontMid.x, frontMid.y);
      if (Number.isFinite(forceN)) {
        ctx.font = '600 8.5px "JetBrains Mono", ui-monospace, monospace';
        ctx.fillText(`${Math.round(forceN)} N`, frontMid.x, frontMid.y + 11);
      }
    };

    drawPlate(-0.34, -0.04, pose.grf.rightShare, "R-PLATE", pose.grf.rightN);
    drawPlate(0.04, 0.34, pose.grf.leftShare, "L-PLATE", pose.grf.leftN);

    // 3. Center-of-Mass (CoM) Floor Shadow, Postural Sway Ellipse & Vertical Plumb Laser
    const comFloor = this.project({ x: pose.com3D.x, y: 0.006, z: pose.com3D.z }, W, H);
    const comTop = this.project(pose.com3D, W, H);

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = pose.angles.leanDeg > 10 ? "rgba(251, 113, 133, 0.52)" : "rgba(52, 211, 153, 0.45)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(comTop.x, comTop.y);
    ctx.lineTo(comFloor.x, comFloor.y);
    ctx.stroke();
    ctx.restore();

    // CoP floor trail
    if (this.copTrail2D.length > 2) {
      ctx.beginPath();
      this.copTrail2D.forEach((pt, idx) => {
        const pr = this.project({ x: pt.x, y: 0.008, z: pt.z }, W, H);
        if (idx === 0) ctx.moveTo(pr.x, pr.y);
        else ctx.lineTo(pr.x, pr.y);
      });
      ctx.strokeStyle = "rgba(56, 189, 248, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.fillStyle = pose.angles.leanDeg > 10 ? "#fb7185" : "#34d399";
    ctx.beginPath();
    ctx.arc(comFloor.x, comFloor.y, 4.2, 0, Math.PI * 2);
    ctx.fill();

    // 4. 3D Ground Reaction Force (GRF) Vectors rising from each foot CoP
    const drawGrfVector = (footX, share, forceN) => {
      const vecHeightM = 0.22 + share * 0.58;
      const base = this.project({ x: footX, y: 0.01, z: 0.05 }, W, H);
      const tip = this.project({ x: footX * 0.92, y: vecHeightM, z: 0.04 }, W, H);
      const col = share > 0.56 ? "#fb7185" : "#38bdf8";

      ctx.strokeStyle = col;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();

      // Arrowhead
      const ang = Math.atan2(tip.y - base.y, tip.x - base.x);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(tip.x - 8 * Math.cos(ang - 0.42), tip.y - 8 * Math.sin(ang - 0.42));
      ctx.lineTo(tip.x - 8 * Math.cos(ang + 0.42), tip.y - 8 * Math.sin(ang + 0.42));
      ctx.closePath();
      ctx.fill();

      // Force magnitude is printed on the plate label so it never collides with the knee goniometer tags.
    };

    drawGrfVector(-0.19, pose.grf.rightShare, pose.grf.rightN);
    drawGrfVector(0.19, pose.grf.leftShare, pose.grf.leftN);

    // 5. 3D Axis Triad Gizmo (bottom-left above waveform strip)
    const gizmoOrigin = { x: 46, y: H - 134 };
    const axes = [
      { v: { x: 1, y: 0, z: 0 }, col: "#fb7185", lbl: "X" },
      { v: { x: 0, y: 1, z: 0 }, col: "#34d399", lbl: "Y" },
      { v: { x: 0, y: 0, z: 1 }, col: "#38bdf8", lbl: "Z" },
    ];
    axes.forEach((ax) => {
      const p0 = this.project({ x: 0, y: 0.88, z: 0 }, W, H);
      const p1 = this.project({ x: ax.v.x * 0.14, y: 0.88 + ax.v.y * 0.14, z: ax.v.z * 0.14 }, W, H);
      const dx = clamp(p1.x - p0.x, -24, 24);
      const dy = clamp(p1.y - p0.y, -24, 24);
      ctx.strokeStyle = ax.col;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(gizmoOrigin.x, gizmoOrigin.y);
      ctx.lineTo(gizmoOrigin.x + dx, gizmoOrigin.y + dy);
      ctx.stroke();
      ctx.fillStyle = ax.col;
      ctx.font = '700 9px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = "center";
      ctx.fillText(ax.lbl, gizmoOrigin.x + dx * 1.32, gizmoOrigin.y + dy * 1.32 + 3);
    });

    ctx.restore();
  }

  /**
   * Renders the always-live 3D Articulated 21-Joint Hand & Tremor Micro-Scanner
   * in the top-right HUD glass panel. Uses empirical/live 21-joint hand points
   * when available, or drives a full 3D anatomical hand rig coupled to tap Hz & tremor RMS.
   */
  draw3DHandMicroScanner(ctx, W, H, hands21, telemetry, nowMs) {
    const boxW = 248;
    const boxH = 196;
    const boxX = W - boxW - 16;
    const boxY = 52;

    // Glassmorphic inset container
    ctx.save();
    ctx.fillStyle = "rgba(8, 15, 29, 0.88)";
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(88, 166, 255, 0.34)";
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = '700 10px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = "left";
    ctx.fillText("3D 21-JOINT HAND & TREMOR RIG", boxX + 12, boxY + 18);

    // Check if empirical stream has >= 12 confident hand joints on this frame
    let rawPts = null;
    if (Array.isArray(hands21)) {
      for (const hArr of hands21) {
        if (Array.isArray(hArr) && hArr.filter(Boolean).length >= 14) {
          rawPts = hArr;
          break;
        }
      }
    }

    const tSec = nowMs / 1000;
    const tapHz = telemetry.hand_tap_hz || 4.1;
    const tremorMm = telemetry.tremor_rms_mm || 0.65;
    const pinchPhase = 0.5 - 0.5 * Math.cos(2 * Math.PI * tapHz * tSec); // 0 = pinched, 1 = open
    const tremorJit = (seed) =>
      (Math.sin(tSec * 46 + seed * 1.9) * 0.6 + Math.cos(tSec * 61 + seed * 3.1) * 0.4) *
      clamp(tremorMm * 0.9, 0.15, 4.5);

    const cx = boxX + boxW * 0.5;
    const cy = boxY + boxH * 0.62;
    let pts2D = [];

    if (rawPts) {
      const valid = rawPts.filter(Boolean);
      const mx = valid.reduce((s, p) => s + p[0], 0) / valid.length;
      const my = valid.reduce((s, p) => s + p[1], 0) / valid.length;
      const span = Math.max(
        0.045,
        ...valid.map((p) => Math.hypot(p[0] - mx, p[1] - my))
      );
      const scale = 68 / span;
      pts2D = Array.from({ length: 21 }, (_, idx) => {
        const p = rawPts[idx];
        if (!p) return { x: cx, y: cy, r: 2.8 };
        return {
          x: clamp(cx + (p[0] - mx) * scale + tremorJit(idx) * 0.4, boxX + 14, boxX + boxW - 14),
          y: clamp(cy - 14 + (p[1] - my) * scale + tremorJit(idx + 5) * 0.4, boxY + 30, boxY + boxH - 28),
          r: idx === 0 ? 5.2 : idx % 4 === 0 ? 3.2 : 3.8,
        };
      });
    } else {
      // Parametric 3D Anatomical 21-Joint Hand Rig rotated with slight 3D yaw + active thumb-index opposition
      const rot = 0.24 * Math.sin(tSec * 0.7) + this.yaw * 0.22;
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);
      const projHand = (hx, hy, hz, idx) => {
        const rx = hx * cosR + hz * sinR;
        const rz = -hx * sinR + hz * cosR;
        const persp = 1 / (1 - rz * 0.004);
        return {
          x: cx + rx * persp + tremorJit(idx),
          y: cy - hy * persp + tremorJit(idx + 9) * 0.75,
          r: idx === 0 ? 5.6 : idx % 4 === 0 ? 3.2 : 3.9,
        };
      };

      pts2D[0] = projHand(0, -34, 0, 0); // Wrist carpal root

      // Thumb (joints 1..4) flexing toward index tip during pinch
      const thumbCurl = (1 - pinchPhase) * 0.62;
      const thumbRaw = [
        [-18, -20, 8],
        [-33 + thumbCurl * 12, -5, 14],
        [-41 + thumbCurl * 22, 12 - thumbCurl * 6, 18],
        [-44 + thumbCurl * 31, 28 - thumbCurl * 12, 20],
      ];
      thumbRaw.forEach((p, k) => {
        pts2D[1 + k] = projHand(p[0], p[1], p[2], 1 + k);
      });

      // 4 Fingers: Index (5..8), Middle (9..12), Ring (13..16), Pinky (17..20)
      const fingerSpecs = [
        { base: [-17, 4, 4], spread: -0.14, len: 1.0, curl: (1 - pinchPhase) * 0.58 },
        { base: [-5, 7, 1], spread: -0.03, len: 1.09, curl: 0.14 + (1 - pinchPhase) * 0.14 },
        { base: [7, 5, -2], spread: 0.07, len: 1.02, curl: 0.18 + (1 - pinchPhase) * 0.12 },
        { base: [18, 0, -5], spread: 0.18, len: 0.84, curl: 0.22 + (1 - pinchPhase) * 0.1 },
      ];
      fingerSpecs.forEach((f, fIdx) => {
        const rootIdx = 5 + fIdx * 4;
        let px = f.base[0];
        let py = f.base[1];
        let pz = f.base[2];
        pts2D[rootIdx] = projHand(px, py, pz, rootIdx);
        const segLens = [21 * f.len, 15 * f.len, 12 * f.len];
        segLens.forEach((sl, sIdx) => {
          const cAng = f.curl * (0.55 + sIdx * 0.45);
          px += Math.sin(f.spread) * sl * Math.cos(cAng) - (fIdx === 0 ? cAng * 5 : 0);
          py += Math.cos(f.spread) * sl * Math.cos(cAng);
          pz += sl * Math.sin(cAng) * 0.95;
          pts2D[rootIdx + 1 + sIdx] = projHand(px, py, pz, rootIdx + 1 + sIdx);
        });
      });
    }

    // Translucent palm metacarpal membrane
    if (pts2D[0] && pts2D[5] && pts2D[9] && pts2D[13] && pts2D[17]) {
      ctx.beginPath();
      [0, 1, 5, 9, 13, 17].forEach((idx, k) => {
        const p = pts2D[idx];
        if (k === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.fillStyle = "rgba(56, 189, 248, 0.12)";
      ctx.fill();
    }

    // Volumetric 3D shaded phalangeal bones
    const phalanxCol = tremorMm >= 1.5 ? { r: 251, g: 113, b: 133 } : { r: 56, g: 189, b: 248 };
    const thumbIndexCol = { r: 52, g: 211, b: 153 };
    HAND21_BONES.forEach(([a, b]) => {
      const pA = pts2D[a];
      const pB = pts2D[b];
      if (!pA || !pB) return;
      const isPinchDigit = b <= 8;
      this.drawVolumetricCapsule(
        ctx,
        pA,
        pB,
        pA.r * 0.85,
        pB.r * 0.78,
        isPinchDigit ? thumbIndexCol : phalanxCol,
        1.04,
        0.92
      );
    });

    // Thumb-tip (4) to Index-tip (8) Pinch Aperture Laser & Tremor Halo
    const pThumb = pts2D[4];
    const pIndex = pts2D[8];
    let apertureMm = 32;
    if (pThumb && pIndex) {
      const distPx = Math.hypot(pThumb.x - pIndex.x, pThumb.y - pIndex.y);
      apertureMm = clamp(distPx * 0.85, 4.0, 68.0);
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pThumb.x, pThumb.y);
      ctx.lineTo(pIndex.x, pIndex.y);
      ctx.stroke();
      ctx.restore();

      if (tremorMm > 0.8) {
        ctx.strokeStyle = "rgba(251, 113, 133, 0.45)";
        ctx.lineWidth = 1.2;
        const trR = clamp(tremorMm * 4.2, 5, 16);
        ctx.beginPath();
        ctx.arc(pIndex.x, pIndex.y, trR, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 21 Lit Joint Nodes
    pts2D.forEach((p, idx) => {
      if (!p) return;
      const isTip = idx === 4 || idx === 8;
      this.drawLitJointSphere(
        ctx,
        p,
        isTip ? 3.8 : 2.7,
        isTip ? { r: 251, g: 191, b: 36 } : { r: 226, g: 232, b: 240 },
        isTip
      );
    });

    // Bottom readout inside hand micro-scanner
    ctx.fillStyle = "#94a3b8";
    ctx.font = '600 9.5px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillText(
      `PINCH ${apertureMm.toFixed(1)}mm · ${tapHz.toFixed(1)}Hz · RMS ${tremorMm.toFixed(2)}mm`,
      boxX + 12,
      boxY + boxH - 10
    );
    ctx.restore();
  }

  /**
   * Renders the compact OpenCap / OpenSim Muscle Activation (%MVC) HUD bars
   * in the upper-left corner of the 3D stage.
   */
  drawMuscleActivationHud(ctx, muscles) {
    const x = 18;
    const y = 52;
    const w = 158;
    const h = 114;

    ctx.save();
    ctx.fillStyle = "rgba(8, 15, 29, 0.82)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 9);
    ctx.fill();
    ctx.strokeStyle = "rgba(88, 166, 255, 0.24)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#cbd5e1";
    ctx.font = '700 9.5px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillText("MUSCLE LOAD (%MVC)", x + 10, y + 16);

    const rows = [
      { label: "QUAD R/L", val: Math.max(muscles.quadR, muscles.quadL), disp: `${Math.round(muscles.quadR * 100)}/${Math.round(muscles.quadL * 100)}%` },
      { label: "GLUTE R", val: muscles.gluteR, disp: `${Math.round(muscles.gluteR * 100)}%` },
      { label: "LUMBAR", val: muscles.lumbar, disp: `${Math.round(muscles.lumbar * 100)}%` },
      { label: "DELTOID", val: Math.max(muscles.deltoidR, muscles.deltoidL), disp: `${Math.round(Math.max(muscles.deltoidR, muscles.deltoidL) * 100)}%` },
    ];

    rows.forEach((r, idx) => {
      const ry = y + 30 + idx * 21;
      const rgb = activationToRgb(r.val);
      ctx.fillStyle = "#94a3b8";
      ctx.font = '600 8.8px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = "left";
      ctx.fillText(r.label, x + 10, ry);
      ctx.fillStyle = rgbCss(rgb);
      ctx.textAlign = "right";
      ctx.fillText(r.disp, x + w - 10, ry);

      ctx.fillStyle = "rgba(30, 41, 59, 0.85)";
      ctx.beginPath();
      ctx.roundRect(x + 10, ry + 4, w - 20, 4.5, 2);
      ctx.fill();

      ctx.fillStyle = rgbCss(rgb);
      ctx.beginPath();
      ctx.roundRect(x + 10, ry + 4, Math.max(4, (w - 20) * r.val), 4.5, 2);
      ctx.fill();
    });

    ctx.restore();
  }

  /**
   * Renders scenario-specific 3D aerospace lighting, solar particle flux, or cabin CO2 haze.
   */
  drawScenarioBackdrop(ctx, W, H, scenarioId, telemetry, nowMs, reducedMotion) {
    const bgGrad = ctx.createRadialGradient(W * 0.37, H * 0.42, 26, W * 0.42, H * 0.48, W * 0.74);
    const rad = telemetry.radiation_msv_day || 0.45;
    const co2 = telemetry.cabin_co2_mmhg || 1.7;

    if (scenarioId === "spe_blackout" || rad >= 1.5) {
      bgGrad.addColorStop(0.0, "#311020");
      bgGrad.addColorStop(0.52, "#140918");
      bgGrad.addColorStop(1.0, "#050710");
    } else if (scenarioId === "hypercapnia_drift" || co2 >= 2.4) {
      bgGrad.addColorStop(0.0, "#2c200e");
      bgGrad.addColorStop(0.52, "#121320");
      bgGrad.addColorStop(1.0, "#050812");
    } else if (scenarioId === "nominal_lunar" && (telemetry.bilateral_symmetry_pct || 95) >= 93) {
      bgGrad.addColorStop(0.0, "#0d2838");
      bgGrad.addColorStop(0.52, "#071423");
      bgGrad.addColorStop(1.0, "#040812");
    } else {
      bgGrad.addColorStop(0.0, "#122142");
      bgGrad.addColorStop(0.52, "#081122");
      bgGrad.addColorStop(1.0, "#040812");
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Animated Solar Particle Event (SPE) ionizing proton flux streaks
    if (scenarioId === "spe_blackout" || rad >= 1.5) {
      ctx.save();
      const t = reducedMotion ? 1.0 : nowMs * 0.0012;
      for (let i = 0; i < 22; i++) {
        const seed = (i * 97.3) % 1;
        const prog = (seed + t * (0.42 + (i % 5) * 0.09)) % 1;
        const sx = ((i * 139) % W) * 0.92 + prog * 110 - 40;
        const sy = prog * (H - 110) + 42;
        const len = 18 + (i % 4) * 9;
        const grad = ctx.createLinearGradient(sx, sy, sx + len * 0.65, sy + len);
        grad.addColorStop(0, "rgba(251, 113, 133, 0)");
        grad.addColorStop(1, "rgba(251, 113, 133, 0.46)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + len * 0.65, sy + len);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Elevated Cabin ppCO2 atmospheric boundary ring on the 3D floor
    if (scenarioId === "hypercapnia_drift" || co2 >= 2.4) {
      ctx.save();
      ctx.beginPath();
      for (let s = 0; s <= 36; s++) {
        const ang = (s / 36) * Math.PI * 2;
        const p = this.project({ x: Math.cos(ang) * 0.44, y: 0.015, z: Math.sin(ang) * 0.34 }, W, H);
        if (s === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = "rgba(251, 191, 36, 0.46)";
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Renders a translucent holographic cyan Pre-Flight Nominal Baseline Ghost Skeleton
   * alongside the active astronaut twin so biomechanical drift is immediately visible.
   */
  drawBaselineGhostPose(ctx, W, H, ghostPose, activePose) {
    const G = ghostPose.joints;
    const bones = [
      [G.rAnkle, G.rKnee],
      [G.rKnee, G.rHip],
      [G.lAnkle, G.lKnee],
      [G.lKnee, G.lHip],
      [G.rHip, G.lHip],
      [G.midPelvis, G.neckBase],
      [G.neckBase, G.headCenter],
      [G.neckBase, G.rShoulder],
      [G.neckBase, G.lShoulder],
      [G.rShoulder, G.rElbow],
      [G.rElbow, G.rWrist],
      [G.lShoulder, G.lElbow],
      [G.lElbow, G.lWrist],
    ];

    ctx.save();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.38)";
    ctx.lineWidth = 2.2;
    ctx.setLineDash([4, 3]);
    bones.forEach(([a, b]) => {
      const pA = this.project(a, W, H);
      const pB = this.project(b, W, H);
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.stroke();
    });

    // Ghost cranium halo
    const gHead = this.project(G.headCenter, W, H);
    const gRad = Math.max(10, 0.098 * gHead.scale);
    ctx.beginPath();
    ctx.arc(gHead.x, gHead.y, gRad, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(56, 189, 248, 0.08)";
    ctx.fill();
    ctx.stroke();

    // Ghost joint nodes
    ctx.setLineDash([]);
    [G.rShoulder, G.lShoulder, G.rElbow, G.lElbow, G.rHip, G.lHip, G.rKnee, G.lKnee].forEach((pt) => {
      const p = this.project(pt, W, H);
      ctx.fillStyle = "rgba(125, 211, 252, 0.52)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.8, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw 3D Drift Vector from Pre-Flight Ghost Head to Active Perturbed Head if noticeable drift exists
    const aHead = this.project(activePose.joints.headCenter, W, H);
    const headDistPx = Math.hypot(aHead.x - gHead.x, aHead.y - gHead.y);
    if (headDistPx >= 11) {
      ctx.strokeStyle = "#fb7185";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(gHead.x, gHead.y);
      ctx.lineTo(aHead.x, aHead.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const midX = (gHead.x + aHead.x) * 0.5;
      const midY = Math.min(gHead.y, aHead.y) - 30;
      const dLean = Math.abs(activePose.angles.leanDeg - ghostPose.angles.leanDeg);
      const tag = `ΔDRIFT ${dLean.toFixed(1)}°`;
      ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
      ctx.fillRect(midX - 38, midY - 11, 76, 15);
      ctx.strokeStyle = "rgba(251, 113, 133, 0.7)";
      ctx.lineWidth = 1;
      ctx.strokeRect(midX - 38, midY - 11, 76, 15);
      ctx.fillStyle = "#fda4af";
      ctx.font = '700 8.8px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = "center";
      ctx.fillText(tag, midX, midY);
      ctx.textAlign = "left";
    }
    ctx.restore();
  }

  /**
   * Renders compact provenance card under %MVC HUD distinguishing Recorded 62f Mocap vs. What-If Digital Twin.
   */
  drawModeProvenanceHud(ctx, isDigitalTwin, frameIdx, totalFrames, activePose, ghostPose, scenarioId, telemetry) {
    const x = 18;
    const y = 173;
    const w = 158;
    const h = 50;

    ctx.save();
    ctx.fillStyle = "rgba(8, 15, 30, 0.84)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = isDigitalTwin ? "rgba(56, 189, 248, 0.36)" : "rgba(52, 211, 153, 0.36)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = '700 8.6px "JetBrains Mono", ui-monospace, monospace';
    if (isDigitalTwin) {
      ctx.fillStyle = "#38bdf8";
      ctx.fillText("CYAN = PRE-FLIGHT GHOST", x + 9, y + 14);
      const dRom = (telemetry.joint_rom_deg || 94) - (telemetry.target_rom_deg || 118);
      const dLean = activePose.angles.leanDeg - (ghostPose ? ghostPose.angles.leanDeg : 1.8);
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(`ΔROM ${dRom >= 0 ? "+" : ""}${dRom.toFixed(0)}° · ΔTILT ${dLean >= 0 ? "+" : ""}${dLean.toFixed(1)}°`, x + 9, y + 28);
      ctx.fillStyle = scenarioId === "spe_blackout" ? "#fda4af" : scenarioId === "hypercapnia_drift" ? "#fcd34d" : "#94a3b8";
      const subTag =
        scenarioId === "spe_blackout"
          ? `SPE ${Number(telemetry.radiation_msv_day || 3.45).toFixed(2)} mSv/d`
          : scenarioId === "hypercapnia_drift"
            ? `ppCO2 ${Number(telemetry.cabin_co2_mmhg || 2.85).toFixed(2)} mmHg`
            : `SYM ${Number(telemetry.bilateral_symmetry_pct || 81.5).toFixed(1)}%`;
      ctx.fillText(`WHAT-IF // ${subTag}`, x + 9, y + 42);
    } else {
      ctx.fillStyle = "#6ee7b7";
      ctx.fillText("RECORDED 62F MOCAP CLIP", x + 9, y + 14);
      const cur = Math.max(1, (frameIdx || 0) + 1);
      const tot = Math.max(1, totalFrames || 62);
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(`FRAME ${String(cur).padStart(2, "0")}/${tot} · 30 FPS`, x + 9, y + 28);
      ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
      ctx.beginPath();
      ctx.roundRect(x + 9, y + 35, w - 18, 5, 2.5);
      ctx.fill();
      ctx.fillStyle = "#34d399";
      ctx.beginPath();
      ctx.roundRect(x + 9, y + 35, Math.max(4, (w - 18) * (cur / tot)), 5, 2.5);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Main 60-FPS 3D Musculoskeletal Digital Twin render entry point.
   */
  renderStage(ctx, W, H, params) {
    const {
      protocol,
      telemetry,
      empKin,
      body18,
      hands21,
      nowMs,
      paused,
      reducedMotion = false,
      isDigitalTwin = false,
      scenarioId = "musculoskeletal_asymmetry",
      frameIndex = 0,
      totalFrames = 62,
    } = params;

    this.stepCamera(0.016, reducedMotion);

    // 1. Scenario-Responsive Aerospace Studio Spotlight & Hazard Particles
    this.drawScenarioBackdrop(ctx, W, H, scenarioId, telemetry, nowMs, reducedMotion);

    // 2. Solve 3D Biomechanical Pose, Inverse-Kinematic Muscle Loads & GRF
    const pose = this.solveMusculoskeletalPose({
      protocol,
      telemetry,
      empKin: isDigitalTwin ? null : empKin,
      body18: isDigitalTwin ? null : body18,
      nowMs,
      paused,
    });
    const J = pose.joints;
    const M = pose.muscles;

    // Optional Pre-Flight Nominal 1g Baseline Ghost Pose (rendered in Digital Twin mode)
    let ghostPose = null;
    if (isDigitalTwin && this.showBaselineGhost) {
      ghostPose = this.solveMusculoskeletalPose({
        protocol,
        telemetry: {
          ...telemetry,
          joint_rom_deg: telemetry.target_rom_deg || (protocol === "eva_upper_reach" ? 168 : 118),
          bilateral_symmetry_pct: 98.5,
          trunk_lean_deg: 1.8,
          postural_sway_mms: 4.2,
          tremor_rms_mm: 0.35,
        },
        empKin: null,
        body18: null,
        nowMs,
        paused,
      });
    }

    // Record 3D motion trails (~24 Hz sampling)
    if (!paused && nowMs - this.lastTrailMs > 40) {
      this.lastTrailMs = nowMs;
      this.wristTrail3D.push({ ...J.rWrist });
      this.kneeTrail3D.push({ ...J.rKnee });
      this.copTrail2D.push({ x: pose.com3D.x, z: pose.com3D.z });
      if (this.wristTrail3D.length > 34) this.wristTrail3D.shift();
      if (this.kneeTrail3D.length > 34) this.kneeTrail3D.shift();
      if (this.copTrail2D.length > 42) this.copTrail2D.shift();
    }

    // 3. Draw 3D Perspective Force-Plate Deck & GRF Arrows
    this.drawForcePlateDeck(ctx, W, H, pose);

    // 3b. Draw Translucent Cyan Pre-Flight Baseline Ghost Skeleton behind active twin in Digital Twin mode
    if (ghostPose) {
      this.drawBaselineGhostPose(ctx, W, H, ghostPose, pose);
    }

    // 4. Draw 3D Glowing Trajectory Ribbons (projected through active 3D camera!)
    const draw3DTrail = (trail, rgb) => {
      if (trail.length < 3) return;
      for (let i = 1; i < trail.length; i++) {
        const a = this.project(trail[i - 1], W, H);
        const b = this.project(trail[i], W, H);
        const frac = i / trail.length;
        ctx.strokeStyle = rgbCss(rgb, frac * 0.62);
        ctx.lineWidth = 1.2 + frac * 2.6;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    };
    draw3DTrail(this.wristTrail3D, { r: 52, g: 211, b: 153 });
    draw3DTrail(this.kneeTrail3D, { r: 251, g: 191, b: 36 });

    // 5. Build Depth-Sorted (Z-Buffered) 3D Volumetric Anatomical Primitives
    const drawQueue = [];
    const neutralBoneRgb = { r: 125, g: 185, b: 245 };
    const colFor = (act) => (this.showMuscleHeatmap ? activationToRgb(act) : neutralBoneRgb);

    const pushSegment = (a3, b3, rA_m, rB_m, act, bulge = 1.18) => {
      const pA = this.project(a3, W, H);
      const pB = this.project(b3, W, H);
      const zMean = (pA.zCam + pB.zCam) * 0.5;
      const rA = Math.max(2.5, rA_m * pA.scale);
      const rB = Math.max(2.2, rB_m * pB.scale);
      const baseRgb = colFor(act);
      const dynBulge = bulge * (1 + act * 0.16);
      drawQueue.push({
        z: zMean,
        fn: () => this.drawVolumetricCapsule(ctx, pA, pB, rA, rB, baseRgb, dynBulge, 0.94),
      });
    };

    // Lower Extremities (Thighs = Quads/Glutes, Shanks = Gastroc/Tibialis, Feet)
    pushSegment(J.rHip, J.rKnee, 0.068, 0.048, M.quadR, 1.24);
    pushSegment(J.lHip, J.lKnee, 0.068, 0.048, M.quadL, 1.24);
    pushSegment(J.rKnee, J.rAnkle, 0.047, 0.031, M.calfR, 1.2);
    pushSegment(J.lKnee, J.lAnkle, 0.047, 0.031, M.calfL, 1.2);
    pushSegment(J.rHeel, J.rToe, 0.032, 0.024, 0.2, 1.05);
    pushSegment(J.lHeel, J.lToe, 0.032, 0.024, 0.2, 1.05);

    // Pelvic Girdle & Gluteus Cradles
    pushSegment(J.rHip, J.midPelvis, 0.056, 0.052, M.gluteR, 1.15);
    pushSegment(J.lHip, J.midPelvis, 0.056, 0.052, M.gluteL, 1.15);

    // Lumbar & Thoracic Paraspinal Muscles + Articulated 8-Vertebra Spine
    for (let i = 0; i < pose.vertebrae.length - 1; i++) {
      const vA = pose.vertebrae[i];
      const vB = pose.vertebrae[i + 1];
      const isLumbar = i < 4;
      pushSegment(vA, vB, isLumbar ? 0.046 : 0.042, 0.04, isLumbar ? M.lumbar : M.lumbar * 0.65, 1.12);
    }

    // 3D Sculpted Thoracic Ribcage Shell (4 contoured 3D rib rings around thoracic vertebrae)
    [3, 4, 5, 6].forEach((vIdx, rIdx) => {
      const vCenter = pose.vertebrae[vIdx];
      const ribW = 0.145 - Math.abs(rIdx - 1.5) * 0.015;
      const ribD = 0.088 - rIdx * 0.006;
      const pCenter = this.project(vCenter, W, H);
      drawQueue.push({
        z: pCenter.zCam - 0.01,
        fn: () => {
          ctx.beginPath();
          for (let s = 0; s <= 20; s++) {
            const ang = -Math.PI * 0.85 + (s / 20) * Math.PI * 1.7;
            const rp = this.project(
              {
                x: vCenter.x + Math.sin(ang) * ribW,
                y: vCenter.y - Math.cos(ang) * 0.016,
                z: vCenter.z + Math.cos(ang) * ribD,
              },
              W,
              H
            );
            if (s === 0) ctx.moveTo(rp.x, rp.y);
            else ctx.lineTo(rp.x, rp.y);
          }
          ctx.strokeStyle = "rgba(125, 211, 252, 0.34)";
          ctx.lineWidth = 1.6;
          ctx.stroke();
        },
      });
    });

    // Clavicles / Shoulder Girdle
    pushSegment(J.neckBase, J.rShoulder, 0.034, 0.044, M.deltoidR * 0.75, 1.08);
    pushSegment(J.neckBase, J.lShoulder, 0.034, 0.044, M.deltoidL * 0.75, 1.08);

    // Upper Arms (Deltoid + Biceps/Triceps), Forearms & Hands
    pushSegment(J.rShoulder, J.rElbow, 0.048, 0.036, Math.max(M.deltoidR, M.bicepsR), 1.24);
    pushSegment(J.lShoulder, J.lElbow, 0.048, 0.036, Math.max(M.deltoidL, M.bicepsL), 1.24);
    pushSegment(J.rElbow, J.rWrist, 0.036, 0.025, M.bicepsR * 0.85, 1.18);
    pushSegment(J.lElbow, J.lWrist, 0.036, 0.025, M.bicepsL * 0.85, 1.18);
    pushSegment(J.rWrist, J.rHand, 0.026, 0.018, 0.25, 1.05);
    pushSegment(J.lWrist, J.lHand, 0.026, 0.018, 0.25, 1.05);

    // Cervical Neck & 3D Astronaut Cranium + Specular Visor Helmet
    pushSegment(J.neckBase, J.headCenter, 0.032, 0.036, 0.18, 1.02);
    const pHead = this.project(J.headCenter, W, H);
    drawQueue.push({
      z: pHead.zCam,
      fn: () => {
        const hRad = Math.max(12, 0.108 * pHead.scale);
        this.drawLitJointSphere(ctx, pHead, hRad, { r: 203, g: 213, b: 225 }, false);

        // Sleek 3D Aerospace Visor Band facing camera/forward (+Z)
        const visorFront = this.project(
          {
            x: J.headCenter.x + pose.spineDir.x * 0.02,
            y: J.headCenter.y + 0.008,
            z: J.headCenter.z + 0.088,
          },
          W,
          H
        );
        if (visorFront.zCam >= pHead.zCam - 0.03) {
          const vw = hRad * 0.82;
          const vh = hRad * 0.44;
          const vg = ctx.createLinearGradient(visorFront.x - vw, visorFront.y - vh, visorFront.x + vw, visorFront.y + vh);
          vg.addColorStop(0, "#0f172a");
          vg.addColorStop(0.5, "#38bdf8");
          vg.addColorStop(1, "#0284c7");
          ctx.fillStyle = vg;
          ctx.beginPath();
          ctx.ellipse(visorFront.x, visorFront.y, vw, vh, -pose.angles.leanDeg * 0.012, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(186, 230, 253, 0.65)";
          ctx.lineWidth = 1.1;
          ctx.stroke();
        }
      },
    });

    // Anatomical Joint Nodes
    const jointNodes = [
      { pt: J.rShoulder, r: 0.032, col: activationToRgb(M.deltoidR), glow: true },
      { pt: J.lShoulder, r: 0.032, col: activationToRgb(M.deltoidL), glow: false },
      { pt: J.rElbow, r: 0.027, col: { r: 251, g: 191, b: 36 }, glow: true },
      { pt: J.lElbow, r: 0.027, col: { r: 148, g: 163, b: 184 }, glow: false },
      { pt: J.rWrist, r: 0.023, col: { r: 52, g: 211, b: 153 }, glow: true },
      { pt: J.lWrist, r: 0.023, col: { r: 148, g: 163, b: 184 }, glow: false },
      { pt: J.rHip, r: 0.034, col: activationToRgb(M.gluteR), glow: false },
      { pt: J.lHip, r: 0.034, col: activationToRgb(M.gluteL), glow: false },
      { pt: J.rKnee, r: 0.032, col: activationToRgb(M.quadR), glow: true },
      { pt: J.lKnee, r: 0.032, col: activationToRgb(M.quadL), glow: false },
      { pt: J.rAnkle, r: 0.025, col: { r: 148, g: 163, b: 184 }, glow: false },
      { pt: J.lAnkle, r: 0.025, col: { r: 148, g: 163, b: 184 }, glow: false },
    ];
    jointNodes.forEach((jn) => {
      const pr = this.project(jn.pt, W, H);
      drawQueue.push({
        z: pr.zCam + 0.015,
        fn: () => this.drawLitJointSphere(ctx, pr, Math.max(3, jn.r * pr.scale), jn.col, jn.glow),
      });
    });

    // Execute Back-to-Front Z-Sorted Painter's Pass!
    drawQueue.sort((a, b) => a.z - b.z);
    drawQueue.forEach((item) => item.fn());

    // 6. Draw 3D Perspective Joint Goniometer Protractor Rings
    if (protocol === "ared_squat" || protocol === "vestibular_sway") {
      this.draw3DGoniometerRing(
        ctx,
        W,
        H,
        J.rHip,
        J.rKnee,
        J.rAnkle,
        0.15,
        "#fbbf24",
        pose.angles.rKneeFlexDeg,
        "R-KNEE",
        -1
      );
      this.draw3DGoniometerRing(
        ctx,
        W,
        H,
        J.lHip,
        J.lKnee,
        J.lAnkle,
        0.14,
        "#34d399",
        pose.angles.lKneeFlexDeg,
        "L-KNEE",
        1
      );
    } else {
      this.draw3DGoniometerRing(
        ctx,
        W,
        H,
        J.rHip,
        J.rShoulder,
        J.rElbow,
        0.15,
        "#34d399",
        pose.angles.rShoElevDeg,
        "R-SHO",
        -1
      );
      this.draw3DGoniometerRing(
        ctx,
        W,
        H,
        J.rShoulder,
        J.rElbow,
        J.rWrist,
        0.135,
        "#fbbf24",
        pose.angles.rElbFlexDeg,
        "R-ELB",
        -1
      );
    }

    // 7. OpenCap-Style Muscle Activation (%MVC) HUD, Mode Provenance & Always-Live 3D 21-Joint Hand Rig
    this.drawMuscleActivationHud(ctx, M);
    this.drawModeProvenanceHud(ctx, isDigitalTwin, frameIndex, totalFrames, pose, ghostPose, scenarioId, telemetry);
    this.draw3DHandMicroScanner(ctx, W, H, hands21, telemetry, nowMs);

    return pose;
  }
}
