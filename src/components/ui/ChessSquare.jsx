"use client";

import React from "react";
import { PIECE_SYMBOLS, isHybridPiece } from "../../utils/constants.js";
import { getSquareStyling, getPieceStyling } from "../helpers/squareStyling.js";

/**
 * ChessSquare component - renders a single square on the chess board
 * Now includes optional rank/file labels rendered INSIDE the square (chess.com style)
 */
const ChessSquare = ({
  row,
  col,
  piece,
  isLightSquare,
  highlightState,
  onClick,
  isBoardFlipped = false,
  rankLabel = null,
  fileLabel = null,
}) => {
  const styling = getSquareStyling(isLightSquare, highlightState);
  const { squareColor, ringClass, opacity, extraEffects } = styling;

  // Check if this is a capture move
  const isCapture =
    highlightState.isLegalMove && piece && !highlightState.combineMode;

  const pieceStyling = piece ? getPieceStyling(piece) : {};
  const pieceColorClass =
    piece && piece === piece.toUpperCase() ? "text-[#EDE8D5]" : "text-gray-900";

  // Coordinate label color: contrasting with the square
  const coordColorClass = isLightSquare
    ? "text-amber-800/70"
    : "text-amber-100/70";

  return (
    <div
      onClick={() => onClick(row, col)}
      className={`chess-square flex items-center justify-center ${squareColor} ${opacity}
                hover:brightness-110 transition-all duration-150 cursor-pointer relative ${ringClass} ${extraEffects} select-none`}
    >
      {/* Rank label - top-left corner of the square */}
      {rankLabel && (
        <span
          className={`board-coord board-coord-rank ${coordColorClass}`}
          style={{
            transform: isBoardFlipped ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          {rankLabel}
        </span>
      )}

      {/* File label - bottom-right corner of the square */}
      {fileLabel && (
        <span
          className={`board-coord board-coord-file ${coordColorClass}`}
          style={{
            transform: isBoardFlipped ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          {fileLabel}
        </span>
      )}

      {piece && (
        <div
          className="relative transform transition-transform pointer-events-none"
          style={{
            transform: isBoardFlipped ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <span
            className={`chess-piece-icon select-none ${pieceColorClass}`}
            style={{
              ...pieceStyling,
              fontFamily:
                "'Noto Sans Symbols 2', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif",
            }}
          >
            {PIECE_SYMBOLS[piece]}
          </span>
          {isHybridPiece(piece) && (
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full border-2 border-white shadow-lg"></div>
          )}
        </div>
      )}
      {/* Indicator for empty legal moves */}
      {highlightState.isLegalMove && !piece && !highlightState.combineMode && (
        <div className="w-3 h-3 sm:w-4 sm:h-4 bg-[var(--accent-primary)] rounded-full opacity-60 pointer-events-none"></div>
      )}
      {/* Indicator for capture moves */}
      {isCapture && (
        <div className="absolute inset-0 border-3 sm:border-4 border-red-500 rounded-sm opacity-60 pointer-events-none"></div>
      )}
    </div>
  );
};

export default ChessSquare;
