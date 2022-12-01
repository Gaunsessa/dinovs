"use strict";

class HorizonLine {
    /**
     * Horizon line dimensions.
     * @enum {number}
     */
    static dimensions = {
        WIDTH: 600,
        HEIGHT: 12,
        YPOS: 127
    };

    /**
     * Horizon Line.
     * Consists of two connecting lines. Randomly assigns a flat / bumpy horizon.
     * @param {HTMLCanvasElement} canvas
     * @param {Object} spritePos Horizon position in sprite.
     * @constructor
     */
    constructor(canvas, spritePos, rndFunc) {
        this.rndFunc = rndFunc;

        this.spritePos = spritePos;
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.sourceDimensions = {};
        this.dimensions = HorizonLine.dimensions;
        this.sourceXPos = [this.spritePos.x, this.spritePos.x +
            this.dimensions.WIDTH];
        this.xPos = [];
        this.yPos = 0;
        this.bumpThreshold = 0.5;

        this.setSourceDimensions();
        this.draw();
    }

    /**
     * Set the source dimensions of the horizon line.
     */
    setSourceDimensions = () => {

        for (var dimension in HorizonLine.dimensions) {
            if (IS_HIDPI) {
                if (dimension != 'YPOS') {
                    this.sourceDimensions[dimension] =
                        HorizonLine.dimensions[dimension] * 2;
                }
            } else {
                this.sourceDimensions[dimension] =
                    HorizonLine.dimensions[dimension];
            }
            this.dimensions[dimension] = HorizonLine.dimensions[dimension];
        }

        this.xPos = [0, HorizonLine.dimensions.WIDTH];
        this.yPos = HorizonLine.dimensions.YPOS;
    }

    /**
     * Return the crop x position of a type.
     */
    getRandomType = () => {
        return this.rndFunc(0, 1000) / 1000 > this.bumpThreshold ? this.dimensions.WIDTH : 0;
    }

    /**
     * Draw the horizon line.
     */
    draw = () => {
        this.canvasCtx.drawImage(Runner.imageSprite, this.sourceXPos[0],
            this.spritePos.y,
            this.sourceDimensions.WIDTH, this.sourceDimensions.HEIGHT,
            this.xPos[0], this.yPos,
            this.dimensions.WIDTH, this.dimensions.HEIGHT);

        this.canvasCtx.drawImage(Runner.imageSprite, this.sourceXPos[1],
            this.spritePos.y,
            this.sourceDimensions.WIDTH, this.sourceDimensions.HEIGHT,
            this.xPos[1], this.yPos,
            this.dimensions.WIDTH, this.dimensions.HEIGHT);
    }

    /**
     * Update the x position of an indivdual piece of the line.
     * @param {number} pos Line position.
     * @param {number} increment
     */
    updateXPos = (pos, increment) => {
        var line1 = pos;
        var line2 = pos == 0 ? 1 : 0;

        this.xPos[line1] -= increment;
        this.xPos[line2] = this.xPos[line1] + this.dimensions.WIDTH;

        if (this.xPos[line1] <= -this.dimensions.WIDTH) {
            this.xPos[line1] += this.dimensions.WIDTH * 2;
            this.xPos[line2] = this.xPos[line1] - this.dimensions.WIDTH;
            this.sourceXPos[line1] = this.getRandomType() + this.spritePos.x;
        }
    }

    /**
     * Update the horizon line.
     * @param {number} deltaTime
     * @param {number} speed
     */
    update = (deltaTime, speed) => {
        var increment = Math.floor(speed * (FPS / 1000) * deltaTime);

        if (this.xPos[0] <= 0) {
            this.updateXPos(0, increment);
        } else {
            this.updateXPos(1, increment);
        }
        this.draw();
    }

    /**
     * Reset horizon to the starting position.
     */
    reset = () => {
        this.xPos[0] = 0;
        this.xPos[1] = HorizonLine.dimensions.WIDTH;
    }
}

class Horizon {
    /**
     * Horizon config.
     * @enum {number}
     */
    static config = {
        BG_CLOUD_SPEED: 0.2,
        BUMPY_THRESHOLD: .3,
        CLOUD_FREQUENCY: .5,
        HORIZON_HEIGHT: 16,
        MAX_CLOUDS: 6
    };

    /**
     * Horizon background class.
     * @param {HTMLCanvasElement} canvas
     * @param {Object} spritePos Sprite positioning.
     * @param {Object} dimensions Canvas dimensions.
     * @param {number} gapCoefficient
     * @constructor
     */
    constructor(canvas, spritePos, dimensions, gapCoefficient, rndFunc) {
        this.rndFunc = rndFunc;

        this.canvas = canvas;
        this.canvasCtx = this.canvas.getContext('2d');
        this.config = Horizon.config;
        this.dimensions = dimensions;
        this.gapCoefficient = gapCoefficient;
        this.obstacles = [];
        this.obstacleHistory = [];
        this.horizonOffsets = [0, 0];
        this.cloudFrequency = this.config.CLOUD_FREQUENCY;
        this.spritePos = spritePos;
        this.nightMode = null;

        // Cloud
        this.clouds = [];
        this.cloudSpeed = this.config.BG_CLOUD_SPEED;

        // Horizon
        this.horizonLine = null;
        this.init();
    }

