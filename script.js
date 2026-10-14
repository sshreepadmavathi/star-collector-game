// Star Collector: move the ship with the arrow keys and collect stars.
const playfield = document.querySelector("#playfield");
const player = document.querySelector("#player");
const collectible = document.querySelector("#collectible");
const scoreDisplay = document.querySelector("#score");
const livesDisplay = document.querySelector("#lives");
const lifeHearts = [...document.querySelectorAll(".life-heart")];
const levelDisplay = document.querySelector("#level-display");
const levelProgressDisplay = document.querySelector("#level-progress");
const levelMessage = document.querySelector("#level-message");
const introPanel = document.querySelector("#intro-panel");
const gameOverPanel = document.querySelector("#game-over-panel");
const finalScoreDisplay = document.querySelector("#final-score");
const endEyebrow = document.querySelector("#end-eyebrow");
const endTitle = document.querySelector("#end-title");
const endMessage = document.querySelector("#end-message");
const startButton = document.querySelector("#start-button");
const restartButton = document.querySelector("#restart-button");
const gameStatus = document.querySelector("#game-status");

const MOVE_STEP = 22;
const PLAYER_SIZE = 58;
const STAR_SIZE = 38;
const POINTS_PER_STAR = 10;
const STARTING_LIVES = 3;
const HIT_COOLDOWN_MS = 1000;
const STARS_PER_LEVEL = 5;
const LEVELS = [
  { asteroidCount: 3, speedMultiplier: 0.58, message: "Slow asteroids" },
  { asteroidCount: 3, speedMultiplier: 0.92, message: "Faster asteroids" },
  { asteroidCount: 5, speedMultiplier: 1.3, message: "Fast asteroids · 5 rocks" },
];

const asteroids = [...document.querySelectorAll(".asteroid")].map((element) => ({
  element,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  directionX: 1,
  directionY: 0,
  baseSpeed: 0,
  active: false,
}));

let score = 0;
let lives = STARTING_LIVES;
let currentLevel = 1;
let starsInLevel = 0;
let gameStarted = false;
let starAvailable = false;
let invulnerableUntil = 0;
let animationFrameId = 0;
let lastFrameTime = 0;
let levelMessageTimeout = 0;
let collisionEffectTimeout = 0;
let playerPosition = { x: 0, y: 0 };

function makeBox(x, y, width, height) {
  return { left: x, top: y, right: x + width, bottom: y + height };
}

function boxesOverlap(first, second, gap = 0) {
  return (
    first.left < second.right + gap &&
    first.right + gap > second.left &&
    first.top < second.bottom + gap &&
    first.bottom + gap > second.top
  );
}

function drawPlayer() {
  player.style.left = `${playerPosition.x}px`;
  player.style.top = `${playerPosition.y}px`;
}

function placePlayerAtStart() {
  playerPosition = {
    x: (playfield.clientWidth - PLAYER_SIZE) / 2,
    y: (playfield.clientHeight - PLAYER_SIZE) / 2,
  };
  player.classList.remove("is-hidden");
  drawPlayer();
}

function placeAsteroids() {
  const placedBoxes = [];
  const level = LEVELS[currentLevel - 1];

  asteroids.forEach((asteroid, index) => {
    asteroid.active = index < level.asteroidCount;
    asteroid.element.classList.toggle("is-hidden", !asteroid.active);
    if (!asteroid.active) return;

    const width = asteroid.element.offsetWidth;
    const height = asteroid.element.offsetHeight;
    const maxX = Math.max(0, playfield.clientWidth - width);
    const maxY = Math.max(0, playfield.clientHeight - height);
    const playerBox = makeBox(
      playerPosition.x,
      playerPosition.y,
      PLAYER_SIZE,
      PLAYER_SIZE,
    );
    let candidate = { x: 0, y: 0 };
    let candidateBox;
    let attempts = 0;

    do {
      candidate = {
        x: Math.random() * maxX,
        y: Math.random() * maxY,
      };
      candidateBox = makeBox(candidate.x, candidate.y, width, height);
      attempts += 1;
    } while (
      attempts < 100 &&
      (boxesOverlap(candidateBox, playerBox, 55) ||
        placedBoxes.some((box) => boxesOverlap(candidateBox, box, 36)))
    );

    asteroid.x = candidate.x;
    asteroid.y = candidate.y;
    const angle = Math.random() * Math.PI * 2;
    asteroid.directionX = Math.cos(angle);
    asteroid.directionY = Math.sin(angle);
    asteroid.baseSpeed = 72 + Math.random() * 68;
    asteroid.vx = asteroid.directionX * asteroid.baseSpeed * level.speedMultiplier;
    asteroid.vy = asteroid.directionY * asteroid.baseSpeed * level.speedMultiplier;
    drawAsteroid(asteroid);
    placedBoxes.push(candidateBox);
  });
}

