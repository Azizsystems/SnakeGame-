const canvas = document.querySelector(".canvas");
const ctx = canvas.getContext("2d");

// Scoreboard & UI elements
const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("high-score");
const restartBtn = document.getElementById("restart-btn");
const soundBtn = document.getElementById("sound-btn");
const pauseBtn = document.getElementById("pause-btn");

// ==========================================
// WEB AUDIO API (RETRO SOUND EFFECTS)
// ==========================================
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
let soundEnabled = true;

function toggleSound() {
  soundEnabled = !soundEnabled;
  soundBtn.textContent = soundEnabled ? "🔊 ON" : "🔇 OFF";
  soundBtn.blur();
}

function unlockAudio() {
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

// Retro 8-bit coin/pickup sound when eating normal food
function playEatSound() {
  if (!soundEnabled) return;
  unlockAudio();

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "square";
  osc.frequency.setValueAtTime(587.33, now);
  osc.frequency.setValueAtTime(880, now + 0.06);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.15);
}

// Subtle shimmer chime when golden food spawns
function playGoldenSpawnSound() {
  if (!soundEnabled) return;
  unlockAudio();

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(659.25, now); // E5
  osc.frequency.setValueAtTime(987.77, now + 0.05); // B5

  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.15);
}

// 3-note 8-bit fanfare when eating golden food (+5 points)
function playGoldenEatSound() {
  if (!soundEnabled) return;
  unlockAudio();

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "square";
  osc.frequency.setValueAtTime(523.25, now); // C5
  osc.frequency.setValueAtTime(659.25, now + 0.07); // E5
  osc.frequency.setValueAtTime(1046.5, now + 0.14); // C6

  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.3);
}

// Short retro blip when pausing/resuming
function playPauseSound(pausing) {
  if (!soundEnabled) return;
  unlockAudio();

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(pausing ? 440 : 660, now);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.1);
}

// Retro descending buzz when the game ends
function playGameOverSound() {
  if (!soundEnabled) return;
  unlockAudio();

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.linearRampToValueAtTime(80, now + 0.45);

  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.45);
}

// ==========================================
// GAME CONFIGURATION & LOGIC
// ==========================================
const scale = 20;
const goldenScale = scale * 2;
const rows = canvas.height / scale;
const columns = canvas.width / scale;

const gameSpeed = 140;
const goldenDurationMs = 6000;
const goldenDurationTicks = Math.round(goldenDurationMs / gameSpeed);

const plusOneFontSize = 18;
const plusFiveFontSize = plusOneFontSize * 2;

let score = 0;
let highScore = localStorage.getItem("snakeHighScore") || 0;
highScoreEl.textContent = highScore;

let snake = [];
let food = {};
let goldenFood = null;
let floatingTexts = [];
let particles = [];
let d = "right";
let changingDirection = false;
let isPaused = false;
let isGameOver = false;
let playGame;

// Initialize the game state
function initGame() {
  score = 0;
  scoreEl.textContent = score;
  d = "right";
  changingDirection = false;
  isPaused = false;
  isGameOver = false;
  goldenFood = null;
  floatingTexts = [];
  particles = [];

  pauseBtn.textContent = "⏸ Pause";
  pauseBtn.disabled = false;
  restartBtn.style.display = "none";

  // Initial head of the snake
  snake = [
    {
      x: Math.floor(Math.random() * columns) * scale,
      y: Math.floor(Math.random() * rows) * scale,
    },
  ];

  spawnFood();

  clearInterval(playGame);
  playGame = setInterval(draw, gameSpeed);
}

// Toggle Pause / Resume state
function togglePause() {
  if (isGameOver) return;

  isPaused = !isPaused;
  playPauseSound(isPaused);
  pauseBtn.blur();

  if (isPaused) {
    clearInterval(playGame);
    pauseBtn.textContent = "▶ Resume";
    drawPauseScreen();
  } else {
    pauseBtn.textContent = "⏸ Pause";
    playGame = setInterval(draw, gameSpeed);
  }
}

