import { useMemo, useState } from "react";
import { createRoom as createRoomRequest, joinRoom as joinRoomRequest } from "../api";
import { defaultCategories } from "../data/categories";

function normalizeCategory(value) {
  return value.trim().replace(/\s+/g, " ");
}

function RoomLobby({ onEnterRoom }) {
  const [playerName, setPlayerName] = useState("");
  const [categoriesText, setCategoriesText] = useState(defaultCategories.join(", "));
  const [joinKey, setJoinKey] = useState("");
  const [createdKey, setCreatedKey] = useState("");
  const [error, setError] = useState("");

  const categories = useMemo(() => {
    const uniqueCategories = new Set(
      categoriesText
        .split(",")
        .map(normalizeCategory)
        .filter(Boolean)
    );

    return Array.from(uniqueCategories);
  }, [categoriesText]);

  function validateName() {
    const name = playerName.trim();

    if (!name) {
      setError("Inserisci il tuo nome prima di continuare.");
      return null;
    }

    return name;
  }

  async function createRoom() {
    const name = validateName();
    if (!name) return;

    if (categories.length < 2) {
      setError("Scegli almeno due categorie, separate da virgola.");
      return;
    }

    try {
      const room = await createRoomRequest(name, categories);

      setCreatedKey(room.roomCode);
      setError("");
      onEnterRoom({
        playerId: room.playerId,
        playerName: name,
        roomKey: room.roomCode,
        host: room.host,
        room
      });
    } catch (error) {
      setError(error.message);
    }
  }

  async function joinRoom() {
    const name = validateName();
    if (!name) return;

    const roomKey = joinKey.trim().toUpperCase();

    try {
      const room = await joinRoomRequest(roomKey, name);

      setError("");
      onEnterRoom({
        playerId: room.playerId,
        playerName: name,
        roomKey,
        host: room.host,
        room
      });
    } catch (error) {
      setError(error.message);
    }
  }

  return (
    <main className="game-container lobby-container">
      <h1>Nomi, Cose, Citta</h1>

      <section className="lobby-panel">
        <div className="field-group">
          <label htmlFor="player-name">Il tuo nome</label>
          <input
            id="player-name"
            type="text"
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            placeholder="Es. Alessio"
          />
        </div>

        <div className="field-group">
          <label htmlFor="categories">Categorie della stanza</label>
          <textarea
            id="categories"
            value={categoriesText}
            onChange={(event) => setCategoriesText(event.target.value)}
            rows="4"
            placeholder="Nome, Cosa, Citta, Animale"
          />
          <span className="helper-text">
            Separale con una virgola. Saranno usate per entrambi i giocatori.
          </span>
        </div>

        <button className="primary-button" onClick={createRoom}>
          Crea stanza
        </button>

        {createdKey && (
          <div className="room-key-box">
            <span>Chiave stanza</span>
            <strong>{createdKey}</strong>
          </div>
        )}
      </section>

      <section className="lobby-panel">
        <h2>Entra in stanza</h2>

        <div className="field-group">
          <label htmlFor="join-key">Chiave ricevuta</label>
          <input
            id="join-key"
            type="text"
            value={joinKey}
            onChange={(event) => setJoinKey(event.target.value)}
            placeholder="Es. Q7K2MA"
          />
        </div>

        <button className="secondary-button" onClick={joinRoom}>
          Entra
        </button>
      </section>

      {error && <p className="error-message">{error}</p>}
    </main>
  );
}

export default RoomLobby;
