const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

const GAME_STATE = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'game_over',
    LEVEL_COMPLETE: 'level_complete',
    WARPING: 'warping'
};

class Game {
    constructor() {
        this.state = GAME_STATE.PLAYING;
        this.score = 0;
        this.level = 1;
        this.lives = 5;
        this.superzappers = 2; // 2 per level
        
        this.tube = null;
        this.player = null;
        this.projectiles = [];
        this.enemies = [];
        this.effects = [];
        this.spikes = [];
        this.keys = {};
        this.setupInput();
        this.init();
    }
    
    init() {
        this.tube = new Tube(this.level);
        this.player = new Player(this.tube);
        this.enemies = [];
        this.projectiles = [];
        this.effects = [];
        this.spikes = [];
        this.enemiesSpawned = 0;
        this.maxEnemiesPerLevel = 10 + (this.level * 2); // Increase enemies per level
        this.enemySpawnTimer = 0;
        this.levelCompleteTimer = 0;
        
        // Spawn initial enemies
        for (let i = 0; i < Math.min(3, this.maxEnemiesPerLevel); i++) {
            this.spawnEnemy();
        }
        
    }
    
    setupInput() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            
            // Restart game
            if (e.key.toLowerCase() === 'r' && this.state === GAME_STATE.GAME_OVER) {
                this.restart();
            }
            
