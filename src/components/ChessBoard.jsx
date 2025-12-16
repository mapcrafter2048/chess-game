"use client";

import React, { useState, useEffect } from "react";
import {
  createInitialGameState,
  canUndo,
  canRedo,
  isCurrentPlayersPiece,
} from "../utils/gameState.js";
import { COLORS, getPieceColor, isHybridPiece } from "../utils/constants.js";
import { canReachForCombine } from "../utils/combinationRules.js";
import { capitalizeColor } from "./helpers/messageHelpers.js";

// Hooks
import { useCombineMode } from "./hooks/useCombineMode.js";
import { useDeCombineMode } from "./hooks/useDeCombineMode.js";
import { usePromotion } from "./hooks/usePromotion.js";
import { useMoveHandler } from "./hooks/useMoveHandler.js";
import useGameControls from "./hooks/useGameControls.js";
import useGameStatus from "./hooks/useGameStatus.js";

// UI Components
import StatusMessage from "./ui/StatusMessage.jsx";
import CombineModeIndicator from "./ui/CombineModeIndicator.jsx";
import DeCombineModeIndicator from "./ui/DeCombineModeIndicator.jsx";
import CapturedPieces from "./ui/CapturedPieces.jsx";
import GameControls from "./ui/GameControls.jsx";
import PromotionDialog from "./ui/PromotionDialog.jsx";
import DeCombineConfirmDialog from "./ui/DeCombineConfirmDialog.jsx";
import GameLegend from "./ui/GameLegend.jsx";
import Timer from "./ui/Timer.jsx";
import BoardGrid from "./ui/BoardGrid.jsx";

import { TIMER_CONFIG } from "../config/timerConfig.js";

