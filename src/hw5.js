import { OrbitControls } from "./OrbitControls.js";

// CONSTANTS ------------------------------
const LINES_WIDTH = 0.1;
const LINES_HEIGHT = 0.01;
const LINES_THICKNESS = 0.2;
const COURT_Y_SURFACE = 0.1;
const Colors = {
  WHITE: 0xffffff,
  ORANGE: 0xf88158,
};
// --- Physics (tweak these for feel) ---
const GRAVITY = -9.8; // m/s^2
const COURT_WIDTH = 30;
const COURT_DEPTH = 15;
const BALL_BOUNCINESS = 0.7; // 0 = no bounce, 1 = perfect bounce
const RIM_BOUNCINESS = 0.8;
// -----------------------------------------

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
// Set background color
scene.background = new THREE.Color(0x000000);

// Add lights to the scene
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 15);
scene.add(directionalLight);

// Enable shadows
renderer.shadowMap.enabled = true;
directionalLight.castShadow = true;

let ballGroup;
const ballRadius = 0.3;
const initialBallPosition = new THREE.Vector3(
  0,
  COURT_Y_SURFACE + ballRadius,
  0
);

// Physics variables
let ballVelocity = new THREE.Vector3();
let isShooting = false;
let shotPower = 50; // Initial power
const hoopPositions = [];
const backboards = [];
const poles = [];
const rims = [];

let trajectoryLine;

function degrees_to_radians(degrees) {
  var pi = Math.PI;
  return degrees * (pi / 180);
}

// Create basketball court
function createBasketballCourt() {
  // Court floor - just a simple brown surface
  const courtGeometry = new THREE.BoxGeometry(COURT_WIDTH, 0.2, COURT_DEPTH);
  const courtMaterial = new THREE.MeshPhongMaterial({
    color: 0xc68642, // Brown wood color
    shininess: 50,
  });
  const court = new THREE.Mesh(courtGeometry, courtMaterial);
  court.receiveShadow = true;
  scene.add(court);

  // Student Geometries
  createCourtElements();
}

// Create all elements
createBasketballCourt();

// Set camera position for better view
const cameraTranslate = new THREE.Matrix4();
cameraTranslate.makeTranslation(0, 15, 30);
camera.applyMatrix4(cameraTranslate);

// Orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
let isOrbitEnabled = true;

// Instructions display
const instructionsElement = document.createElement("div");
instructionsElement.style.position = "absolute";
instructionsElement.style.bottom = "20px";
instructionsElement.style.left = "20px";
instructionsElement.style.color = "white";
instructionsElement.style.fontSize = "16px";
instructionsElement.style.fontFamily = "Arial, sans-serif";
instructionsElement.style.textAlign = "left";
instructionsElement.innerHTML = `
  <h3>Controls:</h3>
  <p>O - Toggle orbit camera</p>
  <p>Arrow Keys - Move the ball</p>
  <p>R - Reset ball position</p>
  <p>W/S - Adjust shot power</p>
  <p>Spacebar - Shoot</p>
`;
document.body.appendChild(instructionsElement);

// Power indicator
const powerElement = document.createElement("div");
powerElement.style.position = "absolute";
powerElement.style.bottom = "150px";
powerElement.style.left = "20px";
powerElement.style.color = "white";
powerElement.style.fontSize = "16px";
powerElement.style.fontFamily = "Arial, sans-serif";
powerElement.innerHTML = `<h3>Power: ${shotPower}%</h3>`;
document.body.appendChild(powerElement);

