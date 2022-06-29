const { THREE, STDLIB } = arguments[0];

// Seconds per bw game frame (tick)
const SECONDS_PER_FRAME = 42 / 1000;
const MIN_SECONDS = 5;

// we'll use this to write colors and read colors using THREE.Color.getHSL()
const color = {};

return {
    _updateVisibility(updateColors) {
        const visible = this.config.toggleVisible;

        //as of three 137 css renderer only respects CSS2DObject visible 
        for (const unit of this._deadUnits) {
            unit.obj.visible = visible;
            if (updateColors) {
                this._setStyleFilter(unit.style, unit.color);
            }
        }

    },

    _setStyleFilter(style, playerColor) {
        if (this.config.usePlayerColors) {
            playerColor.getHSL(color);
            // rotate the color based on the player hue, should approximately get us there
            style.filter = `hue-rotate(${color.h * 320}deg) brightness(4) saturate(1.25) contrast(0.75)`;
        } else {
            // default red with brightness 2
            style.filter = `brightness(2)`;
        }
    },

    onGameReady() {
        // the dead units we are tracking
        this._deadUnits = [];
        // the last time we checked if our dead units timed out
        // and need to be flushed from the list
        this._lastFrameCheck = 0;
        
        // A Group to keep all the dead unit icons in so we the CSSRenderer can display them for us
        this._group = new THREE.Group();
        this.cssScene.add(this._group);

        // Let Titan Reactor know we are using this hotkey
        this.registerHotkey(this.config.toggleVisibleHotKey, () => {
            this.setConfig("toggleVisible", !this.config.toggleVisible);
        });
    },

    onConfigChanged(oldConfig) {
        this._updateVisibility(this.config.usePlayerColors !== oldConfig.usePlayerColors);
    },

    onUnitKilled(unit) {
        // it's not a human player controlled unit so we don't care
        if (unit.extras.player === undefined) {
            return;
        }
        
        const image = new Image();
        // icons are base64 encoded so we can use them as a data URI
        image.src = this.assets.cmdIcons[unit.typeId];

        // add the HTMLImageElement to a new CSS2DObject which our CSSRenderer can use
        const obj = new STDLIB.CSS2DObject(image);
        // convert px game units to 3d map units
        obj.position.x = this.pxToGameUnit.x(unit.x);
        obj.position.y = 0;
        obj.position.z = this.pxToGameUnit.y(unit.y);
        obj.visible = this.config.toggleVisible;

        // work-around for scale being overwritten css renderer
        obj.onAfterRender = () => image.style.transform += ` scale(${this.config.iconScale})`;

        // add the CSS2DObject to our group and therefore to our scene
        this._group.add(obj)

        // track this unit so we can remove it from the scene when it times out
        const deadUnit = {
            deathFrame: this.getFrame(),
            obj,
            color: unit.extras.player.color,
            style: image.style
        };
        this._setStyleFilter(deadUnit.style, deadUnit.color);
        this._deadUnits.push(deadUnit);
    },

    /*
     * Every game frame, check if any dead units timed out only every MIN_SECONDS
    */
    onFrame(frame) {
        // avoid unnecessary work, especially in onFrame and onRender callbacks
        if (this._deadUnits.length && (frame - this._lastFrameCheck) * SECONDS_PER_FRAME > MIN_SECONDS) {
            this._lastFrameCheck = frame;
            this._deadUnits = this._deadUnits.filter(unit => {
                if ((frame - unit.deathFrame) * SECONDS_PER_FRAME > this.config.timeFrame) {
                    unit.obj.removeFromParent();
                    return false;
                }
                return true;
            });
        }
    },

    _reset() {
        this._lastFrameCheck = 0;
        for (const unit of this._deadUnits) {
            unit.obj.removeFromParent();
        }
        this._deadUnits.length = 0;
    },

    /**
     * When a user seeks to a different location in the replay, reset all dead units.
     */
    onFrameReset() {
        this._reset();
    },

    /*
     * When the game is reset, make sure to remove everything from the scene.
     */
    onGameDisposed() {
        this._reset();
    }
}