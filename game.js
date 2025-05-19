// Game canvas and context
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Sound effects
const sounds = {
  paddleHit: document.getElementById("paddleHitSound"),
  blockCrack: document.getElementById("blockCrackSound"),
  blockBreak: document.getElementById("blockBreakSound"),
  laserShoot: document.getElementById("laserShootSound"),
  paddleShrink: document.getElementById("paddleShrinkSound"),
  paddleGrow: document.getElementById("paddleGrowSound"),
  gotBlasters: document.getElementById("gotBlastersSound"),
  gameStart: document.getElementById("gameStartSound"),
  gameOver: document.getElementById("gameOverSound"),
  lifeLost: document.getElementById("lifeLostSound"),
  levelWon: document.getElementById("levelWonSound"),
};

// Laser sound state
let laserSoundPlaying = false;
let laserSoundInterval = null;

// Sound toggle
let soundEnabled = true;

// Function to play sound if enabled
function playSound(sound) {
  if (soundEnabled && sound) {
    // Reset the sound to the beginning if it's already playing
    sound.currentTime = 0;
    sound.play().catch((e) => {
      // Ignore autoplay errors - browser might require user interaction first
      console.log("Sound play error:", e);
    });
  }
}

// Function to start continuous laser sound
function startLaserSound() {
  if (soundEnabled && !laserSoundPlaying) {
    laserSoundPlaying = true;

    // Play the sound immediately
    playSound(sounds.laserShoot);

    // Set up interval to replay the sound when it ends
    laserSoundInterval = setInterval(() => {
      if (soundEnabled && laserSoundPlaying) {
        // Only restart if the sound has finished or nearly finished
        if (
          sounds.laserShoot.currentTime >= sounds.laserShoot.duration - 0.1 ||
          sounds.laserShoot.paused
        ) {
          sounds.laserShoot.currentTime = 0;
          sounds.laserShoot.play().catch((e) => {
            console.log("Laser sound loop error:", e);
          });
        }
      }
    }, 100); // Check frequently to ensure smooth looping
  }
}

// Function to stop continuous laser sound
function stopLaserSound() {
  if (laserSoundPlaying) {
    laserSoundPlaying = false;
    clearInterval(laserSoundInterval);
  }
}

// Game elements
let paddle;
let ball;
let blocks = [];
let powerups = [];
let lasers = [];
let score = 0;
let lives = 3;
const MAX_BLOCK_HITS = 3; // Maximum hits for bottom row blocks
let gameRunning = false;
let animationId;
let activePowerups = {
  blasters: false,
  blasterLevel: 0, // 0 = none, 1 = single, 2 = double
  small: false,
  big: false,
};
let lastLaserTime = 0;
let powerupTimers = {
  blasters: null,
  small: null,
  big: null,
};

// Game constants
const PADDLE_WIDTH = 100;
const PADDLE_HEIGHT = 15;
const PADDLE_SPEED = 7;
const BALL_RADIUS = 10;

// Difficulty settings
const DIFFICULTY_SPEEDS = {
  easy: 2,
  medium: 5,
  hard: 7,
  master: 9,
};
let currentDifficulty = "medium";
let BALL_SPEED = DIFFICULTY_SPEEDS[currentDifficulty];
const BLOCK_ROWS = 5;
const BLOCK_COLUMNS = 8;
const BLOCK_WIDTH = 80;
const BLOCK_HEIGHT = 30;
const BLOCK_PADDING = 10;
const BLOCK_OFFSET_TOP = 60;
const BLOCK_OFFSET_LEFT = 35;

// Power-up constants
const POWERUP_WIDTH = 30;
const POWERUP_HEIGHT = 30;
const POWERUP_SPEED = 2;
const POWERUP_DURATION = 10000; // 10 seconds in milliseconds
// Spawn chance varies by difficulty and powerup type
const POWERUP_SPAWN_CHANCES = {
  easy: {
    blasters: 0.05, // 5% chance for blasters on easy
    small: 0.03, // 3% chance for small paddle on easy
    big: 0.05, // 5% chance for big paddle on easy
  },
  medium: {
    blasters: 0.03, // 2% chance for blasters on medium
    small: 0.02, // 2% chance for small paddle on medium
    big: 0.03, // 2% chance for big paddle on medium
  },
  hard: {
    blasters: 0.01, // 1% chance for blasters on hard
    small: 0.02, // 1% chance for small paddle on hard
    big: 0.01, // 1% chance for big paddle on hard
  },
  master: {
    blasters: 0.005, // 0.5% chance for blasters on master
    small: 0.01, // 0.5% chance for small paddle on master
    big: 0.005, // 0.5% chance for big paddle on master
  },
};
// Total spawn chance (sum of all powerup chances for current difficulty)
let POWERUP_SPAWN_CHANCE = Object.values(POWERUP_SPAWN_CHANCES.medium).reduce(
  (a, b) => a + b,
  0
);
const LASER_WIDTH = 4;
const LASER_HEIGHT = 15;
const LASER_SPEED = 7;
const LASER_COOLDOWN = 500; // 0.5 seconds between shots
const SINGLE_BLASTERS = 1; // Regular blasters (2 lasers)
const DOUBLE_BLASTERS = 2; // Double blasters (4 lasers)

