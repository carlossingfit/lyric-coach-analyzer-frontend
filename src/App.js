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

    setLoading(true);
    setError("");
    setStatusMessage("Uploading and analyzing songs. Please wait...");
    setSelectedSong(null);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch(`${config.API_BASE_URL}/batch-score`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        setResults([]);
      } else if (Array.isArray(data.results)) {
        setResults(data.results);
        setStatusMessage(`Processed ${data.results.length} file(s).`);
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

  const scoreToLabel = (score) => {
    if (score === 3) return "Strong candidate";
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
      "Duration seconds",
      "Comfortable gaps per min",
      "Total gaps per min",
      "Average gap sec",
      "Median gap sec",
      "Total gaps",
      "Comfortable gaps count",
    ];

    const rows = results.map((item) => [
      item.filename,
      item.score,
      scoreToLabel(item.score),
      item.explanation ?? "",
      item.duration_seconds !== undefined ? item.duration_seconds.toFixed(3) : "",
      item.comfortable_gaps_per_minute !== undefined
        ? item.comfortable_gaps_per_minute.toFixed(4)
        : "",
      item.total_gaps_per_minute !== undefined
        ? item.total_gaps_per_minute.toFixed(4)
        : "",
      item.avg_gap_duration_sec !== undefined
        ? item.avg_gap_duration_sec.toFixed(4)
        : "",
      item.median_gap_duration_sec !== undefined
        ? item.median_gap_duration_sec.toFixed(4)
        : "",
      item.total_gaps ?? "",
      item.num_comfortable_gaps ?? "",
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

  return (
    <div className="app">
      <header className="header">
        <h1>Lyric Coach Analyzer</h1>
        <p className="subtitle">
          Upload songs to estimate whether they have enough gaps for spoken lyric prompts.
        </p>
      </header>

      <main className="main">
        <section className="upload-panel">
          <h2>1. Select audio files</h2>
          <p className="hint">
            Choose one or many MP3 or WAV files. They will be scored using your Lyric Coach model.
          </p>

          <input
            type="file"
            multiple
            accept=".mp3,.wav,.m4a,.flac"
            onChange={handleFileChange}
          />

          <div className="actions">
            <button
              onClick={handleUpload}
              disabled={loading || !files.length}
            >
              {loading ? "Analyzing..." : "Upload and Analyze"}
            </button>
          </div>

          {statusMessage && (
            <div className="status">
              {statusMessage}
            </div>
          )}

          {error && (
            <div className="error">
              {error}
            </div>
          )}
        </section>

        <section className="results-panel">
          <div className="results-header-row">
            <h2>2. Results</h2>
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
              After you upload songs, results will appear here with scores and key metrics.
            </p>
          )}

          {results.length > 0 && (
            <div className="results-table-wrapper">
              <table className="results-table">
                <thead>
                  <tr>
                    <th className="col-filename">Filename</th>
                    <th className="col-score-number">Score</th>
                    <th className="col-score-label">Score label</th>
                    <th className="col-metric">Comfortable gaps / min</th>
                    <th className="col-metric">Total gaps / min</th>
                    <th className="col-metric">Average gap (sec)</th>
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
                          {item.comfortable_gaps_per_minute !== undefined
                            ? item.comfortable_gaps_per_minute.toFixed(2)
                            : "n/a"}
                        </td>
                        <td>
                          {item.total_gaps_per_minute !== undefined
                            ? item.total_gaps_per_minute.toFixed(2)
                            : "n/a"}
                        </td>
                        <td>
                          {item.avg_gap_duration_sec !== undefined
                            ? item.avg_gap_duration_sec.toFixed(2)
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
                              Score explanation
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
                Scores are based on relative gap distribution and your calibrated rules:
                3 = strong candidate, 2 = borderline or maybe, 1 = probably not.
                Click any row to see more details.
              </div>
            </div>
          )}
        </section>
      </main>

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
                  <div className="detail-label">Comfortable gaps per min</div>
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
                  <div className="detail-label">Total gaps</div>
                  <div className="detail-value">
                    {selectedSong.total_gaps ?? "n/a"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">Comfortable gaps count</div>
                  <div className="detail-value">
                    {selectedSong.num_comfortable_gaps ?? "n/a"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">Average gap length</div>
                  <div className="detail-value">
                    {selectedSong.avg_gap_duration_sec !== undefined
                      ? `${selectedSong.avg_gap_duration_sec.toFixed(2)} sec`
                      : "n/a"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">Median gap length</div>
                  <div className="detail-value">
                    {selectedSong.median_gap_duration_sec !== undefined
                      ? `${selectedSong.median_gap_duration_sec.toFixed(2)} sec`
                      : "n/a"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">Quiet threshold (dB)</div>
                  <div className="detail-value">
                    {selectedSong.threshold_db !== undefined
                      ? selectedSong.threshold_db.toFixed(1)
                      : "n/a"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">Quiet percentile</div>
                  <div className="detail-value">
                    {selectedSong.quiet_percentile !== undefined
                      ? `${selectedSong.quiet_percentile}%`
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