// Generate regular food at a random grid position
function spawnFood() {
  food = {
    x: Math.floor(Math.random() * columns) * scale,
    y: Math.floor(Math.random() * rows) * scale,
  };
}

// Generate 2x-sized golden bonus food for 6 seconds
function spawnGoldenFood() {
  let gx, gy;
  let overlapsNormalFood = false;

  do {
    gx = Math.floor(Math.random() * (columns - 1)) * scale;
    gy = Math.floor(Math.random() * (rows - 1)) * scale;

    overlapsNormalFood =
      food.x >= gx &&
      food.x < gx + goldenScale &&
      food.y >= gy &&
      food.y < gy + goldenScale;
  } while (overlapsNormalFood);

  goldenFood = {
    x: gx,
    y: gy,
    timer: goldenDurationTicks,
    maxTimer: goldenDurationTicks,
  };
  playGoldenSpawnSound();
}

// Spawn a burst of retro square pixels at the eaten food's location
function spawnParticles(x, y, size, colors, count) {
  const centerX = x + size / 2;
  const centerY = y + size / 2;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 6;
    const life = 6 + Math.floor(Math.random() * 5);

    particles.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 4 + Math.floor(Math.random() * 3),
      color: colors[Math.floor(Math.random() * colors.length)],
      life: life,
      maxLife: life,
    });
  }
}

// Draw and update all active pixel particles
function drawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];

    ctx.save();
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.restore();

    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.9;
    p.vy *= 0.9;
    p.life--;

    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

// Create a floating score pop-up at the eaten food's coordinates
function spawnFloatingText(text, x, y, boxSize, color, fontSize) {
  const clampedX = Math.min(Math.max(x + boxSize / 2, 35), canvas.width - 35);
  const clampedY = Math.max(y, 40);

  floatingTexts.push({
    text: text,
    x: clampedX,
    y: clampedY,
    color: color,
    fontSize: fontSize,
    life: 10,
    maxLife: 10,
  });
}

// Draw and update all active floating score pop-ups
function drawFloatingTexts() {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const item = floatingTexts[i];

    ctx.save();
    ctx.globalAlpha = item.life / item.maxLife;
    ctx.font = "bold " + item.fontSize + "px Arial";
    ctx.textAlign = "center";

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 4;
    ctx.strokeText(item.text, item.x, item.y);

    ctx.fillStyle = item.color;
    ctx.fillText(item.text, item.x, item.y);
    ctx.restore();

    item.y -= 3;
    item.life--;

    if (item.life <= 0) {
      floatingTexts.splice(i, 1);
    }
  }
}

// Draw directional eyes on the snake's head
function drawSnakeEyes(hx, hy) {
  ctx.fillStyle = "#fff"; // White eyeball background
  ctx.strokeStyle = "#000"; // Black pupil / outline
  ctx.lineWidth = 1;

  let eye1X, eye1Y, eye2X, eye2Y;
  let p1X, p1Y, p2X, p2Y;

  const offsetFromEdge = 4;
  const eyeSpacing = 6;
  const eyeSize = 4;
  const pupilSize = 2;

  if (d === "right") {
    eye1X = hx + scale - offsetFromEdge - 2;
    eye1Y = hy + eyeSpacing;
    eye2X = hx + scale - offsetFromEdge - 2;
    eye2Y = hy + scale - eyeSpacing - eyeSize;

    p1X = eye1X + 2;
    p1Y = eye1Y + 1;
    p2X = eye2X + 2;
    p2Y = eye2Y + 1;
  } else if (d === "left") {
    eye1X = hx + offsetFromEdge;
    eye1Y = hy + eyeSpacing;
    eye2X = hx + offsetFromEdge;
    eye2Y = hy + scale - eyeSpacing - eyeSize;

    p1X = eye1X;
    p1Y = eye1Y + 1;
    p2X = eye2X;
    p2Y = eye2Y + 1;
  } else if (d === "up") {
    eye1X = hx + eyeSpacing;
    eye1Y = hy + offsetFromEdge;
    eye2X = hx + scale - eyeSpacing - eyeSize;
    eye2Y = hy + offsetFromEdge;

    p1X = eye1X + 1;
    p1Y = eye1Y;
    p2X = eye2X + 1;
    p2Y = eye2Y;
  } else if (d === "down") {
    eye1X = hx + eyeSpacing;
    eye1Y = hy + scale - offsetFromEdge - eyeSize;
    eye2X = hx + scale - eyeSpacing - eyeSize;
    eye2Y = hy + scale - offsetFromEdge - eyeSize;

    p1X = eye1X + 1;
    p1Y = eye1Y + 2;
    p2X = eye2X + 1;
    p2Y = eye2Y + 2;
  }

  // Draw eyeballs
  ctx.fillRect(eye1X, eye1Y, eyeSize, eyeSize);
  ctx.fillRect(eye2X, eye2Y, eyeSize, eyeSize);

  // Draw pupils facing movement direction
  ctx.fillStyle = "#000";
  ctx.fillRect(p1X, p1Y, pupilSize, pupilSize);
  ctx.fillRect(p2X, p2Y, pupilSize, pupilSize);
}