// Paddle size modifications
const PADDLE_DOUBLE_SMALL_WIDTH = 40; // Double small paddle width
const PADDLE_SMALL_WIDTH = 60; // Small paddle width
const PADDLE_NORMAL_WIDTH = 100; // Normal paddle width
const PADDLE_BIG_WIDTH = 150; // Big paddle width
const PADDLE_DOUBLE_BIG_WIDTH = 200; // Double big paddle width

// Controls
let rightPressed = false;
let leftPressed = false;

// Set game difficulty
function setDifficulty() {
  const difficultySelect = document.getElementById("difficulty");
  currentDifficulty = difficultySelect.value;
  BALL_SPEED = DIFFICULTY_SPEEDS[currentDifficulty];
  // Calculate total spawn chance as sum of all powerup type chances for current difficulty
  POWERUP_SPAWN_CHANCE = Object.values(
    POWERUP_SPAWN_CHANCES[currentDifficulty]
  ).reduce((a, b) => a + b, 0);
}

// Initialize game elements
function initGame() {
  // Set difficulty
  setDifficulty();
  updateDifficultyInfo();
  // Create paddle
  paddle = {
    x: canvas.width / 2 - PADDLE_WIDTH / 2,
    y: canvas.height - PADDLE_HEIGHT - 10,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    dx: PADDLE_SPEED,
  };

  // Create ball
  ball = {
    x: canvas.width / 2,
    y: paddle.y - BALL_RADIUS,
    radius: BALL_RADIUS,
    dx: BALL_SPEED,
    dy: -BALL_SPEED,
  };

  // Create blocks
  createBlocks();

  // Add a guaranteed power-up at the start
  setTimeout(() => {
    if (gameRunning) {
      // Find a visible block to spawn the power-up from
      const visibleBlocks = blocks.filter((block) => block.visible);
      if (visibleBlocks.length > 0) {
        const randomBlock =
          visibleBlocks[Math.floor(Math.random() * visibleBlocks.length)];
        // Randomly select one of the powerup types for the initial guaranteed powerup
        const powerupTypes = ["blasters", "small", "big"];
        const randomType =
          powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
        generatePowerup(
          randomBlock.x + randomBlock.width / 2 - POWERUP_WIDTH / 2,
          randomBlock.y,
          randomType
        );
      }
    }
  }, 3000); // Wait 3 seconds after game starts

  // Reset score and lives
  score = 0;
  lives = 3;
  updateScore();
  updateLives();

  // Reset power-ups
  powerups = [];
  lasers = [];
  activePowerups.blasters = false;
  activePowerups.blasterLevel = 0;
  activePowerups.small = false;
  activePowerups.big = false;
  clearTimeout(powerupTimers.blasters);
  clearTimeout(powerupTimers.small);
  clearTimeout(powerupTimers.big);

  // Reset paddle size to normal
  paddle.width = PADDLE_NORMAL_WIDTH;
}

// Create blocks
function createBlocks() {
  blocks = [];
  for (let r = 0; r < BLOCK_ROWS; r++) {
    for (let c = 0; c < BLOCK_COLUMNS; c++) {
      const blockX = c * (BLOCK_WIDTH + BLOCK_PADDING) + BLOCK_OFFSET_LEFT;
      const blockY = r * (BLOCK_HEIGHT + BLOCK_PADDING) + BLOCK_OFFSET_TOP;

      // Assign different colors based on row
      let color;
      switch (r) {
        case 0:
          color = "#FF5252";
          break; // Red
        case 1:
          color = "#FF9800";
          break; // Orange
        case 2:
          color = "#FFEB3B";
          break; // Yellow
        case 3:
          color = "#4CAF50";
          break; // Green
        case 4:
          color = "#2196F3";
          break; // Blue
        default:
          color = "#9C27B0";
          break; // Purple
      }

      // Bottom row blocks require 3 hits
      const hitsRequired = r === BLOCK_ROWS - 1 ? MAX_BLOCK_HITS : 1;

      blocks.push({
        x: blockX,
        y: blockY,
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        color: color,
        visible: true,
        hits: 0,
        hitsRequired: hitsRequired,
      });
    }
  }
}

