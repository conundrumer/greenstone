let dat = require('dat.gui')

let uiState = {
  running: true,
  rate: -4
}

let gui = new dat.default.GUI()
gui.add(uiState, 'running')
gui.add(uiState, 'rate').min(-9).max(9).step(1)

let container = document.getElementById('container')

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

let regl = require('regl')(container)

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

const getPrevState = (ctx, {flipped}) => state[!flipped | 0]
const getNextState = (ctx, {flipped}) => state[flipped | 0]

const update = regl({
  frag: `
  precision mediump float;
  uniform sampler2D prevState;
  varying vec2 uv;
  void main() {
    float n = 0.0;
    for(int dx=-1; dx<=1; ++dx)
    for(int dy=-1; dy<=1; ++dy) {
      n += texture2D(prevState, uv+vec2(dx,dy)/float(${RADIUS})).r;
    }
    float s = texture2D(prevState, uv).r;
    if(n > 3.0+s || n < 3.0) {
      gl_FragColor = vec4(0,0,0,1);
    } else {
      gl_FragColor = vec4(1,1,1,1);
    }
  }`,

  uniforms: {
    prevState: getPrevState
  },

  framebuffer: getNextState
})

const input = regl({
  frag: `
  precision mediump float;
  void main() {
    gl_FragColor = vec4(1,1,1,1);
  }`,

  vert: `
  precision mediump float;
  uniform vec2 center;
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position / 10. + 2. * center - 1., 0, 1);
  }`,

  uniforms: {
    center: regl.prop('center')
  },

  framebuffer: getNextState
})

const render = regl({
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
  },
})

const setupQuad = regl({
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

let tick = 0
let flipped = false
regl.frame(() => {
  let rerender = false

  let iterations
  if (uiState.rate < 0) {
    let period = -uiState.rate + 1
    iterations = (tick % period) === 0 ? 1 : 0
  } else {
    iterations = uiState.rate + 1
  }

  if (uiState.running) {
    for (let i = 0; i < iterations; i++) {
      flipped = !flipped
      setupQuad(() => update({ flipped }))
      rerender = true
    }
  }

  if (mouse.buttons === 1) {
    let center = [mouse.x, 1 - mouse.y]
    setupQuad(() => input({ flipped, center }))
    rerender = true
  }

  if (rerender) {
    setupQuad(() => render({ flipped }))
  }

  tick++
})
