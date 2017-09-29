let dat = require('dat.gui')

let container = document.getElementById('container')

let regl = require('regl')(container)

const CellType = {
  Empty: 'Empty',
  GreenWire: 'GreenWire',
  BlueWire: 'BlueWire',
  Connector: 'Connector',
  Source: 'Source',
  Sink: 'Sink'
}
const CellColor = {
  [CellType.Empty]: [1 / 255, 1 / 255, 1 / 255],
  [CellType.GreenWire]: [2 / 255, 126 / 255, 1 / 255],
  [CellType.BlueWire]: [2 / 255, 1 / 255, 126 / 255],
  [CellType.Connector]: [2 / 255, 126 / 255, 126 / 255],
  [CellType.Source]: [1, 1, 1],
  [CellType.Sink]: [254 / 255, 0, 0]
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

window.addEventListener('dragover', e => e.preventDefault())

// init controllers

let ctrl = {
  radius: 6,
  running: false,
  rate: 0,
  brushWidth: 1,
  brushType: CellType.GreenWire
}

let gui = new dat.default.GUI()
gui.add(ctrl, 'running')
gui.add(ctrl, 'rate').min(-9).max(15).step(1)
gui.add(ctrl, 'brushWidth').min(1).max(20).step(1)
gui.add(ctrl, 'brushType', CellType)
let radiusController = gui.add(ctrl, 'radius').min(0).max(12).step(1)

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
    info: 'Select brushType GreenWire',
    fn () { ctrl.brushType = CellType.GreenWire }
  },
  '3': {
    info: 'Select brushType BlueWire',
    fn () { ctrl.brushType = CellType.BlueWire }
  },
  '4': {
    info: 'Select brushType Connector',
    fn () { ctrl.brushType = CellType.Connector }
  },
  '5': {
    info: 'Select brushType Source',
    fn () { ctrl.brushType = CellType.Source }
  },
  '6': {
    info: 'Select brushType Sink',
    fn () { ctrl.brushType = CellType.Sink }
  },
}

document.addEventListener('keydown', e => {
  e.preventDefault()
  if (e.key in keyBindings) {
    keyBindings[e.key].fn()
    refreshGui()
  }
})

// init resources

let state = initState(1 << ctrl.radius)
function initState (radius, state = (Array(radius * radius * 4)).fill(1)) {
  container.width = radius
  container.height = radius

  return (Array(2)).fill().map(() =>
    regl.framebuffer({
      color: regl.texture({
        radius: radius,
        data: state,
        wrap: 'repeat',
        flipY: true
      }),
      depthStencil: false
    }))
}
// init commands

const getPrevState = (ctx, {flipped}) => state[!flipped | 0]
const getNextState = (ctx, {flipped}) => state[flipped | 0]

let cmd = {
  update: regl({
    frag: require('glslify').file('./rule.frag'),

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
      vec3 state = texture2D(nextState, uv).rgb;
      gl_FragColor = vec4(state, 1);
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
let rerender = true

radiusController.onFinishChange(radius => {
  state = initState(1 << radius)
  rerender = true
})
window.addEventListener('drop', e => {
  e.preventDefault()
  let file = e.dataTransfer.files[0]

  let image = new window.Image()
  image.src = window.URL.createObjectURL(file)
  image.onload = () => {
    window.image = image
    state = initState(image.width, image)
    ctrl.radius = Math.log2(image.width)
    refreshGui()
    rerender = true
  }
})

regl.frame(() => {
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
      brushType: CellColor[ctrl.brushType]
    }))
    rerender = true
  }

  if (rerender) {
    cmd.setupQuad(() => cmd.render({ flipped }))
  }

  rerender = false
  tick++
})