// Draw paddle
function drawPaddle() {
  ctx.beginPath();
  ctx.rect(paddle.x, paddle.y, paddle.width, paddle.height);
  ctx.fillStyle = "#0095DD";
  ctx.fill();
  ctx.closePath();
}

// Draw ball
function drawBall() {
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#0095DD";
  ctx.fill();
  ctx.closePath();
}

// Draw blocks
function drawBlocks() {
  blocks.forEach((block) => {
    if (block.visible) {
      ctx.beginPath();
      ctx.rect(block.x, block.y, block.width, block.height);
      ctx.fillStyle = block.color;
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.strokeRect(block.x, block.y, block.width, block.height);

      // Draw cracks if block has been hit but not destroyed
      if (block.hits > 0 && block.hits < block.hitsRequired) {
        // Draw cracks based on number of hits
        ctx.strokeStyle = "#FFF";
        ctx.lineWidth = 1;

        if (block.hits >= 1) {
          // First hit crack pattern - spider web from impact point
          const centerX = block.x + block.width * 0.3;
          const centerY = block.y + block.height * 0.4;

          // Main cracks
          ctx.beginPath();
          // Horizontal crack
          ctx.moveTo(centerX - 15, centerY);
          ctx.lineTo(centerX + 25, centerY);
          // Diagonal cracks
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(centerX + 20, centerY - 15);
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(centerX + 15, centerY + 12);
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(centerX - 10, centerY - 10);
          ctx.stroke();

          // Small connecting cracks
          ctx.beginPath();
          ctx.lineWidth = 0.5;
          ctx.moveTo(centerX + 15, centerY);
          ctx.lineTo(centerX + 12, centerY - 8);
          ctx.moveTo(centerX + 5, centerY);
          ctx.lineTo(centerX + 8, centerY + 5);
          ctx.moveTo(centerX - 5, centerY);
          ctx.lineTo(centerX - 8, centerY - 5);
          ctx.stroke();
        }

        if (block.hits >= 2) {
          // Second hit - more extensive cracking
          ctx.lineWidth = 1.5;

          // Second impact point
          const centerX2 = block.x + block.width * 0.7;
          const centerY2 = block.y + block.height * 0.6;

          // Main cracks from second impact
          ctx.beginPath();
          ctx.moveTo(centerX2, centerY2);
          ctx.lineTo(centerX2 + 25, centerY2 + 10);
          ctx.moveTo(centerX2, centerY2);
          ctx.lineTo(centerX2 - 20, centerY2 + 5);
          ctx.moveTo(centerX2, centerY2);
          ctx.lineTo(centerX2 - 10, centerY2 - 15);
          ctx.moveTo(centerX2, centerY2);
          ctx.lineTo(centerX2 + 5, centerY2 - 10);
          ctx.stroke();

          // Connecting cracks between impact points
          ctx.beginPath();
          ctx.moveTo(
            block.x + block.width * 0.3 + 15,
            block.y + block.height * 0.4
          );
          ctx.lineTo(
            block.x + block.width * 0.7 - 15,
            block.y + block.height * 0.6
          );
          ctx.stroke();

          // Small debris/fragments
          ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
          ctx.beginPath();
          ctx.arc(centerX2 + 15, centerY2 + 5, 1, 0, Math.PI * 2);
          ctx.arc(centerX2 - 10, centerY2 + 3, 1.5, 0, Math.PI * 2);
          ctx.arc(centerX2 + 5, centerY2 - 5, 1, 0, Math.PI * 2);
          ctx.fill();

          // Add some block color variation to show damage
          ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
          ctx.beginPath();
          ctx.moveTo(centerX2, centerY2);
          ctx.lineTo(centerX2 + 15, centerY2 + 5);
          ctx.lineTo(centerX2 + 10, centerY2 + 15);
          ctx.lineTo(centerX2 - 5, centerY2 + 10);
          ctx.fill();
        }

        ctx.lineWidth = 1;
      }

      ctx.closePath();
    }
  });
}

