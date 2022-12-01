class Server {
    constructor(player, opponent, lobby) {
        this.playing = false;
        this.opponentJoin = false;

        this.player           = player;
        this.player.netHandle = this;
        
        this.opponent = opponent;
        this.lobby    = lobby;

        this.ws = new WebSocket(`ws://localhost:2222/ws?lobby=${lobby}`);

        Runner.imageSprite.addEventListener(Runner.events.LOAD, () => {
            this.startListening();

            this.opponent.canvas.style.opacity = "0.4";
        });
    }

    startListening = () => {
        // Input
        document.addEventListener(Runner.events.KEYDOWN, this.onInputDown);
        document.addEventListener(Runner.events.KEYUP, this.onInputUp);

        if (IS_MOBILE) {
            // Mobile only touch devices.
            this.player.touchController.addEventListener(Runner.events.TOUCHSTART, this.onInputDown);
            this.player.touchController.addEventListener(Runner.events.TOUCHEND, this.onInputUp);
            this.player.containerEl.addEventListener(Runner.events.TOUCHSTART, this.onInputDown);
        } else {
            // Mouse.
            document.addEventListener(Runner.events.MOUSEDOWN, this.onInputDown);
            document.addEventListener(Runner.events.MOUSEUP, this.onInputUp);
        }

        // Websocket
        this.ws.addEventListener("open", this.onOpen);
        this.ws.addEventListener("message", this.onMessage);
        this.ws.addEventListener("close", this.onClose);
    }

    startGame = () => {
        if (!this.opponentJoin)
            return;

        this.playing = true;

        window["playerSeed"] = 32;
        window["opponentSeed"] = 32;

        this.player.forceStart();
        this.opponent.forceStart();

        this.sendStart();
    }

    stopGame = () => {
        this.playing = false;

        window["playerSeed"] = 32;
        window["opponentSeed"] = 32;

        this.player.stop();
        this.opponent.stop();
    }

    onInputDown = e => {
        if (this.playing) {
            // e.preventDefault();

            if (!this.player.tRex.ducking && (Runner.keycodes.JUMP[e.keyCode] || (e.type == Runner.events.TOUCHSTART && e.target.tagName == "CANVAS"))) {
                this.player.inputStartJump();

                this.sendInput(true, 0);
            }

            if (Runner.keycodes.DUCK[e.keyCode]) {
                e.preventDefault();

                this.player.inputStartDuck();

                this.sendInput(true, 1);
            }
        }
    }

    onInputUp = e => {
        if (this.playing) {
            // e.preventDefault();

            let keyCode = String(e.keyCode);
            let isJumpKey = Runner.keycodes.JUMP[keyCode] ||
                e.type == Runner.events.TOUCHEND ||
                e.type == Runner.events.MOUSEDOWN;

            if (isJumpKey) {
                this.player.inputEndJump();

                this.sendInput(false, 0);
            } else if (Runner.keycodes.DUCK[keyCode]) {
                this.player.inputEndDuck();

                this.sendInput(false, 1);
            }
        }
    }

    sendStart = () => {
        this.ws.send("0");
        this.opponent.forceStart();
    }

    sendCrash = () => {
        this.playing = false;

        this.ws.send("1");
    }

    sendInput = (down, inp) => {
        this.ws.send(`${down ? 2 : 3}|${inp}`)
    }

    onOpen = e => {
        console.log("Open!");
    }

    onMessage = e => {
        let msg = e.data.split("|");

        let pid = parseInt(msg[0]);

        // console.log(pid);

        switch (pid) {
            // Start
            case 0: {
                this.playing = true;

                window["playerSeed"] = 32;
                window["opponentSeed"] = 32;

                this.player.forceStart();
                this.opponent.forceStart();
                break;
            }
            // Die
            case 1: {
                this.opponent.gameOver();
                break;
            }
            // Input Down
            case 2: {
                let move = parseInt(msg[1]);

                if (move == 0) this.opponent.tRex.startJump(this.opponent.currentSpeed);
                else if (move == 1) { 
                    if (this.opponent.tRex.jumping)
                         this.opponent.tRex.setSpeedDrop();
                    else if (!this.opponent.tRex.jumping && !this.opponent.tRex.ducking)
                         this.opponent.tRex.setDuck(true);
                }

                break;
            }
            // Input Up
            case 3: {
                let move = parseInt(msg[1]);

                if (move == 0) this.opponent.tRex.endJump();
                else if (move == 1) this.opponent.tRex.setDuck(false);

                break;
            }
            case 4: {
                let join = parseInt(msg[1]);

                this.opponentJoin = join == 1;

                if (this.opponentJoin) {
                    this.opponent.canvas.style.opacity = "1.0";
                    document.querySelector("#start").style.opacity = "1.0";
                    document.querySelector("#start").style.cursor = "pointer";
                } else {
                    this.opponent.canvas.style.opacity = "0.4";
                    document.querySelector("#start").style.opacity = "0.4";
                    document.querySelector("#start").style.cursor = "defaults";

                    this.stopGame();
                }

                break;
            }
            case 9: {
                document.querySelector("#error").innerText = "ERROR: " + msg[1];

                break;
            }
            default: {
                console.log("Invalid Packet Id!");
                break;
            }
        }
    }

    onClose = e => {
        console.log("Closed!");
    }
}