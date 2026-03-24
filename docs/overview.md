# Chess Game - Technical Overview

## Project Information

**Project Name:** P2P Chess - Multiplayer Chess with Hybrid Pieces

**Developers:** helim9 & mapcrafter2048

**Live Deployment:**
- [p2p-chess.tech](https://p2p-chess.tech)
- [combinechess.games](https://combinechess.games)

**Diagram Reference:**
- See [UML Diagrams](./uml-diagrams.md) for Mermaid architecture and sequence diagrams

## Introduction

This project is a modern, feature-rich chess game built using Next.js and Tailwind CSS. It implements a peer-to-peer (P2P) chess game where two players can play against each other in real-time using WebRTC technology. The game extends traditional chess with a unique piece combination system, allowing players to combine and decombine certain pieces to create powerful hybrid units.

The application demonstrates advanced web development practices including real-time peer-to-peer communication, custom game engine development, AI implementation, and modern React architecture patterns.

## Key Features

### 1. Peer-to-Peer Multiplayer

**WebRTC Implementation**
- Direct peer-to-peer connections for low-latency gameplay
- Eliminates the need for a game server, reducing infrastructure costs
- Real-time bidirectional communication via WebRTC DataChannel

**Firebase Signaling**
- Uses Firebase Firestore as a signaling server for WebRTC connection establishment
- Handles offer/answer exchange and ICE candidate collection
- Minimal latency signaling layer

**Connection Management**
- Robust reconnection logic with up to 3 retry attempts
- Exponential backoff for reconnection delays
- Connection health monitoring with heartbeat system (ping/pong mechanism)
- Automatic state synchronization on reconnection
- Graceful disconnection handling with proper cleanup and user notification

**State Synchronization**
- Full game state sync on connection establishment
- Incremental state updates during gameplay
- Conflict resolution for simultaneous actions

### 2. Hybrid Piece System

The game introduces a unique mechanic where players can combine two pieces into a hybrid piece with combined movement capabilities.

**Available Combinations:**
- Rook + Bishop → Rook-Bishop - Combines rook and bishop movement patterns
- Rook + Knight → Rook-Knight - Combines rook and knight movement patterns
- Bishop + Knight → Bishop-Knight - Combines bishop and knight movement patterns
- Queen + Knight → Queen-Knight - Combines queen and knight movement patterns

**Combination Rules:**
- Both pieces must belong to the current player
- Pieces must be adjacent (orthogonally or diagonally)
- Cannot combine while in check
- Cannot combine the King
- The resulting hybrid piece is placed on the square of the first selected piece
- The combination must not leave your King in check
- Validation ensures move legality after combination

**Decombination Rules:**
- Only hybrid pieces can be decombined
- Must have at least one empty adjacent square for component placement
- The decombination must be legal (cannot leave King in check)
- Components are placed on the original square and one adjacent square
- Two-assignment legality check ensures at least one valid component placement
- System tests both possible component assignments (C1 stays/C2 spawns vs C2 stays/C1 spawns)

### 3. Custom Game Engine

**Full Chess Rules Implementation**
- Castling (king-side and queen-side) with proper validation
- Pawn promotion with piece selection dialog
- Check detection with attack path calculation
- Checkmate detection with legal move enumeration
- Stalemate detection with draw condition checking

**Move Validation**
- Comprehensive move validation with legality checks
- Prevents moves that would leave the king in check
- Validates special moves (castling, promotion)
- Checks for piece-specific movement rules

**Game State Management**
- Centralized game state with immutable updates
- Undo/redo support with state stack management
- Complete move history tracking with notation
- Castling rights tracking
- En passant target tracking (en passant capture moves in development)
- Captured pieces tracking

**Move History**
- Complete move history with algebraic notation
- Move replay capability
- Game state reconstruction from history

### 4. AI Engine

A custom-built chess engine with advanced search and evaluation techniques.

**Search Algorithm**
- Alpha-beta pruning for optimized minimax search
- Fixed-depth search with configurable depth levels

**Performance Optimizations**
- Transposition tables using Zobrist hashing (500MB shared table)
- Position caching to avoid redundant calculations
- Move ordering with intelligent prioritization
  - Transposition table move hints prioritized
  - Captures ordered by MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
  - Center control bonuses for quiet moves
- Web Workers for parallel search (4 workers)
- Time management with maximum search time of 8 seconds per move

**Difficulty Levels**
- Easy: Search depth 3, suitable for beginners
- Medium: Search depth 4, balanced gameplay
- Hard: Search depth 6, challenging for experienced players

**Position Evaluation**
- Material balance calculation (centipawn values)
- Piece-square tables for positional evaluation
  - Pawn structure and central control
  - Piece placement bonuses
  - King safety considerations
- Hybrid piece evaluation with combined component values

### 5. Timer System

**Time Control Options**
- Bullet: 1 minute per player
- Blitz: 3 minutes, 5 minutes per player
- Rapid: 10 minutes, 15 minutes, 30 minutes per player

**Timer Features**
- Automatic decrement on each move
- Precise time tracking with millisecond accuracy
- Timeout detection and automatic game termination
- Time display with visual countdown
- Time control selection before game start

### 6. User Interface Features

**Responsive Design**
- Works seamlessly on desktop and mobile devices
- Adaptive layout for different screen sizes
- Touch-friendly controls for mobile devices

**Board Features**
- Automatic board orientation for black player in multiplayer
- Visual feedback with highlighted legal moves
- Selected piece indication
- Last move highlighting
- Check/checkmate visual indicators

**Information Display**
- Move history panel with scrollable notation
- Captured pieces display for both players
- Game status messages (check, checkmate, stalemate)
- Connection status indicators
- Timer display with color coding

**Game Controls**
- Undo/redo buttons (single-player mode)
- Reset game functionality
- Resign option
- Rematch system for multiplayer games
- Combine/decombine mode toggles

## Technology Stack

### Frontend

**Framework and Libraries**
- Next.js 16 with App Router for server-side rendering and routing
- React 19 for component-based UI development
- Tailwind CSS 4 for utility-first styling
- React Compiler (Babel plugin) for React optimization

### Backend & Services

**Real-time Communication**
- WebRTC for peer-to-peer communication protocol
- Firebase Firestore for real-time database and WebRTC signaling
- Cloudflare TURN servers for NAT traversal (optional, for difficult network configurations)

**API Services**
- Next.js API routes for server-side functionality
- TURN credentials endpoint for WebRTC configuration

### Development Tools

**Code Quality**
- ESLint for code linting and style enforcement
- Next.js ESLint configuration

**Performance Monitoring**
- Vercel Analytics for performance monitoring
- Vercel Speed Insights for performance metrics

**Build Tools**
- Next.js build system
- PostCSS for CSS processing
- Babel for JavaScript transpilation

## Architecture

### System Architecture

```
┌─────────────────┐
│   React UI      │
│   Components    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Game State     │
│  Management     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌──────────┐
│  AI    │ │  WebRTC  │
│ Engine │ │ Service  │
└────────┘ └────┬─────┘
                │
                ▼
         ┌──────────┐
         │ Firebase │
         │ Firestore│
         └──────────┘
```

### Component Structure

The application follows a component-based architecture with clear separation of concerns:

1. **Main Page** (`src/app/page.js`): Root component managing game state, WebRTC connection, and AI integration
2. **ChessBoard** (`src/components/ChessBoard.jsx`): Main game board component orchestrating all game logic
3. **Custom Hooks**: Modular hooks encapsulating game logic
   - `useMoveHandler`: Handles piece movement and validation
   - `useCombineMode`: Manages piece combination logic
   - `useDeCombineMode`: Manages piece decombination logic
   - `usePromotion`: Handles pawn promotion dialog and selection
   - `useGameStatus`: Checks game status (check, checkmate, stalemate)
   - `useGameControls`: Manages game control actions (undo, redo, reset, resign)
   - `useWebRTC`: Manages WebRTC connection lifecycle
4. **UI Components**: Reusable UI components in `src/components/ui/`
5. **Utilities**: Pure function utilities for game logic in `src/utils/`

### Data Flow

1. **User Action** → Component (ChessBoard)
2. **Component** → Custom Hook (useMoveHandler, useCombineMode, etc.)
3. **Hook** → Utility Functions (moveValidation, combinationRules)
4. **Utility** → Game State Update
5. **State Update** → WebRTC Message (if multiplayer)
6. **WebRTC** → Firebase Signaling → Opponent

### WebRTC Signaling Flow

1. **Host creates game** → Firebase document created with unique connection ID
2. **Guest joins** → Reads Firebase document using connection ID
3. **ICE candidates exchanged** → Via Firebase Firestore real-time listeners
4. **Offer/Answer exchanged** → WebRTC negotiation through Firebase
5. **Direct P2P connection established** → DataChannel created for game state
6. **Game state synced** → Real-time bidirectional updates via DataChannel

### Message Protocol

The WebRTC DataChannel uses a JSON message protocol for game communication:

- `move`: Standard chess move with from/to coordinates
- `combination`: Piece combination action with piece locations
- `decombination`: Piece decombination action with hybrid and spawn locations
- `gameStateSync`: Full game state synchronization for reconnection
- `playerAssignment`: Initial player color assignment (white/black)
- `disconnect`: Graceful disconnect notification
- `ping`: Connection health check with timestamp
- `pong`: Connection health response with latency calculation

## Project Structure

```
.
├── docs/                          # Documentation
│   └── overview.md               # This file
├── public/                       # Static assets
│   ├── logo.png, logo.svg        # Application logos
│   ├── manifest.json             # PWA manifest
│   └── ...                       # Other static assets
├── src/
│   ├── ai/                       # AI engine
│   │   ├── alphaBeta.js         # Alpha-beta pruning algorithm
│   │   ├── chessRules.js        # Chess rules for AI
│   │   ├── constants.js         # AI configuration constants
│   │   ├── evaluator.js         # Position evaluation function
│   │   ├── moveOrdering.js      # Move ordering heuristics
│   │   ├── searchWorker.js      # Web Worker for parallel search
│   │   ├── TranspositionTable.js # Position caching
│   │   ├── WorkerManager.js     # Web Worker management
│   │   └── zobrist.js           # Zobrist hashing for positions
│   ├── app/                      # Next.js app directory
│   │   ├── api/                 # API routes
│   │   │   └── turn-credentials/ # TURN server credentials endpoint
│   │   ├── layout.js            # Root layout
│   │   ├── page.js              # Main game page
│   │   └── globals.css          # Global styles
│   ├── components/               # React components
│   │   ├── ChessBoard.jsx       # Main chess board component
│   │   ├── helpers/             # Helper functions
│   │   │   ├── castlingLogic.js # Castling validation
│   │   │   ├── messageHelpers.js # Status message helpers
│   │   │   └── squareStyling.js # Square styling logic
│   │   ├── hooks/               # Component-specific hooks
│   │   │   ├── useCombineMode.js      # Combine mode logic
│   │   │   ├── useDeCombineMode.js   # Decombine mode logic
│   │   │   ├── useGameControls.js     # Game control actions
│   │   │   ├── useGameStatus.js       # Game status checking
│   │   │   ├── useIdleTimeout.js      # Idle timeout handling
│   │   │   ├── useMoveHandler.js      # Move handling logic
│   │   │   ├── usePromotion.js        # Pawn promotion logic
│   │   │   └── useRematch.js          # Rematch functionality
│   │   └── ui/                   # UI components
│   │       ├── BoardGrid.jsx          # Chess board grid
│   │       ├── CapturedPieces.jsx     # Captured pieces display
│   │       ├── ChessSquare.jsx       # Individual square component
│   │       ├── CombineModeIndicator.jsx
│   │       ├── DeCombineConfirmDialog.jsx
│   │       ├── DeCombineModeIndicator.jsx
│   │       ├── GameControls.jsx       # Game control buttons
│   │       ├── MoveHistory.jsx       # Move history panel
│   │       ├── Navbar.jsx             # Navigation bar
│   │       ├── PromotionDialog.jsx    # Promotion selection dialog
│   │       ├── RematchDialog.jsx     # Rematch dialog
│   │       ├── Sidebar.jsx           # Game sidebar
│   │       ├── StatusMessage.jsx     # Status message display
│   │       └── Timer.jsx             # Game timer component
│   ├── config/                    # Configuration files
│   │   ├── firebase.js            # Firebase initialization
│   │   └── timerConfig.js         # Timer configuration
│   ├── hooks/                     # Global hooks
│   │   └── useWebRTC.js           # WebRTC connection hook
│   ├── services/                  # Services
│   │   └── WebRTCSignalingService.js # WebRTC signaling service
│   └── utils/                     # Utility functions
│       ├── combinationRules.js    # Piece combination rules
│       ├── constants.js           # Game constants
│       ├── deCombinationRules.js  # Piece decombination rules
│       ├── gameState.js           # Game state management
│       ├── gameStatus.js          # Game status checking
│       ├── moveCalculator.js      # Move calculation
│       └── moveValidation.js      # Move validation
├── eslint.config.mjs              # ESLint configuration
├── jsconfig.json                  # JavaScript configuration
├── next.config.mjs                # Next.js configuration
├── package.json                   # Dependencies
├── postcss.config.mjs             # PostCSS configuration
├── README.md                      # Project README
└── vercel.json                    # Vercel deployment config
```

## Key Components Explained

### ChessBoard Component

The main game board component that orchestrates all game logic:
- Manages piece selection and movement
- Handles combine/decombine modes
- Integrates all game hooks (move handler, promotion, game status, etc.)
- Renders the board and UI components
- Coordinates multiplayer state synchronization
- Manages timer integration

### WebRTC Signaling Service

Manages peer-to-peer connections:
- Creates/joins Firebase documents for signaling
- Handles ICE candidate exchange via Firestore
- Manages offer/answer negotiation
- Implements reconnection logic with exponential backoff
- Monitors connection health with heartbeat system
- Handles graceful disconnection and cleanup
- Provides connection state callbacks

### AI Engine

Custom chess engine implementation:
- **Alpha-Beta Search**: Minimax with alpha-beta pruning for optimal move selection
- **Transposition Table**: Caches evaluated positions using Zobrist hashing
- **Move Ordering**: Prioritizes transposition table hints, captures (MVV-LVA), and center control
- **Parallel Search**: Uses Web Workers for concurrent position evaluation
- **Evaluation Function**: Material balance + positional evaluation with piece-square tables
- **Time Management**: Maximum search time limit per move

### Game State Management

Centralized state management with immutable updates:
- Board representation (8x8 array with piece notation)
- Current turn tracking (white/black)
- Move history with algebraic notation
- Castling rights for both players
- En passant target tracking (en passant capture moves in development)
- Game status (check, checkmate, stalemate, game over)
- Undo/redo stacks for state restoration
- Captured pieces tracking

## Development Approach

### Code Organization

**Modular Design**
- Features split into reusable hooks and utilities
- Clear separation between UI, logic, and state management
- Component composition for flexible architecture

**Custom Hooks**
- Game logic encapsulated in React hooks for reusability
- Hooks manage their own state and side effects
- Clear interfaces between hooks and components

**Utility Functions**
- Pure functions for game rules and validation
- No side effects, easily testable
- Centralized game logic for consistency

### Performance Optimizations

**Web Workers**
- AI calculations run in background threads
- Prevents UI blocking during search
- Parallel search across multiple workers

**Memoization**
- React hooks use memoization for expensive calculations
- Prevents unnecessary recalculations
- Optimizes render performance

**Transposition Tables**
- Position caching reduces redundant calculations
- Zobrist hashing for fast position lookup
- Shared table across workers for efficiency

**Move Ordering**
- Better alpha-beta pruning through intelligent move prioritization
- Reduces search tree size
- Improves AI response time

### Error Handling

**Connection Errors**
- Graceful handling of WebRTC connection failures
- User-friendly error messages
- Automatic reconnection attempts

**Validation**
- Comprehensive move and combination validation
- Prevents illegal game states
- Clear error messages for invalid actions

**User Feedback**
- Status messages for all game events
- Visual indicators for game state
- Connection status display

## Deployment

The application is deployed on Vercel and accessible at two domains:
- [p2p-chess.tech](https://p2p-chess.tech)
- [combinechess.games](https://combinechess.games)

**Deployment Configuration**
- Environment variables configured in Vercel dashboard
- Automatic deployments on git push
- Production and preview deployments
- Analytics and performance monitoring enabled

## Future Enhancements

Potential areas for future development:
- Spectator mode for multiplayer games
- Game replay functionality with move-by-move playback
- Tournament mode with bracket system
- Additional hybrid piece combinations
- Enhanced AI with opening book and endgame tablebase
- Mobile app version (React Native)
- Social features (friends list, chat, ratings)
- Game analysis and move suggestions
- Export/import game notation (PGN format)

## Conclusion

This chess game project demonstrates modern web development practices with React, Next.js, and WebRTC. It combines traditional chess gameplay with innovative features like piece combination, creating a unique gaming experience. The architecture is scalable, maintainable, and ready for future enhancements.

The project showcases expertise in:
- Real-time peer-to-peer communication
- Custom game engine development
- AI algorithm implementation
- Modern React architecture patterns
- Performance optimization techniques

**Developed by helim9 & mapcrafter2048**
