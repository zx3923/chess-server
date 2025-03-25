import Timer, { timeString } from "./timer.js";
import { Chess } from "chess.js";
// import { soundPlayer } from "./sound";
import EventEmitter from "events";

class Game extends EventEmitter {
  constructor(gameType, startingTime, player1, player2) {
    super();
    this.chess = new Chess();
    // this.userColor = userColor;
    this.currentPlayer = "white";
    this.player1 = player1;
    this.player2 = player2;
    this.gameType = gameType;
    this.timers = {
      white: new Timer(startingTime),
      black: new Timer(startingTime),
    };
    this.isGameOver = false;
    this.isGameStarted = false;
    this.currentPiece = "";
    this.winner = "";
    this.isSurrender = false;
    this.moveHistory = [];
    this.gameDuration = new Timer(0);
    this.showWinBar = false;
    this.showBestMoves = false;
    this.winChance = 50;
    this.bestMove = [];
    this.roomId = "";
    this.currentMove = "";
    this.moveNumber = -1;
    this.eloResult = 0;
    this.notation = [];
  }
  play() {
    if (!this.isGameStarted) {
      // soundPlayer.start();
      this.isGameStarted = true;
      this.isGameOver = false;
      this.gameDuration.start();
      // this.emit("gameStart");
      if (this.getGameType() !== "playerVsComputer") {
        this.timers[this.currentPlayer].start();
      }
      console.log("Game started");
    }
  }
  stop() {
    if (this.isGameStarted) {
      this.isGameStarted = false;
      this.timers.white.stop();
      this.timers.black.stop();
      console.log("Game stopped");
    }
  }
  surrender(color) {
    this.isSurrender = true;
    this.winner = color === "white" ? "black" : "white";
    this.handleGameOver();
  }
  // 체스 말 움직임
  makeMove(move) {
    if (!this.isGameStarted || this.isGameOver) {
      return false;
    }
    this.updateNotation(move);
    if (this.gameType === "playerVsComputer") {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      try {
        const result = this.chess.move(move);
        this.currentMove = result;
        if (result) {
          // soundPlayer.playMoveSound(result);
          // this.emit("move", result, this.chess.history({ verbose: true }));
          this.switchPlayer();
          if (this.chess.isGameOver()) {
            this.handleGameOver();
          }
          return true;
        } else {
          return false;
        }
      } catch (e) {
        console.error(e);
        return false;
      }
    } else {
      try {
        const result = this.chess.move(move);
        this.currentMove = result;
        if (result) {
          // this.emit("move", result, this.chess.history({ verbose: true }));
          this.timers[this.currentPlayer].stop(); // 현재 플레이어의 타이머 정지
          this.switchPlayer();
          this.timers[this.currentPlayer].start(); // 다음 플레이어의 타이머 시작
          if (this.chess.isGameOver()) {
            this.handleGameOver();
            if (this.chess.isCheckmate()) {
              console.log(
                `Checkmate! ${
                  this.chess.turn() === "w" ? "black" : "white"
                } wins!`
              );
            } else if (this.chess.isDraw()) {
              console.log("Draw");
            } else {
              console.log("Game over");
            }
          }
          return true;
        }
        return false;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        // console.error(e);
        return false;
      }
    }
  }
  // 컴퓨터 대결 시 컴퓨터 움직임
  async makeComputerMove() {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    await sleep(1300);
    const data = await postChessApi({
      fen: this.chess.fen(),
      depth: 1,
      maxThinkingTime: 1,
      searchmoves: "",
    });
    const move = this.chess.move({ from: data.from, to: data.to });
    this.updateNotation(move);
    if (move) {
      // this.emit("computerMove", move);
      // this.emit("move", move, this.chess.history({ verbose: true }));
      this.switchPlayer();
    }
    if (this.showWinBar) {
      await this.setWinChanceAndBestMove();
    }
    if (this.showBestMoves) {
      // this.bestMove = [[data.from, data.to, "#9fcf38"]];
      // await this.setWinChanceAndBestMove();
      // this.emit("bestMove");
    }
    if (this.chess.isGameOver()) {
      this.handleGameOver();
    }
    return data;
  }
  // 게임종료 핸들러
  handleGameOver() {
    this.isGameOver = true;
    this.isGameStarted = false;
    this.gameDuration.endGame();
    this.gameDuration.stop();
    this.stop();
    if (this.isSurrender) {
      // this.winner = this.currentPlayer === "white" ? "black" : "white";
      if (this.winner === this.player1.color) {
        this.eloResult = this.calculateEloChange(
          this.player1.rating,
          this.player2.rating
        );
      } else {
        this.eloResult = this.calculateEloChange(
          this.player2.rating,
          this.player1.rating
        );
      }
    } else {
      if (this.chess.isCheckmate()) {
        console.log("player", this.player1);
        console.log(
          `Checkmate! Winner: ${
            this.currentPlayer === "white" ? "black" : "white"
          }`
        );
        this.winner = this.currentPlayer === "white" ? "black" : "white";
        if (this.winner === this.player1.color) {
          this.eloResult = this.calculateEloChange(
            this.player1.rating,
            this.player2.rating
          );
        } else {
          this.eloResult = this.calculateEloChange(
            this.player2.rating,
            this.player1.rating
          );
        }
      } else if (this.chess.isDraw()) {
        this.winner = "draw";
        console.log("Draw");
        // soundPlayer.stalemate();
      } else {
        // console.log("Game over");
        if (this.checkTimeout() === this.player1.color) {
          this.winner = this.player2.color;
          this.eloResult = this.calculateEloChange(
            this.player2.rating,
            this.player1.rating
          );
        } else {
          this.winner = this.player1.color;
          this.eloResult = this.calculateEloChange(
            this.player1.rating,
            this.player2.rating
          );
        }
      }
    }
    // this.emit("gameOver", this.chess.isCheckmate());
    // this.triggerGameOver();
  }

