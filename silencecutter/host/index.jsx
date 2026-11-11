/**
 * SilenceCutter Pro - Adobe Premiere Pro ExtendScript Host
 * Frame-accurate Razor, Ripple Delete, Lift Delete, Non-Destructive Disable & Marker Engine
 */

var TICKS_PER_SECOND = 254016000000;

// ============================================================
// JSON & LOGGING HELPERS (ES3 ExtendScript Compatible)
// ============================================================

function scJsonStringify(obj) {
    if (obj === null || obj === undefined) return "null";
    if (typeof obj === "number") return isFinite(obj) ? String(obj) : "0";
    if (typeof obj === "boolean") return String(obj);
    if (typeof obj === "string") {
        return '"' + obj
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\n/g, "\\n")
            .replace(/\r/g, "\\r")
            .replace(/\t/g, "\\t") + '"';
    }
    if (obj instanceof Array) {
        var items = [];
        for (var i = 0; i < obj.length; i++) items.push(scJsonStringify(obj[i]));
        return "[" + items.join(",") + "]";
    }
    if (typeof obj === "object") {
        var pairs = [];
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                pairs.push(scJsonStringify(key) + ":" + scJsonStringify(obj[key]));
            }
        }
        return "{" + pairs.join(",") + "}";
    }
    return "null";
}

function scJsonParse(str) {
    if (!str) return {};
    return eval("(" + str + ")");
}

var _scLogs = [];
function scLog(msg) {
    _scLogs.push(String(msg));
    try { $.writeln("[SilenceCutter] " + msg); } catch (e) {}
}

function scResult(data) {
    var out = scJsonStringify({ success: true, data: data, logs: _scLogs });
    _scLogs = [];
    return out;
}

function scError(msg) {
    scLog("ERROR: " + msg);
    var out = scJsonStringify({ success: false, error: String(msg), logs: _scLogs });
    _scLogs = [];
    return out;
}

// ============================================================
// TIME & FRAME UTILITIES
// ============================================================

function getSeconds(timeObj) {
    if (!timeObj) return 0;
    if (typeof timeObj.seconds === "number" && !isNaN(timeObj.seconds)) return timeObj.seconds;
    if (timeObj.ticks !== undefined) {
        var t = parseFloat(timeObj.ticks);
        if (!isNaN(t)) return t / TICKS_PER_SECOND;
    }
    return 0;
}

function secondsToTicks(secs) {
    return String(Math.round(parseFloat(secs) * TICKS_PER_SECOND));
}

function getFrameTicks(seq) {
    try {
        if (seq.videoFrameRate && seq.videoFrameRate.ticks) {
            var tpf = parseFloat(seq.videoFrameRate.ticks);
            if (tpf > 0) return tpf;
        }
        if (seq.timebase) {
            var tb = parseFloat(seq.timebase);
            if (tb > 0) return tb;
        }
    } catch (e) {}
    return TICKS_PER_SECOND / 25;
}

function getFps(seq) {
    var frameTicks = getFrameTicks(seq);
    var fps = TICKS_PER_SECOND / frameTicks;
    if (isNaN(fps) || fps <= 0) return 25;
    return Math.round(fps * 1000) / 1000;
}

function snapSecondsToFrame(secs, seq) {
    var frameTicks = getFrameTicks(seq);
    var rawTicks = parseFloat(secs) * TICKS_PER_SECOND;
    var frames = Math.round(rawTicks / frameTicks);
    return (frames * frameTicks) / TICKS_PER_SECOND;
}

/**
 * Snap silence start FORWARD (ceil) so we never cut into the end of a spoken sentence
 */
function snapSecondsToFrameCeil(secs, seq) {
    var frameTicks = getFrameTicks(seq);
    var rawTicks = parseFloat(secs) * TICKS_PER_SECOND;
    var frames = Math.ceil((rawTicks / frameTicks) - 1e-6);
    return (frames * frameTicks) / TICKS_PER_SECOND;
}

/**
 * Snap silence end BACKWARD (floor) so we never cut into the beginning of the next sentence
 */
