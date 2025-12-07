import React, { useState } from "react";
import "./App.css";
import config from "./config";

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

            {!results.length && (
              <p className="hint">
                After you upload songs, results will appear here with scores and key metrics.{" "}
                Click a row to open a detailed metrics panel.
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
                        <React.Fragment key={index}>
                          <tr
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

                          {item.explanation && (
                            <tr
                              className="explanation-row"
                              onClick={() => handleRowClick(item)}
                            >
                              <td colSpan={6}>
                                <div className="row-explanation-label">
                                  Score explanation for this song
                                </div>
                                <div className="row-explanation-text">
                                  {item.explanation}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>

                  <div className="results-note">
                    <strong>General note:</strong>{" "}
                    Scores are based on vocal phrase structure and your calibrated rules.{" "}
                    Click any row to see detailed phrase and gap metrics.
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
              {selectedSong.explanation && (
                <p className="modal-explanation">
                  {selectedSong.explanation}
                </p>
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