// Generate a power-up
function generatePowerup(x, y, specificType = null) {
  // If no specific type is provided, randomly select a power-up type
  let powerupType;
  if (specificType) {
    powerupType = specificType;
  } else {
    const powerupTypes = ["blasters", "small", "big"];
    powerupType = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
  }

  powerups.push({
    x: x,
    y: y,
    width: POWERUP_WIDTH,
    height: POWERUP_HEIGHT,
    type: powerupType,
    speed: POWERUP_SPEED,
  });
}

// Draw power-ups
function drawPowerups() {
  powerups.forEach((powerup) => {
    ctx.beginPath();
    ctx.rect(powerup.x, powerup.y, powerup.width, powerup.height);

    // Different colors for different power-up types
    let color, letter;
    switch (powerup.type) {
      case "blasters":
        color = "#FF00FF"; // Magenta for blasters
        letter = "B";
        break;
      case "small":
        color = "#FF9900"; // Orange for small paddle
        letter = "S";
        break;
      case "big":
        color = "#00FF00"; // Green for big paddle
        letter = "L";
        break;
      default:
        color = "#FFFFFF"; // White for unknown
        letter = "?";
    }

    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.strokeRect(powerup.x, powerup.y, powerup.width, powerup.height);

    // Draw letter for power-up type
    ctx.font = "20px Arial";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      letter,
      powerup.x + powerup.width / 2,
      powerup.y + powerup.height / 2
    );
    ctx.closePath();
  });
}

// Move power-ups
function movePowerups() {
  for (let i = powerups.length - 1; i >= 0; i--) {
    const powerup = powerups[i];
    powerup.y += powerup.speed;

    // Check if power-up is caught by paddle
    if (
      powerup.y + powerup.height > paddle.y &&
      powerup.y < paddle.y + paddle.height &&
      powerup.x + powerup.width > paddle.x &&
      powerup.x < paddle.x + paddle.width
    ) {
      // Activate power-up
      activatePowerup(powerup.type);
      powerups.splice(i, 1);
    }
    // Remove power-up if it goes off screen
    else if (powerup.y > canvas.height) {
      powerups.splice(i, 1);
    }
  }
}