function snapSecondsToFrameFloor(secs, seq) {
    var frameTicks = getFrameTicks(seq);
    var rawTicks = parseFloat(secs) * TICKS_PER_SECOND;
    var frames = Math.floor((rawTicks / frameTicks) + 1e-6);
    return (frames * frameTicks) / TICKS_PER_SECOND;
}

/**
 * Wall-clock accurate timecode formatter (prevents 59.94 / 29.97 NDF vs DF drift)
 */
function secsToTC(totalSecs, fps) {
    totalSecs = parseFloat(totalSecs);
    if (isNaN(totalSecs) || totalSecs < 0) totalSecs = 0;
    var nominalFps = Math.round(fps);
    if (nominalFps <= 0) nominalFps = 25;

    var h = Math.floor(totalSecs / 3600);
    var m = Math.floor((totalSecs % 3600) / 60);
    var s = Math.floor(totalSecs % 60);
    var f = Math.round((totalSecs - Math.floor(totalSecs)) * fps);
    if (f >= nominalFps) f = nominalFps - 1;
    if (f < 0) f = 0;

    function p(n) { return n < 10 ? "0" + n : "" + n; }
    return p(h) + ":" + p(m) + ":" + p(s) + ":" + p(f);
}

/**
 * Frame-counted NDF timecode formatter (for strict non-drop-frame 23.976/29.97/59.94 sequences)
 */
function secsToNdfTC(totalSecs, fps) {
    totalSecs = parseFloat(totalSecs);
    if (isNaN(totalSecs) || totalSecs < 0) totalSecs = 0;
    var nominalFps = Math.round(fps);
    if (nominalFps <= 0) nominalFps = 25;

    var totalFrames = Math.round(totalSecs * fps);
    var f = totalFrames % nominalFps;
    var totalWholeSecs = Math.floor(totalFrames / nominalFps);
    var s = totalWholeSecs % 60;
    var m = Math.floor((totalWholeSecs % 3600) / 60);
    var h = Math.floor(totalWholeSecs / 3600);

    function p(n) { return n < 10 ? "0" + n : "" + n; }
    return p(h) + ":" + p(m) + ":" + p(s) + ":" + p(f);
}

function countTotalClips(seq) {
    var n = 0;
    for (var i = 0; i < seq.videoTracks.numTracks; i++) n += seq.videoTracks[i].clips.numItems;
    for (var j = 0; j < seq.audioTracks.numTracks; j++) n += seq.audioTracks[j].clips.numItems;
    return n;
}

function hasClipBoundaryNear(seq, targetSec, tolSec) {
    for (var v = 0; v < seq.videoTracks.numTracks; v++) {
        var vt = seq.videoTracks[v];
        for (var vc = 0; vc < vt.clips.numItems; vc++) {
            var vClip = vt.clips[vc];
            if (Math.abs(getSeconds(vClip.start) - targetSec) <= tolSec ||
                Math.abs(getSeconds(vClip.end) - targetSec) <= tolSec) {
                return true;
            }
        }
    }
    for (var a = 0; a < seq.audioTracks.numTracks; a++) {
        var at = seq.audioTracks[a];
        for (var ac = 0; ac < at.clips.numItems; ac++) {
            var aClip = at.clips[ac];
            if (Math.abs(getSeconds(aClip.start) - targetSec) <= tolSec ||
                Math.abs(getSeconds(aClip.end) - targetSec) <= tolSec) {
                return true;
            }
        }
    }
    return false;
}

function moveClipByOffset(clip, deltaSeconds) {
    if (Math.abs(deltaSeconds) < 0.0001) return false;
    var before = getSeconds(clip.start);
    try {
        clip.move(deltaSeconds);
    } catch (e1) {}
    var after = getSeconds(clip.start);
    if (Math.abs(after - before) > 0.0005) return true;

    // Fallback for Premiere versions expecting a Time object
    try {
        if (typeof Time !== "undefined") {
            var tObj = new Time();
            tObj.seconds = deltaSeconds;
            clip.move(tObj);
            if (Math.abs(getSeconds(clip.start) - before) > 0.0005) return true;
        }
    } catch (e2) {}
    return false;
}

// ============================================================
// SEQUENCE & CLIP INSPECTION
// ============================================================

