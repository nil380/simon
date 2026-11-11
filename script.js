(() => {
  "use strict";

  const pads = [...document.querySelectorAll(".pad")];
  const startButton = document.querySelector("#start-button");
  const startLabel = document.querySelector("#start-label");
  const roundScore = document.querySelector("#round-score");
  const bestScore = document.querySelector("#best-score");
  const statusPanel = document.querySelector(".status-panel");
  const statusTitle = document.querySelector("#status-title");
  const statusSubtitle = document.querySelector("#status-subtitle");
  const soundToggle = document.querySelector("#sound-toggle");
  const soundLabel = document.querySelector("#sound-label");

  const frequencies = [329.63, 261.63, 392, 196];
  const padNames = ["rojo", "azul", "amarillo", "verde"];
  const sequence = [];
  let step = 0;
  let acceptingInput = false;
  let playing = false;
  let soundEnabled = true;
  let audioContext;
  let playbackToken = 0;

  let best = 0;
  try {
    best = Number.parseInt(localStorage.getItem("simon-best") || "0", 10) || 0;
  } catch (error) {
    console.warn("No se pudo leer el récord guardado.", error);
  }
  bestScore.textContent = String(best).padStart(2, "0");

  function setStatus(title, subtitle, state = "") {
    statusTitle.textContent = title;
    statusSubtitle.textContent = subtitle;
    statusPanel.dataset.state = state;
  }

  function getAudioContext() {
    if (!audioContext) {
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextConstructor) {
        soundEnabled = false;
        soundToggle.setAttribute("aria-pressed", "false");
        soundToggle.setAttribute("aria-label", "Activar sonido");
        soundLabel.textContent = "SONIDO OFF";
        setStatus("Sonido no disponible", "Tu navegador no admite audio Web.", "error");
        return null;
      }
      audioContext = new AudioContextConstructor();
    }
    if (audioContext.state === "suspended") {
      audioContext.resume().catch((error) => console.warn("No se pudo activar el audio.", error));
    }
    return audioContext;
  }

  function playTone(index, duration = 0.26, accent = false) {
    if (!soundEnabled) return;
    const context = getAudioContext();
    if (!context) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const harmonic = context.createOscillator();
    const harmonicGain = context.createGain();
    const frequency = frequencies[index] || 440;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    harmonic.type = "triangle";
    harmonic.frequency.setValueAtTime(frequency * 2.01, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.13 : 0.095, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    harmonicGain.gain.setValueAtTime(0.0001, now);
    harmonicGain.gain.exponentialRampToValueAtTime(accent ? 0.024 : 0.016, now + 0.012);
    harmonicGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.72);

    oscillator.connect(gain).connect(context.destination);
    harmonic.connect(harmonicGain).connect(context.destination);
    oscillator.start(now);
    harmonic.start(now);
    oscillator.stop(now + duration);
    harmonic.stop(now + duration);
  }

  function playErrorSound() {
    if (!soundEnabled) return;
    const context = getAudioContext();
    if (!context) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(155, now);
    oscillator.frequency.exponentialRampToValueAtTime(72, now + 0.34);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.37);
  }

  function flashPad(index, duration = 250, tone = true) {
    const pad = pads[index];
    if (!pad) return;
    pad.classList.add("lit");
    if (tone) playTone(index, duration / 1000);
    window.setTimeout(() => pad.classList.remove("lit"), duration);
  }

  function updateRecord() {
    if (sequence.length <= best) return;
    best = sequence.length;
    bestScore.textContent = String(best).padStart(2, "0");
    try {
      localStorage.setItem("simon-best", String(best));
    } catch (error) {
      console.warn("No se pudo guardar el récord.", error);
    }
  }

  function finishGame() {
    playbackToken += 1;
    playing = false;
    acceptingInput = false;
    pads.forEach((pad) => { pad.disabled = true; });
    updateRecord();
    playErrorSound();
    setStatus("¡Fin de la partida!", `Llegaste a la ronda ${sequence.length}. ¿Lo intentamos otra vez?`, "error");
    startLabel.textContent = "Volver a jugar";
  }

  async function showSequence() {
    acceptingInput = false;
    pads.forEach((pad) => { pad.disabled = true; });
    const token = ++playbackToken;
    setStatus("Observa y escucha", "Memoriza el orden de las luces.", "watching");

    for (const index of sequence) {
      if (token !== playbackToken || !playing) return;
      await new Promise((resolve) => window.setTimeout(resolve, 370));
      if (token !== playbackToken || !playing) return;
      flashPad(index, 270);
      await new Promise((resolve) => window.setTimeout(resolve, 410));
    }

    if (token !== playbackToken || !playing) return;
    step = 0;
    acceptingInput = true;
    pads.forEach((pad) => { pad.disabled = false; });
    setStatus("Tu turno", "Repite la secuencia en el mismo orden.", "input");
  }

  function nextRound() {
    sequence.push(Math.floor(Math.random() * pads.length));
    roundScore.textContent = String(sequence.length).padStart(2, "0");
    updateRecord();
    showSequence();
  }

  function startGame() {
    getAudioContext();
    playbackToken += 1;
    sequence.length = 0;
    step = 0;
    playing = true;
    acceptingInput = false;
    roundScore.textContent = "00";
    startLabel.textContent = "Reiniciar partida";
    setStatus("Prepara la memoria", "La secuencia empieza ahora.");
    nextRound();
  }

  function handlePad(index) {
    if (!acceptingInput || !playing) return;
    flashPad(index, 180);

    if (sequence[step] !== index) {
      finishGame();
      return;
    }

    step += 1;
    if (step === sequence.length) {
      acceptingInput = false;
      pads.forEach((pad) => { pad.disabled = true; });
      setStatus("¡Muy bien!", "Siguiente ronda…", "input");
      const completedRoundToken = playbackToken;
      window.setTimeout(() => {
        if (playing && completedRoundToken === playbackToken) nextRound();
      }, 700);
    }
  }

  pads.forEach((pad) => {
    pad.addEventListener("click", () => handlePad(Number(pad.dataset.pad)));
  });

  startButton.addEventListener("click", startGame);
  soundToggle.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    soundToggle.setAttribute("aria-pressed", String(soundEnabled));
    soundToggle.setAttribute("aria-label", soundEnabled ? "Silenciar sonido" : "Activar sonido");
    soundLabel.textContent = soundEnabled ? "SONIDO ON" : "SONIDO OFF";
    if (soundEnabled) getAudioContext();
  });

  document.addEventListener("keydown", (event) => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    const keyIndex = Number(event.key) - 1;
    if (keyIndex >= 0 && keyIndex < pads.length) {
      event.preventDefault();
      handlePad(keyIndex);
    } else if ((event.key === "Enter" || event.key === " ") && document.activeElement === startButton) {
      event.preventDefault();
      startGame();
    }
  });
})();