// Update score and check high score
function addScore(points) {
  score += points;
  scoreEl.textContent = score;

  if (score > highScore) {
    highScore = score;
    highScoreEl.textContent = highScore;
    localStorage.setItem("snakeHighScore", highScore);
  }
}

// Use the keyboard keys to control the snake, pause, or restart on Game Over
document.addEventListener("keydown", direction);

function direction(event) {
  unlockAudio();

  let key = event.keyCode;

  if (isGameOver) {
    if (
      key === 32 ||
      key === 13 ||
      event.code === "Space" ||
      event.code === "Enter"
    ) {
      event.preventDefault();
      restartGame();
    }
    return;
  }

  if (key === 32 || event.code === "Space") {
    event.preventDefault();
    togglePause();
    return;
  }

  if (isPaused || changingDirection) return;

  if (key == 37 && d != "right") {
    d = "left";
    changingDirection = true;
  } else if (key == 38 && d != "down") {
    d = "up";
    changingDirection = true;
  } else if (key == 39 && d != "left") {
    d = "right";
    changingDirection = true;
  } else if (key == 40 && d != "up") {
    d = "down";
    changingDirection = true;
  }
}

// Function to draw our snake and the food
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  changingDirection = false;

  // Draw snake body
  for (let i = 1; i < snake.length; i++) {
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "red";
    ctx.fillRect(snake[i].x, snake[i].y, scale, scale);
    ctx.strokeRect(snake[i].x, snake[i].y, scale, scale);
  }

  // Draw snake head
  if (snake.length > 0) {
    ctx.fillStyle = "#00ff88";
    ctx.strokeStyle = "red";
    ctx.fillRect(snake[0].x, snake[0].y, scale, scale);
    ctx.strokeRect(snake[0].x, snake[0].y, scale, scale);

    // Draw eyes tracking current direction on the head
    drawSnakeEyes(snake[0].x, snake[0].y);
  }

  // Draw normal food (20x20)
  ctx.fillStyle = "#ff0";
  ctx.strokeStyle = "green";
  ctx.fillRect(food.x, food.y, scale, scale);
  ctx.strokeRect(food.x, food.y, scale, scale);

  // Draw & update Golden Food if active (40x40)
  if (goldenFood) {
    ctx.fillStyle = goldenFood.timer % 2 === 0 ? "#ffd700" : "#ff8800";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.fillRect(goldenFood.x, goldenFood.y, goldenScale, goldenScale);
    ctx.strokeRect(goldenFood.x, goldenFood.y, goldenScale, goldenScale);
    ctx.lineWidth = 1;

    const barY =
      goldenFood.y >= 8 ? goldenFood.y - 7 : goldenFood.y + goldenScale + 3;
    const barWidth = (goldenFood.timer / goldenFood.maxTimer) * goldenScale;
    ctx.fillStyle = "#ffd700";
    ctx.fillRect(goldenFood.x, barY, barWidth, 4);

    goldenFood.timer--;
    if (goldenFood.timer <= 0) {
      goldenFood = null;
    }
  }

  // Old head position
  let snakeX = snake[0].x;
  let snakeY = snake[0].y;

  // Move in current direction
  if (d == "left") snakeX -= scale;
  if (d == "up") snakeY -= scale;
  if (d == "right") snakeX += scale;
  if (d == "down") snakeY += scale;

  // Wrap around canvas edges seamlessly
  if (snakeX >= canvas.width) {
    snakeX = 0;
  }
  if (snakeY >= canvas.height) {
    snakeY = 0;
  }
  if (snakeX < 0) {
    snakeX = canvas.width - scale;
  }
  if (snakeY < 0) {
    snakeY = canvas.height - scale;
  }

  // New head position
  let newHead = {
    x: snakeX,
    y: snakeY,
  };

  let ateFood = false;

  // Check if snake eats normal food (+1 point)
  if (snakeX == food.x && snakeY == food.y) {
    ateFood = true;
    addScore(1);
    playEatSound();
    spawnParticles(food.x, food.y, scale, ["#ff0", "#00ff88", "#fff"], 12);
    spawnFloatingText("+1", food.x, food.y, scale, "#00ff88", plusOneFontSize);
    spawnFood();

    if (!goldenFood && Math.random() < 0.3) {
      spawnGoldenFood();
    }
  }

  // Check if snake head touches any part of the 2x2 Golden Food (+5 points)
  if (
    goldenFood &&
    snakeX >= goldenFood.x &&
    snakeX < goldenFood.x + goldenScale &&
    snakeY >= goldenFood.y &&
    snakeY < goldenFood.y + goldenScale
  ) {
    ateFood = true;
    addScore(5);
    playGoldenEatSound();
    spawnParticles(
      goldenFood.x,
      goldenFood.y,
      goldenScale,
      ["#ffd700", "#ff8800", "#fff"],
      26,
    );
    spawnFloatingText(
      "+5!",
      goldenFood.x,
      goldenFood.y,
      goldenScale,
      "#ffd700",
      plusFiveFontSize,
    );
    goldenFood = null;
  }

  if (!ateFood) {
    snake.pop();
  }

  if (eatSelf(newHead, snake)) {
    isGameOver = true;
    pauseBtn.disabled = true;
    playGameOverSound();
    clearInterval(playGame);
    drawGameOver();
    return;
  }

  snake.unshift(newHead);

  drawParticles();
  drawFloatingTexts();
}