function sc_getSequenceInfo() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return scError("Aktif bir sekans (timeline) bulunamadı. Lütfen Premiere Pro'da bir sekans açın.");

        var fps = getFps(seq);
        var durationSecs = 0;
        try { durationSecs = getSeconds(seq.end); } catch (e) {}

        var inPointSecs = -1, outPointSecs = -1;
        try {
            if (typeof seq.getInPointAsTime === "function") inPointSecs = getSeconds(seq.getInPointAsTime());
            else if (typeof seq.getInPoint === "function") inPointSecs = parseFloat(seq.getInPoint());
            if (typeof seq.getOutPointAsTime === "function") outPointSecs = getSeconds(seq.getOutPointAsTime());
            else if (typeof seq.getOutPoint === "function") outPointSecs = parseFloat(seq.getOutPoint());
        } catch (ie) {}

        var selectedClipCount = 0;
        var audioTracks = [];
        for (var a = 0; a < seq.audioTracks.numTracks; a++) {
            var at = seq.audioTracks[a];
            var aSel = 0;
            for (var ac = 0; ac < at.clips.numItems; ac++) {
                try {
                    if (at.clips[ac].isSelected()) {
                        aSel++;
                        selectedClipCount++;
                    }
                } catch (se) {}
            }
            audioTracks.push({
                index: a,
                name: at.name || ("Ses " + (a + 1)),
                clipCount: at.clips.numItems,
                selectedCount: aSel
            });
        }

        var videoTracks = [];
        for (var v = 0; v < seq.videoTracks.numTracks; v++) {
            var vt = seq.videoTracks[v];
            var vSel = 0;
            for (var vc = 0; vc < vt.clips.numItems; vc++) {
                try {
                    if (vt.clips[vc].isSelected()) vSel++;
                } catch (vse) {}
            }
            videoTracks.push({
                index: v,
                name: vt.name || ("Video " + (v + 1)),
                clipCount: vt.clips.numItems,
                selectedCount: vSel
            });
        }

        return scResult({
            name: seq.name,
            fps: fps,
            frameDuration: 1 / fps,
            durationSecs: durationSecs,
            inPointSecs: inPointSecs,
            outPointSecs: outPointSecs,
            selectedClipCount: selectedClipCount,
            audioTracks: audioTracks,
            videoTracks: videoTracks
        });
    } catch (e) {
        return scError("Sekans bilgisi alınamadı: " + e.toString());
    }
}

