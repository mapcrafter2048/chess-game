"use client";

import { useState, useCallback } from "react";
import { PIECE_SYMBOLS } from "../../utils/constants.js";
import {
  copyBoard,
  switchTurn,
  addCapturedPiece,
  addMoveToHistory,
  saveStateForUndo,
} from "../../utils/gameState.js";
import { isInCheck } from "../../utils/moveCalculator.js";
import { capitalizeColor } from "../helpers/messageHelpers.js";

/**
 * Custom hook for managing pawn promotion state and logic
 */
export const usePromotion = (gameState, setGameState, setMessage) => {
  const [promotionDialog, setPromotionDialog] = useState({
    isOpen: false,
    fromRow: null,
    fromCol: null,
    toRow: null,
    toCol: null,
    capturedPiece: null,
  });

  // Open promotion dialog
  const openPromotionDialog = useCallback(
    (fromRow, fromCol, toRow, toCol, capturedPiece) => {
      // Save state before opening promotion dialog
      const newGameState = saveStateForUndo(gameState);
      setGameState(newGameState);

      setPromotionDialog({
        isOpen: true,
        fromRow,
        fromCol,
        toRow,
        toCol,
        capturedPiece,
      });

      setMessage("Choose promotion piece");
    },
    [gameState, setGameState, setMessage]
  );

  // Execute promotion
  const executePromotion = useCallback(
    (promotionPiece) => {
      const { fromRow, fromCol, toRow, toCol, capturedPiece } = promotionDialog;

      // Create new board with promotion
      const newBoard = copyBoard(gameState.board);
      newBoard[toRow][toCol] = promotionPiece;
      newBoard[fromRow][fromCol] = "";

      const newTurn = switchTurn(gameState.currentTurn);

      // Update captured pieces
      let newCapturedPieces = gameState.capturedPieces;
      if (capturedPiece) {
        newCapturedPieces = addCapturedPiece(
          gameState.capturedPieces,
          capturedPiece
        );
      }

      // Add to move history
      const move = {
        type: "promotion",
        from: { row: fromRow, col: fromCol },
        to: { row: toRow, col: toCol },
        promotedTo: promotionPiece,
        captured: capturedPiece,
        turn: gameState.currentTurn,
      };
      const newMoveHistory = addMoveToHistory(gameState.moveHistory, move);

      // Check if opponent is in check
      const opponentInCheck = isInCheck(newBoard, newTurn);
      let statusMessage = `Pawn promoted to ${
        PIECE_SYMBOLS[promotionPiece]
      }! ${capitalizeColor(newTurn)} to move`;
      if (opponentInCheck) {
        statusMessage += " - CHECK!";
      }

      setGameState({
        ...gameState,
        board: newBoard,
        currentTurn: newTurn,
        moveHistory: newMoveHistory,
        capturedPieces: newCapturedPieces,
        enPassantTarget: null,
      });

      setPromotionDialog({
        isOpen: false,
        fromRow: null,
        fromCol: null,
        toRow: null,
        toCol: null,
        capturedPiece: null,
      });

      setMessage(statusMessage);
    },
    [promotionDialog, gameState, setGameState, setMessage]
  );

  return {
    promotionDialog,
    openPromotionDialog,
    executePromotion,
  };
};
