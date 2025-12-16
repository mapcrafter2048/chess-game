"use client";

import React from "react";

/**
 * GameControls component - buttons for game actions
 */
const GameControls = ({
  gameState,
  onUndo,
  onRedo,
  onCombineToggle,
  onDeCombineToggle,
  onReset,
  combineMode,
  deCombineMode,
  promotionMode,
  canUndoMove,
  canRedoMove,
  hasEligiblePairs,
  hasEligibleHybrids,
  gameMode = "singlePlayer",
}) => {
  // Disable undo/redo when any special mode is active
  const isSpecialModeActive = combineMode || deCombineMode || promotionMode;

  // Hide reset button in multiplayer modes (host/guest)
  const showResetButton = gameMode !== "host" && gameMode !== "guest";

  // Hide undo/redo in multiplayer and vsEngine modes (only show in singlePlayer)
  const showUndoRedo = gameMode === "singlePlayer";

  // Check if game is over or in check
  const isGameOver = gameState.gameStatus?.isGameOver || false;
  const isInCheck = gameState.gameStatus?.isCheck || false;

  return (
    <div className="mt-4 sm:mt-6 md:mt-8 flex gap-2 sm:gap-3 md:gap-4 flex-wrap justify-center px-2">
      {/* Undo button - Only visible in single player mode */}
      {showUndoRedo && (
        <button
          onClick={onUndo}
          disabled={!canUndoMove || isSpecialModeActive}
          aria-label="Undo last move"
          title={
            isSpecialModeActive
              ? "Cannot undo while in special mode"
              : "Undo last move"
          }
          className="px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-bold rounded-lg sm:rounded-xl shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-orange-400 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:opacity-50"
        >
          <span className="text-sm sm:text-base md:text-lg lg:text-xl">
            ↶ Undo
          </span>
        </button>
      )}

      {/* Redo button - Only visible in single player mode */}
      {showUndoRedo && (
        <button
          onClick={onRedo}
          disabled={!canRedoMove || isSpecialModeActive}
          aria-label="Redo last undone move"
          title={
            isSpecialModeActive
              ? "Cannot redo while in special mode"
              : "Redo last undone move"
          }
          className="px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-bold rounded-lg sm:rounded-xl shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-orange-400 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:opacity-50"
        >
          <span className="text-sm sm:text-base md:text-lg lg:text-xl">
            ↷ Redo
          </span>
        </button>
      )}

      {/* Combine button */}
      <button
        onClick={onCombineToggle}
        disabled={
          (!combineMode && !hasEligiblePairs) || isGameOver || isInCheck
        }
        role="button"
        aria-pressed={combineMode}
        aria-label={combineMode ? "Cancel Combine Mode" : "Enter Combine Mode"}
        title={isInCheck ? "Cannot combine while in check" : ""}
        className={`px-4 py-2 sm:px-6 sm:py-3 md:px-8 md:py-4 font-bold rounded-lg sm:rounded-xl shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-purple-400 ${
          combineMode
            ? "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white"
            : "bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed disabled:hover:scale-100"
        }`}
      >
        <span className="text-sm sm:text-base md:text-lg lg:text-xl whitespace-nowrap">
          {combineMode ? "❌ Cancel" : "🔮 Combine"}
        </span>
      </button>

      {/* De-Combine button */}
      <button
        onClick={onDeCombineToggle}
        disabled={
          (!deCombineMode && !hasEligibleHybrids) || isGameOver || isInCheck
        }
        role="button"
        aria-pressed={deCombineMode}
        aria-label={
          deCombineMode ? "Cancel De-Combine Mode" : "Enter De-Combine Mode"
        }
        title={isInCheck ? "Cannot de-combine while in check" : ""}
        className={`px-4 py-2 sm:px-6 sm:py-3 md:px-8 md:py-4 font-bold rounded-lg sm:rounded-xl shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-teal-400 ${
          deCombineMode
            ? "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white"
            : "bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed disabled:hover:scale-100"
        }`}
      >
        <span className="text-sm sm:text-base md:text-lg lg:text-xl whitespace-nowrap">
          {deCombineMode ? "❌ Cancel" : "⚡ De-Combine"}
        </span>
      </button>

      {/* Reset button - Hidden in multiplayer modes */}
      {showResetButton && (
        <button
          onClick={onReset}
          aria-label="Reset Game"
          className="px-4 py-2 sm:px-6 sm:py-3 md:px-8 md:py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-lg sm:rounded-xl shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-blue-400"
        >
          <span className="text-sm sm:text-base md:text-lg lg:text-xl whitespace-nowrap">
            🔄 Reset
          </span>
        </button>
      )}
    </div>
  );
};

export default GameControls;
