import {
  COLORS,
  getPieceColor,
  isHybridPiece,
  getBasePieceType,
} from "../utils/constants.js";
import {
  calculateLegalMoves,
  isInCheck,
  wouldBeInCheck,
} from "../utils/moveCalculator.js";
import { makeMove, copyBoard, executeCombination } from "../utils/gameState.js";
import {
  findEligiblePairs,
  canReachForCombine,
  getHigherValuePiece,
  createHybridPiece,
} from "../utils/combinationRules.js";
import {
  canDeCombine,
  findSpawnSquares,
  computeLegalAssignments,
  getHybridComponents,
} from "../utils/deCombinationRules.js";
import {
  canCastle,
  executeCastleMove,
} from "../components/helpers/castlingLogic.js";

/**
 * Generate all legal moves for a given position
 * Includes: normal moves, captures, castling, promotions, combinations, decombinations
 *
 * @param {Array} board - 8x8 board array
 * @param {string} color - Color to generate moves for
 * @param {Object} castlingRights - Castling rights { white: {...}, black: {...} }
 * @returns {Array} Array of move objects
 */
export const getAllLegalMoves = (board, color, castlingRights, enPassantTarget = null) => {
  const allMoves = [];

  // ============================================
  // 1. STANDARD MOVES & CAPTURES
  // ============================================
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece || getPieceColor(piece) !== color) continue;

      const moves = calculateLegalMoves(board, row, col, color, enPassantTarget);

      for (const move of moves) {
        // CRITICAL: Filter out moves that would leave king in check
        if (wouldBeInCheck(board, row, col, move.row, move.col, color, enPassantTarget)) {
          continue; // Skip this move - it's illegal
        }

        const isPawn = piece.toLowerCase() === "p";
        const promotionRank = color === COLORS.WHITE ? 0 : 7;

        // Check if this is a promotion move
        if (isPawn && move.row === promotionRank) {
          // Generate 4 moves (one for each promotion piece)
          const promotionPieces = ["q", "r", "b", "n"];
          const isWhite = color === COLORS.WHITE;

          for (const promoPiece of promotionPieces) {
            allMoves.push({
              from: { row, col },
              to: { row: move.row, col: move.col },
              type: "promotion",
              promoteTo: isWhite ? promoPiece.toUpperCase() : promoPiece,
            });
          }
        } else {
          // Normal move or capture
          allMoves.push({
            from: { row, col },
            to: { row: move.row, col: move.col },
            type: "normal",
          });
        }
      }
    }
  }

  // ============================================
  // 2. CASTLING MOVES
  // ============================================
  // Check if king is on board and hasn't moved
  const kingRow = color === COLORS.WHITE ? 7 : 0;
  const king = board[kingRow][4];

  if (king && king.toLowerCase() === "k" && getPieceColor(king) === color) {
    // Kingside castling
    if (canCastle(board, color, castlingRights, true)) {
      allMoves.push({
        from: { row: kingRow, col: 4 },
        to: { row: kingRow, col: 6 },
        type: "castling",
        side: "kingside",
      });
    }

    // Queenside castling
    if (canCastle(board, color, castlingRights, false)) {
      allMoves.push({
        from: { row: kingRow, col: 4 },
        to: { row: kingRow, col: 2 },
        type: "castling",
        side: "queenside",
      });
    }
  }

  // ============================================
  // 3. COMBINATION MOVES
  // ============================================
  const eligiblePairs = findEligiblePairs(board, color);

  for (const pair of eligiblePairs) {
    const { piece1, piece2 } = pair;

    // Determine which piece has higher value (hybrid will end up there)
    const higherPiece = getHigherValuePiece(piece1.piece, piece2.piece);

    let from, to, pieces;

    if (higherPiece === piece1.piece) {
      // piece2 (lower value) moves to piece1 (higher value)
      // But only if piece2 can reach piece1
      if (
        canReachForCombine(
          board,
          piece2.row,
          piece2.col,
          piece1.row,
          piece1.col,
          color
        )
      ) {
        from = { row: piece2.row, col: piece2.col };
        to = { row: piece1.row, col: piece1.col };
        pieces = { piece1, piece2 };
      } else {
        // piece1 must move to piece2 instead
        from = { row: piece1.row, col: piece1.col };
        to = { row: piece2.row, col: piece2.col };
        pieces = { piece1, piece2 };
      }
    } else if (higherPiece === piece2.piece) {
      // piece1 (lower value) moves to piece2 (higher value)
      if (
        canReachForCombine(
          board,
          piece1.row,
          piece1.col,
          piece2.row,
          piece2.col,
          color
        )
      ) {
        from = { row: piece1.row, col: piece1.col };
        to = { row: piece2.row, col: piece2.col };
        pieces = { piece1, piece2 };
      } else {
        // piece2 must move to piece1 instead
        from = { row: piece2.row, col: piece2.col };
        to = { row: piece1.row, col: piece1.col };
        pieces = { piece1, piece2 };
      }
    } else {
      // Equal value (tie) - try both directions
      // Use whichever direction is reachable (prefer piece1 -> piece2 if both work)
      if (
        canReachForCombine(
          board,
          piece1.row,
          piece1.col,
          piece2.row,
          piece2.col,
          color
        )
      ) {
        from = { row: piece1.row, col: piece1.col };
        to = { row: piece2.row, col: piece2.col };
        pieces = { piece1, piece2 };
      } else if (
        canReachForCombine(
          board,
          piece2.row,
          piece2.col,
          piece1.row,
          piece1.col,
          color
        )
      ) {
        from = { row: piece2.row, col: piece2.col };
        to = { row: piece1.row, col: piece1.col };
        pieces = { piece1, piece2 };
      } else {
        continue; // Neither can reach (shouldn't happen if isReachable passed)
      }
    }

    allMoves.push({
      from,
      to,
      type: "combine",
      pieces,
    });
  }

  // ============================================
  // 4. DECOMBINATION MOVES
  // ============================================
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];

      if (!piece || !isHybridPiece(piece) || getPieceColor(piece) !== color) {
        continue;
      }

      // Check if this hybrid can be decombined
      const canDecompose = canDeCombine(board, row, col, color);

      if (!canDecompose.valid) continue;

      const spawnSquares = canDecompose.spawnSquares;

      // For each possible spawn square
      for (const spawnSquare of spawnSquares) {
        const assignmentResult = computeLegalAssignments(
          board,
          row,
          col,
          spawnSquare,
          color
        );

        if (assignmentResult.legal.length > 0) {
          const chosen = assignmentResult.chosen;

          // Check if decombining to this spawn square would leave king in check
          // Treat it like the hybrid piece is "moving" to the spawn square
          if (
            wouldBeInCheck(
              board,
              row,
              col,
              spawnSquare.row,
              spawnSquare.col,
              color
            )
          ) {
            continue; // Skip this decombination - would leave king in check
          }

          allMoves.push({
            from: { row, col },
            to: { row: spawnSquare.row, col: spawnSquare.col },
            type: "decombine",
            assignment: {
              staying: chosen.stayingComponent,
              spawning: chosen.spawningComponent,
            },
          });
        }
      }
    }
  }

  // ============================================
  // 5. EN PASSANT MOVES
  // ============================================
  if (enPassantTarget) {
    const epRow = enPassantTarget.row;
    const epCol = enPassantTarget.col;
    // The capturing pawn must be on the row adjacent to the ep target
    const capturingPawnRow = color === COLORS.WHITE ? epRow + 1 : epRow - 1;

    for (const colOffset of [-1, 1]) {
      const fromCol = epCol + colOffset;
      if (fromCol < 0 || fromCol > 7) continue;

      const piece = board[capturingPawnRow]?.[fromCol];
      if (!piece || piece.toLowerCase() !== 'p' || getPieceColor(piece) !== color) continue;

      // Check that this en passant move doesn't leave king in check
      if (!wouldBeInCheck(board, capturingPawnRow, fromCol, epRow, epCol, color, enPassantTarget)) {
        // Check if this move was already generated as a normal move (it shouldn't be,
        // since the target square is empty, but be safe)
        const alreadyExists = allMoves.some(
          m => m.from.row === capturingPawnRow && m.from.col === fromCol &&
               m.to.row === epRow && m.to.col === epCol
        );
        if (!alreadyExists) {
          allMoves.push({
            from: { row: capturingPawnRow, col: fromCol },
            to: { row: epRow, col: epCol },
            type: 'en_passant',
          });
        }
      }
    }
  }

  return allMoves;
};

