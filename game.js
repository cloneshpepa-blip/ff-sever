/**
 * CYBERPUNK VELOCITY 3D - ENGINE & GAME LOGIC
 * Optimized for Mobile (iOS / Android) with Adaptive FPS
 */

let cfg = null;
let scene, camera, renderer;
let playerMesh, engineParticles = [];
let obstaclesPool = [], activeObstacles = [];
let collectiblesPool = [], activeCollectibles = [];

// Game States
let currentLane = 1; // 0: Left, 1: Center, 2: Right
let targetX = 0;
let currentSpeed = 0;
let isBoosting = false;
let score = 0;
let health = 100;
let boostEnergy = 100;
let isGameOver = false;

// Performance Monitoring
let lastTime = performance.now();
let frameCount = 0;
let lowPerformanceDetected = false;

// Load Config & Initialize
async function init() {
    try {
        const res = await fetch('config.json');
        cfg = await res.json();
    } catch (e) {
        console.warn('Config load failed, using fallback');
        cfg = {
            player: { name: "Mai Sĩ Hùng", base_speed: 0.45, max_speed: 0.8 },
            world: { road_width: 12, lanes: [-3.5, 0, 3.5] }
        };
    }

    document.getElementById('pilot-name').innerText = cfg.player.name || "Pilot";
    setupThreeJS();
    buildCyberShip();
    buildEnvironment();
    setupInputs();
    
    currentSpeed = cfg.player.base_speed;
    animate();
}

function setupThreeJS() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(parseInt(cfg.world?.fog_color || "0x05050f"), cfg.world?.fog_density || 0.018);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 150);
    camera.position.set(0, 3.8, 6.5);
    camera.lookAt(0, 1, -10);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00f3ff, 1.2);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);
}

