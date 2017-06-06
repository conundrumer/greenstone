let dat = require('dat.gui')

let container = document.getElementById('container')

let regl = require('regl')(container)

const CellType = {
  Empty: [0, 0, 0],
  Alive: [1, 1, 1]
}

// init mouse

let mouse = {
  buttons: 0,
  x: 0,
  y: 0
}
const handleMouseChange = setButtons => e => {
  e.preventDefault()
  if (setButtons) {
    mouse.buttons = e.buttons
  }
  mouse.x = (e.clientX - container.offsetLeft) / container.clientWidth
  mouse.y = (e.clientY - container.offsetTop) / container.clientHeight
}
container.addEventListener('mousedown', handleMouseChange(true))
window.addEventListener('mousemove', handleMouseChange(false))
window.addEventListener('mouseup', handleMouseChange(true))


// init controllers

let ctrl = {
  running: true,
  rate: -4,
  brushWidth: 1,
  brushType: CellType.Alive
}

let gui = new dat.default.GUI()
gui.add(ctrl, 'running')
gui.add(ctrl, 'rate').min(-9).max(9).step(1)
gui.add(ctrl, 'brushWidth').min(1).max(20).step(1)
gui.add(ctrl, 'brushType', CellType)
const refreshGui = () => gui.__controllers.forEach(c => c.updateDisplay())

let keyBindings = {
  ' ': {
    info: 'Toggles running',
    fn () { ctrl.running = !ctrl.running }
  },
  '1': {
    info: 'Select brushType Empty',
    fn () { ctrl.brushType = CellType.Empty }
  },
  '2': {
    info: 'Select brushType Alive',
    fn () { ctrl.brushType = CellType.Alive }
  }
}

document.addEventListener('keydown', e => {
  e.preventDefault()
  if (e.key in keyBindings) {
    keyBindings[e.key].fn()
    refreshGui()
  }
})

// init resources

const RADIUS = 64
const INITIAL_CONDITIONS = (Array(RADIUS * RADIUS * 4)).fill(0).map(
  () => Math.random() > 0.9 ? 255 : 0)

const state = (Array(2)).fill().map(() =>
  regl.framebuffer({
    color: regl.texture({
      radius: RADIUS,
      data: INITIAL_CONDITIONS,
      wrap: 'repeat'
    }),
    depthStencil: false
  }))

// init commands

const getPrevState = (ctx, {flipped}) => state[!flipped | 0]
const getNextState = (ctx, {flipped}) => state[flipped | 0]

let cmd = {
  update: regl({
    frag: `
    precision mediump float;
    uniform float radius;
    uniform sampler2D prevState;
    varying vec2 uv;
    void main() {
      float n = 0.0;
      for(int dx=-1; dx<=1; ++dx)
      for(int dy=-1; dy<=1; ++dy) {
        n += texture2D(prevState, uv+vec2(dx,dy)/radius).r;
      }
      float s = texture2D(prevState, uv).r;
      if(n > 3.0+s || n < 3.0) {
        gl_FragColor = vec4(0,0,0,1);
      } else {
        gl_FragColor = vec4(1,1,1,1);
      }
    }`,

    uniforms: {
      prevState: getPrevState,
      radius: regl.context('framebufferWidth')
    },

    framebuffer: getNextState
  }),

  brush: regl({
    frag: `
    precision mediump float;
    uniform vec3 brushType;
    void main() {
      gl_FragColor = vec4(brushType,1);
    }`,

    vert: `
    precision mediump float;
    uniform float radius;
    uniform vec2 center;
    uniform float brushWidth;
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position / radius * brushWidth + 2. * center - 1., 0, 1);
    }`,

    uniforms: {
      radius: regl.context('framebufferWidth'),
      center: regl.prop('center'),
      brushWidth: regl.prop('brushWidth'),
      brushType: regl.prop('brushType')
    },

    framebuffer: getNextState
  }),

  render: regl({
    frag: `
    precision mediump float;
    uniform sampler2D nextState;
    varying vec2 uv;
    void main() {
      float state = texture2D(nextState, uv).r;
      gl_FragColor = vec4(vec3(state), 1);
    }`,

    uniforms: {
      nextState: getNextState
    }
  }),

  setupQuad: regl({
    vert: `
    precision mediump float;
    attribute vec2 position;
    varying vec2 uv;
    void main() {
      uv = 0.5 * (position + 1.0);
      gl_Position = vec4(position, 0, 1);
    }`,

    attributes: {
      position: [ -1, -1, -1, 1, 1, -1, 1, 1 ]
    },

    primitive: 'triangle strip',

    depth: { enable: false },

    count: 4
  })
}

// render loop

let tick = 0
let flipped = false

regl.frame(() => {
  let rerender = false

  let iterations
  if (ctrl.rate < 0) {
    let period = -ctrl.rate + 1
    iterations = (tick % period) === 0 ? 1 : 0
  } else {
    iterations = ctrl.rate + 1
  }

  if (ctrl.running) {
    for (let i = 0; i < iterations; i++) {
      flipped = !flipped
      cmd.setupQuad(() => cmd.update({ flipped }))
      rerender = true
    }
  }

  if (mouse.buttons === 1) {
    cmd.setupQuad(() => cmd.brush({
      flipped,
      center: [mouse.x, 1 - mouse.y],
      brushWidth: ctrl.brushWidth,
      brushType: ctrl.brushType
    }))
    rerender = true
  }

  if (rerender) {
    cmd.setupQuad(() => cmd.render({ flipped }))
  }

  tick++
})
