let dat = require('dat.gui')

let uiState = {
  running: true,
  rate: -4
}

let gui = new dat.default.GUI()
gui.add(uiState, 'running')
gui.add(uiState, 'rate').min(-9).max(9).step(1)

let container = document.getElementById('container')

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

  framebuffer: (ctx, {tick}) => state[(tick + 1) % 2]
})

const setupQuad = regl({
  frag: `
  precision mediump float;
  uniform sampler2D prevState;
  varying vec2 uv;
  void main() {
    float state = texture2D(prevState, uv).r;
    gl_FragColor = vec4(vec3(state), 1);
  }`,

  vert: `
  precision mediump float;
  attribute vec2 position;
  varying vec2 uv;
  void main() {
    uv = 0.5 * (position + 1.0);
    gl_Position = vec4(position, 0, 1);
  }`,

  attributes: {
    position: [ -4, -4, 4, -4, 0, 4 ]
  },

  uniforms: {
    prevState: (ctx, {tick}) => state[tick % 2]
  },

  depth: { enable: false },

  count: 3
})

let frameTick = 0
let tick = 0
regl.frame(() => {
  let iterations
  if (uiState.rate < 0) {
    let period = -uiState.rate + 1
    iterations = (frameTick % period) === 0 ? 1 : 0
  } else {
    iterations = uiState.rate + 1
  }

  if (uiState.running) {
    for (let i = 0; i < iterations; i++) {
      tick++
      setupQuad({ tick }, () => {
        update({ tick })
      })
    }
    setupQuad({ tick })
  }

  frameTick++
})
