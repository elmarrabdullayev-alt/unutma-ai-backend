import React, { Component, ErrorInfo, ReactNode, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { HourglassFocusTimer } from './HourglassFocusTimer';

export type Hourglass3DProps = {
  progress: number;
  isPaused: boolean;
};

// Check WebGL support safely
function checkWebGLSupport(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return Boolean(gl);
  } catch {
    return false;
  }
}

// -------------------------------------------------------------
// 3D Hourglass Model & Physics Inside Three.js Scene
// -------------------------------------------------------------
const HourglassScene: React.FC<{ progress: number; isPaused: boolean }> = ({ progress, isPaused }) => {
  const groupRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const streamRef = useRef<THREE.Mesh>(null);
  const upperSandRef = useRef<THREE.Mesh>(null);
  const lowerSandRef = useRef<THREE.Mesh>(null);

  const isCompleted = progress >= 0.999;
  const isStreaming = !isPaused && !isCompleted && progress < 0.998;

  // 1. Hourglass Glass Lathe Geometry (28 radial segments for optimal mobile performance)
  const glassGeometry = useMemo(() => {
    const points: THREE.Vector2[] = [];
    const segments = 36;
    
    // Bottom cap inner edge
    points.push(new THREE.Vector2(0, -2.1));
    points.push(new THREE.Vector2(1.15, -2.1));
    
    // Lower chamber curve (from y = -2.1 up to neck y = 0)
    for (let i = 0; i <= segments; i++) {
      const t = i / segments; // 0 to 1
      const y = -2.1 + t * 2.1;
      // Parabolic expansion then constriction to neck
      const radius = 1.25 * Math.sin(Math.PI * (1 - t * 0.92)) * (1 - t * 0.75) + 0.16;
      points.push(new THREE.Vector2(Math.max(0.16, radius), y));
    }

    // Upper chamber curve (from neck y = 0 up to y = 2.1)
    for (let i = 0; i <= segments; i++) {
      const t = i / segments; // 0 to 1
      const y = t * 2.1;
      const radius = 1.25 * Math.sin(Math.PI * (t * 0.92)) * (0.25 + t * 0.75) + 0.16;
      points.push(new THREE.Vector2(Math.max(0.16, radius), y));
    }

    // Top cap inner edge
    points.push(new THREE.Vector2(1.15, 2.1));
    points.push(new THREE.Vector2(0, 2.1));

    return new THREE.LatheGeometry(points, 28);
  }, []);

  // 2. Upper Sand Body (Cone / Inverted Geometry)
  const upperSandGeometry = useMemo(() => {
    // Upper sand fills from neck (y = 0.05) to upper height (y = 2.0)
    return new THREE.ConeGeometry(1.1, 1.9, 24, 1, false);
  }, []);

  // 3. Lower Sand Mound (Conical Heap)
  const lowerSandGeometry = useMemo(() => {
    // Lower sand mound growing from base y = -2.1 upwards
    return new THREE.ConeGeometry(1.15, 1.9, 24, 1, false);
  }, []);

  // 4. Lightweight Falling Particles System (60 grains)
  const PARTICLE_COUNT = 60;
  const { particlePositions, particleVelocities, particlePhases } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const vel = new Float32Array(PARTICLE_COUNT);
    const phases = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      // Start randomly distributed along the neck drop zone (y: 0 to -1.8)
      pos[i3] = (Math.random() - 0.5) * 0.08;
      pos[i3 + 1] = -Math.random() * 1.8;
      pos[i3 + 2] = (Math.random() - 0.5) * 0.08;

      vel[i] = 1.8 + Math.random() * 1.4; // Fall velocity
      phases[i] = Math.random() * Math.PI * 2;
    }

    return {
      particlePositions: pos,
      particleVelocities: vel,
      particlePhases: phases,
    };
  }, []);

  const particlesGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    return geo;
  }, [particlePositions]);

  // Particle circular texture for soft glowing sparks
  const particleTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.35, 'rgba(196, 181, 253, 0.9)');
      gradient.addColorStop(0.7, 'rgba(139, 92, 246, 0.4)');
      gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);
    }
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }, []);

  // Frame Loop for smooth physics and subtle idle rotation
  useFrame((state, delta) => {
    const clampedDelta = Math.min(delta, 0.05);

    // Subtle gentle floating/idle breathing rotation if running
    if (groupRef.current) {
      if (!isPaused) {
        groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.08;
      }
    }

    // Dynamic Sand Levels Calculation
    const topRatio = Math.max(0, 1 - progress);
    const bottomRatio = Math.min(1, progress);

    // Upper Sand: height scales with topRatio and position adjusts
    if (upperSandRef.current) {
      if (topRatio <= 0.005) {
        upperSandRef.current.visible = false;
      } else {
        upperSandRef.current.visible = true;
        // Scale height and radius
        const scaleY = Math.max(0.01, topRatio);
        const scaleXZ = Math.max(0.05, Math.pow(topRatio, 0.4));
        upperSandRef.current.scale.set(scaleXZ, scaleY, scaleXZ);
        // Position: cone apex is at neck y=0.05, base is top
        const height = 1.9 * scaleY;
        upperSandRef.current.position.y = 0.05 + height / 2;
      }
    }

    // Lower Sand Mound: height and spread grow with bottomRatio
    const lowerPeakY = -2.1 + bottomRatio * 1.65;
    if (lowerSandRef.current) {
      if (bottomRatio <= 0.005) {
        lowerSandRef.current.visible = false;
      } else {
        lowerSandRef.current.visible = true;
        const scaleY = Math.max(0.02, bottomRatio);
        const scaleXZ = Math.min(1, 0.3 + bottomRatio * 0.7);
        lowerSandRef.current.scale.set(scaleXZ, scaleY, scaleXZ);
        const height = 1.9 * scaleY;
        lowerSandRef.current.position.y = -2.1 + height / 2;
      }
    }

    // Stream line scaling between neck and lower mound peak
    if (streamRef.current) {
      if (isStreaming) {
        streamRef.current.visible = true;
        const streamLength = Math.max(0.1, 0 - lowerPeakY);
        streamRef.current.scale.set(1, streamLength / 2, 1);
        streamRef.current.position.y = -streamLength / 2;
        // Minor pulse
        const pulse = 0.85 + Math.sin(state.clock.elapsedTime * 15) * 0.15;
        (streamRef.current.material as THREE.MeshBasicMaterial).opacity = 0.85 * pulse;
      } else {
        streamRef.current.visible = false;
      }
    }

    // Animate falling sand particle stream
    if (particlesRef.current && isStreaming) {
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        // Move downward
        positions[i3 + 1] -= particleVelocities[i] * clampedDelta;

        // Minor horizontal jitter
        positions[i3] += Math.sin(state.clock.elapsedTime * 8 + particlePhases[i]) * 0.001;
        positions[i3 + 2] += Math.cos(state.clock.elapsedTime * 8 + particlePhases[i]) * 0.001;

        // If particle reaches the lower mound peak, respawn at neck
        if (positions[i3 + 1] <= lowerPeakY) {
          positions[i3 + 1] = 0.02 - Math.random() * 0.08;
          positions[i3] = (Math.random() - 0.5) * 0.05;
          positions[i3 + 2] = (Math.random() - 0.5) * 0.05;
        }
      }

      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* ----------------- STAND / PEDESTALS ----------------- */}
      {/* Top Cap Pedestal */}
      <mesh position={[0, 2.18, 0]}>
        <cylinderGeometry args={[1.45, 1.45, 0.16, 28]} />
        <meshStandardMaterial
          color="#161C2C"
          metalness={0.75}
          roughness={0.25}
          emissive="#2A1B4E"
          emissiveIntensity={0.2}
        />
      </mesh>
      {/* Top Cap Metallic Rim Bevel */}
      <mesh position={[0, 2.1, 0]}>
        <torusGeometry args={[1.35, 0.04, 12, 28]} />
        <meshStandardMaterial color="#A78BFA" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Bottom Cap Pedestal */}
      <mesh position={[0, -2.18, 0]}>
        <cylinderGeometry args={[1.45, 1.45, 0.16, 28]} />
        <meshStandardMaterial
          color="#161C2C"
          metalness={0.75}
          roughness={0.25}
          emissive="#2A1B4E"
          emissiveIntensity={0.2}
        />
      </mesh>
      {/* Bottom Cap Metallic Rim Bevel */}
      <mesh position={[0, -2.1, 0]}>
        <torusGeometry args={[1.35, 0.04, 12, 28]} />
        <meshStandardMaterial color="#A78BFA" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* 3 Outer Vertical Support Brass Columns for realistic classic frame */}
      {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((angle, idx) => (
        <mesh
          key={idx}
          position={[Math.cos(angle) * 1.35, 0, Math.sin(angle) * 1.35]}
        >
          <cylinderGeometry args={[0.04, 0.04, 4.3, 12]} />
          <meshStandardMaterial
            color="#252D42"
            metalness={0.85}
            roughness={0.2}
            emissive="#3B256B"
            emissiveIntensity={0.15}
          />
        </mesh>
      ))}

      {/* ----------------- UPPER SAND BODY ----------------- */}
      <mesh
        ref={upperSandRef}
        geometry={upperSandGeometry}
        rotation={[Math.PI, 0, 0]} // Pointing downward towards neck
        position={[0, 1.0, 0]}
      >
        <meshStandardMaterial
          color="#8B5CF6"
          emissive="#7C3AED"
          emissiveIntensity={0.65}
          roughness={0.85}
          metalness={0.1}
        />
      </mesh>

      {/* ----------------- LOWER SAND MOUND ----------------- */}
      <mesh
        ref={lowerSandRef}
        geometry={lowerSandGeometry}
        position={[0, -1.2, 0]}
      >
        <meshStandardMaterial
          color="#A78BFA"
          emissive="#8B5CF6"
          emissiveIntensity={0.6}
          roughness={0.85}
          metalness={0.1}
        />
      </mesh>

      {/* ----------------- CENTRAL STREAM RAY ----------------- */}
      <mesh ref={streamRef} position={[0, -0.9, 0]}>
        <cylinderGeometry args={[0.025, 0.035, 2, 12]} />
        <meshBasicMaterial
          color="#EDE9FE"
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* ----------------- FALLING SAND PARTICLES ----------------- */}
      {isStreaming && (
        <points ref={particlesRef} geometry={particlesGeo}>
          <pointsMaterial
            size={0.09}
            map={particleTexture}
            transparent
            opacity={0.95}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            color="#FFFFFF"
          />
        </points>
      )}

      {/* ----------------- TRANSPARENT GLASS ENVELOPE ----------------- */}
      <mesh geometry={glassGeometry}>
        <meshPhysicalMaterial
          color="#E0E7FF"
          transmission={0.92}
          opacity={0.88}
          transparent
          roughness={0.08}
          ior={1.48}
          thickness={0.4}
          reflectivity={0.6}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </mesh>

      {/* Impact Ripple Glow at Sand Mound Peak */}
      {isStreaming && (
        <pointLight
          position={[0, -0.6, 0]}
          color="#A78BFA"
          intensity={1.2}
          distance={1.5}
        />
      )}

      {/* Center Chamber Ambient Point Glow */}
      <pointLight
        position={[0, 0, 0]}
        color="#8B5CF6"
        intensity={isCompleted ? 2.2 : 1.0}
        distance={3.5}
      />
    </group>
  );
};

