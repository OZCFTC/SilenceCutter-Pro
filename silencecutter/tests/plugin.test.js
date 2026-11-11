const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SilenceDetector = require("../client/detector.js");
const analyzer = require("../node/analyzer.js");

const hostSource = fs.readFileSync(
    path.join(__dirname, "..", "host", "index.jsx"),
    "utf8"
);

function createExtendScriptContext(activeSequence, qeSequence) {
    const context = {
        $: { writeln() {}, fileName: path.join(__dirname, "..", "host", "index.jsx") },
        File: function (p) {
            return { parent: { parent: { fsName: path.resolve(__dirname, "..") } } };
        },
        Time: function () { this.seconds = 0; this.ticks = "0"; },
        app: {
            enableQE() {},
            project: { activeSequence }
        },
        qe: {
            project: { getActiveSequence: () => qeSequence }
        }
    };
    vm.createContext(context);
    vm.runInContext(hostSource, context, { filename: "index.jsx" });
    return context;
}

function createMockTimeline(initialVideoClips = [[0, 10]], initialAudioClips = [[0, 10]], fps = 25) {
    const TICKS_PER_SEC = 254016000000;

    function makeCollection(ranges) {
        const col = { _items: [] };
        col.sync = function () {
            Object.keys(col).forEach((k) => {
                if (/^\d+$/.test(k)) delete col[k];
            });
            col._items.forEach((item, idx) => {
                item._col = col;
                col[idx] = item;
            });
        };
        Object.defineProperty(col, "numItems", {
            get() { return col._items.length; }
        });
        ranges.forEach(([s, e]) => col._items.push(makeClip(s, e, col)));
        col.sync();
        return col;
    }

    function makeClip(start, end, col) {
        return {
            name: "TestClip",
            disabled: false,
            start: { seconds: start, ticks: String(Math.round(start * TICKS_PER_SEC)) },
            end: { seconds: end, ticks: String(Math.round(end * TICKS_PER_SEC)) },
            inPoint: { seconds: start },
            outPoint: { seconds: end },
            duration: { seconds: end - start },
            isSelected() { return true; },
            remove() {
                const i = this._col._items.indexOf(this);
                if (i !== -1) {
                    this._col._items.splice(i, 1);
                    this._col.sync();
                }
            },
            move(delta) {
                const d = typeof delta === "object" ? delta.seconds : delta;
                this.start.seconds = Math.round((this.start.seconds + d) * 1000000) / 1000000;
                this.end.seconds = Math.round((this.end.seconds + d) * 1000000) / 1000000;
                this.start.ticks = String(Math.round(this.start.seconds * TICKS_PER_SEC));
                this.end.ticks = String(Math.round(this.end.seconds * TICKS_PER_SEC));
            }
        };
    }

    const vCol = makeCollection(initialVideoClips);
    const aCol = makeCollection(initialAudioClips);
    let ctiSec = 0;

    const sequence = {
        name: "Test Sequence",
        timebase: String(TICKS_PER_SEC / fps),
        videoFrameRate: { ticks: String(TICKS_PER_SEC / fps) },
        end: { seconds: 10 },
        videoTracks: { 0: { name: "Video 1", clips: vCol }, numTracks: 1 },
        audioTracks: { 0: { name: "Audio 1", clips: aCol }, numTracks: 1 },
        setPlayerPosition(ticksStr) {
            ctiSec = parseFloat(ticksStr) / TICKS_PER_SEC;
        },
        markers: {
            _list: [],
            createMarker(s) {
                const m = { start: s, name: "", comments: "", duration: 0, setTypeAsComment() {}, setColorByIndex() {} };
                this._list.push(m);
                return m;
            }
        }
    };

    function splitCollection(col, cutSec) {
        for (let i = 0; i < col._items.length; i++) {
            const c = col._items[i];
            if (cutSec > c.start.seconds + 0.001 && cutSec < c.end.seconds - 0.001) {
                col._items.splice(
                    i,
                    1,
                    makeClip(c.start.seconds, cutSec, col),
                    makeClip(cutSec, c.end.seconds, col)
                );
                col.sync();
                return;
            }
        }
    }

    const qeSequence = {
        CTI: {
            get timecode() {
                return String(ctiSec);
            }
        },
        razor(arg) {
            let sec = parseFloat(arg);
            if (String(arg).indexOf(":") !== -1) {
                const p = String(arg).split(":").map(Number);
                sec = p[0] * 3600 + p[1] * 60 + p[2] + p[3] / fps;
            }
            splitCollection(vCol, sec);
            splitCollection(aCol, sec);
        }
    };

    return { sequence, qeSequence, vCol, aCol };
}