/**
 * Apply a move to the board and update castling rights
 * Handles all move types: normal, castling, promotion, combine, decombine
 *
 * @param {Array} board - Current board
 * @param {Object} move - Move to apply
 * @param {string} currentTurn - Current player's color
 * @param {Object} castlingRights - Current castling rights
 * @returns {Object} { newBoard, newCastlingRights }
 */
export const applyMove = (board, move, currentTurn, castlingRights) => {
  let newBoard;

  switch (move.type) {
    case "castling":
      newBoard = executeCastleMove(
        board,
        currentTurn,
        move.side === "kingside"
      );
      break;

    case "promotion": {
      newBoard = copyBoard(board);
      newBoard[move.to.row][move.to.col] = move.promoteTo;
      newBoard[move.from.row][move.from.col] = "";
      break;
    }

    case "combine": {
      const { piece1, piece2 } = move.pieces;

      // Anchor doesn't matter for AI (Option C from your answer)
      // Use piece1's square as anchor (arbitrary choice)
      const result = executeCombination(
        board,
        piece1.row,
        piece1.col,
        piece2.row,
        piece2.col,
        piece1.row, // anchor row (doesn't matter for AI)
        piece1.col // anchor col (doesn't matter for AI)
      );

      newBoard = result ? result.board : board;
      break;
    }

    case "decombine": {
      newBoard = copyBoard(board);
      newBoard[move.from.row][move.from.col] = move.assignment.staying;
      newBoard[move.to.row][move.to.col] = move.assignment.spawning;
      break;
    }

    case "en_passant": {
      newBoard = copyBoard(board);
      // Move the pawn to the target square
      newBoard[move.to.row][move.to.col] = newBoard[move.from.row][move.from.col];
      newBoard[move.from.row][move.from.col] = "";
      // Remove the captured pawn (same column as target, same row as source)
      newBoard[move.from.row][move.to.col] = "";
      break;
    }

    case "normal":
    default:
      // Standard move (includes captures)
      newBoard = makeMove(
        board,
        move.from.row,
        move.from.col,
        move.to.row,
        move.to.col
      );
      break;
  }

  // Update castling rights based on the move
  const newCastlingRights = updateCastlingRights(
    board,
    move,
    currentTurn,
    castlingRights
  );

  return { newBoard, newCastlingRights };
};

