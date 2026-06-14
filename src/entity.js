import * as THREE from 'three';

export function createHowlerModel(scene, audioListener) {
  const group = new THREE.Group();
  
  // The Howler is a massive, skeletal, black stick figure made of twisted wire-like masses
  const material = new THREE.MeshLambertMaterial({ color: 0x020202 }); // Near pitch black
  
  group.position.y = 0;
  
  // Body (Twisted core)
  const body1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 2.8, 5), material);
  body1.position.set(0, 1.4, 0);
  body1.rotation.z = 0.05;
  body1.castShadow = true;
  group.add(body1);

  const body2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 2.6, 5), material);
  body2.position.set(0.05, 1.3, -0.05);
  body2.rotation.x = 0.1;
  body2.rotation.z = -0.05;
  body2.castShadow = true;
  group.add(body2);
  
  // Shoulders (Broad horizontal bar)
  const shoulders = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.1), material);
  shoulders.position.set(0, 2.6, 0);
  shoulders.castShadow = true;
  group.add(shoulders);
  
  // Head (Distorted geometric shape, hunched forward)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.4), material);
  head.position.set(0, 2.9, 0.15);
  head.rotation.x = 0.1; // Hunched forward
  head.castShadow = true;
  group.add(head);

  // Glowing Jagged Mouth
  const mouthMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  
  // Create a jagged M shape for the mouth using multiple small planes
  const tooth1 = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.12), mouthMaterial);
  tooth1.position.set(-0.1, 2.85, 0.36);
  tooth1.rotation.z = -0.3;
  group.add(tooth1);
  const tooth2 = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.12), mouthMaterial);
  tooth2.position.set(-0.03, 2.85, 0.36);
  tooth2.rotation.z = 0.3;
  group.add(tooth2);
  const tooth3 = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.12), mouthMaterial);
  tooth3.position.set(0.03, 2.85, 0.36);
  tooth3.rotation.z = -0.3;
  group.add(tooth3);
  const tooth4 = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.12), mouthMaterial);
  tooth4.position.set(0.1, 2.85, 0.36);
  tooth4.rotation.z = 0.3;
  group.add(tooth4);

  // Arms (Hanging from broad shoulders)
  const armL_upper = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2), material);
  armL_upper.position.set(-0.55, 2.0, 0);
  armL_upper.rotation.z = 0.1; 
  armL_upper.castShadow = true;
  group.add(armL_upper);

  const armL_lower = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5), material);
  armL_lower.position.set(-0.6, 0.7, 0.1);
  armL_lower.rotation.z = 0.05; 
  armL_lower.castShadow = true;
  group.add(armL_lower);

  // Left Claw (3 prongs)
  const clawMat = material;
  const cL1 = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3), clawMat); cL1.position.set(-0.6, -0.1, 0.1); group.add(cL1);
  const cL2 = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3), clawMat); cL2.position.set(-0.68, -0.1, 0.1); cL2.rotation.z = -0.4; group.add(cL2);
  const cL3 = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3), clawMat); cL3.position.set(-0.52, -0.1, 0.1); cL3.rotation.z = 0.4; group.add(cL3);

  const armR_upper = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3), material);
  armR_upper.position.set(0.55, 1.95, 0);
  armR_upper.rotation.z = -0.1; 
  armR_upper.castShadow = true;
  group.add(armR_upper);

  const armR_lower = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6), material);
  armR_lower.position.set(0.6, 0.5, -0.1);
  armR_lower.rotation.z = -0.05;
  armR_lower.castShadow = true;
  group.add(armR_lower);

  // Right Claw (3 prongs)
  const cR1 = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3), clawMat); cR1.position.set(0.6, -0.4, -0.1); group.add(cR1);
  const cR2 = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3), clawMat); cR2.position.set(0.52, -0.4, -0.1); cR2.rotation.z = 0.4; group.add(cR2);
  const cR3 = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3), clawMat); cR3.position.set(0.68, -0.4, -0.1); cR3.rotation.z = -0.4; group.add(cR3);

  // Legs (Squiggly wires)
  // We'll create the wavy effect by stacking several short angled cylinders
  const legL = new THREE.Group();
  let prevY = 1.4;
  let offsetX = -0.2;
  for (let i=0; i<8; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.25), material);
    seg.position.set(offsetX + (i%2===0?0.05:-0.05), prevY - 0.125, 0);
    seg.rotation.z = (i%2===0 ? -0.3 : 0.3);
    legL.add(seg);
    prevY -= 0.22;
  }
  group.add(legL);

  const legR = new THREE.Group();
  prevY = 1.4;
  offsetX = 0.2;
  for (let i=0; i<8; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.25), material);
    seg.position.set(offsetX + (i%2===0?-0.05:0.05), prevY - 0.125, 0);
    seg.rotation.z = (i%2===0 ? 0.3 : -0.3);
    legR.add(seg);
    prevY -= 0.22;
  }
  group.add(legR);
  
  // Store references for animation
  group.userData.limbs = {
    armL: armL_upper,
    armR: armR_upper,
    legL: legL,
    legR: legR,
    clawL: [cL1, cL2, cL3, armL_lower],
    clawR: [cR1, cR2, cR3, armR_lower]
  };
  
  if (audioListener) {
    const sound = new THREE.PositionalAudio(audioListener);
    const audioLoader = new THREE.AudioLoader();
    
    group.userData.howlerSounds = [];
    group.userData.soundComponent = sound;
    
    for (let i = 1; i <= 10; i++) {
      audioLoader.load(`/howler sound ${i}.mp3`, (buffer) => {
        group.userData.howlerSounds.push(buffer);
      });
    }
    
    sound.setRefDistance(3); // Start dropping volume at 3 meters
    sound.setRolloffFactor(2); // Drop off fairly fast
    sound.setVolume(2.0); // Make it loud!
    
    group.add(sound);
  }
  
  scene.add(group);
  
  return group;
}