// Procedural 3D Mesh Generation for Cyber Ship
function buildCyberShip() {
    playerMesh = new THREE.Group();

    // Fuselage (Body)
    const bodyGeo = new THREE.ConeGeometry(0.7, 2.5, 5);
    const bodyMat = new THREE.MeshStandardMaterial({ 
        color: 0x0f172a, 
        metalness: 0.8, 
        roughness: 0.2 
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = Math.PI / 2;
    body.castShadow = true;
    playerMesh.add(body);

    // Cockpit Glow
    const glassGeo = new THREE.SphereGeometry(0.35, 8, 8);
    const glassMat = new THREE.MeshStandardMaterial({ 
        color: 0xff0055, 
        emissive: 0xff0055, 
        emissiveIntensity: 0.8 
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(0, 0.25, -0.2);
    playerMesh.add(glass);

    // Wings
    const wingGeo = new THREE.BoxGeometry(2.2, 0.08, 0.8);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x00f3ff, metalness: 0.9, roughness: 0.1 });
    const wings = new THREE.Mesh(wingGeo, wingMat);
    wings.position.set(0, 0, 0.4);
    wings.castShadow = true;
    playerMesh.add(wings);

    // Engine Thrusters
    const engineGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.6, 8);
    const engineMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
    
    const leftEngine = new THREE.Mesh(engineGeo, engineMat);
    leftEngine.position.set(-0.45, -0.1, 1.1);
    leftEngine.rotation.x = Math.PI / 2;
    playerMesh.add(leftEngine);

    const rightEngine = leftEngine.clone();
    rightEngine.position.x = 0.45;
    playerMesh.add(rightEngine);

    playerMesh.position.set(cfg.world.lanes[1], 0.6, 0);
    scene.add(playerMesh);
}

// Environment & Infinite Grid Track
let gridFloor;
function buildEnvironment() {
    const gridHelper = new THREE.GridHelper(200, 60, 0x00f3ff, 0x1e1b4b);
    gridHelper.position.set(0, 0, -60);
    scene.add(gridHelper);
    gridFloor = gridHelper;
}

// Particle System for Engine Trail
function createEngineParticle() {
    if (lowPerformanceDetected && engineParticles.length > 30) return;

    const pGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const pMat = new THREE.MeshBasicMaterial({ 
        color: isBoosting ? 0xff0055 : 0x00f3ff, 
        transparent: true, 
        opacity: 0.8 
    });
    const p = new THREE.Mesh(pGeo, pMat);
    
    p.position.set(
        playerMesh.position.x + (Math.random() - 0.5) * 0.4,
        playerMesh.position.y - 0.1,
        playerMesh.position.z + 1.2
    );
    scene.add(p);
    engineParticles.push({ mesh: p, life: 1.0 });
}

function updateParticles() {
    for (let i = engineParticles.length - 1; i >= 0; i--) {
        let p = engineParticles[i];
        p.mesh.position.z += currentSpeed * 1.2;
        p.life -= 0.04;
        p.mesh.material.opacity = p.life;
        p.mesh.scale.multiplyScalar(0.95);

        if (p.life <= 0) {
            scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
            engineParticles.splice(i, 1);
        }
    }
}

// Spawner Logic (Obstacles & Energy)
let spawnTimer = 0;
function handleSpawning() {
    spawnTimer += currentSpeed;
    if (spawnTimer > 12) {
        spawnTimer = 0;
        const laneIdx = Math.floor(Math.random() * cfg.world.lanes.length);
        const spawnX = cfg.world.lanes[laneIdx];

        if (Math.random() > 0.3) {
            // Spawn Obstacle
            const obsGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
            const obsMat = new THREE.MeshStandardMaterial({ 
                color: 0xff0055, 
                emissive: 0xff0055, 
                emissiveIntensity: 0.5 
            });
            const obs = new THREE.Mesh(obsGeo, obsMat);
            obs.position.set(spawnX, 0.7, -90);
            obs.castShadow = true;
            scene.add(obs);
            activeObstacles.push(obs);
        } else {
            // Spawn Energy Item
            const itemGeo = new THREE.OctahedronGeometry(0.6);
            const itemMat = new THREE.MeshBasicMaterial({ color: 0x00ff66, wireframe: true });
            const item = new THREE.Mesh(itemGeo, itemMat);
            item.position.set(spawnX, 0.8, -90);
            scene.add(item);
            activeCollectibles.push(item);
        }
    }
}

// Main Game Loop
function animate() {
    if (isGameOver) return;
    requestAnimationFrame(animate);

    // Adaptive Performance Check
    frameCount++;
    const now = performance.now();
    if (now - lastTime >= 1000) {
        if (frameCount < 40 && !lowPerformanceDetected) {
            lowPerformanceDetected = true;
            renderer.shadowMap.enabled = false; // Turn off shadows for smooth FPS on low-end
            console.log("Low-spec mode auto-activated for smoothness");
        }
        frameCount = 0;
        lastTime = now;
    }

    // Controls Smooth Interpolation
    targetX = cfg.world.lanes[currentLane];
    playerMesh.position.x += (targetX - playerMesh.position.x) * 0.18;
    playerMesh.rotation.z = (playerMesh.position.x - targetX) * 0.15; // Roll animation
    playerMesh.rotation.y = (playerMesh.position.x - targetX) * -0.05;

    // Boost Handling
    if (isBoosting && boostEnergy > 0) {
        currentSpeed = cfg.player.max_speed;
        boostEnergy = Math.max(0, boostEnergy - 0.6);
    } else {
        currentSpeed = cfg.player.base_speed;
        boostEnergy = Math.min(100, boostEnergy + 0.15);
    }

    // World Motion
    gridFloor.position.z += currentSpeed * 2;
    if (gridFloor.position.z > 0) gridFloor.position.z = -60;

    createEngineParticle();
    updateParticles();
    handleSpawning();

    // Update Obstacles Movement & Collision
    for (let i = activeObstacles.length - 1; i >= 0; i--) {
        let obs = activeObstacles[i];
        obs.position.z += currentSpeed * 2.2;
        obs.rotation.x += 0.02;

        // Collision Check (AABB)
        if (Math.abs(obs.position.z - playerMesh.position.z) < 1.2 &&
            Math.abs(obs.position.x - playerMesh.position.x) < 1.0) {
            
            health -= 30;
            scene.remove(obs);
            activeObstacles.splice(i, 1);

            if (health <= 0) triggerGameOver("Ship Destroyed by Obstacle");
            continue;
        }

        if (obs.position.z > 10) {
            scene.remove(obs);
            activeObstacles.splice(i, 1);
            score += 15;
        }
    }

    // Update Collectibles
    for (let i = activeCollectibles.length - 1; i >= 0; i--) {
        let item = activeCollectibles[i];
        item.position.z += currentSpeed * 2.2;
        item.rotation.y += 0.05;

        if (Math.abs(item.position.z - playerMesh.position.z) < 1.2 &&
            Math.abs(item.position.x - playerMesh.position.x) < 1.0) {
            
            boostEnergy = Math.min(100, boostEnergy + 40);
            score += 50;
            scene.remove(item);
            activeCollectibles.splice(i, 1);
            continue;
        }

        if (item.position.z > 10) {
            scene.remove(item);
            activeCollectibles.splice(i, 1);
        }
    }

    // Update HUD
    document.getElementById('score-val').innerText = score;
    document.getElementById('health-bar').style.width = health + '%';
    document.getElementById('boost-bar').style.width = boostEnergy + '%';

    renderer.render(scene, camera);
}

// Event Listeners for Touch / Keyboard Controls
function setupInputs() {
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const btnBoost = document.getElementById('btn-boost');

    const moveLeft = () => { if (currentLane > 0) currentLane--; };
    const moveRight = () => { if (currentLane < cfg.world.lanes.length - 1) currentLane++; };

    btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); moveLeft(); });
    btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); moveRight(); });
    
    btnBoost.addEventListener('touchstart', (e) => { e.preventDefault(); isBoosting = true; });
    btnBoost.addEventListener('touchend', (e) => { e.preventDefault(); isBoosting = false; });

    // Keyboard Fallback
    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a') moveLeft();
        if (e.key === 'ArrowRight' || e.key === 'd') moveRight();
        if (e.key === ' ') isBoosting = true;
    });
    window.addEventListener('keyup', (e) => {
        if (e.key === ' ') isBoosting = false;
    });

    document.getElementById('btn-restart').addEventListener('click', restartGame);
    window.addEventListener('resize', onWindowResize);
}

function triggerGameOver(reason) {
    isGameOver = true;
    document.getElementById('death-reason').innerText = reason;
    document.getElementById('final-score').innerText = score + " PTS";
    document.getElementById('overlay').classList.add('active');
}

function restartGame() {
    isGameOver = false;
    health = 100;
    boostEnergy = 100;
    score = 0;
    currentLane = 1;

    activeObstacles.forEach(o => scene.remove(o));
    activeCollectibles.forEach(c => scene.remove(c));
    activeObstacles = [];
    activeCollectibles = [];

    document.getElementById('overlay').classList.remove('active');
    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onload = init;
