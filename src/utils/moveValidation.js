import { PIECES, isWhitePiece, isOpponentPiece, isSameColor, isHybridPiece, getHybridComponents } from './constants.js';

// Check if a position is within the board
export const isValidPosition = (row, col) => {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
};

// Validate pawn moves
export const isValidPawnMove = (
    board,
    fromRow,
    fromCol,
    toRow,
    toCol,
    piece,
    enPassantTarget = null
) => {
    const isWhite = isWhitePiece(piece);
    const direction = isWhite ? -1 : 1;
    const startRow = isWhite ? 6 : 1;
    const rowDiff = toRow - fromRow;
    const colDiff = Math.abs(toCol - fromCol);

    // Move forward one square
    if (colDiff === 0 && rowDiff === direction && !board[toRow][toCol]) {
        return true;
    }

    // Move forward two squares from starting position
    if (colDiff === 0 && rowDiff === 2 * direction && fromRow === startRow) {
        const middleRow = fromRow + direction;
        if (!board[middleRow][fromCol] && !board[toRow][toCol]) {
            return true;
        }
    }

    // Capture diagonally
    if (colDiff === 1 && rowDiff === direction && board[toRow][toCol]) {
        return isOpponentPiece(piece, board[toRow][toCol]);
    }

    // En passant capture
    if (
        colDiff === 1 &&
        rowDiff === direction &&
        !board[toRow][toCol] &&
        enPassantTarget &&
        toRow === enPassantTarget.row &&
        toCol === enPassantTarget.col
    ) {
        const capturedPawn = board[enPassantTarget.captureRow]?.[enPassantTarget.captureCol];
        return !!capturedPawn && isOpponentPiece(piece, capturedPawn);
    }

    return false;
};

// Validate rook moves
export const isValidRookMove = (board, fromRow, fromCol, toRow, toCol) => {
    // Must move in straight line (same row or same column)
    if (fromRow !== toRow && fromCol !== toCol) {
        return false;
    }

    // Check if path is clear
    return isPathClear(board, fromRow, fromCol, toRow, toCol);
};

// Validate knight moves
export const isValidKnightMove = (fromRow, fromCol, toRow, toCol) => {
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);

    // Knight moves in L-shape: 2 squares in one direction, 1 in perpendicular
    return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
};

// Validate bishop moves
export const isValidBishopMove = (board, fromRow, fromCol, toRow, toCol) => {
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);

    // Must move diagonally (same distance in both directions)
    if (rowDiff !== colDiff) {
        return false;
    }

    // Check if path is clear
    return isPathClear(board, fromRow, fromCol, toRow, toCol);
};

// Validate queen moves
export const isValidQueenMove = (board, fromRow, fromCol, toRow, toCol) => {
    // Queen can move like rook or bishop
    return isValidRookMove(board, fromRow, fromCol, toRow, toCol) ||
        isValidBishopMove(board, fromRow, fromCol, toRow, toCol);
};

// Validate king moves
export const isValidKingMove = (fromRow, fromCol, toRow, toCol) => {
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);

    // King can move one square in any direction
    return rowDiff <= 1 && colDiff <= 1;
};

// Check if path is clear between two positions
export const isPathClear = (board, fromRow, fromCol, toRow, toCol) => {
    const rowStep = toRow === fromRow ? 0 : (toRow - fromRow) / Math.abs(toRow - fromRow);
    const colStep = toCol === fromCol ? 0 : (toCol - fromCol) / Math.abs(toCol - fromCol);

    let currentRow = fromRow + rowStep;
    let currentCol = fromCol + colStep;

    while (currentRow !== toRow || currentCol !== toCol) {
        if (board[currentRow][currentCol]) {
            return false;
        }
        currentRow += rowStep;
        currentCol += colStep;
    }

    return true;
};

// Main validation function
export const isValidMove = (
    board,
    fromRow,
    fromCol,
    toRow,
    toCol,
    allowFriendlyDestination = false,
    enPassantTarget = null
) => {
    // Can't move to same position
    if (fromRow === toRow && fromCol === toCol) {
        return false;
    }

    // Check if position is valid
    if (!isValidPosition(toRow, toCol)) {
        return false;
    }

    const piece = board[fromRow][fromCol];
    const targetPiece = board[toRow][toCol];

    // Can't move empty square
    if (!piece) {
        return false;
    }

    // Can't capture own piece (unless explicitly allowed for combination checks)
    if (targetPiece && isSameColor(piece, targetPiece) && !allowFriendlyDestination) {
        return false;
    }

    // Validate based on piece type
    const pieceType = piece.toLowerCase();

    // Handle hybrid pieces
    if (isHybridPiece(piece)) {
        return isValidHybridMove(board, fromRow, fromCol, toRow, toCol, piece);
    }

    switch (pieceType) {
        case PIECES.PAWN:
            return isValidPawnMove(board, fromRow, fromCol, toRow, toCol, piece, enPassantTarget);
        case PIECES.ROOK:
            return isValidRookMove(board, fromRow, fromCol, toRow, toCol);
        case PIECES.KNIGHT:
            return isValidKnightMove(fromRow, fromCol, toRow, toCol);
        case PIECES.BISHOP:
            return isValidBishopMove(board, fromRow, fromCol, toRow, toCol);
        case PIECES.QUEEN:
            return isValidQueenMove(board, fromRow, fromCol, toRow, toCol);
        case PIECES.KING:
            return isValidKingMove(fromRow, fromCol, toRow, toCol);
        default:
            return false;
    }
};

// Validate hybrid piece moves (union of component moves)
export const isValidHybridMove = (board, fromRow, fromCol, toRow, toCol, hybridPiece) => {
    const components = getHybridComponents(hybridPiece);

    // Try each component's movement rules
    for (const componentPiece of components) {
        const pieceType = componentPiece.toLowerCase();
        let isValid = false;

        switch (pieceType) {
            case PIECES.ROOK:
                isValid = isValidRookMove(board, fromRow, fromCol, toRow, toCol);
                break;
            case PIECES.BISHOP:
                isValid = isValidBishopMove(board, fromRow, fromCol, toRow, toCol);
                break;
            case PIECES.KNIGHT:
                isValid = isValidKnightMove(fromRow, fromCol, toRow, toCol);
                break;
            case PIECES.QUEEN:
                isValid = isValidQueenMove(board, fromRow, fromCol, toRow, toCol);
                break;
            default:
                isValid = false;
        }

        if (isValid) return true;
    }

    return false;
};
