# @2817/audio

Audio management package for games, built on top of [Howler.js](https://howlerjs.com/). Provides separate players for sound effects and background music with features like fading, looping, and browser audio context handling.

## Installation

```bash
npm install @2817/audio
```

## Dependencies

- `howler` - Audio library

## Overview

This package exports two factory functions:

- **`createSoundPlayer()`** - For short sound effects (UI clicks, footsteps, impacts)
- **`createMusicPlayer()`** - For background music with advanced features like crossfading, pause/resume, and a stack-based layering system

Both players handle browser autoplay restrictions and tab visibility changes automatically.

## Sound Player

Best for short, one-shot sound effects.

### Basic Usage

```typescript
import { createSoundPlayer } from '@2817/audio'

const sounds = createSoundPlayer()

// Add sounds
sounds
  .add('click', '/audio/click.mp3')
  .add('explosion', '/audio/explosion.mp3')
  .add('footstep1', '/audio/footstep1.mp3')
  .add('footstep2', '/audio/footstep2.mp3')

// Play a sound
sounds.play('click')

// Play with options
sounds.play('explosion', { volume: 0.5 })

// Loop a sound
sounds.play('ambience', { loop: true })

// Stop a sound
sounds.stop('ambience')

// Remove a sound mid-game (stops, unloads, and deletes)
sounds.remove('explosion')

// Mute all sounds
sounds.setMute(true)

// Cleanup when done
sounds.destroy()
```

### Random Sound Pools

Play random variations of a sound when looping:

```typescript
sounds.play('footstep1', {
  loop: true,
  randomPool: ['footstep1', 'footstep2', 'footstep3'],
})
```

### Add Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `preload` | `boolean` | `true` | Preload the audio file |
| `autoplay` | `boolean` | `false` | Start playing immediately after load |
| `onLoaded` | `() => void` | - | Callback when audio file is loaded |

### Play Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `loop` | `boolean` | `false` | Loop the sound |
| `volume` | `number` | `1` | Volume level (0-1) |
| `onEnd` | `() => void` | - | Callback when sound finishes |
| `randomPool` | `string[]` | - | Array of sound names to randomly select from when looping |

## Music Player

Best for background music with crossfading and layering.

### Basic Usage

```typescript
import { createMusicPlayer } from '@2817/audio'

const music = createMusicPlayer()

// Add tracks
music
  .add('menu', '/audio/menu-theme.mp3')
  .add('gameplay', '/audio/gameplay-theme.mp3')
  .add('boss', '/audio/boss-theme.mp3')

// Play a track (crossfades from any currently playing track)
music.play('menu')

// Switch to another track (crossfades automatically)
music.play('gameplay')

// Pause and resume
music.pause()
music.resume()

// Fade out all tracks
music.fadeOutAll({ duration: 5000 })

// Cleanup when done
music.destroy()
```

### Stack-Based Layering (Push/Pop)

Use `push()` and `pop()` to layer music tracks. This is useful for temporary music changes (e.g., entering a boss fight, triggering an event):

```typescript
// Playing background music
music.play('exploration')

// Player enters combat - push combat music (exploration fades out but stays in stack)
music.push('combat')

// Combat ends - pop combat music (exploration fades back in)
music.pop()

// Check how many tracks are in the stack
const count = music.getActiveTracksCount()
```

### Add Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `preload` | `boolean` | `true` | Preload the audio file |
| `autoplay` | `boolean` | `true` | Start playing immediately after load |
| `onLoaded` | `() => void` | - | Callback when audio file is loaded |
| `onUnlock` | `() => void` | - | Callback when audio context is unlocked |

### Play Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `loop` | `boolean` | `true` | Loop the track |
| `volume` | `number` | `0.2` | Volume level (0-1) |
| `fade` | `boolean` | `true` | Fade in when starting |
| `fadeDuration` | `number` | `1000` | Fade duration in milliseconds |
| `onEnd` | `() => void` | - | Callback when track finishes (fires each loop if looping) |

### Other Methods

```typescript
// Fade out all tracks over 10 seconds (default)
music.fadeOutAll()
music.fadeOutAll({ duration: 5000 })

// Pause all active tracks
music.pause()

// Resume with options
music.resume()
music.resume({ fade: true, fadeDuration: 500 })

// Pop the top track from the stack
music.pop()
music.pop({ duration: 2000 })

// Stop a specific track
music.stop('combat')

// Stop the currently active track
music.stop()

// Remove a track mid-game (stops, unloads, and deletes)
music.remove('boss')
```

## Browser Audio Context Handling

Both players automatically handle:

1. **Autoplay restrictions** - Actions are queued when the audio context is suspended and executed when it becomes available (after user interaction)
2. **Tab visibility** - Audio context is resumed when the tab becomes visible again

This means you can call `play()` before user interaction, and the audio will start once the browser allows it.

## Cleanup

Always call `destroy()` when you're done with a player to remove event listeners and free resources:

```typescript
sounds.destroy()
music.destroy()
```

## TypeScript

The package exports TypeScript interfaces:

```typescript
import type {
  ISoundPlayer,
  IMusicPlayer,
  AddOptions,
  PlayOptions,
  FadeOutAllOptions,
  ResumeOptions,
  PopOptions,
} from '@2817/audio'
```
