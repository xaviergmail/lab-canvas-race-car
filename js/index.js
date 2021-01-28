class Hookable {
  constructor() {
    this.listeners = {}
  }

  hook(name, fn, ident) {
    if (this.listeners[name] == undefined) {
      this.listeners[name] = []
    }

    this.listeners[name].push(fn)

    if (ident) {
      fn._hookidentifier = ident
    }
  }

  unhook(name, ident) {
    const list = listeners[name]
    if (!list) return

    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i] == ident || list[i]._hookidentifier == ident) {
        list.splice(i, 1)
      }
    }
  }

  fire(name, ...payload) {
    if (this[name]) {
      this[name](...payload)
    }

    if (this.listeners[name]) {
      this.listeners[name].forEach((fn) => fn.bind(this)(...payload))
    }
  }
}

class Vector {
  constructor(x = 0, y = 0) {
    this.x = x
    this.y = y
  }

  copy() {
    return new Vector(this.x, this.y)
  }

  add(x, y) {
    if (x instanceof Vector) var { x, y } = x

    this.x += x
    this.y += y

    return this
  }

  sub(x, y) {
    if (x instanceof Vector) var { x, y } = x

    this.x -= x
    this.y -= y

    return this
  }

  mul(x, y) {
    if (x instanceof Vector) var { x, y } = x
    if (y == undefined) y = x

    this.x *= x
    this.y *= y

    return this
  }

  div(x, y) {
    if (x instanceof Vector) var { x, y } = x
    if (y == undefined) y = x

    this.x /= x
    this.y /= y

    return this
  }

  clamp(min, max) {
    this.x = Math.max(min.x, Math.min(max.x, this.x))
    this.y = Math.max(min.y, Math.min(max.y, this.y))

    return this
  }
}

class Rect extends Vector {
  constructor(w, h, pos) {
    super()

    this.w = w
    this.h = h
    this.pos = pos
  }

  copy() {
    return new Rect(this.w, this.h, this.pos.copy())
  }

  get x() {
    return this.w
  }
  set x(x) {
    this.w = x
  }

  get y() {
    return this.h
  }
  set y(y) {
    this.h = y
  }

  intersects(rect) {
    return (
      this.pos.x < rect.pos.x + rect.w &&
      this.pos.x + this.w > rect.pos.x &&
      this.pos.y < rect.pos.y + rect.h &&
      this.pos.y + this.h > rect.pos.y
    )
  }
}

class Game extends Hookable {
  constructor(canvas) {
    super()

    this.canvas = canvas
    this.ctx = canvas.getContext("2d")

    canvas.focus()
    this.canvas.addEventListener("keydown", this.fire.bind(this, "onKeyDown"))
    this.canvas.addEventListener("keyup", this.fire.bind(this, "onKeyUp"))

    this.entities = [] // TODO: Linkedlist, draw layers!

    this.dispatcher = []
    this.hooks = this.isRunning = false

    this.background = this.addEntity(new Background(this, "images/road.png"))
    this.car = this.addEntity(new Car("images/car.png"))

    this.obstacleSpawner = this.addEntity(new ObstacleSpawner(3, 1.05))
    this.obstacleSpawner = this.addEntity(new ObstacleSpawner(3, 1.05, 1))

    this.score = 0

    this.keyState = {}
  }

  onKeyDown(evt) {
    this.keyState[evt.key] = true
  }

  onKeyUp(evt) {
    this.keyState[evt.key] = false
  }

  isKeyDown(key) {
    return this.keyState[key] == true
  }

  setRunning(running) {
    this.isRunning = running
    if (running) {
      requestAnimationFrame(this.tick.bind(this))
    } else {
      delete this.firstTick
      delete this.lastTick
    }
  }

  lose() {
    this.setRunning(false)
    this.lost = true

    requestAnimationFrame(() => {
      this.ctx.font = "40px Comic Sans MS"
      this.ctx.textAlign = "center"

      let boxMin = this.background.bottomRight().mul(0, 0.3)
      let boxMax = this.background.bottomRight().sub(boxMin).mul(1, 0.7)

      this.ctx.fillStyle = "black"
      this.ctx.fillRect(boxMin.x, boxMin.y, boxMax.x, boxMax.y)

      let vec = this.background.center()
      this.ctx.fillStyle = "red"
      this.ctx.fillText("Game Over!", vec.x, vec.y)

      this.ctx.fillStyle = "white"
      this.ctx.fillText(
        "Score: " + Math.floor(this.score),
        vec.add(0, 50).x,
        vec.y
      )

      this.ctx.fillText("Press Space to try again", vec.add(0, 50).x, vec.y)
    })
  }

