import { useState } from "react";
import { categories } from "../data/categories";
import CategoryInput from "./CategoryInput";
import Timer from "./Timer";

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function getRandomLetter() {
  const randomIndex = Math.floor(Math.random() * letters.length);
  return letters[randomIndex];
}

function GameBoard() {
  const [letter, setLetter] = useState(null);
  const [answers, setAnswers] = useState({});
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);

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
  }

  function handleAnswerChange(category, value) {
    setAnswers((prev) => ({
      ...prev,
      [category]: value
    }));
  }

  function endGame() {
    setGameEnded(true);
    setGameStarted(false);
  }

  return (
    <main className="game-container">
      <h1>Nomi, Cose, Città</h1>

      {!gameStarted && !gameEnded && (
        <button className="primary-button" onClick={startGame}>
          Inizia partita
        </button>
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

          {categories.map((category) => (
            <div key={category} className="result-row">
              <strong>{category}:</strong>
              <span>{answers[category] || "Nessuna risposta"}</span>
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