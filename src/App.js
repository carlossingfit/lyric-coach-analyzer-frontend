import React, { useState } from "react";
import "./App.css";
import config from "./config";

// Demo results so users can see how the tool works without uploading audio
const DEMO_RESULTS = [
  {
    filename: "DEMO - Sample Song_vocals.wav",
    score: 3,
    explanation:
      "Example only: Vocal phrasing includes multiple short phrases with frequent workable gaps, providing several spots where spoken lyric prompts can fit comfortably.",
    song_minutes: 3.25,
    duration_seconds: 195,
    total_phrases: 78,
    num_promptable_phrases: 24,
    near_promptable_phrases: 16,
    promptable_phrases_per_minute: 7.4,
    near_promptable_phrases_per_minute: 4.9,
    promptable_phrase_coverage: 0.52,
    comfortable_gaps_per_minute: 1.3,
    comfortable_gap_coverage: 0.34,
    total_gaps_per_minute: 3.2,
    avg_phrase_duration_sec: 1.8,
    usable_density: 0.73,
  },
];

function App() {
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [selectedSong, setSelectedSong] = useState(null);
  const [authHeader, setAuthHeader] = useState(null); // cached Basic Auth header

  const handleFileChange = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    setFiles(selectedFiles);
    setResults([]);
    setError("");
    setSelectedSong(null);
    if (selectedFiles.length > 0) {
      setStatusMessage(`${selectedFiles.length} file(s) selected`);
    } else {
      setStatusMessage("");
    }
  };

  const handleUpload = async () => {
    if (!files.length) {
      setError("Please select at least one audio file.");
      return;
    }

    setError("");

    // Ask for password once per page load
    let header = authHeader;
    if (!header) {
      const password = window.prompt("Enter Lyric Coach Analyzer password:");
      if (!password) {
        setStatusMessage("Upload cancelled.");
        return;
      }
      const username = "singfit"; // must match BASIC_AUTH_USERNAME on the server
      header = "Basic " + btoa(`${username}:${password}`);
      setAuthHeader(header);
    }

    setLoading(true);
    setStatusMessage("Uploading and analyzing songs. Please wait...");
    setSelectedSong(null);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch(`${config.API_BASE_URL}/analyze-upload`, {
        method: "POST",
        body: formData,
        headers: {
          Authorization: header,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Auth failed: clear cached header so we re-prompt next time
          setAuthHeader(null);
          throw new Error("Unauthorized. Check your password and try again.");
        }
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        setResults([]);
      } else if (Array.isArray(data.results)) {
        const normalizedResults = data.results.map((item) => {
          const metrics = item.metrics || {};
          const songMinutes = metrics.song_minutes;
          const durationSeconds =
            typeof songMinutes === "number" ? songMinutes * 60 : undefined;

          return {
            ...item,
            ...metrics,
            duration_seconds: durationSeconds,
          };
        });

        setResults(normalizedResults);
        setStatusMessage(`Processed ${normalizedResults.length} file(s).`);
      } else {
        setError("Unexpected response format from server.");
        setResults([]);
      }
    } catch (err) {
      setError(`Upload or analysis failed: ${err.message}`);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Shorter labels to keep the table visually balanced
  const scoreToLabel = (score) => {
    if (score === 3) return "Strong";
    if (score === 2) return "Maybe";
    if (score === 1) return "Probably not";
    return "Unknown";
  };

  const scoreToClass = (score) => {
    if (score === 3) return "score-badge score-strong";
    if (score === 2) return "score-badge score-maybe";
    if (score === 1) return "score-badge score-weak";
    return "score-badge";
  };

  const scoreNumberClass = (score) => {
    if (score === 3) return "score-number-badge score-number-strong";
    if (score === 2) return "score-number-badge score-number-maybe";
    if (score === 1) return "score-number-badge score-number-weak";
    return "score-number-badge";
  };

  const escapeCSV = (value) => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    const escaped = str.replace(/"/g, '""');
    const needsQuotes = /[",\n]/.test(escaped);
    return needsQuotes ? `"${escaped}"` : escaped;
  };

  const handleDownloadCSV = () => {
    if (!results.length) {
      return;
    }

    const headers = [
      "Filename",
      "Score",
      "Score label",
      "Explanation",
      "Song minutes",
      "Duration seconds",
      "Total phrases",
      "Promptable phrase count",
      "Near promptable phrase count",
      "Promptable phrases per min",
      "Near promptable phrases per min",
      "Promptable phrase coverage",
      "Comfortable gaps per min",
      "Comfortable gap coverage",
      "Total gaps per min",
      "Avg phrase duration sec",
      "Usable density",
    ];

    const rows = results.map((item) => [
      item.filename,
      item.score,
      scoreToLabel(item.score),
      item.explanation ?? "",
      item.song_minutes !== undefined ? item.song_minutes.toFixed(3) : "",
      item.duration_seconds !== undefined
        ? item.duration_seconds.toFixed(3)
        : "",
      item.total_phrases ?? "",
      item.num_promptable_phrases ?? "",
      item.near_promptable_phrases ?? "",
      item.promptable_phrases_per_minute !== undefined
        ? item.promptable_phrases_per_minute.toFixed(4)
        : "",
      item.near_promptable_phrases_per_minute !== undefined
        ? item.near_promptable_phrases_per_minute.toFixed(4)
        : "",
      item.promptable_phrase_coverage !== undefined
        ? item.promptable_phrase_coverage.toFixed(4)
        : "",
      item.comfortable_gaps_per_minute !== undefined
        ? item.comfortable_gaps_per_minute.toFixed(4)
        : "",
      item.comfortable_gap_coverage !== undefined
        ? item.comfortable_gap_coverage.toFixed(4)
        : "",
      item.total_gaps_per_minute !== undefined
        ? item.total_gaps_per_minute.toFixed(4)
        : "",
      item.avg_phrase_duration_sec !== undefined
        ? item.avg_phrase_duration_sec.toFixed(4)
        : "",
      item.usable_density !== undefined
        ? item.usable_density.toFixed(4)
        : "",
    ]);

    const csvLines = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ];
    const csvContent = csvLines.join("\r\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "lyric_coach_results.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRowClick = (song) => {
    setSelectedSong(song);
  };

  const handleCloseModal = () => {
    setSelectedSong(null);
  };

  // New: load the demo results without hitting the backend
  const handleLoadDemo = () => {
    setFiles([]);
    setError("");
    setSelectedSong(null);
    setResults(DEMO_RESULTS);
    setStatusMessage("Showing demo results (no files uploaded).");
  };

  const formatSeconds = (sec) => {
    if (sec === null || sec === undefined || Number.isNaN(sec)) return "";
    const total = Number(sec);
    const minutes = Math.floor(total / 60);
    const seconds = Math.round(total - minutes * 60);
    const padded = String(seconds).padStart(2, "0");
    return `${minutes}:${padded}`;
  };

  const formatCoveragePercent = (value) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "n/a";
    }
    return `${(Number(value) * 100).toFixed(0)}%`;
  };

  // Generate song specific insight bullets based on real metrics
  const generateInsightBullets = (song) => {
    if (!song) return [];
    const bullets = [];

    const cov = song.promptable_phrase_coverage;
    const gaps = song.comfortable_gaps_per_minute;
    const density = song.usable_density;
    const ppm = song.promptable_phrases_per_minute;

    if (cov !== null && cov !== undefined && !Number.isNaN(cov)) {
      const pct = (cov * 100).toFixed(0);
      if (cov >= 0.55) {
        bullets.push(
          `Promptable phrase coverage is high at about ${pct} percent of the song.`
        );
      } else if (cov >= 0.35) {
        bullets.push(
          `Promptable phrase coverage is moderate at around ${pct} percent.`
        );
      } else {
        bullets.push(
          `Promptable phrase coverage is relatively low at about ${pct} percent.`
        );
      }
    }

    if (gaps !== null && gaps !== undefined && !Number.isNaN(gaps)) {
      if (gaps >= 1.6) {
        bullets.push(
          `Comfortable gaps appear fairly often at roughly ${gaps.toFixed(
            1
          )} per minute.`
        );
      } else if (gaps >= 0.8) {
        bullets.push(
          `Comfortable gaps are present but not frequent at about ${gaps.toFixed(
            1
          )} per minute.`
        );
      } else {
        bullets.push(
          `Comfortable gaps are scarce at roughly ${gaps.toFixed(
            1
          )} per minute.`
        );
      }
    }

    if (ppm !== null && ppm !== undefined && !Number.isNaN(ppm)) {
      if (ppm >= 6) {
        bullets.push(
          `Promptable phrases per minute are high at about ${ppm.toFixed(
            1
          )}, which increases opportunity.`
        );
      } else if (ppm >= 3) {
        bullets.push(
          `Promptable phrases per minute are in a middle range at about ${ppm.toFixed(
            1
          )}.`
        );
      } else {
        bullets.push(
          `Promptable phrases per minute are on the low side at about ${ppm.toFixed(
            1
          )}.`
        );
      }
    }

    if (density !== null && density !== undefined && !Number.isNaN(density)) {
      if (density >= 0.75) {
        bullets.push(
          `Usable density is strong, indicating a good balance of phrases and gaps.`
        );
      } else if (density >= 0.5) {
        bullets.push(
          `Usable density is moderate, which can support some prompting.`
        );
      } else {
        bullets.push(
          `Usable density is relatively low, which limits how often prompts can fit.`
        );
      }
    }

    // Keep it concise
    return bullets.slice(0, 3);
  };

  // Pick one metric as the deciding factor relative to a simple reference band
  const getDecidingFactor = (song) => {
    if (!song) return null;

    const candidates = [];

    const cov = song.promptable_phrase_coverage;
    if (cov !== null && cov !== undefined && !Number.isNaN(cov)) {
      candidates.push({
        key: "coverage",
        value: cov,
        target: 0.45,
      });
    }

    const gaps = song.comfortable_gaps_per_minute;
    if (gaps !== null && gaps !== undefined && !Number.isNaN(gaps)) {
      candidates.push({
        key: "gaps",
        value: gaps,
        target: 1.2,
      });
    }

    const density = song.usable_density;
    if (density !== null && density !== undefined && !Number.isNaN(density)) {
      candidates.push({
        key: "density",
        value: density,
        target: 0.7,
      });
    }

    const ppm = song.promptable_phrases_per_minute;
    if (ppm !== null && ppm !== undefined && !Number.isNaN(ppm)) {
      candidates.push({
        key: "ppm",
        value: ppm,
        target: 5.0,
      });
    }

    if (!candidates.length) return null;

    // Find the metric that deviates most from its reference target
    let best = candidates[0];
    let bestDiff = Math.abs(best.value - best.target);

    for (let i = 1; i < candidates.length; i += 1) {
      const diff = Math.abs(candidates[i].value - candidates[i].target);
      if (diff > bestDiff) {
        best = candidates[i];
        bestDiff = diff;
      }
    }

    const isAbove = best.value >= best.target;

    // Turn that into a short phrase; positive vs limiting wording
    if (best.key === "coverage") {
      const pct = (best.value * 100).toFixed(0);
      if (isAbove) {
        return `strong promptable phrase coverage at about ${pct} percent of the song, which supports this score.`;
      }
      return `lower promptable phrase coverage at about ${pct} percent of the song, which limits how high this song can score.`;
    }

    if (best.key === "gaps") {
      if (isAbove) {
        return `a relatively high rate of comfortable gaps at about ${best.value.toFixed(
          1
        )} per minute, which creates more workable moments.`;
      }
      return `a relatively low rate of comfortable gaps at about ${best.value.toFixed(
        1
      )} per minute, which limits the number of workable moments.`;
    }

    if (best.key === "density") {
      if (isAbove) {
        return `strong usable density around ${best.value.toFixed(
          2
        )}, indicating many workable spots for prompts.`;
      }
      return `lower usable density around ${best.value.toFixed(
        2
      )}, which reduces how often prompts can comfortably fit.`;
    }

    if (best.key === "ppm") {
      if (isAbove) {
        return `a higher than usual number of promptable phrases per minute at about ${best.value.toFixed(
          1
        )}, which supports this score.`;
      }
      return `a lower than usual number of promptable phrases per minute at about ${best.value.toFixed(
        1
      )}, which limits how high this song can score.`;
    }

    return null;
  };

  const insightBullets = selectedSong
    ? generateInsightBullets(selectedSong)
    : [];
  const decidingFactor = selectedSong ? getDecidingFactor(selectedSong) : null;

  return (
    <div className="app-root">
      <header className="top-bar">
        <div className="top-bar-inner">
          <div className="brand">
            <img
              src="/logo.png"
              alt="Company logo"
              className="brand-logo"
            />
            <div className="brand-text">
              <h1 className="app-title">Lyric Coach Analyzer</h1>
              <p className="subtitle">
                Upload songs to estimate whether they have enough gaps for spoken lyric prompts.
              </p>
            </div>
          </div>
          <div className="app-tag">Internal tool</div>
        </div>
      </header>

      <main className="app-main">
        <div className="app-container">
          <section className="panel upload-panel">
            <h2 className="panel-title">1. Select audio files</h2>
            <p className="hint">
              Choose one or many MP3, WAV, M4A, or FLAC files.{" "}
              They will be scored using your Lyric Coach model.
            </p>

            <label className="file-input-label">
              <span className="file-input-button">Choose files</span>
              <input
                type="file"
                multiple
                accept=".mp3,.wav,.m4a,.flac"
                onChange={handleFileChange}
              />
            </label>

            <div className="actions">
              <button
                className="primary-button"
                onClick={handleUpload}
                disabled={loading || !files.length}
              >
                {loading ? "Analyzing..." : "Upload and Analyze"}
              </button>
            </div>

            {statusMessage && (
              <div className="status status-info">{statusMessage}</div>
            )}

            {error && <div className="status status-error">{error}</div>}
          </section>

          <section className="panel results-panel">
            <div className="results-header-row">
              <h2 className="panel-title">2. Results</h2>
              <div className="results-header-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleLoadDemo}
                >
                  Load demo
                </button>
                {results.length > 0 && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleDownloadCSV}
                  >
                    Download CSV
                  </button>
                )}
              </div>
            </div>

            {!results.length && (
              <p className="hint">
                After you upload songs, results will appear here with scores and key metrics.{" "}
                You can also load a demo result to see how the analyzer works.{" "}
                Click a row to open a detailed explanation and full metrics.
              </p>
            )}

            {results.length > 0 && (
              <>
                <div className="legend results-legend">
                  <span className="legend-label">Score legend</span>
                  <span className="legend-pill legend-strong">
                    3 Strong candidate
                  </span>
                  <span className="legend-pill legend-maybe">
                    2 Maybe
                  </span>
                  <span className="legend-pill legend-weak">
                    1 Probably not
                  </span>
                </div>

                <div className="results-table-wrapper">
                  <table className="results-table">
                    <thead>
                      <tr>
                        <th className="col-filename">Filename</th>
                        <th className="col-score-number">Score</th>
                        <th className="col-score-label">Score label</th>
                        <th className="col-metric">Promptable phrases per min</th>
                        <th className="col-metric">Promptable phrase coverage</th>
                        <th className="col-metric">Comfortable gaps per min</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((item, index) => (
                        <tr
                          key={index}
                          className="clickable-row"
                          onClick={() => handleRowClick(item)}
                        >
                          <td className="filename-cell">{item.filename}</td>
                          <td className="score-number-cell">
                            {item.score != null ? (
                              <span className={scoreNumberClass(item.score)}>
                                {item.score}
                              </span>
                            ) : (
                              "?"
                            )}
                          </td>
                          <td>
                            <span className={scoreToClass(item.score)}>
                              {scoreToLabel(item.score)}
                            </span>
                          </td>
                          <td>
                            {item.promptable_phrases_per_minute !== undefined
                              ? item.promptable_phrases_per_minute.toFixed(2)
                              : "n/a"}
                          </td>
                          <td>
                            {item.promptable_phrase_coverage !== undefined
                              ? formatCoveragePercent(
                                  item.promptable_phrase_coverage
                                )
                              : "n/a"}
                          </td>
                          <td>
                            {item.comfortable_gaps_per_minute !== undefined
                              ? item.comfortable_gaps_per_minute.toFixed(2)
                              : "n/a"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="results-note">
                    <strong>General note:</strong>{" "}
                    The metrics in this table are summaries. The analyzer also looks at
                    timing patterns and other details not shown here, so songs with
                    similar numbers can still receive different scores. Click a row
                    to see a song specific explanation.
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      <footer className="app-footer">
        <div className="app-footer-inner">
          <span>© 2025 Musical Health Technologies. All rights reserved.</span>
          <span className="app-footer-meta">
            Lyric Coach Analyzer · Internal use only · v1.0
          </span>
        </div>
      </footer>

      {selectedSong && (
        <div className="modal-backdrop" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">{selectedSong.filename}</div>
                <div className="modal-subtitle">
                  <span className={scoreToClass(selectedSong.score)}>
                    {scoreToLabel(selectedSong.score)}
                  </span>
                  <span className="modal-score-text">
                    Score {selectedSong.score}
                  </span>
                </div>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={handleCloseModal}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Deciding factor line */}
              {decidingFactor && (
                <div className="modal-deciding-factor">
                  <strong>Deciding factor: </strong>
                  {decidingFactor}
                </div>
              )}

              {/* Song specific bullets based on metrics */}
              {insightBullets.length > 0 && (
                <div className="modal-insights">
                  <div className="detail-label">
                    Why this song received this score
                  </div>
                  <ul className="modal-insight-list">
                    {insightBullets.map((text, idx) => (
                      <li key={idx}>{text}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Original free text explanation from the model */}
              {selectedSong.explanation && (
                <p className="modal-explanation">{selectedSong.explanation}</p>
              )}

              <div className="detail-grid">
                <div className="detail-item">
                  <div className="detail-label">Duration</div>
                  <div className="detail-value">
                    {formatSeconds(selectedSong.duration_seconds)}{" "}
                    {selectedSong.duration_seconds
                      ? `(${selectedSong.duration_seconds.toFixed(1)} sec)`
                      : ""}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">Song minutes</div>
                  <div className="detail-value">
                    {selectedSong.song_minutes !== undefined
                      ? selectedSong.song_minutes.toFixed(2)
                      : "n/a"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">Total phrases</div>
                  <div className="detail-value">
                    {selectedSong.total_phrases ?? "n/a"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Promptable phrase count
                  </div>
                  <div className="detail-value">
                    {selectedSong.num_promptable_phrases ?? "n/a"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Near promptable phrase count
                  </div>
                  <div className="detail-value">
                    {selectedSong.near_promptable_phrases ?? "n/a"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Promptable phrases per min
                  </div>
                  <div className="detail-value">
                    {selectedSong.promptable_phrases_per_minute !== undefined
                      ? selectedSong.promptable_phrases_per_minute.toFixed(2)
                      : "n/a"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Near promptable phrases per min
                  </div>
                  <div className="detail-value">
                    {selectedSong.near_promptable_phrases_per_minute !==
                    undefined
                      ? selectedSong.near_promptable_phrases_per_minute.toFixed(
                          2
                        )
                      : "n/a"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">Promptable coverage</div>
                  <div className="detail-value">
                    {selectedSong.promptable_phrase_coverage !== undefined
                      ? formatCoveragePercent(
                          selectedSong.promptable_phrase_coverage
                        )
                      : "n/a"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">Avg phrase duration</div>
                  <div className="detail-value">
                    {selectedSong.avg_phrase_duration_sec !== undefined
                      ? `${selectedSong.avg_phrase_duration_sec.toFixed(
                          2
                        )} sec`
                      : "n/a"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Comfortable gaps per min
                  </div>
                  <div className="detail-value">
                    {selectedSong.comfortable_gaps_per_minute !== undefined
                      ? selectedSong.comfortable_gaps_per_minute.toFixed(2)
                      : "n/a"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">Total gaps per min</div>
                  <div className="detail-value">
                    {selectedSong.total_gaps_per_minute !== undefined
                      ? selectedSong.total_gaps_per_minute.toFixed(2)
                      : "n/a"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Comfortable gap coverage
                  </div>
                  <div className="detail-value">
                    {selectedSong.comfortable_gap_coverage !== undefined
                      ? formatCoveragePercent(
                          selectedSong.comfortable_gap_coverage
                        )
                      : "n/a"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">Usable density</div>
                  <div className="detail-value">
                    {selectedSong.usable_density !== undefined
                      ? selectedSong.usable_density.toFixed(2)
                      : "n/a"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