  tick(time) {
    if (!this.firstTick) this.firstTick = this.lastTick = time
    const ms = time - this.lastTick
    const dt = ms / 1000
    this.lastTick = time

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    let fn
    while ((fn = this.dispatcher.shift())) fn()

    for (let i = 0; i < this.entities.length; i++) {
      const ent = this.entities[i]
      if (ent.active) {
        ent.tick(dt)
        ent.draw(this.ctx, dt)
      }
    }

    // FIXME: Switch to a LinkedList and delete in-place in logic loop?
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const ent = this.entities[i]
      if (ent.shouldDelete) {
        this.entities.splice(i, 1)
      }
    }

    if (this.isRunning) {
      requestAnimationFrame(this.tick.bind(this))
    }

    this.ctx.font = "10px monospace"
    this.ctx.fillColor = "black"
    this.ctx.textAlign = "left"
    this.ctx.fillText("ms:" + ~~ms, 10, 10)
    this.ctx.fillText("FPS:" + ~~(1000 / ms), 10, 20)
  }

  addEntity(ent) {
    this.entities.push(ent)
    ent.game = this

    return ent
  }
}

class Entity extends Hookable {
  constructor({ size, pos, img, x, y, w, h } = {}) {
    super()

    this.pos = pos || new Vector(x || 0, y || 0)
    this.size = size || new Rect(w || 0, h || 0, this.pos)

    this.active = false
    this.shouldDelete = false

    if (size == undefined && (w == undefined || h == undefined)) {
      this.setAutoSize(true)
    }

    if (img) {
      this.loadSprite(img)
    }
  }

  activate() {}
  tick(dt) {}

  draw(ctx, dt) {
    if (this.img) {
      ctx.drawImage(this.img, this.pos.x, this.pos.y, this.size.w, this.size.h)
    }
  }

  setActive(active) {
    this.active = active
    if (active && (!this.img || this.img.complete)) {
      this.activate()
    }
  }

  delete() {
    this.shouldDelete = true
    this.fire("onDelete")
  }

  setPos(x, y) {
    if (x instanceof Vector) var { x, y } = x

    this.pos.x = x
    this.pos.y = y
  }

  setSize(w, h) {
    this.size.w = w
    this.size.h = h
  }

  setScale(scale) {
    this.scale = scale
    this.sizeToImage()
  }

  sizeToImage(force) {
    if (this.img && (force || this.autoSize)) {
      this.setSize(
        this.img.width * (this.scale || 1),
        this.img.height * (this.scale || 1)
      )
    }
  }

  setAutoSize(autoSize) {
    this.autoSize = autoSize
    if (this.img) {
      this.sizeToImage()
    }
  }

  loadSprite(src) {
    this.img = new Image()
    this.img.onload = () => {
      this.game.dispatcher.push(this.fire.bind(this, "onSpriteLoaded"))
    }

    this.img.src = src
  }

  onSpriteLoaded() {
    this.sizeToImage()
    this.setActive(true)
  }

  topLeft() {
    return this.pos.copy()
  }

  topRight() {
    return this.pos.copy().add(this.size.w, 0)
  }

  bottomRight() {
    return this.pos.copy().add(this.size.w, this.size.h)
  }

  bottomLeft() {
    return this.pos.copy().add(0, this.size.h)
  }

  center() {
    return this.pos.copy().add(this.bottomRight().div(2))
  }
}

class Background extends Entity {
  constructor(game, img) {
    super({ img, w: game.canvas.width, h: game.canvas.height })
    game.canvas.onresize = () => {
      this.size.w = game.canvas.width
      this.size.h = game.canvas.height
    }

    this.topOffset = 0
  }

  draw(ctx, dt) {
    if (this.img) {
      const { w, h } = this.size
      const { x, y } = this.pos
      const { width, height } = this.img
      this.topOffset += dt * 400
      this.topOffset %= h
      const top = this.topOffset / h

      ctx.drawImage(this.img, 0, height * top, width, height - top, x, y, w, h)
      ctx.drawImage(this.img, x, h * (1 - top), w, h)
    }
  }
}

