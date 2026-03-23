"use client";

import React, { useState, useEffect, useCallback } from "react";

/**
 * HelpModal - Accessible help modal that explains game mechanics
 * Consistent with website UI, responsive across all devices/orientations
 */
const HelpModal = ({ isOpen, onClose, initialTab = 0 }) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const tabs = [
    {
      title: "Basics",
      icon: "♟️",
      content: (
        <div className="help-tab-content">
          <h3 className="help-section-title">How to Play</h3>
          <ul className="help-list">
            <li><strong>Click</strong> a piece to select it, then click a highlighted square to move.</li>
            <li>Green dots show <strong>legal moves</strong>.</li>
            <li>Red borders show <strong>capture moves</strong>.</li>
            <li>Yellow highlight shows the <strong>last move</strong> made.</li>
          </ul>

          <h3 className="help-section-title">Game Modes</h3>
          <ul className="help-list">
            <li><strong>Local:</strong> Two players on the same device, take turns.</li>
            <li><strong>vs AI:</strong> Play against the computer. Choose Easy, Medium, or Hard.</li>
            <li><strong>Multiplayer:</strong> Create a game or join with a Game ID for real-time P2P play.</li>
          </ul>
        </div>
      ),
    },
    {
      title: "Combine",
      icon: "🔮",
      content: (
        <div className="help-tab-content">
          <h3 className="help-section-title">Merging Pieces</h3>
          <p className="help-text">
            Combine two pieces into a powerful hybrid that moves like both!
          </p>
          <ul className="help-list">
            <li><strong>Double-tap</strong> a piece or use the <span className="help-key">🔮 Combine</span> button.</li>
            <li>Purple-highlighted squares show eligible partners.</li>
            <li>Click a partner to merge.</li>
            <li><strong>Placement Rule:</strong> The new hybrid piece will be placed on the square of the <strong>higher-value piece</strong>. If both pieces have the same value (e.g., Bishop and Knight), the hybrid remains on the <strong>first piece's square</strong>.</li>
          </ul>

          <h3 className="help-section-title">Valid Combinations</h3>
          <div className="help-combos">
            <div className="help-combo-item">
              <span className="help-combo-formula">♜ + ♞ = 🩒</span>
              <span className="help-combo-desc">Rook + Knight</span>
            </div>
            <div className="help-combo-item">
              <span className="help-combo-formula">♝ + ♞ = 🩓</span>
              <span className="help-combo-desc">Bishop + Knight</span>
            </div>
            <div className="help-combo-item">
              <span className="help-combo-formula">♜ + ♝ = ⚔</span>
              <span className="help-combo-desc">Rook + Bishop</span>
            </div>
            <div className="help-combo-item">
              <span className="help-combo-formula">♛ + ♞ = 🩑</span>
              <span className="help-combo-desc">Queen + Knight</span>
            </div>
          </div>

          <div className="help-note">
            <strong>Rule:</strong> Pieces must be able to reach each other in one legal move to combine. Cannot combine while in check.
          </div>
        </div>
      ),
    },
    {
      title: "Split",
      icon: "⚡",
      content: (
        <div className="help-tab-content">
          <h3 className="help-section-title">Splitting Pieces</h3>
          <p className="help-text">
            Split a hybrid piece back into its two components for tactical advantage!
          </p>
          <ul className="help-list">
            <li><strong>Double-tap</strong> a hybrid piece or use the <span className="help-key">⚡ Split</span> button.</li>
            <li>Teal highlight shows the selected hybrid.</li>
            <li>Green squares show where the spawned piece can go (must be an adjacent empty square).</li>
            <li><strong>Split Rule:</strong> By default, the <strong>higher-value component</strong> of the hybrid stays on the original square, and the <strong>lower-value component</strong> moves to the new green square you select (for equal values like Bishop and Knight, the Bishop stays).</li>
            <li><em>Example:</em> Whether it's called a Queen-Knight or a Knight-Queen hybrid, the <strong>Queen</strong> is the higher-value piece. When split, the <strong>Queen</strong> stays on the original square, and the <strong>Knight</strong> leaps to the adjacent green square you clicked.</li>
          </ul>

          <div className="help-note">
            <strong>Tip:</strong> Splitting is a free action — use it to create surprise attacks or defend multiple squares at once!
          </div>
        </div>
      ),
    },
    {
      title: "Controls",
      icon: "🎮",
      content: (
        <div className="help-tab-content">
          <h3 className="help-section-title">Game Controls</h3>
          <div className="help-controls-grid">
            <div className="help-control-item">
              <span className="help-control-icon">↩️</span>
              <div>
                <strong>Undo</strong>
                <p className="help-control-desc">Take back your last move (Local mode only)</p>
              </div>
            </div>
            <div className="help-control-item">
              <span className="help-control-icon">↪️</span>
              <div>
                <strong>Redo</strong>
                <p className="help-control-desc">Re-apply an undone move</p>
              </div>
            </div>
            <div className="help-control-item">
              <span className="help-control-icon">🔮</span>
              <div>
                <strong>Combine</strong>
                <p className="help-control-desc">Enter combine mode to merge pieces</p>
              </div>
            </div>
            <div className="help-control-item">
              <span className="help-control-icon">⚡</span>
              <div>
                <strong>Split</strong>
                <p className="help-control-desc">Enter split mode to separate hybrids</p>
              </div>
            </div>
            <div className="help-control-item">
              <span className="help-control-icon">🔄</span>
              <div>
                <strong>Reset</strong>
                <p className="help-control-desc">Start a new game</p>
              </div>
            </div>
            <div className="help-control-item">
              <span className="help-control-icon">🏳️</span>
              <div>
                <strong>Resign</strong>
                <p className="help-control-desc">Forfeit the current game (Multiplayer)</p>
              </div>
            </div>
          </div>

          <h3 className="help-section-title">Keyboard Shortcuts</h3>
          <ul className="help-list">
            <li><span className="help-key">Esc</span> — Exit Combine/Split mode</li>
          </ul>
        </div>
      ),
    },
    {
      title: "Timer",
      icon: "⏱️",
      content: (
        <div className="help-tab-content">
          <h3 className="help-section-title">Time Controls</h3>
          <p className="help-text">
            Timers are active in AI and Multiplayer modes. Choose your time control before starting.
          </p>
          <ul className="help-list">
            <li><strong>1 min</strong> — Bullet: fast-paced, intense games</li>
            <li><strong>3 min</strong> — Blitz: quick but with time to think</li>
            <li><strong>5 min</strong> — Rapid: balanced time for strategy</li>
            <li><strong>10 min</strong> — Classical: plenty of time for deep play</li>
            <li><strong>15 min</strong> — Extended Rapid: deeper planning with room for calculation</li>
            <li><strong>30 min</strong> — Long Classical: slow-paced, highly strategic gameplay</li>
          </ul>

          <div className="help-note">
            <strong>Note:</strong> If your time runs out, you lose! Keep an eye on the timer above/below the board.
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="help-overlay" onClick={onClose}>
      <div
        className="help-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="How to Play"
      >
        {/* Header */}
        <div className="help-header">
          <h2 className="help-title">
            <span className="help-title-icon">📖</span>
            How to Play
          </h2>
          <button
            onClick={onClose}
            className="help-close-btn"
            aria-label="Close help"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="help-tabs">
          {tabs.map((tab, index) => (
            <button
              key={tab.title}
              onClick={() => setActiveTab(index)}
              className={`help-tab ${activeTab === index ? "help-tab-active" : ""}`}
            >
              <span className="help-tab-icon">{tab.icon}</span>
              <span className="help-tab-label">{tab.title}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="help-body">
          {tabs[activeTab].content}
        </div>

        {/* Footer */}
        <div className="help-footer">
          <div className="help-footer-nav">
            <button
              onClick={() => setActiveTab(Math.max(0, activeTab - 1))}
              disabled={activeTab === 0}
              className="help-nav-btn"
            >
              ← Previous
            </button>
            <span className="help-page-indicator">
              {activeTab + 1} / {tabs.length}
            </span>
            <button
              onClick={() => setActiveTab(Math.min(tabs.length - 1, activeTab + 1))}
              disabled={activeTab === tabs.length - 1}
              className="help-nav-btn"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