// Activate a power-up
function activatePowerup(type) {
  // Handle size powerups (small and big)
  if (type === "small" || type === "big") {
    // If the opposite size powerup is active, deactivate it
    if (type === "small" && activePowerups.big) {
      // Reset paddle to normal size
      paddle.width = PADDLE_NORMAL_WIDTH;

      // Hide big indicator
      document.getElementById("bigIndicator").classList.remove("active");

      // Clear big timer
      clearTimeout(powerupTimers.big);

      // Reset big flag
      activePowerups.big = false;
    } else if (type === "big" && activePowerups.small) {
      // Reset paddle to normal size
      paddle.width = PADDLE_NORMAL_WIDTH;

      // Hide small indicator
      document.getElementById("smallIndicator").classList.remove("active");

      // Clear small timer
      clearTimeout(powerupTimers.small);

      // Reset small flag
      activePowerups.small = false;
    }
  }

  if (type === "blasters") {
    playSound(sounds.gotBlasters);
    // If already have blasters, upgrade to double blasters
    if (
      activePowerups.blasters &&
      activePowerups.blasterLevel === SINGLE_BLASTERS
    ) {
      activePowerups.blasterLevel = DOUBLE_BLASTERS;

      // Update indicator text
      document.getElementById("blasterIndicator").textContent =
        "DOUBLE BLASTERS ACTIVE!";
    } else {
      // Regular blasters
      activePowerups.blasters = true;
      activePowerups.blasterLevel = SINGLE_BLASTERS;

      // Set indicator text
      document.getElementById("blasterIndicator").textContent =
        "BLASTERS ACTIVE!";

      // Start laser sound when first activated
      startLaserSound();
    }

    // Show indicator
    document.getElementById("blasterIndicator").classList.add("active");

    // Clear any existing timer
    clearTimeout(powerupTimers.blasters);

    // Set timer to deactivate power-up
    powerupTimers.blasters = setTimeout(() => {
      activePowerups.blasters = false;
      activePowerups.blasterLevel = 0;
      document.getElementById("blasterIndicator").classList.remove("active");
      document.getElementById("blasterIndicator").textContent =
        "BLASTERS ACTIVE!";

      // Stop laser sound when deactivated
      stopLaserSound();
    }, POWERUP_DURATION);
  } else if (type === "small") {
    // Play paddle shrink sound
    playSound(sounds.paddleShrink);

    // If already small, make it double small (if not already double small)
    if (activePowerups.small) {
      if (paddle.width === PADDLE_SMALL_WIDTH) {
        paddle.width = PADDLE_DOUBLE_SMALL_WIDTH;
        // Update indicator text
        document.getElementById("smallIndicator").textContent =
          "DOUBLE SMALL PADDLE!";
      }
      // If already double small, keep it that way (do nothing to the paddle width)
      else if (paddle.width === PADDLE_DOUBLE_SMALL_WIDTH) {
        // Just refresh the timer, paddle stays double small
      } else {
        // Regular small paddle (this case shouldn't normally happen)
        paddle.width = PADDLE_SMALL_WIDTH;
        document.getElementById("smallIndicator").textContent = "SMALL PADDLE!";
      }
    } else {
      // Regular small paddle (first time getting small)
      paddle.width = PADDLE_SMALL_WIDTH;
      // Set indicator text
      document.getElementById("smallIndicator").textContent = "SMALL PADDLE!";
    }

    activePowerups.small = true;

    // Show indicator
    document.getElementById("smallIndicator").classList.add("active");

    // Clear any existing timer
    clearTimeout(powerupTimers.small);

    // Set timer to deactivate power-up
    powerupTimers.small = setTimeout(() => {
      activePowerups.small = false;
      document.getElementById("smallIndicator").classList.remove("active");
      document.getElementById("smallIndicator").textContent = "SMALL PADDLE!";

      // Reset paddle size if no other size powerup is active
      if (!activePowerups.big) {
        paddle.width = PADDLE_NORMAL_WIDTH;
      }
    }, POWERUP_DURATION);
  } else if (type === "big") {
    // Play paddle grow sound
    playSound(sounds.paddleGrow);

    // If already big, make it double big (if not already double big)
    if (activePowerups.big) {
      if (paddle.width === PADDLE_BIG_WIDTH) {
        paddle.width = PADDLE_DOUBLE_BIG_WIDTH;
        // Update indicator text
        document.getElementById("bigIndicator").textContent =
          "DOUBLE BIG PADDLE!";
      }
      // If already double big, keep it that way (do nothing to the paddle width)
      else if (paddle.width === PADDLE_DOUBLE_BIG_WIDTH) {
        // Just refresh the timer, paddle stays double big
      } else {
        // Regular big paddle (this case shouldn't normally happen)
        paddle.width = PADDLE_BIG_WIDTH;
        document.getElementById("bigIndicator").textContent = "BIG PADDLE!";
      }
    } else {
      // Regular big paddle (first time getting big)
      paddle.width = PADDLE_BIG_WIDTH;
      // Set indicator text
      document.getElementById("bigIndicator").textContent = "BIG PADDLE!";
    }

    activePowerups.big = true;

    // Show indicator
    document.getElementById("bigIndicator").classList.add("active");

    // Clear any existing timer
    clearTimeout(powerupTimers.big);

    // Set timer to deactivate power-up
    powerupTimers.big = setTimeout(() => {
      activePowerups.big = false;
      document.getElementById("bigIndicator").classList.remove("active");
      document.getElementById("bigIndicator").textContent = "BIG PADDLE!";

      // Reset paddle size if no other size powerup is active
      if (!activePowerups.small) {
        paddle.width = PADDLE_NORMAL_WIDTH;
      }
    }, POWERUP_DURATION);
  }
}

// Draw lasers
function drawLasers() {
  lasers.forEach((laser) => {
    ctx.beginPath();
    ctx.rect(laser.x, laser.y, laser.width, laser.height);
    ctx.fillStyle = "#FF0000"; // Red lasers
    ctx.fill();
    ctx.closePath();
  });
}

// Move lasers and check collisions
function moveLasers() {
  for (let i = lasers.length - 1; i >= 0; i--) {
    const laser = lasers[i];
    laser.y -= laser.speed;

    // Remove laser if it goes off screen
    if (laser.y + laser.height < 0) {
      lasers.splice(i, 1);
      continue;
    }

    // Check for collisions with blocks
    for (let j = 0; j < blocks.length; j++) {
      const block = blocks[j];
      if (
        block.visible &&
        laser.x + laser.width > block.x &&
        laser.x < block.x + block.width &&
        laser.y < block.y + block.height &&
        laser.y + laser.height > block.y
      ) {
        // Increment hit counter
        block.hits++;

        // Check if block should be destroyed
        if (block.hits >= block.hitsRequired) {
          // Block destroyed
          block.visible = false;
          score += 10 * block.hitsRequired; // More points for tougher blocks

          // Play block break sound
          playSound(sounds.blockBreak);
        } else {
          // Give a small score for hitting but not destroying
          score += 2;

          // Play block crack sound
          playSound(sounds.blockCrack);
        }

        // Remove the laser
        lasers.splice(i, 1);
        updateScore();

        // Check if all blocks are cleared
        if (blocks.every((block) => !block.visible)) {
          levelComplete();
        }

        break;
      }
    }
  }
}