export function updateHowler(model, data) {
  if (!model) return;
  
  // Smoothly interpolate position (optional, but direct setting is fine for now)
  model.position.set(data.x, data.y, data.z);
  model.rotation.y = data.rotY;
  
  const time = Date.now() * 0.001; // seconds
  const limbs = model.userData.limbs;
  
  // Bobbing and walking animation based on state
  if (data.state === 'CHASE') {
    // Aggressive shaking & fast running
    model.rotation.z = Math.sin(time * 50) * 0.05;
    
    // Fast leg movement
    if (limbs) {
      limbs.legL.rotation.x = Math.sin(time * 15) * 0.4;
      limbs.legR.rotation.x = Math.sin(time * 15 + Math.PI) * 0.4;
      // Arms flailing
      limbs.armL.rotation.x = Math.sin(time * 15 + Math.PI) * 0.6 + Math.PI/8;
      limbs.armR.rotation.x = Math.sin(time * 15) * 0.6 - Math.PI/8;
      
      // Update claw positions so they stick to the swinging upper arms
      const lY = Math.sin(limbs.armL.rotation.x) * 1.2;
      const lZ = Math.cos(limbs.armL.rotation.x) * 1.2;
      limbs.clawL.forEach(c => { c.position.y = 2.0 - lZ - 0.5; c.position.z = lY; });
      
      const rY = Math.sin(limbs.armR.rotation.x) * 1.3;
      const rZ = Math.cos(limbs.armR.rotation.x) * 1.3;
      limbs.clawR.forEach(c => { c.position.y = 1.95 - rZ - 0.6; c.position.z = rY - 0.1; });
    }
    
    // Play sounds
    const sound = model.userData.soundComponent;
    const sounds = model.userData.howlerSounds;
    if (sound && sounds && sounds.length > 0) {
      if (!sound.isPlaying) {
        // Pick a random scream
        const randBuffer = sounds[Math.floor(Math.random() * sounds.length)];
        sound.setBuffer(randBuffer);
        sound.play();
      }
    }
  } else if (data.state === 'LURK') {
    // Creepy stalking animation (hunched, twitchy)
    model.position.y -= 0.2; // Crouch down slightly
    model.rotation.z = Math.sin(time * 8) * 0.02; // Fast but tiny twitches
    
    if (limbs) {
      limbs.legL.rotation.x = Math.sin(time * 6) * 0.3;
      limbs.legR.rotation.x = Math.sin(time * 6 + Math.PI) * 0.3;
      
      // Arms held up close to chest, twitching
      limbs.armL.rotation.x = Math.PI/4 + Math.sin(time * 20) * 0.05;
      limbs.armR.rotation.x = Math.PI/4 + Math.sin(time * 20 + Math.PI) * 0.05;

      // Keep claws pinned
      const lY = Math.sin(limbs.armL.rotation.x) * 1.2;
      const lZ = Math.cos(limbs.armL.rotation.x) * 1.2;
      limbs.clawL.forEach(c => { c.position.y = 2.0 - lZ - 0.5; c.position.z = lY; });
      
      const rY = Math.sin(limbs.armR.rotation.x) * 1.3;
      const rZ = Math.cos(limbs.armR.rotation.x) * 1.3;
      limbs.clawR.forEach(c => { c.position.y = 1.95 - rZ - 0.6; c.position.z = rY - 0.1; });
    }
  } else {
    // Slow eerie sway & slow walking
    model.rotation.z = Math.sin(time * 2) * 0.05;
    
    if (limbs) {
      limbs.legL.rotation.x = Math.sin(time * 4) * 0.2;
      limbs.legR.rotation.x = Math.sin(time * 4 + Math.PI) * 0.2;
      limbs.armL.rotation.x = Math.sin(time * 2) * 0.1 + Math.PI/8;
      limbs.armR.rotation.x = Math.sin(time * 2 + Math.PI) * 0.1 - Math.PI/8;

      // Keep claws pinned
      const lY = Math.sin(limbs.armL.rotation.x) * 1.2;
      const lZ = Math.cos(limbs.armL.rotation.x) * 1.2;
      limbs.clawL.forEach(c => { c.position.y = 2.0 - lZ - 0.5; c.position.z = lY; });
      
      const rY = Math.sin(limbs.armR.rotation.x) * 1.3;
      const rZ = Math.cos(limbs.armR.rotation.x) * 1.3;
      limbs.clawR.forEach(c => { c.position.y = 1.95 - rZ - 0.6; c.position.z = rY - 0.1; });
    }
  }
}
