import type { ISourceOptions } from "@tsparticles/engine";

const particlesConfig: ISourceOptions = {
  fullScreen: { enable: true, zIndex: 0 },
  background: { color: { value: "transparent" } },
  detectRetina: true,
  fpsLimit: 60,
  particles: {
    number: { value: 45, density: { enable: true, area: 1000 } },
    color: { value: ["#ffffff", "#c7d2fe", "#a5f3fc", "#fbcfe8"] },
    shape: { type: "circle" },
    opacity: { value: { min: 0.15, max: 0.45 } },
    size: { value: { min: 1, max: 4 } },
    move: {
      enable: true,
      speed: { min: 0.2, max: 0.9 },
      direction: "none",
      outModes: { default: "out" },
    },
  },
  interactivity: {
    events: {
      onHover: { enable: true, mode: ["attract", "bubble"] },
      resize: { enable: true },
    },
    modes: {
      attract: {
        distance: 220,
        duration: 0.4,
        factor: 2,
        speed: 0.7,
      },
      bubble: {
        distance: 180,
        size: 6,
        duration: 1.4,
        opacity: 0.65,
      },
    },
  },
};

export default particlesConfig;