// Fire lasers from paddle
function fireLasers() {
  const currentTime = Date.now();
  if (activePowerups.blasters && currentTime - lastLaserTime > LASER_COOLDOWN) {
    // Start continuous laser sound
    startLaserSound();

    // Always fire from left and right sides (basic blasters)
    lasers.push({
      x: paddle.x + 10,
      y: paddle.y,
      width: LASER_WIDTH,
      height: LASER_HEIGHT,
      speed: LASER_SPEED,
    });

    lasers.push({
      x: paddle.x + paddle.width - 10 - LASER_WIDTH,
      y: paddle.y,
      width: LASER_WIDTH,
      height: LASER_HEIGHT,
      speed: LASER_SPEED,
    });

    // If double blasters, add two more lasers in the middle
    if (activePowerups.blasterLevel === DOUBLE_BLASTERS) {
      // Fire from left-center of paddle
      lasers.push({
        x: paddle.x + paddle.width / 3 - LASER_WIDTH / 2,
        y: paddle.y,
        width: LASER_WIDTH,
        height: LASER_HEIGHT,
        speed: LASER_SPEED,
      });

      // Fire from right-center of paddle
      lasers.push({
        x: paddle.x + (2 * paddle.width) / 3 - LASER_WIDTH / 2,
        y: paddle.y,
        width: LASER_WIDTH,
        height: LASER_HEIGHT,
        speed: LASER_SPEED,
      });
    }

    lastLaserTime = currentTime;
  }
}

// Draw blasters on paddle when active
function drawBlasters() {
  if (activePowerups.blasters) {
    // Left blaster (always present with blasters)
    ctx.beginPath();
    ctx.rect(paddle.x + 10, paddle.y - 5, 5, 5);
    ctx.fillStyle = "#FF0000";
    ctx.fill();
    ctx.closePath();

    // Right blaster (always present with blasters)
    ctx.beginPath();
    ctx.rect(paddle.x + paddle.width - 15, paddle.y - 5, 5, 5);
    ctx.fillStyle = "#FF0000";
    ctx.fill();
    ctx.closePath();

    // If double blasters, draw two more in the middle
    if (activePowerups.blasterLevel === DOUBLE_BLASTERS) {
      // Left-center blaster
      ctx.beginPath();
      ctx.rect(paddle.x + paddle.width / 3 - 2.5, paddle.y - 5, 5, 5);
      ctx.fillStyle = "#FF0000";
      ctx.fill();
      ctx.closePath();

      // Right-center blaster
      ctx.beginPath();
      ctx.rect(paddle.x + (2 * paddle.width) / 3 - 2.5, paddle.y - 5, 5, 5);
      ctx.fillStyle = "#FF0000";
      ctx.fill();
      ctx.closePath();
    }
  }
}

// Update score display
function updateScore() {
  document.getElementById("score").textContent = score;
}

// Update lives display
function updateLives() {
  document.getElementById("lives").textContent = lives;
}

// Update difficulty info display
function updateDifficultyInfo() {
  const totalSpawnPercentage = (POWERUP_SPAWN_CHANCE * 100).toFixed(1);
  const blasterPercentage = (
    POWERUP_SPAWN_CHANCES[currentDifficulty].blasters * 100
  ).toFixed(1);
  const smallPercentage = (
    POWERUP_SPAWN_CHANCES[currentDifficulty].small * 100
  ).toFixed(1);
  const bigPercentage = (
    POWERUP_SPAWN_CHANCES[currentDifficulty].big * 100
  ).toFixed(1);

  document.getElementById(
    "difficultyInfo"
  ).textContent = `${currentDifficulty.toUpperCase()} - Ball Speed: ${BALL_SPEED}, Total Powerup: ${totalSpawnPercentage}% (B:${blasterPercentage}% S:${smallPercentage}% L:${bigPercentage}%)`;
}

// Move paddle
function movePaddle() {
  if (rightPressed && paddle.x + paddle.width < canvas.width) {
    paddle.x += paddle.dx;
  } else if (leftPressed && paddle.x > 0) {
    paddle.x -= paddle.dx;
  }
}