const movement = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};
// Handle key events
function handleKeyDown(e) {
  if (e.key === "o") {
    isOrbitEnabled = !isOrbitEnabled;
  }
  if (e.key === "r") {
    ballGroup.position.copy(initialBallPosition);
    ballGroup.rotation.set(0, 0, 0);
    isShooting = false;
    ballVelocity.set(0, 0, 0);
    shotPower = 50;
    powerElement.innerHTML = `<h3>Power: ${shotPower}%</h3>`;
    updateTrajectory();
  }

  if (e.key === "w") {
    shotPower = Math.min(100, shotPower + 5);
    powerElement.innerHTML = `<h3>Power: ${shotPower}%</h3>`;
    updateTrajectory();
  }
  if (e.key === "s") {
    shotPower = Math.max(0, shotPower - 5);
    powerElement.innerHTML = `<h3>Power: ${shotPower}%</h3>`;
    updateTrajectory();
  }

  if (e.key === " " && !isShooting) {
    isShooting = true;
    trajectoryLine.visible = false;
    const targetHoop =
      ballGroup.position.distanceTo(hoopPositions[0]) <
      ballGroup.position.distanceTo(hoopPositions[1])
        ? hoopPositions[0]
        : hoopPositions[1];

    const direction = new THREE.Vector3()
      .subVectors(targetHoop, ballGroup.position)
      .normalize();
    // --- Shot power and arc (tweak for feel) ---
    const initialSpeed = shotPower / 4; // Tweak the divisor to change power sensitivity
    const upwardForce = 7; // Tweak this for a higher/lower arc

    ballVelocity.copy(direction).multiplyScalar(initialSpeed);
    ballVelocity.y += upwardForce;
  }

  const state = e.type === "keydown";
  switch (e.key) {
    case "ArrowUp":
      movement.forward = state;
      break;
    case "ArrowDown":
      movement.backward = state;
      break;
    case "ArrowLeft":
      movement.left = state;
      break;
    case "ArrowRight":
      movement.right = state;
      break;
  }
}
function handleKeyUp(e) {
  const state = e.type === "keydown";
  switch (e.key) {
    case "ArrowUp":
      movement.forward = state;
      break;
    case "ArrowDown":
      movement.backward = state;
      break;
    case "ArrowLeft":
      movement.left = state;
      break;
    case "ArrowRight":
      movement.right = state;
      break;
  }
}

document.addEventListener("keydown", handleKeyDown);
document.addEventListener("keyup", handleKeyUp);

const clock = new THREE.Clock();
// Animation function
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (isShooting) {
    ballVelocity.y += GRAVITY * delta;
    ballGroup.position.add(ballVelocity.clone().multiplyScalar(delta));

    // Ground collision
    if (ballGroup.position.y < COURT_Y_SURFACE + ballRadius) {
      ballGroup.position.y = COURT_Y_SURFACE + ballRadius;
      ballVelocity.y *= -BALL_BOUNCINESS;

      // Stop bouncing if velocity is low
      if (Math.abs(ballVelocity.y) < 1) {
        isShooting = false;
        ballVelocity.set(0, 0, 0);
        updateTrajectory();
      }
    }
    checkCollisions();
  } else {
    const moveSpeed = 5;
    const rotationSpeed = 0.1;

    if (movement.forward) {
      ballGroup.position.z -= moveSpeed * delta;
      ballGroup.rotation.x -= rotationSpeed;
    }
    if (movement.backward) {
      ballGroup.position.z += moveSpeed * delta;
      ballGroup.rotation.x += rotationSpeed;
    }
    if (movement.left) {
      ballGroup.position.x -= moveSpeed * delta;
      ballGroup.rotation.z += rotationSpeed;
    }
    if (movement.right) {
      ballGroup.position.x += moveSpeed * delta;
      ballGroup.rotation.z -= rotationSpeed;
    }
    // Boundary checks
    ballGroup.position.x = Math.max(
      -COURT_WIDTH / 2 + ballRadius,
      Math.min(COURT_WIDTH / 2 - ballRadius, ballGroup.position.x)
    );
    ballGroup.position.z = Math.max(
      -COURT_DEPTH / 2 + ballRadius,
      Math.min(COURT_DEPTH / 2 - ballRadius, ballGroup.position.z)
    );
    updateTrajectory();
  }

  // Update controls
  controls.enabled = isOrbitEnabled;
  controls.update();

  renderer.render(scene, camera);
}

animate();

// ------------------------------------------------------------------------

function createCourtElements() {
  createBasketball();
  createCourtLines();
  createBothBaskets();
  createTrajectoryLine();
}

function createTrajectoryLine() {
  const material = new THREE.LineBasicMaterial({
    color: 0xff0000,
    linewidth: 2,
  });
  const geometry = new THREE.BufferGeometry();
  trajectoryLine = new THREE.Line(geometry, material);
  scene.add(trajectoryLine);
}

