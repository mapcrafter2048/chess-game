"use client";

import React, { useState, useEffect } from "react";
import { TIMER_CONFIG } from "../../config/timerConfig";

const Navbar = ({
  webRTC,
  gameState,
  onStartEngineGame,
  aiDifficulty,
  onDifficultyChange,
  selectedTimeControl,
  onTimeControlChange,
  isGameStarted = false,
}) => {
  const [receiverIdInput, setReceiverIdInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [testMessage, setTestMessage] = useState("");
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [latency, setLatency] = useState(null);
  const [measuringLatency, setMeasuringLatency] = useState(false);

  const {
    isConnecting,
    isConnected,
    connectionId,
    connectionState,
    error,
    gameMode,
    playerColor,
    createCall,
    joinCall,
    disconnect,
    cancelCall,
    sendGameState,
    sendMove,
    sendDebugMessage,
    measureLatency,
  } = webRTC;

  // Set up message handling via custom event (to avoid conflicts with App.jsx)
  useEffect(() => {
    const handleWebRTCMessage = (event) => {
      const message = event.detail;

      // Handle latency result specially
      if (message.type === "latencyResult") {
        setMeasuringLatency(false);
        if (message.data.success) {
          setLatency(message.data.latency);
          setMessages((prev) => [
            ...prev,
            {
              type: "system",
              data: {
                type: "latency",
                latency: message.data.latency.toFixed(2),
                rtt: message.data.rtt.toFixed(2),
              },
              timestamp: new Date().toLocaleTimeString(),
            },
          ]);
        }
        return;
      }

      // Handle all other messages
      setMessages((prev) => [
        ...prev,
        {
          type: "received",
          data: message,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    };

    window.addEventListener("webrtc-message", handleWebRTCMessage);

    return () => {
      window.removeEventListener("webrtc-message", handleWebRTCMessage);
    };
  }, []);

  // Monitor connection state changes and reset UI when peer disconnects
  useEffect(() => {
    if (
      connectionState === "disconnected" ||
      connectionState === "failed" ||
      connectionState === "closed"
    ) {
      // Reset UI state when connection is lost
      if (connectionState === "disconnected") {
        // Add a disconnection message to the log
        setMessages((prev) => [
          ...prev,
          {
            type: "system",
            data: { type: "system", message: "Peer disconnected" },
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }

      // Reset local UI state after a brief delay
      const resetTimer = setTimeout(() => {
        setReceiverIdInput("");
        setShowDebugPanel(false);
        setTestMessage("");
        // Keep messages for a bit longer so user can see what happened
        setTimeout(() => {
          setMessages([]);
        }, 3000);
      }, 1000);

      return () => clearTimeout(resetTimer);
    }
  }, [connectionState]);

  const handleInitiateCall = async () => {
    try {
      const callId = await createCall();
      // console.log('Call created with ID:', callId);
    } catch (err) {
      console.error("Failed to create call:", err);
      alert("Failed to create call: " + err.message);
    }
  };

  const handleAcceptCall = async () => {
    if (!receiverIdInput.trim()) {
      alert("Please enter a connection ID");
      return;
    }

    try {
      await joinCall(receiverIdInput.trim());
      // console.log('Successfully joined call');
    } catch (err) {
      console.error("Failed to join call:", err);
      alert("Failed to join call: " + err.message);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setReceiverIdInput("");
      setMessages([]);
      setTestMessage("");
      // console.log('Disconnected successfully');
    } catch (err) {
      console.error("Failed to disconnect:", err);
    }
  };

  const handleCancelCall = async () => {
    try {
      await cancelCall();
      // console.log('Call cancelled successfully');
    } catch (err) {
      console.error("Failed to cancel call:", err);
    }
  };

  // Test message functions for debugging
  const sendTestMessage = () => {
    if (!testMessage.trim()) {
      alert("Enter a test message");
      return;
    }

    const message = {
      type: "test",
      content: testMessage,
      sender: "local",
    };

    // Use the new sendDebugMessage method
    const sent = sendDebugMessage(message);

    if (sent) {
      setMessages((prev) => [
        ...prev,
        {
          type: "sent",
          data: { type: "debug", data: message },
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
      setTestMessage("");
    }
  };

  const sendTestMove = () => {
    const testMove = {
      from: "e2",
      to: "e4",
      piece: "pawn",
      timestamp: Date.now(),
    };

    sendMove(testMove);
    setMessages((prev) => [
      ...prev,
      {
        type: "sent",
        data: { type: "move", data: testMove },
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  };

  const handleMeasureLatency = () => {
    setMeasuringLatency(true);
    const pingId = measureLatency();
    if (!pingId) {
      setMeasuringLatency(false);
      alert("Failed to send ping");
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(connectionId);
    alert("Connection ID copied to clipboard!");
  };

  return (
    <nav className="bg-slate-800 shadow-lg border-b border-slate-600">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div className="flex flex-col justify-center items-center py-3 lg:py-0 lg:h-16 gap-3 lg:gap-0 lg:flex-row lg:justify-between">
          {/* Logo/Title */}
          <div className="flex flex-col lg:flex-row items-center gap-2 lg:gap-4 w-full lg:w-auto">
            <div className="flex items-center gap-2 lg:gap-3">
              <img
                src="/logo.png"
                alt="P2P Chess Logo"
                className="w-8 h-8 lg:w-10 lg:h-10"
              />
              <h1 className="text-lg lg:text-xl font-bold text-white">
                P2P Chess
              </h1>
            </div>

            {/* Game Mode Indicator */}
            <div className="flex flex-row items-center gap-2 justify-center">
              <span
                className={`px-2 lg:px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                  gameMode === "singlePlayer"
                    ? "bg-gray-600 text-gray-100"
                    : gameMode === "vsEngine"
                    ? "bg-purple-600 text-white"
                    : gameMode === "host"
                    ? "bg-blue-600 text-white"
                    : gameMode === "guest"
                    ? "bg-green-600 text-white"
                    : "bg-gray-600 text-gray-100"
                }`}
              >
                {gameMode === "singlePlayer" && "🎮 Single"}
                {gameMode === "vsEngine" && `🤖 vs AI`}
                {gameMode === "host" && "👑 Host"}
                {gameMode === "guest" && "🎯 Guest"}
              </span>

              {gameState && gameMode !== "singlePlayer" && (
                <span
                  className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                    gameMode === "vsEngine"
                      ? gameState.currentTurn === "white"
                        ? "bg-green-500 text-white animate-pulse"
                        : "bg-gray-500 text-gray-200"
                      : gameState.currentTurn === playerColor
                      ? "bg-green-500 text-white animate-pulse"
                      : "bg-gray-500 text-gray-200"
                  }`}
                >
                  {gameMode === "vsEngine"
                    ? gameState.currentTurn === "white"
                      ? "Your Turn"
                      : "AI..."
                    : gameState.currentTurn === playerColor
                    ? "Your Turn"
                    : "Wait..."}
                </span>
              )}
            </div>
          </div>

          {/* P2P Connection Controls */}
          <div className="flex flex-col lg:flex-row flex-wrap items-center justify-center gap-2 w-full lg:w-auto">
            {!isConnected && !isConnecting && gameMode !== "vsEngine" && (
              <>
                {/* Shared Time Control Dropdown */}
                <select
                  value={selectedTimeControl}
                  onChange={(e) => onTimeControlChange(e.target.value)}
                  disabled={isGameStarted}
                  className={`text-white text-xs lg:text-sm px-2 py-1.5 lg:py-2 rounded-lg border focus:outline-none focus:border-blue-400 transition-colors ${
                    isGameStarted
                      ? "bg-gray-600 border-gray-500 cursor-not-allowed opacity-60"
                      : "bg-slate-700 hover:bg-slate-600 border-slate-600 cursor-pointer"
                  }`}
                  title="Select time control"
                >
                  {Object.entries(TIMER_CONFIG.TIME_CONTROLS).map(
                    ([key, config]) => (
                      <option key={key} value={key}>
                        ⏱️ {config.label}
                      </option>
                    )
                  )}
                </select>

                {/* Engine Mode Button with Difficulty Selector */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => onStartEngineGame(selectedTimeControl)}
                    disabled={isGameStarted}
                    className={`px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-1.5 text-xs lg:text-sm whitespace-nowrap flex-1 sm:flex-initial ${
                      isGameStarted
                        ? "bg-gray-600 cursor-not-allowed opacity-60"
                        : "bg-purple-600 hover:bg-purple-700 text-white"
                    }`}
                    title="Play against AI"
                  >
                    <span>🤖</span>
                    <span>Play vs AI</span>
                  </button>

                  <select
                    value={aiDifficulty}
                    onChange={(e) => onDifficultyChange(e.target.value)}
                    disabled={isGameStarted}
                    className={`text-white text-xs lg:text-sm px-2 py-1.5 lg:py-2 rounded-lg border focus:outline-none focus:border-purple-400 transition-colors ${
                      isGameStarted
                        ? "bg-gray-600 border-gray-500 cursor-not-allowed opacity-60"
                        : "bg-purple-700 hover:bg-purple-800 border-purple-600 cursor-pointer"
                    }`}
                    title="Select AI difficulty"
                  >
                    <option value="EASY">🟢 Easy</option>
                    <option value="MEDIUM">🟡 Medium</option>
                    <option value="HARD">🔴 Hard</option>
                  </select>
                </div>

                {/* Multiplayer Separator */}
                <div className="hidden lg:block w-px h-8 bg-slate-600"></div>

                {/* Multiplayer Start Game Button */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleInitiateCall}
                    disabled={isGameStarted}
                    className={`px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg font-medium transition-colors duration-200 text-xs lg:text-sm whitespace-nowrap ${
                      isGameStarted
                        ? "bg-gray-600 cursor-not-allowed opacity-60"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    Start Game
                  </button>
                </div>

                {/* Join Game Section */}
                <div className="flex items-center gap-2 w-full lg:w-auto">
                  <input
                    type="text"
                    placeholder="Game ID"
                    value={receiverIdInput}
                    onChange={(e) => setReceiverIdInput(e.target.value)}
                    className="bg-slate-700 text-white placeholder-slate-400 px-2 py-1.5 lg:px-3 lg:py-2 rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs lg:text-sm flex-1 min-w-0"
                  />
                  <button
                    onClick={handleAcceptCall}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg font-medium transition-colors duration-200 text-xs lg:text-sm whitespace-nowrap flex-shrink-0"
                  >
                    Join
                  </button>
                </div>
              </>
            )}

            {/* AI Mode Controls - Shown when in vsEngine mode */}
            {gameMode === "vsEngine" && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-2 bg-purple-900/30 rounded-lg px-3 py-1.5 border border-purple-600/50">
                  <span className="text-xs font-medium text-purple-300 whitespace-nowrap">
                    AI:
                  </span>
                  <span className="text-xs font-semibold text-white">
                    {aiDifficulty === "EASY" && "🟢 Easy"}
                    {aiDifficulty === "MEDIUM" && "🟡 Medium"}
                    {aiDifficulty === "HARD" && "🔴 Hard"}
                  </span>
                </div>
              </div>
            )}

            {/* Waiting for Connection */}
            {isConnecting && !isConnected && (
              <div className="flex flex-col items-center gap-2 w-full lg:w-auto lg:flex-row lg:gap-4">
                <div className="text-white text-center lg:text-left w-full lg:w-auto">
                  <span className="text-xs lg:text-sm text-slate-300">
                    Game ID:
                  </span>
                  <div className="flex items-center justify-center lg:justify-start space-x-2 mt-1">
                    <code className="bg-slate-700 px-2 py-1 rounded text-blue-300 font-mono text-xs lg:text-sm overflow-hidden text-ellipsis">
                      {connectionId}
                    </code>
                    <button
                      onClick={copyToClipboard}
                      className="bg-slate-600 hover:bg-slate-500 text-white px-2 py-1 rounded text-xs transition-colors duration-200"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div className="flex items-center text-yellow-400">
                  <div className="animate-spin rounded-full h-3 w-3 lg:h-4 lg:w-4 border-b-2 border-yellow-400 mr-2"></div>
                  <span className="text-xs lg:text-sm">Waiting...</span>
                </div>
                <button
                  onClick={handleCancelCall}
                  className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors duration-200 flex items-center justify-center"
                  title="Cancel connection"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            )}

            {/* Connected State */}
            {isConnected && (
              <div className="flex flex-col lg:flex-row items-center gap-2 lg:gap-4 w-full lg:w-auto">
                <div className="flex items-center text-green-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                  <span className="text-xs lg:text-sm">Connected</span>
                </div>
                <button
                  onClick={() => setShowDebugPanel(!showDebugPanel)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 lg:px-3 lg:py-2 rounded-lg font-medium transition-colors duration-200 text-xs lg:text-sm w-full sm:w-auto"
                >
                  Debug
                </button>
                <button
                  onClick={handleDisconnect}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 lg:px-4 lg:py-2 rounded-lg font-medium transition-colors duration-200 text-xs lg:text-sm w-full sm:w-auto"
                >
                  Disconnect
                </button>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="flex items-center text-red-400">
                <svg
                  className="w-4 h-4 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm">{error}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Debug Panel */}
      {showDebugPanel && isConnected && (
        <div className="bg-slate-900 border-t border-slate-600 px-4 py-4">
          <div className="max-w-7xl mx-auto">
            <h3 className="text-lg font-semibold text-white mb-4">
              WebRTC Debug Panel
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Connection Info */}
              <div className="space-y-3">
                <h4 className="text-md font-medium text-slate-300">
                  Connection Status
                </h4>
                <div className="bg-slate-800 p-3 rounded-lg">
                  <div className="text-sm space-y-1">
                    <div className="text-slate-300">
                      <span className="font-medium">State:</span>
                      <span
                        className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                          connectionState === "connected"
                            ? "bg-green-600 text-white"
                            : connectionState === "connecting"
                            ? "bg-yellow-600 text-white"
                            : connectionState === "failed"
                            ? "bg-red-600 text-white"
                            : "bg-gray-600 text-white"
                        }`}
                      >
                        {connectionState}
                      </span>
                    </div>
                    <div className="text-slate-300">
                      <span className="font-medium">Call ID:</span>
                      <code className="ml-2 text-blue-300 font-mono text-xs">
                        {connectionId}
                      </code>
                    </div>
                  </div>
                </div>

                {/* Test Message Sender */}
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-slate-300">
                    Send Test Message
                  </h5>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Enter test message"
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      className="flex-1 bg-slate-700 text-white placeholder-slate-400 px-3 py-2 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                      onKeyPress={(e) => e.key === "Enter" && sendTestMessage()}
                    />
                    <button
                      onClick={sendTestMessage}
                      disabled={!testMessage.trim()}
                      className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-3 py-2 rounded font-medium transition-colors duration-200 text-sm"
                    >
                      Send
                    </button>
                  </div>
                  <button
                    onClick={sendTestMove}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded font-medium transition-colors duration-200 text-sm"
                  >
                    Send Test Move (e2→e4)
                  </button>
                </div>

                {/* Latency Measurement */}
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-slate-300">
                    Latency Measurement
                  </h5>
                  <div className="bg-slate-800 p-3 rounded-lg">
                    {latency !== null && (
                      <div className="text-center mb-2">
                        <span className="text-2xl font-bold text-green-400">
                          {latency.toFixed(2)} ms
                        </span>
                        <p className="text-xs text-slate-400 mt-1">
                          Current Latency
                        </p>
                      </div>
                    )}
                    <button
                      onClick={handleMeasureLatency}
                      disabled={measuringLatency}
                      className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-3 py-2 rounded font-medium transition-colors duration-200 text-sm flex items-center justify-center gap-2"
                    >
                      {measuringLatency ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Measuring...</span>
                        </>
                      ) : (
                        <>
                          <span>📡</span>
                          <span>Measure Latency</span>
                        </>
                      )}
                    </button>
                    <p className="text-xs text-slate-400 mt-2 text-center">
                      Calculates RTT/2 (one-way latency)
                    </p>
                  </div>
                </div>
              </div>

              {/* Message Log */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-md font-medium text-slate-300">
                    Message Log
                  </h4>
                  <button
                    onClick={() => setMessages([])}
                    className="bg-slate-600 hover:bg-slate-500 text-white px-2 py-1 rounded text-xs transition-colors duration-200"
                  >
                    Clear
                  </button>
                </div>
                <div className="bg-slate-800 p-3 rounded-lg h-48 overflow-y-auto">
                  {messages.length === 0 ? (
                    <div className="text-slate-400 text-sm text-center py-8">
                      No messages yet. Send a test message to see it here.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {messages.map((msg, index) => (
                        <div
                          key={index}
                          className={`text-xs p-2 rounded ${
                            msg.type === "sent"
                              ? "bg-blue-900 text-blue-100"
                              : msg.type === "received"
                              ? "bg-green-900 text-green-100"
                              : msg.type === "system"
                              ? "bg-yellow-900 text-yellow-100"
                              : "bg-gray-900 text-gray-100"
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-medium">
                              {msg.type === "sent"
                                ? "→ Sent"
                                : msg.type === "received"
                                ? "← Received"
                                : msg.type === "system"
                                ? "⚠ System"
                                : "• Unknown"}
                            </span>
                            <span className="text-slate-400">
                              {msg.timestamp}
                            </span>
                          </div>
                          <pre className="text-xs overflow-x-auto">
                            {JSON.stringify(msg.data, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
