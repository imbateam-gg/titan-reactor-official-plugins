
import * as THREE from "three";
import { BwDAT, GameViewPort, Player, UnitStruct } from "@titan-reactor-runtime/host";


const _pos = new THREE.Vector3(0, 0, 0);

const unitTypes = enums.unitTypes;
const orders = enums.orders;

const workerTypes = [enums.unitTypes.scv, enums.unitTypes.drone, enums.unitTypes.probe];

const DEFAULT_FAR = 256;
const POLAR_MAX = (10 * Math.PI) / 64;
const POLAR_MIN = (2 * Math.PI) / 64;

const PIP_PROXIMITY = 16;

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

const rankA = [
  unitTypes.ghost, unitTypes.scienceVessel, unitTypes.battleCruiser,
  unitTypes.nuclearMissile, unitTypes.ultralisk, unitTypes.guardian, unitTypes.queen, unitTypes.defiler, unitTypes.infestedTerran,
  unitTypes.darkTemplar, unitTypes.devourer, unitTypes.darkArchon, unitTypes.arbiter, unitTypes.carrier,

  unitTypes.covertOps, unitTypes.physicsLab, unitTypes.infestedCommandCenter, unitTypes.hive, unitTypes.nydusCanal, unitTypes.defilerMound,
  unitTypes.nuclearSilo, unitTypes.greaterSpire, unitTypes.queensNest, unitTypes.ultraliskCavern,

  unitTypes.templarArchives, unitTypes.fleetBeacon, unitTypes.arbitalTribunal,
];

const rankB = [
  unitTypes.goliath, unitTypes.wraith, unitTypes.siegeTankSiegeMode, unitTypes.broodling, unitTypes.mutalisk, unitTypes.scourge, unitTypes.dropship, unitTypes.valkryie, unitTypes.corsair,
  unitTypes.highTemplar, unitTypes.archon, unitTypes.scout, unitTypes.reaver,

  unitTypes.commandCenter, unitTypes.starport, unitTypes.scienceFacility, unitTypes.engineeringBay, unitTypes.armory,
  unitTypes.bunker,
  unitTypes.hatchery, unitTypes.lair, unitTypes.spire, unitTypes.darkSwarm,
  unitTypes.nexus, unitTypes.cyberneticsCore, unitTypes.stargate, unitTypes.roboticsSupportBay
];

const rankC = [
  unitTypes.siegeTankTankMode, unitTypes.vulture, unitTypes.firebat, unitTypes.hydralisk, unitTypes.zealot, unitTypes.dragoon, unitTypes.shuttle, unitTypes.lurker,

  unitTypes.barracks, unitTypes.academy, unitTypes.factory, unitTypes.machineShop, unitTypes.missileTurret,
  unitTypes.hydraliskDen,
  unitTypes.gateway, unitTypes.photonCannon, unitTypes.citadelOfAdun, unitTypes.roboticsFacility, unitTypes.observatory,
];

const rankD = [
  unitTypes.marine, unitTypes.medic, unitTypes.zergling, unitTypes.interceptor,

  unitTypes.supplyDepot, unitTypes.refinery, unitTypes.controlTower,
  unitTypes.evolutionChamber, unitTypes.spawningPool, unitTypes.pylon,
  unitTypes.forge, unitTypes.shieldBattery
];

const rankE = [
  unitTypes.scv, unitTypes.spiderMine, unitTypes.scannerSweep, unitTypes.drone, unitTypes.overlord, unitTypes.mutaliskCocoon, unitTypes.probe, unitTypes.observer, unitTypes.scarab, unitTypes.lurkerEgg, unitTypes.disruptionWeb,

  unitTypes.comsatStation, unitTypes.creepColony, unitTypes.sporeColony, unitTypes.sunkenColony,
  unitTypes.extractor,
  unitTypes.assimilator,
];

function easeOutQuint(x: number): number {
  return 1 - Math.pow(1 - x, 5);
  }

  function easeOutCubic(x: number): number {
    return 1 - Math.pow(1 - x, 3);
    }

type Quadrant<T> = { items: T[], x: number, y: number };