function sc_getTargetClips(optionsStr) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return scError("Aktif bir sekans bulunamadı.");

        var opts = scJsonParse(optionsStr);
        var trackIndices = opts.trackIndices || [0];
        var scope = opts.scope || "auto"; // "auto" | "selected" | "all"

        var selectedRanges = [];
        for (var a = 0; a < seq.audioTracks.numTracks; a++) {
            var at = seq.audioTracks[a];
            for (var ac = 0; ac < at.clips.numItems; ac++) {
                var aClip = at.clips[ac];
                try {
                    if (aClip.isSelected()) {
                        selectedRanges.push({
                            start: getSeconds(aClip.start),
                            end: getSeconds(aClip.end)
                        });
                    }
                } catch (e1) {}
            }
        }
        if (selectedRanges.length === 0) {
            for (var v = 0; v < seq.videoTracks.numTracks; v++) {
                var vt = seq.videoTracks[v];
                for (var vc = 0; vc < vt.clips.numItems; vc++) {
                    var vClip = vt.clips[vc];
                    try {
                        if (vClip.isSelected()) {
                            selectedRanges.push({
                                start: getSeconds(vClip.start),
                                end: getSeconds(vClip.end)
                            });
                        }
                    } catch (e2) {}
                }
            }
        }

        var filterBySelected = (scope === "selected") || (scope === "auto" && selectedRanges.length > 0);
        if (scope === "selected" && selectedRanges.length === 0) {
            return scError("Timeline üzerinde seçili klip bulunamadı. Lütfen bir klip seçin veya kapsamı 'Tüm Sekans' yapın.");
        }

        var clips = [];
        for (var t = 0; t < trackIndices.length; t++) {
            var tidx = trackIndices[t];
            if (tidx < 0 || tidx >= seq.audioTracks.numTracks) continue;
            var track = seq.audioTracks[tidx];

            for (var c = 0; c < track.clips.numItems; c++) {
                var clip = track.clips[c];
                var cStart = getSeconds(clip.start);
                var cEnd = getSeconds(clip.end);
                var isSel = false;
                try { isSel = Boolean(clip.isSelected()); } catch (se) {}

                if (filterBySelected && !isSel) {
                    var matchesSelectedRange = false;
                    for (var sr = 0; sr < selectedRanges.length; sr++) {
                        if (Math.abs(cStart - selectedRanges[sr].start) < 0.05 &&
                            Math.abs(cEnd - selectedRanges[sr].end) < 0.05) {
                            matchesSelectedRange = true;
                            break;
                        }
                    }
                    if (!matchesSelectedRange) continue;
                }

                var mediaPath = "";
                try {
                    if (clip.projectItem && typeof clip.projectItem.getMediaPath === "function") {
                        mediaPath = clip.projectItem.getMediaPath();
                    }
                } catch (pe) {}

                clips.push({
                    trackIndex: tidx,
                    clipIndex: c,
                    name: clip.name || ("Klip " + (c + 1)),
                    startSeconds: cStart,
                    endSeconds: cEnd,
                    inPointSeconds: getSeconds(clip.inPoint),
                    outPointSeconds: getSeconds(clip.outPoint),
                    durationSeconds: getSeconds(clip.duration),
                    mediaPath: mediaPath,
                    isSelected: isSel
                });
            }
        }

        return scResult({
            clips: clips,
            filteredBySelection: filterBySelected
        });
    } catch (e) {
        return scError("Klip listesi alınamadı: " + e.toString());
    }
}

function sc_setPlayhead(secondsStr) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return scError("Aktif sekans yok.");
        var secs = parseFloat(secondsStr);
        if (isNaN(secs) || secs < 0) secs = 0;
        seq.setPlayerPosition(secondsToTicks(secs));
        return scResult({ playheadSeconds: secs });
    } catch (e) {
        return scError("Playhead taşınamadı: " + e.toString());
    }
}

function sc_getExtensionRoot() {
    try {
        return scResult({ path: new File($.fileName).parent.parent.fsName });
    } catch (e) {
        return scError("Uzantı yolu alınamadı: " + e.toString());
    }
}

// ============================================================
// CORE TIMELINE CUTTING & EDITING ENGINE
// ============================================================