/**
 * Update castling rights after a move
 * Rights are lost when:
 * - King moves (both sides)
 * - Rook moves from starting position
 * - Rook is captured from starting position
 * - Castling is performed (both sides)
 *
 * @param {Array} board - Board before move
 * @param {Object} move - Move that was made
 * @param {string} currentTurn - Color that moved
 * @param {Object} castlingRights - Current castling rights
 * @returns {Object} Updated castling rights
 */
const updateCastlingRights = (board, move, currentTurn, castlingRights) => {
  // Deep copy castling rights
  const newRights = {
    white: { ...castlingRights.white },
    black: { ...castlingRights.black },
  };

  const piece = board[move.from.row]?.[move.from.col];
  const capturedPiece = board[move.to.row]?.[move.to.col];

  // 1. If castling move, remove all rights for that player
  if (move.type === "castling") {
    newRights[currentTurn] = { kingSide: false, queenSide: false };
    return newRights;
  }

  // 2. If king moves, remove all castling rights for that player
  if (piece && piece.toLowerCase() === "k") {
    newRights[currentTurn] = { kingSide: false, queenSide: false };
  }

  // 3. If rook moves from starting square, remove that side's rights
  if (piece && piece.toLowerCase() === "r") {
    const rank = currentTurn === COLORS.WHITE ? 7 : 0;

    if (move.from.row === rank) {
      if (move.from.col === 0) {
        // Queenside rook moved
        newRights[currentTurn].queenSide = false;
      } else if (move.from.col === 7) {
        // Kingside rook moved
        newRights[currentTurn].kingSide = false;
      }
    }
  }

  // 4. If opponent's rook is captured from starting square, remove their rights
  if (capturedPiece && capturedPiece.toLowerCase() === "r") {
    const opponentColor =
      currentTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
    const opponentRank = opponentColor === COLORS.WHITE ? 7 : 0;

    if (move.to.row === opponentRank) {
      if (move.to.col === 0) {
        // Queenside rook captured
        newRights[opponentColor].queenSide = false;
      } else if (move.to.col === 7) {
        // Kingside rook captured
        newRights[opponentColor].kingSide = false;
      }
    }
  }

  return newRights;
};

/**
 * Count total legal moves for a position (for checkmate/stalemate detection)
 *
 * @param {Array} board - Board state
 * @param {string} color - Color to count moves for
 * @param {Object} castlingRights - Castling rights
 * @returns {number} Number of legal moves
 */
export const countLegalMoves = (board, color, castlingRights, enPassantTarget = null) => {
  return getAllLegalMoves(board, color, castlingRights, enPassantTarget).length;
};

/**
 * Helper to convert move to algebraic notation (for debugging/logging)
 *
 * @param {Object} move - Move object
 * @returns {string} Algebraic notation string
 */
export const moveToAlgebraic = (move) => {
  const fileToLetter = (col) => String.fromCharCode(97 + col); // a-h
  const rankToNumber = (row) => 8 - row; // 1-8

  const fromSquare = `${fileToLetter(move.from.col)}${rankToNumber(
    move.from.row
  )}`;
  const toSquare = `${fileToLetter(move.to.col)}${rankToNumber(move.to.row)}`;

  let notation = `${fromSquare}${toSquare}`;

  if (move.type === "promotion") {
    notation += move.promoteTo.toLowerCase();
  } else if (move.type === "castling") {
    notation = move.side === "kingside" ? "O-O" : "O-O-O";
  } else if (move.type === "combine") {
    notation += " (combine)";
  } else if (move.type === "decombine") {
    notation += " (decombine)";
  }

  return notation;
};
