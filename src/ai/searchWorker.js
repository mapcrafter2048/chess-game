// Web Worker for Parallel Chess Search (Phase 2B)
// Runs in separate thread, shares TranspositionTable via SharedArrayBuffer

import { evaluatePosition } from "./evaluator.js";
import { orderMoves } from "./moveOrdering.js";
import { CHECKMATE_SCORE } from "./constants.js";
import { COLORS } from "../utils/constants.js";
import { isInCheck } from "../utils/moveCalculator.js";
import { zobrist } from "./zobrist.js";
import TranspositionTable, {
  FLAG_EXACT,
  FLAG_LOWER,
  FLAG_UPPER,
} from "./TranspositionTable.js";

// Import from chessRules.js to avoid circular dependency with alphaBeta.js
import { getAllLegalMoves, applyMove } from "./chessRules.js";

// Worker-local state
let transpositionTable = null;
let nodesSearched = 0;
let searchDeadline = 0;
let isSearchCancelled = false;

/**
 * Check if search should be aborted due to timeout
 * @returns {boolean} True if search should stop
 */
const shouldAbortSearch = () => {
  return (
    isSearchCancelled || (searchDeadline > 0 && Date.now() >= searchDeadline)
  );
};

// Note: getAllLegalMoves and applyMove are imported from alphaBeta.js
// This ensures consistency with the main thread for move generation and application.

/**
 * Alpha-beta search (worker version)
 *
 * This is intentionally duplicated from alphaBeta.js because workers need their own:
 * - Local node counter (nodesSearched)
 * - Local TT reference (transpositionTable)
 * - Local timeout checking (shouldAbortSearch)
 *
 * The logic MUST match alphaBeta.js exactly to ensure identical search behavior.
 */
const alphaBetaSearch = (
  board,
  currentTurn,
  depth,
  alpha,
  beta,
  castlingRights,
  enPassantTarget,
  positionHash
) => {
  // Check for timeout
  if (shouldAbortSearch()) {
    return 0; // Return neutral score if cancelled
  }

  nodesSearched++;

  // Probe TT
  const ttEntry = transpositionTable.probe(positionHash, depth, alpha, beta);
  if (ttEntry && ttEntry.score !== undefined) {
    return ttEntry.score;
  }

  // Terminal node check
  const allMoves = getAllLegalMoves(
    board,
    currentTurn,
    castlingRights,
    enPassantTarget
  );
  const inCheck = isInCheck(board, currentTurn);

  if (depth === 0 || allMoves.length === 0) {
    const score = evaluatePosition(
      board,
      currentTurn,
      allMoves.length,
      inCheck
    );
    const finalScore = currentTurn === COLORS.WHITE ? score : -score;
    transpositionTable.store(positionHash, finalScore, depth, FLAG_EXACT, null);
    return finalScore;
  }

  // Order moves
  const orderedMoves = orderMoves(board, allMoves, currentTurn, ttEntry?.move);

  let maxScore = -Infinity;
  let bestMove = null;
  const origAlpha = alpha;

  // Search each move
  for (const move of orderedMoves) {
    const { newBoard, newCastlingRights, newEnPassantTarget } = applyMove(
      board,
      move,
      currentTurn,
      castlingRights,
      enPassantTarget
    );
    const newTurn = currentTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
    const newHash = zobrist.hashPosition(
      newBoard,
      newTurn,
      newCastlingRights,
      newEnPassantTarget
    );

    const score = -alphaBetaSearch(
      newBoard,
      newTurn,
      depth - 1,
      -beta,
      -alpha,
      newCastlingRights,
      newEnPassantTarget,
      newHash
    );

    if (score > maxScore) {
      maxScore = score;
      bestMove = move;
    }

    alpha = Math.max(alpha, score);

    // Beta cutoff (fail-high) - opponent won't allow this position
    if (alpha >= beta) {
      // Store with FLAG_LOWER (lower bound on score) and return immediately
      transpositionTable.store(
        positionHash,
        maxScore,
        depth,
        FLAG_LOWER,
        bestMove
      );
      return maxScore;
    }

    // Check timeout periodically
    if (shouldAbortSearch()) {
      break;
    }
  }

  // Determine flag type based on whether we improved alpha
  let flag;
  if (maxScore <= origAlpha) {
    flag = FLAG_UPPER; // Fail-low: score <= alpha (no improvement)
  } else {
    flag = FLAG_EXACT; // Exact: alpha < score < beta (within window)
  }

  // Store in TT
  transpositionTable.store(positionHash, maxScore, depth, flag, bestMove);

  return maxScore;
};

