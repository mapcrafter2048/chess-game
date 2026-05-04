"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { PIECE_SYMBOLS, HYBRID_NAMES } from "../../utils/constants.js";
import {
  saveStateForUndo,
  switchTurn,
  addMoveToHistory,
  executeCombination,
} from "../../utils/gameState.js";
import {
  findEligiblePairs,
  getEligiblePartners,
  validateCombination,
} from "../../utils/combinationRules.js";
import { isInCheck } from "../../utils/moveCalculator.js";
import {
  announceTurn,
  announceError,
  announceSuccess,
  capitalizeColor,
} from "../helpers/messageHelpers.js";

/**
 * Custom hook for managing combination mode state and logic
 */
export const useCombineMode = (gameState, setGameState, setMessage) => {
  const [combineMode, setCombineMode] = useState(false);
  const [eligiblePairs, setEligiblePairs] = useState([]);
  const [combineAnchor, setCombineAnchor] = useState(null);
  const [eligiblePartners, setEligiblePartners] = useState([]);

  // Memoize eligible pairs calculation
  const memoizedEligiblePairs = useMemo(() => {
    return findEligiblePairs(gameState.board, gameState.currentTurn);
  }, [gameState.board, gameState.currentTurn]);

  // Exit combine mode
  const exitCombineMode = useCallback(
    (preserveMessage = false) => {
      setCombineMode(false);
      setEligiblePairs([]);
      setCombineAnchor(null);
      setEligiblePartners([]);
      if (!preserveMessage) {
        setMessage(announceTurn(gameState.currentTurn));
      }
    },
    [gameState.currentTurn, setMessage]
  );

  // Update eligible pairs when board or turn changes
  useEffect(() => {
    if (combineMode) {
      const pairs = memoizedEligiblePairs;
      setEligiblePairs(pairs);

      if (pairs.length === 0) {
        setMessage(
          announceError("No eligible pieces to combine. Exiting Combine Mode.")
        );
        setTimeout(() => {
          exitCombineMode(true);
        }, 100);
      }
    }
  }, [
    gameState.board,
    gameState.currentTurn,
    combineMode,
    exitCombineMode,
    memoizedEligiblePairs,
    setMessage,
  ]);

  // Enter combine mode
  const enterCombineMode = useCallback((initialPiece = null) => {
    const pairs = memoizedEligiblePairs;

    if (pairs.length === 0) {
      setMessage(announceError("No eligible pieces to combine!"));
      return false;
    }

    setCombineMode(true);
    setEligiblePairs(pairs);
    
    // If entered with a specific piece (long press)
    if (initialPiece) {
      const { row, col } = initialPiece;
      const piece = gameState.board[row][col];
      
      // Check if this piece is eligible
      const isEligible = pairs.some(
        (pair) =>
          (pair.piece1.row === row && pair.piece1.col === col) ||
          (pair.piece2.row === row && pair.piece2.col === col)
      );

      if (isEligible) {
        setCombineAnchor({ row, col });
        const partners = getEligiblePartners(
          gameState.board,
          row,
          col,
          gameState.currentTurn,
          pairs
        );
        setEligiblePartners(partners);
        setMessage(
          `Combine Mode: Selected ${PIECE_SYMBOLS[piece]}. Click a partner.`
        );
      } else {
        // Fallback if not eligible
        setCombineAnchor(null);
        setEligiblePartners([]);
        setMessage("Combine Mode: Click a piece to start combination");
      }
    } else {
      setCombineAnchor(null);
      setEligiblePartners([]);
      setMessage("Combine Mode: Click a piece to start combination");
    }
    
    return true;
  }, [memoizedEligiblePairs, setMessage, gameState.board, gameState.currentTurn]);

  // Execute combination
  const executeCombine = useCallback(
    (row1, col1, row2, col2) => {
      const validation = validateCombination(
        gameState.board,
        row1,
        col1,
        row2,
        col2,
        gameState.currentTurn
      );

      if (!validation.valid) {
        const errorMsg = announceError(`Cannot combine: ${validation.reason}`);
        setMessage(errorMsg);
        exitCombineMode(true);
        return;
      }

      // Save state for undo
      const stateWithUndo = saveStateForUndo(gameState);

      const result = executeCombination(
        gameState.board,
        row1,
        col1,
        row2,
        col2,
        combineAnchor.row,
        combineAnchor.col
      );

      if (!result) {
        const errorMsg = announceError("Combination failed!");
        setMessage(errorMsg);
        exitCombineMode(true);
        return;
      }

      // Check if resulting position leaves king in check
      const wouldCheck = isInCheck(result.board, gameState.currentTurn);
      if (wouldCheck) {
        const errorMsg = announceError(
          "Illegal combination: would leave king in check!"
        );
        setMessage(errorMsg);
        exitCombineMode(true);
        return;
      }

      const newTurn = switchTurn(gameState.currentTurn);

      // Add to move history
      const combineMove = {
        type: "combination",
        pieces: [
          { row: row1, col: col1, piece: gameState.board[row1][col1] },
          { row: row2, col: col2, piece: gameState.board[row2][col2] },
        ],
        result: result.hybridPiece,
        placement: result.placementSquare,
        turn: gameState.currentTurn,
      };
      const newMoveHistory = addMoveToHistory(
        stateWithUndo.moveHistory,
        combineMove
      );

      // Check if opponent is in check
      const opponentInCheck = isInCheck(result.board, newTurn);

      // Normalize hybrid name lookup
      const hybridName =
        HYBRID_NAMES[result.hybridPiece] ||
        HYBRID_NAMES[result.hybridPiece.toLowerCase()] ||
        "Hybrid";
      let statusMessage = announceSuccess(
        `${hybridName} created! ${capitalizeColor(newTurn)} to move`
      );
      if (opponentInCheck) {
        statusMessage += " - CHECK!";
      }

      // Exit BEFORE setting success message
      exitCombineMode(true);

      setGameState({
        ...stateWithUndo,
        board: result.board,
        currentTurn: newTurn,
        moveHistory: newMoveHistory,
        enPassantTarget: null,
      });

      // Set success message AFTER exiting combine mode
      setMessage(statusMessage);
    },
    [gameState, combineAnchor, exitCombineMode, setGameState, setMessage]
  );

  // Handle combine mode clicks
  const handleCombineClick = useCallback(
    (row, col) => {
      const piece = gameState.board[row][col];

      if (!combineAnchor) {
        // First click - select anchor
        const isEligible = eligiblePairs.some(
          (pair) =>
            (pair.piece1.row === row && pair.piece1.col === col) ||
            (pair.piece2.row === row && pair.piece2.col === col)
        );

        if (!isEligible) {
          setMessage(
            announceError(
              "Not eligible for combine. Select a highlighted piece."
            )
          );
          return;
        }

        // Set anchor and find partners
        setCombineAnchor({ row, col });
        const partners = getEligiblePartners(
          gameState.board,
          row,
          col,
          gameState.currentTurn,
          eligiblePairs
        );
        setEligiblePartners(partners);
        setMessage(
          `Selected ${PIECE_SYMBOLS[piece]}. Click a partner to combine.`
        );
      } else {
        // Second click - check if it's a valid partner
        const isPartner = eligiblePartners.some(
          (p) => p.row === row && p.col === col
        );

        if (!isPartner) {
          // Not a partner - check if clicking another eligible piece
          const isEligible = eligiblePairs.some(
            (pair) =>
              (pair.piece1.row === row && pair.piece1.col === col) ||
              (pair.piece2.row === row && pair.piece2.col === col)
          );

          if (isEligible) {
            // Clear stale partner highlights before switching anchor
            setEligiblePartners([]);

            // Switch to new anchor
            setCombineAnchor({ row, col });
            const partners = getEligiblePartners(
              gameState.board,
              row,
              col,
              gameState.currentTurn,
              eligiblePairs
            );
            setEligiblePartners(partners);
            setMessage(
              `Selected ${PIECE_SYMBOLS[piece]}. Click a partner to combine.`
            );
          } else {
            setMessage(
              announceError("Not a valid partner. Select a highlighted piece.")
            );
          }
          return;
        }

        // Execute combination
        executeCombine(combineAnchor.row, combineAnchor.col, row, col);
      }
    },
    [
      gameState.board,
      combineAnchor,
      eligiblePairs,
      eligiblePartners,
      executeCombine,
      setMessage,
    ]
  );

  // Helper functions for square highlighting
  const isEligibleForCombine = useCallback(
    (row, col) => {
      if (!combineMode) return false;
      return eligiblePairs.some(
        (pair) =>
          (pair.piece1.row === row && pair.piece1.col === col) ||
          (pair.piece2.row === row && pair.piece2.col === col)
      );
    },
    [combineMode, eligiblePairs]
  );

  const isEligiblePartner = useCallback(
    (row, col) => {
      if (!combineAnchor) return false;
      return eligiblePartners.some((p) => p.row === row && p.col === col);
    },
    [combineAnchor, eligiblePartners]
  );

  const isCombineAnchor = useCallback(
    (row, col) => {
      return (
        combineAnchor && combineAnchor.row === row && combineAnchor.col === col
      );
    },
    [combineAnchor]
  );

  return {
    combineMode,
    eligiblePairs: memoizedEligiblePairs,
    combineAnchor,
    eligiblePartners,
    enterCombineMode,
    exitCombineMode,
    handleCombineClick,
    isEligibleForCombine,
    isEligiblePartner,
    isCombineAnchor,
  };
};
