precision mediump float;

uniform float radius;
uniform sampler2D prevState;

varying vec2 uv;

#define GET(dx, dy) texture2D(prevState, uv+vec2(dx,dy)/radius)
#define BYTE(x) int(.5 + 255. * x)

/*
CELL STATES R   G   B
Source      255 255 255
Sink On     254 0   0
Sink Off    191 63  63
Green Wire  S   C   1
Blue Wire   S   1   C
Connector   S   C   C

WIRE STATES S   C
On Max      127 255
On Min      127 127
On Fall     127 63
Off         1   126
*/
#define WIRE_ON 127
#define WIRE_OFF 1
#define ON_FALL 63
#define OFF 126
#define SINK_ON 254
#define SINK_OFF 191
const float WireOn = 127. / 255.;
const float One = 1. / 255.;

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
    }

    if (r == WIRE_ON || r == WIRE_OFF) {
        r = WIRE_ON;

        if (g > WIRE_OFF) {
            bool pull_down = e.g * w.g * n.g * s.g == 0.;
            if (pull_down && b == 1) {
                // next to Sink -> On Fall
                g = ON_FALL;
            } else if (g == ON_FALL) {
                // On Fall -> Off
                g = OFF;
            } else if (g > ON_FALL) {
                int max_power = BYTE(max(max(e.g, w.g), max(n.g, s.g)));

                if (g > OFF && g > max_power) {
                    // On Peak -> On Fall
                    g = ON_FALL;
                } else if (max_power > OFF) {
                    g = max_power - 1;
                }
            }
        }

        if (b > WIRE_OFF) {
            bool pull_down = e.b * w.b * n.b * s.b == 0.;
            if (pull_down && g == 1) {
                // next to Sink -> On Fall
                b = ON_FALL;
            } else if (b == ON_FALL) {
                // On Fall -> Off
                b = OFF;
            } else if (b > ON_FALL) {
                int max_power = BYTE(max(max(e.b, w.b), max(n.b, s.b)));

                if (b > OFF && b > max_power) {
                    // On Peak -> On Fall
                    b = ON_FALL;
                } else if (max_power > OFF) {
                    b = max_power - 1;
                }
            }
        }

        if ((g == 1 || g == OFF) && (b == 1 || b == OFF)) {
            // On Min-1 -> Off
            r = WIRE_OFF;
        }
    }
    gl_FragColor = vec4(vec3(r, g, b) / 255., 1);
}