// simple quadrant for items
/**
 * @public
 */
class SimpleQuadtree<T> {
  #size: number;
  #scale: THREE.Vector2;
  #offset: THREE.Vector2;
  #items: Record<string, T[]> = {};

  #normalized = new THREE.Vector2();
  #radius = new THREE.Vector2();

  #quadrants: Quadrant<T>[] = []

  get quadrants() {
    return this.#quadrants;
  }

  get size() {
    return this.#size;
  }

  constructor(size: number, scale = new THREE.Vector2(1, 1), offset = new THREE.Vector2(0, 0),) {
    this.#size = size;

    for (let y = 0; y < this.#size; y++) {
      for (let x = 0; x < this.#size; x++) {
        const items = this.#items[`${x},${y}`] = [];
        this.#quadrants[y * this.#size + x] = { items, x, y };
      }
    }

    this.#scale = scale;
    this.#offset = offset;

  }

  #normalize(out: THREE.Vector2, x: number, y: number, useOffset = true) {
    out.set(
      Math.floor(((x + (useOffset ? this.#offset.x : 0)) / this.#scale.x) * this.size), Math.floor(((y + (useOffset ? this.#offset.y : 0)) / this.#scale.y) * this.size));
  }

  add(x: number, y: number, item: T) {
    this.#normalize(this.#normalized, x, y);
    this.#items[`${this.#normalized.x},${this.#normalized.y}`].push(item);
  }

  getNearby(x: number, y: number, radius = 0) {
    this.#normalize(this.#normalized, x, y);

    if (radius === 0) {
      return this.#items[`${this.#normalized.x},${this.#normalized.y}`];
    } else {
      const items: T[] = [];

      this.#normalize(this.#radius, radius, radius, false);

      const minX = Math.floor(Math.max(0, this.#normalized.x - this.#radius.x));
      const minY = Math.floor(Math.max(0, this.#normalized.y - this.#radius.y));
      const maxX = Math.floor(Math.min(this.#size - 1, this.#normalized.x + this.#radius.x));
      const maxY = Math.floor(Math.min(this.#size - 1, this.#normalized.y + this.#radius.y));

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          items.push(...this.#items[`${x},${y}`]);
        }
      }

      return items;
    }
  }

  clear() {
    for (let i = 0; i < this.#size; i++) {
      for (let j = 0; j < this.#size; j++) {
        this.#items[`${i},${j}`].length = 0;
      }
    }
  }
}


class SimpleHeatmap {
  #heatmap: number[] = [];
  #size: number;

  constructor(size: number) {
    this.#size = size;
    for (let i = 0; i < size * size; i++) {
      this.#heatmap[i] = 0;
    }
  }

  decayAll(decay = 0.9) {
    for (let i = 0; i < this.#size * this.#size; i++) {
      this.#heatmap[i] *= decay;
    }
  }

  decay(x: number, y: number, decay = 0.9) {
    this.#heatmap[y * this.#size + x] *= decay;
  }

  get(x: number, y: number) {
    return this.#heatmap[y * this.#size + x];
  }

  set(x: number, y: number, value = 1) {
    this.#heatmap[y * this.#size + x] = value;
  }

  clear() {
    for (let i = 0; i < this.#size * this.#size; i++) {
      this.#heatmap[i] = 0;
    }
  }

  toString() {
    return arrToString(this.#heatmap, this.#size);
  }
}

const arrToString = (arr: any[], size: number) => {
  let str = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      str += arr[y * size + x].toFixed(2) + " ";
    }
    str += "\n";
  }
  return str;
}

/**
 * @public
 */
class UnitInterestScore {
  #bwDat: BwDAT;

  constructor(bwDat: BwDAT) {
    this.#bwDat = bwDat;
  }

  getAverageScore(units: UnitStruct[]) {
    const n = units.reduce((sum, unit) => {
      return sum + this.unitScore(unit);
    }, 0);

    return n / (units.length + 1);
  }

  getMaxScore(units: UnitStruct[]) {
    return units.reduce((max, unit) => {
      const score = this.unitScore(unit);
      if (score > max) max = score;
      return max
    }, 0);
  }

  getMaxScoreUnit(units: UnitStruct[]) {
    return units.reduce((max, unit) => {
      const score = this.unitScore(unit);
      if (score > this.unitScore(max)) max = unit;
      return max
    }, units[0]);
  }

  unitScore(unit: UnitStruct) {
    return this.getOrderScore(unit.order!) * this.getUnitRankScore(unit);
  }

  getUnitRankScore(unit: UnitStruct): number {
    if (rankA.includes(unit.typeId)) {
      return 1;
    } else if (rankB.includes(unit.typeId)) {
      return 0.8;
    } else if (rankC.includes(unit.typeId)) {
      return 0.6;
    } else if (rankD.includes(unit.typeId)) {
      return 0.4;
    } else if (rankE.includes(unit.typeId)) {
      return 0.2;
    }
    return 0.1;
  }

  getOrderScore(order: number) {
    switch (order) {

      // case orders.harvest1:
      // case orders.harvest2:
      // case orders.moveToGas:
      // case orders.waitForGas:
      // case orders.harvestGas:
      // case orders.returnGas:
      // case orders.moveToMinerals:
      // case orders.waitForMinerals:
      // case orders.miningMinerals:
      // case orders.harvest3:
      // case orders.harvest4:
      // case orders.returnMinerals:
      //   return 0.01;

      case orders.gaurd:
      case orders.playerGaurd:
      case orders.turretGaurd:
      case orders.bunkerGaurd:
      case orders.castScannerSweep:
      case orders.placeBuilding:
      case orders.placeProtossBuilding:
      case orders.createProtossBuilding:
      case orders.constructingBuilding:

        return 0.1;
      case orders.holdPosition:
      case orders.interceptorAttack:
      case orders.trainFighter:
      case orders.repair:
      case orders.move:
        return 0.3;
      case orders.unburrowing:
      case orders.medicHeal:
      case orders.train:
      case orders.placeAddOn:
      case orders.buildAddOn:
        return 0.5;
      case orders.attackMove:
      case orders.attackFixedRange:
      case orders.unload:
      case orders.moveUnload:
      case orders.enterTransport:
      case orders.buildingLand:
      case orders.buildingLiftOff:
      case orders.researchTech:
      case orders.burrowing:
      case orders.upgrade:
      case orders.sieging:
        return 0.8;
      case orders.attackUnit:
      case orders.castConsume:
      case orders.castDarkSwarm:
      case orders.castDefensiveMatrix:
      case orders.castDisruptionWeb:
      case orders.castEmpShockwave:
      case orders.castEnsnare:
      case orders.castFeedback:
      case orders.castHallucination:
      case orders.castInfestation:
      case orders.castIrradiate:
      case orders.castLockdown:
      case orders.castMaelstrom:
      case orders.castMindControl:
      case orders.castNuclearStrike:
      case orders.castOpticalFlare:
      case orders.castParasite:
      case orders.castPlague:
      case orders.castPsionicStorm:
      case orders.castRecall:
      case orders.castRestoration:
      case orders.castSpawnBroodlings:
      case orders.castStasisField:
      case orders.scarabAttack:
      case orders.die:
        return 1;

      default:
        return 0.01;
    }
  }

  unitOfInterestFilter(unit: UnitStruct) {
    const unitType = this.#bwDat.units[unit.typeId];
    return !unitType.isResourceContainer && unit.owner < 8;
    // if (unitType.isResourceMiner) {
    //   return unit.order === orders.attackMove || unit.order === orders.attackUnit;
    // } else if (
    //   unit.typeId === unitTypes.sunkenColony || unit.typeId === unitTypes.sporeColony || unit.typeId === unitTypes.bunker || unit.typeId === unitTypes.photonCannon) {
    //   return true;
    // } else if (unitType.isResourceContainer) {
    //   return false;
    // }
    // return true;
  }

}


function spreadFactorVariance(units: UnitStruct[]): number {
  let meanX = 0;
  let meanY = 0;
  let n = units.length;

  // Calculate mean coordinates
  for (let i = 0; i < n; i++) {
    meanX += units[i].x;
    meanY += units[i].y;
  }
  meanX /= n;
  meanY /= n;

  // Calculate variance for X and Y
  let varianceX = 0;
  let varianceY = 0;
  for (let i = 0; i < n; i++) {
    varianceX += Math.pow(units[i].x - meanX, 2);
    varianceY += Math.pow(units[i].y - meanY, 2);
  }
  varianceX /= n;
  varianceY /= n;

  // Calculate total variance
  let totalVariance = varianceX + varianceY;

  return totalVariance;
}

function maxTotalVariance(deltaX: number, deltaY: number): number {
  // Calculate variance using the function from before
  // const calculatedVariance = spreadFactorVariance(points);

  // Calculate maximum possible variance within the quartile
  const maxVarianceX = (Math.pow(0 - deltaX, 2) + Math.pow(deltaX - 0, 2)) / 2;
  const maxVarianceY = (Math.pow(0 - deltaY, 2) + Math.pow(deltaY - 0, 2)) / 2;

  // Normalize the variance
  // const normalizedVariance = calculatedVariance / maxTotalVariance;

  return maxVarianceX + maxVarianceY;;
}


const QUAD_SIZE = 8;


export default class PluginAddon extends SceneController {

  #pointsOfInterest: THREE.Vector3[] = [];
  // userData.priority, userData.position, userData.unit, userData.player, userData.frame, userData.type , userData.score, userData.rankScore, userData.interestScore

  #unitWorkerScore: UnitInterestScore;
  #units: SimpleQuadtree<UnitStruct>;
  #heatmap: SimpleHeatmap;

  #lastUpdateFrame = 0;
  #lastHeatMapUpdateFrame = 0;
  #maxTotalSpreadVariance = 0;

  init() {

    this.#unitWorkerScore = new UnitInterestScore(this.assets.bwDat);

    this.#units = new SimpleQuadtree<UnitStruct>(QUAD_SIZE, new THREE.Vector2(this.map.size[0] * 32, this.map.size[1] * 32), new THREE.Vector2(0, 0));
    this.#heatmap = new SimpleHeatmap(QUAD_SIZE);

    // this.events.on("pre-run:frame", () => {
    //     for (const u of this.openBW.iterators.units) {
    //         if (this.#isArmyUnit(u)) {
    //             this.#units.insert(u);
    //         }
    //     }
    //     console.log("frame" , this.openBW.getOriginal().getCurrentFrame());
    // });

    this.events.on("pre-run:complete", () => {
      console.log("complete")
    });


    this.events.on("unit-completed", () => {

    });

    this.events.on("unit-destroyed", (unit) => {
      if (this.#secondFollowedUnit?.id === unit.id) {
        this.#secondFollowedUnit = undefined;
      }
      this.#heatmap.decay(unit.x, unit.y);
    });

    this.events.on("unit-updated", (unit) => {
      if (this.#unitWorkerScore.unitOfInterestFilter(unit)) {
        this.#units.add(unit.x, unit.y, unit);
      }
    });

    this.events.on("frame-reset", () => {
      this.#reset();
      this.#heatmap.clear();
    })
    console.log("PLENGTH", this.players.length);

    this.#maxTotalSpreadVariance = maxTotalVariance(this.map.size[0] * 32, this.map.size[1] * 32);

  }

  #reset() {
    this.#secondFollowedUnit = undefined;
    this.followedUnits.clear();
    this.#units.clear();
  }

  async #setupCamera(viewport: GameViewPort) {
    const orbit = viewport.orbit;

    orbit.camera.far = DEFAULT_FAR;
    orbit.camera.fov = 15;
    orbit.camera.updateProjectionMatrix();

    orbit.dollyToCursor = true;
    orbit.verticalDragToForward = true;

    orbit.maxDistance = 128;
    orbit.minDistance = 20;

    orbit.maxPolarAngle = POLAR_MAX;
    orbit.minPolarAngle = POLAR_MIN + THREE.MathUtils.degToRad(this.config.tilt);
    orbit.maxAzimuthAngle = THREE.MathUtils.degToRad(45);
    orbit.minAzimuthAngle = -THREE.MathUtils.degToRad(45);

    await orbit.rotatePolarTo(POLAR_MAX, false);
    await orbit.rotateAzimuthTo(0, false);
    await orbit.zoomTo(1, false);
    await orbit.dollyTo(55, false);
  }

  #cameraAdjustment(units: UnitStruct[]): number {
    let meanX = 0;
    let meanY = 0;
    let n = units.length;
  
    // Calculate mean coordinates
    for (let unit of units) {
      meanX += unit.x;
      meanY += unit.y;
    }
    meanX /= n;
    meanY /= n;
  
    // Calculate variance for X and Y
    let varianceX = 0;
    let varianceY = 0;
    for (let unit of units) {
      varianceX += Math.pow(unit.x - meanX, 2);
      varianceY += Math.pow(unit.y - meanY, 2);
    }
    varianceX /= n;
    varianceY /= n;
  
    // Optional: Normalize the variance by the dimensions of the map
    const normalizedVarianceX = varianceX / Math.pow(this.map.size[0] * 32 / QUAD_SIZE, 2);
    const normalizedVarianceY = varianceY / Math.pow(this.map.size[1] * 32 / QUAD_SIZE, 2);
  
    // Adjust camera distance. This can be a function of normalized variance.
    // For this example, let's say we linearly scale camera distance
    const cameraDistance = Math.sqrt(normalizedVarianceX + normalizedVarianceY);
  
    return cameraDistance;
  }

  public async onEnterScene(prevData) {
    this.viewport.fullScreen();
    this.viewport.rotateSprites = true;

    this.#reset();

    this.#setupCamera(this.viewport) ;
    this.#setupCamera(this.secondViewport) ;

    this.secondViewport.name = "pip";
    this.secondViewport.height = this.config.pipSize;
    this.secondViewport.right = 0.05;
    this.secondViewport.bottom = 0.05;

  }

  onConfigChanged(oldConfig: Record<string, unknown>): void {
    this.secondViewport.height = this.config.pipSize;
  }

  #secondFollowedUnit: UnitStruct | undefined;

  #activateSecondQuadrant(quadrant: Quadrant<UnitStruct>) {
    let maxScoreUnit = this.#secondFollowedUnit = this.#unitWorkerScore.getMaxScoreUnit(quadrant.items);

    const nx = maxScoreUnit.x;// quadrant.x / this.#units.size * 32 * this.map.size[0] + 16 * 32;
    const ny = maxScoreUnit.y;//quadrant.y / this.#units.size * 32 * this.map.size[1] + 16 * 32;

    this.pxToWorld.xyz(nx, ny, _pos);

    this.secondViewport.orbit.moveTo(
      _pos.x,
      _pos.y,
      _pos.z,
      true
    );
    this.secondViewport.orbit.dollyTo(this.config.baseDistance * 3/4, true)

    // this.secondViewport.orbit.rotatePolarTo(this.secondViewport.orbit.minPolarAngle + Math.random() * THREE.MathUtils.degToRad(this.config.polarVariance), true);
    // this.secondViewport.orbit.rotateAzimuthTo((-0.5 + Math.random()) * THREE.MathUtils.degToRad(this.config.azimuthVariance), true);

  }

  #activateQuadrant(quadrant: Quadrant<UnitStruct>) {
    this.followedUnits.clear();

    //todo change to top 3 units?
    let maxScoreUnit = this.#unitWorkerScore.getMaxScoreUnit(quadrant.items);
    let maxScore = this.#unitWorkerScore.unitScore(maxScoreUnit);

    const nx = maxScoreUnit.x;// quadrant.x / this.#units.size * 32 * this.map.size[0] + 16 * 32;
    const ny = maxScoreUnit.y;//quadrant.y / this.#units.size * 32 * this.map.size[1] + 16 * 32;

    // let x = nx, y = ny;
    // for (const unit of quadrant.items) {
    //     x = x * (1 - this.#unitWorkerScore.unitScore(unit) / maxScore) + unit.x * (this.#unitWorkerScore.unitScore(unit) / maxScore);
    //     y = y * (1 - this.#unitWorkerScore.unitScore(unit) / maxScore) + unit.y * (this.#unitWorkerScore.unitScore(unit) / maxScore);
    // }

    this.pxToWorld.xyz(nx, ny, _pos);

    this.viewport.orbit.moveTo(
      _pos.x,
      _pos.y,
      _pos.z,
      true
    );

    const cameraAdjustment = this.#cameraAdjustment(quadrant.items);
    // const spread = spreadFactorVariance(quadrant.items) / this.#maxTotalSpreadVariance;
    console.log("SPREAD", cameraAdjustment, easeOutCubic(cameraAdjustment));
    // 0 is zoom all the way
    // 1 is zoom all the way out
    const lerpedBaseDistance = THREE.MathUtils.lerp(this.config.baseDistance, this.config.baseDistance + this.config.distanceVariance, easeOutCubic(cameraAdjustment));  

    this.viewport.orbit.dollyTo(lerpedBaseDistance, true)
    // this.viewport.orbit.dollyTo(this.config.baseDistance - (this.config.distanceVariance / 2) + Math.random() * this.config.distanceVariance, true)

    this.viewport.orbit.rotatePolarTo(this.viewport.orbit.minPolarAngle + Math.random() * THREE.MathUtils.degToRad(this.config.polarVariance), true);
    this.viewport.orbit.rotateAzimuthTo((-0.5 + Math.random()) * THREE.MathUtils.degToRad(this.config.azimuthVariance), true);

    // this.followedUnits.set([maxScoreUnit])
    // this.selectedUnits.set([maxScoreUnit])

    this.followedUnits.set(quadrant.items)
    this.selectedUnits.set(quadrant.items)

    this.#lastUpdateFrame = this.elapsed;
    this.#heatmap.set(quadrant.x, quadrant.y, 1);
  }

  #groundTarget(viewport, t) {
    return viewport.orbit.getTarget(t).setY(0);
  }

  #areProximate(a, b) {
    return a.distanceTo(b) < PIP_PROXIMITY;
  }

  #areProximateViewports(a, b) {
    return this.#areProximate(
      this.#groundTarget(a, _a),
      this.#groundTarget(b, _b)
    );
  }

  onMinimapDragUpdate(pos, isDragStart, mouseButton) {

    if (mouseButton === 0)  {
      _c.set(pos.x, 0, pos.y);

      if (isDragStart) {
         this.secondViewport.enabled = true;
      }

      this.secondViewport.orbit.moveTo(pos.x, 0, pos.y, !isDragStart);
      
    }

  }

  onFrame(frame: number, commands: any[]): void {

    this.sendUIMessage({
      state: {
        lastHeatMapUpdateFrame: this.#lastHeatMapUpdateFrame,
        lastUpdateFrame: this.#lastUpdateFrame,
        elapsed: this.elapsed,
        frame,
      },
      data: {
        size: this.#units.size,
        quadrants: this.#units.quadrants.map((q) => {
          return {
            x: q.x,
            y: q.y,
            score: this.#unitWorkerScore.getAverageScore(q.items),
            units: q.items.length,
            heatmap: this.#heatmap.get(q.x, q.y),
          }
        })
      }
    })

