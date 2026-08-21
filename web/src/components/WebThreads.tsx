import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";

import "./WebThreads.css";

const FAN_MODE = { center: 0, left: 1, right: 2 } as const;

type WebThreadsProps = {
  color1?: string;
  color2?: string;
  color3?: string;
  speed?: number;
  threadCount?: number;
  frequency?: number;
  spread?: number;
  taper?: number;
  position?: number;
  slope?: number;
  fanMode?: keyof typeof FAN_MODE;
  glow?: number;
  falloff?: number;
  thickness?: number;
  brightness?: number;
  opacity?: number;
  mirror?: boolean;
  shimmer?: boolean;
  grain?: boolean;
  grainIntensity?: number;
  mouseInteraction?: boolean;
  mouseStrength?: number;
  className?: string;
};

type ThreadsContext = {
  program: Program;
};

const vertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uSpeed;
uniform float uThreadCount;
uniform float uFrequency;
uniform float uSpread;
uniform float uTaper;
uniform float uPosition;
uniform float uSlope;
uniform float uFanMode;
uniform float uGlow;
uniform float uFalloff;
uniform float uThickness;
uniform float uBrightness;
uniform float uOpacity;
uniform float uMirror;
uniform float uShimmer;
uniform float uGrain;
uniform float uGrainIntensity;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uMouse;
uniform float uMouseStrength;
uniform float uEnableMouse;
uniform float uMouseActive;
out vec4 fragColor;

#define TAU 6.28318530718
#define MAX_THREADS 10

