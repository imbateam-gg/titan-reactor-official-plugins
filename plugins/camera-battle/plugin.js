
const MAX_ACCELERATION = 2;
const ACCELERATION = 1.01;
const BATTLE_FAR = 128;

const deltaYP = new THREE.Vector3();
const _target = new THREE.Vector3();
const audioListenerPosition = new THREE.Vector3();

const { DepthOfFieldEffect, EffectPass } = postprocessing;

return  {
    gameOptions: {
        audio: "3d",
    },

    // a few shared settings we can update on init and config change
    _updateSettings() {

        this._keyboardSpeed = this.config.keyboardSpeed;
        this.viewport.orbit.dampingFactor = this.config.damping;
        this._depthOfFieldEffect.getCircleOfConfusionMaterial().uniforms.focalLength.value = this.config.focalLength;
        this._depthOfFieldEffect.bokehScale = this.config.bokehScale;
    },

    async onEnterScene(prevData) {
        if (prevData?.target?.isVector3) {
            this.viewport.orbit.setTarget(prevData.target.x, 0, prevData.target.z, false);
        } else {
            this.viewport.orbit.setTarget(0, 0, 0, false);
        }

        this._depthOfFieldEffect = this._depthOfFieldEffect ?? new DepthOfFieldEffect(this.viewport.orbit.camera, {
            focusDistance: 0.01,
            focalLength: 0.1,
            bokehScale: 1.0,
            height: this.config.blurQuality,
        });

        this.viewport.orbit.rotateAzimuthTo((this.config.rotateAzimuthStart-1) * (Math.PI/3), false); 
        this.viewport.orbit.rotatePolarTo((this.config.rotatePolarStart-1) * (Math.PI/3), false); 

        this.viewport.orbit.rotateAzimuthTo((this.config.rotateAzimuthStart-1) * (Math.PI/4), true); 
        this.viewport.orbit.rotatePolarTo((this.config.rotatePolarStart-1) * (Math.PI/4), true); 

        this.viewport.orbit.camera.far = BATTLE_FAR;
        this.viewport.orbit.camera.fov = this.config.fov;
        this.viewport.orbit.camera.updateProjectionMatrix();

        Object.assign(this.viewport.orbit, {
            dollyToCursor: false,
            maxDistance: Math.max(this.mapWidth, this.mapHeight) * 2,
            minDistance: 3,
            maxZoom: 20,
            minZoom: 0.3,
            dampingFactor:0.01,
            maxPolarAngle: Infinity,
            minPolarAngle: -Infinity,
            maxAzimuthAngle: Infinity,
            minAzimuthAngle: -Infinity,
        })

        this._updateSettings();

        this.viewport.orbit.dollyTo(this.config.defaultDistance, false);
        this.viewport.orbit.zoomTo(1, false);

        this.viewport.spriteRenderOptions.rotateSprites = true;
        this.viewport.cameraShake.enabled = true;

        const postProcessing = this.viewport.postProcessing;
        this.viewport.postProcessing = {
            effects: [postProcessing.fogOfWarEffect, this._depthOfFieldEffect],
            passes: [postProcessing.renderPass, new EffectPass(this.viewport.camera, postProcessing.fogOfWarEffect, this._depthOfFieldEffect)],
        }
        this.togglePointerLock(true);
    },

    onBeforeRender() {
        this._depthOfFieldEffect.setTarget(this.viewport.orbit.getTarget(_target));
        this._depthOfFieldEffect.getCircleOfConfusionMaterial().adoptCameraSettings(this.viewport.camera);
    },

    onConfigChanged(oldConfig) {
        this._updateSettings();

        if (this.config.defaultDistance !== oldConfig.defaultDistance) {
            this.viewport.orbit.dollyTo(this.config.defaultDistance, true);
        }

        if (this.config.rotateAzimuthStart !== oldConfig.rotateAzimuthStart) {
            this.viewport.orbit.rotateAzimuthTo((this.config.rotateAzimuthStart-1) * (Math.PI/4), true); 
        }

        if (this.config.rotatePolarStart !== oldConfig.rotatePolarStart) {
            this.viewport.orbit.rotatePolarTo((this.config.rotatePolarStart-1) * (Math.PI/4), true); 
        }

    },

    onExitScene({target, position}) {
        return {
            target,
            position
        }
    },

    onCameraMouseUpdate(delta, elapsed, scrollY, screenDrag, lookAt, mouse, clientX, clientY, clicked) {
        
        // zoom in or out depending on left click or right click
        if (clicked) {
            if (this.pointerLockLost) {
                this.togglePointerLock(true);
            } else {
                this.viewport.orbit.zoomTo(this.viewport.camera.zoom * (clicked.z === 0 ? 2 : 1 / 2), false);
            }
        }

        // rotate according to mouse direction (pointer lock)
        if (lookAt.x || lookAt.y) {
            this.viewport.orbit.rotate((-lookAt.x / 1000) * this.config.rotateSpeed, (-lookAt.y / 1000)  * this.config.rotateSpeed, true);
            
        }

        // elevate the y position if mouse scroll is used
        if (scrollY) {
            this.viewport.orbit.getPosition(deltaYP);

            if (scrollY < 0) {
                this.viewport.orbit.setPosition(deltaYP.x, deltaYP.y - this.config.elevateAmount, deltaYP.z, true);
            } else {
                this.viewport.orbit.setPosition(deltaYP.x, deltaYP.y + this.config.elevateAmount, deltaYP.z, true);
            }
        }
    },

    onShouldHideUnit(unit) {
        return unit.extras.dat.isAddon;
    },

    onCameraKeyboardUpdate(delta, elapsed, move) {
        if (move.x !== 0) {
            this.viewport.orbit.truck(move.x * delta * this._keyboardSpeed, 0, true);
        }

        if (move.y !== 0) {
            this.viewport.orbit.forward(move.y * delta * this._keyboardSpeed, true);
        }

        if (move.y === 0 && move.x === 0) {
            this._keyboardSpeed = this.config.keyboardSpeed;
        } else {
            this._keyboardSpeed = Math.min(this.config.keyboardAccelMax, this._keyboardSpeed * (1 + this.config.keyboardAccel));
        }
    },

    onUpdateAudioMixerLocation(delta, elapsed, target, position) {
        return audioListenerPosition.lerpVectors(target, position, this.config.audioSourceDistance);
    },

    onFrame() {
        if (this.followedUnitsPosition) {
            const target = this.followedUnitsPosition;
            this.viewport.orbit.moveTo(target.x, target.y, target.z, true);
        }
},

    dispose() {
        this._depthOfFieldEffect && this._depthOfFieldEffect.dispose();
    }
}