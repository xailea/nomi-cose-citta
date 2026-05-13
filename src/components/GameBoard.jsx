import { useEffect, useRef, useState } from "react";
import {
  cancelRoom,
  endRound,
  getRoom,
  startRound,
  submitAnswers
} from "../api";
import CategoryInput from "./CategoryInput";
import Timer from "./Timer";

const emptyList = [];

function createEmptyAnswers(categories) {
  return categories.reduce((nextAnswers, category) => {
    nextAnswers[category] = "";
    return nextAnswers;
  }, {});
}

function GameBoard({ session, onLeaveRoom }) {
  const [room, setRoom] = useState(session.room);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState("");
  const lastRoundId = useRef(null);
  const lastSubmittedAnswers = useRef("");

  const categories = room?.categories ?? emptyList;
  const players = room?.players ?? emptyList;
  const currentRound = room?.currentRound;
  const currentPlayer = players.find((player) => player.id === session.playerId);
  const opponent = players.find((player) => player.id !== session.playerId);
  const gameStarted = room?.status === "IN_PROGRESS" && currentRound?.status === "IN_PROGRESS";
  const gameEnded = room?.status === "ROUND_ENDED" || currentRound?.status === "ENDED";

  useEffect(() => {
    let cancelled = false;

    async function refreshRoom() {
      try {
        const nextRoom = await getRoom(session.roomKey);

        if (cancelled) return;

        if (nextRoom.status === "CLOSED") {
          onLeaveRoom();
          return;
        }

        setRoom(nextRoom);
        setError("");
      } catch (error) {
        if (!cancelled) setError(error.message);
      }
    }

    refreshRoom();
    const intervalId = setInterval(refreshRoom, 1000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [onLeaveRoom, session.roomKey]);

  useEffect(() => {
    if (!currentRound || lastRoundId.current === currentRound.id) return;

    lastRoundId.current = currentRound.id;
    lastSubmittedAnswers.current = "";
    setAnswers(room.answers?.[session.playerId] || createEmptyAnswers(categories));
  }, [categories, currentRound, room.answers, session.playerId]);

  useEffect(() => {
    if (!gameStarted || !currentRound) return;

    const serializedAnswers = JSON.stringify(answers);
    if (serializedAnswers === lastSubmittedAnswers.current) return;

    const timeoutId = setTimeout(async () => {
      try {
        await submitAnswers(currentRound.id, session.playerId, answers);
        lastSubmittedAnswers.current = serializedAnswers;
      } catch (error) {
        setError(error.message);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [answers, currentRound, gameStarted, session.playerId]);

  async function handleStartGame() {
    try {
      const round = await startRound(session.roomKey, session.playerId);

      setAnswers(createEmptyAnswers(categories));
      setRoom((currentRoom) => ({
        ...currentRoom,
        status: "IN_PROGRESS",
        currentRound: round,
        answers: {}
      }));
      setError("");
    } catch (error) {
      setError(error.message);
    }
  }

  function handleAnswerChange(category, value) {
    setAnswers((prev) => ({
      ...prev,
      [category]: value
    }));
  }

  async function handleEndGame() {
    if (!currentRound) return;

    try {
      await submitAnswers(currentRound.id, session.playerId, answers);
      await endRound(currentRound.id);
      const nextRoom = await getRoom(session.roomKey);
      setRoom(nextRoom);
      setError("");
    } catch (error) {
      setError(error.message);
    }
  }

  async function handleCancelGame() {
    try {
      await cancelRoom(session.roomKey, session.playerId);
    } catch {
      // If the room was already closed, leaving the local session is still the right move.
    }

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
          <strong>{currentPlayer?.name || session.playerName}</strong>
        </div>
        <div>
          <span>Avversario</span>
          <strong>{opponent?.name || "In attesa"}</strong>
        </div>
      </section>

      {!gameStarted && !gameEnded && (
        <>
          <p className="helper-text">
            Dai questa chiave all'altro giocatore. Quando entra, potete iniziare la manche.
          </p>
          <div className="room-actions">
            <button
              className="primary-button"
              onClick={handleStartGame}
              disabled={!session.host || !opponent}
            >
              Inizia partita
            </button>
            <button className="danger-button" onClick={handleCancelGame}>
              Annulla partita
            </button>
          </div>
        </>
      )}

      {error && <p className="error-message">{error}</p>}

      {currentRound?.letter && (
        <section className="letter-box">
          <span>Lettera estratta</span>
          <strong>{currentRound.letter}</strong>
        </section>
      )}

      {gameStarted && (
        <>
          <Timer
            key={currentRound.id}
            initialSeconds={currentRound.seconds}
            isRunning={gameStarted}
            onTimeEnd={handleEndGame}
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

          <button className="danger-button" onClick={handleEndGame}>
            Termina manche
          </button>
        </>
      )}

      {gameEnded && (
        <section className="results-box">
          <h2>Risposte manche</h2>
          <div className="result-row result-header">
            <strong>Categoria</strong>
            <span>{currentPlayer?.name || session.playerName}</span>
            {opponent && <span>{opponent.name}</span>}
          </div>

          {categories.map((category) => (
            <div key={category} className="result-row">
              <strong>{category}:</strong>
              <span>{room.answers?.[session.playerId]?.[category] || answers[category] || "Nessuna risposta"}</span>
              {opponent && (
                <span>{room.answers?.[opponent.id]?.[category] || "Avversario vuoto"}</span>
              )}
            </div>
          ))}

          <button
            className="primary-button"
            onClick={handleStartGame}
            disabled={!session.host || !opponent}
          >
            Nuova manche
          </button>
        </section>
      )}
    </main>
  );
}

export default GameBoard;
