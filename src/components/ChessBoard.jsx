"use client";

import React, { useState, useEffect, useRef } from "react";
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
import useRematch from "./hooks/useRematch.js";
import useIdleTimeout from "./hooks/useIdleTimeout.js";
import useGameStatus from "./hooks/useGameStatus.js";

// UI Components
import CapturedPieces from "./ui/CapturedPieces.jsx";
import GameControls from "./ui/GameControls.jsx";
import PromotionDialog from "./ui/PromotionDialog.jsx";
import DeCombineConfirmDialog from "./ui/DeCombineConfirmDialog.jsx";
import RematchDialog from "./ui/RematchDialog.jsx";
import Timer from "./ui/Timer.jsx";
import BoardGrid from "./ui/BoardGrid.jsx";
import Sidebar from "./ui/Sidebar.jsx";
import MoveHistory from "./ui/MoveHistory.jsx";

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
  onDisconnect = null,
  sendDisconnectNotification = null,
  selectedTimeControl = null,
}) => {
  const [internalGameState, setInternalGameState] = useState(
    createInitialGameState()
  );
  const gameState = externalGameState || internalGameState;

  useEffect(() => {
    console.log("[SYNC DEBUG] ChessBoard gameState updated:", {
      currentTurn: gameState.currentTurn,
      hasExternalState: !!externalGameState,
      boardHash: JSON.stringify(gameState.board).slice(0, 100),
    });
  }, [gameState, externalGameState]);

  const updateGameState = (newGameState) => {
    if (onGameStateChange) {
      onGameStateChange(newGameState);
    } else {
      setInternalGameState(newGameState);
    }
  };

  const [message, setMessage] = useState("White to move");

  // Double-tap tracking refs
  const lastClickedSquare = useRef(null);
  const lastClickTime = useRef(0);

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

    // Multiplayer: Must be connected
    const isMultiplayer = gameMode === "host" || gameMode === "guest";
    if (isMultiplayer && !isConnected) {
      return false;
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

  // Game controls hook
  const { handleUndo, handleRedo, resetGame, handleResign } = useGameControls({
    gameState,
    updateGameState,
    setMessage,
    gameMode,
    playerColor,
    timerStateRef,
    onResetToSinglePlayer,
    clearSelection,
    exitCombineMode,
    exitDeCombineMode,
    selectedTimeControl,
  });

  // Idle timeout hook
  const { clearIdleTimeout } = useIdleTimeout({
    isGameOver: gameState.gameStatus?.isGameOver || false,
    gameMode,
    isConnected,
    onDisconnect,
    sendDisconnectNotification,
    setMessage,
  });

  // Rematch hook
  const {
    rematchState,
    handleRematchRequest,
    handleAcceptRematch,
    handleDeclineRematch,
  } = useRematch({
    gameState,
    updateGameState,
    setMessage,
    playerColor,
    resetGame,
    clearIdleTimeout,
    isConnected,
    onDisconnect,
    sendDisconnectNotification,
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

  // Route square clicks
  const handleSquareClick = (row, col) => {
    // Block interaction if waiting for opponent
    const isMultiplayer = gameMode === "host" || gameMode === "guest";
    if (isMultiplayer && !isConnected) {
      setMessage("Waiting for opponent to join...");
      return;
    }

    if (gameState.gameStatus?.isGameOver) {
      setMessage("Game is over. Please reset to start a new game.");
      return;
    }

    const piece = gameState.board[row][col];
    const currentTime = Date.now();
    const timeSinceLastClick = currentTime - lastClickTime.current;

    // DOUBLE-TAP DETECTION
    if (
      lastClickedSquare.current &&
      lastClickedSquare.current.row === row &&
      lastClickedSquare.current.col === col &&
      timeSinceLastClick < 300 &&
      timeSinceLastClick > 0
    ) {
      lastClickedSquare.current = null;
      lastClickTime.current = 0;

      if (piece && canMakeMove(piece, [row, col])) {
        if (isHybridPiece(piece)) {
          const isEligibleHybrid = eligibleHybrids.some(
            (h) => h.row === row && h.col === col
          );
          if (isEligibleHybrid) {
            if (combineMode) exitCombineMode();
            clearSelection();
            enterDeCombineMode({ row, col });
            return;
          }
        } else {
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

          if (partnersThisPieceCanReach.length > 0) {
            if (deCombine.mode) exitDeCombineMode();
            clearSelection();
            enterCombineMode({ row, col });
            return;
          }
        }
      }
    }

    lastClickedSquare.current = { row, col };
    lastClickTime.current = currentTime;

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
    // Block interaction if waiting for opponent
    const isMultiplayer = gameMode === "host" || gameMode === "guest";
    if (isMultiplayer && !isConnected) {
      setMessage("Waiting for opponent to join...");
      return;
    }

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
    // Block interaction if waiting for opponent
    const isMultiplayer = gameMode === "host" || gameMode === "guest";
    if (isMultiplayer && !isConnected) {
      setMessage("Waiting for opponent to join...");
      return;
    }

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

  // Check if timers should show
  const showTimers = gameMode === "vsEngine" || (gameMode !== "singlePlayer" && isConnected);

  // Get status message with mode indicator
  const getStatusMessage = () => {
    let status = message;
    if (combineMode) status += " • 🔮 Combine Mode";
    if (deCombine.mode) status += " • ⚡ Split Mode";
    return status;
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[var(--bg-primary)] overflow-x-hidden">
      {/* Status Strip */}
      <div className="w-full px-3 py-1.5 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] text-center flex-shrink-0">
        <span className="text-sm font-medium text-[var(--text-primary)]">
          {getStatusMessage()}
        </span>
      </div>

      {/* ====== MOBILE LAYOUT ====== */}
      <div className="mobile-layout flex-col">
        {/* Board - at top */}
        <div className="flex-shrink-0 flex justify-center">
          <div className="flex flex-col items-center w-full">
            {showTimers && timerStateRef && (
              <div className="w-full max-w-[90vw] mb-1">
                <Timer
                  timerStateRef={timerStateRef}
                  color={isBoardFlipped ? COLORS.WHITE : COLORS.BLACK}
                  currentTurn={gameState.currentTurn}
                  gameMode={gameMode}
                  isConnected={isConnected}
                  isReconnecting={isReconnecting}
                  onTimeout={handleTimeout}
                  isGameOver={gameState.gameStatus?.isGameOver || false}
                  playerName={isBoardFlipped ? "White" : "Black"}
                  compact={true}
                />
              </div>
            )}
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
            />
            {showTimers && timerStateRef && (
              <div className="w-full max-w-[90vw] mt-1">
                <Timer
                  timerStateRef={timerStateRef}
                  color={isBoardFlipped ? COLORS.BLACK : COLORS.WHITE}
                  currentTurn={gameState.currentTurn}
                  gameMode={gameMode}
                  isConnected={isConnected}
                  isReconnecting={isReconnecting}
                  onTimeout={handleTimeout}
                  isGameOver={gameState.gameStatus?.isGameOver || false}
                  playerName={isBoardFlipped ? "Black" : "White"}
                  compact={true}
                />
              </div>
            )}
          </div>
        </div>

        {/* Controls - below board */}
        <div className="flex-shrink-0 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] px-3 py-2 flex items-center justify-center gap-2">
          <GameControls
            gameState={gameState}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onCombineToggle={handleCombineToggle}
            onDeCombineToggle={handleDeCombineToggle}
            onReset={resetGame}
            onResign={handleResign}
            onRematchRequest={handleRematchRequest}
            combineMode={combineMode}
            deCombineMode={deCombine.mode}
            promotionMode={promotionDialog.isOpen}
            canUndoMove={canUndo(gameState)}
            canRedoMove={canRedo(gameState)}
            hasEligiblePairs={eligiblePairs.length > 0}
            hasEligibleHybrids={eligibleHybrids.length > 0}
            gameMode={gameMode}
            iconOnly={true}
            compact={true}
            isConnected={isConnected}
          />
        </div>

        {/* Captured pieces - 2 halves */}
        <div className="flex-shrink-0 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] px-3 py-2">
          <div className="flex gap-4">
            <div className="flex-1 min-h-[24px]">
              <CapturedPieces pieces={gameState.capturedPieces.black} isWhitePieces={false} compact={true} />
            </div>
            <div className="flex-1 min-h-[24px]">
              <CapturedPieces pieces={gameState.capturedPieces.white} isWhitePieces={true} compact={true} />
            </div>
          </div>
        </div>

        {/* Move history - grows naturally but gets internal scroll after max height */}
        <div className="flex flex-col bg-[var(--bg-secondary)] border-t border-[var(--border-color)] max-h-[50vh]">
          <div className="px-3 py-1.5 border-b border-[var(--border-color)] flex-shrink-0">
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Moves</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <MoveHistory moveHistory={gameState.moveHistory} />
          </div>
        </div>
      </div>

      {/* ====== DESKTOP LAYOUT ====== */}
      <div className="desktop-layout flex-1 justify-center items-center min-h-0 overflow-hidden py-4">
        <div className="flex w-full max-w-[1200px] mx-auto gap-4">
          {/* Board area */}
          <div className="board-container flex items-center justify-center">
            <div className="flex flex-col items-center">
              {showTimers && timerStateRef && (
                <div className="w-full mb-1">
                  <Timer
                    timerStateRef={timerStateRef}
                    color={isBoardFlipped ? COLORS.WHITE : COLORS.BLACK}
                    currentTurn={gameState.currentTurn}
                    gameMode={gameMode}
                    isConnected={isConnected}
                    isReconnecting={isReconnecting}
                    onTimeout={handleTimeout}
                    isGameOver={gameState.gameStatus?.isGameOver || false}
                    playerName={isBoardFlipped ? "White" : "Black"}
                  />
                </div>
              )}
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
              />
              {showTimers && timerStateRef && (
                <div className="w-full mt-1">
                  <Timer
                    timerStateRef={timerStateRef}
                    color={isBoardFlipped ? COLORS.BLACK : COLORS.WHITE}
                    currentTurn={gameState.currentTurn}
                    gameMode={gameMode}
                    isConnected={isConnected}
                    isReconnecting={isReconnecting}
                    onTimeout={handleTimeout}
                    isGameOver={gameState.gameStatus?.isGameOver || false}
                    playerName={isBoardFlipped ? "Black" : "White"}
                  />
                </div>
              )}
            </div>
          </div>
          {/* Sidebar */}
          <Sidebar
            gameState={gameState}
            moveHistory={gameState.moveHistory}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onCombineToggle={handleCombineToggle}
            onDeCombineToggle={handleDeCombineToggle}
            onReset={resetGame}
            onResign={handleResign}
            onRematchRequest={handleRematchRequest}
            combineMode={combineMode}
            deCombineMode={deCombine.mode}
            promotionMode={promotionDialog.isOpen}
            canUndoMove={canUndo(gameState)}
            canRedoMove={canRedo(gameState)}
            hasEligiblePairs={eligiblePairs.length > 0}
            hasEligibleHybrids={eligibleHybrids.length > 0}
            gameMode={gameMode}
            isConnected={isConnected}
          />
        </div>
      </div>

      {/* Dialogs */}
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

      <RematchDialog
        isOpen={rematchState.isOpen}
        requestFrom={rematchState.requestFrom}
        proposedTimer={rematchState.proposedTimer}
        onAccept={handleAcceptRematch}
        onDecline={handleDeclineRematch}
      />

      <PromotionDialog
        isOpen={promotionDialog.isOpen}
        currentTurn={gameState.currentTurn}
        onPromote={executePromotion}
      />
    </div>
  );
};

export default ChessBoard;
