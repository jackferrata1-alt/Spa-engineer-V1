/* =========================================================
   SPA ENGINEER — V3
   Automatic lap engineer
   Target laps: 1:45 / 1:46 / 1:47 / 1:48
   ========================================================= */

"use strict";

/* ---------------------------------------------------------
   SETTINGS
   --------------------------------------------------------- */

const CONFIG = {
    defaultLap: "1:47",

    // How early before the target timestamp a call is played.
    callLead: 0.0,

    // Enable browser speech if an audio file isn't found.
    speechFallback: true,

    // Prevent the same call from firing twice.
    callCooldown: 0.8,

    // Audio files are expected in:
    // audio/filename.mp3
    audioFolder: "audio/"
};


/* ---------------------------------------------------------
   SPA CORNER TIMINGS
   ---------------------------------------------------------
   These are approximate reference timestamps for the
   engineer system. They are designed around the lap pace
   rather than pretending the car is perfectly identical
   every lap.
--------------------------------------------------------- */

const CORNERS = [
    {
        number: 1,
        name: "TURN 1",
        time: 18.0,
        call: "Turn 1, brake."
    },
    {
        number: 2,
        name: "TURN 2",
        time: 22.2,
        call: "Turn 2, left."
    },
    {
        number: 3,
        name: "TURN 3",
        time: 25.0,
        call: "Turn 3, right."
    },
    {
        number: 4,
        name: "TURN 4",
        time: 28.2,
        call: "Turn 4, left."
    },
    {
        number: 5,
        name: "TURN 5",
        time: 31.2,
        call: "Turn 5, right."
    },
    {
        number: 6,
        name: "TURN 6",
        time: 34.8,
        call: "Turn 6, left."
    },
    {
        number: 7,
        name: "TURN 7",
        time: 38.0,
        call: "Turn 7, right."
    },
    {
        number: 8,
        name: "TURN 8",
        time: 42.0,
        call: "Turn 8, left."
    },
    {
        number: 9,
        name: "TURN 9",
        time: 45.0,
        call: "Turn 9, right."
    },
    {
        number: 10,
        name: "TURN 10",
        time: 50.0,
        call: "Turn 10, brake."
    },
    {
        number: 11,
        name: "TURN 11",
        time: 53.0,
        call: "Turn 11, right."
    },
    {
        number: 12,
        name: "TURN 12",
        time: 56.5,
        call: "Turn 12, left."
    },
    {
        number: 13,
        name: "TURN 13",
        time: 60.0,
        call: "Turn 13, right."
    },
    {
        number: 14,
        name: "TURN 14",
        time: 64.0,
        call: "Turn 14, left."
    },
    {
        number: 15,
        name: "TURN 15",
        time: 68.0,
        call: "Turn 15, right."
    },
    {
        number: 16,
        name: "TURN 16",
        time: 73.0,
        call: "Turn 16, brake."
    },
    {
        number: 17,
        name: "TURN 17",
        time: 76.5,
        call: "Turn 17, left."
    },
    {
        number: 18,
        name: "TURN 18",
        time: 82.0,
        call: "Turn 18, right."
    },
    {
        number: 19,
        name: "TURN 19",
        time: 86.0,
        call: "Turn 19, left."
    }
];


/* ---------------------------------------------------------
   PACE PROFILES
   --------------------------------------------------------- */

const PACE_PROFILES = {
    "1:45": {
        lapTime: 105,
        multiplier: 105 / 105,
        label: "1:45"
    },

    "1:46": {
        lapTime: 106,
        multiplier: 106 / 105,
        label: "1:46"
    },

    "1:47": {
        lapTime: 107,
        multiplier: 107 / 105,
        label: "1:47"
    },

    "1:48": {
        lapTime: 108,
        multiplier: 108 / 105,
        label: "1:48"
    }
};


/* ---------------------------------------------------------
   STATE
   --------------------------------------------------------- */

