"use client";

import React from "react";

/**
 * Footer component - Responsive footer for all screen sizes
 * Contains: Logo, contact emails, social links, extra fields, copyright
 */
const Footer = ({ onOpenHelp = null, onHighlightNavbar = null }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer-container bg-[var(--bg-secondary)] border-t border-[var(--border-color)]">
      <div className="footer-content">
        {/* Top section: Logo + About */}
        <div className="footer-section footer-brand">
          <div className="footer-logo-row">
            <img
              src="/logo.png"
              alt="Combine Chess"
              className="footer-logo"
            />
            <span className="footer-logo-text">Combine Chess</span>
          </div>
          <p className="footer-description">
            An chess variant where you can merge and split pieces.
            Play against AI or challenge friends in real-time multiplayer.
          </p>
        </div>

        {/* Quick Links */}
        <div className="footer-section">
          <h3 className="footer-heading">Quick Links</h3>
          <ul className="footer-links">
            <li>
              <a href="https://combinechess.games" className="footer-link">
                🏠 Home
              </a>
            </li>
            <li>
              <button
                onClick={() => onOpenHelp?.(0)}
                className="footer-link footer-link-btn"
              >
                ❓ How to Play
              </button>
            </li>
            <li>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-link"
              >
                {/* ⭐ GitHub */}
              </a>
            </li>
          </ul>
        </div>

        {/* Game Features */}
        <div className="footer-section">
          <h3 className="footer-heading">Features</h3>
          <ul className="footer-links">
            <li>
              <button
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                  onHighlightNavbar?.('play-ai');
                }}
                className="footer-link footer-link-btn"
              >
                <span className="footer-feature">🤖 AI Engine</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                  onHighlightNavbar?.('create-game');
                }}
                className="footer-link footer-link-btn"
              >
                <span className="footer-feature">🎮 P2P Multiplayer</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => onOpenHelp?.(1)}
                className="footer-link footer-link-btn"
              >
                <span className="footer-feature">🔮 Piece Merging</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => onOpenHelp?.(2)}
                className="footer-link footer-link-btn"
              >
                <span className="footer-feature">⚡ Piece Splitting</span>
              </button>
            </li>
          </ul>
        </div>

        {/* Contact Section */}
        <div className="footer-section">
          <h3 className="footer-heading">Contact Us</h3>
          <ul className="footer-links">
            <li>
              <a
                href="mailto:aadish.jinesh.jain@gmail.com"
                className="footer-link"
              >
                <svg className="footer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <span className="footer-email-text">aadish.jinesh.jain@gmail.com</span>
              </a>
            </li>
            <li>
              <a
                href="mailto:adityakshitiz2017@gmail.com"
                className="footer-link"
              >
                <svg className="footer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <span className="footer-email-text">adityakshitiz2017@gmail.com</span>
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="footer-bottom">
        <div className="footer-bottom-content">
          <span className="footer-copyright">
            © {currentYear} Combine Chess. All rights reserved.
          </span>
          <div className="footer-bottom-links">
            <a href="#" className="footer-bottom-link">Privacy Policy</a>
            <span className="footer-dot">•</span>
            <a href="#" className="footer-bottom-link">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