    /**
     * Initialise the horizon. Just add the line and a cloud. No obstacles.
     */
    init = () => {
        this.addCloud();
        this.horizonLine = new HorizonLine(this.canvas, this.spritePos.HORIZON, this.rndFunc);
        this.nightMode = new NightMode(this.canvas, this.spritePos.MOON,
            this.dimensions.WIDTH);
    }

    /**
     * @param {number} deltaTime
     * @param {number} currentSpeed
     * @param {boolean} updateObstacles Used as an override to prevent
     *     the obstacles from being updated / added. This happens in the
     *     ease in section.
     * @param {boolean} showNightMode Night mode activated.
     */
    update = (deltaTime, currentSpeed, updateObstacles, showNightMode) => {
        this.runningTime += deltaTime;
        this.horizonLine.update(deltaTime, currentSpeed);
        this.nightMode.update(showNightMode);
        this.updateClouds(deltaTime, currentSpeed);

        if (updateObstacles) {
            this.updateObstacles(deltaTime, currentSpeed);
        }
    }

    /**
     * Update the cloud positions.
     * @param {number} deltaTime
     * @param {number} currentSpeed
     */
    updateClouds = (deltaTime, speed) => {
        var cloudSpeed = this.cloudSpeed / 1000 * deltaTime * speed;
        var numClouds = this.clouds.length;

        if (numClouds) {
            for (var i = numClouds - 1; i >= 0; i--) {
                this.clouds[i].update(cloudSpeed);
            }

            var lastCloud = this.clouds[numClouds - 1];

            // Check for adding a new cloud.
            if (numClouds < this.config.MAX_CLOUDS &&
                (this.dimensions.WIDTH - lastCloud.xPos) > lastCloud.cloudGap &&
                this.cloudFrequency > Math.random()) {
                this.addCloud();
            }

            // Remove expired clouds.
            this.clouds = this.clouds.filter(function (obj) {
                return !obj.remove;
            });
        } else {
            this.addCloud();
        }
    }

    /**
     * Update the obstacle positions.
     * @param {number} deltaTime
     * @param {number} currentSpeed
     */
    updateObstacles = (deltaTime, currentSpeed) => {
        // Obstacles, move to Horizon layer.
        var updatedObstacles = this.obstacles.slice(0);

        for (var i = 0; i < this.obstacles.length; i++) {
            var obstacle = this.obstacles[i];
            obstacle.update(deltaTime, currentSpeed);

            // Clean up existing obstacles.
            if (obstacle.remove) {
                updatedObstacles.shift();
            }
        }
        this.obstacles = updatedObstacles;

        if (this.obstacles.length > 0) {
            var lastObstacle = this.obstacles[this.obstacles.length - 1];

            if (lastObstacle && !lastObstacle.followingObstacleCreated &&
                lastObstacle.isVisible() &&
                (lastObstacle.xPos + lastObstacle.width + lastObstacle.gap) <
                this.dimensions.WIDTH) {
                this.addNewObstacle(currentSpeed);
                lastObstacle.followingObstacleCreated = true;
            }
        } else {
            // Create new obstacles.
            this.addNewObstacle(currentSpeed);
        }
    }

    removeFirstObstacle = () => {
        this.obstacles.shift();
    }

    /**
     * Add a new obstacle.
     * @param {number} currentSpeed
     */
    addNewObstacle = currentSpeed => {
        var obstacleTypeIndex = this.rndFunc(0, Obstacle.types.length - 1);
        var obstacleType = Obstacle.types[obstacleTypeIndex];

        // Check for multiples of the same type of obstacle.
        // Also check obstacle is available at current speed.
        if (this.duplicateObstacleCheck(obstacleType.type) ||
            currentSpeed < obstacleType.minSpeed) {
            this.addNewObstacle(currentSpeed);
        } else {
            var obstacleSpritePos = this.spritePos[obstacleType.type];

            this.obstacles.push(new Obstacle(this.canvasCtx, obstacleType,
                obstacleSpritePos, this.dimensions,
                this.gapCoefficient, currentSpeed, obstacleType.width, this.rndFunc));

            this.obstacleHistory.unshift(obstacleType.type);

            if (this.obstacleHistory.length > 1) {
                this.obstacleHistory.splice(Runner.config.MAX_OBSTACLE_DUPLICATION);
            }
        }
    }

    /**
     * Returns whether the previous two obstacles are the same as the next one.
     * Maximum duplication is set in config value MAX_OBSTACLE_DUPLICATION.
     * @return {boolean}
     */
    duplicateObstacleCheck = nextObstacleType => {
        var duplicateCount = 0;

        for (var i = 0; i < this.obstacleHistory.length; i++) {
            duplicateCount = this.obstacleHistory[i] == nextObstacleType ?
                duplicateCount + 1 : 0;
        }
        return duplicateCount >= Runner.config.MAX_OBSTACLE_DUPLICATION;
    }

    /**
     * Reset the horizon layer.
     * Remove existing obstacles and reposition the horizon line.
     */
    reset = () => {
        this.obstacles = [];
        this.obstacleHistory = [];
        this.horizonLine.reset();
        this.nightMode.reset();
    }

    /**
     * Update the canvas width and scaling.
     * @param {number} width Canvas width.
     * @param {number} height Canvas height.
     */
    resize = (width, height) => {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    /**
     * Add a new cloud to the horizon.
     */
    addCloud = () => {
        this.clouds.push(new Cloud(this.canvas, this.spritePos.CLOUD,
            this.dimensions.WIDTH));
    }
}