            e.preventDefault();
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
            e.preventDefault();
        });
    }
    
    restart() {
        this.state = GAME_STATE.PLAYING;
        this.score = 0;
        this.level = 1;
        this.lives = 5;
        this.init();
    }
    
    update(deltaTime) {
        if (this.state === GAME_STATE.PLAYING) {
            this.player.update(deltaTime, this.keys, this);
            
            this.projectiles.forEach(projectile => projectile.update(deltaTime));
            this.projectiles = this.projectiles.filter(p => !p.destroyed);
            
            this.enemies.forEach(enemy => enemy.update(deltaTime, this));
            this.enemies = this.enemies.filter(e => !e.destroyed);
            
            this.spikes.forEach(spike => spike.update(deltaTime));
            this.spikes = this.spikes.filter(s => !s.destroyed);
            
            this.effects.forEach(effect => effect.update(deltaTime));
            this.effects = this.effects.filter(e => !e.finished);
            
            this.checkCollisions();
            
            // Spawn enemies based on wave system
            this.enemySpawnTimer += deltaTime;
            if (this.enemySpawnTimer > 2000 && this.enemiesSpawned < this.maxEnemiesPerLevel) {
                this.spawnEnemy();
                this.enemySpawnTimer = 0;
            }
            
            // Check for level completion
            if (this.enemiesSpawned >= this.maxEnemiesPerLevel && this.enemies.length === 0) {
                this.state = GAME_STATE.LEVEL_COMPLETE;
                this.levelCompleteTimer = 0;
            }
            
            this.updateUI();
        } else if (this.state === GAME_STATE.LEVEL_COMPLETE) {
            this.levelCompleteTimer += deltaTime;
            
            // Show level complete for 2 seconds then start warping
            if (this.levelCompleteTimer > 2000) {
                this.startWarping();
            }
        } else if (this.state === GAME_STATE.WARPING) {
            this.updateWarping(deltaTime);
        }
    }
    
    checkCollisions() {
        this.projectiles.forEach(projectile => {
            if (projectile.owner === 'player') {
                // Check collision with enemies
                this.enemies.forEach(enemy => {
                    if (projectile.segment === enemy.segment && 
                        Math.abs(projectile.depth - enemy.depth) < 0.05) {
                        enemy.hit(projectile.damage);
                        projectile.destroyed = true;
                        
                        // If enemy is destroyed
                        if (enemy.health <= 0) {
                            this.score += enemy.points;
                            this.effects.push(new Explosion(enemy.x, enemy.y));
                            
                            // Tankers split into 2 flippers
                            if (enemy.type === 'tanker') {
                                for (let i = 0; i < 2; i++) {
                                    const newFlipper = new Enemy(this.tube, enemy.segment, 'flipper');
                                    newFlipper.depth = enemy.depth;
                                    newFlipper.updatePosition();
                                    this.enemies.push(newFlipper);
                                }
                            }
                        }
                    }
                });
                
                // Check collision with spikes
                this.spikes.forEach(spike => {
                    if (projectile.segment === spike.segment &&
                        projectile.depth >= spike.endDepth &&
                        projectile.depth <= spike.startDepth) {
                        spike.hit(projectile.damage);
                        projectile.destroyed = true;
                        this.score += 10;
                        const hitPos = this.tube.getPosition(spike.segment, projectile.depth);
                        this.effects.push(new Explosion(hitPos.x, hitPos.y));
                    }
                });
            }
        });
        
        this.enemies.forEach(enemy => {
            // Player covers a segment, enemy is in center of segment
            if (enemy.depth <= 0 && enemy.segment === this.player.segment && !this.player.invulnerable) {
                this.playerHit();
                // Fuseballs destroy themselves on contact, others get pushed back
                if (enemy.type === 'fuseball') {
                    enemy.destroyed = true;
                } else {
                    enemy.direction = 1;
                    enemy.depth = 0.1;
                }
            }
        });
    }
    
    spawnEnemy() {
        if (this.enemiesSpawned >= this.maxEnemiesPerLevel) return;
        
        const segment = Math.floor(Math.random() * this.tube.segments);
        let type = 'flipper';
        const roll = Math.random();
        if (roll < 0.6) {
            type = 'flipper';
        } else if (roll < 0.85) {
            type = 'tanker';
        } else {
            type = 'fuseball'; // 15% chance for fuseball
        }
        
        this.enemies.push(new Enemy(this.tube, segment, type));
        this.enemiesSpawned++;
    }
    
    shoot() {
        // Limit to 8 shots on screen
        const playerProjectiles = this.projectiles.filter(p => p.owner === 'player');
        if (playerProjectiles.length >= 8) return;
        
        // Shoot down the center of the segment the player is covering
        const segmentAngle = (this.player.segment + 0.5) * this.tube.angleStep;
        const startX = Math.cos(segmentAngle) * this.tube.radius * 0.9;
        const startY = Math.sin(segmentAngle) * this.tube.radius * 0.9;
        
        const projectile = new Projectile(
            startX,
            startY,
            this.player.segment,
            this.tube,
            'player'
        );
        this.projectiles.push(projectile);
    }
    
    useSuperzapper() {
        if (this.superzappers <= 0) return;
        
        this.superzappers--;
        
        // Flash effect
        this.screenFlash = true;
        setTimeout(() => {
            this.screenFlash = false;
        }, 200);
        
        // Kill all enemies on screen one by one with delay
        let delay = 0;
        this.enemies.forEach((enemy, index) => {
            setTimeout(() => {
                if (!enemy.destroyed) {
                    enemy.destroyed = true;
                    this.score += enemy.points * 2; // Double points for superzapper
                    for (let i = 0; i < 5; i++) {
                        this.effects.push(new Explosion(
                            enemy.x + (Math.random() - 0.5) * 50,
                            enemy.y + (Math.random() - 0.5) * 50
                        ));
                    }
                }
            }, delay);
            delay += 100; // 100ms between each enemy destruction
        });
        
        // Also destroy all spikes
        this.spikes.forEach(spike => {
            spike.destroyed = true;
            const pos = this.tube.getPosition(spike.segment, spike.endDepth);
            this.effects.push(new Explosion(pos.x, pos.y));
        });
    }
    
    playerHit() {
        this.lives--;
        this.player.invulnerable = true;
        this.player.hitFlash = true;
        
        // Flash the entire screen red
        this.screenFlash = true;
        setTimeout(() => {
            this.screenFlash = false;
        }, 100);
        
        // Create a larger explosion at player position
        for (let i = 0; i < 3; i++) {
            this.effects.push(new Explosion(
                this.player.x + (Math.random() - 0.5) * 30,
                this.player.y + (Math.random() - 0.5) * 30
            ));
        }
        
        setTimeout(() => {
            this.player.invulnerable = false;
            this.player.hitFlash = false;
        }, 2000);
        
        if (this.lives <= 0) {
            this.state = GAME_STATE.GAME_OVER;
        }
    }
    
    updateUI() {
        document.getElementById('score').textContent = String(this.score).padStart(4, '0');
        document.getElementById('level').textContent = this.level;
        document.getElementById('lives').textContent = this.lives;
        
        // Show superzapper count
        const superzapperText = 'Z'.repeat(this.superzappers);
        document.getElementById('superzappers').textContent = superzapperText;
    }
    
    startWarping() {
        this.state = GAME_STATE.WARPING;
        this.warpDepth = 0;
        this.warpSpeed = 0.2;
        // Clear projectiles but keep spikes for the warp sequence
        this.projectiles = [];
    }
    
    updateWarping(deltaTime) {
        this.warpDepth += this.warpSpeed * deltaTime / 1000;
        
        // Check collision with spikes during warp
        const playerSegment = this.player.segment;
        this.spikes.forEach(spike => {
            if (spike.segment === playerSegment && 
                this.warpDepth >= spike.endDepth && 
                this.warpDepth <= spike.startDepth) {
                this.playerHit();
                spike.destroyed = true;
            }
        });
        
        // Complete warp when reached the end
        if (this.warpDepth > 1) {
            this.level++;
            this.superzappers = 2; // Reset superzappers for new level
            this.state = GAME_STATE.PLAYING;
            this.init();
        }
    }
    
    render() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Screen flash effect when hit
        if (this.screenFlash) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        
        // Always render the tube and player
        if (this.tube) {
            this.tube.render(ctx, this.player ? this.player.segment : -1);
        }
        
        // Render spikes first (behind enemies)
        this.spikes.forEach(spike => spike.render(ctx));
        
        this.enemies.forEach(enemy => enemy.render(ctx));
        this.projectiles.forEach(projectile => projectile.render(ctx));
        
        if (this.player && (this.state === GAME_STATE.PLAYING || this.state === GAME_STATE.LEVEL_COMPLETE)) {
            this.player.render(ctx);
        }
        
        this.effects.forEach(effect => effect.render(ctx));
        
        ctx.restore();
        
        if (this.state === GAME_STATE.LEVEL_COMPLETE) {
            ctx.fillStyle = '#0ff';
            ctx.font = '48px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('LEVEL COMPLETE', canvas.width / 2, canvas.height / 2);
            ctx.font = '24px monospace';
            ctx.fillText(`Score: ${this.score}`, canvas.width / 2, canvas.height / 2 + 40);
        } else if (this.state === GAME_STATE.WARPING) {
            // Draw warping effect
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            
            // Draw player moving into the tube
            const warpPos = this.tube.getPosition(this.player.segment, this.warpDepth);
            ctx.strokeStyle = '#ff0';
            ctx.fillStyle = '#ff0';
            ctx.beginPath();
            ctx.arc(warpPos.x, warpPos.y, 5 * (1 - this.warpDepth), 0, Math.PI * 2);
            ctx.fill();
            
            // Draw speed lines
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                ctx.strokeStyle = `rgba(255, 255, 0, ${0.5 - this.warpDepth * 0.5})`;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(angle) * 300, Math.sin(angle) * 300);
                ctx.stroke();
            }
            
            ctx.restore();
        } else if (this.state === GAME_STATE.GAME_OVER) {
            ctx.fillStyle = '#f00';
            ctx.font = '48px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
            ctx.font = '24px monospace';
            ctx.fillText('Press R to restart', canvas.width / 2, canvas.height / 2 + 40);
        }
    }
}