    if (this.elapsed - this.#lastHeatMapUpdateFrame > this.config.heatmapUpdateInterval) {
      this.#heatmap.decayAll(this.config.heatmapDecay);
      this.#lastHeatMapUpdateFrame = this.elapsed;
    }

    if (this.elapsed - this.#lastUpdateFrame > this.config.cameraMoveTime) {

      let highScore = 0, score = 0;
      let hottestQuadrant: Quadrant<UnitStruct> | undefined;
      let secondHottestQuadrant: Quadrant<UnitStruct> | undefined;

      let _scoreSum = 0;

      //TODO; if a quadrants score doubles from last frame, it should be prioritized
      for (const quadrant of this.#units.quadrants) {
        score = this.#unitWorkerScore.getAverageScore(quadrant.items);
        _scoreSum += score;
        if (score > highScore) {
          if (this.#heatmap.get(quadrant.x, quadrant.y) < 0.2) {
            highScore = score;
            secondHottestQuadrant = hottestQuadrant;
            hottestQuadrant = quadrant;
          } else {
            this.simpleMessage(`Quadrant ${quadrant.x},${quadrant.y} with ${quadrant.items.length} -> still hot`)
          }
        }
      }

      

      if (hottestQuadrant && hottestQuadrant.items.length > 0) {

        this.#activateQuadrant(hottestQuadrant);

        const avgScore = _scoreSum / this.#units.quadrants.length;

        if (secondHottestQuadrant) {
          const secondScore = this.#unitWorkerScore.getAverageScore(secondHottestQuadrant.items);
          if (secondScore > avgScore) {
            this.#activateSecondQuadrant(secondHottestQuadrant);
            this.secondViewport.enabled = true;
          } else {
            this.secondViewport.enabled = false;
          }
        } else {
          this.secondViewport.enabled = false;
        }

        const speedModifier = 1- easeOutQuint(THREE.MathUtils.clamp(highScore, 0, 1));
        const speed = Math.max(1, 8 * speedModifier)
        // this.openBW.setGameSpeed(THREE.MathUtils.damp(this.openBW.gameSpeed, speed, 0.1, this.delta / 1000 ));

        console.log("speed", highScore, speedModifier, speed);

        this.openBW.setGameSpeed(speed);

        this.simpleMessage(`Quadrant ${hottestQuadrant.x},${hottestQuadrant.y} - score: ${highScore}`)

      }

    }

