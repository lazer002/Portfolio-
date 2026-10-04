/**
 * Data particles.
 *
 * context.txt is firm about what this is not: "Do not use space imagery", "do
 * not fill the entire viewport with uncontrolled particles", and for the data
 * vault specifically "data should look like structured information, not stars."
 *
 * So these are not drifting points. They are placed on a lattice of service
 * conduits, they flow along lanes rather than wander, and they dim into the fog
 * the way cabling dims down a corridor. The vertex shader does the whole
 * animation — the CPU uploads positions once and never touches them again.
 */

export const dataParticleVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  // Device pixels per world unit at one unit of depth. Computed per frame from
  // the real projection and drawing-buffer height, so the chips keep a constant
  // physical size instead of being a magic constant times 1/depth.
  uniform float uProjectionScale;
  uniform float uMaxPointSize;
  uniform float uEnergy;
  uniform float uSpread;
  uniform vec3  uPointer;
  uniform float uPointerStrength;
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform float uOpacity;

  attribute vec3 aLane;      // static lane position (x, laneIndex, depth)
  attribute float aSeed;     // stable per-particle random
  attribute float aSpeed;    // lane-relative flow speed
  attribute float aScale;    // size multiplier

  varying float vSeed;
  varying float vDepth;
  varying float vFlow;
  varying vec3  vColor;

  // Cheap hash — GLSL only, so the layout never depends on CPU randomness.
  float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
  }

  void main() {
    vSeed = aSeed;

    float t = uTime * aSpeed * (0.35 + aSeed * 0.65);

    // Structured flow: particles travel a fixed loop along their lane and wrap.
    // The lane depth keeps them on separate conduits instead of a flat sheet.
    float along = fract(aLane.y + t);
    vFlow = along;

    vec3 pos = vec3(
      aLane.x,
      sin(along * 6.28318 + aSeed * 6.28) * uSpread * 0.06,
      aLane.z + (along - 0.5) * 14.0
    );

    // Pointer bends nearby particles outward. Strength is local, so hovering
    // one object never disturbs the whole field.
    vec3 toPointer = pos - uPointer;
    float dist = length(toPointer);
    float influence = uPointerStrength * smoothstep(9.0, 0.0, dist);
    pos += normalize(toPointer + vec3(0.001)) * influence * (0.6 + aSeed * 1.4);
    pos.y += influence * 0.35 * sin(uTime * 1.7 + aSeed * 12.0);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vDepth = -mvPosition.z;

    // Two-tone gradient by lane phase reads as data rather than decoration.
    vColor = mix(uColorA, uColorB, hash11(aSeed * 7.0));

    gl_Position = projectionMatrix * mvPosition;

    // World-space chip size, so a chip is a fixed size in the scene rather than
    // a fixed number of pixels that happens to look right from one distance.
    float world = uSize * aScale * (0.55 + uEnergy * 0.45);

    // Fade on BOTH ends. The camera travels down the middle of this field, so
    // without a near fade a chip one unit from the lens projects to well over a
    // hundred pixels and the screen fills with huge additive squares.
    float fade = smoothstep(90.0, 8.0, vDepth) * smoothstep(1.5, 9.0, vDepth);

    gl_PointSize = clamp(world * uProjectionScale / max(0.6, vDepth) * fade, 0.0, uMaxPointSize);
  }
`

export const dataParticleFragment = /* glsl */ `
  precision highp float;

  uniform float uOpacity;
  uniform float uEnergy;
  uniform float uFogNear;
  uniform float uFogFar;

  varying float vSeed;
  varying float vDepth;
  varying float vFlow;
  varying vec3  vColor;

  void main() {
    // Square point sprite with soft edges — data chips, not round stars.
    vec2 uv = gl_PointCoord - 0.5;
    float d = max(abs(uv.x), abs(uv.y));
    if (d > 0.5) discard;

    float edge = 1.0 - smoothstep(0.28, 0.5, d);
    float core = 1.0 - smoothstep(0.0, 0.22, d);

    // A brighter leading edge on each chip suggests direction of flow.
    float head = smoothstep(0.94, 1.0, vFlow) * 0.8;

    float fog = 1.0 - smoothstep(uFogNear, uFogFar, vDepth);
    // Chips the camera is about to pass through fade out instead of smearing
    // across the frame as they cross the near plane.
    fog *= smoothstep(1.0, 7.0, vDepth);
    float alpha = (edge * 0.5 + core * 0.55 + head) * uOpacity * fog * (0.35 + uEnergy * 0.65);

    if (alpha < 0.004) discard;
    gl_FragColor = vec4(vColor * (0.7 + core * 0.9 + head), alpha);
  }
`