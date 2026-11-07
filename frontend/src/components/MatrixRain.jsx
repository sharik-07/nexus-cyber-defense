import { useEffect, useRef } from "react";

export default function MatrixRain() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c.getContext("2d");
    const size = 16;
    const chars = "01{}<>/|$#@%&*+=ABCDEF";
    let drops = [];
    let raf = 0;
    let last = 0;
    const resize = () => {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
      drops = Array.from({ length: Math.floor(c.width / size) }, () => Math.random() * (c.height / size));
    };
    const draw = (t) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 60) return;
      last = t;
      ctx.fillStyle = "rgba(5,8,13,0.12)";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = "#39ff88";
      ctx.font = `${size}px monospace`;
      drops.forEach((y, i) => {
        ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * size, y * size);
        drops[i] = y * size > c.height && Math.random() > 0.975 ? 0 : y + 1;
      });
    };
    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 opacity-[0.12]" />;
}