
import * as THREE from "three";
import * as postprocessing from "postprocessing";
import CameraControls from "camera-controls";
import { GameViewPort, SceneController } from "titan-reactor/host";

const BATTLE_FAR = 128;

const deltaYP = new THREE.Vector3();

const audioListenerPosition = new THREE.Vector3();


interface Config {
    elevateAmount: number;
    rotateSpeed: number;
    fov: number;
    damping: number;
    keyboardSpeed: number;
    focalLength: number;
    bokehScale: number;
    blurQuality: number;
    audioSourceDistance: number;
    depthOfFieldEnabled: boolean;
    rotateAzimuthStart: number;
    rotatePolarStart: number;
    defaultDistance: number;
}

export default class PluginAddon extends SceneController implements SceneController {

    gameOptions = {
        allowUnitSelection: false,
        audio: "3d" as const,
    }

    async onEnterScene(prevData) {
        if (prevData?.target?.isVector3) {
            this.viewport.orbit.setTarget(prevData.target.x, 0, prevData.target.z, false);
        } else {
            this.viewport.orbit.setTarget(0, 0, 0, false);
        }

        this.viewport.orbit.rotateAzimuthTo((this.config.rotateAzimuthStart - 1) * (Math.PI / 3), false);
        this.viewport.orbit.rotatePolarTo((this.config.rotatePolarStart - 1) * (Math.PI / 3), false);

        this.viewport.orbit.rotateAzimuthTo((this.config.rotateAzimuthStart - 1) * (Math.PI / 4), true);
        this.viewport.orbit.rotatePolarTo((this.config.rotatePolarStart - 1) * (Math.PI / 4), true);

        this.viewport.orbit.camera.far = BATTLE_FAR;
        this.viewport.orbit.camera.fov = this.config.fov;
        this.viewport.orbit.camera.updateProjectionMatrix();

        Object.assign(this.viewport.orbit, {
            dollyToCursor: false,
            maxDistance: Math.max(this.mapWidth, this.mapHeight) * 10,
            minDistance: 3,
            maxZoom: 10,
            minZoom: 0.3,
            maxPolarAngle: Math.PI * 0.4,
            minPolarAngle: -Infinity,
            maxAzimuthAngle: Infinity,
            minAzimuthAngle: -Infinity,
        })

        this.viewport.orbit.dollyTo(this.config.defaultDistance, false);
        this.viewport.orbit.zoomTo(1, false);

        this.togglePointerLock(true);

    }

    onConfigChanged(oldConfig) {

        if (this.config.defaultDistance !== oldConfig.defaultDistance) {
            this.viewport.orbit.dollyTo(this.config.defaultDistance, true);
        }

        if (this.config.rotateAzimuthStart !== oldConfig.rotateAzimuthStart) {
            this.viewport.orbit.rotateAzimuthTo((this.config.rotateAzimuthStart - 1) * (Math.PI / 4), true);
        }

        if (this.config.rotatePolarStart !== oldConfig.rotatePolarStart) {
            this.viewport.orbit.rotatePolarTo((this.config.rotatePolarStart - 1) * (Math.PI / 4), true);
        }

    }

    onExitScene({ target, position }) {
        return {
            target,
            position
        }
    }

    onCameraMouseUpdate(delta, elapsed, scrollY, screenDrag, lookAt, mouse, clientX, clientY, clicked) {

        // zoom in or out depending on left click or right click
        if (clicked) {
            if (this.pointerLockLost) {
                this.togglePointerLock(true);
            }
        }

        if (mouse.z === 0) {
            this.viewport.orbit.rotate(-lookAt.x * delta * this.cameraRotateSpeed, -lookAt.y * delta * this.cameraRotateSpeed, true);
        }


        if (lookAt.x !== 0 && mouse.z === -1) {
            this.viewport.orbit.truck(lookAt.x * delta * this.cameraMovementSpeed, 0, true);
        }

        if (lookAt.y !== 0 && mouse.z === -1) {
            this.viewport.orbit.forward(-lookAt.y * delta * this.cameraMovementSpeed, true);
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
    }

    _groundTarget(viewport: GameViewPort, t: THREE.Vector3) {
        return viewport.orbit.getTarget(t).setY(0);
    }

    onShouldHideUnit(unit) {
        return unit.extras.dat.isAddon;
    }

    onCameraKeyboardUpdate(delta, elapsed, move) {
        this.viewport.orbit.dollyToCursor = this.config.controlMode === "fps";
        if (move.x !== 0) {
            this.viewport.orbit.truck(move.x * delta * this.cameraMovementSpeed, 0, true);
        }

        if (move.y !== 0) {
            this.viewport.orbit.forward(move.y * delta * this.cameraMovementSpeed, true);
        }
    }

    onUpdateAudioMixerLocation(delta, elapsed, target, position) {
        return audioListenerPosition.lerpVectors(target, position, this.config.audioSourceDistance);
    }

    onFrame() {
        if (this.followedUnitsPosition) {
            const target = this.followedUnitsPosition;
            this.viewport.orbit.moveTo(target.x, target.y, target.z, true);
        }
    }

}