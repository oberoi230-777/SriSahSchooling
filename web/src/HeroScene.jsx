import * as THREE from 'three';
import { BookOpenCheck } from 'lucide-react';
import { useEffect, useRef } from 'react';

/**
 * A small, decorative learning mandala. Three.js is loaded only when this scene becomes
 * visible, renders at a capped resolution, pauses off-screen, and falls back to CSS when
 * WebGL is unavailable. No controls or information are hidden inside the canvas.
 */
export default function HeroScene() {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return undefined;

    let cancelled = false;
    let ready = false;
    let inView = true;
    let frameId = 0;
    let renderer;
    let scene;
    let camera;
    let sculpture;
    let orbiters = [];
    let resizeObserver;
    let intersectionObserver;
    let previousTime = 0;
    let targetX = 0;
    let targetY = 0;
    let reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');

    const sizeRenderer = () => {
      if (!renderer || !host) return;
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, width < 520 ? 1.15 : 1.5);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      drawStaticFrame();
    };

    const drawStaticFrame = () => {
      if (renderer && scene && camera) renderer.render(scene, camera);
    };

    const stop = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
    };

    const render = (time) => {
      frameId = 0;
      if (cancelled || !ready || !inView || document.hidden) return;
      const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.04) : 0;
      previousTime = time;
      if (!reducedMotion) {
        sculpture.rotation.y += delta * 0.13;
        sculpture.rotation.x += (targetX - sculpture.rotation.x) * Math.min(1, delta * 2.5);
        sculpture.rotation.z += (targetY - sculpture.rotation.z) * Math.min(1, delta * 2.5);
        orbiters.forEach((orbiter) => {
          orbiter.object.position.set(
            Math.cos(time * orbiter.speed + orbiter.offset) * orbiter.radius,
            Math.sin(time * orbiter.speed + orbiter.offset) * orbiter.radius * 0.72,
            Math.sin(time * orbiter.speed * 0.68 + orbiter.offset) * 0.38,
          );
        });
      }
      renderer.render(scene, camera);
      if (!reducedMotion) frameId = window.requestAnimationFrame(render);
    };

    const start = () => {
      if (!ready || cancelled || !inView || document.hidden) return;
      previousTime = 0;
      if (reducedMotion) drawStaticFrame();
      else if (!frameId) frameId = window.requestAnimationFrame(render);
    };

    const onPointerMove = (event) => {
      if (reducedMotion) return;
      const bounds = host.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5;
      const y = (event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5;
      targetX = Math.max(-0.22, Math.min(0.22, y * -0.28));
      targetY = Math.max(-0.18, Math.min(0.18, x * 0.2));
    };
    const onPointerLeave = () => { targetX = 0; targetY = 0; };
    const onVisibility = () => { if (document.hidden) stop(); else start(); };
    const onMotionChange = (event) => {
      reducedMotion = event.matches;
      if (reducedMotion) {
        stop();
        drawStaticFrame();
      } else start();
    };

    const initialize = () => {
      try {
        if (cancelled) return;
        renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: window.innerWidth > 600,
          powerPreference: 'low-power',
        });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;
        renderer.setClearColor(0x000000, 0);
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
        camera.position.set(0, 0, 6.3);
        scene.add(new THREE.AmbientLight(0xf9e9c8, 1.8));
        const keyLight = new THREE.PointLight(0xf6d38b, 24, 20);
        keyLight.position.set(-2.5, 3, 5);
        scene.add(keyLight);
        const violetLight = new THREE.PointLight(0x9161e8, 18, 18);
        violetLight.position.set(3, -2, 2);
        scene.add(violetLight);

        sculpture = new THREE.Group();
        scene.add(sculpture);

        const heartGeometry = new THREE.IcosahedronGeometry(0.72, 2);
        const heartMaterial = new THREE.MeshPhysicalMaterial({
          color: 0x7042bf,
          metalness: 0.36,
          roughness: 0.28,
          clearcoat: 0.85,
          clearcoatRoughness: 0.18,
          emissive: 0x241044,
          emissiveIntensity: 0.34,
        });
        const heart = new THREE.Mesh(heartGeometry, heartMaterial);
        sculpture.add(heart);

        const wireGeometry = new THREE.IcosahedronGeometry(0.78, 1);
        const wireMaterial = new THREE.MeshBasicMaterial({ color: 0xe8c77e, wireframe: true, transparent: true, opacity: 0.42 });
        sculpture.add(new THREE.Mesh(wireGeometry, wireMaterial));

        const ringSpecs = [
          { radius: 1.28, color: 0xe7c67e, tilt: [0.54, 0.16, 0.16], opacity: 0.62 },
          { radius: 1.62, color: 0xbba3ec, tilt: [1.08, 0.2, -0.32], opacity: 0.42 },
          { radius: 1.92, color: 0xe7c67e, tilt: [0.18, 0.78, 0.12], opacity: 0.28 },
        ];
        ringSpecs.forEach(({ radius, color, tilt, opacity }, index) => {
          const ringGeometry = new THREE.TorusGeometry(radius, index === 0 ? 0.012 : 0.008, 8, 160);
          const ringMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity });
          const ring = new THREE.Mesh(ringGeometry, ringMaterial);
          ring.rotation.set(...tilt);
          sculpture.add(ring);
        });

        const seedGeometry = new THREE.OctahedronGeometry(0.16, 1);
        const seedMaterial = new THREE.MeshPhysicalMaterial({ color: 0xf3d38c, metalness: 0.42, roughness: 0.22, emissive: 0x6e4b1c, emissiveIntensity: 0.22 });
        const seed = new THREE.Mesh(seedGeometry, seedMaterial);
        seed.scale.set(0.8, 1.15, 0.45);
        seed.rotation.set(0.42, 0.12, 0.72);
        sculpture.add(seed);

        const orbGeometry = new THREE.SphereGeometry(0.055, 12, 10);
        orbiters = [
          { radius: 1.36, speed: 0.00035, offset: 0, object: new THREE.Mesh(orbGeometry, new THREE.MeshBasicMaterial({ color: 0xf5d995 })) },
          { radius: 1.68, speed: -0.00024, offset: 2.3, object: new THREE.Mesh(orbGeometry, new THREE.MeshBasicMaterial({ color: 0xc6adf1 })) },
          { radius: 1.88, speed: 0.00017, offset: 4.6, object: new THREE.Mesh(orbGeometry, new THREE.MeshBasicMaterial({ color: 0xf5d995 })) },
        ];
        orbiters.forEach(({ object }) => sculpture.add(object));

        const starCount = window.innerWidth < 600 ? 220 : 360;
        const starPositions = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount; i += 1) {
          const index = i * 3;
          starPositions[index] = (Math.random() - 0.5) * 7.6;
          starPositions[index + 1] = (Math.random() - 0.5) * 6.2;
          starPositions[index + 2] = (Math.random() - 0.5) * 3 - 1.4;
        }
        const starGeometry = new THREE.BufferGeometry();
        starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        const starMaterial = new THREE.PointsMaterial({ color: 0xf4dfb1, size: 0.018, transparent: true, opacity: 0.72, sizeAttenuation: true });
        const stars = new THREE.Points(starGeometry, starMaterial);
        scene.add(stars);

        resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sizeRenderer) : null;
        resizeObserver?.observe(host);
        if (!resizeObserver) window.addEventListener('resize', sizeRenderer, { passive: true });
        sizeRenderer();
        host.classList.add('site-scene-ready');
        ready = true;
        start();
      } catch {
        if (!cancelled) host.classList.add('site-scene-fallback-only');
      }
    };

    if (typeof IntersectionObserver === 'undefined') {
      inView = true;
    } else {
      inView = false;
      intersectionObserver = new IntersectionObserver((entries) => {
        inView = Boolean(entries[0]?.isIntersecting);
        if (inView) start();
        else stop();
      }, { rootMargin: '100px', threshold: 0.01 });
      intersectionObserver.observe(host);
    }

    host.addEventListener('pointermove', onPointerMove, { passive: true });
    host.addEventListener('pointerleave', onPointerLeave, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    motionQuery?.addEventListener?.('change', onMotionChange);
    // MediaQueryList's legacy listener remains for older Safari versions.
    if (motionQuery && !motionQuery.addEventListener) motionQuery.addListener(onMotionChange);
    initialize();

    return () => {
      cancelled = true;
      stop();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener('resize', sizeRenderer);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery?.removeEventListener?.('change', onMotionChange);
      if (motionQuery && !motionQuery.removeEventListener) motionQuery.removeListener(onMotionChange);
      if (scene) {
        scene.traverse((object) => {
          object.geometry?.dispose?.();
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
          else object.material?.dispose?.();
        });
      }
      renderer?.dispose();
    };
  }, []);

  return (
    <div className="site-scene-host" ref={hostRef}>
      <canvas ref={canvasRef} className="site-scene-canvas" aria-hidden="true" />
      <div className="site-scene-fallback" aria-hidden="true">
        <div className="site-scene-fallback-orbit site-scene-fallback-orbit-a" />
        <div className="site-scene-fallback-orbit site-scene-fallback-orbit-b" />
        <div className="site-scene-fallback-core"><span><BookOpenCheck size={38} strokeWidth={1.2} /></span></div>
        <i className="site-scene-fallback-star site-scene-fallback-star-a" />
        <i className="site-scene-fallback-star site-scene-fallback-star-b" />
        <i className="site-scene-fallback-star site-scene-fallback-star-c" />
      </div>
    </div>
  );
}