function updateTrajectory() {
  if (isShooting) {
    trajectoryLine.visible = false;
    return;
  }
  trajectoryLine.visible = true;
  const points = [];
  const startPos = ballGroup.position.clone();
  const targetHoop =
    startPos.distanceTo(hoopPositions[0]) <
    startPos.distanceTo(hoopPositions[1])
      ? hoopPositions[0]
      : hoopPositions[1];
  const direction = new THREE.Vector3()
    .subVectors(targetHoop, startPos)
    .normalize();

  // Use the same tweaked values for trajectory prediction
  const initialSpeed = shotPower / 4;
  const upwardForce = 7;
  const tempVelocity = direction.multiplyScalar(initialSpeed);
  tempVelocity.y += upwardForce;

  let tempPos = startPos.clone();
  for (let i = 0; i < 100; i++) {
    tempVelocity.y += GRAVITY * 0.016; // Use a fixed delta for prediction
    tempPos.add(tempVelocity.clone().multiplyScalar(0.016));
    points.push(tempPos.clone());
    if (tempPos.y < COURT_Y_SURFACE + ballRadius) break;
  }
  trajectoryLine.geometry.setFromPoints(points);
}

function checkCollisions() {
  const ballSphere = new THREE.Sphere(ballGroup.position, ballRadius);

  // Backboard collision
  backboards.forEach((backboard) => {
    const backboardBox = new THREE.Box3().setFromObject(backboard);
    if (backboardBox.intersectsSphere(ballSphere)) {
      // Simple reflection off the backboard
      ballVelocity.x *= -1;
    }
  });

  // Pole collision
  poles.forEach((pole) => {
    const poleBox = new THREE.Box3().setFromObject(pole);
    if (poleBox.intersectsSphere(ballSphere)) {
      ballVelocity.x *= -1;
    }
  });

  // Rim collision
  rims.forEach((rim, index) => {
    const rimCenter = hoopPositions[index];
    const rimRadius = 0.7; // As defined in createBasket
    const rimThickness = 0.02; // As defined in createBasket
    const rimHoleRadius = rimRadius - rimThickness;
    const rimY = rimCenter.y;

    const ballPos = ballGroup.position;
    const horizontalVec = new THREE.Vector3(
      ballPos.x - rimCenter.x,
      0,
      ballPos.z - rimCenter.z
    );
    const horizontalDist = horizontalVec.length();
    const verticalDist = Math.abs(ballPos.y - rimY);

    // Check for potential collision with the rim's torus
    if (
      verticalDist < ballRadius + rimThickness &&
      horizontalDist < rimRadius + ballRadius
    ) {
      // Check for a "swish" (ball going through the hole)
      if (horizontalDist < rimHoleRadius - ballRadius && ballVelocity.y < 0) {
        // Ball is clearly inside the hoop and moving down, let it pass for a score.
        // No collision response needed here.
      } else {
        // It's a bounce off the rim.
        ballVelocity.y *= -RIM_BOUNCINESS; // Reflect and dampen vertical velocity.

        // Add a horizontal bounce away from the rim's center.
        const bounceDirection = horizontalVec.normalize();
        ballVelocity.add(bounceDirection.multiplyScalar(0.5)); // Tweak scalar for bounce strength.
      }
    }
  });
}

function createCourtLines() {
  createCourtMiddleLine();
  createEdgeLines();
  createMiddleCircle();
  createThreePointsLine();
}

function createBasketball() {
  const ballColor = Colors.ORANGE;
  const lineColor = 0x000000;

  const geometry = new THREE.SphereGeometry(ballRadius, 64, 32);
  const material = new THREE.MeshPhongMaterial({
    color: ballColor,
    shininess: 10,
  });
  const ball = new THREE.Mesh(geometry, material);
  ball.castShadow = true;

  // black lines
  const ringMaterial = new THREE.MeshBasicMaterial({ color: lineColor });
  const ringThickness = 0.01;

  const rings = [];

  const ring1 = new THREE.Mesh(
    new THREE.TorusGeometry(ballRadius, ringThickness, 16, 100),
    ringMaterial
  );
  ring1.rotation.x = degrees_to_radians(180) / 2;
  rings.push(ring1);

  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(ballRadius, ringThickness, 16, 100),
    ringMaterial
  );
  ring2.rotation.y = degrees_to_radians(180) / 2;
  rings.push(ring2);

  const ring3 = new THREE.Mesh(
    new THREE.TorusGeometry(ballRadius, ringThickness, 16, 100),
    ringMaterial
  );
  ring3.rotation.y = degrees_to_radians(180) / 4;
  rings.push(ring3);

  const ring4 = new THREE.Mesh(
    new THREE.TorusGeometry(ballRadius, ringThickness, 16, 100),
    ringMaterial
  );
  ring4.rotation.y = -degrees_to_radians(180) / 4;
  rings.push(ring4);

  const ring5 = new THREE.Mesh(
    new THREE.TorusGeometry(ballRadius, ringThickness, 16, 100),
    ringMaterial
  );

  rings.push(ring5);

  ballGroup = new THREE.Group();
  ballGroup.add(ball);
  rings.forEach((ring) => ballGroup.add(ring));

  ballGroup.position.copy(initialBallPosition);
  scene.add(ballGroup);
}

