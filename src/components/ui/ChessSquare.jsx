import React from "react";
import { PIECE_SYMBOLS, isHybridPiece } from "../../utils/constants.js";
import { getSquareStyling, getPieceStyling } from "../helpers/squareStyling.js";

/**
 * ChessSquare component - renders a single square on the chess board
 * Memoized to prevent unnecessary re-renders when parent components update
 */
const ChessSquare = React.memo(({
  row,
  col,
  piece,
  isLightSquare,
  highlightState,
  onClick,
  isBoardFlipped = false,
}) => {
  const styling = getSquareStyling(isLightSquare, highlightState);
  const { squareColor, ringClass, opacity, extraEffects } = styling;

  // Check if this is a capture move
  const isCapture =
    highlightState.isLegalMove && piece && !highlightState.combineMode;

  const pieceStyling = piece ? getPieceStyling(piece) : {};
  const pieceColorClass =
    piece && piece === piece.toUpperCase() ? "text-white" : "text-gray-900";

  return (
    <div
      onClick={() => onClick(row, col)}
      className={`w-8 h-8 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 flex items-center justify-center ${squareColor} ${opacity}
                hover:brightness-110 hover:scale-105 transition-all duration-200 cursor-pointer relative ${ringClass} ${extraEffects}`}
    >
      {piece && (
        <div
          className="relative transform transition-transform hover:scale-110"
          style={{
            transform: isBoardFlipped ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <span
            className={`text-2xl sm:text-4xl md:text-4xl lg:text-5xl select-none ${pieceColorClass}`}
            style={pieceStyling}
          >
            {PIECE_SYMBOLS[piece]}
          </span>
          {isHybridPiece(piece) && (
            <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-2 h-2 sm:w-3 sm:h-3 md:w-4 md:h-4 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full border-2 border-white shadow-lg animate-pulse"></div>
          )}
        </div>
      )}
      {/* Indicator for empty legal moves */}
      {highlightState.isLegalMove && !piece && !highlightState.combineMode && (
        <div className="w-2.5 h-2.5 sm:w-4 sm:h-4 md:w-5 md:h-5 bg-green-400 rounded-full opacity-70 shadow-lg animate-pulse"></div>
      )}
      {/* Indicator for capture moves */}
      {isCapture && (
        <div className="absolute inset-0 border-2 sm:border-3 md:border-4 border-red-500 rounded opacity-60 pointer-events-none animate-pulse shadow-inner"></div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  // Only re-render if these props actually change
  return (
    prevProps.row === nextProps.row &&
    prevProps.col === nextProps.col &&
    prevProps.piece === nextProps.piece &&
    prevProps.isLightSquare === nextProps.isLightSquare &&
    prevProps.isBoardFlipped === nextProps.isBoardFlipped &&
    prevProps.highlightState.isSelected === nextProps.highlightState.isSelected &&
    prevProps.highlightState.isLegalMove === nextProps.highlightState.isLegalMove &&
    prevProps.highlightState.combineMode === nextProps.highlightState.combineMode &&
    prevProps.highlightState.eligibleForCombine === nextProps.highlightState.eligibleForCombine &&
    prevProps.highlightState.eligiblePartner === nextProps.highlightState.eligiblePartner &&
    prevProps.highlightState.combineAnchor === nextProps.highlightState.combineAnchor &&
    prevProps.highlightState.deCombineMode === nextProps.highlightState.deCombineMode &&
    prevProps.highlightState.eligibleForDeCombine === nextProps.highlightState.eligibleForDeCombine &&
    prevProps.highlightState.selectedHybrid === nextProps.highlightState.selectedHybrid &&
    prevProps.highlightState.spawnSquare === nextProps.highlightState.spawnSquare &&
    prevProps.highlightState.selectedSpawnSquare === nextProps.highlightState.selectedSpawnSquare
  );
});

ChessSquare.displayName = 'ChessSquare';

export default ChessSquare;