class Tube {
    constructor(level) {
        this.segments = 16;
        this.radius = 200;  // Reduced to fit better
        this.depth = 300;
        this.angleStep = (Math.PI * 2) / this.segments;
        this.colors = {
            edge: '#0ff',  // Changed to cyan to be more visible
            line: '#0ff'
        };
    }
    
    getPosition(segment, depth) {
        // Get position in the CENTER of a segment (lane)
        const angle = (segment + 0.5) * this.angleStep;
        const r = this.radius * (1 - depth);
        return {
            x: Math.cos(angle) * r,
            y: Math.sin(angle) * r
        };
    }
    
    render(ctx, playerSegment = -1) {
        // Highlight the player's segment first
        if (playerSegment >= 0) {
            // Animated glow effect
            const glowIntensity = 0.1 + Math.sin(Date.now() * 0.003) * 0.05;
            ctx.fillStyle = `rgba(255, 255, 0, ${glowIntensity})`;
            
            const angle1 = playerSegment * this.angleStep;
            const angle2 = (playerSegment + 1) * this.angleStep;
            
            // Draw highlighted segment fill
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, this.radius, angle1, angle2);
            ctx.closePath();
            ctx.fill();
            
            // Draw highlighted edges with yellow
            ctx.strokeStyle = '#ff0';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle1) * this.radius, Math.sin(angle1) * this.radius);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle2) * this.radius, Math.sin(angle2) * this.radius);
            ctx.stroke();
            
            // Draw subtle gradient lines within the segment
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
            ctx.lineWidth = 1;
            const centerAngle = (angle1 + angle2) / 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(centerAngle) * this.radius, Math.sin(centerAngle) * this.radius);
            ctx.stroke();
        }
        
        // Draw normal tube structure
        ctx.strokeStyle = this.colors.edge;
        ctx.lineWidth = 2;
        
        // Draw radial lines from center to edge
        for (let i = 0; i < this.segments; i++) {
            const angle = i * this.angleStep;
            const x = Math.cos(angle) * this.radius;
            const y = Math.sin(angle) * this.radius;
            
            // Skip lines that are already highlighted
            if (i !== playerSegment && i !== (playerSegment + 1) % this.segments) {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(x, y);
                ctx.stroke();
            }
        }
        
        // Draw outer edge
        ctx.beginPath();
        for (let i = 0; i <= this.segments; i++) {
            const angle = (i % this.segments) * this.angleStep;
            const x = Math.cos(angle) * this.radius;
            const y = Math.sin(angle) * this.radius;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.stroke();
        
        for (let d = 0.2; d <= 0.8; d += 0.2) {
            ctx.beginPath();
            for (let i = 0; i <= this.segments; i++) {
                const angle = (i % this.segments) * this.angleStep;
                const r = this.radius * (1 - d);
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }
    }
}