let running = false;
let startTime = 0;
let elapsed = 0;
let animationFrame = null;

let currentLap = 1;
let selectedPace = CONFIG.defaultLap;

let triggeredCalls = new Set();
let lastCallTime = 0;

let lastDisplayedCorner = 0;


/* ---------------------------------------------------------
   DOM HELPERS
   --------------------------------------------------------- */

function findElement(...selectors) {
    for (const selector of selectors) {
        const element = document.querySelector(selector);

        if (element) {
            return element;
        }
    }

    return null;
}


const timerDisplay = findElement(
    "#timer",
    "#lapTimer",
    "#time",
    ".timer"
);

const lapDisplay = findElement(
    "#lap",
    "#lapNumber",
    ".lap"
);

const paceDisplay = findElement(
    "#pace",
    "#lapPace",
    ".pace"
);

const cornerDisplay = findElement(
    "#corner",
    "#currentCorner",
    ".corner"
);

const callDisplay = findElement(
    "#call",
    "#engineerCall",
    ".call"
);

const statusDisplay = findElement(
    "#status",
    ".status"
);

const startButton = findElement(
    "#start",
    "#startBtn",
    "#startButton"
);

const stopButton = findElement(
    "#stop",
    "#stopBtn",
    "#stopButton"
);

const resetButton = findElement(
    "#reset",
    "#resetBtn",
    "#resetButton"
);

const paceSelect = findElement(
    "#paceSelect",
    "#pace",
    "#lapSelect",
    "select[name='pace']"
);


/* ---------------------------------------------------------
   TIME FUNCTIONS
   --------------------------------------------------------- */

function formatTime(seconds, showMilliseconds = true) {
    if (!Number.isFinite(seconds)) {
        seconds = 0;
    }

    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    if (showMilliseconds) {
        const milliseconds = Math.floor((seconds % 1) * 100);

        return (
            String(minutes).padStart(2, "0") +
            ":" +
            String(secs).padStart(2, "0") +
            "." +
            String(milliseconds).padStart(2, "0")
        );
    }

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(secs).padStart(2, "0")
    );
}


/* ---------------------------------------------------------
   PACE
   --------------------------------------------------------- */

function getPaceProfile() {
    return (
        PACE_PROFILES[selectedPace] ||
        PACE_PROFILES[CONFIG.defaultLap]
    );
}


function getScaledCornerTime(baseTime) {
    const profile = getPaceProfile();

    return baseTime * profile.multiplier;
}


/* ---------------------------------------------------------
   DISPLAY
   --------------------------------------------------------- */

function updateTimerDisplay() {
    if (timerDisplay) {
        timerDisplay.textContent = formatTime(elapsed);
    }

    if (paceDisplay) {
        paceDisplay.textContent = selectedPace;
    }

    if (lapDisplay) {
        lapDisplay.textContent = `LAP ${currentLap}`;
    }
}


function updateStatus(text) {
    if (statusDisplay) {
        statusDisplay.textContent = text;
    }
}


function updateCornerDisplay(corner) {
    if (!cornerDisplay) {
        return;
    }

    if (!corner) {
        cornerDisplay.textContent = "—";
        return;
    }

    cornerDisplay.textContent =
        `${corner.number} — ${corner.name}`;
}


function updateCallDisplay(text) {
    if (!callDisplay) {
        return;
    }

    callDisplay.textContent = text;

    callDisplay.classList.remove("active");

    // Restart CSS animation.
    void callDisplay.offsetWidth;

    callDisplay.classList.add("active");
}


/* ---------------------------------------------------------
   AUDIO SYSTEM
   ---------------------------------------------------------
   First tries an MP3 file.

   Example:
   audio/turn-1.mp3
   audio/turn-2.mp3

   If the file isn't available, browser speech is used.
--------------------------------------------------------- */

function audioFilename(corner) {
    return (
        CONFIG.audioFolder +
        `turn-${corner.number}.mp3`
    );
}