function createCourtMiddleLine() {
  const lineGeometry = new THREE.BoxGeometry(
    LINES_WIDTH,
    LINES_HEIGHT,
    15 - 2 * LINES_WIDTH
  );
  const lineMaterial = new THREE.MeshBasicMaterial({
    color: Colors.WHITE,
  });

  const line = new THREE.Mesh(lineGeometry, lineMaterial);
  line.position.set(0, COURT_Y_SURFACE + LINES_HEIGHT / 2, 0);

  scene.add(line);
}

function createEdgeLines() {
  const material = new THREE.MeshBasicMaterial({ color: Colors.WHITE });
  const Y_POS = COURT_Y_SURFACE + LINES_HEIGHT / 2;
  const edges = [
    // Bottom
    {
      pos: [0, Y_POS, -7.5 + LINES_WIDTH / 2],
      size: [30, LINES_HEIGHT, LINES_THICKNESS],
    },
    // Top
    {
      pos: [0, Y_POS, 7.5 - LINES_WIDTH / 2],
      size: [30, LINES_HEIGHT, LINES_THICKNESS],
    },
    // Left
    {
      pos: [-15 + LINES_WIDTH / 2, Y_POS, 0],
      size: [LINES_THICKNESS, LINES_HEIGHT, 15],
    },
    // Right
    {
      pos: [15 - LINES_WIDTH / 2, Y_POS, 0],
      size: [LINES_THICKNESS, LINES_HEIGHT, 15],
    },
  ];

  addEdges(edges, material);
}

function createMiddleCircle() {
  const innerRadius = 3;

  const geometry = new THREE.RingGeometry(
    innerRadius,
    innerRadius + LINES_WIDTH,
    100
  );

  const material = new THREE.MeshBasicMaterial({
    color: Colors.WHITE,
    side: THREE.DoubleSide,
  });

  const ring = new THREE.Mesh(geometry, material);
  ring.rotation.x = degrees_to_radians(-90);
  ring.position.y = COURT_Y_SURFACE + LINES_HEIGHT / 2;
  scene.add(ring);
}

function createThreePointsLine() {
  createSingleThreePointLine();
  createSingleThreePointLine(true);
  createSingleOnshinPointLine();
  createSingleOnshinPointLine(true);
}

function createSingleOnshinPointLine(mirrored = false) {
  const material = new THREE.MeshBasicMaterial({ color: Colors.WHITE });
  const Y_POS = COURT_Y_SURFACE + LINES_HEIGHT / 2;
  const straightLineLength = 5;
  const onshinPointRadius = 3;
  const distanceFromOnshin = 1;

  const arcGeometry = new THREE.RingGeometry(
    onshinPointRadius - LINES_WIDTH,
    onshinPointRadius,
    64,
    1,
    0,
    degrees_to_radians(180)
  );

  const arc = new THREE.Mesh(arcGeometry, material);
  arc.rotation.x = degrees_to_radians(-90);
  arc.rotation.z = degrees_to_radians(mirrored ? -90 : 90);
  const arcXpos = mirrored
    ? -(15 - straightLineLength)
    : 15 - straightLineLength;
  arc.position.set(arcXpos, Y_POS, 0);

  scene.add(arc);

  const edgesXpos = mirrored
    ? -(15 - LINES_WIDTH - straightLineLength / 2)
    : 15 - LINES_WIDTH - straightLineLength / 2;

  const edges = [
    {
      pos: [edgesXpos, Y_POS, -onshinPointRadius + LINES_WIDTH / 2],
      size: [straightLineLength, LINES_HEIGHT, LINES_WIDTH],
    },
    {
      pos: [edgesXpos, Y_POS, onshinPointRadius - LINES_WIDTH / 2],
      size: [straightLineLength, LINES_HEIGHT, LINES_WIDTH],
    },
    {
      pos: [
        edgesXpos,
        Y_POS,
        -onshinPointRadius + (LINES_WIDTH - distanceFromOnshin) / 2,
      ],
      size: [straightLineLength, LINES_HEIGHT, LINES_WIDTH],
    },
    {
      pos: [
        edgesXpos,
        Y_POS,
        onshinPointRadius - (LINES_WIDTH - distanceFromOnshin) / 2,
      ],
      size: [straightLineLength, LINES_HEIGHT, LINES_WIDTH],
    },
    // parallel line to Z axis
    {
      pos: [arc.position.x, arc.position.y, arc.position.z],
      size: [
        LINES_WIDTH,
        LINES_HEIGHT,
        onshinPointRadius * 2 + distanceFromOnshin,
      ],
    },
  ];

  addEdges(edges), material;
}

