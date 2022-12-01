function newRnd(seed) {
    return function(min, max) {
        var t = window[seed] += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return Math.floor(((t ^ t >>> 14) >>> 0) / 4294967296 * (max - min + 1)) + min;
    }
}

function joinLobby() {
    window.location = "?lobby=" + document.querySelector("#lobby").children[1].value;
}

(() => {
    const lobby = new URLSearchParams(window.location.search).get("lobby");

    window["playerSeed"]   = 32;
    window["opponentSeed"] = 32;

    let player   = new Runner("#player", bot = false, randFunc = newRnd("playerSeed"));
    let opponent = new Runner("#opponent", bot = true, randFunc = newRnd("opponentSeed"));

    if (lobby != null) {
        document.querySelector("#lobby").children[1].value = lobby;
        
        let server = new Server(player, opponent, lobby);

        document.querySelector("#start").addEventListener("click", e => {
            server.startGame();
        });
    }
})();
