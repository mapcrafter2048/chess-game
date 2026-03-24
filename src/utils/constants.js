// Piece types
export const PIECES = {
  KING: "k",
  QUEEN: "q",
  ROOK: "r",
  BISHOP: "b",
  KNIGHT: "n",
  PAWN: "p",
  // Hybrid pieces
  ROOK_BISHOP: "rb", // Rook + Bishop (queen-like)
  ROOK_KNIGHT: "rn", // Rook + Knight
  BISHOP_KNIGHT: "bn", // Bishop + Knight
  QUEEN_KNIGHT: "qn", // Queen + Knight
};

// Colors
export const COLORS = {
  WHITE: "white",
  BLACK: "black",
};

// Piece symbols mapping
export const PIECE_SYMBOLS = {
  K: "♚\uFE0E",
  Q: "♛\uFE0E",
  R: "♜\uFE0E",
  B: "♝\uFE0E",
  N: "♞\uFE0E",
  P: "♟\uFE0E",
  k: "♚\uFE0E",
  q: "♛\uFE0E",
  r: "♜\uFE0E",
  b: "♝\uFE0E",
  n: "♞\uFE0E",
  p: "♟\uFE0E",
  // Hybrid pieces (white)
  RB: "⚔",
  RN: "🩏",
  BN: "🩐",
  QN: "🩎",
  // Hybrid pieces (black)
  rb: "⚔",
  rn: "🩒",
  bn: "🩓",
  qn: "🩑",
};

// Hybrid piece display names
export const HYBRID_NAMES = {
  rb: "Rook-Bishop",
  rn: "Rook-Knight",
  bn: "Bishop-Knight",
  qn: "Queen-Knight",
  RB: "Rook-Bishop",
  RN: "Rook-Knight",
  BN: "Bishop-Knight",
  QN: "Queen-Knight",
};

// Piece value ordering (for placement priority)
export const PIECE_VALUES = {
  q: 5,
  Q: 5, // Queen (highest)
  r: 4,
  R: 4, // Rook
  b: 3,
  B: 3, // Bishop
  n: 3,
  N: 3, // Knight (same as bishop)
  p: 1,
  P: 1, // Pawn
  k: 100,
  K: 100, // King (never combines)
  // Hybrids inherit highest component value
  rb: 5,
  RB: 5, // Rook+Bishop
  rn: 4,
  RN: 4, // Rook+Knight
  bn: 3,
  BN: 3, // Bishop+Knight
  qn: 5,
  QN: 5, // Queen+Knight
};

// Allowed combination pairings
export const ALLOWED_COMBINATIONS = [
  ["r", "b"],
  ["R", "B"], // Rook + Bishop
  ["r", "n"],
  ["R", "N"], // Rook + Knight
  ["b", "n"],
  ["B", "N"], // Bishop + Knight
  ["q", "n"],
  ["Q", "N"], // Queen + Knight
];

// Initial chess board setup
export const INITIAL_BOARD = [
  ["r", "n", "b", "q", "k", "b", "n", "r"],
  ["p", "p", "p", "p", "p", "p", "p", "p"],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["P", "P", "P", "P", "P", "P", "P", "P"],
  ["R", "N", "B", "Q", "K", "B", "N", "R"],
];

// Helper functions
export const isWhitePiece = (piece) => {
  return piece === piece.toUpperCase() && piece !== "";
};

export const isBlackPiece = (piece) => {
  return piece === piece.toLowerCase() && piece !== "";
};

export const getPieceColor = (piece) => {
  if (!piece) return null;
  return isWhitePiece(piece) ? COLORS.WHITE : COLORS.BLACK;
};

export const isOpponentPiece = (piece1, piece2) => {
  if (!piece1 || !piece2) return false;
  return getPieceColor(piece1) !== getPieceColor(piece2);
};

export const isSameColor = (piece1, piece2) => {
  if (!piece1 || !piece2) return false;
  return getPieceColor(piece1) === getPieceColor(piece2);
};

// Deep copy a board
export const copyBoard = (board) => {
  return board.map((row) => [...row]);
};

// Check if a piece is a hybrid
export const isHybridPiece = (piece) => {
  if (!piece) return false;
  const normalized = piece.toLowerCase();
  return (
    normalized === PIECES.ROOK_BISHOP ||
    normalized === PIECES.ROOK_KNIGHT ||
    normalized === PIECES.BISHOP_KNIGHT ||
    normalized === PIECES.QUEEN_KNIGHT
  );
};

// Get base piece type (normalized to lowercase)
export const getBasePieceType = (piece) => {
  if (!piece) return null;
  return piece.toLowerCase();
};

// Get component pieces from hybrid
export const getHybridComponents = (hybridPiece) => {
  const type = getBasePieceType(hybridPiece);
  const isWhite = hybridPiece === hybridPiece.toUpperCase();

  const makeCase = (piece) => (isWhite ? piece.toUpperCase() : piece);

  switch (type) {
    case PIECES.ROOK_BISHOP:
      return [makeCase(PIECES.ROOK), makeCase(PIECES.BISHOP)];
    case PIECES.ROOK_KNIGHT:
      return [makeCase(PIECES.ROOK), makeCase(PIECES.KNIGHT)];
    case PIECES.BISHOP_KNIGHT:
      return [makeCase(PIECES.BISHOP), makeCase(PIECES.KNIGHT)];
    case PIECES.QUEEN_KNIGHT:
      return [makeCase(PIECES.QUEEN), makeCase(PIECES.KNIGHT)];
    default:
      return [];
  }
};
