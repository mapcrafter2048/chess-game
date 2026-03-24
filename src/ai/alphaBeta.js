// Alpha-Beta Pruning Search Algorithm
// Core AI engine for finding best moves

import { evaluatePosition } from "./evaluator.js";
import { orderMoves } from "./moveOrdering.js";
import { CHECKMATE_SCORE } from "./constants.js";
import {
  COLORS,
  getPieceColor,
  isHybridPiece,
  getBasePieceType,
} from "../utils/constants.js";
import { isInCheck } from "../utils/moveCalculator.js";
import { getAllLegalMoves, applyMove } from "./chessRules.js";
import { zobrist } from "./zobrist.js";
import TranspositionTable, {
  FLAG_EXACT,
  FLAG_LOWER,
  FLAG_UPPER,
} from "./TranspositionTable.js";
import { SEARCH_CONFIG } from "./constants.js";

// Global transposition table (256 MB as per Phase 2B)
// Created once and reused across all searches
const transpositionTable = new TranspositionTable(
  SEARCH_CONFIG.TRANSPOSITION_TABLE_SIZE_MB
);

// Node counter for performance analysis
let nodesSearched = 0;

/**
 * Find the best move for the current position using alpha-beta pruning
 * Now with transposition table support
 *
 * @param {Object} gameState - Complete game state { board, currentTurn, castlingRights }
 * @param {number} depth - Search depth (ply)
 * @returns {Object|null} Best move object or null if no legal moves
 */
