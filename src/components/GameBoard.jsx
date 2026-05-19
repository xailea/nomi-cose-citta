import { useEffect, useRef, useState } from "react";
import {
  cancelRoom,
  createRoom as createRoomRequest,
  endRound,
  finishRoom,
  getRoom,
  markValidationReady,
  startRound,
  submitAnswers,
  submitValidations
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

function normalizeAnswer(value) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("it-IT");
}

function getStoredAnswers(room, playerId) {
  const roundAnswers = room?.currentRound?.answers;

  if (room?.currentRound) {
    if (!Array.isArray(roundAnswers)) return roundAnswers?.[playerId] ?? {};

    return roundAnswers
      .filter((answer) => String(answer.playerId) === String(playerId))
      .reduce((nextAnswers, answer) => {
        nextAnswers[answer.category] = answer.answer;
        return nextAnswers;
      }, {});
  }

  const roomAnswers = room?.answers?.[playerId];
  if (roomAnswers) return roomAnswers;

  return {};
}

function getRoundAnswerRecord(room, playerId, category) {
  const roundAnswers = room?.currentRound?.answers;
  if (!Array.isArray(roundAnswers)) return null;

  return (
    roundAnswers.find(
      (answer) =>
        String(answer.playerId) === String(playerId) &&
        answer.category === category
    ) ?? null
  );
}

function getStoredRoundPoints(room, playerId) {
  const roundAnswers = room?.currentRound?.answers;
  if (!Array.isArray(roundAnswers)) return 0;

  return roundAnswers
    .filter((answer) => String(answer.playerId) === String(playerId))
    .reduce((total, answer) => total + (Number(answer.points) || 0), 0);
}

function getReadyPlayerIds(currentRound) {
  const readyPlayers =
    currentRound?.readyPlayerIds ??
    currentRound?.validationReadyPlayerIds ??
    currentRound?.readyPlayers ??
    currentRound?.validationReadyPlayers ??
    [];

  if (!Array.isArray(readyPlayers)) return new Set();

  return new Set(
    readyPlayers.map((player) => String(player?.id ?? player?.playerId ?? player))
  );
}

function getWinnerGenderClass(winner) {
  if (!winner?.name) return "";

  const normalizedName = winner.name.trim().toLocaleLowerCase("it-IT");

  return normalizedName.endsWith("a") || normalizedName.endsWith("s")
    ? "victory-background-f"
    : "victory-background-m";
}