  updateNotation(move) {
    if (this.currentPlayer === "white") {
      this.notation.push({
        moveNumber: this.moveNumber + 1,
        whiteMove: move.to,
        blackMove: "",
      });
    } else {
      if (this.notation.length > 0) {
        this.notation[this.notation.length - 1].blackMove = move.to;
      }
    }
    this.moveNumber++;
  }

  // 칸 클릭 핸들러 - 경로 미리 보여주기 용
  handleSquareClick(square) {
    // 현재 클릭한 칸에 있는 기물이 무엇인지 확인
    const moves = this.chess.moves({ square, verbose: true });
    const newMoveSquares = {};
    moves.forEach((move) => {
      newMoveSquares[move.to] = {
        boxShadow: "inset 0 0 1px 6px rgba(255,255,255)",
      };
    });
    return newMoveSquares;
  }
  // 시간종료 확인
  checkTimeout() {
    if (this.timers.white.getTime() <= 0) return "white";
    if (this.timers.black.getTime() <= 0) return "black";
    return null;
  }
  restartGame() {
    if (!this.isGameStarted) {
      // this.isSurrender = false;
      // this.currentPlayer = "white";
      // this.chess.reset();
      // this.gameDuration.reset();
      this.gameInit();
    }
    this.play();
  }
  gameInit() {
    this.isGameStarted = false;
    this.isSurrender = false;
    this.currentPlayer = "white";
    this.chess.reset();
    this.gameDuration.reset();
  }

  calculateEloChange(winnerRating, loserRating) {
    const K = 20; // 기본 변동 계수 (K값) K값이 클수록 변동폭이 크다.

    // 기대 승률 계산 (Elo 공식)
    const expectedWinRate =
      1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));

    // 점수 변화량 계산
    const ratingChange = Math.round(K * (1 - expectedWinRate));

    return ratingChange;
  }
  // 턴 변경
  switchPlayer() {
    this.currentPlayer = this.currentPlayer === "white" ? "black" : "white";
  }
  getNotation() {
    return this.notation;
  }
  increaseMoveNumber() {
    this.moveNumber += 1;
  }
  // 보드상황
  getCurrentBoard() {
    return this.chess.fen();
  }
  setCurrentBoard() {
    // this.emit("reload", fen);
  }
  // 현재 플레이어
  getCurrentPlayer() {
    return this.currentPlayer;
  }
  setTimers(timer) {
    this.timers = {
      white: new Timer(timer),
      black: new Timer(timer),
    };
    // this.emit("gameType");
  }
  getTimers() {
    return {
      white: this.timers.white.getTime(),
      black: this.timers.black.getTime(),
    };
  }
  getRoomId() {
    return this.roomId;
  }
  setRoomId(roomId) {
    this.roomId = roomId;
  }
  getMoveNumber() {
    return this.moveNumber;
  }
  setMoveNumber(num) {
    this.moveNumber = num;
  }
  getCurrentMove() {
    return this.currentMove;
  }
  getIsGameStarted() {
    return this.isGameStarted;
  }
  setIsGameStarted(boolean) {
    this.isGameStarted = boolean;
  }
  getIsGameOver() {
    return this.isGameOver;
  }
  setGameType(gameType) {
    this.gameType = gameType;
  }
  getGameType() {
    return this.gameType;
  }
  getEloResult() {
    return this.eloResult;
  }
  // setUserColor(userColor) {
  //   this.userColor = userColor;
  // }
  // getUserColor() {
  //   return this.userColor;
  // }
  setMoveHistory() {
    this.moveHistory = this.chess.history();
  }
  getMoveHistory() {
    this.setMoveHistory();
    return this.moveHistory;
  }
  getIsSurrender() {
    return this.isSurrender;
  }
  getGameDuration() {
    const totalGameTime = this.gameDuration.getTotalGameTime();
    const totalGameTimeString = timeString(totalGameTime / 1000);
    return totalGameTimeString;
  }
  // 현재 클릭 한 말
  setCurrentPieceSquare(piece) {
    this.currentPiece = piece;
  }
  getCurrentPieceSquare() {
    return this.currentPiece;
  }
  getWinner() {
    return this.winner;
  }
  getShowBestMoves() {
    return this.showBestMoves;
  }
  setShowBestMoves(state) {
    // this.emit("showBestMoves", state);
    this.showBestMoves = state;
  }
  getShowWinBar() {
    // this.emit("reload");
    return this.showWinBar;
  }
  setShowWinBar(state) {
    this.showWinBar = state;
    // this.emit("showWinBar");
  }
  getWinChance() {
    return this.winChance;
  }
  async setWinChanceAndBestMove(winChance) {
    if (winChance) {
      this.winChance = Number(winChance);
    } else {
      const data = await postChessApi({
        fen: this.chess.fen(),
        depth: 18,
        maxThinkingTime: 100,
        variants: 5,
      });
      console.log(data);
      this.winChance = Number(data.winChance);
      this.bestMove = [[data.from, data.to, "#9fcf38"]];
    }
  }
  getBestMove() {
    return this.bestMove;
  }
}
export default Game;
// 체스엔진 테스트 api
export async function postChessApi(data = {}) {
  const response = await fetch("https://chess-api.com/v1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return response.json();
}
