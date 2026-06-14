import * as THREE from 'three';
import { getWallData } from './worldGen.js';

export function createWorld(scene) {
  // Monochromatic Palette: Desaturated yellows and beiges
  const wallColor = 0xcaba96; 
  const floorColor = 0xa39474;
  const ceilingColor = 0xe0d6bc;

  const textureLoader = new THREE.TextureLoader();
  const wallpaperTexture = textureLoader.load('/wallpaper9.svg');
  wallpaperTexture.wrapS = THREE.RepeatWrapping;
  wallpaperTexture.wrapT = THREE.RepeatWrapping; 
  // Base tile repeat. We will adjust this on the large planes.
  
  wallpaperTexture.colorSpace = THREE.SRGBColorSpace; // Ensure colors are correct

  const wallMaterial = new THREE.MeshLambertMaterial({ 
    color: wallColor,
    map: wallpaperTexture
  });
  
  // For the floor and ceiling, we want the pattern to repeat appropriately for its massive size
  const planeSize = 300; // Large plane that moves with the player
  
  const floorMaterial = new THREE.MeshLambertMaterial({ color: floorColor });
  const ceilingMaterial = new THREE.MeshLambertMaterial({ color: ceilingColor });

  const roomSize = 5;
  const wallHeight = 3;
  const wallThickness = 0.2;

  // Floor
  const floorGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Ceiling
  const ceilingGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
  const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = wallHeight;
  scene.add(ceiling);

  const walls = new THREE.Group();
  
  const wallGeomX = new THREE.BoxGeometry(roomSize + wallThickness, wallHeight, wallThickness);
  const wallGeomZ = new THREE.BoxGeometry(wallThickness, wallHeight, roomSize + wallThickness);

  // Radius of 15 cells = 31x31 grid = 961 cells. Max 1000 walls.
  const maxWalls = 1000;
  const instancedWallsX = new THREE.InstancedMesh(wallGeomX, wallMaterial, maxWalls);
  const instancedWallsZ = new THREE.InstancedMesh(wallGeomZ, wallMaterial, maxWalls);
  instancedWallsX.castShadow = true;
  instancedWallsX.receiveShadow = true;
  instancedWallsZ.castShadow = true;
  instancedWallsZ.receiveShadow = true;
  
  const fixtureGeometry = new THREE.BoxGeometry(1, 0.1, 0.2);
  const deadFixtureMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 });
  const onFixtureMaterial = new THREE.MeshBasicMaterial({ color: 0xffffee });
  
  const instancedDeadFixtures = new THREE.InstancedMesh(fixtureGeometry, deadFixtureMaterial, maxWalls);
  const instancedOnFixtures = new THREE.InstancedMesh(fixtureGeometry, onFixtureMaterial, maxWalls);
  
  instancedWallsX.frustumCulled = false;
  instancedWallsZ.frustumCulled = false;
  instancedDeadFixtures.frustumCulled = false;
  instancedOnFixtures.frustumCulled = false;
  
  walls.add(instancedWallsX);
  walls.add(instancedWallsZ);
  walls.add(instancedDeadFixtures);
  walls.add(instancedOnFixtures);

  // Point Light Object Pool
  const maxLights = 50;
  const pointLights = [];
  for (let i = 0; i < maxLights; i++) {
    const light = new THREE.PointLight(0xfff5b6, 2.0, 15);
    light.visible = false;
    walls.add(light);
    pointLights.push(light);
  }

  // Global lighting
  const ambientLight = new THREE.AmbientLight(0xcaba96, 0.4); 
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xfff5b6, 0.2);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);

  scene.add(walls);

  let lastGridX = null;
  let lastGridZ = null;
  const dummy = new THREE.Object3D();

  // Function to regenerate the visible chunks around the player
  function updateWorld(cameraPos) {
    const gridX = Math.floor(cameraPos.x / roomSize);
    const gridZ = Math.floor(cameraPos.z / roomSize);

    if (gridX !== lastGridX || gridZ !== lastGridZ) {
      lastGridX = gridX;
      lastGridZ = gridZ;

      // Snap floor/ceiling to current grid to simulate infinity
      floor.position.x = gridX * roomSize;
      floor.position.z = gridZ * roomSize;
      ceiling.position.x = gridX * roomSize;
      ceiling.position.z = gridZ * roomSize;

      let wallXCount = 0;
      let wallZCount = 0;
      let deadFixtureCount = 0;
      let onFixtureCount = 0;
      let lightCount = 0;

      // Hide all pooled lights initially
      pointLights.forEach(l => l.visible = false);

      const radius = 7; // Render 7 cells in all directions (35 meters, covers 30m flashlight)

      for (let x = gridX - radius; x <= gridX + radius; x++) {
        for (let z = gridZ - radius; z <= gridZ + radius; z++) {
          
          const cellData = getWallData(x, z);

          if (cellData.northWall && wallXCount < maxWalls) {
            dummy.position.set(x * roomSize + roomSize / 2, wallHeight / 2, z * roomSize);
            dummy.updateMatrix();
            instancedWallsX.setMatrixAt(wallXCount++, dummy.matrix);
          }

          if (cellData.westWall && wallZCount < maxWalls) {
            dummy.position.set(x * roomSize, wallHeight / 2, z * roomSize + roomSize / 2);
            dummy.updateMatrix();
            instancedWallsZ.setMatrixAt(wallZCount++, dummy.matrix);
          }

          if (cellData.hasFixture) {
            dummy.position.set(x * roomSize + roomSize / 2, wallHeight - 0.1, z * roomSize + roomSize / 2);
            dummy.updateMatrix();

            if (cellData.isFixtureOn) {
              if (onFixtureCount < maxWalls) {
                instancedOnFixtures.setMatrixAt(onFixtureCount++, dummy.matrix);
              }
              if (lightCount < maxLights) {
                const pl = pointLights[lightCount++];
                pl.position.copy(dummy.position);
                pl.position.y -= 0.2;
                pl.visible = true;
              }
            } else {
              if (deadFixtureCount < maxWalls) {
                instancedDeadFixtures.setMatrixAt(deadFixtureCount++, dummy.matrix);
              }
            }
          }
        }
      }

      instancedWallsX.count = wallXCount;
      instancedWallsZ.count = wallZCount;
      instancedDeadFixtures.count = deadFixtureCount;
      instancedOnFixtures.count = onFixtureCount;
      
      instancedWallsX.instanceMatrix.needsUpdate = true;
      instancedWallsZ.instanceMatrix.needsUpdate = true;
      instancedDeadFixtures.instanceMatrix.needsUpdate = true;
      instancedOnFixtures.instanceMatrix.needsUpdate = true;
    }
  }

  return { updateWorld };
}
