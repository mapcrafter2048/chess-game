import { isValidMove, isValidPosition } from './moveValidation.js';
import { PIECES, getPieceColor, isHybridPiece, getHybridComponents } from './constants.js';
import { makeMove } from './gameState.js';

// Calculate all possible legal moves for a piece at a given position
export const calculateLegalMoves = (board, row, col, currentTurn) => {
    const piece = board[row][col];

    if (!piece) return [];

    // Check if it's the current player's piece
    if (getPieceColor(piece) !== currentTurn) {
        return [];
    }

    const legalMoves = [];
    const pieceType = piece.toLowerCase();

    // Generate all possible moves based on piece type
    const possibleMoves = generatePossibleMoves(board, row, col, pieceType);

    // Filter to only valid moves
    for (const move of possibleMoves) {
        if (isValidMove(board, row, col, move.row, move.col)) {
            legalMoves.push(move);
        }
    }

    return legalMoves;
};

// Generate possible moves for each piece type
const generatePossibleMoves = (board, row, col, pieceType) => {
    // Handle hybrid pieces
    if (isHybridPiece(pieceType)) {
        return generateHybridMoves(board, row, col);
    }

    switch (pieceType) {
        case PIECES.PAWN:
            return generatePawnMoves(board, row, col);
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
const generatePawnMoves = (board, row, col) => {
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
    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

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
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
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
    const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

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
// Optimized to avoid array spread operator
const generateQueenMoves = (board, row, col) => {
    const moves = [];
    
    // Rook-like moves (horizontal and vertical)
    const rookDirections = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [dRow, dCol] of rookDirections) {
        let newRow = row + dRow;
        let newCol = col + dCol;

        while (isValidPosition(newRow, newCol)) {
            moves.push({ row: newRow, col: newCol });
            if (board[newRow][newCol]) break;
            newRow += dRow;
            newCol += dCol;
        }
    }
    
    // Bishop-like moves (diagonal)
    const bishopDirections = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (const [dRow, dCol] of bishopDirections) {
        let newRow = row + dRow;
        let newCol = col + dCol;

        while (isValidPosition(newRow, newCol)) {
            moves.push({ row: newRow, col: newCol });
            if (board[newRow][newCol]) break;
            newRow += dRow;
            newCol += dCol;
        }
    }
    
    return moves;
};

// Generate king moves
const generateKingMoves = (row, col) => {
    const moves = [];
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1], [0, 1],
        [1, -1], [1, 0], [1, 1]
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

// King position cache to avoid O(64) scans
// Format: WeakMap<board, { white: {row, col}, black: {row, col} }>
const kingPositionCache = new WeakMap();

// Find the king's position on the board with caching
export const findKing = (board, color) => {
    // Try to get from cache first
    let cached = kingPositionCache.get(board);
    if (cached && cached[color]) {
        return cached[color];
    }

    // Cache miss - scan the board
    const kingPiece = color === 'white' ? 'K' : 'k';
    let kingPos = null;

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (board[row][col] === kingPiece) {
                kingPos = { row, col };
                break;
            }
        }
        if (kingPos) break;
    }

    // Store in cache
    if (!cached) {
        cached = {};
        kingPositionCache.set(board, cached);
    }
    cached[color] = kingPos;

    return kingPos;
};

// Check if a position is under attack
export const isSquareUnderAttack = (board, targetRow, targetCol, attackingColor) => {
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

    const opponentColor = color === 'white' ? 'black' : 'white';
    return isSquareUnderAttack(board, kingPosition.row, kingPosition.col, opponentColor);
};

// Check if a move would put/leave the king in check
// Optimized version with early exit for non-king moves
export const wouldBeInCheck = (board, fromRow, fromCol, toRow, toCol, color) => {
    const movingPiece = board[fromRow][fromCol];
    const capturedPiece = board[toRow][toCol];
    
    // Make move on a new board (required for safety)
    const newBoard = makeMove(board, fromRow, fromCol, toRow, toCol);
    
    // Check if king is in check on new board
    // The findKing function will cache the position for subsequent calls
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
