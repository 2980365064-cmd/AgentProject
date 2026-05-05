// src/components/MedicalParticles.jsx

import { useEffect, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadFull } from "tsparticles";

const MedicalParticles = () => {
    const [init, setInit] = useState(false);

    useEffect(() => {
        initParticlesEngine(async (engine) => {
            await loadFull(engine);
        }).then(() => {
            setInit(true);
        });
    }, []);

    const options = {
        fullScreen: { 
            enable: true,
            zIndex: 0 
        },
        background: {
            color: { value: "transparent" }, 
        },
        fpsLimit: 120,
        interactivity: {
            events: {
                onHover: { 
                    enable: true, 
                    mode: "repulse" 
                },
                resize: true,
            },
            modes: {
                repulse: { 
                    distance: 150, 
                    duration: 0.4 
                },
                grab: {
                    distance: 200,
                    links: {
                        opacity: 0.5
                    }
                }
            },
        },
        particles: {
            color: { 
                value: ["#cdcdd1", "#cfcdcd", "#ced1d0", "#e4e3e3", "#e1e2fa"] 
            }, 
            links: { 
                enable: true,
                color: "#f0f0f0",
                distance: 150,
                opacity: 0.2,
                width: 1,
                triangles: {
                    enable: true,
                    opacity: 0.05
                }
            }, 
            move: {
                direction: "none",
                enable: true,
                outModes: { 
                    default: "bounce" 
                },
                random: true,
                speed: 2, 
                straight: false,
                attract: {
                    enable: true,
                    rotateX: 600,
                    rotateY: 600
                }
            },
            number: {
                density: { 
                    enable: true, 
                    area: 600 
                },
                value: 120,
                limit: 150
            },
            opacity: {
                value: 0.5,
                random: true,
                animation: {
                    enable: true,
                    speed: 1,
                    minimumValue: 0.1,
                    sync: false
                }
            },
            shape: {
                type: ["circle", "square", "triangle", "polygon"],
                options: {
                    polygon: {
                        sides: 6
                    }
                }
            },
            size: {
                value: { min: 2, max: 8 },
                random: true,
                animation: {
                    enable: true,
                    speed: 3,
                    minimumValue: 1,
                    sync: false
                }
            },
            twinkle: {
                particles: {
                    enable: true,
                    frequency: 0.05,
                    opacity: 0.5
                }
            },
            lineLinked: {
                enable: true,
                opacity: 0.1
            }
        },
        detectRetina: true,
    };

    if (init) {
        return <Particles id="tsparticles" options={options} />;
    }

    return null;
};

export default MedicalParticles;