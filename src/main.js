import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';

import { createWorld } from './world.js';
import { setupControls } from './controls.js';
import { setupNetworking } from './networking.js';

// Setup Renderer
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
// Cap pixel ratio to 1. This provides a massive FPS boost on high-DPI/Retina screens,
// and perfectly matches the low-res, crunchy VHS aesthetic of a 90s camcorder.
renderer.setPixelRatio(1);
// Set tone mapping for harsher lighting
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Setup Scene & Camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
// Removed fog per user request
// scene.fog = new THREE.FogExp2(0xcaba96, 0.08); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(2.5, 1.35, 2.5); // Spawn in the middle of the first room, avoiding walls
camera.rotation.order = 'YXZ'; // MUST ADD THIS!
// Local Flashlight
const flashlight = new THREE.SpotLight(0xfff5b6, 20.0); // Warm yellow, very bright
flashlight.angle = Math.PI / 5; // 36 degrees spread
flashlight.penumbra = 0.5; // Soft edges
flashlight.decay = 2;
flashlight.distance = 30; // Shines 30 meters
flashlight.position.set(0, 0, 0); // Positioned at the camera
flashlight.castShadow = true;
flashlight.shadow.camera.near = 0.5;
flashlight.shadow.camera.far = 15; // Limit shadow rendering distance for performance
flashlight.shadow.bias = -0.001; // Reduce shadow acne

const flashTarget = new THREE.Object3D();
flashTarget.position.set(0, 0, -1); // Pointing forward from the camera
camera.add(flashlight);
camera.add(flashTarget);
flashlight.target = flashTarget;

scene.add(camera); // Must add camera to scene for its attached lights to work

// Setup Post-Processing (The VHS/Backrooms Filter)
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// FilmPass(noiseIntensity, scanlinesIntensity, scanlinesCount, grayscale)
// Increased noise and scanline intensity to replicate the heavy VHS static using the ultra-fast GPU shader instead of CSS
const filmPass = new FilmPass(1.5, 0.6, 256, false);
composer.addPass(filmPass);

// Initialize Game Systems
const audioListener = new THREE.AudioListener();
camera.add(audioListener);

const world = createWorld(scene);
const controls = setupControls(camera, document.body);
const networking = setupNetworking(scene, camera, audioListener);

// Chat Input Handling
const chatInput = document.getElementById('chat-input');
document.addEventListener('keydown', (event) => {
  if (event.code === 'Enter') {
    if (controls.isLocked()) {
      // Unlock mouse to type
      document.exitPointerLock();
      chatInput.style.display = 'block';
      setTimeout(() => chatInput.focus(), 10); // Small delay to ensure display:block applies
    } else if (document.activeElement === chatInput) {
      // Send message and hide
      const msg = chatInput.value.trim();
      if (msg) {
        networking.sendChatMessage(msg);
      }
      chatInput.value = '';
      chatInput.style.display = 'none';
      chatInput.blur();
    }
  }
});

// Handle Window Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// Sound Design: Synthesized Fluorescent Hum
let audioStarted = false;
document.body.addEventListener('click', () => {
  if (audioStarted) return;
  audioStarted = true;
  
  if (audioListener.context.state === 'suspended') {
    audioListener.context.resume();
  }
  
  const ctx = audioListener.context;
  
  // Base 60Hz electrical hum using a sawtooth wave for extra "buzz"
  const osc1 = ctx.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.value = 60;
  
  // 120Hz harmonic, slightly detuned (120.5Hz) to create a subtle, unsettling phasing effect
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = 120.5; 
  
  // Lowpass filter to muffle the harsh high-frequencies of the sawtooth, making it sound distant/ambient
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 180; 
  
  // Volume control
  const gainNode = ctx.createGain();
  gainNode.gain.value = 0.04; // Lowered significantly per user request so breathing can be heard clearly
  
  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  osc1.start();
  osc2.start();

  // Load custom player sounds and unlock them for programmatic playback
  window.idleAudio = new Audio('/player_idle1.m4a');
  window.idleAudio.loop = true;
  window.idleAudio.volume = 0.8;

  window.walkingAudio = new Audio('/player_walking1.m4a');
  window.walkingAudio.loop = true;
  window.walkingAudio.volume = 0.8;

  window.runningAudio = new Audio('/player_running1.m4a');
  window.runningAudio.loop = true;
  window.runningAudio.volume = 1.0;

  // New Footstep Sounds
  window.movementWalkingAudio1 = new Audio('/movement_walking1.wav');
  window.movementWalkingAudio1.loop = true;
  window.movementWalkingAudio1.volume = 0.8;

  window.movementWalkingAudio2 = new Audio('/movement_walking2.wav');
  window.movementWalkingAudio2.loop = true;
  window.movementWalkingAudio2.volume = 0.8;

  window.movementRunningAudio = new Audio('/movement_running1.wav');
  window.movementRunningAudio.loop = true;
  window.movementRunningAudio.volume = 1.0;

  // Play and immediately pause to unlock the audio elements during this click event
  window.idleAudio.play().then(() => window.idleAudio.pause()).catch(e => console.error(e));
  window.walkingAudio.play().then(() => window.walkingAudio.pause()).catch(e => console.error(e));
  window.runningAudio.play().then(() => window.runningAudio.pause()).catch(e => console.error(e));
  window.movementWalkingAudio1.play().then(() => window.movementWalkingAudio1.pause()).catch(e => console.error(e));
  window.movementWalkingAudio2.play().then(() => window.movementWalkingAudio2.pause()).catch(e => console.error(e));
  window.movementRunningAudio.play().then(() => window.movementRunningAudio.pause()).catch(e => console.error(e));
});

// Main Game Loop
const clock = new THREE.Clock();

let frameCount = 0;
let lastFpsTime = performance.now();
let fpsElement = null;

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const time = clock.getElapsedTime() * 1000;

  controls.update(delta);
  networking.update(time);
  world.updateWorld(camera.position);

  // Use composer instead of renderer for post-processing
  composer.render();
  
  // Update FPS Counter
  const now = performance.now();
  frameCount++;
  if (now - lastFpsTime >= 1000) {
    if (!fpsElement) fpsElement = document.getElementById('hud-fps');
    if (fpsElement) fpsElement.innerText = frameCount + ' FPS';
    frameCount = 0;
    lastFpsTime = now;
  }
}

animate();