function playAudioFile(corner) {
    return new Promise((resolve) => {
        const audio = new Audio(audioFilename(corner));

        let finished = false;

        const finish = (success) => {
            if (finished) return;

            finished = true;

            audio.onended = null;
            audio.onerror = null;

            resolve(success);
        };

        audio.onended = () => {
            finish(true);
        };

        audio.onerror = () => {
            finish(false);
        };

        audio.volume = 1.0;

        audio.play()
            .then(() => {})
            .catch(() => {
                finish(false);
            });
    });
}


function speak(text) {
    if (!CONFIG.speechFallback) {
        return;
    }

    if (!("speechSynthesis" in window)) {
        return;
    }

    window.speechSynthesis.cancel();

    const utterance =
        new SpeechSynthesisUtterance(text);

    utterance.rate = 1.12;
    utterance.pitch = 0.9;
    utterance.volume = 1.0;

    window.speechSynthesis.speak(utterance);
}


async function playEngineerCall(corner) {
    const now = performance.now() / 1000;

    if (
        now - lastCallTime <
        CONFIG.callCooldown
    ) {
        return;
    }

    lastCallTime = now;

    updateCallDisplay(corner.call);
    updateCornerDisplay(corner);

    const played = await playAudioFile(corner);

    if (!played) {
        speak(corner.call);
    }
}


/* ---------------------------------------------------------
   CORNER DETECTION
   --------------------------------------------------------- */

function checkCorners() {
    for (const corner of CORNERS) {
        const targetTime =
            getScaledCornerTime(corner.time);

        const triggerTime =
            targetTime - CONFIG.callLead;

        if (
            elapsed >= triggerTime &&
            !triggeredCalls.has(corner.number)
        ) {
            triggeredCalls.add(corner.number);

            lastDisplayedCorner = corner.number;

            playEngineerCall(corner);

            break;
        }
    }
}


/* ---------------------------------------------------------
   CURRENT CORNER
   --------------------------------------------------------- */

function updateCurrentCorner() {
    let current = null;

    for (const corner of CORNERS) {
        const targetTime =
            getScaledCornerTime(corner.time);

        if (elapsed >= targetTime) {
            current = corner;
        }
    }

    if (current) {
        updateCornerDisplay(current);
    }
}


/* ---------------------------------------------------------
   LAP FINISH
   --------------------------------------------------------- */

function checkLapFinish() {
    const lapTime =
        getPaceProfile().lapTime;

    if (elapsed < lapTime) {
        return;
    }

    finishLap();
}


function finishLap() {
    running = false;

    const completedTime = elapsed;

    updateTimerDisplay();

    updateStatus(
        `LAP ${currentLap} COMPLETE — ${formatTime(
            completedTime,
            false
        )}`
    );

    if (callDisplay) {
        callDisplay.textContent =
            `LAP COMPLETE — ${formatTime(
                completedTime,
                false
            )}`;
    }

    currentLap++;

    // Reset for next lap.
    elapsed = 0;

    triggeredCalls.clear();

    lastDisplayedCorner = 0;

    updateTimerDisplay();

    // Automatically prepare the next lap.
    setTimeout(() => {
        if (statusDisplay) {
            statusDisplay.textContent =
                `READY — LAP ${currentLap}`;
        }
    }, 1200);

    cancelAnimationFrame(animationFrame);
    animationFrame = null;
}


/* ---------------------------------------------------------
   MAIN LOOP
   --------------------------------------------------------- */

function loop(timestamp) {
    if (!running) {
        return;
    }

    elapsed =
        (timestamp - startTime) / 1000;

    updateTimerDisplay();

    checkCorners();
    updateCurrentCorner();
    checkLapFinish();

    if (running) {
        animationFrame =
            requestAnimationFrame(loop);
    }
}


/* ---------------------------------------------------------
   START
   --------------------------------------------------------- */