// -------------------------------------------------------------
// Fallback Error Boundary
// -------------------------------------------------------------
interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class HourglassErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[Hourglass3D] Fallback triggered due to WebGL error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// -------------------------------------------------------------
// Main Hourglass3D Component
// -------------------------------------------------------------
export const Hourglass3D: React.FC<Hourglass3DProps> = ({ progress, isPaused }) => {
  const [webglSupported, setWebglSupported] = useState<boolean>(true);

  useEffect(() => {
    setWebglSupported(checkWebGLSupport());
  }, []);

  // Clamped progress (0 to 1)
  const safeProgress = Math.max(0, Math.min(1, progress));

  // Fallback SVG (visual only, countdown rendered in FocusSessionScreen)
  const fallbackSvg = (
    <HourglassFocusTimer
      totalSeconds={100}
      remainingSeconds={Math.round((1 - safeProgress) * 100)}
      isPaused={isPaused}
      visualOnly={true}
    />
  );

  if (!webglSupported) {
    return fallbackSvg;
  }

  return (
    <HourglassErrorBoundary fallback={fallbackSvg}>
      <div className="relative w-full h-[230px] xs:h-[250px] sm:h-[280px] max-w-[280px] mx-auto flex items-center justify-center select-none overflow-visible">
        {/* Soft Ambient Violet Backglow */}
        <div
          className={`absolute inset-0 m-auto w-48 h-56 rounded-full bg-violet-600/25 blur-3xl pointer-events-none transition-opacity duration-700 ${
            safeProgress >= 0.999
              ? 'opacity-80'
              : isPaused
              ? 'opacity-20'
              : 'opacity-50 animate-pulse'
          }`}
        />

        <Suspense fallback={fallbackSvg}>
          <Canvas
            camera={{ position: [0, 0, 5.2], fov: 46 }}
            dpr={[1, 1.25]}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: 'high-performance',
            }}
            className="w-full h-full"
            style={{ width: '100%', height: '100%', background: 'transparent' }}
          >
            {/* Soft Ambient & Directional Lighting */}
            <ambientLight intensity={0.8} />
            <directionalLight position={[4, 5, 4]} intensity={1.4} color="#FFFFFF" />
            <directionalLight position={[-4, 3, -3]} intensity={0.6} color="#A78BFA" />
            <directionalLight position={[0, -4, 2]} intensity={0.5} color="#6D28D9" />

            <HourglassScene progress={safeProgress} isPaused={isPaused} />
          </Canvas>
        </Suspense>
      </div>
    </HourglassErrorBoundary>
  );
};
