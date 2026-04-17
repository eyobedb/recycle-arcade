import React, { useEffect, useState, useRef } from 'react';
import Phaser from 'phaser';
import { Play, RotateCcw, Volume2, VolumeX, Info } from 'lucide-react';
import { Howl } from 'howler';

// --- Types ---
type GameState = 'START' | 'PLAYING' | 'GAMEOVER';

// --- Constants ---
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

// --- Sound Management ---
const bgMusic = new Howl({
  src: ['https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13d69d2.mp3'],
  loop: true,
  volume: 0.5,
  html5: true,
  onloaderror: (id, err) => console.error('Audio load error:', err),
  onplayerror: (id, err) => {
    console.error('Audio play error:', err);
    bgMusic.once('unlock', () => bgMusic.play());
  }
});

const collectSfx = new Howl({
  src: ['https://cdn.pixabay.com/audio/2021/08/04/audio_0625c1539c.mp3'],
  volume: 0.7
});

const failSfx = new Howl({
  src: ['https://cdn.pixabay.com/audio/2021/08/04/audio_c3e60249c5.mp3'],
  volume: 0.8
});

// --- Phaser Scene ---
class EcoQuestScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private items!: Phaser.Physics.Arcade.Group;
  private obstacles!: Phaser.Physics.Arcade.Group;
  private spawnTimer!: Phaser.Time.TimerEvent;
  private score: number = 0;
  private isGameOver: boolean = false;
  
  // Initialize with no-op functions to prevent "is not a function" errors
  private onScoreUpdate: (score: number) => void = () => {};
  private onGameOver: (score: number) => void = () => {};

  constructor() {
    super('EcoQuestScene');
  }

  init(data?: { onScoreUpdate: (s: number) => void; onGameOver: (s: number) => void }) {
    if (data?.onScoreUpdate) this.onScoreUpdate = data.onScoreUpdate;
    if (data?.onGameOver) this.onGameOver = data.onGameOver;
    this.score = 0;
    this.isGameOver = false;
  }

  preload() {
    // Generate textures programmatically
    const heroGfx = this.make.graphics({ x: 0, y: 0, add: false });
    heroGfx.fillStyle(0x34d399); 
    heroGfx.fillCircle(16, 16, 16);
    heroGfx.fillStyle(0xffffff);
    heroGfx.fillCircle(10, 10, 3);
    heroGfx.fillCircle(22, 10, 3);
    heroGfx.generateTexture('hero', 32, 32);

    const bottleGfx = this.make.graphics({ x: 0, y: 0, add: false });
    bottleGfx.fillStyle(0x10b981);
    bottleGfx.fillRect(8, 4, 8, 4);
    bottleGfx.fillRect(4, 8, 16, 20);
    bottleGfx.generateTexture('bottle', 24, 32);

    const trashGfx = this.make.graphics({ x: 0, y: 0, add: false });
    trashGfx.fillStyle(0xef4444);
    trashGfx.fillRect(4, 4, 24, 24);
    trashGfx.fillStyle(0x991b1b);
    trashGfx.fillRect(2, 2, 28, 4);
    trashGfx.generateTexture('trash', 32, 32);
  }

  create() {
    this.cameras.main.setBackgroundColor('#ecfdf5');

    // Player
    this.player = this.physics.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT - 50, 'hero');
    this.player.setCollideWorldBounds(true);

    // Groups
    this.items = this.physics.add.group();
    this.obstacles = this.physics.add.group();

    // Controls
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
    }

    // Spawning logic
    this.spawnTimer = this.time.addEvent({
      delay: 1000,
      callback: this.spawnFallingObject,
      callbackScope: this,
      loop: true
    });

    // Collisions
    this.physics.add.overlap(this.player, this.items, this.collectBottle, undefined, this);
    this.physics.add.overlap(this.player, this.obstacles, this.hitObstacle, undefined, this);

    // Touch support
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isGameOver) {
        this.player.x = Phaser.Math.Clamp(pointer.x, 20, GAME_WIDTH - 20);
      }
    });
  }

  update() {
    if (this.isGameOver) return;

    if (this.cursors?.left?.isDown) {
      this.player.setVelocityX(-400);
    } else if (this.cursors?.right?.isDown) {
      this.player.setVelocityX(400);
    } else {
      this.player.setVelocityX(0);
    }

    // Clean up off-screen objects
    this.items.children.iterate((child: any) => {
      if (child && child.y > GAME_HEIGHT + 20) {
        child.destroy();
      }
      return true;
    });
    this.obstacles.children.iterate((child: any) => {
      if (child && child.y > GAME_HEIGHT + 20) {
        child.destroy();
      }
      return true;
    });
  }

  spawnFallingObject() {
    if (this.isGameOver) return;

    const x = Phaser.Math.Between(30, GAME_WIDTH - 30);
    const isObstacle = Math.random() > 0.6;

    if (isObstacle) {
      const trash = this.obstacles.create(x, -20, 'trash');
      trash.setVelocityY(Phaser.Math.Between(200, 350));
      trash.setAngularVelocity(Phaser.Math.Between(-100, 100));
    } else {
      const bottle = this.items.create(x, -20, 'bottle');
      bottle.setVelocityY(Phaser.Math.Between(150, 300));
    }
    
    this.spawnTimer.delay = Math.max(300, 1000 - (this.score * 2));
  }

  collectBottle(player: any, bottle: any) {
    bottle.destroy();
    this.score += 10;
    if (this.onScoreUpdate) {
      this.onScoreUpdate(this.score);
    }
    collectSfx.play();
  }

  hitObstacle(player: any, obstacle: any) {
    this.isGameOver = true;
    this.physics.pause();
    this.player.setTint(0xff0000);
    this.spawnTimer.remove();
    failSfx.play();
    if (this.onGameOver) {
      this.onGameOver(this.score);
    }
  }
}