function executeTimelineEdit(seq, rawRegions, options) {
    options = options || {};
    var mode = options.mode || "ripple"; // "ripple" | "lift" | "disable" | "razor" | "markers"

    if (!rawRegions || rawRegions.length === 0) {
        scLog("executeTimelineEdit: kesilecek bölge yok.");
        return { affectedCount: 0, regionsCount: 0 };
    }

    var fps = getFps(seq);
    var frameTol = 0.45 / fps;

    // Step 1: Snap silence start FORWARD (ceil) and silence end BACKWARD (floor) so cuts never eat into speech
    var snapped = [];
    for (var i = 0; i < rawRegions.length; i++) {
        if (rawRegions[i].enabled === false) continue;
        var s = snapSecondsToFrameCeil(parseFloat(rawRegions[i].start), seq);
        var e = snapSecondsToFrameFloor(parseFloat(rawRegions[i].end), seq);
        if (e - s >= (1.5 / fps)) {
            snapped.push({ start: s, end: e });
        }
    }
    if (snapped.length === 0) {
        return { affectedCount: 0, regionsCount: 0 };
    }

    snapped.sort(function (a, b) { return a.start - b.start; });
    var merged = [{ start: snapped[0].start, end: snapped[0].end }];
    for (var m = 1; m < snapped.length; m++) {
        var last = merged[merged.length - 1];
        if (snapped[m].start <= last.end + frameTol) {
            last.end = Math.max(last.end, snapped[m].end);
        } else {
            merged.push({ start: snapped[m].start, end: snapped[m].end });
        }
    }

    // Mode: Markers Only
    if (mode === "markers") {
        var addedMarkers = 0;
        for (var mk = 0; mk < merged.length; mk++) {
            try {
                var marker = seq.markers.createMarker(merged[mk].start);
                marker.name = "Sessiz Bölge #" + (mk + 1);
                marker.comments = "Süre: " + (merged[mk].end - merged[mk].start).toFixed(2) + " sn";
                marker.duration = merged[mk].end - merged[mk].start;
                if (typeof marker.setTypeAsComment === "function") marker.setTypeAsComment();
                if (typeof marker.setColorByIndex === "function") marker.setColorByIndex(1); // Red
                addedMarkers++;
            } catch (mke) {}
        }
        return { affectedCount: addedMarkers, regionsCount: merged.length };
    }

    // Step 2: Enable QE DOM for Razor splitting
    app.enableQE();
    var qeSeq = qe.project.getActiveSequence();
    if (!qeSeq) {
        throw new Error("Premiere Pro QE DOM başlatılamadı.");
    }

    // Collect all unique cut timestamps
    var cutTimes = [];
    for (var ci = 0; ci < merged.length; ci++) {
        if (merged[ci].start > frameTol) cutTimes.push(merged[ci].start);
        cutTimes.push(merged[ci].end);
    }
    cutTimes.sort(function (a, b) { return a - b; });
    var uniqueCuts = [];
    for (var u = 0; u < cutTimes.length; u++) {
        if (uniqueCuts.length === 0 || Math.abs(cutTimes[u] - uniqueCuts[uniqueCuts.length - 1]) > frameTol) {
            uniqueCuts.push(cutTimes[u]);
        }
    }
    cutTimes = uniqueCuts;

    // Step 3: Find a test cut point strictly inside an existing clip to auto-detect the best QE razor format
    var testTime = null;
    var testIdx = -1;
    for (var ti = 0; ti < cutTimes.length && testTime === null; ti++) {
        var cand = cutTimes[ti];
        if (cand <= frameTol) continue;
        var seqCheck = app.project.activeSequence;
        findLoop: for (var vt = 0; vt < seqCheck.videoTracks.numTracks; vt++) {
            var vtr = seqCheck.videoTracks[vt];
            for (var vc = 0; vc < vtr.clips.numItems; vc++) {
                var vcl = vtr.clips[vc];
                if (cand > getSeconds(vcl.start) + frameTol && cand < getSeconds(vcl.end) - frameTol) {
                    testTime = cand;
                    testIdx = ti;
                    break findLoop;
                }
            }
        }
        if (testTime === null) {
            findAudioLoop: for (var at = 0; at < seqCheck.audioTracks.numTracks; at++) {
                var atr = seqCheck.audioTracks[at];
                for (var ac = 0; ac < atr.clips.numItems; ac++) {
                    var acl = atr.clips[ac];
                    if (cand > getSeconds(acl.start) + frameTol && cand < getSeconds(acl.end) - frameTol) {
                        testTime = cand;
                        testIdx = ti;
                        break findAudioLoop;
                    }
                }
            }
        }
    }

    if (testTime === null) {
        scLog("Hiçbir kesim noktası klip içine denk gelmedi.");
        return { affectedCount: 0, regionsCount: merged.length };
    }

    var clipsBefore = countTotalClips(app.project.activeSequence);

    function formatCutArg(kind, sec) {
        if (kind === "cti") {
            try {
                app.project.activeSequence.setPlayerPosition(secondsToTicks(sec));
                var freshQe = qe.project.getActiveSequence();
                if (freshQe && freshQe.CTI && freshQe.CTI.timecode) {
                    qeSeq = freshQe;
                    return freshQe.CTI.timecode;
                }
            } catch (e) {}
            return secsToTC(sec, fps);
        }
        if (kind === "tc") return secsToTC(sec, fps);
        if (kind === "ndf_tc") return secsToNdfTC(sec, fps);
        if (kind === "ticks") return secondsToTicks(sec);
        return String(sec);
    }

    var candidates = [
        { fn: "razor", kind: "cti" },
        { fn: "razor", kind: "tc" },
        { fn: "razor", kind: "ndf_tc" },
        { fn: "razor", kind: "ticks" },
        { fn: "razor", kind: "secs" },
        { fn: "razorAt", kind: "cti" },
        { fn: "razorAt", kind: "tc" },
        { fn: "razorAt", kind: "ndf_tc" },
        { fn: "razorAt", kind: "ticks" },
        { fn: "razorAt", kind: "secs" }
    ];

    var workingCandidate = null;
    for (var cmi = 0; cmi < candidates.length; cmi++) {
        var candMethod = candidates[cmi];
        if (typeof qeSeq[candMethod.fn] !== "function") continue;
        try {
            var argVal = formatCutArg(candMethod.kind, testTime);
            qeSeq[candMethod.fn](argVal);
        } catch (re) {
            continue;
        }
        var seqAfterTest = app.project.activeSequence;
        var clipsNow = countTotalClips(seqAfterTest);
        if (clipsNow > clipsBefore && hasClipBoundaryNear(seqAfterTest, testTime, (3.0 / fps) + 0.05)) {
            workingCandidate = candMethod;
            scLog("Razor metodu bulundu: " + candMethod.fn + "(" + candMethod.kind + ")");
            break;
        } else if (clipsNow > clipsBefore) {
            workingCandidate = candMethod;
            break;
        }
    }

    if (!workingCandidate) {
        throw new Error("Timeline üzerinde jilet (razor) işlemi uygulanamadı.");
    }

    // Step 4: Razor all remaining cut points
    app.enableQE();
    qeSeq = qe.project.getActiveSequence();
    for (var ri = 0; ri < cutTimes.length; ri++) {
        if (ri === testIdx) continue;
        try {
            var cutArg = formatCutArg(workingCandidate.kind, cutTimes[ri]);
            qeSeq[workingCandidate.fn](cutArg);
        } catch (ce) {
            scLog("Razor hatası (" + cutTimes[ri] + "s): " + ce);
        }
    }

    if (mode === "razor") {
        return { affectedCount: cutTimes.length, regionsCount: merged.length };
    }

    // Step 5: Identify all sub-clips falling inside silent intervals [merged[k].start, merged[k].end]
    var seqActive = app.project.activeSequence;
    var silentClips = [];

    function isInsideSilence(clipStart, clipEnd) {
        var mid = (clipStart + clipEnd) / 2;
        var dur = clipEnd - clipStart;
        for (var k = 0; k < merged.length; k++) {
            var mStart = merged[k].start;
            var mEnd = merged[k].end;
            if (mid >= mStart - frameTol && mid <= mEnd + frameTol && dur <= (mEnd - mStart) + (3.0 / fps)) {
                return true;
            }
        }
        return false;
    }

    for (var dvt = 0; dvt < seqActive.videoTracks.numTracks; dvt++) {
        var dvTrack = seqActive.videoTracks[dvt];
        for (var dvci = 0; dvci < dvTrack.clips.numItems; dvci++) {
            var dvc = dvTrack.clips[dvci];
            if (isInsideSilence(getSeconds(dvc.start), getSeconds(dvc.end))) {
                silentClips.push(dvc);
            }
        }
    }

    for (var dat = 0; dat < seqActive.audioTracks.numTracks; dat++) {
        var daTrack = seqActive.audioTracks[dat];
        for (var daci = 0; daci < daTrack.clips.numItems; daci++) {
            var dac = daTrack.clips[daci];
            if (isInsideSilence(getSeconds(dac.start), getSeconds(dac.end))) {
                silentClips.push(dac);
            }
        }
    }

    // Mode: Disable Clips (Non-destructive)
    if (mode === "disable") {
        var disabledCount = 0;
        for (var di = 0; di < silentClips.length; di++) {
            try {
                silentClips[di].disabled = true;
                disabledCount++;
            } catch (de) {}
        }
        return { affectedCount: disabledCount, regionsCount: merged.length };
    }

    // Step 6: Remove silent sub-clips (for "lift" and "ripple" modes)
    var deletedCount = 0;
    for (var rmi = 0; rmi < silentClips.length; rmi++) {
        try {
            silentClips[rmi].remove(false, false);
            deletedCount++;
        } catch (rme) {}
    }

    // Step 7: Ripple Gap Closing — shift surviving clips left by exact cumulative removed silence before them
    if (mode === "ripple" && deletedCount > 0) {
        var seqRipple = app.project.activeSequence;
        var movedCount = 0;

        function computeCumulativeShift(clipOriginalStart) {
            var shift = 0;
            for (var k = 0; k < merged.length; k++) {
                if (merged[k].end <= clipOriginalStart + frameTol) {
                    shift += (merged[k].end - merged[k].start);
                } else if (merged[k].start < clipOriginalStart - frameTol && merged[k].end > clipOriginalStart + frameTol) {
                    shift += (clipOriginalStart - merged[k].start);
                }
            }
            return snapSecondsToFrame(shift, seqRipple);
        }

        function rippleTrackCollection(tracksCollection) {
            for (var trIdx = 0; trIdx < tracksCollection.numTracks; trIdx++) {
                var track = tracksCollection[trIdx];
                if (!track || track.clips.numItems === 0) continue;

                var items = [];
                for (var ci = 0; ci < track.clips.numItems; ci++) {
                    var cObj = track.clips[ci];
                    items.push({
                        obj: cObj,
                        start: getSeconds(cObj.start),
                        dur: getSeconds(cObj.duration)
                    });
                }
                items.sort(function (a, b) { return a.start - b.start; });

                for (var ii = 0; ii < items.length; ii++) {
                    var shiftSec = computeCumulativeShift(items[ii].start);
                    if (shiftSec > (0.4 / fps)) {
                        if (moveClipByOffset(items[ii].obj, -shiftSec)) {
                            movedCount++;
                        }
                    }
                }
            }
        }

        rippleTrackCollection(seqRipple.videoTracks);
        rippleTrackCollection(seqRipple.audioTracks);
        scLog("Ripple tamamlandı: " + deletedCount + " klip silindi, " + movedCount + " klip kaydırıldı.");
    }

    return { affectedCount: deletedCount, regionsCount: merged.length };
}

