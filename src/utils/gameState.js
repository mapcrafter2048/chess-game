import { INITIAL_BOARD, COLORS, getPieceColor } from "./constants.js";
import {
  createHybridPiece,
  determinePlacementSquare,
} from "./combinationRules.js";

// Create a deep copy of the board
export const copyBoard = (board) => {
  return board.map((row) => [...row]);
};

// Execute a move on the board
export const makeMove = (
  board,
  fromRow,
  fromCol,
  toRow,
  toCol,
  enPassantTarget = null
) => {
  const newBoard = copyBoard(board);
  const movingPiece = newBoard[fromRow][fromCol];

  const isEnPassantCapture =
    movingPiece &&
    movingPiece.toLowerCase() === "p" &&
    enPassantTarget &&
    toRow === enPassantTarget.row &&
    toCol === enPassantTarget.col &&
    !newBoard[toRow][toCol];

  if (isEnPassantCapture) {
    newBoard[enPassantTarget.captureRow][enPassantTarget.captureCol] = "";
  }

  newBoard[toRow][toCol] = newBoard[fromRow][fromCol];
  newBoard[fromRow][fromCol] = "";
  return newBoard;
};

export const getEnPassantTargetAfterMove = (
  board,
  fromRow,
  fromCol,
  toRow,
  toCol
) => {
  const movingPiece = board[fromRow]?.[fromCol];
  if (!movingPiece || movingPiece.toLowerCase() !== "p") {
    return null;
  }

  const isWhite = movingPiece === movingPiece.toUpperCase();
  const direction = isWhite ? -1 : 1;
  const startRow = isWhite ? 6 : 1;

  if (fromCol !== toCol || fromRow !== startRow || toRow !== fromRow + 2 * direction) {
    return null;
  }

  return {
    row: fromRow + direction,
    col: fromCol,
    captureRow: toRow,
    captureCol: toCol,
  };
};

// Initialize game state
export const createInitialGameState = () => {
  return {
    board: copyBoard(INITIAL_BOARD),
    currentTurn: COLORS.WHITE,
    selectedSquare: null,
    moveHistory: [],
    capturedPieces: {
      white: [],
      black: [],
    },
    // Undo/Redo support
    undoStack: [],
    redoStack: [],
    // Castling rights
    castlingRights: {
      white: { kingSide: true, queenSide: true },
      black: { kingSide: true, queenSide: true },
    },
    // En passant target
    enPassantTarget: null,
    // Game status
    gameStatus: {
      isCheck: false,
      isCheckmate: false,
      isStalemate: false,
      isGameOver: false,
      winner: null,
      timeoutWinner: null, // Winner by timeout
    },
  };
};

// Switch turn
export const switchTurn = (currentTurn) => {
  return currentTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
};

// Check if it's the current player's piece
export const isCurrentPlayersPiece = (piece, currentTurn) => {
  if (!piece) return false;
  return getPieceColor(piece) === currentTurn;
};

// Add move to history
export const addMoveToHistory = (moveHistory, move) => {
  return [...moveHistory, move];
};

// Add captured piece
export const addCapturedPiece = (capturedPieces, piece) => {
  const newCapturedPieces = { ...capturedPieces };
  const color = getPieceColor(piece);

  if (color === COLORS.WHITE) {
    newCapturedPieces.white = [...newCapturedPieces.white, piece];
  } else {
    newCapturedPieces.black = [...newCapturedPieces.black, piece];
  }

  return newCapturedPieces;
};

// Execute a combination action
export const executeCombination = (
  board,
  row1,
  col1,
  row2,
  col2,
  anchorRow,
  anchorCol
) => {
  const piece1 = board[row1][col1];
  const piece2 = board[row2][col2];

  // Create the hybrid piece
  const hybridPiece = createHybridPiece(piece1, piece2);

  if (!hybridPiece) return null;

  // Determine placement square
  const placementSquare = determinePlacementSquare(
    piece1,
    row1,
    col1,
    piece2,
    row2,
    col2,
    anchorRow,
    anchorCol
  );

  // Create new board
  const newBoard = copyBoard(board);

  // Place hybrid on placement square
  newBoard[placementSquare.row][placementSquare.col] = hybridPiece;

  // Clear the other square
  if (placementSquare.row === row1 && placementSquare.col === col1) {
    newBoard[row2][col2] = "";
  } else {
    newBoard[row1][col1] = "";
  }

  return {
    board: newBoard,
    hybridPiece,
    placementSquare,
    consumedSquare:
      placementSquare.row === row1 && placementSquare.col === col1
        ? { row: row2, col: col2 }
        : { row: row1, col: col1 },
  };
};

// Undo/Redo functions
export const saveStateForUndo = (gameState) => {
  const snapshot = {
    board: copyBoard(gameState.board),
    currentTurn: gameState.currentTurn,
    capturedPieces: JSON.parse(JSON.stringify(gameState.capturedPieces)),
    castlingRights: JSON.parse(JSON.stringify(gameState.castlingRights)),
    enPassantTarget: gameState.enPassantTarget
      ? { ...gameState.enPassantTarget }
      : null,
  };
  return {
    ...gameState,
    undoStack: [...gameState.undoStack, snapshot],
    redoStack: [], // Clear redo stack on new action
  };
};

export const undoMove = (gameState) => {
  if (gameState.undoStack.length === 0) {
    return gameState; // Nothing to undo
  }

  const undoStack = [...gameState.undoStack];
  const previousState = undoStack.pop();

  const currentSnapshot = {
    board: copyBoard(gameState.board),
    currentTurn: gameState.currentTurn,
    capturedPieces: JSON.parse(JSON.stringify(gameState.capturedPieces)),
    castlingRights: JSON.parse(JSON.stringify(gameState.castlingRights)),
    enPassantTarget: gameState.enPassantTarget
      ? { ...gameState.enPassantTarget }
      : null,
  };

  return {
    ...gameState,
    board: previousState.board,
    currentTurn: previousState.currentTurn,
    capturedPieces: previousState.capturedPieces,
    castlingRights: previousState.castlingRights,
    enPassantTarget: previousState.enPassantTarget,
    undoStack: undoStack,
    redoStack: [...gameState.redoStack, currentSnapshot],
  };
};

export const redoMove = (gameState) => {
  if (gameState.redoStack.length === 0) {
    return gameState; // Nothing to redo
  }

  const redoStack = [...gameState.redoStack];
  const nextState = redoStack.pop();

  const currentSnapshot = {
    board: copyBoard(gameState.board),
    currentTurn: gameState.currentTurn,
    capturedPieces: JSON.parse(JSON.stringify(gameState.capturedPieces)),
    castlingRights: JSON.parse(JSON.stringify(gameState.castlingRights)),
    enPassantTarget: gameState.enPassantTarget
      ? { ...gameState.enPassantTarget }
      : null,
  };

  return {
    ...gameState,
    board: nextState.board,
    currentTurn: nextState.currentTurn,
    capturedPieces: nextState.capturedPieces,
    castlingRights: nextState.castlingRights,
    enPassantTarget: nextState.enPassantTarget,
    undoStack: [...gameState.undoStack, currentSnapshot],
    redoStack: redoStack,
  };
};

export const canUndo = (gameState) => {
  return gameState.undoStack && gameState.undoStack.length > 0;
};

export const canRedo = (gameState) => {
  return gameState.redoStack && gameState.redoStack.length > 0;
};