function startEngineer() {
    if (running) {
        return;
    }

    running = true;

    startTime =
        performance.now() -
        elapsed * 1000;

    updateStatus(
        `ENGINEER ACTIVE — ${selectedPace}`
    );

    animationFrame =
        requestAnimationFrame(loop);
}


/* ---------------------------------------------------------
   STOP
   --------------------------------------------------------- */

function stopEngineer() {
    running = false;

    cancelAnimationFrame(animationFrame);

    animationFrame = null;

    updateStatus("PAUSED");
}


/* ---------------------------------------------------------
   RESET
   --------------------------------------------------------- */

function resetEngineer() {
    running = false;

    cancelAnimationFrame(animationFrame);

    animationFrame = null;

    elapsed = 0;

    currentLap = 1;

    triggeredCalls.clear();

    lastDisplayedCorner = 0;

    lastCallTime = 0;

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    updateTimerDisplay();

    updateCornerDisplay(null);

    updateCallDisplay("ENGINEER READY");

    updateStatus(
        `READY — ${selectedPace}`
    );
}


/* ---------------------------------------------------------
   PACE SELECTION
   --------------------------------------------------------- */

function setPace(pace) {
    if (!PACE_PROFILES[pace]) {
        return;
    }

    selectedPace = pace;

    if (paceDisplay) {
        paceDisplay.textContent = pace;
    }

    updateStatus(
        running
            ? `ENGINEER ACTIVE — ${pace}`
            : `READY — ${pace}`
    );
}


/* ---------------------------------------------------------
   BUTTON EVENTS
   --------------------------------------------------------- */

if (startButton) {
    startButton.addEventListener(
        "click",
        startEngineer
    );
}


if (stopButton) {
    stopButton.addEventListener(
        "click",
        stopEngineer
    );
}


if (resetButton) {
    resetButton.addEventListener(
        "click",
        resetEngineer
    );
}


if (paceSelect) {
    paceSelect.addEventListener(
        "change",
        (event) => {
            setPace(event.target.value);
        }
    );
}


/* ---------------------------------------------------------
   KEYBOARD CONTROLS
   ---------------------------------------------------------

   SPACE = start / pause
   R     = reset
   1     = 1:45
   2     = 1:46
   3     = 1:47
   4     = 1:48
--------------------------------------------------------- */

document.addEventListener(
    "keydown",
    (event) => {

        // Don't hijack typing/selecting.
        if (
            event.target.tagName === "INPUT" ||
            event.target.tagName === "SELECT" ||
            event.target.tagName === "TEXTAREA"
        ) {
            return;
        }

        if (event.code === "Space") {
            event.preventDefault();

            if (running) {
                stopEngineer();
            } else {
                startEngineer();
            }
        }

        if (event.key.toLowerCase() === "r") {
            resetEngineer();
        }

        if (event.key === "1") {
            setPace("1:45");
        }

        if (event.key === "2") {
            setPace("1:46");
        }

        if (event.key === "3") {
            setPace("1:47");
        }

        if (event.key === "4") {
            setPace("1:48");
        }
    }
);


/* ---------------------------------------------------------
   INITIALIZATION
   --------------------------------------------------------- */

function initialize() {
    selectedPace = CONFIG.defaultLap;

    updateTimerDisplay();

    updateCornerDisplay(null);

    updateCallDisplay("ENGINEER READY");

    updateStatus(
        `READY — ${selectedPace}`
    );

    if (paceSelect) {
        paceSelect.value = selectedPace;
    }

    console.log(
        "Spa Engineer V3 initialized."
    );

    console.log(
        "Pace:",
        selectedPace
    );

    console.log(
        "Corners loaded:",
        CORNERS.length
    );
}


if (
    document.readyState ===
    "loading"
) {
    document.addEventListener(
        "DOMContentLoaded",
        initialize
    );
} else {
    initialize();
}
