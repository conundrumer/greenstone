# Greenstone [working title]

[Play it here](http://greenstone-wip.surge.sh/)

GPU cellular automata for circuit simulation. I designed the rules as a tradeoff between complexity in possible states and complexity in components and circuits, in addition to having these rules be potentially implemented in 3d and with limited power.

## Usage

Click to draw cells.

Save: Right-click on the state and save the image

Load: Drag/drop a saved image onto the canvas

This means you can build circuits using an image editing program

### Key Bindings

- `Enter`: Step by one frame
- `Space`: Toggles running
- `1`: Select brushType Empty
- `2`: Select brushType GreenWire
- `3`: Select brushType BlueWire
- `4`: Select brushType Connector
- `5`: Select brushType Source
- `6`: Select brushType Sink

## Materials

- Empty
- Green Wire
- Blue Wire
- Connector
- Source
- Sink

## States

### Wire

- Powered
    - 128 power levels
- Falling Edge
- Off

#### Variants
- Green
- Blue
- Connector (Green & Blue layered on top of each other)

### Connector

- On (Powered Green OR Powered Blue)
- Off

### Source
- Active
- Inactive

### Sink
- Active
- Inactive

## Transitions (in order of precedence)

### Wire (green/blue)

Neighbor:

- Active Sink -> Falling Edge
- Active Source -> Max power level

### Wire (green/blue/connector)

Neighbor that shares a color and has the max power of neighbors:

- Greater-or-equal power -> power minus one (zero power is off)
- Lesser power -> Falling Edge

Default: Off

### Source

Neighbor:

- Off Connector -> inactive

Default: On (the following neighbor behaviors are caused by this)

- No connectors -> active
- All On Connectors -> active
- Falling Edge Connector -> active

### Sink

Neighbor:

- On Connector -> active

Default: Off (the following neighbor behaviors are caused by this)

- No connectors -> inactive
- All Off Connectors -> inactive
- Falling Edge Connector -> inactive
