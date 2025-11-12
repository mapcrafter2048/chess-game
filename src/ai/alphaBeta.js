// Alpha-Beta Pruning Search Algorithm
// Core AI engine for finding best moves

import { evaluatePosition } from './evaluator.js';
import { orderMoves } from './moveOrdering.js';
import { CHECKMATE_SCORE } from './constants.js';
import { COLORS, getPieceColor, isHybridPiece, getBasePieceType } from '../utils/constants.js';
import { calculateLegalMoves, isInCheck, wouldBeInCheck } from '../utils/moveCalculator.js';
import { makeMove, copyBoard, executeCombination } from '../utils/gameState.js';
import { findEligiblePairs, canReachForCombine, getHigherValuePiece, createHybridPiece } from '../utils/combinationRules.js';
import { canDeCombine, findSpawnSquares, computeLegalAssignments, getHybridComponents } from '../utils/deCombinationRules.js';
import { canCastle, executeCastleMove } from '../components/helpers/castlingLogic.js';
import { zobrist } from './zobrist.js';
import TranspositionTable, { FLAG_EXACT, FLAG_LOWER, FLAG_UPPER } from './TranspositionTable.js';
import { SEARCH_CONFIG } from './constants.js';

// Global transposition table (256 MB as per Phase 2B)
// Created once and reused across all searches
const transpositionTable = new TranspositionTable(SEARCH_CONFIG.TRANSPOSITION_TABLE_SIZE_MB);

// Node counter for performance analysis
let nodesSearched = 0;

/**
 * Find the best move for the current position using alpha-beta pruning
 * Now with transposition table support
 * 
 * @param {Object} gameState - Complete game state { board, currentTurn, castlingRights }
 * @param {number} depth - Search depth (ply)
 * @returns {Object|null} Best move object or null if no legal moves
 */
