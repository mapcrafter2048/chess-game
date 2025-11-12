// Position Evaluation Module
// Evaluates chess positions and returns a score from white's perspective

import {
    PIECE_VALUES,
    CHECKMATE_SCORE,
    STALEMATE_SCORE,
    getPieceSquareTable,
    EVAL_WEIGHTS,
    KING_MIDDLE_GAME_TABLE,
    KING_END_GAME_TABLE
} from './constants.js';
import { COLORS, getPieceColor } from '../utils/constants.js';

// Endgame threshold - if total material falls below this, use endgame king table
const ENDGAME_MATERIAL_THRESHOLD = 2500;

/**
 * Evaluate a chess position from white's perspective
 * 
 * @param {Array} board - 8x8 board array
 * @param {string} currentTurn - COLORS.WHITE or COLORS.BLACK (whose turn it is)
 * @param {number} legalMovesCount - Number of legal moves available for current player
 * @param {boolean} inCheck - Is the current player in check?
 * @returns {number} Evaluation score in centipawns (positive = white winning, negative = black winning)
 * 
 * Scoring:
 * - Positive score: White is better
 * - Negative score: Black is better
 * - 0: Equal position
 * - ±CHECKMATE_SCORE: Checkmate
 * - STALEMATE_SCORE: Stalemate (0)
 */
export const evaluatePosition = (board, currentTurn, legalMovesCount, inCheck) => {
    // ============================================
    // 1. TERMINAL POSITION DETECTION
    // ============================================
    if (legalMovesCount === 0) {
        if (inCheck) {
            // Checkmate - current player has lost
            // If white to move and checkmated, black wins (negative score)
            // If black to move and checkmated, white wins (positive score)
            return currentTurn === COLORS.WHITE ? -CHECKMATE_SCORE : CHECKMATE_SCORE;
        } else {
            // Stalemate - draw
            return STALEMATE_SCORE;
        }
    }

    // ============================================
    // 2. MATERIAL AND POSITIONAL EVALUATION
    // ============================================
    let materialScore = 0;
    let positionalScore = 0;
    let totalMaterial = 0; // For endgame detection

    // Single-pass evaluation: calculate material, position, and endgame status together
    // This avoids the double board scan from calling calculateTotalMaterial separately
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (!piece) continue;

            const isWhite = getPieceColor(piece) === COLORS.WHITE;
            const pieceType = piece.toLowerCase();

            // ----------------------------------------
            // Material Value
            // ----------------------------------------
            const materialValue = PIECE_VALUES[pieceType] || 0;
            totalMaterial += materialValue;

            // ----------------------------------------
            // Positional Value (Piece-Square Tables)
            // ----------------------------------------
            // Note: For kings, we use a heuristic - if total material so far < threshold,
            // assume endgame. This is slightly less accurate but much faster.
            let pst;

            // Special case: King has different tables for middlegame vs endgame
            if (pieceType === 'k') {
                // Use endgame table if we've seen little material so far
                const isLikelyEndgame = totalMaterial < ENDGAME_MATERIAL_THRESHOLD;
                pst = isLikelyEndgame ? KING_END_GAME_TABLE : KING_MIDDLE_GAME_TABLE;
            } else {
                pst = getPieceSquareTable(pieceType);
            }

            // For black pieces, flip the table vertically (they play from opposite side)
            // PST is designed from white's perspective (row 0 = rank 8, row 7 = rank 1)
            const pstRow = isWhite ? row : (7 - row);
            const positionalValue = pst[pstRow][col];

            // ----------------------------------------
            // Add/Subtract based on piece color
            // ----------------------------------------
            if (isWhite) {
                materialScore += materialValue;
                positionalScore += positionalValue;
            } else {
                materialScore -= materialValue;
                positionalScore -= positionalValue;
            }
        }
    }

    // ============================================
    // 3. COMBINE SCORES
    // ============================================
    const totalScore =
        materialScore * EVAL_WEIGHTS.MATERIAL +
        positionalScore * EVAL_WEIGHTS.POSITION;

    return totalScore;
};

/**
 * Calculate total material on the board (both sides combined)
 * Used for endgame detection
 * 
 * @param {Array} board - 8x8 board array
 * @returns {number} Total material value in centipawns
 */
const calculateTotalMaterial = (board) => {
    let total = 0;

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (!piece) continue;

            const pieceType = piece.toLowerCase();
            const materialValue = PIECE_VALUES[pieceType] || 0;
            total += materialValue;
        }
    }

    return total;
};

/**
 * Helper function to evaluate a position with debugging info
 * Useful for testing and understanding evaluations
 * 
 * @param {Array} board - 8x8 board array
 * @param {string} currentTurn - Current player's turn
 * @param {number} legalMovesCount - Legal moves available
 * @param {boolean} inCheck - Is current player in check
 * @returns {Object} Detailed evaluation breakdown
 */
export const evaluatePositionDetailed = (board, currentTurn, legalMovesCount, inCheck) => {
    // Terminal positions
    if (legalMovesCount === 0) {
        if (inCheck) {
            const score = currentTurn === COLORS.WHITE ? -CHECKMATE_SCORE : CHECKMATE_SCORE;
            return {
                score,
                isTerminal: true,
                terminalReason: 'checkmate',
                winner: currentTurn === COLORS.WHITE ? 'black' : 'white'
            };
        } else {
            return {
                score: STALEMATE_SCORE,
                isTerminal: true,
                terminalReason: 'stalemate'
            };
        }
    }

    // Material and position breakdown
    let whiteMaterial = 0;
    let blackMaterial = 0;
    let whitePosition = 0;
    let blackPosition = 0;
    let totalMaterial = 0;

    const isEndgame = calculateTotalMaterial(board) < ENDGAME_MATERIAL_THRESHOLD;

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (!piece) continue;

            const isWhite = getPieceColor(piece) === COLORS.WHITE;
            const pieceType = piece.toLowerCase();
            const materialValue = PIECE_VALUES[pieceType] || 0;
            totalMaterial += materialValue;

            let pst;
            if (pieceType === 'k') {
                pst = isEndgame ? KING_END_GAME_TABLE : KING_MIDDLE_GAME_TABLE;
            } else {
                pst = getPieceSquareTable(pieceType);
            }

            const pstRow = isWhite ? row : (7 - row);
            const positionalValue = pst[pstRow][col];

            if (isWhite) {
                whiteMaterial += materialValue;
                whitePosition += positionalValue;
            } else {
                blackMaterial += materialValue;
                blackPosition += positionalValue;
            }
        }
    }

    const materialScore = whiteMaterial - blackMaterial;
    const positionalScore = whitePosition - blackPosition;
    const totalScore =
        materialScore * EVAL_WEIGHTS.MATERIAL +
        positionalScore * EVAL_WEIGHTS.POSITION;

    return {
        score: totalScore,
        isTerminal: false,
        breakdown: {
            material: {
                white: whiteMaterial,
                black: blackMaterial,
                difference: materialScore
            },
            positional: {
                white: whitePosition,
                black: blackPosition,
                difference: positionalScore
            },
            totalMaterial,
            isEndgame
        }
    };
};