// Check if snake is eating itself
function eatSelf(head, array) {
  for (let i = 0; i < array.length; i++) {
    if (head.x == array[i].x && head.y == array[i].y) {
      return true;
    }
  }
  return false;
}

// Display Paused overlay on the canvas
function drawPauseScreen() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ff0";
  ctx.font = "bold 36px Arial";
  ctx.textAlign = "center";
  ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2 - 10);

  ctx.fillStyle = "#fff";
  ctx.font = "16px Arial";
  ctx.fillText(
    "Press SPACE or click Resume to continue",
    canvas.width / 2,
    canvas.height / 2 + 25,
  );
}

// Display Game Over overlay on the canvas and show the Play Again button
function drawGameOver() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ff4444";
  ctx.font = "bold 44px Arial";
  ctx.textAlign = "center";
  ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 55);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 22px Arial";
  ctx.fillText(
    "Final Score: " + score,
    canvas.width / 2,
    canvas.height / 2 - 10,
  );

  ctx.fillStyle = "#aaa";
  ctx.font = "14px Arial";
  ctx.fillText(
    "Click Play Again or press ENTER / SPACE",
    canvas.width / 2,
    canvas.height / 2 + 125,
  );

  restartBtn.style.display = "block";
}

// Restart the game when Play Again button is clicked
function restartGame() {
  restartBtn.blur();
  initGame();
}

// Start the game on load
initGame();
