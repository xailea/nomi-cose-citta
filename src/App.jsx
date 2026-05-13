import { useState } from "react";
import GameBoard from "./components/GameBoard";
import RoomLobby from "./components/RoomLobby";

function App() {
  const [session, setSession] = useState(null);

  return session ? (
    <GameBoard session={session} onLeaveRoom={() => setSession(null)} />
  ) : (
    <RoomLobby onEnterRoom={setSession} />
  );
}

export default App;
