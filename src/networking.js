import { io } from 'socket.io-client';
import * as THREE from 'three';
import { createHowlerModel, updateHowler } from './entity.js';

export function setupNetworking(scene, camera, audioListener) {
  // Connect to the Socket.io server running on the same host but different port (or same if hosted together)
  // For dev, Vite runs on 5173, Server on 3000. In production on Render, it uses the same URL.
  const socketUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '/';
  const socket = io(socketUrl);

  const otherPlayers = {};

  function createHazmatModel() {
    const group = new THREE.Group();

    const suitMaterial = new THREE.MeshLambertMaterial({ color: 0xffe600 }); // Very bright yellow
    const blackMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 });

    // Torso (Box)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), suitMaterial);
    torso.position.y = 0.8;
    torso.castShadow = true;
    group.add(torso);

    // Oxygen Tank
    const tankMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 }); // Dark grey
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.5), tankMaterial);
    tank.position.set(0, 0.85, 0.3); // Attached to the back
    tank.castShadow = true;
    group.add(tank);

    // Legs
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6), suitMaterial);
    legL.position.set(-0.18, 0.3, 0);
    legL.castShadow = true;
    group.add(legL);

    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6), suitMaterial);
    legR.position.set(0.18, 0.3, 0);
    legR.castShadow = true;
    group.add(legR);

    // Head / Pivot group (moves up and down)
    const headPivot = new THREE.Group();
    headPivot.position.y = 1.35; // Neck level
    group.add(headPivot);
    group.headNode = headPivot;

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), suitMaterial);
    head.castShadow = true;
    headPivot.add(head);

    // Visor
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.2), blackMaterial);
    visor.position.set(0, 0, -0.22);
    headPivot.add(visor);

    // Right Arm (holding Camcorder)
    const armR = new THREE.Group();
    armR.position.set(-0.4, -0.15, 0); // Relative to headPivot
    headPivot.add(armR);

    const armRMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6), suitMaterial);
    armRMesh.position.set(0, 0.1, -0.2);
    armRMesh.rotation.x = -Math.PI / 4; // Angled forward and up
    armRMesh.castShadow = true;
    armR.add(armRMesh);

    // Camcorder
    const camcorder = new THREE.Group();
    camcorder.position.set(0, 0.3, -0.4); // At the end of the hand
    armR.add(camcorder);

    const camBody = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.35), blackMaterial);
    camcorder.add(camBody);

    const camLens = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1), blackMaterial);
    camLens.rotation.x = Math.PI / 2;
    camLens.position.set(0, 0, -0.2);
    camcorder.add(camLens);

    // Left Arm (holding Flashlight)
    const armL = new THREE.Group();
    armL.position.set(0.4, -0.15, 0); // Relative to headPivot
    headPivot.add(armL);

    const armLMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6), suitMaterial);
    armLMesh.position.set(0, -0.25, -0.15); // Down and forward
    armLMesh.rotation.x = Math.PI / 6; // Angled slightly forward
    armLMesh.castShadow = true;
    armL.add(armLMesh);

    // Flashlight prop
    const flashlightProp = new THREE.Group();
    flashlightProp.position.set(0, -0.5, -0.3); // At the end of the arm
    armL.add(flashlightProp);

    const flashBody = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25), blackMaterial);
    flashBody.rotation.x = Math.PI / 2;
    flashlightProp.add(flashBody);

    const flashLens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    flashLens.rotation.x = Math.PI / 2;
    flashLens.position.set(0, 0, -0.13);
    flashlightProp.add(flashLens);

    // Expose attachment point
    group.flashlightAttachment = flashlightProp;

    return group;
  }

  socket.on('currentPlayers', (players) => {
    Object.keys(players).forEach((id) => {
      if (id !== socket.id) {
        addOtherPlayer(players[id]);
      }
    });
  });

  socket.on('newPlayer', (playerInfo) => {
    addOtherPlayer(playerInfo);
  });

  socket.on('playerDisconnected', (id) => {
    if (otherPlayers[id]) {
      scene.remove(otherPlayers[id]);
      delete otherPlayers[id];
    }
  });

  socket.on('playerMoved', (playerInfo) => {
    if (otherPlayers[playerInfo.id]) {
      otherPlayers[playerInfo.id].position.set(playerInfo.position.x, 0, playerInfo.position.z); // Ground the player
      otherPlayers[playerInfo.id].rotation.y = playerInfo.rotation.y;
      if (playerInfo.rotation.x && otherPlayers[playerInfo.id].flashlightPivot) {
        otherPlayers[playerInfo.id].flashlightPivot.rotation.x = playerInfo.rotation.x;
      }
    }
  });

  function addOtherPlayer(playerInfo) {
    const mesh = createHazmatModel();
    
    // Add networked flashlight
    const flash = new THREE.SpotLight(0xfff5b6, 20.0);
    flash.angle = Math.PI / 5;
    flash.penumbra = 0.5;
    flash.decay = 2;
    flash.distance = 30;
    flash.castShadow = true;
    flash.shadow.camera.near = 0.5;
    flash.shadow.camera.far = 15;
    flash.shadow.bias = -0.001;
    
    // Attach flashlight directly to the prop in the hand!
    mesh.flashlightAttachment.add(flash);
    
    const flashTarget = new THREE.Object3D();
    flashTarget.position.set(0, 0, -1);
    mesh.flashlightAttachment.add(flashTarget);
    flash.target = flashTarget;
    
    mesh.flashlightPivot = mesh.headNode; // rotate the whole head up/down
    
    mesh.position.set(playerInfo.position.x, 0, playerInfo.position.z); // Ground the player
    mesh.rotation.y = playerInfo.rotation.y;
    if (playerInfo.rotation.x) mesh.flashlightPivot.rotation.x = playerInfo.rotation.x;
    
    scene.add(mesh);
    // SpotLight targets MUST be added to the scene in Three.js, but since it's a child of pivot, 
    // it will work locally. However, just to be safe, we don't add it to scene to avoid detached transform issues.
    
    otherPlayers[playerInfo.id] = mesh;
  }

  // Network sync loop for local player
  let lastSyncTime = 0;
  const syncInterval = 1000 / 20; // 20 times per second

  // Listen for text chat messages
  socket.on('chatMessage', (data) => {
    const chatMessages = document.getElementById('chat-messages');
    const li = document.createElement('li');
    // Basic sanitization
    const text = document.createTextNode(`Player ${data.id.substring(0, 4)}: ${data.message}`);
    li.appendChild(text);
    chatMessages.appendChild(li);
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });

  // Howler Entity Sync
  let howlerModel = null;
  socket.on('entityUpdate', (data) => {
    if (!howlerModel) {
      howlerModel = createHowlerModel(scene, audioListener);
    }
    updateHowler(howlerModel, data);
  });

  // Jump Scare & Teleport
  socket.on('jumpScare', () => {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'red';
    overlay.style.zIndex = '9999';
    overlay.style.pointerEvents = 'none';
    document.body.appendChild(overlay);
    
    let op = 1;
    const fade = setInterval(() => {
      op -= 0.05;
      overlay.style.opacity = op;
      if (op <= 0) {
        clearInterval(fade);
        document.body.removeChild(overlay);
      }
    }, 50);

    if (window.walkingAudio) window.walkingAudio.pause();
    if (window.runningAudio) window.runningAudio.pause();
  });

  socket.on('forceTeleport', (pos) => {
    camera.position.set(pos.x, pos.y, pos.z);
    
    // Also reset velocity in controls to prevent gliding after teleport
    if (window.resetVelocity) window.resetVelocity();
  });

  const update = (time) => {
    if (time - lastSyncTime > syncInterval) {
      if (socket.connected) {
        // Use YXZ Euler to properly extract the yaw and pitch, avoiding quaternion Gimbal lock issues
        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.setFromQuaternion(camera.quaternion);
        
        socket.emit('playerMovement', {
          position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          rotation: { x: euler.x, y: euler.y }
        });
      }
      lastSyncTime = time;
    }
  };

  const sendChatMessage = (msg) => {
    if (socket && socket.connected) {
      socket.emit('chatMessage', msg);
    }
  };

  return { update, sendChatMessage };
}
