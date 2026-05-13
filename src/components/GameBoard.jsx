import { useEffect, useState } from "react";
import CategoryInput from "./CategoryInput";
import Timer from "./Timer";

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const roomStoragePrefix = "ncc-room-";

function getRandomLetter() {
  const randomIndex = Math.floor(Math.random() * letters.length);
  return letters[randomIndex];
}

function getRoomStorageKey(roomKey) {
  return `${roomStoragePrefix}${roomKey.toUpperCase()}`;
}

function getSavedRoom(roomKey) {
  const savedRoom = localStorage.getItem(getRoomStorageKey(roomKey));
  return savedRoom ? JSON.parse(savedRoom) : null;
}

function GameBoard({ session, onLeaveRoom }) {
  const [room, setRoom] = useState(() => getSavedRoom(session.roomKey));
  const [letter, setLetter] = useState(null);
  const [answers, setAnswers] = useState({});
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const categories = room?.categories || [];
  const players = room?.players || {};
  const opponentEntry = Object.entries(players).find(([id]) => id !== session.playerId);
  const opponentName = opponentEntry?.[1] || "In attesa";

  useEffect(() => {
    function syncRoom(nextRoom) {
      if (!nextRoom || nextRoom.status === "cancelled") {
        onLeaveRoom();
        return;
      }

      setRoom(nextRoom);
      setLetter(nextRoom.letter);
      setGameStarted(nextRoom.status === "playing");
      setGameEnded(nextRoom.status === "ended");
      setAnswers(nextRoom.answers?.[session.playerId] || {});
    }

    const savedRoom = getSavedRoom(session.roomKey);
    if (savedRoom) syncRoom(savedRoom);

    function handleStorage(event) {
      if (event.key !== getRoomStorageKey(session.roomKey)) return;

      if (!event.newValue) {
        onLeaveRoom();
        return;
      }

      syncRoom(JSON.parse(event.newValue));
    }

    const channel = new BroadcastChannel(`ncc-room-${session.roomKey}`);
    function handleMessage(event) {
      syncRoom(event.data);
    }

    channel.addEventListener("message", handleMessage);
    window.addEventListener("storage", handleStorage);

    return () => {
      channel.removeEventListener("message", handleMessage);
      window.removeEventListener("storage", handleStorage);
      channel.close();
    };
  }, [onLeaveRoom, session.playerId, session.roomKey]);

  function updateRoom(updater) {
    setRoom((currentRoom) => {
      const baseRoom = currentRoom || getSavedRoom(session.roomKey);
      const nextRoom = updater(baseRoom);

      localStorage.setItem(getRoomStorageKey(session.roomKey), JSON.stringify(nextRoom));
      const channel = new BroadcastChannel(`ncc-room-${session.roomKey}`);
      channel.postMessage(nextRoom);
      channel.close();
      return nextRoom;
    });
  }

  function startGame() {
    const newLetter = getRandomLetter();
    const emptyAnswers = {};

    categories.forEach((category) => {
      emptyAnswers[category] = "";
    });

    setLetter(newLetter);
    setAnswers(emptyAnswers);
    setGameStarted(true);
    setGameEnded(false);
    updateRoom((currentRoom) => ({
      ...currentRoom,
      letter: newLetter,
      status: "playing",
      answers: Object.keys(currentRoom.players).reduce((nextAnswers, playerId) => {
        nextAnswers[playerId] = { ...emptyAnswers };
        return nextAnswers;
      }, {})
    }));
  }

  function handleAnswerChange(category, value) {
    const nextAnswers = {
      ...answers,
      [category]: value
    };

    setAnswers(nextAnswers);
    updateRoom((currentRoom) => ({
      ...currentRoom,
      answers: {
        ...currentRoom.answers,
        [session.playerId]: nextAnswers
      }
    }));
  }

  function endGame() {
    setGameEnded(true);
    setGameStarted(false);
    updateRoom((currentRoom) => ({
      ...currentRoom,
      status: "ended"
    }));
  }

  function cancelGame() {
    const cancelledRoom = {
      ...(room || {}),
      key: session.roomKey,
      status: "cancelled"
    };
    const channel = new BroadcastChannel(`ncc-room-${session.roomKey}`);

    channel.postMessage(cancelledRoom);
    channel.close();
    localStorage.removeItem(getRoomStorageKey(session.roomKey));
    onLeaveRoom();
  }

  return (
    <main className="game-container">
      <h1>Nomi, Cose, Citta</h1>

      <section className="room-status">
        <div>
          <span>Stanza</span>
          <strong>{session.roomKey}</strong>
        </div>
        <div>
          <span>Tu</span>
          <strong>{session.playerName}</strong>
        </div>
        <div>
          <span>Avversario</span>
          <strong>{opponentName}</strong>
        </div>
      </section>

      {!gameStarted && !gameEnded && (
        <>
          <p className="helper-text">
            Dai questa chiave all'altro giocatore. Quando entra, potete iniziare la manche.
          </p>
          <div className="room-actions">
            <button className="primary-button" onClick={startGame} disabled={!opponentEntry}>
              Inizia partita
            </button>
            <button className="danger-button" onClick={cancelGame}>
              Annulla partita
            </button>
          </div>
        </>
      )}

      {letter && (
        <section className="letter-box">
          <span>Lettera estratta</span>
          <strong>{letter}</strong>
        </section>
      )}

      {gameStarted && (
        <>
          <Timer
            key={letter}
            initialSeconds={120}
            isRunning={gameStarted}
            onTimeEnd={endGame}
          />

          <div className="categories-grid">
            {categories.map((category) => (
              <CategoryInput
                key={category}
                category={category}
                value={answers[category] || ""}
                onChange={handleAnswerChange}
                disabled={gameEnded}
              />
            ))}
          </div>

          <button className="danger-button" onClick={endGame}>
            Termina manche
          </button>
        </>
      )}

      {gameEnded && (
        <section className="results-box">
          <h2>Risposte manche</h2>
          <div className="result-row result-header">
            <strong>Categoria</strong>
            <span>{session.playerName}</span>
            {opponentEntry && <span>{opponentEntry[1]}</span>}
          </div>

          {categories.map((category) => (
            <div key={category} className="result-row">
              <strong>{category}:</strong>
              <span>{answers[category] || "Nessuna risposta"}</span>
              {opponentEntry && (
                <span>{room.answers?.[opponentEntry[0]]?.[category] || "Avversario vuoto"}</span>
              )}
            </div>
          ))}

          <button className="primary-button" onClick={startGame}>
            Nuova manche
          </button>
        </section>
      )}
    </main>
  );
}

export default GameBoard;