function sc_executeAction(payloadStr) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return scError("Aktif bir sekans bulunamadı.");

        var payload = scJsonParse(payloadStr);
        var regions = payload.regions || [];
        var mode = payload.mode || "ripple";

        var res = executeTimelineEdit(seq, regions, { mode: mode });
        return scResult(res);
    } catch (e) {
        return scError("İşlem hatası: " + e.toString());
    }
}

// Backward-compatible wrappers
function rippleDeleteSilentRegions(regionsStr, trackIndicesStr) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return scError("Aktif bir sekans bulunamadı.");
        var res = executeTimelineEdit(seq, scJsonParse(regionsStr), { mode: "ripple" });
        return scResult({ deletedCount: res.affectedCount });
    } catch (e) { return scError(e.toString()); }
}

function liftDeleteSilentRegions(regionsStr, trackIndicesStr) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return scError("Aktif bir sekans bulunamadı.");
        var res = executeTimelineEdit(seq, scJsonParse(regionsStr), { mode: "lift" });
        return scResult({ deletedCount: res.affectedCount });
    } catch (e) { return scError(e.toString()); }
}

function disableSilentRegions(regionsStr, trackIndicesStr) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return scError("Aktif bir sekans bulunamadı.");
        var res = executeTimelineEdit(seq, scJsonParse(regionsStr), { mode: "disable" });
        return scResult({ disabledCount: res.affectedCount });
    } catch (e) { return scError(e.toString()); }
}

function sc_clearMarkers() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return scError("Aktif bir sekans bulunamadı.");
        var toRemove = [];
        var m = seq.markers.getFirstMarker();
        while (m) {
            if (m.name && (m.name.indexOf("Sessiz") === 0 || m.name === "Silence")) {
                toRemove.push(m);
            }
            m = seq.markers.getNextMarker(m);
        }
        for (var i = 0; i < toRemove.length; i++) {
            seq.markers.deleteMarker(toRemove[i]);
        }
        return scResult({ removed: toRemove.length });
    } catch (e) {
        return scError("Marker temizleme hatası: " + e.toString());
    }
}
