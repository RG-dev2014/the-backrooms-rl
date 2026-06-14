import * as THREE from 'three';
import { getWallData } from './worldGen.js';

export function setupControls(camera, domElement) {
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const PI_2 = Math.PI / 2;
  let isLocked = false;
  let hudDbElement = document.getElementById('hud-db');
  let dbUpdateTime = 0;

  const onMouseMove = (event) => {
    if (!isLocked) return;

    const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

    euler.setFromQuaternion(camera.quaternion);

    euler.y -= movementX * 0.002;
    euler.x -= movementY * 0.002;

    euler.x = Math.max(-PI_2, Math.min(PI_2, euler.x));

    camera.quaternion.setFromEuler(euler);
  };

  const onPointerlockChange = () => {
    if (document.pointerLockElement === domElement) {
      isLocked = true;
      document.getElementById('ui').style.display = 'none';
      document.getElementById('crosshair').style.display = 'block';
      const hud = document.getElementById('hud');
      if(hud) hud.style.display = 'block';
    } else {
      isLocked = false;
      document.getElementById('ui').style.display = 'block';
      document.getElementById('crosshair').style.display = 'none';
      const hud = document.getElementById('hud');
      if(hud) hud.style.display = 'none';
    }
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('pointerlockchange', onPointerlockChange);

  domElement.addEventListener('click', () => {
    domElement.requestPointerLock();
  });

  // Keyboard state
  const keys = { w: false, a: false, s: false, d: false, shift: false };

  document.addEventListener('keydown', (event) => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    switch (event.code) {
      case 'KeyW': keys.w = true; break;
      case 'KeyA': keys.a = true; break;
      case 'KeyS': keys.s = true; break;
      case 'KeyD': keys.d = true; break;
      case 'ShiftLeft':
      case 'ShiftRight': keys.shift = true; break;
    }
  });

  document.addEventListener('keyup', (event) => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') {
      // Clear movement keys just in case
      keys.w = false; keys.a = false; keys.s = false; keys.d = false; keys.shift = false;
      return;
    }
    switch (event.code) {
      case 'KeyW': keys.w = false; break;
      case 'KeyA': keys.a = false; break;
      case 'KeyS': keys.s = false; break;
      case 'KeyD': keys.d = false; break;
      case 'ShiftLeft':
      case 'ShiftRight': keys.shift = false; break;
    }
  });

  // Movement Logic
  const velocity = new THREE.Vector3();
  const direction = new THREE.Vector3();
  
  window.resetVelocity = () => {
    velocity.set(0, 0, 0);
  };

  const update = (delta) => {
    if (!isLocked) return;

    direction.z = Number(keys.w) - Number(keys.s); // W is +1, S is -1
    direction.x = Number(keys.d) - Number(keys.a); // D is +1, A is -1
    direction.normalize(); // Ensure consistent speed in all directions

    const speed = keys.shift ? 75.0 : 35.0; // Sprint speed vs walk speed

    if (keys.w || keys.s) velocity.z -= direction.z * speed * delta; // W makes Z negative (forward)
    if (keys.a || keys.d) velocity.x += direction.x * speed * delta; // D makes X positive (right)

    // Apply friction/damping
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;

    const oldPos = camera.position.clone();
    
    // Move X axis (relative to rotation)
    camera.translateX(velocity.x * delta);
    camera.position.y = 1.35;
    
    const roomSize = 5;
    const wallHeight = 3;
    const wallThickness = 0.2;
    const xSize = new THREE.Vector3(roomSize + wallThickness, wallHeight, wallThickness);
    const zSize = new THREE.Vector3(wallThickness, wallHeight, roomSize + wallThickness);

    const px = Math.floor(camera.position.x / roomSize);
    const pz = Math.floor(camera.position.z / roomSize);

    const dynamicWallBoxes = [];
    for(let dx = -1; dx <= 1; dx++) {
      for(let dz = -1; dz <= 1; dz++) {
        const cx = px + dx;
        const cz = pz + dz;
        const data = getWallData(cx, cz);
        
        if (data.northWall) {
          const center = new THREE.Vector3(cx * roomSize + roomSize / 2, wallHeight / 2, cz * roomSize);
          const box = new THREE.Box3().setFromCenterAndSize(center, xSize);
          dynamicWallBoxes.push(box);
        }
        if (data.westWall) {
          const center = new THREE.Vector3(cx * roomSize, wallHeight / 2, cz * roomSize + roomSize / 2);
          const box = new THREE.Box3().setFromCenterAndSize(center, zSize);
          dynamicWallBoxes.push(box);
        }
      }
    }

    const playerBox = new THREE.Box3();
    const playerSize = new THREE.Vector3(0.6, 2.0, 0.6); // 0.6m wide/thick player
    
    playerBox.setFromCenterAndSize(camera.position, playerSize);
    for (const box of dynamicWallBoxes) {
      if (playerBox.intersectsBox(box)) {
        camera.position.copy(oldPos); // Revert X movement completely
        velocity.x = 0;
        break;
      }
    }

    const midPos = camera.position.clone();

    // Move Z axis (relative to rotation)
    camera.translateZ(velocity.z * delta);
    camera.position.y = 1.35;
    
    playerBox.setFromCenterAndSize(camera.position, playerSize);
    for (const box of dynamicWallBoxes) {
      if (playerBox.intersectsBox(box)) {
        camera.position.copy(midPos); // Revert Z movement
        velocity.z = 0;
        break;
      }
    }
    // Update audio level (dB) and Player Movement Sounds
    const currentSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
    const isMoving = currentSpeed > 2.0;

    // Manage custom audio tracks
    if (window.walkingAudio && window.runningAudio && window.idleAudio) {
      if (isMoving) {
        if (!window.idleAudio.paused) window.idleAudio.pause();
        
        if (keys.shift) {
          if (!window.walkingAudio.paused) window.walkingAudio.pause();
          if (window.movementWalkingAudio1 && !window.movementWalkingAudio1.paused) window.movementWalkingAudio1.pause();
          if (window.movementWalkingAudio2 && !window.movementWalkingAudio2.paused) window.movementWalkingAudio2.pause();

          if (window.runningAudio.paused) window.runningAudio.play().catch(e=>{});
          if (window.movementRunningAudio && window.movementRunningAudio.paused) window.movementRunningAudio.play().catch(e=>{});
        } else {
          if (!window.runningAudio.paused) window.runningAudio.pause();
          if (window.movementRunningAudio && !window.movementRunningAudio.paused) window.movementRunningAudio.pause();

          if (window.walkingAudio.paused) window.walkingAudio.play().catch(e=>{});
          
          if (window.movementWalkingAudio1 && window.movementWalkingAudio2) {
             if (window.movementWalkingAudio1.paused && window.movementWalkingAudio2.paused) {
                // We just started walking. 50/50 chance of picking sound 1 or 2
                if (Math.random() < 0.5) {
                   window.movementWalkingAudio1.play().catch(e=>{});
                } else {
                   window.movementWalkingAudio2.play().catch(e=>{});
                }
             }
          }
        }
      } else {
        if (!window.walkingAudio.paused) window.walkingAudio.pause();
        if (!window.runningAudio.paused) window.runningAudio.pause();
        if (window.movementWalkingAudio1 && !window.movementWalkingAudio1.paused) window.movementWalkingAudio1.pause();
        if (window.movementWalkingAudio2 && !window.movementWalkingAudio2.paused) window.movementWalkingAudio2.pause();
        if (window.movementRunningAudio && !window.movementRunningAudio.paused) window.movementRunningAudio.pause();

        if (window.idleAudio.paused) window.idleAudio.play().catch(e=>{});
      }
    }

    if (!hudDbElement) hudDbElement = document.getElementById('hud-db');
    if (hudDbElement && isLocked) {
      dbUpdateTime += delta;
      if (dbUpdateTime > 0.15) { // Update every 150ms
        dbUpdateTime = 0;
        if (isMoving) { // If moving significantly
          // High fluctuating noise (2dB to 14dB)
          hudDbElement.innerText = Math.floor(Math.random() * 12 + 2) + "dB";
        } else {
          // Mostly still (0dB with occasional 1dB blip)
          hudDbElement.innerText = (Math.random() > 0.95 ? "1dB" : "0dB");
        }
      }
    }
  };

  return { update, isLocked: () => isLocked };
}