function drawAsteroid(asteroid) {
  asteroid.element.style.left = `${asteroid.x}px`;
  asteroid.element.style.top = `${asteroid.y}px`;
}

function placeStar() {
  const maxX = Math.max(0, playfield.clientWidth - STAR_SIZE);
  const maxY = Math.max(0, playfield.clientHeight - STAR_SIZE);
  const playerBox = makeBox(
    playerPosition.x,
    playerPosition.y,
    PLAYER_SIZE,
    PLAYER_SIZE,
  );
  let candidate = { x: 0, y: 0 };
  let candidateBox;
  let attempts = 0;

  // Give each new star a little space from the ship and moving asteroids.
  do {
    candidate = {
      x: Math.random() * maxX,
      y: Math.random() * maxY,
    };
    candidateBox = makeBox(candidate.x, candidate.y, STAR_SIZE, STAR_SIZE);
    attempts += 1;
  } while (
    attempts < 100 &&
    (boxesOverlap(candidateBox, playerBox, 28) ||
      asteroids.some((asteroid) =>
        asteroid.active &&
        boxesOverlap(
          candidateBox,
          makeBox(
            asteroid.x,
            asteroid.y,
            asteroid.element.offsetWidth,
            asteroid.element.offsetHeight,
          ),
          18,
        ),
      ))
  );

  collectible.style.left = `${candidate.x}px`;
  collectible.style.top = `${candidate.y}px`;
  collectible.classList.remove("is-hidden");
  starAvailable = true;
}

function checkForStar() {
  if (!gameStarted || !starAvailable) return;

  const ship = player.getBoundingClientRect();
  const star = collectible.getBoundingClientRect();
  if (!boxesOverlap(ship, star)) return;

  // Lock this pickup before scoring or moving the next star.
  starAvailable = false;
  score += POINTS_PER_STAR;
  starsInLevel += 1;
  scoreDisplay.textContent = String(score);

  if (starsInLevel === STARS_PER_LEVEL) {
    if (currentLevel === LEVELS.length) {
      levelProgressDisplay.textContent = `Stars: ${STARS_PER_LEVEL} / ${STARS_PER_LEVEL}`;
      winGame();
      return;
    }

    currentLevel += 1;
    starsInLevel = 0;
    renderLevel();
    placeAsteroids();
    placeStar();
    announceLevel();
    return;
  }

  renderLevel();
  gameStatus.textContent = `Nice catch! Your score is ${score}.`;
  placeStar();
}

function renderLevel() {
  levelDisplay.textContent = String(currentLevel);
  levelProgressDisplay.textContent = `Stars: ${starsInLevel} / ${STARS_PER_LEVEL}`;
}

function announceLevel() {
  const level = LEVELS[currentLevel - 1];
  levelMessage.textContent = `LEVEL ${currentLevel}  ·  ${level.message}`;
  levelMessage.classList.remove("is-hidden");
  gameStatus.textContent = `Level ${currentLevel} started — ${level.message.toLowerCase()}.`;

  window.clearTimeout(levelMessageTimeout);
  levelMessageTimeout = window.setTimeout(() => {
    levelMessage.classList.add("is-hidden");
  }, 1900);
}

function movePlayer(key) {
  const maxX = playfield.clientWidth - PLAYER_SIZE;
  const maxY = playfield.clientHeight - PLAYER_SIZE;

  if (key === "ArrowUp") {
    playerPosition.y -= MOVE_STEP;
  } else if (key === "ArrowDown") {
    playerPosition.y += MOVE_STEP;
  } else if (key === "ArrowLeft") {
    playerPosition.x -= MOVE_STEP;
  } else if (key === "ArrowRight") {
    playerPosition.x += MOVE_STEP;
  }

  // Keep the spaceship inside the playfield.
  playerPosition.x = Math.max(0, Math.min(maxX, playerPosition.x));
  playerPosition.y = Math.max(0, Math.min(maxY, playerPosition.y));
  drawPlayer();
  checkForStar();
}

function updateAsteroids(secondsElapsed) {
  asteroids.forEach((asteroid) => {
    if (!asteroid.active) return;

    const maxX = playfield.clientWidth - asteroid.element.offsetWidth;
    const maxY = playfield.clientHeight - asteroid.element.offsetHeight;

    asteroid.x += asteroid.vx * secondsElapsed;
    asteroid.y += asteroid.vy * secondsElapsed;

    if (asteroid.x <= 0 || asteroid.x >= maxX) {
      asteroid.x = Math.max(0, Math.min(maxX, asteroid.x));
      asteroid.vx *= -1;
    }
    if (asteroid.y <= 0 || asteroid.y >= maxY) {
      asteroid.y = Math.max(0, Math.min(maxY, asteroid.y));
      asteroid.vy *= -1;
    }

    drawAsteroid(asteroid);
  });
}

