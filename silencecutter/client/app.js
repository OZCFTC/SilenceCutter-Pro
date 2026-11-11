/**
 * SilenceCutter Pro — Studio Edition Frontend Controller & Symmetrical Waveform Visualizer
 */
(function () {
    "use strict";

    var csInterface = new CSInterface();
    var nodeRequire = (typeof window !== "undefined" && (window.cep_node && window.cep_node.require)) ||
                      (typeof require === "function" ? require : null);
    var SilenceDetector = (typeof window !== "undefined" && window.SilenceDetector) ||
                          (typeof globalThis !== "undefined" && globalThis.SilenceDetector) ||
                          null;
    if (!SilenceDetector && nodeRequire) {
        try {
            var pathModInit = nodeRequire("path");
            var extRootInit = csInterface.getSystemPath(SystemPath.EXTENSION) || pathModInit.resolve(__dirname, "..");
            SilenceDetector = nodeRequire(pathModInit.join(extRootInit, "client", "detector.js"));
        } catch (e) {}
    }

    var PRESETS = {
        standard: { thresholdDb: -35, tailProtectionDb: 8,  minSilenceMs: 420, minSpeechMs: 90,  padStartMs: 220, padEndMs: 120 },
        fast:     { thresholdDb: -32, tailProtectionDb: 7,  minSilenceMs: 260, minSpeechMs: 70,  padStartMs: 150, padEndMs: 80 },
        podcast:  { thresholdDb: -38, tailProtectionDb: 10, minSilenceMs: 650, minSpeechMs: 100, padStartMs: 280, padEndMs: 160 },
        noisy:    { thresholdDb: -26, tailProtectionDb: 7,  minSilenceMs: 450, minSpeechMs: 120, padStartMs: 220, padEndMs: 120 }
    };

    var MODE_LABELS = {
        ripple:  "✂️ Sessiz Yerleri Kes ve Birleştir",
        lift:    "🕳️ Sessiz Yerleri Kes ve Boşluk Bırak",
        disable: "🔇 Sessiz Kısımları Devre Dışı Bırak",
        razor:   "🔪 Sadece Jilet At (Kesik Oluştur)",
        markers: "🏷️ Sessiz Bölgelere Marker Ekle"
    };

    var state = {
        sequence: null,
        selectedTrackIndices: [0],
        envelopeData: null,
        detectionResult: null,
        playheadSec: null,
        hoverRatio: null,
        isBusy: false
    };

    var els = {};

    function initDom() {
        els.seqNameLabel = document.getElementById("seqNameLabel");
        els.statusBadge = document.getElementById("statusBadge");
        els.statusText = document.getElementById("statusText");
        els.btnRefreshSeq = document.getElementById("btnRefreshSeq");
        els.metaFps = document.getElementById("metaFps");
        els.metaDur = document.getElementById("metaDur");
        els.metaSel = document.getElementById("metaSel");
        els.scopeSelect = document.getElementById("scopeSelect");
        els.scopeButtons = document.querySelectorAll("#scopeSegmented .seg-btn");
        els.audioTracksContainer = document.getElementById("audioTracksContainer");
        els.btnAnalyze = document.getElementById("btnAnalyze");
        els.btnAnalyzeText = document.getElementById("btnAnalyzeText");
        els.btnAutoThreshold = document.getElementById("btnAutoThreshold");
        els.waveformCanvas = document.getElementById("waveformCanvas");
        els.waveformHoverHud = document.getElementById("waveformHoverHud");
        els.waveformEmptyHint = document.getElementById("waveformEmptyHint");
        els.ratioCutBar = document.getElementById("ratioCutBar");
        els.sliderThreshold = document.getElementById("sliderThreshold");
        els.valThreshold = document.getElementById("valThreshold");
        els.sliderTailProtect = document.getElementById("sliderTailProtect");
        els.valTailProtect = document.getElementById("valTailProtect");
        els.sliderMinSilence = document.getElementById("sliderMinSilence");
        els.valMinSilence = document.getElementById("valMinSilence");
        els.sliderMinSpeech = document.getElementById("sliderMinSpeech");
        els.valMinSpeech = document.getElementById("valMinSpeech");
        els.sliderPadStart = document.getElementById("sliderPadStart");
        els.valPadStart = document.getElementById("valPadStart");
        els.sliderPadEnd = document.getElementById("sliderPadEnd");
        els.valPadEnd = document.getElementById("valPadEnd");
        els.statCount = document.getElementById("statCount");
        els.statCutTime = document.getElementById("statCutTime");
        els.statKeptTime = document.getElementById("statKeptTime");
        els.statPercent = document.getElementById("statPercent");
        els.actionModeSelect = document.getElementById("actionModeSelect");
        els.modeCards = document.querySelectorAll("#modeCardsGrid .mode-card");
        els.btnExecute = document.getElementById("btnExecute");
        els.btnExecuteLabel = document.getElementById("btnExecuteLabel");
        els.regionsDrawer = document.getElementById("regionsDrawer");
        els.drawerToggleHeader = document.getElementById("drawerToggleHeader");
        els.regionListCount = document.getElementById("regionListCount");
        els.regionsListContainer = document.getElementById("regionsListContainer");
        els.btnToggleAllRegions = document.getElementById("btnToggleAllRegions");
        els.btnClearMarkers = document.getElementById("btnClearMarkers");
        els.toastMessage = document.getElementById("toastMessage");
        els.presetChips = document.querySelectorAll(".preset-chip");
    }

    var toastTimer = null;
    function showToast(msg, type) {
        if (!els.toastMessage) return;
        els.toastMessage.textContent = msg;
        els.toastMessage.className = "toast " + (type || "");
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            els.toastMessage.classList.add("hidden");
        }, 4200);
    }

    function setStatus(text, mode) {
        if (!els.statusBadge) return;
        if (els.statusText) {
            els.statusText.textContent = text;
        } else {
            els.statusBadge.textContent = text;
        }
        els.statusBadge.className = "status-pill" + (mode ? " " + mode : "");
    }

    function evalHost(scriptCall) {
        return new Promise(function (resolve, reject) {
            csInterface.evalScript(scriptCall, function (rawRes) {
                if (!rawRes || rawRes === "EvalScript error.") {
                    return reject(new Error("Premiere Pro ExtendScript yanıt vermedi."));
                }
                try {
                    var parsed = JSON.parse(rawRes);
                    if (parsed && parsed.success) {
                        resolve(parsed.data);
                    } else {
                        reject(new Error((parsed && parsed.error) || "Bilinmeyen ExtendScript hatası."));
                    }
                } catch (e) {
                    reject(new Error("ExtendScript yanıtı çözümlenemedi: " + rawRes));
                }
            });
        });
    }

    function getExtensionRootPath() {
        var sysPath = csInterface.getSystemPath(SystemPath.EXTENSION);
        if (sysPath) return sysPath;
        if (nodeRequire) {
            try {
                var pathMod = nodeRequire("path");
                return pathMod.resolve(__dirname, "..");
            } catch (e) {}
        }
        return "";
    }

    // ============================================================
    // SEQUENCE & TRACK LOADING
    // ============================================================

    function refreshSequenceInfo() {
        setStatus("Yükleniyor...", "busy");
        return evalHost("sc_getSequenceInfo()")
            .then(function (seq) {
                state.sequence = seq;
                els.seqNameLabel.textContent = seq.name || "Aktif Sekans";
                els.metaFps.textContent = (seq.fps || 25) + " FPS";
                els.metaDur.textContent = SilenceDetector.formatTime(seq.durationSecs || 0, seq.fps);
                els.metaSel.textContent = (seq.selectedClipCount || 0) + " Klip";
                renderAudioTracks(seq.audioTracks || []);
                setStatus("Hazır", "");
            })
            .catch(function (err) {
                state.sequence = null;
                els.seqNameLabel.textContent = "Sekans Açık Değil";
                els.audioTracksContainer.innerHTML = '<div class="empty-hint">' + err.message + '</div>';
                setStatus("Bekleniyor", "error");
            });
    }

    function renderAudioTracks(tracks) {
        els.audioTracksContainer.innerHTML = "";
        if (!tracks || tracks.length === 0) {
            els.audioTracksContainer.innerHTML = '<div class="empty-hint">Sekansta ses katmanı bulunamadı.</div>';
            return;
        }

        var validSelection = [];
        for (var i = 0; i < tracks.length; i++) {
            if (state.selectedTrackIndices.indexOf(tracks[i].index) !== -1 && tracks[i].clipCount > 0) {
                validSelection.push(tracks[i].index);
            }
        }
        if (validSelection.length === 0) {
            for (var j = 0; j < tracks.length; j++) {
                if (tracks[j].clipCount > 0) {
                    validSelection.push(tracks[j].index);
                    break;
                }
            }
        }
        if (validSelection.length === 0) validSelection = [0];
        state.selectedTrackIndices = validSelection;

        tracks.forEach(function (tr) {
            var isChecked = state.selectedTrackIndices.indexOf(tr.index) !== -1;
            var label = document.createElement("label");
            label.className = "track-item" + (isChecked ? " checked" : "");

            var cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = isChecked;
            cb.value = String(tr.index);

            cb.addEventListener("change", function () {
                var idx = parseInt(cb.value, 10);
                if (cb.checked) {
                    if (state.selectedTrackIndices.indexOf(idx) === -1) {
                        state.selectedTrackIndices.push(idx);
                    }
                    label.classList.add("checked");
                } else {
                    state.selectedTrackIndices = state.selectedTrackIndices.filter(function (v) { return v !== idx; });
                    label.classList.remove("checked");
                }
            });

            var nameSpan = document.createElement("span");
            nameSpan.textContent = "A" + (tr.index + 1) + " • " + tr.name;

            var badgeSpan = document.createElement("span");
            badgeSpan.className = "track-badge";
            badgeSpan.textContent = "(" + tr.clipCount + ")";

            label.appendChild(cb);
            label.appendChild(nameSpan);
            label.appendChild(badgeSpan);
            els.audioTracksContainer.appendChild(label);
        });
    }

    // ============================================================
    // AUDIO ANALYSIS (MULTI-ENGINE)
    // ============================================================

    function getCurrentParams() {
        return {
            thresholdDb: parseFloat(els.sliderThreshold.value),
            tailProtectionDb: els.sliderTailProtect ? parseFloat(els.sliderTailProtect.value) : 8,
            minSilenceMs: parseFloat(els.sliderMinSilence.value),
            minSpeechMs: parseFloat(els.sliderMinSpeech.value),
            padStartMs: parseFloat(els.sliderPadStart.value),
            padEndMs: parseFloat(els.sliderPadEnd.value),
            fps: (state.sequence && state.sequence.fps) || 25
        };
    }

    function generateDemoEnvelope(durationSec) {
        var windowMs = 10;
        var totalBuckets = Math.floor((durationSec * 1000) / windowMs);
        var env = new Array(totalBuckets);
        var cov = new Array(totalBuckets).fill(true);

        var silentIntervals = [
            [1.2, 2.4], [4.8, 6.1], [9.0, 10.8], [13.5, 14.3],
            [17.2, 19.5], [23.0, 24.4], [28.1, 30.2], [34.0, 36.0], [39.5, 41.8]
        ];

        for (var i = 0; i < totalBuckets; i++) {
            var t = (i * windowMs) / 1000;
            var inSilence = false;
            for (var s = 0; s < silentIntervals.length; s++) {
                if (t >= silentIntervals[s][0] && t <= silentIntervals[s][1]) {
                    inSilence = true;
                    break;
                }
            }
            if (inSilence) {
                env[i] = -52 + Math.sin(i * 0.3) * 4;
            } else {
                env[i] = -18 + Math.sin(i * 0.17) * 6 + Math.cos(i * 0.07) * 4;
            }
        }

        return {
            success: true,
            engine: "DemoSimulator",
            windowMs: windowMs,
            timelineStartSec: 0,
            timelineEndSec: durationSec,
            envelope: env,
            coverage: cov,
            clipsAnalyzed: 1
        };
    }

    async function handleAnalyzeAudio() {
        if (state.isBusy) return;
        if (state.selectedTrackIndices.length === 0) {
            showToast("Lütfen analiz için en az bir ses katmanı (A1, A2 vb.) seçin.", "error");
            return;
        }

        state.isBusy = true;
        els.btnAnalyze.disabled = true;
        els.btnAnalyzeText.textContent = "Ses Analiz Ediliyor...";
        setStatus("Analiz...", "busy");

        try {
            await refreshSequenceInfo();

            if (!csInterface.isCEP() && !nodeRequire) {
                state.envelopeData = generateDemoEnvelope(45.0);
                els.waveformEmptyHint.classList.add("hidden");
                recalculateSilenceRegions();
                showToast("Demo ses dalga formu analiz edildi.", "success");
                setStatus("Analiz Tamam", "");
                return;
            }

            var reqOpts = JSON.stringify({
                trackIndices: state.selectedTrackIndices,
                scope: els.scopeSelect.value
            }).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

            var clipData = await evalHost("sc_getTargetClips('" + reqOpts + "')");
            var clips = (clipData && clipData.clips) || [];

            if (clips.length === 0) {
                throw new Error("Seçilen katmanda analiz edilecek ses klibi bulunamadı.");
            }

            var extRoot = getExtensionRootPath();
            var pathMod = nodeRequire("path");
            var analyzerMod = nodeRequire(pathMod.join(extRoot, "node", "analyzer.js"));

            var envResult = await analyzerMod.analyzeTimelineClips({
                clips: clips,
                windowMs: 10
            });

            if (!envResult || !envResult.success || !envResult.envelope || envResult.envelope.length === 0) {
                throw new Error("Kliplerden ses verisi okunamadı.");
            }

            state.envelopeData = envResult;
            els.waveformEmptyHint.classList.add("hidden");
            recalculateSilenceRegions();

            var scopeNote = clipData.filteredBySelection ? " (Seçili Klipler)" : "";
            showToast(
                envResult.clipsAnalyzed + " klip analiz edildi" + scopeNote + " [" + envResult.engine + "]",
                "success"
            );
            setStatus("Hazır", "");
        } catch (err) {
            showToast(err.message || "Analiz sırasında hata oluştu.", "error");
            setStatus("Hata", "error");
        } finally {
            state.isBusy = false;
            els.btnAnalyze.disabled = false;
            els.btnAnalyzeText.textContent = "Sesi Yeniden Analiz Et";
        }
    }

    // ============================================================
    // REAL-TIME DETECTION, MIRRORED WAVEFORM & REGIONS LIST
    // ============================================================

    function recalculateSilenceRegions() {
        if (!state.envelopeData) return;
        var params = getCurrentParams();
        state.detectionResult = SilenceDetector.detectSilenceRegions(state.envelopeData, params);
        updateStatsAndButtons();
        renderRegionsList();
        drawWaveform();
    }

    function updateStatsAndButtons() {
        var res = state.detectionResult;
        var fps = (state.sequence && state.sequence.fps) || 25;
        if (!res) {
            els.statCount.textContent = "0";
            els.statCutTime.textContent = "00:00.00";
            els.statKeptTime.textContent = "00:00.00";
            els.statPercent.textContent = "%0";
            els.regionListCount.textContent = "0";
            if (els.ratioCutBar) els.ratioCutBar.style.width = "0%";
            els.btnExecute.disabled = true;
            return;
        }

        var enabledRegions = res.regions.filter(function (r) { return r.enabled !== false; });
        var cutSec = 0;
        for (var i = 0; i < enabledRegions.length; i++) {
            cutSec += (enabledRegions[i].end - enabledRegions[i].start);
        }
        var keptSec = Math.max(0, res.totalDurationSec - cutSec);
        var pct = res.totalDurationSec > 0 ? Math.round((cutSec / res.totalDurationSec) * 1000) / 10 : 0;

        els.statCount.textContent = String(enabledRegions.length);
        els.statCutTime.textContent = SilenceDetector.formatTime(cutSec, fps);
        els.statKeptTime.textContent = SilenceDetector.formatTime(keptSec, fps);
        els.statPercent.textContent = "%" + pct;
        els.regionListCount.textContent = enabledRegions.length + " / " + res.regions.length;
        if (els.ratioCutBar) els.ratioCutBar.style.width = Math.min(100, Math.max(0, pct)) + "%";
        els.btnExecute.disabled = enabledRegions.length === 0;
    }

    function renderRegionsList() {
        var res = state.detectionResult;
        var fps = (state.sequence && state.sequence.fps) || 25;
        els.regionsListContainer.innerHTML = "";

        if (!res || res.regions.length === 0) {
            els.regionsListContainer.innerHTML =
                '<div class="empty-hint">Bu eşik değerinde kesilecek sessiz bölge bulunamadı. Eşik (dB) sürgüsünü sağa çekmeyi deneyin.</div>';
            return;
        }

        var frag = document.createDocumentFragment();
        res.regions.forEach(function (reg, idx) {
            var row = document.createElement("div");
            row.className = "region-row" + (reg.enabled === false ? " disabled-row" : "");

            var left = document.createElement("div");
            left.className = "region-left";

            var cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = reg.enabled !== false;
            cb.addEventListener("click", function (ev) {
                ev.stopPropagation();
                reg.enabled = cb.checked;
                row.classList.toggle("disabled-row", !reg.enabled);
                updateStatsAndButtons();
                drawWaveform();
            });

            var idxSpan = document.createElement("span");
            idxSpan.className = "region-idx";
            idxSpan.textContent = "#" + (idx + 1);

            var timeSpan = document.createElement("span");
            timeSpan.className = "region-times";
            timeSpan.textContent =
                SilenceDetector.formatTime(reg.start, fps) + " → " + SilenceDetector.formatTime(reg.end, fps);

            left.appendChild(cb);
            left.appendChild(idxSpan);
            left.appendChild(timeSpan);

            var durSpan = document.createElement("span");
            durSpan.className = "region-dur";
            durSpan.textContent = "-" + reg.duration.toFixed(2) + " sn";

            row.appendChild(left);
            row.appendChild(durSpan);

            row.addEventListener("click", function () {
                state.playheadSec = reg.start;
                drawWaveform();
                evalHost("sc_setPlayhead('" + reg.start + "')").catch(function () {});
            });

            frag.appendChild(row);
        });

        els.regionsListContainer.appendChild(frag);
    }

    /**
     * Draw Mirrored Symmetrical Studio Waveform (Audition / FabFilter Style)
     */
    function drawWaveform() {
        var canvas = els.waveformCanvas;
        if (!canvas) return;
        var ctx = canvas.getContext("2d");
        var width = canvas.width;
        var height = canvas.height;
        var midY = Math.round(height / 2);

        ctx.clearRect(0, 0, width, height);

        // Center zero-axis line & subtle grid
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, Math.round(height * 0.25));
        ctx.lineTo(width, Math.round(height * 0.25));
        ctx.moveTo(0, Math.round(height * 0.75));
        ctx.lineTo(width, Math.round(height * 0.75));
        ctx.stroke();

        ctx.strokeStyle = "rgba(244, 63, 94, 0.16)";
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(width, midY);
        ctx.stroke();

        var envData = state.envelopeData;
        if (!envData || !envData.envelope || envData.envelope.length === 0) return;

        var env = envData.envelope;
        var totalBuckets = env.length;
        var startSec = envData.timelineStartSec || 0;
        var endSec = envData.timelineEndSec || (startSec + (totalBuckets * (envData.windowMs || 10)) / 1000);
        var totalDur = Math.max(0.001, endSec - startSec);

        var minDb = -65;
        var maxDb = 0;
        var maxHalfAmp = midY - 8;

        function dbToHalfHeight(db) {
            var clamped = Math.max(minDb, Math.min(maxDb, db));
            var norm = (clamped - minDb) / (maxDb - minDb);
            return Math.max(1.5, Math.round(norm * maxHalfAmp));
        }

        // 1. Draw Silent Cut Zones (Crimson Red Translucent Blocks with Scarlet Caps)
        if (state.detectionResult && state.detectionResult.regions) {
            var regs = state.detectionResult.regions;
            for (var r = 0; r < regs.length; r++) {
                if (regs[r].enabled === false) continue;
                var x1 = ((regs[r].start - startSec) / totalDur) * width;
                var x2 = ((regs[r].end - startSec) / totalDur) * width;
                var w = Math.max(1.5, x2 - x1);

                ctx.fillStyle = "rgba(225, 29, 72, 0.26)";
                ctx.fillRect(x1, 0, w, height);

                ctx.fillStyle = "#f43f5e";
                ctx.fillRect(x1, 0, w, 2.5);
                ctx.fillRect(x1, height - 2.5, w, 2.5);
            }
        }

        // 2. Draw Mirrored Symmetrical Audio Waveform Bars
        var thresholdDb = parseFloat(els.sliderThreshold.value);
        var tailProtDb = els.sliderTailProtect ? parseFloat(els.sliderTailProtect.value) : 8;
        var closeThresholdDb = thresholdDb - tailProtDb;
        var step = totalBuckets / width;

        for (var x = 0; x < width; x += 2) {
            var bStart = Math.floor(x * step);
            var bEnd = Math.min(totalBuckets, Math.max(bStart + 1, Math.floor((x + 2) * step)));
            var peakDb = -100;
            for (var b = bStart; b < bEnd; b++) {
                if (env[b] > peakDb) peakDb = env[b];
            }

            var halfH = dbToHalfHeight(peakDb);

            if (peakDb >= thresholdDb) {
                ctx.fillStyle = "#f4f4f6";
            } else if (peakDb >= closeThresholdDb) {
                ctx.fillStyle = "#fda4af";
            } else {
                ctx.fillStyle = "#2e2e3a";
            }
            ctx.fillRect(x, midY - halfH, 1.3, halfH * 2);
        }

        // 3. Draw Symmetrical Threshold Lines (Upper & Lower)
        var threshHalf = dbToHalfHeight(thresholdDb);
        ctx.save();
        ctx.strokeStyle = "rgba(244, 63, 94, 0.85)";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(0, midY - threshHalf);
        ctx.lineTo(width, midY - threshHalf);
        ctx.moveTo(0, midY + threshHalf);
        ctx.lineTo(width, midY + threshHalf);
        ctx.stroke();
        ctx.restore();

        // Threshold Badge on Canvas
        ctx.fillStyle = "rgba(9, 9, 13, 0.88)";
        ctx.fillRect(6, 5, 50, 15);
        ctx.strokeStyle = "rgba(244, 63, 94, 0.45)";
        ctx.strokeRect(6, 5, 50, 15);
        ctx.fillStyle = "#fb7185";
        ctx.font = "bold 9.5px sans-serif";
        ctx.fillText(thresholdDb + " dB", 11, 16);

        // 4. Draw Hover Scrub Cursor
        if (state.hoverRatio !== null) {
            var hx = state.hoverRatio * width;
            ctx.strokeStyle = "rgba(251, 113, 133, 0.65)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(hx, 0);
            ctx.lineTo(hx, height);
            ctx.stroke();
        }

        // 5. Draw Active Playhead Indicator
        if (state.playheadSec !== null && state.playheadSec >= startSec && state.playheadSec <= endSec) {
            var px = ((state.playheadSec - startSec) / totalDur) * width;
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(px, 0);
            ctx.lineTo(px, height);
            ctx.stroke();
        }
    }

    // ============================================================
    // EXECUTE CUTTING ON PREMIERE TIMELINE
    // ============================================================

    async function handleExecuteAction() {
        if (state.isBusy || !state.detectionResult) return;

        var enabledRegions = state.detectionResult.regions.filter(function (r) {
            return r.enabled !== false;
        });

        if (enabledRegions.length === 0) {
            showToast("Kesilecek aktif sessiz bölge yok.", "error");
            return;
        }

        var mode = els.actionModeSelect.value;
        state.isBusy = true;
        els.btnExecute.disabled = true;
        setStatus("İşleniyor...", "busy");

        try {
            var payload = JSON.stringify({
                mode: mode,
                regions: enabledRegions.map(function (r) {
                    return { start: r.start, end: r.end, enabled: true };
                })
            }).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

            var res = await evalHost("sc_executeAction('" + payload + "')");

            var msgMap = {
                ripple:  enabledRegions.length + " sessiz bölge kesildi ve boşluklar birleştirildi!",
                lift:    enabledRegions.length + " sessiz bölge kesilip silindi (boşluk bırakıldı).",
                disable: enabledRegions.length + " sessiz bölgedeki klipler devre dışı bırakıldı.",
                razor:   enabledRegions.length + " sessiz bölgeye jilet (kesik) atıldı.",
                markers: (res.affectedCount || enabledRegions.length) + " adet sessizlik işaretleyicisi eklendi."
            };

            showToast(msgMap[mode] || "İşlem başarıyla tamamlandı!", "success");
            setStatus("Tamamlandı", "");
            await refreshSequenceInfo();
        } catch (err) {
            showToast(err.message || "Kesim işlemi sırasında hata oluştu.", "error");
            setStatus("Hata", "error");
        } finally {
            state.isBusy = false;
            els.btnExecute.disabled = false;
        }
    }

    // ============================================================
    // SLIDER PROGRESS FILL & EVENT BINDINGS
    // ============================================================

    function syncSliderFill(slider) {
        if (!slider) return;
        var min = parseFloat(slider.min) || 0;
        var max = parseFloat(slider.max) || 100;
        var val = parseFloat(slider.value) || 0;
        var pct = ((val - min) / Math.max(0.0001, max - min)) * 100;
        slider.style.setProperty("--pct", Math.max(0, Math.min(100, pct)).toFixed(1) + "%");
    }

    function updateSliderLabels() {
        els.valThreshold.textContent = els.sliderThreshold.value + " dB";
        if (els.sliderTailProtect && els.valTailProtect) {
            els.valTailProtect.textContent = els.sliderTailProtect.value + " dB";
        }
        els.valMinSilence.textContent = els.sliderMinSilence.value + " ms";
        els.valMinSpeech.textContent = els.sliderMinSpeech.value + " ms";
        els.valPadStart.textContent = els.sliderPadStart.value + " ms";
        els.valPadEnd.textContent = els.sliderPadEnd.value + " ms";

        [
            els.sliderThreshold,
            els.sliderTailProtect,
            els.sliderMinSilence,
            els.sliderMinSpeech,
            els.sliderPadStart,
            els.sliderPadEnd
        ].forEach(syncSliderFill);
    }

    function applyPreset(presetKey) {
        var p = PRESETS[presetKey];
        if (!p) return;
        els.sliderThreshold.value = String(p.thresholdDb);
        if (els.sliderTailProtect && typeof p.tailProtectionDb === "number") {
            els.sliderTailProtect.value = String(p.tailProtectionDb);
        }
        els.sliderMinSilence.value = String(p.minSilenceMs);
        els.sliderMinSpeech.value = String(p.minSpeechMs);
        els.sliderPadStart.value = String(p.padStartMs);
        els.sliderPadEnd.value = String(p.padEndMs);
        updateSliderLabels();
        recalculateSilenceRegions();
    }

    function bindEvents() {
        els.btnRefreshSeq.addEventListener("click", function (ev) {
            if (ev && ev.shiftKey) {
                window.location.reload();
                return;
            }
            refreshSequenceInfo();
        });
        els.btnAnalyze.addEventListener("click", handleAnalyzeAudio);
        els.btnExecute.addEventListener("click", handleExecuteAction);

        // Segmented Scope Buttons
        els.scopeButtons.forEach(function (btn) {
            btn.addEventListener("click", function () {
                els.scopeButtons.forEach(function (b) { b.classList.remove("active"); });
                btn.classList.add("active");
                els.scopeSelect.value = btn.getAttribute("data-scope") || "auto";
            });
        });

        // Sliders real-time update + double-click reset
        var sliders = [
            els.sliderThreshold,
            els.sliderTailProtect,
            els.sliderMinSilence,
            els.sliderMinSpeech,
            els.sliderPadStart,
            els.sliderPadEnd
        ].filter(Boolean);

        sliders.forEach(function (sl) {
            sl.addEventListener("input", function () {
                els.presetChips.forEach(function (c) { c.classList.remove("active"); });
                updateSliderLabels();
                recalculateSilenceRegions();
            });
            sl.addEventListener("dblclick", function () {
                var defVal = sl.getAttribute("data-default");
                if (defVal !== null) {
                    sl.value = defVal;
                    updateSliderLabels();
                    recalculateSilenceRegions();
                }
            });
        });

        // Presets
        els.presetChips.forEach(function (chip) {
            chip.addEventListener("click", function () {
                els.presetChips.forEach(function (c) { c.classList.remove("active"); });
                chip.classList.add("active");
                applyPreset(chip.getAttribute("data-preset"));
            });
        });

        // Auto-Threshold
        els.btnAutoThreshold.addEventListener("click", function () {
            if (!state.envelopeData) {
                showToast("Önce 'Sesi Analiz Et' butonuna tıklayın.", "error");
                return;
            }
            var optimalDb = SilenceDetector.computeAutoThreshold(state.envelopeData);
            els.sliderThreshold.value = String(optimalDb);
            updateSliderLabels();
            recalculateSilenceRegions();
            showToast("Otomatik eşik " + optimalDb + " dB olarak ayarlandı.", "success");
        });

        // 5 Visual Mode Cards
        els.modeCards.forEach(function (card) {
            card.addEventListener("click", function () {
                els.modeCards.forEach(function (c) { c.classList.remove("active"); });
                card.classList.add("active");
                var mode = card.getAttribute("data-mode") || "ripple";
                els.actionModeSelect.value = mode;
                if (els.btnExecuteLabel) {
                    els.btnExecuteLabel.textContent = MODE_LABELS[mode] || "Uygula";
                } else {
                    els.btnExecute.textContent = MODE_LABELS[mode] || "Uygula";
                }
            });
        });

        // Waveform Hover HUD & Click Seek
        els.waveformCanvas.addEventListener("mousemove", function (ev) {
            if (!state.envelopeData || !state.envelopeData.envelope.length) return;
            var rect = els.waveformCanvas.getBoundingClientRect();
            var ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
            state.hoverRatio = ratio;

            var env = state.envelopeData.envelope;
            var startSec = state.envelopeData.timelineStartSec || 0;
            var endSec = state.envelopeData.timelineEndSec || 0;
            var hoverSec = startSec + ratio * (endSec - startSec);
            var bIdx = Math.min(env.length - 1, Math.max(0, Math.floor(ratio * env.length)));
            var fps = (state.sequence && state.sequence.fps) || 25;

            if (els.waveformHoverHud) {
                els.waveformHoverHud.textContent =
                    SilenceDetector.formatTime(hoverSec, fps) + " • " + env[bIdx].toFixed(1) + " dB";
                els.waveformHoverHud.classList.remove("hidden");
            }
            drawWaveform();
        });

        els.waveformCanvas.addEventListener("mouseleave", function () {
            state.hoverRatio = null;
            if (els.waveformHoverHud) els.waveformHoverHud.classList.add("hidden");
            drawWaveform();
        });

        els.waveformCanvas.addEventListener("click", function (ev) {
            if (!state.envelopeData) return;
            var rect = els.waveformCanvas.getBoundingClientRect();
            var ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
            var startSec = state.envelopeData.timelineStartSec || 0;
            var endSec = state.envelopeData.timelineEndSec || 0;
            var targetSec = Math.round((startSec + ratio * (endSec - startSec)) * 1000) / 1000;
            state.playheadSec = targetSec;
            drawWaveform();
            evalHost("sc_setPlayhead('" + targetSec + "')").catch(function () {});
        });

        // Collapsible Regions Drawer
        if (els.drawerToggleHeader && els.regionsDrawer) {
            els.drawerToggleHeader.addEventListener("click", function () {
                els.regionsDrawer.classList.toggle("collapsed");
            });
        }

        // Toggle all regions
        els.btnToggleAllRegions.addEventListener("click", function () {
            if (!state.detectionResult || !state.detectionResult.regions.length) return;
            var regs = state.detectionResult.regions;
            var allEnabled = regs.every(function (r) { return r.enabled !== false; });
            regs.forEach(function (r) { r.enabled = !allEnabled; });
            renderRegionsList();
            updateStatsAndButtons();
            drawWaveform();
        });

        // Clear markers
        els.btnClearMarkers.addEventListener("click", function () {
            evalHost("sc_clearMarkers()")
                .then(function (res) {
                    showToast((res.removed || 0) + " adet işaretleyici temizlendi.", "success");
                })
                .catch(function (err) {
                    showToast(err.message, "error");
                });
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        initDom();
        updateSliderLabels();
        bindEvents();
        refreshSequenceInfo();
    });
})();
