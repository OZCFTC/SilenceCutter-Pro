/**
 * SilenceCutter Pro - Real-Time Silence Detection, Sentence-Tail Protection & Auto-Threshold Engine
 * Works in both CEP Chromium browser and Node.js test environments.
 */
(function (root, factory) {
    var instance = factory();
    if (typeof window !== "undefined") {
        window.SilenceDetector = instance;
    }
    if (typeof globalThis !== "undefined") {
        globalThis.SilenceDetector = instance;
    }
    if (root) {
        root.SilenceDetector = instance;
    }
    if (typeof module === "object" && module.exports) {
        module.exports = instance;
    }
})(typeof self !== "undefined" ? self : this, function () {
    "use strict";

    /**
     * Snap a timestamp (in seconds) to the nearest exact video frame boundary
     */
    function snapToFrame(seconds, fps) {
        if (!fps || fps <= 0) return Math.round(seconds * 1000) / 1000;
        var frames = Math.round(seconds * fps);
        return Math.round((frames / fps) * 1000000) / 1000000;
    }

    /**
     * Snap silence start FORWARD (ceil) so it never cuts into the end of a sentence
     */
    function snapToFrameCeil(seconds, fps) {
        if (!fps || fps <= 0) return Math.ceil(seconds * 1000) / 1000;
        var frames = Math.ceil(seconds * fps - 1e-6);
        return Math.round((frames / fps) * 1000000) / 1000000;
    }

    /**
     * Snap silence end BACKWARD (floor) so it never cuts into the start of the next sentence
     */
    function snapToFrameFloor(seconds, fps) {
        if (!fps || fps <= 0) return Math.floor(seconds * 1000) / 1000;
        var frames = Math.floor(seconds * fps + 1e-6);
        return Math.round((frames / fps) * 1000000) / 1000000;
    }

    /**
     * Format seconds as MM:SS.ms or HH:MM:SS:FF
     */
    function formatTime(seconds, fps, useTimecode) {
        if (isNaN(seconds) || seconds < 0) seconds = 0;
        var h = Math.floor(seconds / 3600);
        var m = Math.floor((seconds % 3600) / 60);
        var s = Math.floor(seconds % 60);
        var pad2 = function (n) { return n < 10 ? "0" + n : String(n); };

        if (useTimecode && fps > 0) {
            var f = Math.floor((seconds - Math.floor(seconds)) * fps);
            if (f >= Math.ceil(fps)) f = Math.ceil(fps) - 1;
            return (h > 0 ? pad2(h) + ":" : "") + pad2(m) + ":" + pad2(s) + ":" + pad2(f);
        }

        var d = Math.floor((seconds - Math.floor(seconds)) * 100);
        return (h > 0 ? pad2(h) + ":" : "") + pad2(m) + ":" + pad2(s) + "." + pad2(d);
    }

    /**
     * Estimate background noise floor (20th percentile of covered audio buckets)
     */
    function estimateNoiseFloorDb(envelope, coverage) {
        var vals = [];
        for (var i = 0; i < envelope.length; i++) {
            if (coverage && !coverage[i]) continue;
            if (envelope[i] > -98) vals.push(envelope[i]);
        }
        if (vals.length === 0) return -60;
        vals.sort(function (a, b) { return a - b; });
        var idx = Math.floor(vals.length * 0.2);
        return vals[idx];
    }

    /**
     * Detect silent regions from a 10ms dB envelope in real time with:
     *  - Dual-threshold hysteresis (protects quiet sentence endings)
     *  - Asymmetric release follower (prevents premature sentence cutoff)
     *  - Stop-consonant closure bridging (preserves Turkish final syllables like -mak, -tik, -ip)
     */
    function detectSilenceRegions(envelopeData, params) {
        params = params || {};
        var envelope = (envelopeData && envelopeData.envelope) || [];
        var coverage = (envelopeData && envelopeData.coverage) || null;
        var windowMs = (envelopeData && envelopeData.windowMs) || 10;
        var timelineStartSec = (envelopeData && envelopeData.timelineStartSec) || 0;
        var timelineEndSec = (envelopeData && envelopeData.timelineEndSec) || (timelineStartSec + (envelope.length * windowMs) / 1000);

        var thresholdDb = typeof params.thresholdDb === "number" ? params.thresholdDb : -35;
        var minSilenceMs = typeof params.minSilenceMs === "number" ? params.minSilenceMs : 420;
        var minSpeechMs = typeof params.minSpeechMs === "number" ? params.minSpeechMs : 90;
        var padStartMs = typeof params.padStartMs === "number" ? params.padStartMs : 220; // kept AFTER sentence ends
        var padEndMs = typeof params.padEndMs === "number" ? params.padEndMs : 120;     // kept BEFORE sentence starts
        var tailProtectionDb = typeof params.tailProtectionDb === "number" ? params.tailProtectionDb : 8; // Hysteresis dB
        var fps = typeof params.fps === "number" && params.fps > 0 ? params.fps : 25;

        var n = envelope.length;
        if (n === 0) {
            return {
                regions: [],
                totalSilenceSec: 0,
                totalDurationSec: 0,
                keptDurationSec: 0,
                savedPercent: 0
            };
        }

        var noiseFloorDb = estimateNoiseFloorDb(envelope, coverage);
        // Close threshold is lower than open threshold by tailProtectionDb (clamped above noise floor + 2.5 dB)
        var closeThresholdDb = Math.max(noiseFloorDb + 2.5, thresholdDb - Math.max(0, tailProtectionDb));
        if (closeThresholdDb > thresholdDb) closeThresholdDb = thresholdDb;

        // Step 1: Dual-Threshold Hysteresis + Asymmetric Release Envelope
        // Protects sentence endings where speaker's voice drops in volume on final syllables
        var isSilent = new Array(n);
        var inSpeech = false;
        var releaseDb = -100;
        // Release decay rate: ~0.45 dB per 10ms bucket (~45 dB/sec)
        var decayPerBucket = 0.45 * (windowMs / 10);

        for (var i = 0; i < n; i++) {
            var hasClip = coverage ? Boolean(coverage[i]) : true;
            if (!hasClip) {
                isSilent[i] = false;
                inSpeech = false;
                releaseDb = -100;
                continue;
            }

            var db = envelope[i];
            if (db >= releaseDb) {
                releaseDb = db; // Instant attack
            } else {
                releaseDb = Math.max(db, releaseDb - decayPerBucket); // Smooth release decay
            }

            if (!inSpeech) {
                if (db >= thresholdDb) {
                    inSpeech = true;
                    isSilent[i] = false;
                } else {
                    isSilent[i] = true;
                }
            } else {
                // Already in speech: stay in speech until BOTH raw and release envelope drop below closeThresholdDb
                if (db >= closeThresholdDb || releaseDb >= closeThresholdDb) {
                    isSilent[i] = false;
                } else {
                    inSpeech = false;
                    isSilent[i] = true;
                }
            }
        }

        // Step 2: Bridge short consonant closures / intra-word micro-pauses FIRST
        // In Turkish, stop consonants (p, ç, t, k) produce a 50-160ms silent occlusion before the final syllable.
        // Bridging these short gaps first keeps the final syllable attached to the sentence!
        var consonantBridgeBuckets = Math.max(1, Math.min(
            Math.round(minSilenceMs / windowMs) - 1,
            Math.round(180 / windowMs)
        ));
        if (consonantBridgeBuckets > 0) {
            var silStart = -1;
            for (var b = 0; b < n; b++) {
                if (isSilent[b]) {
                    if (silStart < 0) silStart = b;
                } else {
                    if (silStart >= 0) {
                        var silLen = b - silStart;
                        // Only bridge if surrounded by speech on both sides
                        if (silStart > 0 && silLen <= consonantBridgeBuckets) {
                            for (var fill = silStart; fill < b; fill++) {
                                isSilent[fill] = false;
                            }
                        }
                        silStart = -1;
                    }
                }
            }
        }

        // Step 3: Filter out truly isolated brief noise spikes (< minSpeechMs) inside long silences
        var minSpeechBuckets = Math.max(1, Math.round(minSpeechMs / windowMs));
        if (minSpeechBuckets > 1) {
            var runStart = -1;
            for (var j = 0; j < n; j++) {
                var hasClipJ = coverage ? Boolean(coverage[j]) : true;
                if (hasClipJ && !isSilent[j]) {
                    if (runStart < 0) runStart = j;
                } else {
                    if (runStart >= 0) {
                        var runLen = j - runStart;
                        if (runLen < minSpeechBuckets) {
                            for (var k = runStart; k < j; k++) isSilent[k] = true;
                        }
                        runStart = -1;
                    }
                }
            }
        }

        // Step 4: Collect contiguous silent runs >= minSilenceMs
        var minSilenceBuckets = Math.max(1, Math.round(minSilenceMs / windowMs));
        var rawRuns = [];
        var sStart = -1;

        for (var idx = 0; idx < n; idx++) {
            if (isSilent[idx]) {
                if (sStart < 0) sStart = idx;
            } else {
                if (sStart >= 0) {
                    if (idx - sStart >= minSilenceBuckets) {
                        rawRuns.push({ startBucket: sStart, endBucket: idx });
                    }
                    sStart = -1;
                }
            }
        }
        if (sStart >= 0 && (n - sStart) >= minSilenceBuckets) {
            rawRuns.push({ startBucket: sStart, endBucket: n });
        }

        // Step 5: Convert buckets to timeline seconds, apply generous sentence-end padding, and snap inward to frames
        var padStartSec = Math.max(0, padStartMs / 1000);
        var padEndSec = Math.max(0, padEndMs / 1000);
        var minCutDuration = Math.max(2 / fps, 0.04);
        var regions = [];

        for (var r = 0; r < rawRuns.length; r++) {
            var rawStart = timelineStartSec + (rawRuns[r].startBucket * windowMs) / 1000;
            var rawEnd = timelineStartSec + (rawRuns[r].endBucket * windowMs) / 1000;

            // Apply sentence-end release padding (padStartSec) if silence starts after speech
            var adjStart = rawRuns[r].startBucket > 0 ? (rawStart + padStartSec) : rawStart;
            // Apply sentence-start attack padding (padEndSec) if silence ends before speech
            var adjEnd = rawRuns[r].endBucket < n ? (rawEnd - padEndSec) : rawEnd;

            // Snap silence start FORWARD (ceil) and silence end BACKWARD (floor) so frame rounding never clips speech
            adjStart = Math.max(timelineStartSec, snapToFrameCeil(adjStart, fps));
            adjEnd = Math.min(timelineEndSec, snapToFrameFloor(adjEnd, fps));

            if (adjEnd - adjStart >= minCutDuration) {
                regions.push({
                    start: Math.round(adjStart * 1000) / 1000,
                    end: Math.round(adjEnd * 1000) / 1000
                });
            }
        }

        // Step 6: Merge adjacent or overlapping regions
        var merged = [];
        var frameTol = (1.1 / fps);
        for (var m = 0; m < regions.length; m++) {
            if (merged.length === 0) {
                merged.push({
                    id: 1,
                    start: regions[m].start,
                    end: regions[m].end,
                    duration: Math.round((regions[m].end - regions[m].start) * 1000) / 1000,
                    enabled: true
                });
            } else {
                var prev = merged[merged.length - 1];
                if (regions[m].start <= prev.end + frameTol) {
                    prev.end = Math.max(prev.end, regions[m].end);
                    prev.duration = Math.round((prev.end - prev.start) * 1000) / 1000;
                } else {
                    merged.push({
                        id: merged.length + 1,
                        start: regions[m].start,
                        end: regions[m].end,
                        duration: Math.round((regions[m].end - regions[m].start) * 1000) / 1000,
                        enabled: true
                    });
                }
            }
        }

        var totalSilenceSec = 0;
        for (var s = 0; s < merged.length; s++) {
            totalSilenceSec += merged[s].duration;
        }
        totalSilenceSec = Math.round(totalSilenceSec * 100) / 100;
        var totalDurationSec = Math.max(0.001, Math.round((timelineEndSec - timelineStartSec) * 100) / 100);
        var keptDurationSec = Math.max(0, Math.round((totalDurationSec - totalSilenceSec) * 100) / 100);
        var savedPercent = Math.min(100, Math.max(0, Math.round((totalSilenceSec / totalDurationSec) * 1000) / 10));

        return {
            regions: merged,
            totalSilenceSec: totalSilenceSec,
            totalDurationSec: totalDurationSec,
            keptDurationSec: keptDurationSec,
            savedPercent: savedPercent
        };
    }

    /**
     * Automatically compute the optimal silence threshold (dB) using Otsu's bimodal separation
     */
    function computeAutoThreshold(envelopeData) {
        var envelope = (envelopeData && envelopeData.envelope) || [];
        var coverage = (envelopeData && envelopeData.coverage) || null;
        if (!envelope || envelope.length === 0) return -35;

        var minDb = -75;
        var maxDb = -5;
        var bins = maxDb - minDb + 1;
        var hist = new Array(bins).fill(0);
        var validCount = 0;

        for (var i = 0; i < envelope.length; i++) {
            if (coverage && !coverage[i]) continue;
            var v = envelope[i];
            if (v <= -98) continue; // pure digital zero
            var clamped = Math.max(minDb, Math.min(maxDb, Math.round(v)));
            hist[clamped - minDb]++;
            validCount++;
        }

        if (validCount < 20) return -35;

        var totalSum = 0;
        for (var b = 0; b < bins; b++) {
            totalSum += b * hist[b];
        }

        var sumB = 0;
        var wB = 0;
        var maxVar = -1;
        var bestBinStart = 40;
        var bestBinEnd = 40;
        var bestMean0 = -50;
        var bestMean1 = -20;

        for (var t = 0; t < bins; t++) {
            wB += hist[t];
            if (wB === 0) continue;
            var wF = validCount - wB;
            if (wF === 0) break;

            sumB += t * hist[t];
            var mB = sumB / wB;
            var mF = (totalSum - sumB) / wF;
            var betweenVar = wB * wF * (mB - mF) * (mB - mF);

            if (betweenVar > maxVar + 1e-6) {
                maxVar = betweenVar;
                bestBinStart = t;
                bestBinEnd = t;
                bestMean0 = mB + minDb;
                bestMean1 = mF + minDb;
            } else if (Math.abs(betweenVar - maxVar) <= 1e-6) {
                bestBinEnd = t;
            }
        }

        var otsuDb = ((bestBinStart + bestBinEnd) / 2) + minDb;
        // Bias slightly toward noise floor so quiet word endings are preserved
        var weightedDb = bestMean0 + 0.38 * (bestMean1 - bestMean0);
        var finalDb = Math.round((0.45 * otsuDb + 0.55 * weightedDb));
        return Math.max(-60, Math.min(-15, finalDb));
    }

    return {
        snapToFrame: snapToFrame,
        snapToFrameCeil: snapToFrameCeil,
        snapToFrameFloor: snapToFrameFloor,
        formatTime: formatTime,
        detectSilenceRegions: detectSilenceRegions,
        computeAutoThreshold: computeAutoThreshold
    };
});
