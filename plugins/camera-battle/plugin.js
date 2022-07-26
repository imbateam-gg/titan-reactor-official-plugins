
const MAX_ACCELERATION = 2;
const ACCELERATION = 1.01;
const BATTLE_FAR = 128;

const deltaYP = new THREE.Vector3();
const _target = new THREE.Vector3();
const audioListenerPosition = new THREE.Vector3();

const { DepthOfFieldEffect, ScanlineEffect, EffectPass, ToneMappingEffect, ToneMappingMode } = postprocessing;

return  {
    gameOptions: {
        showMinimap: true,
        allowUnitSelection: false,
        audio: "3d",
        usePointerLock: true,
    },

    // a few shared settings we can update on init and config change
    _updateSettings() {

        this._keyboardSpeed = this.config.keyboardSpeed;
        this.primaryViewport.orbit.dampingFactor = this.config.damping;
        this._depthOfFieldEffect.getCircleOfConfusionMaterial().uniforms.focalLength.value = this.config.focalLength;
        this._depthOfFieldEffect.bokehScale = this.config.bokehScale;
    },

    async onEnterScene(prevData) {
        const orbit = this.primaryViewport.orbit;
        if (prevData?.target?.isVector3) {
            orbit.setTarget(prevData.target.x, 0, prevData.target.z, false);
        } else {
            orbit.setTarget(0, 0, 0, false);
        }

        this.primaryViewport.orbit.rotateAzimuthTo((this.config.rotateAzimuthStart-1) * (Math.PI/2), false); 
        this.primaryViewport.orbit.rotatePolarTo((this.config.rotatePolarStart-1) * (Math.PI/2), false); 

        this.primaryViewport.orbit.rotateAzimuthTo((this.config.rotateAzimuthStart-1) * (Math.PI/4), true); 
        this.primaryViewport.orbit.rotatePolarTo((this.config.rotatePolarStart-1) * (Math.PI/4), true); 

        orbit.camera.far = BATTLE_FAR;
        orbit.camera.fov = this.config.fov;
        orbit.camera.updateProjectionMatrix();

        orbit.dollyToCursor = false;
      
        orbit.maxDistance = Math.max(this.terrain.mapWidth, this.terrain.mapHeight) * 2;
        orbit.minDistance = 3;
        orbit.maxZoom = 20;
        orbit.minZoom = 0.3;
        orbit.dampingFactor = 0.01;
      
        orbit.maxPolarAngle = Infinity;
        orbit.minPolarAngle = -Infinity
        orbit.maxAzimuthAngle = Infinity;
        orbit.minAzimuthAngle = -Infinity;
      
        this._depthOfFieldEffect = new DepthOfFieldEffect(orbit.camera, {
            focusDistance: 0.01,
            focalLength: 0.1,
            bokehScale: 1.0,
            height: this.config.blurQuality,
          });
        this._updateSettings();

        orbit.dollyTo(this.config.defaultDistance, false);
        orbit.zoomTo(1, false);

        this.primaryViewport.renderOptions.fogOfWarOpacity = 0.5;
        this.primaryViewport.renderOptions.rotateSprites = true;
        this.primaryViewport.cameraShake.enabled = false;

    },

    onSetComposerPasses(renderPass, fogOfWarEffect) {

        const effects = [];
                    
        if (this.config.depthOfFieldEnabled) {
            effects.push(this._depthOfFieldEffect);
        }

        effects.push(fogOfWarEffect);

        return {
            effects,
            passes: [
                renderPass,
                new EffectPass(
                    this.orbit.camera,
                    ...effects
                )
            ]
        };
    },

    onBeforeRender(delta, elapsed) {
        this.primaryViewport.orbit.getTarget(_target);
        this._depthOfFieldEffect.setTarget(_target);
        this._depthOfFieldEffect.getCircleOfConfusionMaterial().adoptCameraSettings(this.primaryViewport.camera);
    },

    onConfigChanged(oldConfig) {
        this._updateSettings();

        // only update default distance if it's changed otherwise we'll get a jump
        if (this.config.defaultDistance !== oldConfig.defaultDistance) {
            this.primaryViewport.orbit.dollyTo(this.config.defaultDistance, true);
        }

        if (this.config.rotateAzimuthStart !== oldConfig.rotateAzimuthStart) {
            this.primaryViewport.orbit.rotateAzimuthTo((this.config.rotateAzimuthStart-1) * (Math.PI/4), true); 
        }

        if (this.config.rotatePolarStart !== oldConfig.rotatePolarStart) {
            this.primaryViewport.orbit.rotatePolarTo((this.config.rotatePolarStart-1) * (Math.PI/4), true); 
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
            this.primaryViewport.orbit.zoomTo(this.primaryViewport.camera.zoom * (clicked.z === 0 ? 2 : 1 / 2), false);
        }

        // rotate according to mouse direction (pointer lock)
        if (lookAt.x || lookAt.y) {
            this.primaryViewport.orbit.rotate((-lookAt.x / 1000) * this.config.rotateSpeed, (-lookAt.y / 1000)  * this.config.rotateSpeed, true);
            
        }

        // elevate the y position if mouse scroll is used
        if (scrollY) {
            this.primaryViewport.orbit.getPosition(deltaYP);

            if (scrollY < 0) {
                this.primaryViewport.orbit.setPosition(deltaYP.x, deltaYP.y - this.config.elevateAmount, deltaYP.z, true);
            } else {
                this.primaryViewport.orbit.setPosition(deltaYP.x, deltaYP.y + this.config.elevateAmount, deltaYP.z, true);
            }
        }
    },

    onShouldHideUnit(unit) {
        return unit.extras.dat.isAddon;
    },

    onCameraKeyboardUpdate(delta, elapsed, move) {
        if (move.x !== 0) {
            this.primaryViewport.orbit.truck(move.x * delta * this._keyboardSpeed, 0, true);
        }

        if (move.y !== 0) {
            this.primaryViewport.orbit.forward(move.y * delta * this._keyboardSpeed, true);
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
            this.primaryViewport.orbit.moveTo(target.x, target.y, target.z, true);
        }
    }
}