"use client";

import React from "react";
import ChessSquare from "./ChessSquare.jsx";

/**
 * Component that renders the 8x8 chess board grid with coordinates
 * INSIDE the squares (like chess.com) for maximum board size on small screens.
 * 
 * Instead of CSS rotate(180deg) to flip the board, we reverse the iteration
 * order of rows and columns. This keeps all CSS positioning (label anchors,
 * piece styling, etc.) working identically in both orientations.
 * 
 * - File letters (a-h) appear in the bottom-row squares
 * - Rank numbers (1-8) appear in the left-column squares
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
  // Build the visual row/col order.
  // Normal (white):  rows 0→7, cols 0→7  (rank 8 at top, file 'a' at left)
  // Flipped (black): rows 7→0, cols 7→0  (rank 1 at top, file 'h' at left)
  const rowOrder = isBoardFlipped
    ? [7, 6, 5, 4, 3, 2, 1, 0]
    : [0, 1, 2, 3, 4, 5, 6, 7];

  const colOrder = isBoardFlipped
    ? [7, 6, 5, 4, 3, 2, 1, 0]
    : [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="flex flex-col items-center">
      {/* Board with coordinates INSIDE squares (chess.com style) */}
      <div
        className="grid grid-cols-8 gap-0 overflow-hidden"
        style={{
          aspectRatio: "1 / 1",
          gridAutoRows: "1fr",
        }}
      >
        {rowOrder.map((rowIndex, visualRowIdx) =>
          colOrder.map((colIndex, visualColIdx) => {
            const piece = gameState.board[rowIndex][colIndex];
            const isLightSquare = (rowIndex + colIndex) % 2 === 0;

            // Labels always on the visual left column and visual bottom row.
            // Since we control iteration order, visualRowIdx/visualColIdx give
            // us the screen position directly — no CSS rotation to worry about.
            const isLeftEdge = visualColIdx === 0;
            const isBottomEdge = visualRowIdx === 7;

            // Rank = 8 - rowIndex (row 0 in the array is always rank 8)
            const rankLabel = isLeftEdge ? (8 - rowIndex).toString() : null;
            // File = 'a' + colIndex (col 0 in the array is always file 'a')
            const fileLabel = isBottomEdge
              ? String.fromCharCode(97 + colIndex)
              : null;

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
                isBoardFlipped={false}
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
