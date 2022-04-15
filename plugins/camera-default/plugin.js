
const DEFAULT_FAR = 256;
const POLAR_MAX = (10 * Math.PI) / 64;
const POLAR_MIN = (2 * Math.PI) / 64;


    // } else {
    // if (units.followingUnit && units.selected.length) {
    //   const x =
    //     units.selected.reduce(
    //       (sum, unit) => sum + unit.getWorldPosition().x,
    //       0
    //     ) / units.selected.length;
    //   const z =
    //     units.selected.reduce(
    //       (sum, unit) => sum + unit.getWorldPosition().z,
    //       0
    //     ) / units.selected.length;

    //   cameras.setTarget(x, getTerrainY(x, z), z, true);
    // }

return  {
    boundByMap: {
        scaleBoundsByCamera: true,
    },
    minimap: true,
    background: "tiles",
    fogOfWar: 1,

    // a few shared setings we can update on init and config change
    _updateSettings() {
        this._edgeSpeed = this.getConfig("screenDragSpeed");
        this._keyboardSpeed = this.getConfig("keyboardSpeed");
        this.orbit.dampingFactor = this.getConfig("damping");
        this.orbit.boundaryFriction = this.getConfig("edgeFriction");
    },

    async onEnterCameraMode( prevData, camera ) {

        if (prevData?.target?.isVector3) {
            await this.orbit.setTarget(prevData.target.x, 0, prevData.target.z, false);
        } else {
            await this.orbit.setTarget(0, 0, 0, false);
        }

        this.orbit.camera.far = DEFAULT_FAR;
        this.orbit.camera.fov = 15;
        this.orbit.camera.updateProjectionMatrix();

        this.orbit.dollyToCursor = true;
        this.orbit.verticalDragToForward = true;

        this.orbit.maxDistance = DEFAULT_FAR;
        this.orbit.minDistance = 20;

        this.orbit.maxPolarAngle = POLAR_MAX;
        this.orbit.minPolarAngle = POLAR_MIN;
        this.orbit.maxAzimuthAngle = 0;
        this.orbit.minAzimuthAngle = 0;
        this._updateSettings();

        await this.orbit.rotatePolarTo(POLAR_MIN, false);
        await this.orbit.rotateAzimuthTo(0, false);
        await this.orbit.zoomTo(1, false);
        await this.orbit.dollyTo(this.getConfig("defaultDistance"), false);

    },

    onConfigChanged(newConfig, oldConfig) {
        if (this.isActiveCameraMode) {

            this._updateSettings();

            // only update default distance if it's changed otherwise we'll get a jump
            if (newConfig.defaultDistance.value !== oldConfig.defaultDistance.value) {
                this.orbit.dollyTo(this.getConfig("defaultDistance"), true);
            }

            if (this.config.pipSize.value !== oldConfig.pipSize.value) {
                this.setPipDimensions(null, this.config.pipSize.value);
            }
        }
    },

    onExitCameraMode(target, position) {
        return {
            target,
            position
        }
    },

    onCameraMouseUpdate(delta, elapsed, scrollY, screenDrag, lookAt, mouse, clientX, clientY, clicked) {
        if (scrollY) {
            if (scrollY < 0) {
                this.orbit.dolly(this.getConfig("dollyAmount"), true);
                this.orbit.rotate(0, (Math.PI * this.getConfig("rotateAmount")) / 96, true)
            } else {
                this.orbit.dolly(-this.getConfig("dollyAmount"), true);
                this.orbit.rotate(0, -(Math.PI * this.getConfig("rotateAmount")) / 96, true);
            }
        }

        if (screenDrag.x !== 0) {
            this.orbit.truck(screenDrag.
                x * delta * this._edgeSpeed, 0, true);
        }

        if (screenDrag.y !== 0) {
            this.orbit.forward(screenDrag.y * delta * this._edgeSpeed, true);
        }

        if (screenDrag.y === 0 && screenDrag.x === 0) {
            this._edgeSpeed = this.getConfig("screenDragSpeed");
        } else {
            this._edgeSpeed = Math.min(this.getConfig("screenDragAccelMax"), this._edgeSpeed * (1 + this.getConfig("screenDragAccel")));
        }
    },

    onCameraKeyboardUpdate(delta, elapsed, move) {
        if (move.x !== 0) {
            this.orbit.truck(move.x * delta * this._keyboardSpeed, 0, true);
        }

        if (move.y !== 0) {
            this.orbit.forward(move.y * delta * this._keyboardSpeed, true);
        }

        if (move.y === 0 && move.x === 0) {
            this._keyboardSpeed = this.getConfig("keyboardSpeed");
        } else {
            this._keyboardSpeed = Math.min(this.getConfig("keyboardAccelMax"), this._keyboardSpeed * (1 + this.getConfig("keyboardAccel")));
        }
    },

    onUpdateAudioMixerLocation(delta, elapsed, target, position) {
        return target;
    },

    onDrawMinimap(ctx, view, target, position) {
        ctx.strokeStyle = "white";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(...view.tl);
        ctx.lineTo(...view.tr);
        ctx.lineTo(...view.br);
        ctx.lineTo(...view.bl);
        ctx.lineTo(...view.tl);
        ctx.stroke();
    }

}