function showCollisionEffect() {
  window.clearTimeout(collisionEffectTimeout);
  player.classList.remove("collision-flash");
  // Restart the animation even if another hit effect just finished.
  void player.offsetWidth;
  player.classList.add("collision-flash");
  collisionEffectTimeout = window.setTimeout(
    () => player.classList.remove("collision-flash"),
    420,
  );
}

function renderLives() {
  lifeHearts.forEach((heart, index) => {
    heart.classList.toggle("life-lost", index >= lives);
  });
  livesDisplay.setAttribute(
    "aria-label",
    `${lives} ${lives === 1 ? "life" : "lives"} remaining`,
  );
}

function checkForAsteroidCollision(now) {
  if (now < invulnerableUntil) return;

  const ship = player.getBoundingClientRect();
  const collided = asteroids.some((asteroid) =>
    asteroid.active &&
    boxesOverlap(ship, asteroid.element.getBoundingClientRect()),
  );
  if (!collided) return;

  lives -= 1;
  renderLives();
  showCollisionEffect();
  invulnerableUntil = now + HIT_COOLDOWN_MS;

  if (lives === 0) {
    endGame();
  } else {
    gameStatus.textContent = `${lives} ${lives === 1 ? "life" : "lives"} left — dodge the asteroids!`;
  }
}

function updateGame(timestamp) {
  if (!gameStarted) return;

  if (lastFrameTime === 0) lastFrameTime = timestamp;
  const secondsElapsed = Math.min((timestamp - lastFrameTime) / 1000, 0.05);
  lastFrameTime = timestamp;

  updateAsteroids(secondsElapsed);
  checkForAsteroidCollision(timestamp);

  if (gameStarted) {
    animationFrameId = window.requestAnimationFrame(updateGame);
  }
}

function startGame() {
  if (gameStarted) return;

  gameStarted = true;
  score = 0;
  lives = STARTING_LIVES;
  currentLevel = 1;
  starsInLevel = 0;
  starAvailable = false;
  invulnerableUntil = 0;
  lastFrameTime = 0;
  window.clearTimeout(levelMessageTimeout);
  window.clearTimeout(collisionEffectTimeout);
  scoreDisplay.textContent = "0";
  renderLives();
  renderLevel();
  player.classList.remove("collision-flash");
  placePlayerAtStart();
  placeAsteroids();
  placeStar();
  introPanel.classList.add("is-hidden");
  gameOverPanel.classList.add("is-hidden");
  gameOverPanel.classList.remove("victory-panel");
  levelMessage.classList.add("is-hidden");
  gameStatus.textContent = "Collect stars and steer clear of the asteroids.";
  playfield.focus();
  announceLevel();
  animationFrameId = window.requestAnimationFrame(updateGame);
}

function endGame() {
  showEndScreen(false);
}

function winGame() {
  showEndScreen(true);
}

function showEndScreen(won) {
  gameStarted = false;
  window.cancelAnimationFrame(animationFrameId);
  window.clearTimeout(levelMessageTimeout);
  levelMessage.classList.add("is-hidden");
  finalScoreDisplay.textContent = String(score);
  endEyebrow.textContent = won ? "Mission complete" : "Flight complete";
  endTitle.textContent = won ? "Victory!" : "Game Over";
  endMessage.textContent = won
    ? "You collected all 15 stars! Final score:"
    : "Final score:";
  gameOverPanel.classList.toggle("victory-panel", won);
  gameOverPanel.classList.remove("is-hidden");
  gameStatus.textContent = won
    ? `Victory! Final score: ${score}.`
    : `Game over. Final score: ${score}.`;
  restartButton.focus();
}

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);

document.addEventListener("keydown", (event) => {
  const arrowKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
  if (!gameStarted || !arrowKeys.includes(event.key)) return;

  // Prevent the browser from scrolling while the player is moving.
  event.preventDefault();
  movePlayer(event.key);
});

// Keep every moving object within the playfield if the window is resized.
window.addEventListener("resize", () => {
  if (!gameStarted) return;

  playerPosition.x = Math.max(
    0,
    Math.min(playerPosition.x, playfield.clientWidth - PLAYER_SIZE),
  );
  playerPosition.y = Math.max(
    0,
    Math.min(playerPosition.y, playfield.clientHeight - PLAYER_SIZE),
  );
  drawPlayer();

  asteroids.forEach((asteroid) => {
    if (!asteroid.active) return;

    asteroid.x = Math.max(
      0,
      Math.min(asteroid.x, playfield.clientWidth - asteroid.element.offsetWidth),
    );
    asteroid.y = Math.max(
      0,
      Math.min(asteroid.y, playfield.clientHeight - asteroid.element.offsetHeight),
    );
    drawAsteroid(asteroid);
  });

  placeStar();
});