    this.#units.clear();

    if (this.followedUnits.size) {

      const pos = this.getFollowedUnitsCenterPosition();

      if (pos) {

        this.viewport.orbit.moveTo(pos.x, pos.y, pos.z, true);

      }

    }

    if  (this.#secondFollowedUnit) {
      this.pxToWorld.xyz(this.#secondFollowedUnit.x, this.#secondFollowedUnit.y, _pos);
      this.secondViewport.orbit.moveTo(_pos.x, _pos.y, _pos.z, true);
    }

    this.secondViewport.enabled = this.secondViewport.enabled && !this.#areProximateViewports(this.viewport, this.secondViewport);
  }

  #isNearStartLocation(player: Player | undefined, pos: THREE.Vector3): boolean {

    const distance = 32;
    for (const p of this.players) {
      if (p.startLocation) {
        if (!this.#isNearOwnStartLocation(player, p.startLocation) && p.startLocation.distanceTo(pos) <= distance) {
          return true;
        }
      }
    }
    return false;
  }

  #isNearOwnStartLocation(player: Player | undefined, pos: THREE.Vector3): boolean {
    if (player == undefined || player.startLocation === undefined) return false;

    const distance = 10 * 32
    return (player.startLocation.distanceTo(pos) <= distance);
  }

  #isWorker(unitTypeId) {
    return workerTypes.includes(unitTypeId);
  }

  #isArmyUnit(unit: UnitStruct): boolean {
    return !!this.#getUnitPlayer(unit) && this.assets.bwDat.units[unit.typeId].supplyRequired > 0 && !this.#isWorker(unit.typeId);
  }

  #getUnitPlayer(unit: UnitStruct): Player | undefined {
    return this.players.get(unit.owner);
  }

  #shouldMoveCamera(priority: number): boolean {
    const delta = this.elapsed - this.lastMovedTime;
    const isTimeToMove = delta >= this.config.cameraMoveTime;
    const isTimeToMoveIfHigherPrio = delta >= this.config.cameraMoveTimeMin;
    const isHigherPrio = this.lastMovedPriority < priority;
    return isTimeToMove || (isHigherPrio && isTimeToMoveIfHigherPrio);
  }


  private updateVisionForPlayer(player: Player, priority: number): void {
    if (!this.#shouldMoveCamera(priority)) return;

    for (let _player of this.players) {
      _player.vision = _player.id === player.id ? true : false;
    }
  }

  public updateVision(): void {
    if (this.#shouldMoveCamera(0)) {

      for (let player of this.players) {
        player.vision = true;
      }
    }

  }



}