export const findBestMove = (gameState, depth) => {
  const { board, currentTurn, castlingRights, enPassantTarget } = gameState;

  // Reset TT stats and node counter for this search
  transpositionTable.resetStats();
  nodesSearched = 0;
  const startTime = performance.now();

  // Generate initial position hash
  const positionHash = zobrist.hashPosition(
    board,
    currentTurn,
    castlingRights,
    enPassantTarget
  );

  // Generate all legal moves
  const allMoves = getAllLegalMoves(
    board,
    currentTurn,
    castlingRights,
    enPassantTarget
  );

  if (allMoves.length === 0) {
    return null; // No legal moves (checkmate or stalemate)
  }

  // Order moves for better alpha-beta pruning
  const orderedMoves = orderMoves(board, allMoves, currentTurn);

  let bestMove = null;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  // Search each move
  for (const move of orderedMoves) {
    // Apply move and get updated castling rights
    const { newBoard, newCastlingRights, newEnPassantTarget } = applyMove(
      board,
      move,
      currentTurn,
      castlingRights,
      enPassantTarget
    );
    const newTurn = currentTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

    // Calculate new position hash (for now, rehash entire position - will optimize later)
    const newHash = zobrist.hashPosition(
      newBoard,
      newTurn,
      newCastlingRights,
      newEnPassantTarget
    );

    // Recursively evaluate (opponent's turn, so we minimize)
    const score = -alphaBetaSearch(
      newBoard,
      newTurn,
      depth - 1,
      -beta,
      -alpha,
      newCastlingRights,
      newEnPassantTarget,
      newHash // ✅ Pass position hash
    );

    // Update best move
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }

    // Alpha-beta update
    alpha = Math.max(alpha, score);
    if (alpha >= beta) {
      break; // Beta cutoff
    }
  }

  // Store root position in TT
  transpositionTable.store(
    positionHash,
    bestScore,
    depth,
    FLAG_EXACT,
    bestMove
  );

  // Log search statistics
  const endTime = performance.now();
  const stats = transpositionTable.getStats();
  const totalProbes =
    stats.hits +
    stats.misses +
    (stats.depthTooShallow || 0) +
    (stats.wrongBounds || 0) +
    (stats.moveHints || 0);
  const hitRate =
    totalProbes > 0 ? ((stats.hits / totalProbes) * 100).toFixed(2) : "0.00";
  const nps = Math.floor(nodesSearched / ((endTime - startTime) / 1000)); // Nodes per second

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔍 Search Statistics (Phase 2A - With TT)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`⏱️  Time:        ${(endTime - startTime).toFixed(2)}ms`);
  console.log(`📊 Depth:       ${depth} ply`);
  console.log(`🎯 Best Score:  ${bestScore} centipawns`);
  console.log(
    `📈 Nodes:       ${nodesSearched.toLocaleString()} (${nps.toLocaleString()} nps)`
  );
  console.log(`💾 TT Probes:   ${totalProbes.toLocaleString()}`);
  console.log(`   ✅ Hits:      ${stats.hits} (${hitRate}%)`);
  console.log(`      - Exact:   ${stats.exactHits || 0}`);
  console.log(`      - Lower:   ${stats.lowerHits || 0}`);
  console.log(`      - Upper:   ${stats.upperHits || 0}`);
  console.log(`   ❌ Misses:    ${stats.misses}`);
  console.log(`   ⚠️  Depth<:   ${stats.depthTooShallow || 0}`);
  console.log(`   ⚠️  Bounds:   ${stats.wrongBounds || 0}`);
  console.log(`      - Lower<β: ${stats.lowerFailedBeta || 0}`);
  console.log(`      - Upper>α: ${stats.upperFailedAlpha || 0}`);
  console.log(`   🎯 MoveHint:  ${stats.moveHints || 0}`);
  console.log(`💿 TT Stores:   ${stats.stores}`);
  console.log(`⚠️  Collisions:  ${stats.collisions}`);

  if (stats.hits > 0 && totalProbes > 0) {
    const hitPercent = (stats.hits / totalProbes) * 100;
    if (hitPercent < 10) {
      console.log(
        `❌ Hit rate is LOW (${hitPercent.toFixed(
          1
        )}%) - TT may not be helping much`
      );
    } else if (hitPercent < 30) {
      console.log(
        `⚠️  Hit rate is MODERATE (${hitPercent.toFixed(1)}%) - some benefit`
      );
    } else {
      console.log(
        `✅ Hit rate is GOOD (${hitPercent.toFixed(1)}%) - significant speedup!`
      );
    }
  } else {
    console.log(`❌ NO TT HITS - Check flag logic and hash generation!`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  return bestMove;
};

/**
 * Alpha-beta search with negamax framework and transposition table
 *
 * @param {Array} board - Current board state
 * @param {string} currentTurn - Current player
 * @param {number} depth - Remaining search depth
 * @param {number} alpha - Alpha value (best for maximizer)
 * @param {number} beta - Beta value (best for minimizer)
 * @param {Object} castlingRights - Castling rights for both players
 * @param {BigInt} positionHash - Zobrist hash of current position
 * @returns {number} Position evaluation score
 */
export const alphaBetaSearch = (
  board,
  currentTurn,
  depth,
  alpha,
  beta,
  castlingRights,
  enPassantTarget,
  positionHash
) => {
  // Increment node counter
  nodesSearched++;

  // Probe transposition table
  const ttEntry = transpositionTable.probe(positionHash, depth, alpha, beta);

  if (ttEntry && ttEntry.score !== undefined) {
    // TT hit with usable score - return immediately
    return ttEntry.score;
  }

  // Terminal depth or terminal position check
  const allMoves = getAllLegalMoves(
    board,
    currentTurn,
    castlingRights,
    enPassantTarget
  );
  const inCheck = isInCheck(board, currentTurn);

  if (depth === 0 || allMoves.length === 0) {
    // Leaf node - evaluate position
    const score = evaluatePosition(
      board,
      currentTurn,
      allMoves.length,
      inCheck
    );

    // Return from current player's perspective
    const finalScore = currentTurn === COLORS.WHITE ? score : -score;

    // Store leaf node evaluation in TT (FLAG_EXACT since it's a static eval)
    transpositionTable.store(positionHash, finalScore, depth, FLAG_EXACT, null);

    return finalScore;
  }

  // Order moves for better pruning (use TT move hint if available)
  const orderedMoves = orderMoves(board, allMoves, currentTurn, ttEntry?.move);

  let maxScore = -Infinity;
  let bestMove = null;
  const origAlpha = alpha; // Save original alpha to determine flag type

  // Search each move
  for (const move of orderedMoves) {
    // Apply move and get updated castling rights
    const { newBoard, newCastlingRights, newEnPassantTarget } = applyMove(
      board,
      move,
      currentTurn,
      castlingRights,
      enPassantTarget
    );
    const newTurn = currentTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

    // Calculate new position hash (full rehash for now)
    const newHash = zobrist.hashPosition(
      newBoard,
      newTurn,
      newCastlingRights,
      newEnPassantTarget
    );

    // Recursive search (negamax: opponent's best is our worst)
    const score = -alphaBetaSearch(
      newBoard,
      newTurn,
      depth - 1,
      -beta,
      -alpha,
      newCastlingRights,
      newEnPassantTarget,
      newHash // ✅ Pass position hash
    );

    if (score > maxScore) {
      maxScore = score;
      bestMove = move;
    }

    alpha = Math.max(alpha, score);

    // Beta cutoff (opponent won't allow this position)
    if (alpha >= beta) {
      // Fail-high: score >= beta
      transpositionTable.store(
        positionHash,
        maxScore,
        depth,
        FLAG_LOWER,
        bestMove
      );
      return maxScore;
    }
  }

  // Determine flag type based on whether we improved alpha
  let flag;
  if (maxScore <= origAlpha) {
    flag = FLAG_UPPER; // Fail-low: score <= alpha (no improvement)
  } else {
    flag = FLAG_EXACT; // Exact: alpha < score < beta (within window)
  }

  // Store in transposition table
  transpositionTable.store(positionHash, maxScore, depth, flag, bestMove);

  return maxScore;
};

/**
 * Get transposition table statistics
 * Useful for performance analysis and debugging
 *
 * @returns {Object} TT statistics
 */
export const getTranspositionTableStats = () => {
  return transpositionTable.getStats();
};

/**
 * Clear the transposition table
 * Should be called when starting a new game
 */
export const clearTranspositionTable = () => {
  transpositionTable.clear();
  console.log("Transposition table cleared");
};

/**
 * Find best move using parallel search with web workers (Phase 2B)
 * Falls back to single-threaded search if workers unavailable
 *
 * @param {Object} gameState - Complete game state
 * @param {number} depth - Search depth
 * @returns {Promise<Object|null>} Best move object or null
 */
export const findBestMoveParallel = async (gameState, depth) => {
  // Dynamically import WorkerManager to avoid circular dependencies
  const { default: workerManager } = await import("./WorkerManager.js");

  // Try to initialize workers if not already done
  const workersAvailable = await workerManager.initialize();

  if (!workersAvailable) {
    console.log(
      "⚠️  Workers not available, falling back to single-threaded search"
    );
    return findBestMove(gameState, depth);
  }

  const { board, currentTurn, castlingRights, enPassantTarget } = gameState;

  // Generate and order all legal moves
  const allMoves = getAllLegalMoves(
    board,
    currentTurn,
    castlingRights,
    enPassantTarget
  );

  if (allMoves.length === 0) {
    return null; // No legal moves
  }

  const orderedMoves = orderMoves(board, allMoves, currentTurn);

  try {
    // Search in parallel
    const result = await workerManager.searchParallel({
      board,
      currentTurn,
      castlingRights,
      enPassantTarget,
      moves: orderedMoves,
      depth,
    });

    return result.bestMove;
  } catch (error) {
    console.error("❌ Parallel search failed:", error);
    console.log("⚠️  Falling back to single-threaded search");
    return findBestMove(gameState, depth);
  }
};
