import { createServer } from "node:http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import Timer from "./timer";

const hostname = "localhost";

const port = process.env.PORT || 3000;
const httpServer = createServer();

const rooms = new Map();
const waitingQueues = {
  rapid: [],
  blitz: [],
  bullet: [],
};

const io = new Server(httpServer, {
  cors: {
    origin: "https://chess-app-beryl.vercel.app",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("a user connected");
  // 매칭 요청
  socket.on("joinQueue", ({ user, gameMode }) => {
    if (!waitingQueues[gameMode]) {
      console.error(`Invalid game mode: ${gameMode}`);
      return;
    }

    waitingQueues[gameMode].push({ socketId: socket.id, ...user });
    const match = tryToMatch(waitingQueues[gameMode], gameMode);

    // 적합한 매칭이 있다면
    if (match) {
      const { player1, player2 } = match;
      console.log(player1);
      const player1Color = Math.random() < 0.5 ? "white" : "black";
      const player2Color = player1Color === "white" ? "black" : "white";
      const roomId = uuidv4();

      const initialTime = getInitialTime(gameMode); // 초기 시간 가져오기

      // 방 입장
      [player1, player2].forEach((player) =>
        io.to(player.socketId).socketsJoin(roomId)
      );

      rooms.set(roomId, {
        roomId,
        players: [
          {
            id: player1.socketId,
            username: player1.username,
            color: player1Color,
          },
          {
            id: player2.socketId,
            username: player2.username,
            color: player2Color,
          },
        ],
        // timers: { white: initialTime, black: initialTime },
        timers: {
          white: new Timer(initialTime),
          black: new Timer(initialTime),
        },
        lastMoveTime: Date.now(),
        currentTurn: "white",
      });

      io.to(player1.socketId).emit("matchFound", {
        opponent: player2,
        color: player1Color,
        gameMode,
        roomId,
        initialTime,
      });

      io.to(player2.socketId).emit("matchFound", {
        opponent: player1,
        color: player2Color,
        gameMode,
        roomId,
        initialTime,
      });

      const room = rooms.get(roomId);
      room.timers.white.start();
    } else {
      console.log("No match found, added to queue");
    }
  });

  // 매칭 취소
  socket.on("cancelMatching", (gameMode) => {
    if (!waitingQueues[gameMode]) {
      console.error(`Invalid game mode: ${gameMode}`);
      return;
    }

    const index = waitingQueues[gameMode].findIndex(
      (player) => player.socketId === socket.id
    );
    if (index !== -1) {
      waitingQueues[gameMode].splice(index, 1);
      console.log(`User removed from ${gameMode} queue`);
    }
  });

  // 체스말 움직임
  socket.on("move", (data) => {
    console.log("data : ", data);

    const room = rooms.get(data.room);
    if (!room) return;
    console.log("room: ", room);

    const now = Date.now();
    console.log(now);
    const elapsedTime = (now - room.lastMoveTime) / 1000; // 경과 시간 (초 단위)
    console.log(elapsedTime);
    room.timers[room.currentTurn] -= elapsedTime; // 현재 턴의 타이머 감소

    if (room.timers[room.currentTurn] <= 0) {
      io.to(room.roomId).emit("gameOver", {
        winner: room.currentTurn === "white" ? "black" : "white",
        reason: "timeout",
      });
      // rooms.delete(room.roomId);
      return;
    }

    room.lastMoveTime = now;
    room.currentTurn = room.currentTurn === "white" ? "black" : "white";

    socket.to(data.room).emit("move", data.move);
  });

  socket.on("getRoomInfo", (roomId, callback) => {
    const room = rooms.get(roomId);
    if (!room) return callback({ error: "Room not found" });

    callback(room);
  });

  socket.on("getTimers", (roomId, callback) => {
    const room = rooms.get(roomId);
    if (!room) return callback({ error: "Room not found" });

    // const now = Date.now();
    // const elapsedTime = (now - room.lastMoveTime) / 1000; // 경과 시간 (초 단위)
    // const timers = { ...room.timers };
    const timers = room.timers;
    // timers[room.currentTurn] -= elapsedTime;

    // if (room.timers[room.currentTurn] <= 0) {
    // io.to(room.roomId).emit("gameOver", {
    // winner: room.currentTurn === "white" ? "black" : "white",
    // reason: "timeout",
    // });
    // rooms.delete(room.roomId);
    // return;
    // }

    callback({ timers });
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
    const gameRooms = Array.from(rooms.values());
    gameRooms.forEach((room) => {
      console.log("disconnect room : ", room);
      const userInRoom = room.players.find((player) => player.id === socket.id);

      if (userInRoom) {
        if (room.players.length < 2) {
          rooms.delete(room.roomId);
          return;
        }

        socket.to(room.roomId).emit("playerDisconnected", userInRoom);
      }
    });
  });
});

httpServer
  .once("error", (err) => {
    console.error(err);
    process.exit(1);
  })
  .listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });

// 매칭 로직
// tryToMatch 함수 수정: 매칭된 플레이어들 반환
function tryToMatch(waitingQueue, gameMode) {
  if (waitingQueue.length < 2) return null; // 대기열에 2명 미만이면 null 반환

  // 대기열을 순차적으로 확인
  for (let i = 0; i < waitingQueue.length; i++) {
    const player1 = waitingQueue[i];
    console.log("대기열비교");
    console.log(player1);

    for (let j = i + 1; j < waitingQueue.length; j++) {
      const player2 = waitingQueue[j];

      // 현재 게임 모드에 따른 레이팅 참조
      const player1Rating = getRatingByMode(player1, gameMode);
      const player2Rating = getRatingByMode(player2, gameMode);
      console.log(player1Rating);
      console.log(player2Rating);

      // 레이팅 차이가 100 이내인지 확인
      if (Math.abs(player1Rating - player2Rating) <= 100) {
        console.log("점수차 확인성공");

        // 매칭된 플레이어들 제거
        waitingQueue.splice(j, 1); // player2 제거 (뒤에서부터 제거)
        waitingQueue.splice(i, 1); // player1 제거

        // 매칭된 플레이어들 반환
        return { player1, player2 };
      }
    }
  }

  // 적합한 매칭이 없으면 null 반환
  console.log("No suitable match found. Waiting...");
  return null;
}

// 게임 모드에 따른 레이팅 가져오기
function getRatingByMode(player, gameMode) {
  switch (gameMode) {
    case "rapid":
      return player.rapidRating;
    case "blitz":
      return player.blitzRating;
    case "bullet":
      return player.bulletRating;
    default:
      throw new Error(`Unknown game mode: ${gameMode}`);
  }
}

// 게임 모드에 따른 초기 시간 가져오기
function getInitialTime(gameMode) {
  switch (gameMode) {
    case "rapid":
      return 10 * 60; // 10분
    case "blitz":
      return 3 * 60; // 3분
    case "bullet":
      return 1 * 60; // 1분
    default:
      throw new Error(`Unknown game mode: ${gameMode}`);
  }
}
