# Tempest

A browser-based implementation of the classic 1981 arcade game Tempest, built with HTML5 Canvas and vanilla JavaScript.

## 🎮 Play Now

**[Play online at tempest-game.pages.dev](https://tempest-game.pages.dev/)**

Or download and open `index.html` in any modern web browser. No installation or build process required!

## 🕹️ Controls

- **Arrow Keys** - Move left/right between segments
- **Space** - Shoot (hold for continuous fire, max 8 shots)
- **Z** - Superzapper (2 per level)
- **R** - Restart when game over

## 🎯 Gameplay

Navigate your claw-shaped ship around the rim of a geometric tube, defending against enemies crawling up from the depths:

### Enemies
- **Flippers** (Purple) - Spider-like creatures that change lanes at the tube's center
- **Tankers** (Cyan) - Split into two Flippers when destroyed
- **Fuseballs** (White) - Jump between lanes, only vulnerable while jumping

### Features
- Progressive difficulty with more enemies each level
- Spike hazards left by advancing enemies
- Superzapper clears all enemies on screen
- Smooth movement with wrap-around at segment boundaries
- Classic vector-style graphics with modern effects

## 🛠️ Technical Details

- Pure vanilla JavaScript - no frameworks or dependencies
- HTML5 Canvas for rendering
- 60fps game loop using `requestAnimationFrame`
- Modular class-based architecture
- Responsive vector graphics that scale with canvas size

## 📁 Project Structure

```
tempest/
├── index.html      # Game HTML with UI elements
├── tempest.js      # Complete game logic and rendering
├── README.md       # This file
└── CLAUDE.md       # Developer documentation
```

## 🚀 Development

The game runs directly from the filesystem - just edit and refresh! Key classes:

- `Game` - Main game controller and state management
- `Tube` - The geometric playfield
- `Player` - Ship movement and shooting
- `Enemy` - Base enemy behaviors
- `Spike` - Hazard trails
- `Projectile` - Player bullets

See `CLAUDE.md` for detailed architecture notes and common issues.

## 📜 License

This is a fan recreation for educational purposes. Tempest is a trademark of Atari, Inc.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a browser-based implementation of the classic arcade game Tempest using HTML5 Canvas and vanilla JavaScript.

## Running the Game

Open `index.html` in a web browser. No build process or dependencies required.

## Architecture

### Core Game Loop
- `tempest.js` contains all game logic in a single file
- Main game loop uses `requestAnimationFrame` for smooth 60fps rendering
- Game states: PLAYING, LEVEL_COMPLETE, WARPING, GAME_OVER

### Key Classes

**Game** - Main controller that manages:
- Game state and progression
- Enemy spawning with wave system
- Collision detection between projectiles, enemies, spikes, and player
- Level transitions and warping sequences

**Tube** - The geometric playfield:
- 16 segments forming a circular tunnel
- `getPosition(segment, depth)` returns coordinates in CENTER of segments
- Player sits BETWEEN segments on the rim, enemies travel UP segment centers

**Player** - The claw-shaped ship:
- Positioned between segment dividing lines, protects one segment
- Smooth movement interpolation with wrap-around handling
- Shoots projectiles down the center of protected segment

**Enemy Types**:
- Flippers: Spider-like, can change segments only at center
- Tankers: Split into 2 Flippers when destroyed
- Fuseballs: Jump between lanes, only vulnerable while jumping

**Spike** - Hazard trails left by enemies as they advance

### Critical Mechanics

1. **Positioning System**:
   - Segments are numbered 0-15
   - Player position is BETWEEN segments (e.g., between 0 and 1)
   - Enemies/projectiles travel in CENTER of segments
   - This is crucial for collision detection

2. **Wrap-Around Handling**:
   - Special logic for movement between segments 15 and 0
   - Angle calculations must handle the 0/360° boundary
   - See `updatePosition()` in Player class for implementation

3. **Visual Feedback**:
   - Active segment highlighted with yellow glow
   - Player flashes when invulnerable after hit
   - Screen flash on damage

## Common Issues and Solutions

**Visual glitches at wrap-around point**: Check angle calculations in Player's `updatePosition()` and `render()` methods. Ensure proper modulo arithmetic and 2π additions.

**Collision detection misses**: Remember player covers a segment, enemies are in segment centers. Player segment check should be exact match.

**Movement stuttering**: Verify `moveProgress` interpolation and `deltaTime` calculations.

## Game Controls
- Arrow Keys: Move left/right between segments
- Space: Shoot (hold for continuous fire, max 8 shots)
- Z: Superzapper (2 per level)
- R: Restart when game over


# Tempest Arcade Authenticity Roadmap

This roadmap outlines improvements to make the game more faithful to the original 1981 Atari Tempest arcade game.

## Phase 1: Core Mechanics (Quick Wins)

### 1.1 Superzapper Fix ✓ High Priority
- [ ] Change from 2 full zaps to 1 full + 1 partial zap per level
- [ ] Full zap: Kills all enemies (not spikes)
- [ ] Partial zap: Kills one enemy (prioritize threats like Fuseballs near rim)
- [ ] Update UI to show zapper state clearly

### 1.2 Movement System
- [ ] Convert from discrete segment jumps to continuous rotation
- [ ] Make segment a float value for smooth analog-style movement
- [ ] Add rotation speed control (faster when held)
- [ ] Consider gamepad support for spinner emulation

### 1.3 Scoring Authenticity
- [ ] Flippers: 150-300 points (random)
- [ ] Tankers: 100 points
- [ ] Fuseballs: 200-700 points (random)
- [ ] Spikers: 50 points per hit
- [ ] Bonus life every 20,000 points
- [ ] Implement high score table with localStorage

## Phase 2: Level Shapes and Progression

### 2.1 Web Shape System
- [ ] Implement 16 unique web shapes (not just circles):
  - Circle (16 segments)
  - Square (4 segments)
  - Plus/Cross
  - Bowtie/Figure-8
  - Flat line (open ends)
  - Triangle
  - Star
  - V-shape
  - Infinity symbol
  - Others...
- [ ] Cycle through shapes every 16 levels
- [ ] Color progression: Blue (1-16), Yellow (17-32), Red (33-48), Green (49-64), Invisible (65-80)

### 2.2 Level Selection
- [ ] Start screen with level selection (1, 3, 5, 7, 9, 11...)
- [ ] Save max reached level in localStorage

## Phase 3: Enemy Behaviors

### 3.1 Fix Existing Enemies
- [ ] **Flippers**: Add lane-flipping behavior to chase player
- [ ] **Fuseballs**: Move along edges (not center), invulnerable except when crossing lanes
- [ ] **Tankers**: Ensure they leave spikes properly

### 3.2 Add Missing Enemy Types
- [ ] **Spikers**: Spiral movement, always leave spikes, multi-hit destruction
- [ ] **Pulsars**: Zig-zag movement, periodically electrify their lane
- [ ] **(Bonus) Sparx**: Rim crawlers that chase the player

### 3.3 Wave System
- [ ] Spawn enemies in waves from bottom
- [ ] Level-specific enemy mixes (e.g., Pulsars from level 5+)
- [ ] Progressive difficulty with speed multipliers

## Phase 4: Audio System

### 4.1 Sound Effects
- [ ] Shooting sound (high beep)
- [ ] Enemy destruction (explosion)
- [ ] Superzapper (distinctive zap)
- [ ] Player hit (alarm sound)
- [ ] Level complete (ascending tones)
- [ ] Warp sequence sounds

### 4.2 Implementation
- [ ] Use Web Audio API for retro synthesis
- [ ] Optional: Load authentic arcade samples

## Phase 5: Visual Polish

### 5.1 Vector Graphics Style
- [ ] Remove filled shapes, use glowing strokes only
- [ ] Add bloom/glow effects
- [ ] Implement CRT scanline effect (optional toggle)
- [ ] Particle trails for projectiles

### 5.2 UI Improvements
- [ ] Attract mode demo
- [ ] Pause functionality (P key)
- [ ] Game over ranking display
- [ ] Credits screen

## Phase 6: Modern Enhancements

### 6.1 Controls
- [ ] Gamepad API support
- [ ] Touch controls for mobile
- [ ] Customizable key bindings

### 6.2 Accessibility
- [ ] Colorblind mode options
- [ ] Screen reader support for UI
- [ ] Adjustable game speed

### 6.3 Performance
- [ ] Optimize rendering for 60fps on all devices
- [ ] Dynamic canvas scaling
- [ ] Efficient collision detection

## Implementation Priority

1. **Essential for Authenticity** (Do First):
   - Superzapper fix
   - Continuous movement
   - Basic web shapes (at least 4-5)
   - Fix enemy behaviors
   - Basic audio

2. **Major Impact** (Do Second):
   - All 16 web shapes
   - Missing enemy types
   - Complete audio system
   - Vector visual style

3. **Polish** (Do Last):
   - Modern enhancements
   - Accessibility features
   - Advanced visual effects

## Resources
- MAME emulator for reference gameplay
- Original arcade manual for scoring/mechanics
- YouTube gameplay videos for enemy patterns
- Atari Age forums for technical details