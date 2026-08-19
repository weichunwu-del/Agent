import { useAppStore } from "../store/appStore";

const SEV = { critical: "致命", warning: "警告", info: "提示" };

export function SafetyPanel() {
  const report = useAppStore((s) => s.result?.report);
  const selectedFindingId = useAppStore((s) => s.selectedFindingId);
  const selectFinding = useAppStore((s) => s.selectFinding);
  const applySafeRevision = useAppStore((s) => s.applySafeRevision);

  if (!report) return null;

  return (
    <>
      <section className="dock-section" style={{ borderBottom: "none", paddingBottom: 0 }}>
        <h3>前置安全校验</h3>
      </section>
      <div className={report.passed ? "pass-banner" : "fail-banner"}>{report.summary}</div>
      {!report.passed && (
        <div style={{ padding: "0 12px 8px" }}>
          <button className="btn block" type="button" onClick={applySafeRevision}>
            应用抬升修订方案
          </button>
        </div>
      )}
      <div className="finding-list">
        {report.findings.length === 0 && (
          <div className="hint" style={{ padding: 8 }}>
            未发现规则命中。可继续微调航点后重放仿真。
          </div>
        )}
        {report.findings.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`finding ${f.severity}${selectedFindingId === f.id ? " active" : ""}`}
            onClick={() => selectFinding(f.id)}
          >
            <strong>
              <span className={`sev ${f.severity}`}>{SEV[f.severity]}</span>
              {f.title}
            </strong>
            <p>{f.detail}</p>
            <p style={{ marginTop: 4, color: "var(--text)" }}>{f.recommendation}</p>
          </button>
        ))}
      </div>
    </>
  );
}