class Car extends Entity {
  constructor(img) {
    super({ img })
    this.setScale(0.5)
    this.hitboxScale = new Vector(1, 0.1)
  }

  activate() {
    const bg = this.game.background
    this.setPos(bg.bottomRight().mul(0.5, 1).sub(this.center().mul(0.5, 1)))
  }

  // Speed is in pixels per second
  speed = 550
  controls = {
    w: new Vector(0, -1),
    a: new Vector(-1, 0),
    s: new Vector(0, 1),
    d: new Vector(1, 0),
  }

  tick(dt) {
    const vel = new Vector()
    for (let key in this.controls) {
      if (this.game.isKeyDown(key)) {
        vel.add(this.controls[key])
      }
    }

    vel.mul(this.speed * dt)

    this.pos
      .add(vel)
      .clamp(
        this.game.background.pos,
        this.game.background.bottomRight().sub(this.size)
      )
  }
}

class Obstacle extends Entity {
  activate() {
    this.pos.x = Math.random() * (this.game.background.size.w - this.size.w)
    this.pos.y = -this.size.h
  }

  // Once again in pixels per second
  speed = 500
  tick(dt) {
    this.pos.y += this.speed * dt

    const car = this.game.car
    if (this.size.intersects(car.size.copy().mul(car.hitboxScale || 1))) {
      this.game.lose()
    }

    if (this.pos.y > this.game.background.size.h) {
      this.delete()
    }
  }

  onDelete() {
    this.game.score += this.size.w
  }

  static obstacles = [
    { img: "images/goose.png", scale: 1 },
    { img: "images/tree.png", scale: 1 },
  ]
  static CreateRandom() {
    const img =
      Obstacle.obstacles[Math.floor(Math.random() * Obstacle.obstacles.length)]

    const obstacle = new Obstacle(img)
    obstacle.setScale(img.scale + Math.sin(Math.random() * Math.PI * 2) * 0.25)
    obstacle.speed *= 1 + Math.sin(Math.random() * Math.PI * 2) * 0.1

    return obstacle
  }
}

class ObstacleSpawner extends Entity {
  constructor(interval, speedIncrease, delay = 0) {
    super()
    this.spawnInterval = interval
    this.speedIncrease = speedIncrease

    this.elapsed = this.spawnInterval - delay
    this.speedMultiplier = 1

    this.setActive(true)
  }

  spawnObstacle() {
    const ent = Obstacle.CreateRandom()
    ent.speed *= this.speedMultiplier
    this.game.addEntity(ent)
  }

  tick(dt) {
    this.elapsed += dt
    if (this.elapsed >= this.spawnInterval) {
      this.elapsed = 0
      this.speedMultiplier *= this.speedIncrease
      this.spawnInterval = Math.max(
        0.5,
        this.spawnInterval * (2 - this.speedIncrease)
      )

      this.spawnObstacle()
    }
  }

  draw(ctx) {
    const vec = this.game.background.topRight().add(new Vector(-10, 0))

    ctx.font = "10px monospace"
    ctx.fillColor = "black"
    ctx.textAlign = "right"
    ctx.fillText("elapsed: " + this.elapsed.toFixed(2), vec.add(0, 10).x, vec.y)

    ctx.fillText(
      "speedIncrease: " + this.speedIncrease.toFixed(2),
      vec.add(0, 10).x,
      vec.y
    )

    ctx.fillText(
      "spawnInterval: " + this.spawnInterval.toFixed(2),
      vec.add(0, 10).x,
      vec.y
    )

    ctx.fillText(
      "speedMultiplier: " + this.speedMultiplier.toFixed(2),
      vec.add(0, 10).x,
      vec.y
    )
  }
}

function startGame() {
  if (window.game) {
    window.game.setRunning(false)
    delete window.game
  }

  const canvas = document.getElementById("canvas")
  window.game = new Game(canvas)
  window.game.setRunning(true)
  console.log("Game started!")
}

window.onload = () => {
  document.getElementById("start-button").onclick = () => {
    startGame()
  }

  // startGame() // Auto-start for live server

  window.addEventListener("keydown", function (e) {
    if (e.code == "Space" && (!window.game || window.game.lost)) {
      startGame()
    }
  })
}