class Player {
    constructor(tube) {
        this.tube = tube;
        this.segment = 0;
        this.targetSegment = 0;
        this.moveProgress = 1; // 0 = start of move, 1 = completed
        this.size = 20;
        this.speed = 5;
        this.shootCooldown = 0;
        this.invulnerable = false;
        this.flexAmount = 0; // For animation
        this.updatePosition();
    }
    
    updatePosition() {
        // Player sits between segments, shoots into the segment
        let currentSegment;
        if (this.moveProgress < 1) {
            // Handle wrapping when moving between last and first segment
            let diff = this.targetSegment - this.segment;
            
            // If moving across the wrap boundary
            if (Math.abs(diff) > this.tube.segments / 2) {
                if (diff > 0) {
                    // Moving from last to first segment
                    diff = diff - this.tube.segments;
                } else {
                    // Moving from first to last segment
                    diff = diff + this.tube.segments;
                }
            }
            
            currentSegment = this.segment + diff * this.moveProgress;
            
            // Normalize to valid segment range
            while (currentSegment < 0) currentSegment += this.tube.segments;
            while (currentSegment >= this.tube.segments) currentSegment -= this.tube.segments;
        } else {
            currentSegment = this.segment;
        }
        
        // Position between current segment and next segment
        const angle1 = currentSegment * this.tube.angleStep;
        const angle2 = ((currentSegment + 1) % this.tube.segments) * this.tube.angleStep;
        
        // Handle angle wrapping for smooth interpolation
        let playerAngle;
        if (Math.abs(angle2 - angle1) > Math.PI) {
            // We're wrapping around
            if (angle1 > angle2) {
                playerAngle = (angle1 + angle2 + Math.PI * 2) / 2;
            } else {
                playerAngle = (angle1 + Math.PI * 2 + angle2) / 2;
            }
            if (playerAngle > Math.PI * 2) playerAngle -= Math.PI * 2;
        } else {
            playerAngle = (angle1 + angle2) / 2;
        }
        
        this.x = Math.cos(playerAngle) * this.tube.radius;
        this.y = Math.sin(playerAngle) * this.tube.radius;
        this.angle = playerAngle;
    }
    
