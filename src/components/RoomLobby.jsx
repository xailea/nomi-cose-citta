import { useMemo, useState } from "react";
import { defaultCategories } from "../data/categories";

const roomStoragePrefix = "ncc-room-";

function normalizeCategory(value) {
  return value.trim().replace(/\s+/g, " ");
}

function createPlayerId() {
  return `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createRoomKey() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
}

function getRoomStorageKey(roomKey) {
  return `${roomStoragePrefix}${roomKey.toUpperCase()}`;
}

function saveRoom(room) {
  localStorage.setItem(getRoomStorageKey(room.key), JSON.stringify(room));
}

function loadRoom(roomKey) {
  const savedRoom = localStorage.getItem(getRoomStorageKey(roomKey));
  return savedRoom ? JSON.parse(savedRoom) : null;
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

  function createRoom() {
    const name = validateName();
    if (!name) return;

    if (categories.length < 2) {
      setError("Scegli almeno due categorie, separate da virgola.");
      return;
    }

    const roomKey = createRoomKey();
    const playerId = createPlayerId();
    const room = {
      key: roomKey,
      categories,
      hostId: playerId,
      guestId: null,
      players: {
        [playerId]: name
      },
      letter: null,
      status: "waiting",
      answers: {},
      createdAt: Date.now()
    };

    saveRoom(room);
    setCreatedKey(roomKey);
    setError("");
    onEnterRoom({
      playerId,
      playerName: name,
      roomKey,
      role: "host"
    });
  }

  function joinRoom() {
    const name = validateName();
    if (!name) return;

    const roomKey = joinKey.trim().toUpperCase();
    const room = loadRoom(roomKey);

    if (!room) {
      setError("Stanza non trovata. Controlla la chiave ricevuta.");
      return;
    }

    if (room.guestId && Object.keys(room.players).length >= 2) {
      setError("Questa stanza ha gia due giocatori.");
      return;
    }

    const playerId = createPlayerId();
    const updatedRoom = {
      ...room,
      guestId: playerId,
      players: {
        ...room.players,
        [playerId]: name
      }
    };

    saveRoom(updatedRoom);
    setError("");
    onEnterRoom({
      playerId,
      playerName: name,
      roomKey,
      role: "guest"
    });
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
