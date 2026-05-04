"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { PIECE_SYMBOLS } from "../../utils/constants.js";
import { switchTurn } from "../../utils/gameState.js";
import {
  findPlayerHybrids,
  findSpawnSquares,
  validateDeCombination,
  executeDeCombination,
  getHybridComponents,
  DE_COMBINE_ERRORS,
  getSuccessMessage,
  computeLegalAssignments,
} from "../../utils/deCombinationRules.js";
import {
  announceTurn,
  announceError,
  announceSuccess,
} from "../helpers/messageHelpers.js";

/**
 * Custom hook for managing de-combination mode state and logic
 */
export const useDeCombineMode = (gameState, setGameState, setMessage) => {
  // De-Combine mode state
  const [deCombine, setDeCombine] = useState({
    mode: false,
    activeHybrid: null,
    eligibleSquares: [],
    selectedSquare: null,
    assignment: null,
    isConfirmOpen: false,
    isLocalMode: false, // true = double-tap (no modal), false = button (with modal)
  });

  const [eligibleHybrids, setEligibleHybrids] = useState([]);

  // Memoize eligible hybrids for de-combine
  const memoizedEligibleHybrids = useMemo(() => {
    return findPlayerHybrids(gameState.board, gameState.currentTurn);
  }, [gameState.board, gameState.currentTurn]);

  // Exit de-combine mode
  const exitDeCombineMode = useCallback(
    (preserveMessage = false) => {
      setDeCombine({
        mode: false,
        activeHybrid: null,
        eligibleSquares: [],
        selectedSquare: null,
        assignment: null,
        isConfirmOpen: false,
        isLocalMode: false,
      });
      setEligibleHybrids([]);
      if (!preserveMessage) {
        setMessage(announceTurn(gameState.currentTurn));
      }
    },
    [gameState.currentTurn, setMessage]
  );

  // Update eligible hybrids when board or turn changes
  useEffect(() => {
    if (deCombine.mode) {
      const hybrids = memoizedEligibleHybrids;
      setEligibleHybrids(hybrids);

      if (hybrids.length === 0) {
        setMessage(
          announceError("No hybrid pieces available to De-Combine. Exiting.")
        );
        setTimeout(() => {
          exitDeCombineMode(true);
        }, 100);
      }
    }
  }, [
    gameState.board,
    gameState.currentTurn,
    deCombine.mode,
    exitDeCombineMode,
    memoizedEligibleHybrids,
    setMessage,
  ]);

  // Enter de-combine mode
  const enterDeCombineMode = useCallback((initialPiece = null) => {
    const hybrids = memoizedEligibleHybrids;

    if (hybrids.length === 0) {
      setMessage(announceError("No hybrid pieces available to De-Combine."));
      return false;
    }

    // Default state
    const newState = {
      mode: true,
      activeHybrid: null,
      eligibleSquares: [],
      selectedSquare: null,
      assignment: null,
      isConfirmOpen: false,
      isLocalMode: !!initialPiece, // true if double-tap, false if button
    };
    
    // If entered with a specific piece (long press)
    if (initialPiece) {
      const { row, col } = initialPiece;
      const piece = gameState.board[row][col];
      
      const isEligible = hybrids.some(
        (h) => h.row === row && h.col === col
      );
      
      if (isEligible) {
        // Automatically select the hybrid
        const squares = findSpawnSquares(gameState.board, row, col);
        
        if (squares.length > 0) {
          newState.activeHybrid = { row, col, piece };
          newState.eligibleSquares = squares;
          
          const components = getHybridComponents(piece);
          const compNames = components
            ? `${PIECE_SYMBOLS[components[0]]} + ${PIECE_SYMBOLS[components[1]]}`
            : "components";
            
          setMessage(
            `De-Combine Mode: Selected ${PIECE_SYMBOLS[piece]}. Click an adjacent square.`
          );
        } else {
           setMessage(announceError(DE_COMBINE_ERRORS.NO_ADJACENT_SQUARES));
           // Fallback to mode only
           setMessage("De-Combine Mode: Click a hybrid to split it into components.");
        }
      } else {
         setMessage("De-Combine Mode: Click a hybrid to split it into components.");
      }
    } else {
      setMessage("De-Combine Mode: Click a hybrid to split it into components.");
    }
    
    setDeCombine(newState);
    setEligibleHybrids(hybrids);
    return true;
  }, [memoizedEligibleHybrids, setMessage, gameState.board]);

  // Handle de-combine mode clicks
  const handleDeCombineClick = useCallback(
    (row, col) => {
      const piece = gameState.board[row][col];

      // Phase 1: Select hybrid
      if (!deCombine.activeHybrid) {
        const isEligible = eligibleHybrids.some(
          (h) => h.row === row && h.col === col
        );

        if (!isEligible) {
          setMessage(announceError(DE_COMBINE_ERRORS.NOT_HYBRID));
          return;
        }

        const squares = findSpawnSquares(gameState.board, row, col);

        if (squares.length === 0) {
          setMessage(announceError(DE_COMBINE_ERRORS.NO_ADJACENT_SQUARES));
          return;
        }

        setDeCombine({
          ...deCombine,
          activeHybrid: { row, col, piece },
          eligibleSquares: squares,
          selectedSquare: null,
          assignment: null,
          isConfirmOpen: false,
        });

        const components = getHybridComponents(piece);
        const compNames = components
          ? `${PIECE_SYMBOLS[components[0]]} + ${PIECE_SYMBOLS[components[1]]}`
          : "components";
        setMessage(
          `Hybrid selected. Click an adjacent square to place ${compNames}.`
        );
        return;
      }

      // Phase 2: Select spawn square
      const recomputedSquares = findSpawnSquares(
        gameState.board,
        deCombine.activeHybrid.row,
        deCombine.activeHybrid.col
      );
      const isEligibleSquare = recomputedSquares.some(
        (sq) => sq.row === row && sq.col === col
      );

      if (!isEligibleSquare) {
        setMessage(announceError(DE_COMBINE_ERRORS.SQUARE_NOT_ADJACENT));
        return;
      }

      if (gameState.board[row][col]) {
        setMessage(announceError(DE_COMBINE_ERRORS.SQUARE_OCCUPIED));
        setDeCombine((prev) => ({
          ...prev,
          eligibleSquares: recomputedSquares,
          selectedSquare: null,
        }));
        return;
      }

      // Run two-assignment legality check
      const assignmentResult = computeLegalAssignments(
        gameState.board,
        deCombine.activeHybrid.row,
        deCombine.activeHybrid.col,
        { row, col },
        gameState.currentTurn
      );

      if (assignmentResult.legal.length === 0) {
        setMessage(announceError(assignmentResult.reason));
        return;
      }

      const chosenAssignment = assignmentResult.chosen;

      // LOCAL MODE (double-tap): Execute directly without modal
      if (deCombine.isLocalMode) {
        const result = executeDeCombination(
          gameState.board,
          deCombine.activeHybrid.row,
          deCombine.activeHybrid.col,
          { row, col },
          gameState.currentTurn  // Pass currentTurn, not chosenAssignment
        );

        if (!result) {
           setMessage(announceError(DE_COMBINE_ERRORS.INVALID_PLACEMENT));
           return;
        }

        const newGameState = {
          ...gameState,
          board: result.board,
          currentTurn: switchTurn(gameState.currentTurn),
          capturedPieces: { ...gameState.capturedPieces },
          enPassantTarget: null,
        };

        // Add to move history
        const historyEntry = {
          type: "de-combine",
          turn: gameState.currentTurn,
          hybridSquare: { row: deCombine.activeHybrid.row, col: deCombine.activeHybrid.col },
          selectedSquare: { row, col },
          stayingComponent: result.stayingComponent,
          spawningComponent: result.spawningComponent,
          assignmentType: result.assignmentType,
          turnIndex: gameState.moveHistory.length,
          timestamp: Date.now(),
        };

        newGameState.moveHistory = [...gameState.moveHistory, historyEntry];

        setGameState(newGameState);

        const successMsg = getSuccessMessage(
          deCombine.activeHybrid.piece,
          result.stayingComponent,
          result.anchorSquare,
          result.spawningComponent,
          result.spawnSquare
        );
        setMessage(announceSuccess(successMsg));

        exitDeCombineMode(true);
      } 
      // GLOBAL MODE (button): Show confirmation dialog
      else {
        setDeCombine((prev) => ({
          ...prev,
          selectedSquare: { row, col },
          assignment: chosenAssignment,
          isConfirmOpen: true,
        }));
      }
    },
    [gameState, deCombine, eligibleHybrids, setMessage, setGameState, exitDeCombineMode]
  );

  // Execute de-combination
  const executeDeCombine = useCallback(() => {
    if (
      !deCombine.activeHybrid ||
      !deCombine.selectedSquare ||
      !deCombine.assignment
    ) {
      setMessage(announceError("Invalid de-combination state."));
      return;
    }

    const validation = validateDeCombination(
      gameState.board,
      deCombine.activeHybrid.row,
      deCombine.activeHybrid.col,
      deCombine.selectedSquare,
      gameState.currentTurn
    );

    if (!validation.valid) {
      setMessage(announceError(validation.reason));
      setDeCombine((prev) => ({
        ...prev,
        isConfirmOpen: false,
        selectedSquare: null,
        assignment: null,
      }));
      return;
    }

    const result = executeDeCombination(
      gameState.board,
      deCombine.activeHybrid.row,
      deCombine.activeHybrid.col,
      deCombine.selectedSquare,
      gameState.currentTurn
    );

    if (!result) {
      setMessage(announceError("De-combination failed: could not execute."));
      exitDeCombineMode(true);
      return;
    }

    const newGameState = {
      ...gameState,
      board: result.board,
      currentTurn: gameState.currentTurn === "white" ? "black" : "white",
      enPassantTarget: null,
    };

    const historyEntry = {
      type: "de-combine",
      hybrid: deCombine.activeHybrid.piece,
      hybridSquare: deCombine.activeHybrid,
      selectedSquare: deCombine.selectedSquare,
      assignment: result.assignment,
      stayingComponent: result.stayingComponent,
      spawningComponent: result.spawningComponent,
      assignmentType: result.assignmentType,
      turnIndex: gameState.moveHistory.length,
      timestamp: Date.now(),
    };

    newGameState.moveHistory = [...gameState.moveHistory, historyEntry];

    setGameState(newGameState);

    const successMsg = getSuccessMessage(
      deCombine.activeHybrid.piece,
      result.stayingComponent,
      result.anchorSquare,
      result.spawningComponent,
      result.spawnSquare
    );
    setMessage(announceSuccess(successMsg));

    exitDeCombineMode(true);
  }, [gameState, deCombine, setGameState, setMessage, exitDeCombineMode]);

  // Close confirm dialog
  const closeConfirmDialog = useCallback(() => {
    setDeCombine((prev) => ({
      ...prev,
      isConfirmOpen: false,
      selectedSquare: null,
    }));
    setMessage(
      "Confirmation cancelled. Select a different spawn square or ESC to cancel."
    );
  }, [setMessage]);

  // Handle ESC key for de-combine mode
  const handleDeCombineEscape = useCallback(() => {
    if (deCombine.isConfirmOpen) {
      setDeCombine((prev) => ({
        ...prev,
        isConfirmOpen: false,
        selectedSquare: null,
      }));
      setMessage(
        "Confirmation cancelled. Select a spawn square or choose another hybrid."
      );
    } else if (deCombine.activeHybrid) {
      setDeCombine((prev) => ({
        ...prev,
        activeHybrid: null,
        eligibleSquares: [],
        selectedSquare: null,
        assignment: null,
      }));
      setMessage("Hybrid deselected. Click a hybrid to start.");
    } else {
      exitDeCombineMode();
    }
  }, [deCombine, exitDeCombineMode, setMessage]);

  // Helper functions for square highlighting
  const isEligibleForDeCombine = useCallback(
    (row, col) => {
      if (!deCombine.mode) return false;
      return eligibleHybrids.some((h) => h.row === row && h.col === col);
    },
    [deCombine.mode, eligibleHybrids]
  );

  const isSelectedHybrid = useCallback(
    (row, col) => {
      return (
        deCombine.activeHybrid &&
        deCombine.activeHybrid.row === row &&
        deCombine.activeHybrid.col === col
      );
    },
    [deCombine.activeHybrid]
  );

  const isSpawnSquare = useCallback(
    (row, col) => {
      if (!deCombine.activeHybrid) return false;
      return deCombine.eligibleSquares.some(
        (sq) => sq.row === row && sq.col === col
      );
    },
    [deCombine]
  );

  const isSelectedSpawnSquare = useCallback(
    (row, col) => {
      return (
        deCombine.selectedSquare &&
        deCombine.selectedSquare.row === row &&
        deCombine.selectedSquare.col === col
      );
    },
    [deCombine.selectedSquare]
  );

  return {
    deCombine,
    eligibleHybrids: memoizedEligibleHybrids,
    enterDeCombineMode,
    exitDeCombineMode,
    handleDeCombineClick,
    executeDeCombine,
    closeConfirmDialog,
    handleDeCombineEscape,
    isEligibleForDeCombine,
    isSelectedHybrid,
    isSpawnSquare,
    isSelectedSpawnSquare,
  };
};