    update(deltaTime, keys, game) {
        // Handle movement input
        if (this.moveProgress >= 1) {
            if (keys['ArrowLeft']) {
                this.targetSegment = (this.segment - 1 + this.tube.segments) % this.tube.segments;
                this.moveProgress = 0;
                keys['ArrowLeft'] = false;
            }
            if (keys['ArrowRight']) {
                this.targetSegment = (this.segment + 1) % this.tube.segments;
                this.moveProgress = 0;
                keys['ArrowRight'] = false;
            }
        }
        
        // Animate movement
        if (this.moveProgress < 1) {
            this.moveProgress += deltaTime / 100; // 100ms to move between segments
            if (this.moveProgress >= 1) {
                this.moveProgress = 1;
                this.segment = this.targetSegment;
            }
            this.updatePosition();
            
            // Update flex animation
            this.flexAmount = Math.sin(this.moveProgress * Math.PI) * 0.3;
        } else {
            // Subtle idle animation
            this.flexAmount = Math.sin(Date.now() * 0.003) * 0.05;
        }
        
        this.shootCooldown -= deltaTime;
        if ((keys[' '] || keys['x'])&& this.shootCooldown <= 0) {
            game.shoot();
            this.shootCooldown = 150; // Continuous fire rate
        }
        
        // Superzapper
        if (keys['z'] || keys['Z']) {
            game.useSuperzapper();
            keys['z'] = false;
            keys['Z'] = false;
        }
    }
    
    hit() {
        console.log('Player hit!');
    }
    
    render(ctx) {
        // Flash when invulnerable
        if (this.invulnerable && Math.floor(Date.now() / 100) % 2 === 0) {
            ctx.strokeStyle = '#fff';
            ctx.fillStyle = '#fff';
        } else {
            ctx.strokeStyle = '#ff0';
            ctx.fillStyle = '#ff0';
        }
        ctx.lineWidth = 3;
        
        const r = this.tube.radius;
        
        // Get the segment boundaries (player spans across a segment)
        const leftAngle = this.segment * this.tube.angleStep;
        let rightAngle = ((this.segment + 1) % this.tube.segments) * this.tube.angleStep;
        
        // Handle wrap-around for rendering
        if (rightAngle < leftAngle) {
            rightAngle += Math.PI * 2;
        }
        
        const centerAngle = this.angle; // Middle of the segment
        
        // Claw positioning with flex
        const innerR = r * (0.9 - this.flexAmount * 0.1);
        const clawDepth = r * (0.85 - this.flexAmount * 0.1);
        
        // Calculate claw points
        const leftX = Math.cos(leftAngle) * r;
        const leftY = Math.sin(leftAngle) * r;
        const rightX = Math.cos(rightAngle) * r;
        const rightY = Math.sin(rightAngle) * r;
        const centerX = Math.cos(centerAngle) * clawDepth;
        const centerY = Math.sin(centerAngle) * clawDepth;
        const backX = Math.cos(centerAngle) * innerR;
        const backY = Math.sin(centerAngle) * innerR;
        
        // Draw the claw shape (similar to the reference image)
        ctx.beginPath();
        // Left edge
        ctx.moveTo(leftX, leftY);
        ctx.lineTo(centerX, centerY);
        // Right edge
        ctx.lineTo(rightX, rightY);
        // Back edge connecting the span
        ctx.lineTo(backX, backY);
        ctx.lineTo(leftX, leftY);
        ctx.closePath();
        ctx.stroke();
        
        // Draw center line (aiming line)
        ctx.beginPath();
        ctx.moveTo(backX, backY);
        ctx.lineTo(Math.cos(centerAngle) * r, Math.sin(centerAngle) * r);
        ctx.stroke();
        
        // Add flex animation details
        if (this.flexAmount > 0) {
            ctx.strokeStyle = `rgba(255, 255, 0, ${this.flexAmount})`;
            ctx.lineWidth = 2;
            // Extra lines during flex
            const flex1X = Math.cos(centerAngle - this.tube.angleStep * 0.25) * (r - 5);
            const flex1Y = Math.sin(centerAngle - this.tube.angleStep * 0.25) * (r - 5);
            const flex2X = Math.cos(centerAngle + this.tube.angleStep * 0.25) * (r - 5);
            const flex2Y = Math.sin(centerAngle + this.tube.angleStep * 0.25) * (r - 5);
            
            ctx.beginPath();
            ctx.moveTo(flex1X, flex1Y);
            ctx.lineTo(centerX, centerY);
            ctx.moveTo(flex2X, flex2Y);
            ctx.lineTo(centerX, centerY);
            ctx.stroke();
        }
    }
}