test("SilenceDetector protects quiet sentence endings and stop-consonant final syllables from early cutting", () => {
    // 5.0 seconds at 10ms window = 500 buckets
    // 0.00s - 1.00s (0..99): Main sentence body (-18 dB)
    // 1.00s - 1.08s (100..107): 80ms stop-consonant closure (-52 dB) before final syllable (e.g. "-mak")
    // 1.08s - 1.25s (108..124): Quiet final syllable of sentence at -40 dB (below -35 dB threshold, but within 8 dB hysteresis!)
    // 1.25s - 3.00s (125..299): Real silence (-58 dB)
    // 3.00s - 5.00s (300..499): Next sentence (-18 dB)
    const envelope = new Array(500).fill(-18);
    for (let i = 100; i < 108; i++) envelope[i] = -52;
    for (let i = 108; i < 125; i++) envelope[i] = -40;
    for (let i = 125; i < 300; i++) envelope[i] = -58;

    const result = SilenceDetector.detectSilenceRegions(
        {
            envelope,
            windowMs: 10,
            timelineStartSec: 0,
            timelineEndSec: 5.0
        },
        {
            thresholdDb: -35,
            tailProtectionDb: 8,
            minSilenceMs: 420,
            minSpeechMs: 90,
            padStartMs: 200,
            padEndMs: 120,
            fps: 25
        }
    );

    assert.equal(result.regions.length, 1);
    // Sentence actually finishes at ~1.25s (plus release decay + 200ms padStartMs -> cut starts AFTER 1.45s, never at 1.00s!)
    assert.ok(result.regions[0].start >= 1.45, `Expected silence cut to start after 1.45s (preserving sentence end), got ${result.regions[0].start}`);
    assert.equal(result.regions[0].end, 2.88);
});

test("SilenceDetector Otsu auto-threshold separates noise floor from speech", () => {
    const envelope = [];
    for (let i = 0; i < 300; i++) envelope.push(-54 + (i % 5));
    for (let i = 0; i < 300; i++) envelope.push(-18 + (i % 5));

    const autoDb = SilenceDetector.computeAutoThreshold({ envelope });
    assert.ok(autoDb >= -42 && autoDb <= -26, `Expected threshold between -42 and -26 dB, got ${autoDb}`);
});

test("ExtendScript ripple mode cuts silent intervals and closes gaps while preserving non-zero clip start", () => {
    const tl = createMockTimeline([[2, 10]], [[2, 10]], 25);
    const host = createExtendScriptContext(tl.sequence, tl.qeSequence);

    const rawRes = host.sc_executeAction(JSON.stringify({
        mode: "ripple",
        regions: [
            { start: 4.0, end: 6.0, enabled: true },
            { start: 7.0, end: 8.0, enabled: true }
        ]
    }));
    const res = JSON.parse(rawRes);
    assert.equal(res.success, true);

    assert.equal(tl.vCol.numItems, 3);
    assert.equal(tl.vCol[0].start.seconds, 2.0);
    assert.equal(tl.vCol[0].end.seconds, 4.0);
    assert.equal(tl.vCol[1].start.seconds, 4.0);
    assert.equal(tl.vCol[1].end.seconds, 5.0);
    assert.equal(tl.vCol[2].start.seconds, 5.0);
    assert.equal(tl.vCol[2].end.seconds, 7.0);

    assert.equal(tl.aCol.numItems, 3);
    assert.equal(tl.aCol[2].start.seconds, 5.0);
    assert.equal(tl.aCol[2].end.seconds, 7.0);
});

test("Native Windows Media Foundation analyzer decodes real audio file into 10ms dB envelope", async () => {
    const sampleWav = "C:\\Windows\\Media\\Windows Notify.wav";
    if (!fs.existsSync(sampleWav)) return;

    const res = await analyzer.analyzeClipEnvelope({
        file: sampleWav,
        startSec: 0,
        durationSec: 1.0,
        windowMs: 20
    });

    assert.equal(res.success, true);
    assert.ok(Array.isArray(res.envelope));
    assert.ok(res.envelope.length >= 40);
});