function createSingleThreePointLine(mirrored = false) {
  const material = new THREE.MeshBasicMaterial({ color: Colors.WHITE });
  const Y_POS = COURT_Y_SURFACE + LINES_HEIGHT / 2;
  const straightLineLength = 4.26;
  const threePointRadius = 6.2;
  const threePointDegrees = 168;

  const arcGeometry = new THREE.RingGeometry(
    threePointRadius,
    threePointRadius + LINES_WIDTH,
    64,
    1,
    0,
    degrees_to_radians(threePointDegrees)
  );

  const arc = new THREE.Mesh(arcGeometry, material);
  arc.rotation.x = degrees_to_radians(-90);
  arc.rotation.z = degrees_to_radians(
    mirrored
      ? -90 + (180 - threePointDegrees) / 2
      : 90 + (180 - threePointDegrees) / 2
  );
  const arcXpos = mirrored
    ? -(15 - straightLineLength + 0.8)
    : 15 - straightLineLength + 0.8;
  arc.position.set(arcXpos, Y_POS, 0);

  scene.add(arc);
  const edgesXpos = mirrored
    ? -(15 - LINES_WIDTH - straightLineLength / 2)
    : 15 - LINES_WIDTH - straightLineLength / 2;

  const edges = [
    {
      pos: [edgesXpos, Y_POS, -threePointRadius - LINES_WIDTH / 2],
      size: [straightLineLength, LINES_HEIGHT, LINES_WIDTH],
    },
    {
      pos: [edgesXpos, Y_POS, threePointRadius + LINES_WIDTH / 2],
      size: [straightLineLength, LINES_HEIGHT, LINES_WIDTH],
    },
  ];

  addEdges(edges, material);
}

function addEdges(edges, material) {
  edges.forEach((edge) => {
    const geom = new THREE.BoxGeometry(...edge.size);
    const mesh = new THREE.Mesh(geom, material);
    mesh.position.set(...edge.pos);
    scene.add(mesh);
  });
}

function createBothBaskets() {
  createBasket();
  createBasket(true);
}