class Enemy {
    constructor(tube, segment, type) {
        this.tube = tube;
        this.segment = segment;
        this.type = type;
        this.depth = 0.9;
        this.speed = type === 'flipper' ? 0.3 : type === 'fuseball' ? 0.4 : 0.2;
        this.size = 15;
        this.health = type === 'tanker' ? 2 : 1;
        this.points = type === 'tanker' ? 100 : type === 'fuseball' ? 150 : 50;
        this.destroyed = false;
        this.moveTimer = 0;
        this.direction = -1; // -1 = coming out, 1 = going back in
        this.directionChangeTimer = 0;
        this.spike = null;
        this.furthestDepth = this.depth;
        this.jumping = false; // For fuseballs
        this.jumpTimer = 0;
        this.updatePosition();
    }
    
    updatePosition() {
        const pos = this.tube.getPosition(this.segment, this.depth);
        this.x = pos.x;
        this.y = pos.y;
    }
    
    update(deltaTime, game) {
        // Fuseball special behavior
        if (this.type === 'fuseball') {
            this.jumpTimer += deltaTime;
            
            // Jump between lanes unpredictably
            if (this.jumpTimer > 500 && !this.jumping && Math.random() < 0.01) {
                this.jumping = true;
                this.targetSegment = (this.segment + (Math.random() < 0.5 ? 1 : -1) + this.tube.segments) % this.tube.segments;
                this.jumpProgress = 0;
            }
            
            // Animate jump
            if (this.jumping) {
                this.jumpProgress += deltaTime / 300; // 300ms jump duration
                if (this.jumpProgress >= 1) {
                    this.segment = this.targetSegment;
                    this.jumping = false;
                    this.jumpTimer = 0;
                }
            }
            
            // Fuseballs move back and forth unpredictably
            this.depth += this.direction * this.speed * deltaTime / 1000;
            if (Math.random() < 0.02) {
                this.direction *= -1;
            }
            
            // Keep within bounds
            this.depth = Math.max(0, Math.min(0.9, this.depth));
        } else {
            // Normal enemy behavior
            this.depth += this.direction * this.speed * deltaTime / 1000;
            
            // Track furthest point and manage spike (not for fuseballs)
            if (this.type !== 'fuseball' && this.direction === -1 && this.depth < this.furthestDepth) {
                this.furthestDepth = this.depth;
                
                if (!this.spike) {
                    this.spike = new Spike(this.tube, this.segment);
                    game.spikes.push(this.spike);
                }
                this.spike.extend(this.depth);
            }
            
            // Only flippers can change segments at center
            if (this.type === 'flipper' && this.depth >= 0.95) {
                this.moveTimer += deltaTime;
                if (this.moveTimer > 1000 && Math.random() < 0.5) {
                    const oldSegment = this.segment;
                    this.segment = (this.segment + (Math.random() < 0.5 ? 1 : -1) + this.tube.segments) % this.tube.segments;
                    this.moveTimer = 0;
                    
                    if (this.spike && oldSegment !== this.segment) {
                        this.spike = null;
                        this.furthestDepth = this.depth;
                    }
                }
            }
            
            // Handle boundaries
            if (this.depth <= 0) {
                this.depth = 0;
                if (Math.random() < 0.02) {
                    this.direction = 1;
                }
            } else if (this.depth >= 0.95) {
                if (Math.random() < 0.7) {
                    this.direction = -1;
                } else {
                    this.destroyed = true;
                }
            }
        }
        
        this.updatePosition();
    }
    
