"use client";

import { useState, useCallback } from "react";
import { PIECE_SYMBOLS } from "../../utils/constants.js";
import {
  calculateLegalMoves,
  wouldBeInCheck,
  isInCheck,
} from "../../utils/moveCalculator.js";
import {
  makeMove,
  switchTurn,
  isCurrentPlayersPiece,
  addMoveToHistory,
  addCapturedPiece,
  saveStateForUndo,
} from "../../utils/gameState.js";
import { canCastle, executeCastleMove } from "../helpers/castlingLogic.js";
import {
  announceTurn,
  announceError,
  capitalizeColor,
} from "../helpers/messageHelpers.js";

/**
 * Custom hook for handling normal chess moves (non-combine, non-decombine)
 */
export const useMoveHandler = (
  gameState,
  setGameState,
  setMessage,
  openPromotionDialog
) => {
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);

  // Handle castling move
  const executeCastle = useCallback(
    (kingSide) => {
      // Save state for undo
      const stateWithUndo = saveStateForUndo(gameState);

      const newBoard = executeCastleMove(
        gameState.board,
        gameState.currentTurn,
        kingSide
      );
      const newTurn = switchTurn(gameState.currentTurn);

      // Update castling rights - remove all rights for this player
      const newCastlingRights = {
        ...stateWithUndo.castlingRights,
        [gameState.currentTurn]: {
          kingSide: false,
          queenSide: false,
        },
      };

      // Add to move history
      const move = {
        type: "castle",
        side: kingSide ? "kingside" : "queenside",
        turn: gameState.currentTurn,
      };
      const newMoveHistory = addMoveToHistory(stateWithUndo.moveHistory, move);

      // Check if opponent is in check
      const opponentInCheck = isInCheck(newBoard, newTurn);
      let statusMessage = `${capitalizeColor(gameState.currentTurn)} castles ${
        kingSide ? "kingside" : "queenside"
      }! ${announceTurn(newTurn)}`;
      if (opponentInCheck) {
        statusMessage += " - CHECK!";
      }

      setGameState({
        ...stateWithUndo,
        board: newBoard,
        currentTurn: newTurn,
        moveHistory: newMoveHistory,
        castlingRights: newCastlingRights,
        enPassantTarget: null,
      });
      setMessage(statusMessage);
      setSelectedSquare(null);
      setLegalMoves([]);
    },
    [gameState, setGameState, setMessage]
  );

  // Handle square click for normal moves
  const handleSquareClick = useCallback(
    (row, col) => {
      const piece = gameState.board[row][col];

      // If a square is already selected
      if (selectedSquare) {
        const { row: fromRow, col: fromCol } = selectedSquare;
        const movingPiece = gameState.board[fromRow][fromCol];

        // Check for castling attempt
        const isKing = movingPiece.toLowerCase() === "k";
        if (isKing) {
          const rank = gameState.currentTurn === "white" ? 7 : 0;
          const clickedPiece = gameState.board[row][col];

          // Check if clicking on own rook (traditional castling)
          if (
            row === rank &&
            clickedPiece &&
            clickedPiece.toLowerCase() === "r" &&
            isCurrentPlayersPiece(clickedPiece, gameState.currentTurn)
          ) {
            const isKingSide = col === 7;
            const isQueenSide = col === 0;

            if (
              isKingSide &&
              canCastle(
                gameState.board,
                gameState.currentTurn,
                gameState.castlingRights,
                true
              )
            ) {
              executeCastle(true);
              return;
            } else if (
              isQueenSide &&
              canCastle(
                gameState.board,
                gameState.currentTurn,
                gameState.castlingRights,
                false
              )
            ) {
              executeCastle(false);
              return;
            } else {
              setMessage(announceError("Cannot castle in this position"));
              return;
            }
          }

          // Check if clicking 2 squares away (modern castling)
          if (row === rank && fromCol === 4) {
            if (
              col === 6 &&
              canCastle(
                gameState.board,
                gameState.currentTurn,
                gameState.castlingRights,
                true
              )
            ) {
              executeCastle(true);
              return;
            } else if (
              col === 2 &&
              canCastle(
                gameState.board,
                gameState.currentTurn,
                gameState.castlingRights,
                false
              )
            ) {
              executeCastle(false);
              return;
            }
          }
        }

        // Check if clicked square is a legal move
        const isLegalMove = legalMoves.some(
          (move) => move.row === row && move.col === col
        );

        if (isLegalMove) {
          // Check if move would put king in check
          if (
            wouldBeInCheck(
              gameState.board,
              fromRow,
              fromCol,
              row,
              col,
              gameState.currentTurn,
              gameState.enPassantTarget
            )
          ) {
            setMessage(
              announceError(
                `Illegal move: ${capitalizeColor(
                  gameState.currentTurn
                )} king would be in check!`
              )
            );
            setSelectedSquare(null);
            setLegalMoves([]);
            return;
          }

          // Check if this is a pawn promotion
          const isPawn = movingPiece.toLowerCase() === "p";
          const promotionRank = gameState.currentTurn === "white" ? 0 : 7;

          if (isPawn && row === promotionRank) {
            const capturedPiece = gameState.board[row][col];
            openPromotionDialog(fromRow, fromCol, row, col, capturedPiece);
            setSelectedSquare(null);
            setLegalMoves([]);
            return;
          }

          // Save state for undo
          const stateWithUndo = saveStateForUndo(gameState);

          // Check if this is an en passant capture
          const isEnPassantCapture = isPawn &&
            gameState.enPassantTarget &&
            row === gameState.enPassantTarget.row &&
            col === gameState.enPassantTarget.col &&
            !gameState.board[row][col];

          // Execute the move
          let capturedPiece = gameState.board[row][col];
          const newBoard = makeMove(
            gameState.board,
            fromRow,
            fromCol,
            row,
            col
          );

          // Handle en passant: remove the captured pawn
          if (isEnPassantCapture) {
            capturedPiece = gameState.board[fromRow][col]; // The pawn being captured
            newBoard[fromRow][col] = ''; // Remove the captured pawn
          }

          const newTurn = switchTurn(gameState.currentTurn);

          // Compute en passant target for next move
          let newEnPassantTarget = null;
          if (isPawn && Math.abs(row - fromRow) === 2) {
            // Pawn moved two squares — set en passant target to the square it passed through
            const epRow = (fromRow + row) / 2;
            newEnPassantTarget = { row: epRow, col: col };
          }

          // Update castling rights
          let newCastlingRights = { ...stateWithUndo.castlingRights };
          const movingPieceType = movingPiece.toLowerCase();

          if (movingPieceType === "k") {
            newCastlingRights[gameState.currentTurn] = {
              kingSide: false,
              queenSide: false,
            };
          } else if (movingPieceType === "r") {
            const rank = gameState.currentTurn === "white" ? 7 : 0;
            if (fromRow === rank) {
              if (fromCol === 7) {
                newCastlingRights[gameState.currentTurn].kingSide = false;
              } else if (fromCol === 0) {
                newCastlingRights[gameState.currentTurn].queenSide = false;
              }
            }
          }

          // If rook was captured, update opponent's castling rights
          if (capturedPiece && capturedPiece.toLowerCase() === "r") {
            const opponentColor =
              gameState.currentTurn === "white" ? "black" : "white";
            const opponentRank = opponentColor === "white" ? 7 : 0;
            if (row === opponentRank) {
              if (col === 7) {
                newCastlingRights[opponentColor].kingSide = false;
              } else if (col === 0) {
                newCastlingRights[opponentColor].queenSide = false;
              }
            }
          }

          // Update captured pieces
          let newCapturedPieces = stateWithUndo.capturedPieces;
          if (capturedPiece) {
            newCapturedPieces = addCapturedPiece(
              stateWithUndo.capturedPieces,
              capturedPiece
            );
          }

          // Add to move history
          const move = {
            from: { row: fromRow, col: fromCol },
            to: { row, col },
            piece: gameState.board[fromRow][fromCol],
            captured: capturedPiece,
            turn: gameState.currentTurn,
          };
          const newMoveHistory = addMoveToHistory(
            stateWithUndo.moveHistory,
            move
          );

          // Check if opponent is in check
          const opponentInCheck = isInCheck(newBoard, newTurn);
          let statusMessage = announceTurn(newTurn);
          if (opponentInCheck) {
            statusMessage += " - CHECK!";
          }

          setGameState({
            ...stateWithUndo,
            board: newBoard,
            currentTurn: newTurn,
            moveHistory: newMoveHistory,
            capturedPieces: newCapturedPieces,
            castlingRights: newCastlingRights,
            enPassantTarget: newEnPassantTarget,
          });
          setMessage(statusMessage);
          setSelectedSquare(null);
          setLegalMoves([]);
        } else if (
          piece &&
          isCurrentPlayersPiece(piece, gameState.currentTurn)
        ) {
          // Select a different piece
          const moves = calculateLegalMoves(
            gameState.board,
            row,
            col,
            gameState.currentTurn,
            gameState.enPassantTarget
          );
          const safeMoves = moves.filter(
            (move) =>
              !wouldBeInCheck(
                gameState.board,
                row,
                col,
                move.row,
                move.col,
                gameState.currentTurn,
                gameState.enPassantTarget
              )
          );

          // Add castling destinations if king is selected
          if (piece.toLowerCase() === "k") {
            const rank = gameState.currentTurn === "white" ? 7 : 0;
            if (
              canCastle(
                gameState.board,
                gameState.currentTurn,
                gameState.castlingRights,
                true
              )
            ) {
              safeMoves.push({ row: rank, col: 6 });
            }
            if (
              canCastle(
                gameState.board,
                gameState.currentTurn,
                gameState.castlingRights,
                false
              )
            ) {
              safeMoves.push({ row: rank, col: 2 });
            }
          }

          setSelectedSquare({ row, col });
          setLegalMoves(safeMoves);

          // Check if king is in check and preserve that in the message
          const inCheck = isInCheck(gameState.board, gameState.currentTurn);
          if (inCheck) {
            setMessage(`CHECK! Move your King to safety or block the attack.`);
          } else {
            setMessage(
              `Selected ${PIECE_SYMBOLS[piece]}. Click a highlighted square to move.`
            );
          }
        } else {
          // Deselect
          setSelectedSquare(null);
          setLegalMoves([]);

          // Check if king is still in check after deselect
          const inCheck = isInCheck(gameState.board, gameState.currentTurn);
          if (inCheck) {
            setMessage(
              `${capitalizeColor(gameState.currentTurn)} is in check!`
            );
          } else {
            setMessage(announceTurn(gameState.currentTurn));
          }
        }
      } else {
        // No square selected yet
        if (piece && isCurrentPlayersPiece(piece, gameState.currentTurn)) {
          const moves = calculateLegalMoves(
            gameState.board,
            row,
            col,
            gameState.currentTurn,
            gameState.enPassantTarget
          );
          const safeMoves = moves.filter(
            (move) =>
              !wouldBeInCheck(
                gameState.board,
                row,
                col,
                move.row,
                move.col,
                gameState.currentTurn,
                gameState.enPassantTarget
              )
          );

          // Add castling destinations if king is selected
          if (piece.toLowerCase() === "k") {
            const rank = gameState.currentTurn === "white" ? 7 : 0;
            if (
              canCastle(
                gameState.board,
                gameState.currentTurn,
                gameState.castlingRights,
                true
              )
            ) {
              safeMoves.push({ row: rank, col: 6 });
            }
            if (
              canCastle(
                gameState.board,
                gameState.currentTurn,
                gameState.castlingRights,
                false
              )
            ) {
              safeMoves.push({ row: rank, col: 2 });
            }
          }

          setSelectedSquare({ row, col });
          setLegalMoves(safeMoves);

          // Check if king is in check and preserve that in the message
          const inCheck = isInCheck(gameState.board, gameState.currentTurn);
          if (inCheck) {
            setMessage(`CHECK! Move your King to safety or block the attack.`);
          } else {
            setMessage(
              `Selected ${PIECE_SYMBOLS[piece]}. Click a highlighted square to move.`
            );
          }
        }
      }
    },
    [
      gameState,
      selectedSquare,
      legalMoves,
      executeCastle,
      setGameState,
      setMessage,
      openPromotionDialog,
    ]
  );

  // Helper functions
  const isSelected = useCallback(
    (row, col) => {
      return (
        selectedSquare &&
        selectedSquare.row === row &&
        selectedSquare.col === col
      );
    },
    [selectedSquare]
  );

  const isLegalMoveSquare = useCallback(
    (row, col) => {
      return legalMoves.some((move) => move.row === row && move.col === col);
    },
    [legalMoves]
  );

  const clearSelection = useCallback(() => {
    setSelectedSquare(null);
    setLegalMoves([]);
  }, []);

  return {
    selectedSquare,
    legalMoves,
    handleSquareClick,
    isSelected,
    isLegalMoveSquare,
    clearSelection,
  };
};