function createBasket(mirrored = false) {
  const basketGroup = new THREE.Group();
  const poleHeight = 3.05;
  const poleWidth = 0.1;
  const poleDepth = 0.1;
  const poleColor = Colors.WHITE;

  // pole
  const poleGeometry = new THREE.BoxGeometry(poleWidth, poleHeight, poleDepth);
  const poleMaterial = new THREE.MeshPhongMaterial({
    color: poleColor,
    shininess: 30,
  });
  const pole = new THREE.Mesh(poleGeometry, poleMaterial);
  pole.castShadow = true;
  pole.position.set(0, COURT_Y_SURFACE + poleHeight / 2, 0);
  basketGroup.add(pole);
  poles.push(pole);

  // arm
  const armLength = 0.5;
  const armWidth = 0.05;
  const armHeight = 0.1;
  const armGeometry = new THREE.BoxGeometry(armLength, armHeight, armWidth);
  const arm = new THREE.Mesh(armGeometry, poleMaterial);
  arm.castShadow = true;
  arm.position.set(
    0,
    COURT_Y_SURFACE + poleHeight - armHeight / 2,
    mirrored
      ? -poleDepth / 2 - armLength / 2
      : -(-poleDepth / 2 - armLength / 2)
  );
  arm.rotation.y = degrees_to_radians(90);
  basketGroup.add(arm);

  // backboard
  const backboardWidth = 2.3;
  const backboardHeight = 1.8;
  const backboardThickness = 0.03;
  const backboardGeometry = new THREE.BoxGeometry(
    backboardWidth,
    backboardHeight,
    backboardThickness
  );
  const backboardMaterial = new THREE.MeshPhongMaterial({
    color: Colors.WHITE,
    shininess: 50,
    transparent: true,
    opacity: 0.9,
  });
  const backboard = new THREE.Mesh(backboardGeometry, backboardMaterial);
  backboard.castShadow = true;
  backboard.position.set(
    0,
    COURT_Y_SURFACE + poleHeight - armHeight + backboardHeight / 3,
    mirrored ? -armLength - poleDepth / 2 : -(-armLength - poleDepth / 2)
  );
  basketGroup.add(backboard);
  backboards.push(backboard);

  // rim
  const rimRadius = 0.7;
  const rimThickness = 0.02;
  const rimGeometry = new THREE.TorusGeometry(rimRadius, rimThickness, 16, 32);
  const rimMaterial = new THREE.MeshPhongMaterial({
    color: Colors.ORANGE,
    shininess: 30,
  });
  const rim = new THREE.Mesh(rimGeometry, rimMaterial);
  rim.castShadow = true;
  rim.rotation.x = degrees_to_radians(90);
  rim.position.set(
    0,
    COURT_Y_SURFACE + poleHeight,
    mirrored
      ? -backboardThickness - rimThickness - armLength - rimRadius
      : backboardThickness + rimThickness + armLength + rimRadius
  );
  basketGroup.add(rim);
  rims.push(rim);

  // net
  const netGroup = createNetWithLines(rim.position, rimRadius, 0.6, 5, 12);
  basketGroup.add(netGroup);

  const xPos = mirrored ? 15 : -15;
  basketGroup.rotation.y = degrees_to_radians(90);
  basketGroup.position.set(xPos, 0, 0);
  basketGroup.castShadow = true;
  scene.add(basketGroup);

  const hoopWorldPosition = new THREE.Vector3();
  rim.getWorldPosition(hoopWorldPosition);
  hoopPositions.push(hoopWorldPosition);
}

function createNetWithLines(
  rimPosition,
  rimRadius,
  netDepth,
  ringCount,
  verticalLineCount
) {
  const netGroup = new THREE.Group();
  netGroup.position.copy(rimPosition);

  // rings
  for (let i = 0; i < ringCount; i++) {
    const y = -i * (netDepth / (ringCount - 1));
    const ringRadius = rimRadius * (1 - i * 0.08);

    const points = [];
    for (let j = 0; j <= 16; j++) {
      const angle = (j / 16) * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          ringRadius * Math.cos(angle),
          y,
          ringRadius * Math.sin(angle)
        )
      );
    }

    const ringGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const ringMaterial = new THREE.LineBasicMaterial({
      color: Colors.WHITE,
      linewidth: 2,
    });
    const ring = new THREE.LineLoop(ringGeometry, ringMaterial);
    netGroup.add(ring);
  }

  // vertical lines
  for (let i = 0; i < verticalLineCount; i++) {
    const angle = (i / verticalLineCount) * Math.PI * 2;
    const points = [];

    for (let j = 0; j < ringCount; j++) {
      const y = -j * (netDepth / (ringCount - 1));
      const currentRadius = rimRadius * (1 - j * 0.08);
      points.push(
        new THREE.Vector3(
          currentRadius * Math.cos(angle),
          y,
          currentRadius * Math.sin(angle)
        )
      );
    }

    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: Colors.WHITE,
      linewidth: 2,
    });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    netGroup.add(line);
  }

  return netGroup;
}

// Score Element
const currentScore = 0;
const scoreElement = document.createElement("div");
scoreElement.style.position = "absolute";
scoreElement.style.top = "20px";
scoreElement.style.left = "20px";
scoreElement.style.color = "white";
scoreElement.style.fontSize = "16px";
scoreElement.style.fontFamily = "Arial, sans-serif";
scoreElement.style.textAlign = "left";
scoreElement.innerHTML = `
  <h3>Score: ${currentScore}</h3>
`;
document.body.appendChild(scoreElement);
