"use client";

import React from "react";
import ChessSquare from "./ChessSquare.jsx";

/**
 * Component that renders the 8x8 chess board grid with coordinates
 * INSIDE the squares (like chess.com) for maximum board size on small screens.
 * 
 * - File letters (a-h) appear in the bottom-row squares
 * - Rank numbers (1-8) appear in the left-column squares
 * - Both labels share the same square (bottom-left corner gets both)
 */
const BoardGrid = ({
  gameState,
  isBoardFlipped,
  // Selection/highlight functions
  isSelected,
  isLegalMoveSquare,
  // Combine mode
  isEligibleForCombine,
  isEligiblePartner,
  isCombineAnchor,
  combineMode,
  combineAnchor,
  // De-combine mode
  isEligibleForDeCombine,
  isSelectedHybrid,
  isSpawnSquare,
  isSelectedSpawnSquare,
  deCombine,
  // Event handlers
  handleSquareClick,
}) => {
  const files = isBoardFlipped
    ? ["h", "g", "f", "e", "d", "c", "b", "a"]
    : ["a", "b", "c", "d", "e", "f", "g", "h"];

  const ranks = isBoardFlipped
    ? [1, 2, 3, 4, 5, 6, 7, 8]
    : [8, 7, 6, 5, 4, 3, 2, 1];

  return (
    <div className="flex flex-col items-center">
      {/* Board with coordinates INSIDE squares (chess.com style) */}
      <div
        className="grid grid-cols-8 gap-0 overflow-hidden"
        style={{
          transform: isBoardFlipped ? "rotate(180deg)" : "rotate(0deg)",
          willChange: "transform",
          aspectRatio: "1 / 1",
          gridAutoRows: "1fr",
        }}
      >
        {gameState.board.map((row, rowIndex) =>
          row.map((piece, colIndex) => {
            const isLightSquare = (rowIndex + colIndex) % 2 === 0;

            // When flipped 180deg, index 7 becomes the visual left edge, and index 0 becomes the visual bottom edge
            // Show rank label on the visual left edge
            const isFirstCol = isBoardFlipped ? colIndex === 7 : colIndex === 0;
            // Show file label on the visual bottom edge
            const isLastRow = isBoardFlipped ? rowIndex === 0 : rowIndex === 7;

            // Get the rank number for this row
            // Row 0 = rank 8, Row 7 = rank 1 (standard orientation)
            // When flipped, CSS transform handles it, so labels rotate with the board
            const rankLabel = isFirstCol ? (8 - rowIndex).toString() : null;
            const fileLabel = isLastRow ? String.fromCharCode(97 + colIndex) : null;

            // Last move highlighting logic
            let isLastMoveSource = false;
            let isLastMoveTarget = false;

            const lastMove =
              gameState.moveHistory.length > 0
                ? gameState.moveHistory[gameState.moveHistory.length - 1]
                : null;

            if (lastMove) {
              if (lastMove.type === "castle") {
                // TODO: Highlight castling squares if desired
              } else if (lastMove.type === "combination") {
                if (
                  lastMove.placement.row === rowIndex &&
                  lastMove.placement.col === colIndex
                ) {
                  isLastMoveTarget = true;
                }
              } else if (lastMove.type === "de-combine") {
                if (
                  lastMove.selectedSquare.row === rowIndex &&
                  lastMove.selectedSquare.col === colIndex
                ) {
                  isLastMoveTarget = true;
                }
                if (
                  lastMove.hybridSquare.row === rowIndex &&
                  lastMove.hybridSquare.col === colIndex
                ) {
                  isLastMoveSource = true;
                }
              } else if (lastMove.from && lastMove.to) {
                if (
                  lastMove.from.row === rowIndex &&
                  lastMove.from.col === colIndex
                ) {
                  isLastMoveSource = true;
                }
                if (
                  lastMove.to.row === rowIndex &&
                  lastMove.to.col === colIndex
                ) {
                  isLastMoveTarget = true;
                }
              }
            }

            const highlightState = {
              selected: isSelected(rowIndex, colIndex),
              isLegalMove: isLegalMoveSquare(rowIndex, colIndex),
              eligible: isEligibleForCombine(rowIndex, colIndex),
              partner: isEligiblePartner(rowIndex, colIndex),
              anchor: isCombineAnchor(rowIndex, colIndex),
              eligibleHybrid: isEligibleForDeCombine(rowIndex, colIndex),
              hybridSelected: isSelectedHybrid(rowIndex, colIndex),
              spawnSquare: isSpawnSquare(rowIndex, colIndex),
              spawnSelected: isSelectedSpawnSquare(rowIndex, colIndex),
              combineMode,
              hasAnchor: !!combineAnchor,
              isLocalCombine: combineMode && !!combineAnchor,
              deCombineMode: deCombine.mode,
              hasActiveHybrid: !!deCombine.activeHybrid,
              isLocalDeCombine: deCombine.isLocalMode,
              isLastMoveSource,
              isLastMoveTarget,
            };

            return (
              <ChessSquare
                key={`${rowIndex}-${colIndex}`}
                row={rowIndex}
                col={colIndex}
                piece={piece}
                isLightSquare={isLightSquare}
                highlightState={highlightState}
                onClick={handleSquareClick}
                isBoardFlipped={isBoardFlipped}
                rankLabel={rankLabel}
                fileLabel={fileLabel}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

export default BoardGrid;