const ChessBoard = ({
  gameState: externalGameState = null,
  onGameStateChange = null,
  gameMode = "singlePlayer",
  playerColor = null,
  isConnected = false,
  timerStateRef = null,
  isReconnecting = false,
  isAiThinking = false,
  onResetToSinglePlayer = null,
  selectedTimeControl = null,
}) => {
  // Use external game state if provided, otherwise use internal state
  const [internalGameState, setInternalGameState] = useState(
    createInitialGameState()
  );
  const gameState = externalGameState || internalGameState;

  // Debug: Log when ChessBoard receives new gameState prop
  useEffect(() => {
    console.log("[SYNC DEBUG] ChessBoard gameState updated:", {
      currentTurn: gameState.currentTurn,
      hasExternalState: !!externalGameState,
      boardHash: JSON.stringify(gameState.board).slice(0, 100),
    });
  }, [gameState, externalGameState]);

  // Game state updater - calls parent callback if provided
  const updateGameState = (newGameState) => {
    console.log("[SYNC DEBUG] ChessBoard updateGameState called:", {
      hasCallback: !!onGameStateChange,
      gameMode,
      playerColor,
      newTurn: newGameState.currentTurn,
    });

    if (onGameStateChange) {
      onGameStateChange(newGameState);
    } else {
      setInternalGameState(newGameState);
    }
  };

  const [message, setMessage] = useState("White to move");

  // Determine if board should be flipped (Black player in multiplayer)
  const isBoardFlipped =
    gameMode !== "singlePlayer" && playerColor === COLORS.BLACK;

  // Handle timer timeout
  const handleTimeout = (timedOutColor) => {
    if (gameState.gameStatus?.isGameOver) return;

    if (timerStateRef) {
      if (timedOutColor === COLORS.WHITE) {
        timerStateRef.current.whiteTime = 0;
      } else {
        timerStateRef.current.blackTime = 0;
      }
    }

    const winner = timedOutColor === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
    const newGameState = {
      ...gameState,
      gameStatus: {
        isCheck: false,
        isCheckmate: false,
        isStalemate: false,
        isGameOver: true,
        winner: winner,
        timeoutWinner: winner,
      },
    };
    updateGameState(newGameState);
    setMessage(`Time out! ${capitalizeColor(winner)} wins!`);
  };

  // Game status checking hook
  useGameStatus({
    gameState,
    updateGameState,
    setMessage,
    gameMode,
    playerColor,
  });

  // Move validation for multiplayer mode
  const canMakeMove = (piece, fromSquare = null) => {
    if (gameMode === "singlePlayer") {
      return true;
    }

    if (!piece) return false;

    if (gameMode === "vsEngine") {
      const pieceColor = getPieceColor(piece);
      return (
        pieceColor === COLORS.WHITE &&
        gameState.currentTurn === COLORS.WHITE &&
        !isAiThinking
      );
    }

    const isMyTurn = gameState.currentTurn === playerColor;
    const isMyPiece = isCurrentPlayersPiece(piece, playerColor);
    return isMyTurn && isMyPiece;
  };

  // Promotion hook
  const { promotionDialog, openPromotionDialog, executePromotion } =
    usePromotion(gameState, updateGameState, setMessage);

  // Move handler hook
  const {
    selectedSquare,
    legalMoves,
    handleSquareClick: handleNormalMove,
    isSelected,
    isLegalMoveSquare,
    clearSelection,
  } = useMoveHandler(
    gameState,
    updateGameState,
    setMessage,
    openPromotionDialog
  );

  // Combine mode hook
  const {
    combineMode,
    eligiblePairs,
    combineAnchor,
    enterCombineMode,
    exitCombineMode,
    handleCombineClick,
    isEligibleForCombine,
    isEligiblePartner,
    isCombineAnchor,
  } = useCombineMode(gameState, updateGameState, setMessage);

  // De-combine mode hook
  const {
    deCombine,
    eligibleHybrids,
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
  } = useDeCombineMode(gameState, updateGameState, setMessage);

  // Game controls hook (undo, redo, reset)
  const { handleUndo, handleRedo, resetGame } = useGameControls({
    gameState,
    updateGameState,
    setMessage,
    gameMode,
    timerStateRef,
    onResetToSinglePlayer,
    clearSelection,
    exitCombineMode,
    exitDeCombineMode,
    selectedTimeControl,
  });



  // Keyboard handler
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === "Escape") {
        if (combineMode) {
          exitCombineMode();
        } else if (deCombine.mode) {
          handleDeCombineEscape();
        }
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [combineMode, deCombine.mode, exitCombineMode, handleDeCombineEscape]);

  // Handle Double-Tap (Gesture for Combine/De-Combine)
  const handleDoubleTap = (row, col) => {
    if (gameState.gameStatus?.isGameOver) return;

    const piece = gameState.board[row][col];
    if (!canMakeMove(piece, [row, col])) {
      return;
    }

    // Try De-Combine Mode first (Priority if Hybrid)
    if (isHybridPiece(piece)) {
      const isEligibleHybrid = eligibleHybrids.some(
        (h) => h.row === row && h.col === col
      );
      if (!isEligibleHybrid) return;

      if (combineMode) exitCombineMode();
      clearSelection();
      enterDeCombineMode({ row, col });
    }
    // Try Combine Mode
    else {
      const partnersThisPieceCanReach = eligiblePairs.filter((pair) => {
        if (pair.piece1.row === row && pair.piece1.col === col) {
          return canReachForCombine(
            gameState.board,
            row,
            col,
            pair.piece2.row,
            pair.piece2.col,
            gameState.currentTurn
          );
        }
        if (pair.piece2.row === row && pair.piece2.col === col) {
          return canReachForCombine(
            gameState.board,
            row,
            col,
            pair.piece1.row,
            pair.piece1.col,
            gameState.currentTurn
          );
        }
        return false;
      });

      if (partnersThisPieceCanReach.length === 0) return;

      if (deCombine.mode) exitDeCombineMode();
      clearSelection();
      enterCombineMode({ row, col });
    }
  };

  // Route square clicks with move validation
  const handleSquareClick = (row, col) => {
    if (gameState.gameStatus?.isGameOver) {
      setMessage("Game is over. Please reset to start a new game.");
      return;
    }

    const piece = gameState.board[row][col];

    // DE-COMBINE MODE
    if (deCombine.mode) {
      if (deCombine.isLocalMode && deCombine.activeHybrid) {
        if (
          deCombine.activeHybrid.row === row &&
          deCombine.activeHybrid.col === col
        ) {
          return;
        }
        const isValidSpawn = deCombine.eligibleSquares.some(
          (sq) => sq.row === row && sq.col === col
        );
        if (isValidSpawn) {
          handleDeCombineClick(row, col);
        } else {
          exitDeCombineMode();
        }
      } else {
        handleDeCombineClick(row, col);
      }
      return;
    }

    // COMBINE MODE
    if (combineMode) {
      if (combineAnchor) {
        if (isEligiblePartner(row, col)) {
          handleCombineClick(row, col);
        } else if (isCombineAnchor(row, col)) {
          return;
        } else {
          exitCombineMode();
        }
      } else {
        handleCombineClick(row, col);
      }
      return;
    }

    // NORMAL MODE
    if (piece && selectedSquare === null && !canMakeMove(piece, [row, col])) {
      setMessage(
        `It's ${gameState.currentTurn}'s turn. You can only move ${
          playerColor || "any"
        } pieces.`
      );
      return;
    }

    handleNormalMove(row, col);
  };

  const handleCombineToggle = () => {
    if (gameState.gameStatus?.isGameOver) {
      setMessage("Game is over. Please reset to start a new game.");
      return;
    }

    if (gameState.gameStatus?.isCheck) {
      setMessage("Cannot combine pieces while in check!");
      return;
    }

    if (combineMode) {
      exitCombineMode();
    } else {
      if (deCombine.mode) exitDeCombineMode();
      clearSelection();
      enterCombineMode();
    }
  };

  const handleDeCombineToggle = () => {
    if (gameState.gameStatus?.isGameOver) {
      setMessage("Game is over. Please reset to start a new game.");
      return;
    }

    if (gameState.gameStatus?.isCheck) {
      setMessage("Cannot de-combine pieces while in check!");
      return;
    }

    if (deCombine.mode) {
      exitDeCombineMode();
    } else {
      if (combineMode) exitCombineMode();
      clearSelection();
      enterDeCombineMode();
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-0 sm:p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/4 left-1/4 w-48 h-48 sm:w-96 sm:h-96 bg-purple-500 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute bottom-1/4 right-1/4 w-48 h-48 sm:w-96 sm:h-96 bg-blue-500 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
      </div>

      <div className="flex flex-col items-center max-w-7xl w-full relative z-10">
        <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 mb-2 sm:mb-4 md:mb-6 drop-shadow-2xl tracking-tight animate-fade-in px-2">
          Interactive Chess
        </h1>

        <StatusMessage message={message} />
        {combineMode && <CombineModeIndicator />}
        {deCombine.mode && <DeCombineModeIndicator />}

        <div className="flex flex-col lg:flex-row gap-2 sm:gap-6 lg:gap-8 flex-wrap justify-center w-full px-0 sm:px-4">
          {/* Hide captured pieces on mobile, show on large screens */}
          <div className="hidden lg:block">
            <CapturedPieces
              title="Captured by White"
              pieces={gameState.capturedPieces.black}
              isWhitePieces={false}
            />
          </div>

          <div className="flex flex-col items-center gap-1 sm:gap-3 md:gap-4 flex-1 max-w-full lg:max-w-2xl">
            {/* Timer for top player */}
            {(gameMode === "vsEngine" ||
              (gameMode !== "singlePlayer" && isConnected)) &&
              timerStateRef && (
                <Timer
                  timerStateRef={timerStateRef}
                  color={isBoardFlipped ? COLORS.WHITE : COLORS.BLACK}
                  currentTurn={gameState.currentTurn}
                  gameMode={gameMode}
                  isConnected={isConnected}
                  isReconnecting={isReconnecting}
                  onTimeout={handleTimeout}
                  isGameOver={gameState.gameStatus?.isGameOver || false}
                />
              )}

            <div className="flex items-center transform transition-all hover:scale-[1.01] sm:hover:scale-[1.02] w-full justify-center px-1 sm:px-0">
              {/* Rank labels */}
              <div className="flex flex-col-reverse gap-0 mr-0.5 sm:mr-2 md:mr-3">
                {(isBoardFlipped
                  ? [8, 7, 6, 5, 4, 3, 2, 1]
                  : [1, 2, 3, 4, 5, 6, 7, 8]
                ).map((rank) => (
                  <div
                    key={rank}
                    className="h-8 sm:h-12 md:h-14 lg:h-16 flex items-center text-amber-400 text-[10px] sm:text-sm md:text-base font-bold drop-shadow-lg"
                  >
                    {rank}
                  </div>
                ))}
              </div>

              {/* Board Grid */}
              <BoardGrid
                gameState={gameState}
                isBoardFlipped={isBoardFlipped}
                isSelected={isSelected}
                isLegalMoveSquare={isLegalMoveSquare}
                isEligibleForCombine={isEligibleForCombine}
                isEligiblePartner={isEligiblePartner}
                isCombineAnchor={isCombineAnchor}
                combineMode={combineMode}
                combineAnchor={combineAnchor}
                isEligibleForDeCombine={isEligibleForDeCombine}
                isSelectedHybrid={isSelectedHybrid}
                isSpawnSquare={isSpawnSquare}
                isSelectedSpawnSquare={isSelectedSpawnSquare}
                deCombine={deCombine}
                handleSquareClick={handleSquareClick}
                handleDoubleTap={handleDoubleTap}
              />
            </div>

            {/* Timer for bottom player */}
            {(gameMode === "vsEngine" ||
              (gameMode !== "singlePlayer" && isConnected)) &&
              timerStateRef && (
                <Timer
                  timerStateRef={timerStateRef}
                  color={isBoardFlipped ? COLORS.BLACK : COLORS.WHITE}
                  currentTurn={gameState.currentTurn}
                  gameMode={gameMode}
                  isConnected={isConnected}
                  isReconnecting={isReconnecting}
                  onTimeout={handleTimeout}
                  isGameOver={gameState.gameStatus?.isGameOver || false}
                />
              )}
          </div>

          {/* Hide captured pieces on mobile, show on large screens */}
          <div className="hidden lg:block">
            <CapturedPieces
              title="Captured by Black"
              pieces={gameState.capturedPieces.white}
              isWhitePieces={true}
            />
          </div>
        </div>

        {/* Show captured pieces on mobile in a compact row */}
        <div className="lg:hidden flex flex-row gap-2 sm:gap-4 justify-center items-start mt-2 sm:mt-4 w-full px-1">
          <CapturedPieces
            title="Captured by White"
            pieces={gameState.capturedPieces.black}
            isWhitePieces={false}
          />
          <CapturedPieces
            title="Captured by Black"
            pieces={gameState.capturedPieces.white}
            isWhitePieces={true}
          />
        </div>

        <GameControls
          gameState={gameState}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onCombineToggle={handleCombineToggle}
          onDeCombineToggle={handleDeCombineToggle}
          onReset={resetGame}
          combineMode={combineMode}
          deCombineMode={deCombine.mode}
          promotionMode={promotionDialog.isOpen}
          canUndoMove={canUndo(gameState)}
          canRedoMove={canRedo(gameState)}
          hasEligiblePairs={eligiblePairs.length > 0}
          hasEligibleHybrids={eligibleHybrids.length > 0}
          gameMode={gameMode}
        />

        {deCombine.isConfirmOpen &&
          deCombine.activeHybrid &&
          deCombine.selectedSquare &&
          deCombine.assignment && (
            <DeCombineConfirmDialog
              isOpen={true}
              hybridPiece={deCombine.activeHybrid.piece}
              assignment={deCombine.assignment}
              selectedSquare={deCombine.selectedSquare}
              onConfirm={executeDeCombine}
              onCancel={closeConfirmDialog}
            />
          )}

        <PromotionDialog
          isOpen={promotionDialog.isOpen}
          currentTurn={gameState.currentTurn}
          onPromote={executePromotion}
        />

        <GameLegend deCombineMode={deCombine.mode} combineMode={combineMode} />
      </div>
    </div>
  );
};

export default ChessBoard;
