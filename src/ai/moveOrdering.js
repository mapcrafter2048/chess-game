// Move Ordering Module
// Sorts moves to improve alpha-beta pruning efficiency

import { PIECE_VALUES } from './constants.js';
import { getPieceColor } from '../utils/constants.js';

// Center squares for positional evaluation
const CENTER_SQUARES = [
    { row: 3, col: 3 }, // d5
    { row: 3, col: 4 }, // e5
    { row: 4, col: 3 }, // d4
    { row: 4, col: 4 }  // e4
];

// Capture base score - ensures captures are searched before quiet moves
const CAPTURE_BASE_SCORE = 3000;

/**
 * Order moves for optimal alpha-beta search
 * Better moves first = more cutoffs = faster search
 * 
 * Priority:
 * 1. TT move (best move from previous search at this position)
 * 2. Captures (MVV-LVA: Most Valuable Victim - Least Valuable Attacker)
 * 3. Center control (moves toward center squares)
 * 
 * @param {Array} board - 8x8 board array
 * @param {Array} moves - Array of move objects {from: {row, col}, to: {row, col}}
 * @param {string} currentTurn - Color of player making moves
 * @param {Object|null} ttMove - Move hint from transposition table (optional)
 * @returns {Array} Sorted array of moves (best first)
 */
export const orderMoves = (board, moves, currentTurn, ttMove = null) => {
    // Score each move
    const scoredMoves = moves.map(move => ({
        ...move,
        score: scoreMove(board, move, currentTurn, ttMove)
    }));

    // Sort descending (highest score first)
    scoredMoves.sort((a, b) => b.score - a.score);

    return scoredMoves;
};

/**
 * Score a single move for ordering purposes
 * 
 * @param {Array} board - 8x8 board array
 * @param {Object} move - Move object {from: {row, col}, to: {row, col}}
 * @param {string} currentTurn - Color of player making the move
 * @param {Object|null} ttMove - Move hint from transposition table
 * @returns {number} Move score (higher = better)
 */
const scoreMove = (board, move, currentTurn, ttMove = null) => {
    let score = 0;

    // ============================================
    // 0. TT MOVE (Highest Priority)
    // ============================================
    if (ttMove && movesMatch(move, ttMove)) {
        // This move was best in a previous search - try it first!
        score += 10000;
        return score; // Return immediately - this should be first
    }

    const { from, to } = move;
    const attacker = board[from.row][from.col];
    const victim = move.type === "enPassant"
        ? board[from.row][to.col]
        : board[to.row][to.col];

    // ============================================
    // 1. CAPTURE MOVES (MVV-LVA)
    // ============================================
    if (victim && getPieceColor(victim) !== currentTurn) {
        // It's a capture
        const attackerType = attacker.toLowerCase();
        const victimType = victim.toLowerCase();

        const attackerValue = PIECE_VALUES[attackerType] || 0;
        const victimValue = PIECE_VALUES[victimType] || 0;

        // MVV-LVA: Prefer capturing high-value pieces with low-value pieces
        // Formula: victimValue * 10 - attackerValue
        // Examples:
        //   Knight takes Queen: 900*10 - 320 = 8680
        //   Queen takes Pawn: 100*10 - 900 = 100
        const mvvLvaScore = victimValue * 10 - attackerValue;

        score += CAPTURE_BASE_SCORE + mvvLvaScore;
    }

    // ============================================
    // 2. CENTER CONTROL (for quiet moves)
    // ============================================
    const centerDistance = calculateCenterDistance(to.row, to.col);
    const centerBonus = (7 - centerDistance) * 10;
    score += centerBonus;

    // ============================================
    // 3. PIECE DEVELOPMENT (TODO: Phase 2)
    // ============================================
    // Future enhancements:
    // - Bonus for moving pieces off back rank
    // - Bonus for castling
    // - Bonus for connecting rooks

    // TODO Phase 2: Add special move bonuses
    // - Combination moves: +100 (strategically valuable)
    // - Decombination moves: +50 (flexibility)
    // - Castling: +200 (king safety)
    // - Queen promotion: +500 (powerful upgrade)

    return score;
};

/**
 * Calculate Manhattan distance to nearest center square
 * 
 * @param {number} row - Target row (0-7)
 * @param {number} col - Target column (0-7)
 * @returns {number} Distance to closest center square
 */
const calculateCenterDistance = (row, col) => {
    let minDistance = Infinity;

    for (const center of CENTER_SQUARES) {
        const distance = Math.abs(row - center.row) + Math.abs(col - center.col);
        minDistance = Math.min(minDistance, distance);
    }

    return minDistance;
};

/**
 * Check if two moves are the same
 * @param {Object} move1 - First move
 * @param {Object} move2 - Second move
 * @returns {boolean} True if moves match
 */
const movesMatch = (move1, move2) => {
    if (!move1 || !move2) return false;

    return move1.from.row === move2.from.row &&
        move1.from.col === move2.from.col &&
        move1.to.row === move2.to.row &&
        move1.to.col === move2.to.col &&
        move1.type === move2.type;
};

/**
 * Helper function to explain why a move was scored a certain way
 * Useful for debugging and testing
 * 
 * @param {Array} board - 8x8 board array
 * @param {Object} move - Move object
 * @param {string} currentTurn - Current player color
 * @returns {Object} Detailed scoring breakdown
 */
export const scoreMoveDetailed = (board, move, currentTurn) => {
    const { from, to } = move;
    const attacker = board[from.row][from.col];
    const victim = move.type === "enPassant"
        ? board[from.row][to.col]
        : board[to.row][to.col];

    let totalScore = 0;
    const breakdown = {
        isCapture: false,
        captureScore: 0,
        centerScore: 0,
        developmentScore: 0
    };

    // Capture evaluation
    if (victim && getPieceColor(victim) !== currentTurn) {
        breakdown.isCapture = true;

        const attackerType = attacker.toLowerCase();
        const victimType = victim.toLowerCase();
        const attackerValue = PIECE_VALUES[attackerType] || 0;
        const victimValue = PIECE_VALUES[victimType] || 0;

        const mvvLvaScore = victimValue * 10 - attackerValue;
        breakdown.captureScore = CAPTURE_BASE_SCORE + mvvLvaScore;
        breakdown.mvvLva = {
            attacker: attackerType,
            attackerValue,
            victim: victimType,
            victimValue,
            mvvLvaScore
        };

        totalScore += breakdown.captureScore;
    }

    // Center control
    const centerDistance = calculateCenterDistance(to.row, to.col);
    breakdown.centerScore = (7 - centerDistance) * 10;
    breakdown.centerDistance = centerDistance;
    totalScore += breakdown.centerScore;

    return {
        move,
        totalScore,
        breakdown
    };
};
