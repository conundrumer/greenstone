precision mediump float;

uniform float radius;
uniform sampler2D prevState;

varying vec2 uv;

#define VEC_MAP(m, a) vec4(m(a.x), m(a.y), m(a.z), m(a.w))
#define VEC_REDUCE(r, a) r(r(a.x, a.y), r(a.z, a.w))
#define VEC_MAP_REDUCE(m, r, a) r(r(m(a.x), m(a.y)), r(m(a.z), m(a.w)))
#define NOOP(x) (x)

#define GET(dx, dy) texture2D(prevState, uv+vec2(dx,dy)/radius)
#define BYTE(x) int(.5 + 255. * x)

/*
CELL STATES R   G   B
Source On   255 255 255
Source Off  126 126 126
Sink On     254 0   0
Sink Off    151 63  63
Green Wire  S   C   1
Blue Wire   S   1   C
Connector   S   C   C

WIRE STATES S   C
On Max      100 255
On Min      100 127
On Fall     100 63
Off         1   126
*/
#define WIRE_ON 100
#define WIRE_OFF 2
#define ON_FALL 63
#define OFF 126
#define SINK_ON 254
#define SINK_OFF 151
#define SOURCE_ON 255
#define SOURCE_OFF 251
const float WireOn = float(WIRE_ON) / 255.;
const float WireOff = float(WIRE_OFF) / 255.;
const float One = 1. / 255.;

float max_wire(float x) { return x == 1. ? 0. : x; }

int get_next_power(int p, vec4 a) {
    if (p == ON_FALL) {
        // On Fall -> Off
        return OFF;
    } else if (p > ON_FALL) {
        int max_power = BYTE(VEC_REDUCE(max, a));

        if (p > OFF && p > max_power) {
            // On Peak -> On Fall
            return ON_FALL;
        } else if (max_power > OFF) {
            return max_power - 1;
        }
    }
    return p;
}

int get_next_power_wire(int p, vec4 a) {
    bool pull_down = a.x * a.y * a.z * a.w == 0.;
    if (pull_down) {
        // next to Sink -> On Fall
        return ON_FALL;
    } else {
        return get_next_power(p, a);
    }
}

void main() {
    vec4 cell = GET(0, 0);
    int r = BYTE(cell.r);
    int g = BYTE(cell.g);
    int b = BYTE(cell.b);

    vec4 e = GET(1, 0);
    vec4 w = GET(-1, 0);
    vec4 n = GET(0, 1);
    vec4 s = GET(0, -1);

    if (r == SINK_ON || r == SINK_OFF) {
        bool any_on =
            e.r == WireOn && e.g > One && e.b > One ||
            w.r == WireOn && w.g > One && w.b > One ||
            n.r == WireOn && n.g > One && n.b > One ||
            s.r == WireOn && s.g > One && s.b > One;
        if (any_on) {
            r = SINK_ON;
            g = 0;
            b = 0;
        } else {
            r = SINK_OFF;
            g = 63;
            b = 63;
        }
    } else if (r == SOURCE_ON || r == SOURCE_OFF) {
        bool any_off =
            BYTE(e.r) == WIRE_OFF && e.g > One && e.b > One ||
            BYTE(w.r) == WIRE_OFF && w.g > One && w.b > One ||
            BYTE(n.r) == WIRE_OFF && n.g > One && n.b > One ||
            BYTE(s.r) == WIRE_OFF && s.g > One && s.b > One;

        if (any_off) {
            r = SOURCE_OFF;
            g = OFF;
            b = OFF;
        } else {
            r = SOURCE_ON;
            g = SOURCE_ON;
            b = SOURCE_ON;
        }
    } else if (r == WIRE_ON || r == WIRE_OFF) {
        r = WIRE_ON;

        vec4 green_neighbors = vec4(e.g, w.g, n.g, s.g);
        vec4 blue_neighbors = vec4(e.b, w.b, n.b, s.b);

        if (b == 1) {
            // green wire
            g = get_next_power_wire(g, green_neighbors);
        } else if (g == 1) {
            // blue wire
            b = get_next_power_wire(b, blue_neighbors);
        } else {
            // connector
            g = get_next_power(g, VEC_MAP(max_wire, green_neighbors));
            b = get_next_power(b, VEC_MAP(max_wire, blue_neighbors));
        }

        if ((g == 1 || g == OFF) && (b == 1 || b == OFF)) {
            // On Min-1 -> Off
            r = WIRE_OFF;
        }
    }
    gl_FragColor = vec4(vec3(r, g, b) / 255., 1);
}
