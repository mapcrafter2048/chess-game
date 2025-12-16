"use client";

import { useCallback } from "react";
import { undoMove, redoMove, createInitialGameState } from "../../utils/gameState.js";
import { capitalizeColor } from "../helpers/messageHelpers.js";
import { TIMER_CONFIG } from "../../config/timerConfig.js";

/**
 * Hook to handle game control actions: undo, redo, and reset.
 * 
 * @param {Object} options - Hook options
 * @param {Object} options.gameState - Current game state
 * @param {Function} options.updateGameState - Callback to update game state
 * @param {Function} options.setMessage - Callback to set status message
 * @param {string} options.gameMode - Current game mode
 * @param {Object} options.timerStateRef - Ref to timer state
 * @param {Function} options.onResetToSinglePlayer - Callback when resetting from engine mode
 * @param {Function} options.clearSelection - Callback to clear piece selection
 * @param {Function} options.exitCombineMode - Callback to exit combine mode
 * @param {Function} options.exitDeCombineMode - Callback to exit de-combine mode
 * @returns {Object} - { handleUndo, handleRedo, resetGame }
 */
const useGameControls = ({
  gameState,
  updateGameState,
  setMessage,
  gameMode,
  timerStateRef = null,
  onResetToSinglePlayer = null,
  clearSelection,
  exitCombineMode,
  exitDeCombineMode,
  selectedTimeControl = null,
}) => {
  // Handle Undo
  const handleUndo = useCallback(() => {
    // Disable undo/redo in multiplayer mode and engine mode
    if (gameMode !== "singlePlayer") {
      setMessage(
        `Undo/Redo is disabled in ${
          gameMode === "vsEngine" ? "engine" : "multiplayer"
        } mode`
      );
      return;
    }

    const newState = undoMove(gameState);
    if (newState !== gameState) {
      updateGameState(newState);
      clearSelection();
      setMessage(`Undo - ${capitalizeColor(newState.currentTurn)} to move`);
    }
  }, [gameMode, gameState, updateGameState, clearSelection, setMessage]);

  // Handle Redo
  const handleRedo = useCallback(() => {
    // Disable undo/redo in multiplayer mode and engine mode
    if (gameMode !== "singlePlayer") {
      setMessage(
        `Undo/Redo is disabled in ${
          gameMode === "vsEngine" ? "engine" : "multiplayer"
        } mode`
      );
      return;
    }

    const newState = redoMove(gameState);
    if (newState !== gameState) {
      updateGameState(newState);
      clearSelection();
      setMessage(`Redo - ${capitalizeColor(newState.currentTurn)} to move`);
    }
  }, [gameMode, gameState, updateGameState, clearSelection, setMessage]);

  // Reset Game
  const resetGame = useCallback(() => {
    // Reset timer if available
    if (timerStateRef) {
      const timeControlToUse = selectedTimeControl || TIMER_CONFIG.DEFAULT;
      const initialTime = TIMER_CONFIG.getTimeValue(timeControlToUse);
      timerStateRef.current.whiteTime = initialTime;
      timerStateRef.current.blackTime = initialTime;
      timerStateRef.current.lastUpdate = Date.now();
    }

    // If in engine mode, reset to single player mode
    if (gameMode === "vsEngine") {
      if (onResetToSinglePlayer) {
        onResetToSinglePlayer();
      }
      clearSelection();
      exitCombineMode();
      exitDeCombineMode();
      setMessage("Game reset - Single player mode");
      return;
    }

    // Standard single player reset
    const newState = createInitialGameState();
    updateGameState(newState);
    clearSelection();
    exitCombineMode();
    exitDeCombineMode();
    setMessage("White to move");
  }, [
    timerStateRef,
    gameMode,
    onResetToSinglePlayer,
    updateGameState,
    clearSelection,
    exitCombineMode,
    exitDeCombineMode,
    setMessage,
    selectedTimeControl,
  ]);

  return {
    handleUndo,
    handleRedo,
    resetGame,
  };
};

export default useGameControls;