// Move ball
function moveBall() {
  ball.x += ball.dx;
  ball.y += ball.dy;

  // Wall collision (right/left)
  if (ball.x + ball.radius > canvas.width || ball.x - ball.radius < 0) {
    ball.dx = -ball.dx;
  }

  // Wall collision (top)
  if (ball.y - ball.radius < 0) {
    ball.dy = -ball.dy;
  }

  // Bottom collision (lose life)
  if (ball.y + ball.radius > canvas.height) {
    lives--;
    updateLives();

    // Play life lost sound
    playSound(sounds.lifeLost);

    if (lives <= 0) {
      gameOver();
    } else {
      // Reset ball and paddle
      ball.x = canvas.width / 2;
      ball.y = paddle.y - ball.radius;
      ball.dx = BALL_SPEED * (Math.random() > 0.5 ? 1 : -1);
      ball.dy = -BALL_SPEED;
      paddle.x = canvas.width / 2 - paddle.width / 2;
    }
  }

  // Paddle collision
  if (
    ball.y + ball.radius > paddle.y &&
    ball.y - ball.radius < paddle.y + paddle.height &&
    ball.x > paddle.x &&
    ball.x < paddle.x + paddle.width
  ) {
    // Calculate where the ball hit the paddle (0 to 1)
    const hitPosition = (ball.x - paddle.x) / paddle.width;

    // Calculate angle (-60 to 60 degrees)
    const angle = -60 + 120 * hitPosition;

    // Convert angle to radians and set velocity
    const radian = (angle * Math.PI) / 180;
    const velocity = BALL_SPEED;

    ball.dx = velocity * Math.sin(radian);
    ball.dy = -velocity * Math.cos(radian);

    // Ensure the ball is moving upward
    if (ball.dy > 0) {
      ball.dy = -ball.dy;
    }

    // Play paddle hit sound
    playSound(sounds.paddleHit);
  }

  // Block collision
  blocks.forEach((block) => {
    if (block.visible) {
      if (
        ball.x + ball.radius > block.x &&
        ball.x - ball.radius < block.x + block.width &&
        ball.y + ball.radius > block.y &&
        ball.y - ball.radius < block.y + block.height
      ) {
        ball.dy = -ball.dy;

        // Increment hit counter
        block.hits++;

        // Check if block should be destroyed
        if (block.hits >= block.hitsRequired) {
          block.visible = false;
          score += 10 * block.hitsRequired; // More points for tougher blocks

          // Play block break sound
          playSound(sounds.blockBreak);

          // Randomly spawn a power-up based on difficulty and type
          const randomValue = Math.random();
          if (randomValue < POWERUP_SPAWN_CHANCE) {
            // Determine which powerup to spawn based on their relative probabilities
            const powerupChances = POWERUP_SPAWN_CHANCES[currentDifficulty];
            let cumulativeChance = 0;
            let selectedType = null;

            // Normalize the random value to be within the total spawn chance
            const normalizedRandom =
              randomValue * (POWERUP_SPAWN_CHANCE / randomValue);

            // Select powerup type based on their individual probabilities
            for (const [type, chance] of Object.entries(powerupChances)) {
              cumulativeChance += chance;
              if (normalizedRandom <= cumulativeChance) {
                selectedType = type;
                break;
              }
            }

            // If a type was selected, generate that specific powerup
            if (selectedType) {
              generatePowerup(
                block.x + block.width / 2 - POWERUP_WIDTH / 2,
                block.y,
                selectedType
              );
            }
          }
        } else {
          // Give a small score for hitting but not destroying
          score += 2;

          // Play block crack sound
          playSound(sounds.blockCrack);
        }

        updateScore();

        // Check if all blocks are cleared
        if (blocks.every((block) => !block.visible)) {
          levelComplete();
        }
      }
    }
  });
}

// Game over
function gameOver() {
  gameRunning = false;
  cancelAnimationFrame(animationId);

  // Stop any ongoing laser sounds
  stopLaserSound();

  // Play game over sound
  playSound(sounds.gameOver);

  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = "48px Arial";
  ctx.fillStyle = "#FF5252";
  ctx.textAlign = "center";
  ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);

  ctx.font = "24px Arial";
  ctx.fillStyle = "white";
  ctx.fillText(
    `Final Score: ${score}`,
    canvas.width / 2,
    canvas.height / 2 + 50
  );
  ctx.fillText(
    `Difficulty: ${currentDifficulty.toUpperCase()}`,
    canvas.width / 2,
    canvas.height / 2 + 80
  );
  ctx.fillText(
    'Click "Start Game" to play again',
    canvas.width / 2,
    canvas.height / 2 + 120
  );
}

