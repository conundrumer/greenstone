let dat = require('dat.gui')

let container = document.getElementById('container')

let regl = require('regl')(container)

// init ui

let ui = {
  mouse: {
    buttons: 0,
    x: 0,
    y: 0
  },
  state: {
    running: true,
    rate: -4
  }
}
const handleMouseChange = setButtons => e => {
  e.preventDefault()
  if (setButtons) {
    ui.mouse.buttons = e.buttons
  }
  ui.mouse.x = (e.clientX - container.offsetLeft) / container.clientWidth
  ui.mouse.y = (e.clientY - container.offsetTop) / container.clientHeight
}
container.addEventListener('mousedown', handleMouseChange(true))
window.addEventListener('mousemove', handleMouseChange(false))
window.addEventListener('mouseup', handleMouseChange(true))

let gui = new dat.default.GUI()
gui.add(ui.state, 'running')
gui.add(ui.state, 'rate').min(-9).max(9).step(1)

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
  }),

  input: regl({
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
  if (ui.state.rate < 0) {
    let period = -ui.state.rate + 1
    iterations = (tick % period) === 0 ? 1 : 0
  } else {
    iterations = ui.state.rate + 1
  }

  if (ui.state.running) {
    for (let i = 0; i < iterations; i++) {
      flipped = !flipped
      cmd.setupQuad(() => cmd.update({ flipped }))
      rerender = true
    }
  }

  if (ui.mouse.buttons === 1) {
    let center = [ui.mouse.x, 1 - ui.mouse.y]
    cmd.setupQuad(() => cmd.input({ flipped, center }))
    rerender = true
  }

  if (rerender) {
    cmd.setupQuad(() => cmd.render({ flipped }))
  }

  tick++
})
