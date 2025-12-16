"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ChessBoard from "../components/ChessBoard.jsx";
import Navbar from "../components/ui/Navbar.jsx";
import useWebRTC from "../hooks/useWebRTC.js";
import { createInitialGameState } from "../utils/gameState.js";
import { COLORS } from "../utils/constants.js";
import { TIMER_CONFIG } from "../config/timerConfig.js";
import { findBestMoveParallel } from "../ai/alphaBeta.js";
import { AI_DIFFICULTY } from "../ai/constants.js";
import { Analytics } from "@vercel/analytics/react";

export default function Home() {
  const webRTC = useWebRTC();
  const [gameState, setGameState] = useState(() => createInitialGameState());
  const lastSyncRequestTime = useRef(0);

  // Ref to track the latest game state (for use in sync requests where React state might be stale)
  const gameStateRef = useRef(gameState);

  // Keep gameStateRef in sync with gameState
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Flag to prevent echoing back received game states
  const isReceivingRemoteState = useRef(false);

  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiDifficulty, setAiDifficulty] = useState("MEDIUM");
  const [selectedTimeControl, setSelectedTimeControl] = useState(
    TIMER_CONFIG.DEFAULT
  );

  const timerStateRef = useRef({
    whiteTime: TIMER_CONFIG.getTimeValue(TIMER_CONFIG.DEFAULT),
    blackTime: TIMER_CONFIG.getTimeValue(TIMER_CONFIG.DEFAULT),
    lastUpdate: Date.now(),
  });

  // Track previous game mode to detect transitions to single player (e.g. from disconnect)
  const prevGameMode = useRef(webRTC.gameMode);
  
  useEffect(() => {
    if (prevGameMode.current !== "singlePlayer" && webRTC.gameMode === "singlePlayer") {
       console.log("Resetting game state due to return to SinglePlayer");
       const initialState = createInitialGameState();
       setGameState(initialState);
       gameStateRef.current = initialState;
       
       // Reset timer
       const timeValue = TIMER_CONFIG.getTimeValue(TIMER_CONFIG.DEFAULT);
       timerStateRef.current = {
        whiteTime: timeValue,
        blackTime: timeValue,
        lastUpdate: Date.now(),
      };
      
      // Reset time control? Maybe keep user preference? 
      // User might want to play another game with same settings.
      // But for consistency with handleResetToSinglePlayer, let's reset or keep?
      // handleResetToSinglePlayer resets it.
      setSelectedTimeControl(TIMER_CONFIG.DEFAULT);
      setIsAiThinking(false);
    }
    prevGameMode.current = webRTC.gameMode;
  }, [webRTC.gameMode]);

  const handleGameStateChange = (newGameState) => {
    console.log("[SYNC DEBUG] handleGameStateChange called:", {
      currentTurn: newGameState.currentTurn,
      gameMode: webRTC.gameMode,
      playerColor: webRTC.playerColor,
      isConnected: webRTC.isConnected,
      boardHash: JSON.stringify(newGameState.board).slice(0, 100),
    });

    if (
      webRTC.gameMode === "vsEngine" ||
      (webRTC.gameMode !== "singlePlayer" && webRTC.isConnected)
    ) {
      const now = Date.now();
      const elapsed = now - timerStateRef.current.lastUpdate;

      const movingColor =
        newGameState.currentTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
      if (movingColor === COLORS.WHITE) {
        timerStateRef.current.whiteTime = Math.max(
          0,
          timerStateRef.current.whiteTime - elapsed
        );
      } else {
        timerStateRef.current.blackTime = Math.max(
          0,
          timerStateRef.current.blackTime - elapsed
        );
      }
      timerStateRef.current.lastUpdate = now;
    }

    // Update ref IMMEDIATELY before setting state, so sync requests get latest state
    gameStateRef.current = newGameState;
    setGameState(newGameState);

    if (
      webRTC.gameMode === "vsEngine" &&
      newGameState.currentTurn === COLORS.BLACK &&
      !isAiThinking &&
      !newGameState.gameStatus?.isGameOver
    ) {
      makeAiMove(newGameState);
    }

    // Only send game state to peer if this is a LOCAL change, not a received remote state
    if (webRTC.isConnected && !isReceivingRemoteState.current) {
      console.log("[SYNC DEBUG] Sending game state to peer:", {
        type: "gameStateSync",
        currentTurn: newGameState.currentTurn,
        boardHash: JSON.stringify(newGameState.board).slice(0, 100),
      });
      webRTC.sendGameState({
        type: "gameStateSync",
        gameState: newGameState,
        timerState: { ...timerStateRef.current },
        timestamp: Date.now(),
      });
    } else if (isReceivingRemoteState.current) {
      console.log("[SYNC DEBUG] Skipping send - this is a remote state update");
    } else if (!webRTC.isConnected) {
      console.log(
        "[SYNC DEBUG] Skipping send - NOT CONNECTED! gameMode:",
        webRTC.gameMode
      );
    }
  };

  const makeAiMove = async (currentGameState) => {
    setIsAiThinking(true);

    try {
      console.log("AI is thinking...");

      const bestMove = await findBestMoveParallel(
        currentGameState,
        AI_DIFFICULTY[aiDifficulty].depth
      );

      if (bestMove) {
        console.log("AI found best move:", bestMove);

        const {
          copyBoard,
          makeMove: makeBoardMove,
          executeCombination: executeCombinationOnBoard,
          switchTurn,
          addCapturedPiece,
        } = await import("../utils/gameState.js");
        const { executeCastleMove } = await import(
          "../components/helpers/castlingLogic.js"
        );

        let newBoard;
        let capturedPiece = null;

        switch (bestMove.type) {
          case "normal":
            capturedPiece =
              currentGameState.board[bestMove.to.row][bestMove.to.col];
            newBoard = makeBoardMove(
              currentGameState.board,
              bestMove.from.row,
              bestMove.from.col,
              bestMove.to.row,
              bestMove.to.col
            );
            break;

          case "castling":
            newBoard = executeCastleMove(
              currentGameState.board,
              currentGameState.currentTurn,
              bestMove.side === "kingside"
            );
            break;

          case "promotion":
            capturedPiece =
              currentGameState.board[bestMove.to.row][bestMove.to.col];
            newBoard = copyBoard(currentGameState.board);
            newBoard[bestMove.to.row][bestMove.to.col] = bestMove.promoteTo;
            newBoard[bestMove.from.row][bestMove.from.col] = "";
            break;

          case "combine": {
            const { piece1, piece2 } = bestMove.pieces;
            const result = executeCombinationOnBoard(
              currentGameState.board,
              piece1.row,
              piece1.col,
              piece2.row,
              piece2.col,
              piece1.row,
              piece1.col
            );
            newBoard = result ? result.board : currentGameState.board;
            break;
          }

          case "decombine":
            newBoard = copyBoard(currentGameState.board);
            newBoard[bestMove.from.row][bestMove.from.col] =
              bestMove.assignment.staying;
            newBoard[bestMove.to.row][bestMove.to.col] =
              bestMove.assignment.spawning;
            break;

          default:
            console.error("Unknown move type:", bestMove.type);
            newBoard = currentGameState.board;
        }

        let newCapturedPieces = { ...currentGameState.capturedPieces };
        if (capturedPiece && capturedPiece !== "") {
          newCapturedPieces = addCapturedPiece(
            currentGameState.capturedPieces,
            capturedPiece
          );
        }

        let newCastlingRights = { ...currentGameState.castlingRights };
        const piece =
          currentGameState.board[bestMove.from.row][bestMove.from.col];

        if (piece && piece.toLowerCase() === "k") {
          if (currentGameState.currentTurn === COLORS.BLACK) {
            newCastlingRights = {
              ...newCastlingRights,
              black: { kingSide: false, queenSide: false },
            };
          }
        }

        const newGameState = {
          ...currentGameState,
          board: newBoard,
          currentTurn: switchTurn(currentGameState.currentTurn),
          capturedPieces: newCapturedPieces,
          castlingRights: newCastlingRights,
          moveHistory: [...currentGameState.moveHistory, bestMove],
          enPassantTarget: null,
        };

        const now = Date.now();
        const elapsed = now - timerStateRef.current.lastUpdate;
        timerStateRef.current.blackTime = Math.max(
          0,
          timerStateRef.current.blackTime - elapsed
        );
        timerStateRef.current.lastUpdate = now;

        gameStateRef.current = newGameState;
        setGameState(newGameState);
      } else {
        console.log("AI has no legal moves (game over)");
      }
    } catch (error) {
      console.error("Error during AI move calculation:", error);
    } finally {
      setIsAiThinking(false);
    }
  };

  const startEngineGame = useCallback(
    (timeControl = selectedTimeControl) => {
      console.log(
        "Starting engine game (vs AI) with time control:",
        timeControl
      );

      webRTC.updateGameMode("vsEngine");
      webRTC.updatePlayerColor(COLORS.WHITE);

      const initialState = createInitialGameState();
      gameStateRef.current = initialState;
      setGameState(initialState);

      const timeValue = TIMER_CONFIG.getTimeValue(timeControl);
      timerStateRef.current = {
        whiteTime: timeValue,
        blackTime: timeValue,
        lastUpdate: Date.now(),
      };

      setSelectedTimeControl(timeControl);
      setIsAiThinking(false);
    },
    [webRTC, selectedTimeControl]
  );

  const handleResetToSinglePlayer = useCallback(() => {
    console.log("Resetting to single player mode");

    webRTC.updateGameMode("singlePlayer");
    webRTC.updatePlayerColor(null);

    const initialState = createInitialGameState();
    gameStateRef.current = initialState;
    setGameState(initialState);

    const timeValue = TIMER_CONFIG.getTimeValue(TIMER_CONFIG.DEFAULT);
    timerStateRef.current = {
      whiteTime: timeValue,
      blackTime: timeValue,
      lastUpdate: Date.now(),
    };

    setSelectedTimeControl(TIMER_CONFIG.DEFAULT);
    setIsAiThinking(false);
  }, [webRTC]);

  const handleMessage = useCallback(
    (message) => {
      console.log("[SYNC DEBUG] handleMessage received:", {
        type: message.type,
        hasData: !!message.data,
        dataType: message.data?.type,
      });

      if (message.type === "gameState" && message.data) {
        const innerMessage = message.data;

        if (innerMessage.type === "gameStateSync") {
          console.log("[SYNC DEBUG] Applying game state from peer:", {
            currentTurn: innerMessage.gameState?.currentTurn,
            boardHash: JSON.stringify(innerMessage.gameState?.board).slice(
              0,
              100
            ),
          });

          // Set flag to prevent echoing this state back
          isReceivingRemoteState.current = true;

          // Update ref immediately for sync requests
          gameStateRef.current = innerMessage.gameState;
          setGameState((prevState) => {
            console.log(
              "[SYNC DEBUG] setGameState functional update - prev turn:",
              prevState.currentTurn,
              "new turn:",
              innerMessage.gameState.currentTurn
            );
            return innerMessage.gameState;
          });

          // Clear the flag after a short delay to allow effects to run
          // This ensures any status updates from checkGameStatus won't be broadcast
          setTimeout(() => {
            isReceivingRemoteState.current = false;
            console.log("[SYNC DEBUG] Remote state flag cleared");
          }, 100);

          if (innerMessage.timerState) {
            timerStateRef.current = { ...innerMessage.timerState };
            console.log(
              "Timer state updated from peer:",
              innerMessage.timerState
            );
          }
        } else if (innerMessage.type === "playerAssignment") {
          // WRAPPED MESSAGE HANDLER: Receives messages from WebRTC service
          // that are wrapped in { type: "gameState", data: {...} } format
          isReceivingRemoteState.current = true;
          gameStateRef.current = innerMessage.initialGameState;
          setGameState(innerMessage.initialGameState);

          // Initialize timer from host's selected time control
          if (innerMessage.timeControl) {
            const timeValue = TIMER_CONFIG.getTimeValue(
              innerMessage.timeControl
            );
            timerStateRef.current = {
              whiteTime: timeValue,
              blackTime: timeValue,
              lastUpdate: Date.now(),
            };
            setSelectedTimeControl(innerMessage.timeControl);
            console.log(
              "Timer initialized from host:",
              innerMessage.timeControl,
              "->",
              timeValue,
              "ms"
            );
          }

          setTimeout(() => {
            isReceivingRemoteState.current = false;
          }, 100);
        }
      } else if (message.type === "requestGameStateSync") {
        const now = Date.now();
        const timeSinceLastRequest = now - lastSyncRequestTime.current;

        // Use gameStateRef to get the LATEST state, not stale React state
        console.log(
          "[SYNC DEBUG] Responding to requestGameStateSync with ref state:",
          {
            currentTurn: gameStateRef.current.currentTurn,
            boardHash: JSON.stringify(gameStateRef.current.board).slice(0, 100),
          }
        );

        webRTC.sendGameState({
          type: "gameStateSync",
          gameState: gameStateRef.current,
          timerState: { ...timerStateRef.current },
          timestamp: now,
        });

        if (timeSinceLastRequest > 2000) {
          lastSyncRequestTime.current = now;
        }
      } else if (message.type === "disconnect" && message.data) {
        const innerMessage = message.data;
        if (innerMessage.type === "gracefulDisconnect") {
          webRTC.setGracefulDisconnectFlag &&
            webRTC.setGracefulDisconnectFlag(true);
        }
      } else if (message.type === "gameStateSync") {
        // Direct gameStateSync message (without wrapper)
        isReceivingRemoteState.current = true;
        gameStateRef.current = message.gameState;
        setGameState((prevState) => {
          return message.gameState;
        });
        setTimeout(() => {
          isReceivingRemoteState.current = false;
        }, 100);
      } else if (message.type === "playerAssignment") {
        // DIRECT MESSAGE HANDLER: Fallback for unwrapped messages
        // sent directly through data channel (backwards compatibility)
        isReceivingRemoteState.current = true;
        gameStateRef.current = message.initialGameState;
        setGameState(message.initialGameState);

        // Initialize timer from host's selected time control
        if (message.timeControl) {
          const timeValue = TIMER_CONFIG.getTimeValue(message.timeControl);
          timerStateRef.current = {
            whiteTime: timeValue,
            blackTime: timeValue,
            lastUpdate: Date.now(),
          };
          setSelectedTimeControl(message.timeControl);
          console.log(
            "Timer initialized from host (direct):",
            message.timeControl,
            "->",
            timeValue,
            "ms"
          );
        }

        setTimeout(() => {
          isReceivingRemoteState.current = false;
        }, 100);
      }
    },
    [webRTC]
  );

  useEffect(() => {
    if (webRTC.setOnMessageReceived) {
      webRTC.setOnMessageReceived((message) => {
        handleMessage(message);

        window.dispatchEvent(
          new CustomEvent("webrtc-message", { detail: message })
        );
      });
    }
  }, [webRTC.setOnMessageReceived, handleMessage]);

  useEffect(() => {
    console.log(
      "[SYNC DEBUG] setOnDataChannelOpen effect - gameMode:",
      webRTC.gameMode,
      "hasSetOnDataChannelOpen:",
      !!webRTC.setOnDataChannelOpen
    );
    if (webRTC.setOnDataChannelOpen && webRTC.gameMode === "host") {
      console.log("[SYNC DEBUG] Setting onDataChannelOpen callback for host");
      webRTC.setOnDataChannelOpen(() => {
        console.log(
          "[SYNC DEBUG] onDataChannelOpen callback FIRED - sending playerAssignment"
        );
        // Use gameStateRef to get the latest state, avoiding stale closure issues
        webRTC.sendGameState({
          type: "playerAssignment",
          hostColor: COLORS.WHITE,
          guestColor: COLORS.BLACK,
          initialGameState: gameStateRef.current,
          timeControl: selectedTimeControl, // Send time control name to guest
        });
      });
    }
  }, [webRTC.setOnDataChannelOpen, webRTC.gameMode, webRTC]);

  // Separate effect for resetting when switching TO singlePlayer mode (not when already in it)
  const previousGameMode = useRef(webRTC.gameMode);

  useEffect(() => {
    const currentMode = webRTC.gameMode;
    const prevMode = previousGameMode.current;

    // Only reset when SWITCHING TO singlePlayer from another mode
    if (
      currentMode === "singlePlayer" &&
      prevMode !== "singlePlayer" &&
      prevMode !== currentMode
    ) {
      const initialState = createInitialGameState();
      gameStateRef.current = initialState;
      setGameState(initialState);

      const timeValue = TIMER_CONFIG.getTimeValue(TIMER_CONFIG.DEFAULT);
      timerStateRef.current = {
        whiteTime: timeValue,
        blackTime: timeValue,
        lastUpdate: Date.now(),
      };

      setSelectedTimeControl(TIMER_CONFIG.DEFAULT);
      setIsAiThinking(false);
    } else if (currentMode === "host" && prevMode === "singlePlayer") {
      // When becoming host FROM singlePlayer, reset game state and timer
      console.log("Resetting game state when becoming host");
      const initialState = createInitialGameState();
      gameStateRef.current = initialState;
      setGameState(initialState);
      
      const timeValue = TIMER_CONFIG.getTimeValue(selectedTimeControl);
      timerStateRef.current = {
        whiteTime: timeValue,
        blackTime: timeValue,
        lastUpdate: Date.now(),
      };
    } else if (currentMode === "guest" && prevMode === "singlePlayer") {
      // When becoming guest FROM singlePlayer, reset game state
      // The actual game state will be received from host via playerAssignment
      console.log("Resetting game state when becoming guest");
      const initialState = createInitialGameState();
      gameStateRef.current = initialState;
      setGameState(initialState);
      
      const timeValue = TIMER_CONFIG.getTimeValue(TIMER_CONFIG.DEFAULT);
      timerStateRef.current = {
        whiteTime: timeValue,
        blackTime: timeValue,
        lastUpdate: Date.now(),
      };
    }

    // Update previous mode for next comparison
    previousGameMode.current = currentMode;
  }, [webRTC.gameMode, selectedTimeControl]);

  useEffect(() => {
    if (
      webRTC.isConnected &&
      !webRTC.isReconnecting &&
      webRTC.gameMode === "guest"
    ) {
      setTimeout(() => {
        webRTC.requestGameStateSync();
      }, 1000);
    }
  }, [
    webRTC.isConnected,
    webRTC.isReconnecting,
    webRTC.gameMode,
    webRTC.requestGameStateSync,
  ]);

  useEffect(() => {
    if (webRTC.isConnected && !webRTC.isReconnecting) {
      timerStateRef.current.lastUpdate = Date.now();
    }
  }, [webRTC.isConnected, webRTC.isReconnecting]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Analytics />
      <Navbar
        webRTC={webRTC}
        gameState={gameState}
        onStartEngineGame={startEngineGame}
        aiDifficulty={aiDifficulty}
        onDifficultyChange={setAiDifficulty}
        selectedTimeControl={selectedTimeControl}
        onTimeControlChange={setSelectedTimeControl}
        isGameStarted={(webRTC.isConnected || webRTC.gameMode === "vsEngine") && !gameState.gameStatus?.isGameOver}
      />

      {webRTC.error && (
        <div className="fixed top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-lg shadow-lg flex items-center space-x-2 sm:space-x-3 max-w-[90vw]">
          <span className="font-medium text-sm sm:text-base">
            {webRTC.error}
          </span>
          <button 
            onClick={() => webRTC.setError(null)} 
            className="ml-2 hover:bg-red-700 rounded-full p-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {webRTC.isReconnecting && (
        <div className="fixed top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-50 bg-yellow-600 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-lg shadow-lg flex items-center space-x-2 sm:space-x-3 max-w-[90vw]">
          <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white"></div>
          <span className="font-medium text-sm sm:text-base">
            Reconnecting...
          </span>
        </div>
      )}

      <ChessBoard
        gameState={gameState}
        onGameStateChange={handleGameStateChange}
        gameMode={webRTC.gameMode}
        playerColor={webRTC.playerColor}
        isConnected={webRTC.isConnected}
        timerStateRef={timerStateRef}
        isReconnecting={webRTC.isReconnecting}
        isAiThinking={isAiThinking}
        onResetToSinglePlayer={handleResetToSinglePlayer}
        selectedTimeControl={selectedTimeControl}
      />
    </div>
  );
}