// Level complete
function levelComplete() {
  gameRunning = false;
  cancelAnimationFrame(animationId);

  // Stop any ongoing laser sounds
  stopLaserSound();

  // Play level won sound
  playSound(sounds.levelWon);

  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = "48px Arial";
  ctx.fillStyle = "#4CAF50";
  ctx.textAlign = "center";
  ctx.fillText("LEVEL COMPLETE!", canvas.width / 2, canvas.height / 2);

  ctx.font = "24px Arial";
  ctx.fillStyle = "white";
  ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 50);
  ctx.fillText(
    `Difficulty: ${currentDifficulty.toUpperCase()}`,
    canvas.width / 2,
    canvas.height / 2 + 80
  );
  ctx.fillText(
    'Click "Start Game" to play next level',
    canvas.width / 2,
    canvas.height / 2 + 120
  );
}

// Periodically spawn power-ups
function spawnRandomPowerup() {
  if (gameRunning) {
    // Find visible blocks
    const visibleBlocks = blocks.filter((block) => block.visible);
    if (visibleBlocks.length > 0) {
      // Choose a random block
      const randomBlock =
        visibleBlocks[Math.floor(Math.random() * visibleBlocks.length)];
      generatePowerup(
        randomBlock.x + randomBlock.width / 2 - POWERUP_WIDTH / 2,
        randomBlock.y
      );
    }

    // Schedule next spawn
    const nextSpawnTime = 5000 + Math.random() * 10000; // Between 5-15 seconds
    setTimeout(spawnRandomPowerup, nextSpawnTime);
  }
}

// Draw everything
function draw() {
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw game elements
  drawPaddle();
  drawBlasters(); // Draw blasters if active
  drawBall();
  drawBlocks();
  drawPowerups();
  drawLasers();

  // Move game elements
  if (gameRunning) {
    movePaddle();
    moveBall();
    movePowerups();
    moveLasers();
    fireLasers(); // Fire lasers if blasters are active
  }

  // Continue animation
  if (gameRunning) {
    animationId = requestAnimationFrame(draw);
  }
}

// Event listeners
document.addEventListener("keydown", (e) => {
  if (e.key === "Right" || e.key === "ArrowRight" || e.key === "d") {
    rightPressed = true;
  } else if (e.key === "Left" || e.key === "ArrowLeft" || e.key === "a") {
    leftPressed = true;
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === "Right" || e.key === "ArrowRight" || e.key === "d") {
    rightPressed = false;
  } else if (e.key === "Left" || e.key === "ArrowLeft" || e.key === "a") {
    leftPressed = false;
  }
});

// Mouse/touch controls for mobile
canvas.addEventListener("mousemove", (e) => {
  if (gameRunning) {
    const relativeX = e.clientX - canvas.getBoundingClientRect().left;
    if (relativeX > 0 && relativeX < canvas.width) {
      paddle.x = relativeX - paddle.width / 2;
    }
  }
});

canvas.addEventListener(
  "touchmove",
  (e) => {
    if (gameRunning) {
      e.preventDefault();
      const relativeX =
        e.touches[0].clientX - canvas.getBoundingClientRect().left;
      if (relativeX > 0 && relativeX < canvas.width) {
        paddle.x = relativeX - paddle.width / 2;
      }
    }
  },
  { passive: false }
);

// Difficulty selector
document.getElementById("difficulty").addEventListener("change", () => {
  if (!gameRunning) {
    setDifficulty();
    updateDifficultyInfo();
  }
});

// Start button
document.getElementById("startButton").addEventListener("click", () => {
  if (!gameRunning) {
    initGame();
    gameRunning = true;

    // Play game start sound
    playSound(sounds.gameStart);

    draw();

    // Start periodic power-up spawning
    setTimeout(spawnRandomPowerup, 8000); // First random spawn after 8 seconds
  }
});

// Sound toggle button
document.getElementById("soundToggle").addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  document.getElementById("soundToggle").textContent = soundEnabled
    ? "Sound: ON"
    : "Sound: OFF";

  // If sound is turned off, stop any ongoing laser sounds
  if (!soundEnabled) {
    stopLaserSound();
  } else if (activePowerups.blasters) {
    // If sound is turned on and blasters are active, restart laser sound
    startLaserSound();
  }
});

// Initial setup
document.addEventListener("DOMContentLoaded", () => {
  // Initialize game elements but don't start yet
  initGame();

  // Update difficulty info
  updateDifficultyInfo();

  // Draw initial state
  draw();
});
