import * as ui from '@dcl/ui-scene-utils';
// Create base scene
const baseScene: Entity = new Entity();
baseScene.addComponent(new GLTFShape("models/baseScene.glb"));
baseScene.addComponent(new Transform())
engine.addEntity(baseScene)

// sound
const clip = new AudioClip("sounds/car.mp3")
const source = new AudioSource(clip)
source.playing = false

// Car entities
const chassis: Entity = new Entity()
chassis.addComponent(new GLTFShape("models/carBody.glb"))
chassis.addComponent(new Transform())
chassis.addComponent(source)
engine.addEntity(chassis)

const wheels: Entity[] = []
const wheelPositions: Vector3[] = [new Vector3(1.9, 1.3, 0), new Vector3(1.9, -1.1, 0), new Vector3(-1.7, 1.5, 0), new Vector3(-1.7, -1.3, 0)]

for (let i = 0; i < wheelPositions.length; i++) {
  const wheel: Entity = new Entity()
  if (i % 2 == 0) {
    wheel.addComponent(new GLTFShape("models/carWheelRight.glb"))
  } else {
    wheel.addComponent(new GLTFShape("models/carWheelLeft.glb"))
  }

  wheel.addComponent(new Transform({ position: wheelPositions[i] }))
  engine.addEntity(wheel)
  wheels.push(wheel)
}

// Setup our world
const world: CANNON.World = new CANNON.World()
world.broadphase = new CANNON.SAPBroadphase(world)
world.gravity.set(0, -9.82, 0) // m/s²
world.defaultContactMaterial.friction = 0

const groundMaterial: CANNON.Material = new CANNON.Material("groundMaterial")
const wheelMaterial: CANNON.Material = new CANNON.Material("wheelMaterial")
const wheelGroundContactMaterial: CANNON.ContactMaterial = new CANNON.ContactMaterial(wheelMaterial, groundMaterial, {
  friction: 0.3,
  restitution: 0,
  contactEquationStiffness: 1000,
})

// We must add the contact materials to the world
world.addContactMaterial(wheelGroundContactMaterial)
// Create a ground plane and apply physics material
const groundBody: CANNON.Body = new CANNON.Body({
  mass: 0, // mass == 0 makes the body static
})
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2) // Reorient ground plane to be in the y-axis

const groundShape: CANNON.Plane = new CANNON.Plane()
groundBody.addShape(groundShape)
groundBody.material = groundMaterial
world.addBody(groundBody)


const chassisShape: CANNON.Box = new CANNON.Box(new CANNON.Vec3(7.2 / 2, 3.3 / 2, 1.7 / 2)) // Dimensions is from the center
const chassisBody: CANNON.Body = new CANNON.Body({ mass: 190 })
chassisBody.addShape(chassisShape)
chassisBody.position.set(16, 4, 16) // Start position in scene
chassisBody.angularVelocity.set(-1.5, 0.0, 1.5)

const options = {
  radius: 0.5, // m
  directionLocal: new CANNON.Vec3(0, 0, -1),
  suspensionStiffness: 30,
  suspensionRestLength: 0.4,
  frictionSlip: 6,
  dampingRelaxation: 2.3,
  dampingCompression: 4.4,
  maxSuspensionForce: 100000,
  rollInfluence: 0.01,
  axleLocal: new CANNON.Vec3(0, 1, 0),
  chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
  maxSuspensionTravel: 0.3,
  customSlidingRotationalSpeed: -30,
  useCustomSlidingRotationalSpeed: true,
}

// Create the vehicle
CANNON.RaycastResult
const vehicle: CANNON.RaycastVehicle = new CANNON.RaycastVehicle({
  chassisBody: chassisBody,
})

// Set the wheel bodies positions
for (let i = 0; i < wheelPositions.length; i++) {
  options.chassisConnectionPointLocal.set(wheelPositions[i].clone().x, wheelPositions[i].clone().y, wheelPositions[i].clone().z)
  vehicle.addWheel(options)
}
vehicle.addToWorld(world)

const wheelBodies: CANNON.Body[] = []

for (let i = 0; i < vehicle.wheelInfos.length; i++) {
  let wheel = vehicle.wheelInfos[i]
  let cylinderShape: CANNON.Sphere = new CANNON.Sphere(wheel.radius)
  let wheelBody: CANNON.Body = new CANNON.Body({
    mass: 0,
  })
  wheelBody.type = CANNON.Body.KINEMATIC
  wheelBody.collisionFilterGroup = 0// turn off collisions
  let q: CANNON.Quaternion = new CANNON.Quaternion()
  q.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2)
  wheelBody.addShape(cylinderShape, new CANNON.Vec3(), q)
  wheelBodies.push(wheelBody)
  world.addBody(wheelBody)
}

