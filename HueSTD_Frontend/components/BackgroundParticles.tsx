import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  glow: string;
}

const BackgroundParticles: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const pointerActiveRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const createParticles = () => {
      const count = 90;
      const palette = ['#22d3ee', '#60a5fa', '#a78bfa', '#f472b6', '#facc15'];
      const particles: Particle[] = [];
      for (let i = 0; i < count; i++) {
        const baseColor = palette[Math.floor(Math.random() * palette.length)];
        const alpha = 0.35 + Math.random() * 0.45;
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.7,
          vy: (Math.random() - 0.5) * 0.7,
          radius: Math.random() * 2.8 + 1.2,
          color: `${baseColor}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`,
          glow: baseColor,
        });
      }
      return particles;
    };

    let particles = createParticles();

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      pointerActiveRef.current = true;
    };

    const handleMouseLeave = () => {
      pointerActiveRef.current = false;
    };

    const updateParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        const dx = mouseRef.current.x - p.x;
        const dy = mouseRef.current.y - p.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const isNearPointer = pointerActiveRef.current && distance < 260;

        ctx.save();
        ctx.shadowBlur = isNearPointer ? 24 : 12;
        ctx.shadowColor = p.glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, isNearPointer ? p.radius * 1.7 : p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.restore();

        if (isNearPointer) {
          const force = 0.028 * (1 - distance / 260);
          p.vx += (dx / Math.max(distance, 1)) * force;
          p.vy += (dy / Math.max(distance, 1)) * force;
        }

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.965;
        p.vy *= 0.965;

        if (p.x < -20) p.x = canvas.width + 20;
        if (p.x > canvas.width + 20) p.x = -20;
        if (p.y < -20) p.y = canvas.height + 20;
        if (p.y > canvas.height + 20) p.y = -20;
      }

      requestAnimationFrame(updateParticles);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    particles = createParticles();
    updateParticles();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
};

export default BackgroundParticles;