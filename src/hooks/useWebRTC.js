"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import WebRTCSignalingService from "../services/WebRTCSignalingService.js";
import { COLORS } from "../utils/constants.js";

const useWebRTC = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [connectionId, setConnectionId] = useState("");
  const [connectionState, setConnectionState] = useState("closed");
  const [error, setError] = useState(null);
  const [gracefulDisconnectReceived, setGracefulDisconnectReceived] =
    useState(false);

  // Game mode and player management
  const [gameMode, setGameMode] = useState("singlePlayer"); // 'singlePlayer' | 'host' | 'guest'
  const [playerColor, setPlayerColor] = useState(null); // 'white' | 'black' | null

  const signalingService = useRef(null);

  // Initialize signaling service
  useEffect(() => {
    signalingService.current = new WebRTCSignalingService();

    // Set up connection state callback
    signalingService.current.setConnectionStateCallback((state) => {
      console.log("WebRTC connection state changed:", state);
      setConnectionState(state);
      setIsConnected(state === "connected");

      if (state === "connected") {
        setIsConnecting(false);
        setIsReconnecting(false);
        setError(null);
        console.log("Connection established successfully");
      } else if (state === "reconnecting") {
        setIsReconnecting(true);
        // Don't set error - the yellow "Reconnecting..." banner in page.js handles this
        console.log("Reconnecting...");
      } else if (state === "graceful-disconnect") {
        console.log("Received graceful disconnect notification");
        setIsConnected(false);
        setIsConnecting(false);
        setIsReconnecting(false);
        setError("Opponent left the game");
        setGracefulDisconnectReceived(true);

        // Reset to single player after graceful disconnect
        setTimeout(() => {
          setError(null);
          setGameMode("singlePlayer");
          setPlayerColor(null);
          setConnectionId("");
        }, 3000);
      } else if (state === "reconnection-successful") {
        setIsReconnecting(false);
        console.log("Reconnection successful - connection restored");
      } else if (state === "reconnection-failed") {
        setIsReconnecting(false);
        setError("Failed to reconnect. Connection lost.");
        // Auto-clear error and reset to single player after delay
        setTimeout(() => {
          setError(null);
          setGameMode("singlePlayer");
          setPlayerColor(null);
          setConnectionId("");
        }, 5000);
      } else if (state === "failed") {
        setIsConnected(false);
        setIsConnecting(false);

        // Check if this was a graceful disconnect
        if (gracefulDisconnectReceived) {
          console.log("Connection failed due to graceful disconnect");
          setError("Opponent left the game");
          setGracefulDisconnectReceived(false);

          // Reset to single player after graceful disconnect
          setTimeout(() => {
            setError(null);
            setGameMode("singlePlayer");
            setPlayerColor(null);
            setConnectionId("");
          }, 3000);
        } else {
          // Don't immediately reset gameMode or show error - reconnection will be attempted
          console.log(
            "Connection failed - reconnection will be attempted automatically"
          );
        }
      } else if (state === "disconnected" || state === "closed") {
        setIsConnected(false);
        setIsConnecting(false);

        // Only show disconnection messages if not reconnecting and this was a graceful disconnect
        if (!isReconnecting && gracefulDisconnectReceived) {
          setError("Opponent left the game");
          setGracefulDisconnectReceived(false);

          // Reset to single player after graceful disconnect
          setTimeout(() => {
            setError(null);
            setGameMode("singlePlayer");
            setPlayerColor(null);
            setConnectionId("");
          }, 3000);
        }
        // For other disconnections, let the reconnection system handle it
      }
    });

    return () => {
      if (signalingService.current) {
        signalingService.current.disconnect();
      }
    };
  }, []);

  // Create a new call
  const createCall = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);

      const callId = await signalingService.current.createCall();
      setConnectionId(callId);

      // Set as host (plays white)
      setGameMode("host");
      setPlayerColor(COLORS.WHITE);

      console.log("Call created with ID:", callId, "- You are HOST (WHITE)");
      return callId;
    } catch (err) {
      console.error("Failed to create call:", err);
      setError("Failed to create call: " + err.message);
      setIsConnecting(false);
      throw err;
    }
  }, []);

  // Join an existing call
  const joinCall = useCallback(async (callId) => {
    try {
      setIsConnecting(true);
      setError(null);

      await signalingService.current.joinCall(callId);
      setConnectionId(callId);

      // Set as guest (plays black)
      setGameMode("guest");
      setPlayerColor(COLORS.BLACK);

      console.log("Joined call:", callId, "- You are GUEST (BLACK)");
      return true;
    } catch (err) {
      console.error("Failed to join call:", err);
      setError("Failed to join call: " + err.message);
      setIsConnecting(false);
      throw err;
    }
  }, []);

  // Disconnect from call
  const disconnect = useCallback(async () => {
    try {
      if (signalingService.current) {
        await signalingService.current.disconnect();
      }

      setIsConnected(false);
      setIsConnecting(false);
      setConnectionId("");
      setConnectionState("closed");
      setError(null);

      // Reset to single player mode
      setGameMode("singlePlayer");
      setPlayerColor(null);

      console.log("Disconnected from call - Back to single player mode");
    } catch (err) {
      console.error("Failed to disconnect:", err);
      setError("Failed to disconnect: " + err.message);
    }
  }, []);

  // Cancel call creation
  const cancelCall = useCallback(async () => {
    try {
      if (signalingService.current) {
        await signalingService.current.disconnect();
      }

      setIsConnecting(false);
      setConnectionId("");
      setConnectionState("closed");
      setError(null);

      // Reset to single player mode
      setGameMode("singlePlayer");
      setPlayerColor(null);

      console.log("Call cancelled - Back to single player mode");
    } catch (err) {
      console.error("Failed to cancel call:", err);
      setError("Failed to cancel call: " + err.message);
    }
  }, []);

  // Send game state to peer
  const sendGameState = useCallback(
    (gameState) => {
      if (signalingService.current && isConnected) {
        signalingService.current.sendGameState(gameState);
      }
    },
    [isConnected]
  );

  // Send move to peer
  const sendMove = useCallback(
    (move) => {
      if (signalingService.current && isConnected) {
        signalingService.current.sendMove(move);
      }
    },
    [isConnected]
  );

  // Send debug message to peer
  const sendDebugMessage = useCallback(
    (message) => {
      if (signalingService.current && isConnected) {
        return signalingService.current.sendDebugMessage(message);
      }
      return false;
    },
    [isConnected]
  );

  // Send ping for latency measurement
  const measureLatency = useCallback(() => {
    if (signalingService.current && isConnected) {
      return signalingService.current.sendPing();
    }
    return null;
  }, [isConnected]);

  // Send disconnect notification
  const sendDisconnectNotification = useCallback(() => {
    if (signalingService.current && isConnected) {
      signalingService.current.sendDisconnectNotification();
    }
  }, [isConnected]);

  // Set graceful disconnect flag
  const setGracefulDisconnectFlag = useCallback((flag) => {
    setGracefulDisconnectReceived(flag);
  }, []);

  // Set callback for receiving messages
  const setOnMessageReceived = useCallback((callback) => {
    if (signalingService.current) {
      signalingService.current.setDataChannelMessageCallback(callback);
    }
  }, []);

  // Set callback for when data channel opens
  const setOnDataChannelOpen = useCallback((callback) => {
    if (signalingService.current) {
      signalingService.current.setDataChannelOpenCallback(callback);
    }
  }, []);

  // Request game state sync from peer
  const requestGameStateSync = useCallback(() => {
    if (signalingService.current && isConnected) {
      signalingService.current.requestGameStateSync();
    }
  }, [isConnected]);

  // Expose setters for engine mode (non-WebRTC game modes)
  const updateGameMode = useCallback((mode) => {
    setGameMode(mode);
  }, []);

  const updatePlayerColor = useCallback((color) => {
    setPlayerColor(color);
  }, []);

  return {
    // Connection State
    isConnecting,
    isConnected,
    isReconnecting,
    connectionId,
    connectionState,
    error,
    setError,

    // Game State
    gameMode,
    playerColor,
    updateGameMode, // For non-WebRTC modes like vsEngine
    updatePlayerColor, // For non-WebRTC modes like vsEngine

    // Actions
    createCall,
    joinCall,
    disconnect,
    cancelCall,
    sendGameState,
    sendMove,
    sendDebugMessage,
    measureLatency,
    sendDisconnectNotification,
    setGracefulDisconnectFlag,
    setOnMessageReceived,
    setOnDataChannelOpen,
    requestGameStateSync,
  };
};

export default useWebRTC;