const fixedTimeStep: number = 1.0 / 60.0 // seconds
const maxSubSteps: number = 3

class updateSystem implements ISystem {
  
  update(dt: number): void {
    // Instruct the world to perform a single step of simulation.
    // It is generally best to keep the time step and iterations fixed.
    world.step(fixedTimeStep, dt, maxSubSteps)


    for (let i = 0; i < vehicle.wheelInfos.length; i++) {
      vehicle.updateWheelTransform(i)
      let t: CANNON.Transform = vehicle.wheelInfos[i].worldTransform
      let wheelBody: CANNON.Body = wheelBodies[i]
      wheelBody.position.copy(t.position)
      wheelBody.quaternion.copy(t.quaternion)
      wheels[i].getComponent(Transform).position.copyFrom(wheelBodies[i].position)
      wheels[i].getComponent(Transform).rotation.copyFrom(wheelBodies[i].quaternion)
    }

    // Modifying the wheels position and rotation needs to happen before the chassis
    chassis.getComponent(Transform).position.copyFrom(chassisBody.position)
    chassis.getComponent(Transform).rotation.copyFrom(chassisBody.quaternion)
  }
}

engine.addSystem(new updateSystem())

let forwardForce: number = 0.0
let steerValue: number = 0.0
const maxSteerValue: number = 0.5
const maxSpeed: number = 300
const brakeForce: number = 30

class updateDriveSystem implements ISystem {
  update(): void {
    // Forward force
    vehicle.applyEngineForce(forwardForce, 2)
    vehicle.applyEngineForce(forwardForce, 3)

    // Steering
    vehicle.setSteeringValue(steerValue, 0)
    vehicle.setSteeringValue(steerValue, 1)

    // Braking
    // Press E and F Keys together
    if (isEKeyPressed && isFKeyPressed) {
      vehicle.setBrake(brakeForce, 3)
    } else {
      vehicle.setBrake(0, 0)
      vehicle.setBrake(0, 1)
      vehicle.setBrake(0, 2)
      vehicle.setBrake(0, 3)
    }
  }
}
engine.addSystem(new updateDriveSystem())

// Controls
const input = Input.instance

let isPointerPressed = false
let isEKeyPressed = false
let isFKeyPressed = false

// Pointer
input.subscribe("BUTTON_DOWN", ActionButton.POINTER, false, () => {
  isPointerPressed = true
})
input.subscribe("BUTTON_UP", ActionButton.POINTER, false, () => {
  isPointerPressed = false
})


// E Key
input.subscribe("BUTTON_DOWN", ActionButton.PRIMARY, false, () => {
  isEKeyPressed = true
})
input.subscribe("BUTTON_UP", ActionButton.PRIMARY, false, () => {
  isEKeyPressed = false
})

// F Key
input.subscribe("BUTTON_DOWN", ActionButton.SECONDARY, false, () => {
  isFKeyPressed = true
})
input.subscribe("BUTTON_UP", ActionButton.SECONDARY, false, () => {
  isFKeyPressed = false
})

class ButtonChecker {
  update(dt: number) {
    if (isPointerPressed) {
       source.loop = true
      source.playing = true
      // Accelerate
      if (forwardForce > -maxSpeed) forwardForce -= 300 * dt
    } else {
      source.playing = false
      // Decelerate
      if (forwardForce < 0) {
        forwardForce += 350 * dt
      } else {
        forwardForce = 0
      }
    }

    if (isEKeyPressed && steerValue > -maxSteerValue) {
      steerValue -= 3 * dt
    }
    if (isFKeyPressed && steerValue < maxSteerValue) {
      steerValue += 3 * dt
    }
    if (!isEKeyPressed && !isFKeyPressed){
      steerValue = 0 * dt
    }
    
  }
}


engine.addSystem(new ButtonChecker())

let prompt = new ui.OkPrompt(
  "Get in car",
  () => {new ui.OkPrompt(
    "Use E F to turn left right",
    () => {new ui.OkPrompt(
      "Use pointer to accelerate, E+F to break",
      () => {},
      'Ok',
      true
    )},
    'Ok',
    true
  )},
  'Ok',
  true
)