// --- React Components ---

const GameUI: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [muted, setMuted] = useState(() => localStorage.getItem('ecoQuestMuted') === 'true');
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    localStorage.setItem('ecoQuestMuted', String(muted));
    bgMusic.mute(muted);
    collectSfx.mute(muted);
    failSfx.mute(muted);
  }, [muted]);

  useEffect(() => {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      parent: 'game-container',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scene: EcoQuestScene,
      backgroundColor: '#ecfdf5',
    };

    gameRef.current = new Phaser.Game(config);

    return () => {
      gameRef.current?.destroy(true);
      bgMusic.stop();
    };
  }, []);

  const startGame = () => {
    setGameState('PLAYING');
    setScore(0);
    if (!bgMusic.playing()) {
      bgMusic.play();
    }
    
    const scene = gameRef.current?.scene.getScene('EcoQuestScene') as EcoQuestScene;
    if (scene) {
      scene.scene.restart({
        onScoreUpdate: (s: number) => setScore(s),
        onGameOver: (s: number) => {
          setGameState('GAMEOVER');
          setScore(s);
          bgMusic.stop();
        }
      });
    }
  };

  const toggleMute = () => setMuted(!muted);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-green-50 p-4 font-sans select-none overflow-hidden">
      <div className="w-full max-w-[800px] flex justify-between items-center mb-4">
        <h1 className="text-3xl font-extrabold text-green-700 flex items-center gap-2">
          <span className="bg-green-600 text-white p-1 rounded-lg">Eco</span>Quest
        </h1>
        <div className="flex gap-4 items-center">
          <div className="text-xl font-bold text-green-800 bg-white px-4 py-1 rounded-full shadow-sm border-2 border-green-100">
            Score: {score}
          </div>
          <button 
            onClick={toggleMute}
            className="p-2 bg-white rounded-full shadow hover:bg-green-100 transition-colors border border-green-200"
          >
            {muted ? <VolumeX className="text-red-500" /> : <Volume2 className="text-green-600" />}
          </button>
        </div>
      </div>

      <div className="relative rounded-2xl overflow-hidden shadow-2xl border-8 border-green-600 bg-emerald-50 aspect-[4/3] w-full max-w-[800px]">
        <div id="game-container" />

        {gameState === 'START' && (
          <div className="absolute inset-0 bg-green-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 text-center animate-in fade-in duration-500">
            <div className="bg-white text-green-900 p-8 rounded-3xl shadow-2xl max-w-md w-full">
              <h2 className="text-4xl font-black mb-4">Eco Hero Ready?</h2>
              <p className="text-lg mb-6 leading-relaxed">
                <span className="font-bold text-green-600">The world needs you!</span><br/>
                Clean up the falling waste.
              </p>
              
              <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex flex-col items-center">
                  <div className="w-8 h-8 bg-green-500 rounded-full mb-2 flex items-center justify-center text-white font-bold">+10</div>
                  <span className="text-emerald-800 font-semibold">Green Bottles</span>
                </div>
                <div className="bg-red-50 p-3 rounded-xl border border-red-100 flex flex-col items-center">
                  <div className="w-8 h-8 bg-red-500 rounded-sm mb-2 flex items-center justify-center text-white font-bold">!</div>
                  <span className="text-red-800 font-semibold">Avoid Trash</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-gray-500 text-sm italic">
                  <Info size={16} /> Use Arrow Keys or Slide to move
                </div>
                <button
                  onClick={startGame}
                  className="w-full group relative flex items-center justify-center gap-3 bg-green-600 hover:bg-green-500 text-white font-black text-2xl py-5 rounded-2xl transition-all active:scale-95 shadow-[0_8px_0_rgb(21,128,61)]"
                >
                  <Play fill="currentColor" /> PLAY NOW
                </button>
              </div>
            </div>
          </div>
        )}

        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-red-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 text-center animate-in zoom-in duration-300">
            <div className="bg-white text-red-900 p-8 rounded-3xl shadow-2xl max-w-xs w-full">
              <h2 className="text-4xl font-black mb-2">Oops!</h2>
              <p className="text-gray-600 mb-6 font-medium">You hit a trash can!</p>
              
              <div className="text-center mb-8">
                <p className="text-sm text-gray-400 uppercase tracking-widest font-bold">Final Score</p>
                <div className="text-6xl font-black text-green-600">{score}</div>
              </div>

              <button
                onClick={startGame}
                className="w-full group flex items-center justify-center gap-3 bg-red-600 hover:bg-red-500 text-white font-black text-xl py-4 rounded-2xl transition-all active:scale-95 shadow-[0_6px_0_rgb(153,27,27)]"
              >
                <RotateCcw /> TRY AGAIN
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 text-green-800 flex flex-col items-center gap-2 text-center max-w-lg">
        <p className="font-bold opacity-75">GOAL: RECYCLE AS MUCH AS YOU CAN!</p>
        <div className="flex gap-4">
          <kbd className="px-2 py-1 bg-white border-2 border-green-200 rounded-md shadow-sm text-xs font-mono">←</kbd>
          <kbd className="px-2 py-1 bg-white border-2 border-green-200 rounded-md shadow-sm text-xs font-mono">→</kbd>
          <span className="text-sm">Move Left / Right</span>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  return <GameUI />;
}