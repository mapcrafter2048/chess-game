/**
 * Game Status Detection Utilities
 * Handles check, checkmate, and stalemate detection
 */

import { isInCheck, findKing } from "./moveCalculator.js";
import { COLORS } from "./constants.js";

/**
 * Check if a player is in check
 * @param {Array} board - Current board state
 * @param {string} color - Player color to check
 * @returns {boolean} True if the player is in check
 */
export const isPlayerInCheck = (board, color) => {
  return isInCheck(board, color);
};

/**
 * Check if a player has any legal moves
 * Uses dynamic import to avoid circular dependencies with AI module
 * @param {Array} board - Current board state
 * @param {string} color - Player color to check
 * @param {Object} castlingRights - Current castling rights
 * @returns {Promise<boolean>} True if the player has legal moves
 */
export const hasLegalMoves = async (
  board,
  color,
  castlingRights,
  enPassantTarget = null
) => {
  try {
    // Dynamically import to avoid circular dependencies
    const { getAllLegalMoves } = await import("../ai/chessRules.js");
    const legalMoves = getAllLegalMoves(
      board,
      color,
      castlingRights,
      enPassantTarget
    );
    return legalMoves.length > 0;
  } catch (error) {
    console.error("Error checking legal moves:", error);
    return true; // Default to true to avoid false checkmate
  }
};

/**
 * Check if the current position is checkmate
 * @param {Array} board - Current board state
 * @param {string} color - Player color to check
 * @param {Object} castlingRights - Current castling rights
 * @returns {Promise<boolean>} True if checkmate
 */
export const isCheckmate = async (
  board,
  color,
  castlingRights,
  enPassantTarget = null
) => {
  const inCheck = isPlayerInCheck(board, color);
  if (!inCheck) return false;

  const hasLegal = await hasLegalMoves(
    board,
    color,
    castlingRights,
    enPassantTarget
  );
  return !hasLegal;
};

/**
 * Check if the current position is stalemate
 * @param {Array} board - Current board state
 * @param {string} color - Player color to check
 * @param {Object} castlingRights - Current castling rights
 * @returns {Promise<boolean>} True if stalemate
 */
export const isStalemate = async (
  board,
  color,
  castlingRights,
  enPassantTarget = null
) => {
  const inCheck = isPlayerInCheck(board, color);
  if (inCheck) return false; // Can't be stalemate if in check

  const hasLegal = await hasLegalMoves(
    board,
    color,
    castlingRights,
    enPassantTarget
  );
  return !hasLegal;
};

/**
 * Get the current game status
 * @param {Object} gameState - Complete game state
 * @returns {Promise<Object>} Status object { isCheck, isCheckmate, isStalemate, isGameOver, winner }
 */
export const getGameStatus = async (gameState) => {
  const { board, currentTurn, castlingRights, enPassantTarget } = gameState;

  const inCheck = isPlayerInCheck(board, currentTurn);
  const hasLegal = await hasLegalMoves(
    board,
    currentTurn,
    castlingRights,
    enPassantTarget
  );

  const isCheckmate = inCheck && !hasLegal;
  const isStalemate = !inCheck && !hasLegal;
  const isGameOver = isCheckmate || isStalemate;

  let winner = null;
  if (isCheckmate) {
    // The player who just moved (opposite of current turn) wins
    winner = currentTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
  }

  return {
    isCheck: inCheck,
    isCheckmate,
    isStalemate,
    isGameOver,
    winner,
  };
};
