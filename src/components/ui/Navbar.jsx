"use client";

import React, { useState, useRef, useEffect } from "react";
import { TIMER_CONFIG } from "../../config/timerConfig";

/**
 * Dropdown component for navbar
 */
const NavDropdown = ({ label, value, options, onChange, disabled = false, icon = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded
          transition-colors duration-150
          ${disabled 
            ? "opacity-50 cursor-not-allowed bg-[var(--bg-tertiary)]" 
            : "hover:bg-[var(--bg-elevated)] cursor-pointer"
          }
          ${isOpen ? "bg-[var(--bg-elevated)]" : ""}
        `}
      >
        {icon && <span className="text-base">{icon}</span>}
        <span className="text-[var(--text-primary)]">{selectedOption?.label || label}</span>
        <svg 
          className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform ${isOpen ? "rotate-180" : ""}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 mt-1 min-w-[140px] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md shadow-lg z-50 py-1">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`
                w-full px-3 py-1.5 text-left text-sm transition-colors
                ${value === option.value 
                  ? "bg-[var(--accent-primary)] text-white" 
                  : "text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                }
              `}
            >
              {option.icon && <span className="mr-2">{option.icon}</span>}
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const Navbar = ({
  webRTC,
  gameState,
  onStartEngineGame,
  aiDifficulty,
  onDifficultyChange,
  selectedTimeControl,
  onTimeControlChange,
  isGameStarted = false,
  onOpenHelp = null,
  highlightTarget = null,
  onClearHighlight = null,
}) => {
  const [receiverIdInput, setReceiverIdInput] = useState("");
  const [showCopied, setShowCopied] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  } = webRTC;

  // Track previous connection state to handle automatic input clearing
  const wasConnectedRef = useRef(false);

  useEffect(() => {
    if (isConnected) {
      wasConnectedRef.current = true;
    } else if (wasConnectedRef.current) {
      // We were connected, now we are not (disconnected/left)
      setReceiverIdInput("");
      wasConnectedRef.current = false;
    }
  }, [isConnected]);

  // Fallback for failed attempts
  useEffect(() => {
    if (
      connectionState === "disconnected" ||
      connectionState === "failed" ||
      connectionState === "closed"
    ) {
      const resetTimer = setTimeout(() => {
        setReceiverIdInput("");
      }, 1000);
      return () => clearTimeout(resetTimer);
    }
  }, [connectionState]);

  // React to highlightTarget prop: open mobile menu and auto-clear after 2s
  useEffect(() => {
    if (highlightTarget) {
      setMobileMenuOpen(true);
      const timer = setTimeout(() => {
        onClearHighlight?.();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [highlightTarget, onClearHighlight]);

  const handleInitiateCall = async () => {
    try {
      await createCall();
    } catch (err) {
      console.error("Failed to create call:", err);
    }
  };

  const handleAcceptCall = async () => {
    if (!receiverIdInput.trim()) return;
    try {
      await joinCall(receiverIdInput.trim());
    } catch (err) {
      console.error("Failed to join call:", err);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setReceiverIdInput("");
    } catch (err) {
      console.error("Failed to disconnect:", err);
    }
  };

  const handleCancelCall = async () => {
    try {
      await cancelCall();
    } catch (err) {
      console.error("Failed to cancel call:", err);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(connectionId);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  // Time control options
  const timeControlOptions = Object.entries(TIMER_CONFIG.TIME_CONTROLS).map(
    ([key, config]) => ({
      value: key,
      label: config.label,
      icon: "⏱️",
    })
  );

  // AI difficulty options
  const difficultyOptions = [
    { value: "EASY", label: "Easy", icon: "🟢" },
    { value: "MEDIUM", label: "Medium", icon: "🟡" },
    { value: "HARD", label: "Hard", icon: "🔴" },
  ];

  // Game mode badge
  const getModeBadge = () => {
    const badges = {
      singlePlayer: { text: "Local", color: "bg-gray-600" },
      vsEngine: { text: "vs AI", color: "bg-purple-600" },
      host: { text: "Host", color: "bg-blue-600" },
      guest: { text: "Guest", color: "bg-green-600" },
    };
    const badge = badges[gameMode] || badges.singlePlayer;
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded ${badge.color} text-white`}>
        {badge.text}
      </span>
    );
  };

  // Turn indicator
  const getTurnIndicator = () => {
    if (gameMode === "singlePlayer") return null;
    
    const isMyTurn = gameMode === "vsEngine" 
      ? gameState?.currentTurn === "white"
      : gameState?.currentTurn === playerColor;

    return (
      <span className={`
        px-2 py-0.5 text-xs font-medium rounded
        ${isMyTurn 
          ? "bg-[var(--accent-primary)] text-white" 
          : "bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
        }
      `}>
        {isMyTurn ? "Your turn" : "Waiting..."}
      </span>
    );
  };

  return (
    <nav className="flex flex-col bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
      <div className="h-12 flex items-center px-3 lg:px-4">
        <div className="flex items-center justify-between w-full max-w-screen-2xl mx-auto">
        {/* Left section: Logo + Mode */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="P2P Chess"
              className="w-7 h-7"
            />
            <span className="text-base font-semibold text-[var(--text-primary)] hidden sm:inline">
              P2P Chess
            </span>
          </div>
          
          <div className="hidden sm:block w-px h-5 bg-[var(--border-color)]" />
          
          <div className="flex items-center gap-2">
            {getModeBadge()}
            {getTurnIndicator()}
          </div>

          {/* Help button - always visible */}
          <button
            onClick={onOpenHelp}
            className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-[var(--bg-elevated)] transition-colors text-[var(--text-muted)] hover:text-[var(--accent-primary)]"
            title="How to Play"
            aria-label="How to Play"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>

        {/* Desktop: Center/Right controls */}
        <div className="hidden lg:flex items-center gap-1">
          {/* Pre-game controls */}
          {!isConnected && !isConnecting && gameMode !== "vsEngine" && (
            <>
              {/* Time Control */}
              <NavDropdown
                label="Time"
                value={selectedTimeControl}
                options={timeControlOptions}
                onChange={onTimeControlChange}
                disabled={isGameStarted}
                icon="⏱️"
              />

              <div className="w-px h-5 bg-[var(--border-color)] mx-1" />

              {/* AI Game */}
              <button
                id="play-ai-btn"
                onClick={() => onStartEngineGame(selectedTimeControl)}
                disabled={isGameStarted}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 text-sm rounded font-medium
                  transition-colors duration-150
                  ${isGameStarted 
                    ? "opacity-50 cursor-not-allowed bg-[var(--bg-tertiary)] text-[var(--text-muted)]" 
                    : "bg-purple-600 hover:bg-purple-700 text-white"
                  } focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[var(--bg-secondary)]
                `}
              >
                <span>🤖</span>
                <span>Play AI</span>
              </button>

              <NavDropdown
                label="Difficulty"
                value={aiDifficulty}
                options={difficultyOptions}
                onChange={onDifficultyChange}
                disabled={isGameStarted}
              />

              <div className="w-px h-5 bg-[var(--border-color)] mx-1" />

              {/* Multiplayer */}
              <button
                id="create-game-btn"
                onClick={handleInitiateCall}
                disabled={isGameStarted}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 text-sm rounded font-medium
                  transition-colors duration-150
                  ${isGameStarted 
                    ? "opacity-50 cursor-not-allowed bg-[var(--bg-tertiary)] text-[var(--text-muted)]" 
                    : "bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white"
                  } focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[var(--bg-secondary)]
                `}
              >
                <span>🎮</span>
                <span>Create Game</span>
              </button>

              <div className="flex items-center gap-1.5 ml-1">
                <input
                  type="text"
                  placeholder="Enter Game ID"
                  value={receiverIdInput}
                  onChange={(e) => setReceiverIdInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAcceptCall()}
                  className="w-36 px-2.5 py-1.5 text-sm bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
                <button
                  onClick={handleAcceptCall}
                  disabled={!receiverIdInput.trim()}
                  className="px-3 py-1.5 text-sm rounded font-medium bg-[var(--bg-elevated)] hover:bg-[var(--border-light)] text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Join
                </button>
              </div>
            </>
          )}

          {/* AI Mode indicator */}
          {gameMode === "vsEngine" && (
            <div className="flex items-center gap-2 px-3 py-1 bg-purple-900/30 rounded border border-purple-600/30">
              <span className="text-sm text-purple-300">Playing vs AI</span>
              <span className="text-xs px-1.5 py-0.5 bg-purple-600 rounded text-white">
                {aiDifficulty}
              </span>
            </div>
          )}

          {/* Waiting for connection */}
          {isConnecting && !isConnected && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-secondary)]">Game ID:</span>
                <code className="px-2 py-1 bg-[var(--bg-tertiary)] rounded text-sm font-mono text-[var(--accent-info)]">
                  {connectionId}
                </code>
                <button
                  onClick={copyToClipboard}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    showCopied
                      ? "bg-[var(--accent-primary)] text-white"
                      : "bg-[var(--bg-elevated)] hover:bg-[var(--border-light)] text-[var(--text-primary)]"
                  }`}
                >
                  {showCopied ? "✓" : "Copy"}
                </button>
              </div>
              <div className="flex items-center gap-2 text-yellow-500">
                <div className="w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Waiting...</span>
              </div>
              <button
                onClick={handleCancelCall}
                className="p-1.5 rounded hover:bg-[var(--bg-elevated)] text-[var(--accent-danger)]"
                title="Cancel"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Connected state */}
          {isConnected && (
            <div className="flex items-center gap-3">
              {/* Timer dropdown for rematch */}
              {gameState?.gameStatus?.isGameOver && (
                <NavDropdown
                  label="Time"
                  value={selectedTimeControl}
                  options={timeControlOptions}
                  onChange={onTimeControlChange}
                  icon="⏱️"
                />
              )}
              <div className="flex items-center gap-2 text-[var(--accent-primary)]">
                <div className="w-2 h-2 bg-[var(--accent-primary)] rounded-full" />
                <span className="text-sm font-medium">Connected</span>
              </div>
              <button
                onClick={handleDisconnect}
                className="px-3 py-1.5 text-sm rounded font-medium bg-[var(--accent-danger)] hover:bg-red-700 text-white transition-colors"
              >
                Leave
              </button>
            </div>
          )}
        </div>

        {/* Mobile: Hamburger menu */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-primary)]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>
    </div>

      {/* Mobile dropdown menu - Pushes content down */}
      {mobileMenuOpen && (
        <div className="lg:hidden w-full border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <div className="p-3 space-y-3">
            {/* Pre-game controls for mobile */}
            {!isConnected && !isConnecting && gameMode !== "vsEngine" && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
                    Time Control
                  </label>
                  <select
                    value={selectedTimeControl}
                    onChange={(e) => onTimeControlChange(e.target.value)}
                    disabled={isGameStarted}
                    className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm"
                  >
                    {timeControlOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.icon} {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    id="mobile-play-ai-btn"
                    onClick={() => {
                      onStartEngineGame(selectedTimeControl);
                      setMobileMenuOpen(false);
                    }}
                    disabled={isGameStarted}
                    className={`flex-1 px-3 py-2 text-sm rounded font-medium bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 transition-all duration-300 ${
                      highlightTarget === 'play-ai' ? 'ring-2 ring-white ring-offset-2 ring-offset-[var(--bg-secondary)] animate-pulse' : ''
                    }`}
                  >
                    🤖 Play AI
                  </button>
                  <select
                    value={aiDifficulty}
                    onChange={(e) => onDifficultyChange(e.target.value)}
                    disabled={isGameStarted}
                    className="px-2 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm"
                  >
                    {difficultyOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.icon} {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="h-px bg-[var(--border-color)]" />

                <button
                  id="mobile-create-game-btn"
                  onClick={() => {
                    handleInitiateCall();
                  }}
                  disabled={isGameStarted}
                  className={`w-full px-3 py-2 text-sm rounded font-medium bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white disabled:opacity-50 transition-all duration-300 ${
                    highlightTarget === 'create-game' ? 'ring-2 ring-white ring-offset-2 ring-offset-[var(--bg-secondary)] animate-pulse' : ''
                  }`}
                >
                  🎮 Create Multiplayer Game
                </button>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter Game ID"
                    value={receiverIdInput}
                    onChange={(e) => setReceiverIdInput(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                  />
                  <button
                    onClick={() => {
                      handleAcceptCall();
                    }}
                    disabled={!receiverIdInput.trim()}
                    className="px-4 py-2 text-sm rounded font-medium bg-[var(--bg-elevated)] hover:bg-[var(--border-light)] text-[var(--text-primary)] disabled:opacity-50"
                  >
                    Join
                  </button>
                </div>
              </>
            )}

            {/* Waiting state for mobile */}
            {isConnecting && !isConnected && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">Game ID:</span>
                  <div className="flex items-center gap-2">
                    <code className="px-2 py-1 bg-[var(--bg-tertiary)] rounded text-xs font-mono text-[var(--accent-info)]">
                      {connectionId}
                    </code>
                    <button
                      onClick={copyToClipboard}
                      className={`px-2 py-1 text-xs rounded ${
                        showCopied ? "bg-[var(--accent-primary)] text-white" : "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                      }`}
                    >
                      {showCopied ? "✓" : "Copy"}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-yellow-500">
                    <div className="w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Waiting for opponent...</span>
                  </div>
                  <button
                    onClick={() => {
                      handleCancelCall();
                      setMobileMenuOpen(false);
                    }}
                    className="px-3 py-1.5 text-sm rounded bg-[var(--accent-danger)] text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Connected state for mobile */}
            {isConnected && (
              <div className="flex flex-col gap-3">
                {/* Timer dropdown for rematch on mobile */}
                {gameState?.gameStatus?.isGameOver && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
                      Next Game Time
                    </label>
                    <select
                      value={selectedTimeControl}
                      onChange={(e) => onTimeControlChange(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm"
                    >
                      {timeControlOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.icon} {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[var(--accent-primary)]">
                    <div className="w-2 h-2 bg-[var(--accent-primary)] rounded-full" />
                    <span className="text-sm font-medium">Connected</span>
                  </div>
                  <button
                    onClick={() => {
                      handleDisconnect();
                      setMobileMenuOpen(false);
                    }}
                    className="px-3 py-1.5 text-sm rounded font-medium bg-[var(--accent-danger)] text-white"
                  >
                    Leave Game
                  </button>
                </div>
              </div>
            )}

            {/* AI mode indicator for mobile */}
            {gameMode === "vsEngine" && (
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-purple-300">Playing vs AI</span>
                <span className="text-xs px-2 py-0.5 bg-purple-600 rounded text-white">
                  {aiDifficulty}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