/**
 * Worker message handler
 */
self.onmessage = (event) => {
  const { type, data } = event.data;

  try {
    switch (type) {
      case "INIT_TT": {
        // Initialize shared transposition table
        const { sizeInMB, ttBuffer } = data;
        transpositionTable = new TranspositionTable(sizeInMB, ttBuffer);
        self.postMessage({
          type: "INIT_TT_SUCCESS",
          isShared: transpositionTable.isSharedBuffer(),
        });
        break;
      }

      case "SEARCH": {
        // Perform search on assigned moves
        const {
          board,
          currentTurn,
          castlingRights,
          enPassantTarget,
          movesToSearch,
          depth,
          timeoutMs,
        } = data;

        // Reset state and TT stats for this search
        nodesSearched = 0;
        isSearchCancelled = false;
        searchDeadline = timeoutMs > 0 ? Date.now() + timeoutMs : 0;
        transpositionTable.resetStats();

        const workerSearchStart = performance.now();

        // Calculate position hash
        const positionHash = zobrist.hashPosition(
          board,
          currentTurn,
          castlingRights,
          enPassantTarget
        );

        let bestMove = null;
        let bestScore = -Infinity;
        let alpha = -Infinity;
        const beta = Infinity;

        let movesSearched = 0;
        let betaCutoffs = 0;

        // Search each assigned move
        for (const move of movesToSearch) {
          if (shouldAbortSearch()) {
            break;
          }

          movesSearched++;

          const { newBoard, newCastlingRights, newEnPassantTarget } = applyMove(
            board,
            move,
            currentTurn,
            castlingRights,
            enPassantTarget
          );
          const newTurn =
            currentTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
          const newHash = zobrist.hashPosition(
            newBoard,
            newTurn,
            newCastlingRights,
            newEnPassantTarget
          );

          const score = -alphaBetaSearch(
            newBoard,
            newTurn,
            depth - 1,
            -beta,
            -alpha,
            newCastlingRights,
            newEnPassantTarget,
            newHash
          );

          if (score > bestScore) {
            bestScore = score;
            bestMove = move;
          }

          alpha = Math.max(alpha, score);

          // Track beta cutoffs (early terminations)
          if (alpha >= beta) {
            betaCutoffs++;
            break;
          }
        }

        const workerSearchEnd = performance.now();
        const workerSearchTime = workerSearchEnd - workerSearchStart;

        // Get TT stats from this worker's search
        const ttStats = transpositionTable.getStats();

        // Send result back to main thread
        self.postMessage({
          type: "SEARCH_RESULT",
          bestMove,
          bestScore,
          nodesSearched,
          timedOut: shouldAbortSearch(),
          movesAssigned: movesToSearch.length,
          movesSearched,
          betaCutoffs,
          searchTime: workerSearchTime,
          ttStats: {
            hits: ttStats.hits,
            misses: ttStats.misses,
            collisions: ttStats.collisions,
            stores: ttStats.stores,
          },
        });
        break;
      }

      case "CANCEL": {
        // Cancel ongoing search
        isSearchCancelled = true;
        break;
      }

      default:
        console.warn("Unknown message type:", type);
    }
  } catch (error) {
    self.postMessage({
      type: "ERROR",
      error: error.message,
      stack: error.stack,
    });
  }
};

// Signal that worker is ready
self.postMessage({ type: "READY" });
