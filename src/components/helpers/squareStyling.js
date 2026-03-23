/**
 * Square styling helper - determines colors and effects based on game state
 */

/**
 * Get square styling based on game mode and state
 * @param {boolean} isLightSquare - Whether the square is light colored
 * @param {object} highlightState - Object containing highlight flags
 * @returns {object} - Object with squareColor, ringClass, opacity, and extraEffects
 */
export const getSquareStyling = (isLightSquare, highlightState) => {
  const {
    // De-combine mode highlights
    hybridSelected,
    spawnSelected,
    spawnSquare,
    eligibleHybrid,
    hasActiveHybrid,
    isLocalDeCombine, // true = double-tap (only show selected hybrid)
    // Combine mode highlights
    anchor,
    partner,
    eligible,
    hasAnchor,
    isLocalCombine, // true = double-tap (only show anchor's partners)
    // Normal mode highlights
    selected,
    isLegalMove,
    // Mode flags
    deCombineMode,
    combineMode,
  } = highlightState;

  let squareColor = isLightSquare
    ? "bg-gradient-to-br from-amber-50 to-amber-100"
    : "bg-gradient-to-br from-amber-700 to-amber-900";
  let ringClass = "";
  let opacity = "opacity-100";
  let extraEffects = "";

  // De-Combine mode highlighting
  if (deCombineMode) {
    if (hybridSelected) {
      squareColor = "bg-gradient-to-br from-teal-300 to-teal-500";
      ringClass =
        "ring-4 ring-teal-400 ring-inset animate-pulse shadow-lg shadow-teal-500/50";
    } else if (spawnSelected) {
      squareColor = "bg-gradient-to-br from-lime-300 to-lime-500";
      ringClass =
        "ring-4 ring-lime-400 ring-inset animate-pulse shadow-lg shadow-lime-500/50";
    } else if (spawnSquare) {
      squareColor = isLightSquare
        ? "bg-gradient-to-br from-green-200 to-green-300"
        : "bg-gradient-to-br from-green-500 to-green-700";
      ringClass = "ring-2 ring-green-400 ring-inset shadow-inner";
    } else if (eligibleHybrid && !isLocalDeCombine) {
      // All eligible hybrids - only show in GLOBAL mode (button), not local (double-tap)
      squareColor = isLightSquare
        ? "bg-gradient-to-br from-teal-200 to-teal-300"
        : "bg-gradient-to-br from-teal-500 to-teal-700";
      ringClass = "ring-2 ring-teal-300 ring-inset animate-pulse";
    } else if (isLocalDeCombine && !hybridSelected && !spawnSquare) {
      // In LOCAL mode, dim everything except selected hybrid and spawn squares
      opacity = "opacity-50";
    }
  }
  // Check specifically for last move highlight - using a distinct color (e.g., yellow)
  else if (highlightState.isLastMoveSource || highlightState.isLastMoveTarget) {
    squareColor = isLightSquare ? "bg-amber-200" : "bg-amber-600";
    opacity = "opacity-90";
    ringClass = "ring-2 ring-yellow-400 ring-inset"; // Added a ring for visibility
  }
  // Combine mode highlighting
  else if (combineMode) {
    if (anchor) {
      // Anchor piece (the one double-tapped or clicked first)
      squareColor = "bg-gradient-to-br from-purple-300 to-purple-500";
      ringClass =
        "ring-4 ring-purple-400 ring-inset shadow-lg shadow-purple-500/50";
    } else if (partner) {
      // Partner pieces (only shown when anchor is set)
      squareColor = isLightSquare
        ? "bg-gradient-to-br from-purple-200 to-purple-300"
        : "bg-gradient-to-br from-purple-500 to-purple-700";
      ringClass = "ring-2 ring-purple-300 ring-inset shadow-inner";
    } else if (eligible && !isLocalCombine) {
      // All eligible pieces - only show in GLOBAL mode (button), not local (double-tap)
      // Use SAME color regardless of light/dark square for consistency
      squareColor = "bg-gradient-to-br from-purple-300 to-purple-500";
      ringClass = "ring-2 ring-purple-400 ring-inset animate-pulse";
    } else if (isLocalCombine && !anchor && !partner) {
      // In LOCAL mode with anchor, dim everything except anchor and partners
      opacity = "opacity-50";
    }
  }
  // Normal move mode highlighting
  else {
    if (selected) {
      squareColor = "bg-gradient-to-br from-yellow-300 to-yellow-500";
      extraEffects = "shadow-lg shadow-yellow-500/50";
    } else if (isLegalMove) {
      squareColor = isLightSquare
        ? "bg-gradient-to-br from-green-200 to-green-300"
        : "bg-gradient-to-br from-green-500 to-green-700";
      ringClass = "ring-2 ring-green-400 ring-inset shadow-inner";
    }
  }

  return {
    squareColor,
    ringClass,
    opacity,
    extraEffects,
  };
};

/**
 * Get piece styling with text shadow based on color
 * @param {string} piece - The piece symbol
 * @returns {object} - Style object with textShadow, filter, and transform adjustments
 */
export const getPieceStyling = (piece) => {
  const isWhitePiece = piece === piece.toUpperCase();
  const basePiece = piece.toLowerCase();

  // Base styling for all pieces
  const baseStyle = {
    textShadow: isWhitePiece
      ? "2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.4)"
      : "1px 1px 3px rgba(255,255,255,0.6), -1px -1px 2px rgba(255,255,255,0.3)",
    filter: isWhitePiece 
      ? "drop-shadow(0 5px 12px rgba(0,0,0,0.7))"
      : "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
    transform: "translateY(0.1em)", // Move all pieces down
    display: "inline-block",
  };

  // Hybrid pieces need specific positioning adjustments
  // These Unicode characters (🩏🩐🩎🩒🩓🩑) have different baselines
  const hybridOffsets = {
    rn: { translateY: "0.05em", translateX: "-0.05em" }, // Rook-Knight (down + left)
    bn: { translateY: "0.05em", translateX: "-0.05em" }, // Bishop-Knight (down + left)
    qn: { translateY: "0.2em", translateX: "-0.05em" }, // Queen-Knight (more down + left)
    rb: { translateY: "0.1em", translateX: "0" }, // Rook-Bishop (down)
  };

  // Apply hybrid-specific offset if applicable
  if (hybridOffsets[basePiece]) {
    const offset = hybridOffsets[basePiece];
    return {
      ...baseStyle,
      transform: `translate(${offset.translateX}, ${offset.translateY})`,
    };
  }

  return baseStyle;
};
