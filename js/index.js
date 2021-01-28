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
      fn.__hookidentifier = ident
    }
  }

  unhook(name, ident) {
    const list = listeners[name]
    if (!list) return

    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i] == ident || list[i].__hookidentifier == ident) {
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

  get x() {
    return this.w
  }
  set x(x) {
    this.w = this.x
  }

  get y() {
    return this.h
  }
  set y(y) {
    this.h = this.y
  }
}

class Game extends Hookable {
  constructor(canvas) {
    super()

    this.canvas = canvas
    this.ctx = canvas.getContext("2d")

    canvas.focus()
    this.canvas.addEventListener("keydown", this.fire.bind(this, "keydown"))
    this.canvas.addEventListener("keyup", this.fire.bind(this, "keyup"))

    this.entities = []

    this.hooks = this.isRunning = false

    this.background = this.addEntity(new Background(this, "images/road.png"))
    this.car = this.addEntity(new Car(this, "images/car.png"))

    this.keyState = {}
  }

  keydown(evt) {
    this.keyState[evt.key] = true
  }

  keyup(evt) {
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

  tick(time) {
    if (!this.firstTick) this.firstTick = this.lastTick = time
    const ms = time - this.lastTick
    const dt = ms / 1000
    this.lastTick = time

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    for (let i = 0; i < this.entities.length; i++) {
      const ent = this.entities[i]
      ent.tick(dt)
      ent.draw(this.ctx, dt)
    }

    if (this.isRunning) {
      requestAnimationFrame(this.tick.bind(this))
    }

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

    if (size == undefined && (w == undefined || h == undefined)) {
      this.setAutoSize(true)
    }

    if (img) {
      this.loadSprite(img)
    }
  }

  tick(dt) {}

  draw(ctx, dt) {
    if (this.img) {
      ctx.drawImage(this.img, this.pos.x, this.pos.y, this.size.w, this.size.h)
    }
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
    if (force || this.autoSize) {
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
    this.img.onload = this.fire.bind(this, "spriteLoaded")
    this.img.src = src
  }

  spriteLoaded() {
    this.sizeToImage()
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
      this.width = game.canvas.width
      this.height = game.canvas.height
    }
  }
}

class Car extends Entity {
  constructor(game, img) {
    super({ img })
    this.setScale(0.5)
  }

  // Speed is in pixels per second
  speed = 350
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

  spriteLoaded() {
    const bg = this.game.background
    this.setPos(bg.center().sub(this.center()))
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
  console.log("Document loaded!")

  startGame() // Auto-start for live server
}
