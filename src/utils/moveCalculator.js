import { isValidMove, isValidPosition } from "./moveValidation.js";
import {
  PIECES,
  getPieceColor,
  isHybridPiece,
  getHybridComponents,
} from "./constants.js";

// Local helpers to avoid circular dependency with gameState.js
const copyBoard = (board) => {
  return board.map((row) => [...row]);
};

const makeMove = (board, fromRow, fromCol, toRow, toCol) => {
  const newBoard = copyBoard(board);
  newBoard[toRow][toCol] = newBoard[fromRow][fromCol];
  newBoard[fromRow][fromCol] = "";
  return newBoard;
};

// Calculate all possible legal moves for a piece at a given position
export const calculateLegalMoves = (
  board,
  row,
  col,
  currentTurn,
  enPassantTarget = null
) => {
  const piece = board[row][col];

  if (!piece) return [];

  // Check if it's the current player's piece
  if (getPieceColor(piece) !== currentTurn) {
    return [];
  }

  const legalMoves = [];
  const pieceType = piece.toLowerCase();

  // Generate all possible moves based on piece type
  const possibleMoves = generatePossibleMoves(
    board,
    row,
    col,
    pieceType,
    enPassantTarget
  );

  // Filter to only valid moves
  for (const move of possibleMoves) {
    if (
      isValidMove(
        board,
        row,
        col,
        move.row,
        move.col,
        false,
        enPassantTarget
      )
    ) {
      legalMoves.push(move);
    }
  }

  return legalMoves;
};

// Generate possible moves for each piece type
const generatePossibleMoves = (board, row, col, pieceType, enPassantTarget) => {
  // Handle hybrid pieces
  if (isHybridPiece(pieceType)) {
    return generateHybridMoves(board, row, col);
  }

  switch (pieceType) {
    case PIECES.PAWN:
      return generatePawnMoves(board, row, col, enPassantTarget);
    case PIECES.ROOK:
      return generateRookMoves(board, row, col);
    case PIECES.KNIGHT:
      return generateKnightMoves(row, col);
    case PIECES.BISHOP:
      return generateBishopMoves(board, row, col);
    case PIECES.QUEEN:
      return generateQueenMoves(board, row, col);
    case PIECES.KING:
      return generateKingMoves(row, col);
    default:
      return [];
  }
};

// Generate pawn moves
const generatePawnMoves = (board, row, col, enPassantTarget) => {
  const moves = [];
  const piece = board[row][col];
  const isWhite = piece === piece.toUpperCase();
  const direction = isWhite ? -1 : 1;
  const startRow = isWhite ? 6 : 1;

  // Forward one square
  const oneForward = row + direction;
  if (isValidPosition(oneForward, col)) {
    moves.push({ row: oneForward, col });
  }

  // Forward two squares from start
  if (row === startRow) {
    const twoForward = row + 2 * direction;
    if (isValidPosition(twoForward, col)) {
      moves.push({ row: twoForward, col });
    }
  }

  // Diagonal captures
  for (const colOffset of [-1, 1]) {
    const newCol = col + colOffset;
    if (isValidPosition(oneForward, newCol)) {
      moves.push({ row: oneForward, col: newCol });
    }
  }

  return moves;
};

// Generate rook moves
const generateRookMoves = (board, row, col) => {
  const moves = [];
  const directions = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];

  for (const [dRow, dCol] of directions) {
    let newRow = row + dRow;
    let newCol = col + dCol;

    while (isValidPosition(newRow, newCol)) {
      moves.push({ row: newRow, col: newCol });

      // Stop if we hit a piece
      if (board[newRow][newCol]) break;

      newRow += dRow;
      newCol += dCol;
    }
  }

  return moves;
};

// Generate knight moves
const generateKnightMoves = (row, col) => {
  const moves = [];
  const knightOffsets = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
  ];

  for (const [dRow, dCol] of knightOffsets) {
    const newRow = row + dRow;
    const newCol = col + dCol;

    if (isValidPosition(newRow, newCol)) {
      moves.push({ row: newRow, col: newCol });
    }
  }

  return moves;
};

// Generate bishop moves
const generateBishopMoves = (board, row, col) => {
  const moves = [];
  const directions = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];

  for (const [dRow, dCol] of directions) {
    let newRow = row + dRow;
    let newCol = col + dCol;

    while (isValidPosition(newRow, newCol)) {
      moves.push({ row: newRow, col: newCol });

      // Stop if we hit a piece
      if (board[newRow][newCol]) break;

      newRow += dRow;
      newCol += dCol;
    }
  }

  return moves;
};

// Generate queen moves (combination of rook and bishop)
const generateQueenMoves = (board, row, col) => {
  return [
    ...generateRookMoves(board, row, col),
    ...generateBishopMoves(board, row, col),
  ];
};

// Generate king moves
const generateKingMoves = (row, col) => {
  const moves = [];
  const directions = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];

  for (const [dRow, dCol] of directions) {
    const newRow = row + dRow;
    const newCol = col + dCol;

    if (isValidPosition(newRow, newCol)) {
      moves.push({ row: newRow, col: newCol });
    }
  }

  return moves;
};

// Find the king's position on the board
export const findKing = (board, color) => {
  const kingPiece = color === "white" ? "K" : "k";

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (board[row][col] === kingPiece) {
        return { row, col };
      }
    }
  }

  return null;
};

// Check if a position is under attack
export const isSquareUnderAttack = (
  board,
  targetRow,
  targetCol,
  attackingColor
) => {
  // Check all opponent pieces to see if they can attack this square
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];

      if (piece && getPieceColor(piece) === attackingColor) {
        if (isValidMove(board, row, col, targetRow, targetCol)) {
          return true;
        }
      }
    }
  }

  return false;
};

// Check if the current player is in check
export const isInCheck = (board, color) => {
  const kingPosition = findKing(board, color);

  if (!kingPosition) return false;

  const opponentColor = color === "white" ? "black" : "white";
  return isSquareUnderAttack(
    board,
    kingPosition.row,
    kingPosition.col,
    opponentColor
  );
};

// Check if a move would put/leave the king in check
export const wouldBeInCheck = (
  board,
  fromRow,
  fromCol,
  toRow,
  toCol,
  color,
  enPassantTarget = null
) => {
  const newBoard = makeMove(
    board,
    fromRow,
    fromCol,
    toRow,
    toCol,
    enPassantTarget
  );
  return isInCheck(newBoard, color);
};

// Generate hybrid piece moves (union of component moves) i.e. after piece is combined.
const generateHybridMoves = (board, row, col) => {
  const hybridPiece = board[row][col];
  const components = getHybridComponents(hybridPiece);
  const allMoves = [];
  const seen = new Set();

  // Generate moves for each component
  for (const componentPiece of components) {
    const pieceType = componentPiece.toLowerCase();
    let moves = [];

    switch (pieceType) {
      case PIECES.ROOK:
        moves = generateRookMoves(board, row, col);
        break;
      case PIECES.BISHOP:
        moves = generateBishopMoves(board, row, col);
        break;
      case PIECES.KNIGHT:
        moves = generateKnightMoves(row, col);
        break;
      case PIECES.QUEEN:
        moves = generateQueenMoves(board, row, col);
        break;
      default:
        moves = [];
    }

    // Add unique moves
    for (const move of moves) {
      const key = `${move.row},${move.col}`;
      if (!seen.has(key)) {
        seen.add(key);
        allMoves.push(move);
      }
    }
  }
  // console.log("Hybrid: ", allMoves);
  return allMoves;
};
