import { useEffect, useState } from "react";

function Timer({ initialSeconds, isRunning, onTimeEnd }) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    if (!isRunning) return;

    if (secondsLeft <= 0) {
      onTimeEnd();
      return;
    }

    const intervalId = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [secondsLeft, isRunning, onTimeEnd]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="timer">
      Tempo: {minutes}:{seconds.toString().padStart(2, "0")}
    </div>
  );
}

export default Timer;