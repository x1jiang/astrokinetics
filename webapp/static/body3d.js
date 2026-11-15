/**
 * Crew Body Map 3D renderer (WebGL2, no dependencies).
 *
 * Draws a layered anatomical body (skin surface, skeleton, heart, arteries, muscles) that the
 * Triage tab overlays with sensor callouts. Geometry is BodyParts3D 4.0 (CC BY 4.0, DBCLS),
 * taken from the Human Atlas project (github.com/ashemag/human-atlas, MIT) and repacked by
 * scripts/build_body_atlas.py. See /static/atlas/ATTRIBUTION.md.
 *
 * Solid layers are lit normally. "Shell" layers are drawn as a hologram: nearly transparent
 * face-on and bright at grazing angles, so the skeleton stays visible through skin and muscle.
 */

const VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNor;
uniform vec3 uMin;
uniform vec3 uSize;
uniform mat4 uViewProj;
uniform mat3 uRot;
uniform vec3 uPivot;
uniform float uBeat;
uniform float uDeform;
out vec3 vNor;
out vec3 vWorld;
out float vDist;
void main() {
  vec3 p = uMin + aPos * uSize;
  if (uDeform > 0.0) {
    // Without gravity, fluid leaves the legs and collects in the head: legs thin, face swells.
    // Exaggerated so it can be seen; this is an illustration, not a simulation.
    float legs = (1.0 - smoothstep(0.15, 0.95, p.y)) * step(abs(p.x), 0.2);
    float face = smoothstep(1.46, 1.6, p.y);
    float scale = 1.0 + uDeform * (0.075 * face - 0.11 * legs);
    vec2 axis = p.y < 0.95 ? vec2(sign(p.x) * 0.09, -0.01) : vec2(0.0, 0.02);
    p.xz = axis + (p.xz - axis) * scale;
  }
  vDist = length(p - uPivot);
  p = uPivot + (p - uPivot) * uBeat;
  vec3 w = uRot * p;
  vWorld = w;
  vNor = uRot * aNor;
  gl_Position = uViewProj * vec4(w, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec3 vNor;
in vec3 vWorld;
in float vDist;
uniform float uFlow;
uniform float uPhase;
uniform vec3 uPivot;
uniform float uPress;
uniform float uGrav;
uniform float uStream;
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uEye;
uniform vec3 uScanColor;
uniform float uAlpha;
uniform float uGlow;
uniform float uScanY;
uniform int uMode;
out vec4 outColor;
void main() {
  vec3 n = normalize(vNor);
  vec3 v = normalize(uEye - vWorld);
  float ndv = abs(dot(n, v));
  float scan = smoothstep(0.05, 0.0, abs(vWorld.y - uScanY));
  if (uMode == 1) {
    float fres = pow(1.0 - ndv, 2.2);
    // Hydrostatic pressure relative to the heart: rho * g * h. On Earth it rises toward the feet
    // and falls toward the head; with no gravity the column disappears.
    float below = uPivot.y - vWorld.y;
    float pr = clamp(below * uGrav / 1.3, -0.35, 1.0);
    vec3 pc = pr > 0.0 ? mix(uColor, vec3(1.0, 0.42, 0.2), pr) : mix(uColor, vec3(0.3, 0.42, 1.0), -pr * 2.8);
    float up = (1.0 - uGrav) * smoothstep(1.15, 1.6, vWorld.y);
    float down = (1.0 - uGrav) * (1.0 - smoothstep(0.2, 0.95, vWorld.y));
    pc = mix(pc, vec3(1.0, 0.5, 0.46), up * 0.6);
    float gain = 1.0 + uPress * (up * 1.0 - down * 0.5);
    float streak = uPress * uStream * pow(0.5 + 0.5 * sin(vWorld.y * 15.0 - uTime * 5.5), 6.0)
      * smoothstep(0.1, 0.5, vWorld.y) * (1.0 - smoothstep(1.52, 1.72, vWorld.y));
    vec3 base = mix(uColor, pc, uPress);
    float a = clamp((0.05 + fres) * uAlpha * gain + scan * 0.45 + streak * 0.4, 0.0, 1.0);
    outColor = vec4(mix(mix(base, vec3(0.7, 0.95, 1.0), streak * 0.6), uScanColor, scan) * a, a);
  } else {
    float key = abs(dot(n, normalize(vec3(0.35, 0.6, 0.75))));
    float fill = abs(dot(n, normalize(vec3(-0.6, 0.2, 0.5))));
    float rim = pow(1.0 - ndv, 3.0);
    // Pulse wave: one bright front leaves the heart on each beat and runs out along the arteries.
    // It is slowed to one body length per beat so the eye can follow it (the real wave is far faster).
    float front = fract(vDist * 0.75 - uPhase + 0.5) - 0.5;
    float wave = uFlow * exp(-front * front * 46.0);
    vec3 c = uColor * (0.26 + key * 0.72 + fill * 0.2) * uGlow * (1.0 - 0.42 * uFlow + 1.7 * wave)
      + wave * vec3(1.0, 0.56, 0.42) * 0.4 + rim * 0.3 * uScanColor + scan * 0.6 * uScanColor;
    outColor = vec4(c, 1.0);
  }
}`;

const LOOK = {
  bone: [0.93, 0.89, 0.78],
  muscle: [0.82, 0.3, 0.26],
  heart: [0.98, 0.24, 0.3],
  vessels: [0.94, 0.2, 0.24],
  skin: [0.3, 0.74, 0.98],
};

/* Which layers each view draws, as [layer, mode, strength]. Solids first, then hologram shells. */
const PRESETS = {
  all: [["bone", "solid", 1], ["heart", "solid", 1], ["vessels", "solid", 1], ["muscle", "shell", 0.5], ["skin", "shell", 0.6]],
  skin: [["heart", "solid", 1], ["vessels", "solid", 1], ["skin", "shell", 1.1]],
  muscle: [["muscle", "solid", 1], ["skin", "shell", 0.32]],
  bone: [["bone", "solid", 1], ["heart", "solid", 1], ["skin", "shell", 0.32]],
};

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "shader failed");
  return shader;
}

function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  // column-major
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
}

function multiply(a, b) {
  const out = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

async function inflate(response, expectedBytes) {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.arrayBuffer();
  const sig = new Uint8Array(payload, 0, 2);
  // A host may already have decoded the gzip stream; only inflate when the gzip signature is present.
  const buffer = sig[0] === 0x1f && sig[1] === 0x8b
    ? await new Response(new Blob([payload]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()
    : payload;
  if (buffer.byteLength !== expectedBytes) throw new Error("anatomy file incomplete");
  return buffer;
}

/**
 * @returns {Promise<null | object>} null when WebGL2 or gzip streams are unavailable.
 */
export async function createBody3D(canvas, { baseUrl = "/static/atlas/" } = {}) {
  if (typeof DecompressionStream === "undefined") return null;
  const gl = canvas.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: true });
  if (!gl) return null;

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "link failed");
  const U = {};
  ["uMin", "uSize", "uViewProj", "uRot", "uPivot", "uBeat", "uColor", "uEye", "uScanColor", "uAlpha", "uGlow", "uScanY", "uMode", "uFlow", "uPhase", "uDeform", "uPress", "uGrav", "uStream", "uTime"].forEach((name) => {
    U[name] = gl.getUniformLocation(program, name);
  });

  const manifest = await (await fetch(`${baseUrl}manifest.json`)).json();
  const min = manifest.min;
  const size = manifest.max.map((v, i) => v - min[i]);
  const height = manifest.max[1];
  const layers = {};
  const state = {
    view: "all",
    drag: 0,
    dragging: false,
    bpm: 72,
    tint: null,
    gravMode: null, // null = view off, "earth" or "orbit"
    grav: 1,
    press: 0,
    stream: 0,
    slowFrames: 0,
    lite: false,
    last: 0,
    viewProj: null,
    rot: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  };

  async function load(name) {
    if (layers[name]) return true;
    const info = manifest.layers[name];
    if (!info) return false;
    const buffer = await inflate(await fetch(`${baseUrl}${info.url}`), info.bytes);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(buffer, 0, info.vertices * 12), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.UNSIGNED_SHORT, true, 8, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.BYTE, true, 4, info.vertices * 8);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint8Array(buffer, info.vertices * 12, info.indices * 4), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    layers[name] = { vao, count: info.indices };
    return true;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.round(rect.width * dpr));
    const h = Math.max(2, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return w / h;
  }

  function render(now) {
    const aspect = resize();
    if (state.last) {
      // Drop the muscle hologram from the combined view on machines that cannot keep up.
      const frameMs = now - state.last;
      state.slowFrames = frameMs > 34 ? state.slowFrames + 1 : Math.max(0, state.slowFrames - 2);
      if (state.slowFrames > 45) state.lite = true;
    }
    const dt = state.last ? Math.min(100, now - state.last) : 16;
    state.last = now;
    // Ease toward the chosen gravity; the headward streaks run while the fluid is redistributing.
    const gravTarget = state.gravMode === "orbit" ? 0 : 1;
    const pressTarget = state.gravMode ? 1 : 0;
    const k = Math.min(1, dt / 850);
    state.grav += (gravTarget - state.grav) * k;
    state.press += (pressTarget - state.press) * Math.min(1, dt / 400);
    const moving = Math.min(1, Math.abs(gravTarget - state.grav) * 4);
    state.stream += ((state.gravMode === "orbit" ? Math.max(moving, 0.28) : 0) - state.stream) * Math.min(1, dt / 300);

    const fov = (25 * Math.PI) / 180;
    const dist = (height * 0.55) / Math.tan(fov / 2);
    const eyeY = height * 0.5;
    const proj = perspective(fov, aspect, 0.5, 20);
    const view = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -eyeY, -dist, 1];
    state.viewProj = multiply(proj, view);
    const yaw = (state.dragging ? 0 : 0.42 * Math.sin(now * 0.00042)) * (state.drag ? 0.25 : 1) + state.drag;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    state.rot = [c, 0, -s, 0, 1, 0, s, 0, c];

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform3fv(U.uMin, min);
    gl.uniform3fv(U.uSize, size);
    gl.uniformMatrix4fv(U.uViewProj, false, new Float32Array(state.viewProj));
    gl.uniformMatrix3fv(U.uRot, false, new Float32Array(state.rot));
    gl.uniform3f(U.uEye, 0, eyeY, dist);
    gl.uniform3f(U.uScanColor, 0.42, 0.86, 1.0);
    gl.uniform1f(U.uScanY, (((now * 0.00022) % 1.3) - 0.15) * height);
    gl.uniform3fv(U.uPivot, manifest.heartCenter);
    gl.uniform1f(U.uGrav, state.grav);
    gl.uniform1f(U.uStream, state.stream);
    gl.uniform1f(U.uTime, now / 1000);

    const phase = ((now / 1000) * state.bpm) / 60 % 1;
    const bump = (centre, width) => Math.exp(-((phase - centre) ** 2) / (2 * width * width));
    const pulse = state.bpm > 0 ? bump(0.1, 0.035) + 0.5 * bump(0.3, 0.045) : 0;

    const passes = (PRESETS[state.view] || PRESETS.all).filter(([name]) => layers[name] && !(state.lite && state.view === "all" && name === "muscle"));
    gl.enable(gl.DEPTH_TEST);
    ["solid", "shell"].forEach((mode) => {
      if (mode === "solid") {
        gl.disable(gl.BLEND);
        gl.depthMask(true);
      } else {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.depthMask(false);
      }
      passes.forEach(([name, passMode, strength]) => {
        if (passMode !== mode) return;
        let color = LOOK[name];
        if (name === "skin" && state.tint === "alert") color = [1.0, 0.36, 0.44];
        gl.uniform3fv(U.uColor, color);
        gl.uniform1i(U.uMode, mode === "shell" ? 1 : 0);
        gl.uniform1f(U.uAlpha, name === "skin" && state.tint ? strength * 1.5 : strength);
        gl.uniform1f(U.uBeat, name === "heart" ? 1 + 0.075 * pulse : 1);
        gl.uniform1f(U.uGlow, name === "heart" ? 1 + 0.4 * pulse : 1);
        gl.uniform1f(U.uFlow, name === "vessels" && state.bpm > 0 ? 1 : 0);
        gl.uniform1f(U.uPhase, phase);
        const soft = name === "skin" || name === "muscle";
        gl.uniform1f(U.uDeform, soft ? (1 - state.grav) * state.press : 0);
        gl.uniform1f(U.uPress, name === "skin" ? state.press : 0);
        gl.bindVertexArray(layers[name].vao);
        gl.drawElements(gl.TRIANGLES, layers[name].count, gl.UNSIGNED_INT, 0);
      });
    });
    gl.depthMask(true);
    gl.bindVertexArray(null);
  }

  /** Model-space point (metres) -> [x, y] in 0..1 of the canvas, plus whether it faces the viewer. */
  function project(point) {
    if (!state.viewProj) return null;
    const r = state.rot;
    const wx = r[0] * point[0] + r[3] * point[1] + r[6] * point[2];
    const wy = r[1] * point[0] + r[4] * point[1] + r[7] * point[2];
    const wz = r[2] * point[0] + r[5] * point[1] + r[8] * point[2];
    const m = state.viewProj;
    const cx = m[0] * wx + m[4] * wy + m[8] * wz + m[12];
    const cy = m[1] * wx + m[5] * wy + m[9] * wz + m[13];
    const cw = m[3] * wx + m[7] * wy + m[11] * wz + m[15];
    return { x: (cx / cw + 1) / 2, y: (1 - cy / cw) / 2, front: wz > -0.02 };
  }

  let lastX = 0;
  canvas.addEventListener("pointerdown", (e) => {
    state.dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!state.dragging) return;
    state.drag += (e.clientX - lastX) * 0.011;
    lastX = e.clientX;
  });
  const release = () => { state.dragging = false; };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("dblclick", () => { state.drag = 0; });

  return {
    manifest,
    load,
    has: (name) => Boolean(layers[name]),
    needs: (view) => (PRESETS[view] || PRESETS.all).map(([name]) => name),
    setView: (view) => { state.view = PRESETS[view] ? view : "all"; },
    setHeartRate: (bpm) => { state.bpm = Number(bpm) > 0 ? Number(bpm) : 0; },
    setTint: (tint) => { state.tint = tint || null; },
    /** null turns the gravity view off; "earth" or "orbit" turns it on and eases to that state. */
    setGravity: (mode) => { state.gravMode = mode === "earth" || mode === "orbit" ? mode : null; },
    get gravity() { return state.grav; },
    get gravityView() { return state.press; },
    render,
    project,
    metresToUnits: (viewBoxHeight) => {
      const a = project([0, 0, 0]);
      const b = project([0, 1, 0]);
      return a && b ? Math.abs(a.y - b.y) * viewBoxHeight : 0;
    },
  };
}
