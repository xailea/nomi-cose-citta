const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Errore di connessione al backend");
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function createRoom(playerName, categories) {
  return request("/api/rooms", {
    method: "POST",
    body: JSON.stringify({ playerName, categories })
  });
}

export function joinRoom(roomCode, playerName) {
  return request(`/api/rooms/${roomCode}/join`, {
    method: "POST",
    body: JSON.stringify({ playerName })
  });
}

export function getRoom(roomCode) {
  return request(`/api/rooms/${roomCode}`);
}

export function startRound(roomCode, playerId) {
  return request(`/api/rooms/${roomCode}/rounds`, {
    method: "POST",
    body: JSON.stringify({ playerId })
  });
}

export function submitAnswers(roundId, playerId, answers) {
  return request(`/api/rounds/${roundId}/answers`, {
    method: "POST",
    body: JSON.stringify({ playerId, answers })
  });
}

export function endRound(roundId) {
  return request(`/api/rounds/${roundId}/end`, {
    method: "POST"
  });
}

export function cancelRoom(roomCode, playerId) {
  return request(`/api/rooms/${roomCode}/cancel`, {
    method: "POST",
    body: JSON.stringify({ playerId })
  });
}