export const findBestMove = (gameState, depth) => {
    const { board, currentTurn, castlingRights } = gameState;

    // Reset TT stats and node counter for this search
    transpositionTable.resetStats();
    nodesSearched = 0;
    const startTime = performance.now();

    // Generate initial position hash
    const positionHash = zobrist.hashPosition(board, currentTurn, castlingRights, null);

    // Generate all legal moves
    const allMoves = getAllLegalMoves(board, currentTurn, castlingRights);

    if (allMoves.length === 0) {
        return null; // No legal moves (checkmate or stalemate)
    }

    // Order moves for better alpha-beta pruning
    const orderedMoves = orderMoves(board, allMoves, currentTurn);

    let bestMove = null;
    let bestScore = -Infinity;
    let alpha = -Infinity;
    const beta = Infinity;

    // Search each move
    for (const move of orderedMoves) {
        // Apply move and get updated castling rights
        const { newBoard, newCastlingRights } = applyMove(board, move, currentTurn, castlingRights);
        const newTurn = currentTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

        // Calculate new position hash using incremental update when possible
        let newHash;
        if (move.type === 'normal') {
            // Incremental hash update for normal moves (much faster than full rehash)
            const fromSquare = move.from.row * 8 + move.from.col;
            const toSquare = move.to.row * 8 + move.to.col;
            const fromPiece = board[move.from.row][move.from.col];
            const capturedPiece = board[move.to.row][move.to.col];
            
            newHash = zobrist.updateHashForNormalMove(
                positionHash,
                fromPiece,
                fromSquare,
                fromPiece, // piece after move (same unless promotion)
                toSquare,
                capturedPiece
            );
            
            // Update hash for castling rights changes (if any)
            newHash = updateHashForCastlingChanges(newHash, castlingRights, newCastlingRights);
        } else if (move.type === 'castling') {
            // Use specialized castling hash update
            newHash = zobrist.updateHashForCastling(positionHash, currentTurn, move.side === 'kingside');
            // Update for castling rights (both sides lost)
            newHash = updateHashForCastlingChanges(newHash, castlingRights, newCastlingRights);
        } else {
            // For complex moves (promotion, combine, decombine), fall back to full rehash
            newHash = zobrist.hashPosition(newBoard, newTurn, newCastlingRights, null);
        }

        // Recursively evaluate (opponent's turn, so we minimize)
        const score = -alphaBetaSearch(
            newBoard,
            newTurn,
            depth - 1,
            -beta,
            -alpha,
            newCastlingRights,
            newHash  // ✅ Pass position hash
        );

        // Update best move
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }

        // Alpha-beta update
        alpha = Math.max(alpha, score);
        if (alpha >= beta) {
            break; // Beta cutoff
        }
    }

    // Store root position in TT
    transpositionTable.store(positionHash, bestScore, depth, FLAG_EXACT, bestMove);

    // Log search statistics
    const endTime = performance.now();
    const stats = transpositionTable.getStats();
    const totalProbes = stats.hits + stats.misses + (stats.depthTooShallow || 0) + (stats.wrongBounds || 0) + (stats.moveHints || 0);
    const hitRate = totalProbes > 0 ? ((stats.hits / totalProbes) * 100).toFixed(2) : '0.00';
    const nps = Math.floor(nodesSearched / ((endTime - startTime) / 1000)); // Nodes per second

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 Search Statistics (Phase 2A - With TT)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⏱️  Time:        ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`📊 Depth:       ${depth} ply`);
    console.log(`🎯 Best Score:  ${bestScore} centipawns`);
    console.log(`📈 Nodes:       ${nodesSearched.toLocaleString()} (${nps.toLocaleString()} nps)`);
    console.log(`💾 TT Probes:   ${totalProbes.toLocaleString()}`);
    console.log(`   ✅ Hits:      ${stats.hits} (${hitRate}%)`);
    console.log(`      - Exact:   ${stats.exactHits || 0}`);
    console.log(`      - Lower:   ${stats.lowerHits || 0}`);
    console.log(`      - Upper:   ${stats.upperHits || 0}`);
    console.log(`   ❌ Misses:    ${stats.misses}`);
    console.log(`   ⚠️  Depth<:   ${stats.depthTooShallow || 0}`);
    console.log(`   ⚠️  Bounds:   ${stats.wrongBounds || 0}`);
    console.log(`      - Lower<β: ${stats.lowerFailedBeta || 0}`);
    console.log(`      - Upper>α: ${stats.upperFailedAlpha || 0}`);
    console.log(`   🎯 MoveHint:  ${stats.moveHints || 0}`);
    console.log(`💿 TT Stores:   ${stats.stores}`);
    console.log(`⚠️  Collisions:  ${stats.collisions}`);

    if (stats.hits > 0 && totalProbes > 0) {
        const hitPercent = (stats.hits / totalProbes * 100);
        if (hitPercent < 10) {
            console.log(`❌ Hit rate is LOW (${hitPercent.toFixed(1)}%) - TT may not be helping much`);
        } else if (hitPercent < 30) {
            console.log(`⚠️  Hit rate is MODERATE (${hitPercent.toFixed(1)}%) - some benefit`);
        } else {
            console.log(`✅ Hit rate is GOOD (${hitPercent.toFixed(1)}%) - significant speedup!`);
        }
    } else {
        console.log(`❌ NO TT HITS - Check flag logic and hash generation!`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return bestMove;
};

/**
 * Alpha-beta search with negamax framework and transposition table
 * 
 * @param {Array} board - Current board state
 * @param {string} currentTurn - Current player
 * @param {number} depth - Remaining search depth
 * @param {number} alpha - Alpha value (best for maximizer)
 * @param {number} beta - Beta value (best for minimizer)
 * @param {Object} castlingRights - Castling rights for both players
 * @param {BigInt} positionHash - Zobrist hash of current position
 * @returns {number} Position evaluation score
 */
export const alphaBetaSearch = (board, currentTurn, depth, alpha, beta, castlingRights, positionHash) => {
    // Increment node counter
    nodesSearched++;

    // Probe transposition table
    const ttEntry = transpositionTable.probe(positionHash, depth, alpha, beta);

    if (ttEntry && ttEntry.score !== undefined) {
        // TT hit with usable score - return immediately
        return ttEntry.score;
    }

    // Terminal depth or terminal position check
    const allMoves = getAllLegalMoves(board, currentTurn, castlingRights);
    const inCheck = isInCheck(board, currentTurn);

    if (depth === 0 || allMoves.length === 0) {
        // Leaf node - evaluate position
        const score = evaluatePosition(board, currentTurn, allMoves.length, inCheck);

        // Return from current player's perspective
        const finalScore = currentTurn === COLORS.WHITE ? score : -score;

        // Store leaf node evaluation in TT (FLAG_EXACT since it's a static eval)
        transpositionTable.store(positionHash, finalScore, depth, FLAG_EXACT, null);

        return finalScore;
    }

    // Order moves for better pruning (use TT move hint if available)
    const orderedMoves = orderMoves(board, allMoves, currentTurn, ttEntry?.move);

    let maxScore = -Infinity;
    let bestMove = null;
    const origAlpha = alpha; // Save original alpha to determine flag type

    // Search each move
    for (const move of orderedMoves) {
        // Apply move and get updated castling rights
        const { newBoard, newCastlingRights } = applyMove(board, move, currentTurn, castlingRights);
        const newTurn = currentTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

        // Calculate new position hash using incremental update when possible
        let newHash;
        if (move.type === 'normal') {
            // Incremental hash update for normal moves
            const fromSquare = move.from.row * 8 + move.from.col;
            const toSquare = move.to.row * 8 + move.to.col;
            const fromPiece = board[move.from.row][move.from.col];
            const capturedPiece = board[move.to.row][move.to.col];
            
            newHash = zobrist.updateHashForNormalMove(
                positionHash,
                fromPiece,
                fromSquare,
                fromPiece,
                toSquare,
                capturedPiece
            );
            
            // Update hash for castling rights changes
            newHash = updateHashForCastlingChanges(newHash, castlingRights, newCastlingRights);
        } else if (move.type === 'castling') {
            // Use specialized castling hash update
            newHash = zobrist.updateHashForCastling(positionHash, currentTurn, move.side === 'kingside');
            newHash = updateHashForCastlingChanges(newHash, castlingRights, newCastlingRights);
        } else {
            // For complex moves, fall back to full rehash
            newHash = zobrist.hashPosition(newBoard, newTurn, newCastlingRights, null);
        }

        // Recursive search (negamax: opponent's best is our worst)
        const score = -alphaBetaSearch(
            newBoard,
            newTurn,
            depth - 1,
            -beta,
            -alpha,
            newCastlingRights,
            newHash  // ✅ Pass position hash
        );

        if (score > maxScore) {
            maxScore = score;
            bestMove = move;
        }

        alpha = Math.max(alpha, score);

        // Beta cutoff (opponent won't allow this position)
        if (alpha >= beta) {
            // Fail-high: score >= beta
            transpositionTable.store(positionHash, maxScore, depth, FLAG_LOWER, bestMove);
            return maxScore;
        }
    }

    // Determine flag type based on whether we improved alpha
    let flag;
    if (maxScore <= origAlpha) {
        flag = FLAG_UPPER; // Fail-low: score <= alpha (no improvement)
    } else {
        flag = FLAG_EXACT; // Exact: alpha < score < beta (within window)
    }

    // Store in transposition table
    transpositionTable.store(positionHash, maxScore, depth, flag, bestMove);

    return maxScore;
};

/**
 * Generate all legal moves for a given position
 * Includes: normal moves, captures, castling, promotions, combinations, decombinations
 * 
 * @param {Array} board - 8x8 board array
 * @param {string} color - Color to generate moves for
 * @param {Object} castlingRights - Castling rights { white: {...}, black: {...} }
 * @returns {Array} Array of move objects
 */
export const getAllLegalMoves = (board, color, castlingRights) => {
    const allMoves = [];

    // ============================================
    // 1. STANDARD MOVES & CAPTURES
    // ============================================
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (!piece || getPieceColor(piece) !== color) continue;

            const moves = calculateLegalMoves(board, row, col, color);

            for (const move of moves) {
                // CRITICAL: Filter out moves that would leave king in check
                if (wouldBeInCheck(board, row, col, move.row, move.col, color)) {
                    continue; // Skip this move - it's illegal
                }

                const isPawn = piece.toLowerCase() === 'p';
                const promotionRank = color === COLORS.WHITE ? 0 : 7;

                // Check if this is a promotion move
                if (isPawn && move.row === promotionRank) {
                    // Generate 4 moves (one for each promotion piece)
                    const promotionPieces = ['q', 'r', 'b', 'n'];
                    const isWhite = color === COLORS.WHITE;

                    for (const promoPiece of promotionPieces) {
                        allMoves.push({
                            from: { row, col },
                            to: { row: move.row, col: move.col },
                            type: 'promotion',
                            promoteTo: isWhite ? promoPiece.toUpperCase() : promoPiece
                        });
                    }
                } else {
                    // Normal move or capture
                    allMoves.push({
                        from: { row, col },
                        to: { row: move.row, col: move.col },
                        type: 'normal'
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

    if (king && king.toLowerCase() === 'k' && getPieceColor(king) === color) {
        // Kingside castling
        if (canCastle(board, color, castlingRights, true)) {
            allMoves.push({
                from: { row: kingRow, col: 4 },
                to: { row: kingRow, col: 6 },
                type: 'castling',
                side: 'kingside'
            });
        }

        // Queenside castling
        if (canCastle(board, color, castlingRights, false)) {
            allMoves.push({
                from: { row: kingRow, col: 4 },
                to: { row: kingRow, col: 2 },
                type: 'castling',
                side: 'queenside'
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
            if (canReachForCombine(board, piece2.row, piece2.col, piece1.row, piece1.col, color)) {
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
            if (canReachForCombine(board, piece1.row, piece1.col, piece2.row, piece2.col, color)) {
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
            if (canReachForCombine(board, piece1.row, piece1.col, piece2.row, piece2.col, color)) {
                from = { row: piece1.row, col: piece1.col };
                to = { row: piece2.row, col: piece2.col };
                pieces = { piece1, piece2 };
            } else if (canReachForCombine(board, piece2.row, piece2.col, piece1.row, piece1.col, color)) {
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
            type: 'combine',
            pieces
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
                    if (wouldBeInCheck(board, row, col, spawnSquare.row, spawnSquare.col, color)) {
                        continue; // Skip this decombination - would leave king in check
                    }

                    allMoves.push({
                        from: { row, col },
                        to: { row: spawnSquare.row, col: spawnSquare.col },
                        type: 'decombine',
                        assignment: {
                            staying: chosen.stayingComponent,
                            spawning: chosen.spawningComponent
                        }
                    });
                }
            }
        }
    }

    // TODO Phase 2: En passant moves (currently not implemented in moveCalculator)

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
        case 'castling':
            newBoard = executeCastleMove(board, currentTurn, move.side === 'kingside');
            break;

        case 'promotion': {
            newBoard = copyBoard(board);
            newBoard[move.to.row][move.to.col] = move.promoteTo;
            newBoard[move.from.row][move.from.col] = '';
            break;
        }

        case 'combine': {
            const { piece1, piece2 } = move.pieces;

            // Anchor doesn't matter for AI (Option C from your answer)
            // Use piece1's square as anchor (arbitrary choice)
            const result = executeCombination(
                board,
                piece1.row,
                piece1.col,
                piece2.row,
                piece2.col,
                piece1.row,  // anchor row (doesn't matter for AI)
                piece1.col   // anchor col (doesn't matter for AI)
            );

            newBoard = result ? result.board : board;
            break;
        }

        case 'decombine': {
            newBoard = copyBoard(board);
            newBoard[move.from.row][move.from.col] = move.assignment.staying;
            newBoard[move.to.row][move.to.col] = move.assignment.spawning;
            break;
        }

        case 'normal':
        default:
            // Standard move (includes captures)
            newBoard = makeMove(board, move.from.row, move.from.col, move.to.row, move.to.col);
            break;
    }

    // Update castling rights based on the move
    const newCastlingRights = updateCastlingRights(board, move, currentTurn, castlingRights);

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
        black: { ...castlingRights.black }
    };

    const piece = board[move.from.row]?.[move.from.col];
    const capturedPiece = board[move.to.row]?.[move.to.col];

    // 1. If castling move, remove all rights for that player
    if (move.type === 'castling') {
        newRights[currentTurn] = { kingSide: false, queenSide: false };
        return newRights;
    }

    // 2. If king moves, remove all castling rights for that player
    if (piece && piece.toLowerCase() === 'k') {
        newRights[currentTurn] = { kingSide: false, queenSide: false };
    }

    // 3. If rook moves from starting square, remove that side's rights
    if (piece && piece.toLowerCase() === 'r') {
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
    if (capturedPiece && capturedPiece.toLowerCase() === 'r') {
        const opponentColor = currentTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
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
 * Update hash for castling rights changes
 * XORs out old rights and XORs in new rights
 * 
 * @param {BigInt} hash - Current hash
 * @param {Object} oldRights - Old castling rights
 * @param {Object} newRights - New castling rights
 * @returns {BigInt} Updated hash
 */
const updateHashForCastlingChanges = (hash, oldRights, newRights) => {
    let newHash = hash;
    
    // XOR out old rights
    if (oldRights.white.kingSide) {
        newHash ^= zobrist.castlingKeys.whiteKingSide;
    }
    if (oldRights.white.queenSide) {
        newHash ^= zobrist.castlingKeys.whiteQueenSide;
    }
    if (oldRights.black.kingSide) {
        newHash ^= zobrist.castlingKeys.blackKingSide;
    }
    if (oldRights.black.queenSide) {
        newHash ^= zobrist.castlingKeys.blackQueenSide;
    }
    
    // XOR in new rights
    if (newRights.white.kingSide) {
        newHash ^= zobrist.castlingKeys.whiteKingSide;
    }
    if (newRights.white.queenSide) {
        newHash ^= zobrist.castlingKeys.whiteQueenSide;
    }
    if (newRights.black.kingSide) {
        newHash ^= zobrist.castlingKeys.blackKingSide;
    }
    if (newRights.black.queenSide) {
        newHash ^= zobrist.castlingKeys.blackQueenSide;
    }
    
    return newHash;
};

/**
 * Count total legal moves for a position (for checkmate/stalemate detection)
 * 
 * @param {Array} board - Board state
 * @param {string} color - Color to count moves for
 * @param {Object} castlingRights - Castling rights
 * @returns {number} Number of legal moves
 */
export const countLegalMoves = (board, color, castlingRights) => {
    return getAllLegalMoves(board, color, castlingRights).length;
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

    const fromSquare = `${fileToLetter(move.from.col)}${rankToNumber(move.from.row)}`;
    const toSquare = `${fileToLetter(move.to.col)}${rankToNumber(move.to.row)}`;

    let notation = `${fromSquare}${toSquare}`;

    if (move.type === 'promotion') {
        notation += move.promoteTo.toLowerCase();
    } else if (move.type === 'castling') {
        notation = move.side === 'kingside' ? 'O-O' : 'O-O-O';
    } else if (move.type === 'combine') {
        notation += ' (combine)';
    } else if (move.type === 'decombine') {
        notation += ' (decombine)';
    }

    return notation;
};

/**
 * Get transposition table statistics
 * Useful for performance analysis and debugging
 * 
 * @returns {Object} TT statistics
 */
export const getTranspositionTableStats = () => {
    return transpositionTable.getStats();
};

/**
 * Clear the transposition table
 * Should be called when starting a new game
 */
export const clearTranspositionTable = () => {
    transpositionTable.clear();
    console.log('Transposition table cleared');
};

/**
 * Find best move using parallel search with web workers (Phase 2B)
 * Falls back to single-threaded search if workers unavailable
 * 
 * @param {Object} gameState - Complete game state
 * @param {number} depth - Search depth
 * @returns {Promise<Object|null>} Best move object or null
 */
export const findBestMoveParallel = async (gameState, depth) => {
    // Dynamically import WorkerManager to avoid circular dependencies
    const { default: workerManager } = await import('./WorkerManager.js');

    // Try to initialize workers if not already done
    const workersAvailable = await workerManager.initialize();

    if (!workersAvailable) {
        console.log('⚠️  Workers not available, falling back to single-threaded search');
        return findBestMove(gameState, depth);
    }

    const { board, currentTurn, castlingRights } = gameState;

    // Generate and order all legal moves
    const allMoves = getAllLegalMoves(board, currentTurn, castlingRights);

    if (allMoves.length === 0) {
        return null; // No legal moves
    }

    const orderedMoves = orderMoves(board, allMoves, currentTurn);

    try {
        // Search in parallel
        const result = await workerManager.searchParallel({
            board,
            currentTurn,
            castlingRights,
            moves: orderedMoves,
            depth
        });

        return result.bestMove;

    } catch (error) {
        console.error('❌ Parallel search failed:', error);
        console.log('⚠️  Falling back to single-threaded search');
        return findBestMove(gameState, depth);
    }
};