    hit(damage) {
        // Fuseballs can only be hit when jumping
        if (this.type === 'fuseball' && !this.jumping) {
            return; // Invulnerable unless jumping
        }
        
        this.health -= damage;
        if (this.health <= 0) {
            this.destroyed = true;
        }
    }
    
    render(ctx) {
        const scale = 0.2 + (1 - this.depth) * 0.8;
        const size = this.size * scale;
        
        // Draw sizzle effect if enemy is extending a spike
        if (this.spike && this.direction === -1 && this.depth <= this.furthestDepth + 0.02) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            for (let i = 0; i < 3; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * size;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(
                    this.x + Math.cos(angle) * dist,
                    this.y + Math.sin(angle) * dist
                );
                ctx.stroke();
            }
        }
        
        if (this.type === 'flipper') {
            ctx.strokeStyle = '#f0f';
            ctx.lineWidth = 2;
            
            // Spider-like body
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, size/2, size/3, 0, 0, Math.PI * 2);
            ctx.stroke();
            
            // Legs
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2 - Math.PI/2;
                const legX = Math.cos(angle) * size * 0.8;
                const legY = Math.sin(angle) * size * 0.8;
                
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x + legX, this.y + legY);
                ctx.lineTo(this.x + legX * 1.2, this.y + legY * 1.2 + size * 0.3);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x - legX, this.y + legY);
                ctx.lineTo(this.x - legX * 1.2, this.y + legY * 1.2 + size * 0.3);
                ctx.stroke();
            }
            
            // Eyes
            ctx.fillStyle = '#f0f';
            ctx.beginPath();
            ctx.arc(this.x - size/6, this.y - size/6, 2, 0, Math.PI * 2);
            ctx.arc(this.x + size/6, this.y - size/6, 2, 0, Math.PI * 2);
            ctx.fill();
            
        } else if (this.type === 'tanker') {
            // Tanker - more mechanical/alien
            ctx.strokeStyle = '#0ff';
            ctx.lineWidth = 2;
            
            // Main body segments
            ctx.beginPath();
            ctx.moveTo(this.x - size/2, this.y);
            ctx.lineTo(this.x - size/3, this.y - size/2);
            ctx.lineTo(this.x + size/3, this.y - size/2);
            ctx.lineTo(this.x + size/2, this.y);
            ctx.lineTo(this.x + size/3, this.y + size/2);
            ctx.lineTo(this.x - size/3, this.y + size/2);
            ctx.closePath();
            ctx.stroke();
            
            // Inner details
            ctx.beginPath();
            ctx.moveTo(this.x, this.y - size/2);
            ctx.lineTo(this.x, this.y + size/2);
            ctx.moveTo(this.x - size/3, this.y);
            ctx.lineTo(this.x + size/3, this.y);
            ctx.stroke();
            
            // Spikes
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x - size/4, this.y - size * 0.7);
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + size/4, this.y - size * 0.7);
            ctx.stroke();
        } else if (this.type === 'fuseball') {
            // Fuseball - white sphere with tendrils
            ctx.strokeStyle = '#fff';
            ctx.fillStyle = this.jumping ? '#ff0' : '#fff'; // Yellow when vulnerable
            ctx.lineWidth = 2;
            
            // Draw tendrils
            const tendrilCount = 6;
            for (let i = 0; i < tendrilCount; i++) {
                const angle = (i / tendrilCount) * Math.PI * 2 + Date.now() * 0.001;
                const tendrilLength = size * 1.5;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                const tx = this.x + Math.cos(angle) * tendrilLength;
                const ty = this.y + Math.sin(angle) * tendrilLength;
                ctx.lineTo(tx, ty);
                // Add wavy effect
                const wx = tx + Math.cos(angle + Math.PI/2) * Math.sin(Date.now() * 0.005 + i) * size * 0.3;
                const wy = ty + Math.sin(angle + Math.PI/2) * Math.sin(Date.now() * 0.005 + i) * size * 0.3;
                ctx.quadraticCurveTo(wx, wy, tx, ty);
                ctx.stroke();
            }
            
            // Draw main sphere
            ctx.beginPath();
            ctx.arc(this.x, this.y, size * 0.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Draw jump arc if jumping
            if (this.jumping) {
                const startPos = this.tube.getPosition(this.segment, this.depth);
                const endPos = this.tube.getPosition(this.targetSegment, this.depth);
                const midX = (startPos.x + endPos.x) / 2;
                const midY = (startPos.y + endPos.y) / 2;
                const arcHeight = 30 * Math.sin(this.jumpProgress * Math.PI);
                
                ctx.strokeStyle = '#ff0';
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(startPos.x, startPos.y);
                ctx.quadraticCurveTo(midX, midY - arcHeight, endPos.x, endPos.y);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    }
}

class Projectile {
    constructor(x, y, segment, tube, owner) {
        this.segment = segment;
        this.tube = tube;
        this.owner = owner;
        this.depth = 0;
        this.speed = 1.5;
        this.damage = 1;
        this.destroyed = false;
        this.updatePosition();
    }
    
    updatePosition() {
        const pos = this.tube.getPosition(this.segment, this.depth);
        this.x = pos.x;
        this.y = pos.y;
    }
    
    update(deltaTime) {
        this.depth += this.speed * deltaTime / 1000;
        this.updatePosition();
        
        if (this.depth > 1) {
            this.destroyed = true;
        }
    }
    
    render(ctx) {
        ctx.fillStyle = '#ff0';
        ctx.fillRect(this.x - 2, this.y - 6, 4, 12);
    }
}

class Explosion {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 5;
        this.maxRadius = 30;
        this.finished = false;
    }
    
    update(deltaTime) {
        this.radius += 50 * deltaTime / 1000;
        if (this.radius > this.maxRadius) {
            this.finished = true;
        }
    }
    
    render(ctx) {
        ctx.strokeStyle = `rgba(255, 255, 0, ${1 - this.radius / this.maxRadius})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
    }
}

class Spike {
    constructor(tube, segment) {
        this.tube = tube;
        this.segment = segment;
        this.startDepth = 1;
        this.endDepth = 1;
        this.health = 3;
        this.destroyed = false;
        this.sizzleTimer = 0;
    }
    
    extend(newDepth) {
        if (newDepth < this.endDepth) {
            this.endDepth = newDepth;
        }
    }
    
    hit(damage) {
        this.health -= damage;
        // Shorten the spike
        this.endDepth = Math.min(1, this.endDepth + 0.1);
        if (this.endDepth >= this.startDepth || this.health <= 0) {
            this.destroyed = true;
        }
    }
    
    update(deltaTime) {
        this.sizzleTimer += deltaTime;
    }
    
    render(ctx) {
        const start = this.tube.getPosition(this.segment, this.startDepth);
        const end = this.tube.getPosition(this.segment, this.endDepth);
        
        // Draw the spike trail
        ctx.strokeStyle = '#f0f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        
        // Draw sizzle effect
        if (Math.sin(this.sizzleTimer * 0.01) > 0) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            const sizzlePos = this.tube.getPosition(this.segment, this.endDepth + 0.05);
            ctx.beginPath();
            ctx.moveTo(end.x, end.y);
            ctx.lineTo(sizzlePos.x, sizzlePos.y);
            ctx.stroke();
        }
        
        // Draw bright dot at the end
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(end.x, end.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

const game = new Game();
let lastTime = 0;

function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    
    game.update(deltaTime);
    game.render();
    
    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);