float threadGlow(float x, float str, float dist) {
  return dist / pow(max(x, 1e-4), str);
}

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  float n = max(uThreadCount, 1.0);
  float pinchX = uFanMode < 0.5 ? 0.5 : (uFanMode < 1.5 ? 0.0 : 1.0);
  if (uEnableMouse > 0.5) {
    pinchX = mix(pinchX, uMouse.x, clamp(uMouseStrength, 0.0, 1.0) * uMouseActive);
  }

  float spreadDx = uSpread * abs(uv.x - pinchX);
  float baseT = iTime * uSpeed;
  float tauOverN = TAU / n;
  float mirroredPhase = uMirror > 0.5 ? sign(pinchX - uv.x) : 1.0;
  float shimmerT = iTime * 1.7;
  float invThickness = 1.0 / max(uThickness, 0.01);
  float xFreq = uv.x * uFrequency;
  float diagonalPosition = uPosition + (uv.x - 0.5) * uSlope;
  float yOff = uv.y - diagonalPosition;
  float colorScale = n > 1.0 ? 1.0 / (n - 1.0) : 0.0;
  vec3 color = vec3(0.0);
  float glowSum = 0.0;

  for (int index = 0; index < MAX_THREADS; index++) {
    float i = float(index);
    if (i >= n) break;
    float amplitude = spreadDx * (1.0 + i * uTaper);
    float shimmerPhase = uShimmer > 0.5 ? sin(shimmerT + i * 1.3) * 0.35 : 0.0;
    float phase = (baseT + i * tauOverN) * mirroredPhase + shimmerPhase;
    float sdf = abs(yOff + sin(xFreq + phase) * amplitude) * invThickness;
    float glowValue = threadGlow(sdf, uFalloff, uGlow);
    vec3 threadColor = mix(uColor1, uColor2, i * colorScale);
    color += glowValue * threadColor;
    glowSum += glowValue;
  }

  float coreAmount = smoothstep(0.5, 2.2, glowSum);
  color = mix(color, uColor3 * glowSum, coreAmount * 0.5);
  float adjustedBrightness = uBrightness;
  if (uEnableMouse > 0.5) {
    vec2 mouseDelta = uv - uMouse;
    adjustedBrightness += clamp(uMouseStrength, 0.0, 1.0)
      * uMouseActive * exp(-dot(mouseDelta, mouseDelta) * 6.0) * 0.6;
  }
  color *= adjustedBrightness;
  float alpha = clamp(glowSum, 0.0, 1.0) * uOpacity;
  vec3 outputColor = color * alpha;

  if (uGrain > 0.5) {
    float grainValue = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + iTime)
      * 43758.5453) - 0.5) * uGrainIntensity;
    outputColor = clamp(outputColor + grainValue, 0.0, 1.0);
    alpha = clamp(alpha + grainValue, 0.0, 1.0);
  }
  fragColor = vec4(outputColor, alpha);
}
`;

const contexts = new WeakMap<HTMLElement, ThreadsContext>();

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [1, 1, 1];
  return [
    Number.parseInt(result[1], 16) / 255,
    Number.parseInt(result[2], 16) / 255,
    Number.parseInt(result[3], 16) / 255,
  ];
}

export function WebThreads({
  color1 = "#5227ff",
  color2 = "#ff9ffc",
  color3 = "#ffffff",
  speed = 0.2,
  threadCount = 6,
  frequency = 5,
  spread = 0.18,
  taper = 1,
  position = 0.5,
  slope = 0,
  fanMode = "center",
  glow = 0.02,
  falloff = 0.6,
  thickness = 1.1,
  brightness = 0.6,
  opacity = 1,
  mirror = true,
  shimmer = false,
  grain = true,
  grainIntensity = 0.05,
  mouseInteraction = true,
  mouseStrength = 0.3,
  className = "",
}: WebThreadsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ enabled: mouseInteraction, strength: mouseStrength });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        webgl: 2,
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
      });
    } catch {
      container.classList.add("web-threads-unavailable");
      return;
    }

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Float32Array([1, 1]) },
        uSpeed: { value: 0.2 },
        uThreadCount: { value: 6 },
        uFrequency: { value: 5 },
        uSpread: { value: 0.18 },
        uTaper: { value: 1 },
        uPosition: { value: 0.5 },
        uSlope: { value: 0 },
        uFanMode: { value: 0 },
        uGlow: { value: 0.02 },
        uFalloff: { value: 0.6 },
        uThickness: { value: 1.1 },
        uBrightness: { value: 0.6 },
        uOpacity: { value: 1 },
        uMirror: { value: 1 },
        uShimmer: { value: 0 },
        uGrain: { value: 1 },
        uGrainIntensity: { value: 0.05 },
        uColor1: { value: new Float32Array([1, 1, 1]) },
        uColor2: { value: new Float32Array([1, 1, 1]) },
        uColor3: { value: new Float32Array([1, 1, 1]) },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        uMouseStrength: { value: 0.3 },
        uEnableMouse: { value: 0 },
        uMouseActive: { value: 0 },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });
    contexts.set(container, { program });

    const setSize = () => {
      const rect = container.getBoundingClientRect();
      renderer.setSize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
      const resolution = program.uniforms.iResolution.value as Float32Array;
      resolution[0] = gl.drawingBufferWidth;
      resolution[1] = gl.drawingBufferHeight;
      renderer.render({ scene: mesh });
    };

    const resizeObserver = new ResizeObserver(setSize);
    resizeObserver.observe(container);
    setSize();

    const currentMouse = [0.5, 0.5];
    const targetMouse = [0.5, 0.5];
    let currentActive = 0;
    let targetActive = 0;
    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      targetMouse[0] = (event.clientX - rect.left) / rect.width;
      targetMouse[1] = 1 - (event.clientY - rect.top) / rect.height;
      targetActive = 1;
    };
    const handleMouseEnter = () => { targetActive = 1; };
    const handleMouseLeave = () => { targetActive = 0; };
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseenter", handleMouseEnter);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let animationFrame = 0;
    let isVisible = true;
    let isPageVisible = !document.hidden;
    const startedAt = performance.now();
    const loop = (time: number) => {
      program.uniforms.iTime.value = (time - startedAt) * 0.001;
      currentMouse[0] += 0.05 * (targetMouse[0] - currentMouse[0]);
      currentMouse[1] += 0.05 * (targetMouse[1] - currentMouse[1]);
      currentActive += 0.05 * (targetActive - currentActive);
      const mouse = program.uniforms.uMouse.value as Float32Array;
      mouse[0] = currentMouse[0];
      mouse[1] = currentMouse[1];
      program.uniforms.uMouseActive.value = currentActive;
      program.uniforms.uEnableMouse.value = mouseRef.current.enabled ? 1 : 0;
      program.uniforms.uMouseStrength.value = mouseRef.current.strength;
      renderer.render({ scene: mesh });
      animationFrame = requestAnimationFrame(loop);
    };
    const start = () => {
      if (reduceMotion) {
        renderer.render({ scene: mesh });
      } else if (isVisible && isPageVisible && animationFrame === 0) {
        animationFrame = requestAnimationFrame(loop);
      }
    };
    const stop = () => {
      if (animationFrame !== 0) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    };

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      if (isVisible) start();
      else stop();
    });
    intersectionObserver.observe(container);
    const handleVisibility = () => {
      isPageVisible = !document.hidden;
      if (isPageVisible) start();
      else stop();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseenter", handleMouseEnter);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      contexts.delete(container);
      if (canvas.parentNode === container) container.removeChild(canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const context = container ? contexts.get(container) : undefined;
    if (!context) return;
    const uniforms = context.program.uniforms;
    uniforms.uSpeed.value = speed;
    uniforms.uThreadCount.value = Math.min(Math.max(Math.round(threadCount), 1), 10);
    uniforms.uFrequency.value = frequency;
    uniforms.uSpread.value = spread;
    uniforms.uTaper.value = taper;
    uniforms.uPosition.value = position;
    uniforms.uSlope.value = slope;
    uniforms.uFanMode.value = FAN_MODE[fanMode];
    uniforms.uGlow.value = glow;
    uniforms.uFalloff.value = falloff;
    uniforms.uThickness.value = thickness;
    uniforms.uBrightness.value = brightness;
    uniforms.uOpacity.value = opacity;
    uniforms.uMirror.value = mirror ? 1 : 0;
    uniforms.uShimmer.value = shimmer ? 1 : 0;
    uniforms.uGrain.value = grain ? 1 : 0;
    uniforms.uGrainIntensity.value = grainIntensity;

    ([color1, color2, color3] as const).forEach((color, index) => {
      const target = uniforms[`uColor${index + 1}`].value as Float32Array;
      const rgb = hexToRgb(color);
      target[0] = rgb[0];
      target[1] = rgb[1];
      target[2] = rgb[2];
    });
    uniforms.uMouseStrength.value = mouseStrength;
    uniforms.uEnableMouse.value = mouseInteraction ? 1 : 0;
    mouseRef.current = { enabled: mouseInteraction, strength: mouseStrength };
  }, [
    brightness,
    color1,
    color2,
    color3,
    falloff,
    fanMode,
    frequency,
    glow,
    grain,
    grainIntensity,
    mirror,
    mouseInteraction,
    mouseStrength,
    opacity,
    position,
    shimmer,
    slope,
    speed,
    spread,
    taper,
    thickness,
    threadCount,
  ]);

  return (
    <div
      ref={containerRef}
      className={`web-threads-container ${className}`.trim()}
      aria-hidden="true"
    />
  );
}

export default WebThreads;
