import { Body } from "./body.js";
import { Vector2 } from "./vector2.js";
export class Scene {
    constructor(canvas = document.querySelector("canvas")) {
        this.bodies = [];
        this.running = false;
        this.lastTimestamp = null;
        this.animationFrameRequestID = null;
        this.framesLastSecond = [];
        this.settings = {
            debugView: false,
            scene: { G: 1000 },
            bodies: { mass: 100, elasticity: 0.5 },
        };
        this.debugLines = [];
        this.canvas = canvas;
        if (!this.canvas)
            throw new Error("Could not initialize scene.\nReason: Could not find Canvas DOM element.");
        this.ctx = this.canvas.getContext("2d");
        if (!this.ctx)
            throw new Error("Could not initialize scene.\nReason: Could not get rendering context from Canvas DOM element.");
        this.canvas.addEventListener("click", (event) => {
            const { offsetX, offsetY } = event;
            this.bodies.push(new Body(new Vector2(offsetX, offsetY), new Vector2(), this.settings.bodies.mass, this.settings.bodies.elasticity));
        });
        const settingsInputs = document.querySelectorAll("#settings-container > input");
        settingsInputs.forEach((input) => {
            if (input.id.includes("mass")) {
                input.addEventListener("change", () => {
                    const mass = Number(input.value);
                    this.settings.bodies.mass = mass;
                    this.updateSettings();
                });
            }
            else if (input.id.includes("grav")) {
                input.addEventListener("change", () => {
                    const G = Number(input.value);
                    this.settings.scene.G = G;
                });
            }
            else if (input.id.includes("elasticity")) {
                input.addEventListener("change", () => {
                    const elasticity = Number(input.value);
                    this.settings.bodies.elasticity = elasticity;
                    this.updateSettings();
                });
            }
            else if (input.id.includes("debug")) {
                input.addEventListener("change", () => {
                    const debugView = input.checked;
                    this.settings.debugView = debugView;
                });
            }
        });
    }
    get fps() {
        return this.framesLastSecond.length;
    }
    get width() {
        return this.canvas.width;
    }
    get height() {
        return this.canvas.height;
    }
    updateSettings() {
        console.log("Updating settings...");
        console.log(this.settings);
        for (const body of this.bodies) {
            body.mass = this.settings.bodies.mass;
            body.elasticity = this.settings.bodies.elasticity;
        }
    }
    tick(timestamp) {
        while (this.framesLastSecond.length > 0 &&
            this.framesLastSecond[0] <= timestamp - 1000) {
            this.framesLastSecond.shift();
        }
        this.framesLastSecond.push(timestamp);
        if (!this.running)
            return;
        if (this.lastTimestamp === null) {
            this.lastTimestamp = timestamp;
        }
        const dt = (timestamp - this.lastTimestamp) / 1000;
        this.lastTimestamp = timestamp;
        this.update(dt);
        this.draw();
        this.animationFrameRequestID = requestAnimationFrame((ts) => this.tick(ts));
    }
    update(dt) {
        if (this.settings.debugView) {
            this.debugLines = [];
        }
        for (let i = 0; i < this.bodies.length; i++) {
            for (let j = i + 1; j < this.bodies.length; j++) {
                const b1 = this.bodies[i];
                const b2 = this.bodies[j];
                const displacement = b2.position.toSubtracted(b1.position);
                const direction = displacement.toNormalized();
                let distance = displacement.magnitudeSquared;
                if (distance === 0)
                    continue;
                // TEST: Gravitational softening
                const softening = 5;
                distance = Math.sqrt(distance + softening ** 2);
                // const distance: number = Math.max(5, displacement.magnitude);
                const force = this.settings.scene.G * ((b1.mass * b2.mass) / distance ** 2);
                const fx = force * direction.x;
                const fy = force * direction.y;
                if (this.settings.debugView) {
                    this.debugLines.push([b1.position, b2.position, force]);
                }
                b1.vx += (fx / b1.mass) * dt;
                b1.vy += (fy / b1.mass) * dt;
                b2.vx -= (fx / b2.mass) * dt;
                b2.vy -= (fy / b2.mass) * dt;
            }
        }
        for (const body of this.bodies) {
            body.x += body.vx * dt;
            body.y += body.vy * dt;
            if (body.x > this.width) {
                body.x = this.width;
                body.velocity.invertX().scale(body.elasticity);
            }
            else if (body.x < 0) {
                body.x = 0;
                body.velocity.invertX().scale(body.elasticity);
            }
            if (body.y > this.height) {
                body.y = this.height;
                body.velocity.invertY().scale(body.elasticity);
            }
            else if (body.y < 0) {
                body.y = 0;
                body.velocity.invertY().scale(body.elasticity);
            }
        }
    }
    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = "white";
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = "green";
        this.ctx.font = "16px monospace";
        this.ctx.fillText("FPS: " + String(this.fps), 5, 20);
        this.ctx.fillText("Number of bodies: " + String(this.bodies.length), 5, 40);
        this.ctx.fillStyle = "black";
        for (const body of this.bodies) {
            const size = 5;
            this.ctx.beginPath();
            this.ctx.arc(body.x, body.y, size, 0, 2 * Math.PI);
            this.ctx.fill();
            if (this.settings.debugView) {
                this.ctx.font = "10px monospace";
                this.ctx.fillText(`(${body.x.toPrecision(3)}, ${body.y.toPrecision(3)})`, body.x + 6, body.y);
                this.ctx.fillText(`(${body.vx.toPrecision(3)}, ${body.vy.toPrecision(3)})`, body.x + 6, body.y + 10);
            }
        }
        if (this.settings.debugView) {
            for (const debugLine of this.debugLines) {
                this.ctx.beginPath();
                const b1 = debugLine[0];
                const b2 = debugLine[1];
                const force = debugLine[2];
                this.ctx.strokeStyle = `rgba(0,0,0,${Math.min(1, Math.log10(force) / 3)})`;
                this.ctx.moveTo(b1.x, b1.y);
                this.ctx.lineTo(b2.x, b2.y);
                this.ctx.stroke();
            }
        }
    }
    play() {
        if (this.running)
            return;
        this.running = true;
        this.lastTimestamp = null;
        this.animationFrameRequestID = requestAnimationFrame((ts) => this.tick(ts));
    }
    pause() {
        if (!this.running)
            return;
        this.running = false;
        if (this.animationFrameRequestID !== null) {
            cancelAnimationFrame(this.animationFrameRequestID);
            this.animationFrameRequestID = null;
        }
    }
}