function GameBoard({ session, onLeaveRoom, onUpdateSession }) {
  const [room, setRoom] = useState(session.room);
  const [answers, setAnswers] = useState({});
  const [answerValidations, setAnswerValidations] = useState({});
  const [validationReady, setValidationReady] = useState(false);
  const [error, setError] = useState("");
  const lastRoundId = useRef(null);
  const lastSubmittedAnswers = useRef("");

  const categories = room?.categories ?? emptyList;
  const players = room?.players ?? emptyList;
  const currentRound = room?.currentRound;
  const currentPlayer = players.find((player) => player.id === session.playerId);
  const opponent = players.find((player) => player.id !== session.playerId);
  const gameFinished = room?.status === "FINISHED";
  const storedCurrentAnswers = getStoredAnswers(room, session.playerId);
  const currentAnswers =
    Object.keys(storedCurrentAnswers).length > 0 ? storedCurrentAnswers : answers;
  const opponentAnswers = opponent ? getStoredAnswers(room, opponent.id) : {};
  const gameStarted = room?.status === "IN_PROGRESS" && currentRound?.status === "IN_PROGRESS";
  const gameEnded =
    gameFinished ||
    room?.status === "ROUND_ENDED" ||
    currentRound?.status === "ENDED" ||
    Boolean(currentRound?.id && currentRound.status !== "IN_PROGRESS");
  const readyPlayerIds = getReadyPlayerIds(currentRound);
  const currentPlayerReady =
    validationReady ||
    readyPlayerIds.has(String(session.playerId)) ||
    currentRound?.currentPlayerReady === true;
  const opponentReady =
    Boolean(opponent) &&
    (readyPlayerIds.has(String(opponent.id)) ||
      currentRound?.opponentReady === true);
  const allPlayersReady =
    currentRound?.validationsComplete === true ||
    Boolean(opponent && currentPlayerReady && opponentReady);
  const visibleCurrentAnswers = gameEnded ? currentAnswers : answers;
  const playersWithAnswers = [
    {
      id: session.playerId,
      name: currentPlayer?.name || session.playerName,
      emptyLabel: "Nessuna risposta",
      answers: visibleCurrentAnswers
    },
    ...(opponent
      ? [
          {
            id: opponent.id,
            name: opponent.name,
            emptyLabel: "Avversario vuoto",
            answers: opponentAnswers
          }
        ]
      : [])
  ];
  const scores = playersWithAnswers.reduce((nextScores, player) => {
    nextScores[player.id] = getStoredRoundPoints(room, player.id);

    return nextScores;
  }, {});
  const totalScores = playersWithAnswers.reduce((nextScores, player) => {
    const playerInfo = players.find(
      (currentPlayer) => String(currentPlayer.id) === String(player.id)
    );
    const savedTotal = Number(playerInfo?.totalPoints) || 0;
    nextScores[player.id] = savedTotal;

    return nextScores;
  }, {});
  const winner = players.find((player) => {
    return String(player.id) === String(room?.winnerPlayerId);
  });
  const finalBackgroundClass = room?.draw
    ? "draw-background"
    : getWinnerGenderClass(winner);
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
    setAnswerValidations({});
    setValidationReady(false);
    setAnswers(
      Object.keys(currentAnswers).length > 0
        ? currentAnswers
        : createEmptyAnswers(categories)
    );
  }, [categories, currentAnswers, currentRound]);

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
      setAnswerValidations({});
      setValidationReady(false);
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

  function getOwnAnswer(category) {
    return visibleCurrentAnswers[category] || "";
  }

  function getOpponentAnswer(category) {
    return opponentAnswers[category] || "";
  }

  function hasSameAnswer(category) {
    const ownAnswer = normalizeAnswer(getOwnAnswer(category));
    const opponentAnswer = normalizeAnswer(getOpponentAnswer(category));

    return Boolean(ownAnswer && opponentAnswer && ownAnswer === opponentAnswer);
  }

  function getPlayerAnswer(playerId, category) {
    const player = playersWithAnswers.find((currentPlayer) => currentPlayer.id === playerId);

    return player?.answers?.[category] || "";
  }

  function canScoreAnswer(playerId, category) {
    const playerAnswer = normalizeAnswer(getPlayerAnswer(playerId, category));

    return Boolean(
      opponent &&
        String(playerId) === String(opponent.id) &&
        playerAnswer &&
        !hasSameAnswer(category)
    );
  }

  function canValidateAnswer(playerId, category) {
    return canScoreAnswer(playerId, category) && !currentPlayerReady;
  }

  function isAnswerValid(playerId, category) {
    if (!canScoreAnswer(playerId, category)) return false;

    return answerValidations[playerId]?.[category] ?? true;
  }

  function handleAnswerValidationChange(playerId, category, isValid) {
    if (!opponent || String(playerId) !== String(opponent.id)) return;

    setAnswerValidations((currentValidations) => ({
      ...currentValidations,
      [playerId]: {
        ...currentValidations[playerId],
        [category]: isValid
      }
    }));
  }

  function createOpponentValidationPayload() {
    if (!opponent) return [];

    return categories.map((category) => {
      const answerRecord = getRoundAnswerRecord(room, opponent.id, category);
      const valid = isAnswerValid(opponent.id, category);

      return {
        answerId: answerRecord?.id,
        playerId: opponent.id,
        category,
        valid
      };
    });
  }

  async function handleValidationReady() {
    if (!currentRound || !opponent) return;

    try {
      await submitValidations(
        currentRound.id,
        session.playerId,
        opponent.id,
        createOpponentValidationPayload()
      );
      await markValidationReady(currentRound.id, session.playerId);
      const nextRoom = await getRoom(session.roomKey);

      setRoom(nextRoom);
      setValidationReady(true);
      setError("");
    } catch (error) {
      setError(error.message);
    }
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

  async function handleFinishGame() {
    try {
      const nextRoom = await finishRoom(session.roomKey, session.playerId);
      setRoom(nextRoom);
      setError("");
    } catch (error) {
      setError(error.message);
    }
  }

  async function handleRematch() {
    try {
      const nextRoom = await createRoomRequest(session.playerName, categories);
      const nextSession = {
        playerId: nextRoom.playerId,
        playerName: session.playerName,
        roomKey: nextRoom.roomCode,
        host: nextRoom.host,
        room: nextRoom
      };

      onUpdateSession(nextSession);
      setError("");
    } catch (error) {
      setError(error.message);
    }
  }

  if (gameFinished) {
    return (
      <main className={`game-container final-page ${finalBackgroundClass}`}>
        <h1>Nomi, Cose, Citta</h1>

        {error && <p className="error-message">{error}</p>}

        <section className="final-result-box">
          <span>Partita terminata</span>
          <strong>
            {room?.draw
              ? "Pareggio"
              : winner
                ? `Vince ${winner.name}`
                : "Vincitore non disponibile"}
          </strong>

          <div className="final-score-list">
            {players.map((player) => (
              <div key={player.id}>
                <span>{player.name}</span>
                <strong>{Number(player.totalPoints) || 0} punti</strong>
              </div>
            ))}
          </div>

          <div className="final-actions">
            <button className="primary-button" onClick={handleRematch}>
              Rivincita
            </button>
            <button className="danger-button" onClick={onLeaveRoom}>
              Torna al menu
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main
      className={`game-container ${gameStarted ? "playing-background" : ""} ${
        gameEnded ? "counting-background" : ""
      }`}
    >
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

      {gameStarted && opponent && (
        <p className="opponent-banner">
          Stai giocando contro <strong>{opponent.name}</strong>
        </p>
      )}

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
            {playersWithAnswers.map((player) => (
              <span key={player.id}>{player.name}</span>
            ))}
          </div>

          {categories.map((category) => {
            const sameAnswer = hasSameAnswer(category);

            return (
              <div
                key={category}
                className={`result-row ${opponent ? "" : "single-player"}`}
              >
                <strong>{category}:</strong>
                {playersWithAnswers.map((player) => {
                  const answer = getPlayerAnswer(player.id, category);
                  const answerRecord = getRoundAnswerRecord(room, player.id, category);
                  const hasAnswer = Boolean(normalizeAnswer(answer));
                  const canValidate = canValidateAnswer(player.id, category);
                  const isValid = isAnswerValid(player.id, category);
                  const isOpponentAnswer = opponent && String(player.id) === String(opponent.id);
                  const storedPoints = Number(answerRecord?.points) || 0;

                  return (
                    <div key={player.id} className="answer-result">
                      <span>{answer || player.emptyLabel}</span>
                      {isOpponentAnswer ? (
                        <label className={`validation-control ${!canValidate ? "locked" : ""}`}>
                          <input
                            type="checkbox"
                            checked={isValid}
                            disabled={!canValidate}
                            onChange={(event) =>
                              handleAnswerValidationChange(
                                player.id,
                                category,
                                event.target.checked
                              )
                            }
                          />
                          <span>
                            {sameAnswer && hasAnswer
                              ? "Uguale: 0 punti"
                              : `${isValid ? "Valida" : "Non valida"}: ${storedPoints} punti`}
                          </span>
                        </label>
                      ) : (
                        <span className="validation-note">Valida l'avversario</span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          <div className="total-score">
            {playersWithAnswers.map((player) => {
              const isOpponentAnswer = opponent && String(player.id) === String(opponent.id);
              const roundScore = scores[player.id] || 0;
              const totalScore = totalScores[player.id] || 0;

              return (
                <span key={player.id}>
                  {player.name}:{" "}
                  {isOpponentAnswer ? (
                    <>
                      <strong>{roundScore}</strong> manche,{" "}
                      <strong>{totalScore}</strong> totali
                    </>
                  ) : (
                    <>
                      <strong>{roundScore}</strong> manche,{" "}
                      <strong>{totalScore}</strong> totali
                    </>
                  )}
                </span>
              );
            })}
          </div>

          <div className="validation-actions">
            <button
              className="primary-button"
              onClick={handleValidationReady}
              disabled={!opponent || currentPlayerReady}
            >
              {currentPlayerReady ? "Pronto inviato" : "Pronto"}
            </button>
            {currentPlayerReady && !allPlayersReady && (
              <p className="helper-text">
                Hai finito di validare. In attesa dell'avversario.
              </p>
            )}
            {allPlayersReady && (
              <p className="helper-text">
                Entrambi pronti. Potete iniziare una nuova manche.
              </p>
            )}
          </div>

          <div className="game-actions">
            <button
              className="primary-button"
              onClick={handleStartGame}
              disabled={!session.host || !opponent || !allPlayersReady || gameFinished}
            >
              Nuova manche
            </button>
            <button
              className="danger-button"
              onClick={handleFinishGame}
              disabled={!opponent || !allPlayersReady || gameFinished}
            >
              Termina partita
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

export default GameBoard;
