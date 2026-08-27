import { formatClock } from "../engine/validate";
import { useAppStore } from "../store/appStore";

function scoreClass(score: number) {
  if (score >= 4.0) return "ok";
  if (score >= 3.0) return "warn";
  return "bad";
}

function stars(n: number) {
  return (
    <div className="stars">
      {"★★★★★".slice(0, n)}
      <span className="off">{"★★★★★".slice(n)}</span>
    </div>
  );
}

export function EvaluationBar() {
  const evaluation = useAppStore((s) => s.evaluation);
  const playing = useAppStore((s) => s.playing);
  const time = useAppStore((s) => s.time);
  const duration = useAppStore((s) => s.result?.trajectory.duration ?? 0);
  const returnToEditor = useAppStore((s) => s.returnToEditor);
  const runAiOptimize = useAppStore((s) => s.runAiOptimize);
  const optimizing = useAppStore((s) => s.optimizing);
  const note = useAppStore((s) => s.optimizeNote);
  const complete = !playing && duration > 0 && time >= duration - 1e-3;
  const hasRisk = evaluation ? evaluation.verdict !== "pass" : false;

  if (!evaluation) return null;

  return (
    <section className="eval">
      {note && <div className="note" style={{ gridColumn: "1 / -1", margin: 0 }}>{note}</div>}
      <div className="eval-card">
        <div className="eval-head">
          <div className="eval-title">
            仿真评估
            <small>● {complete ? "仿真已完成" : "结论以结束为准"}</small>
          </div>
          <div className="pill">飞行时长 {formatClock(complete ? duration : time)}</div>
        </div>
        <div className="dims">
          {evaluation.scores.map((s) => (
            <div className="dim" key={s.dimension}>
              <div className="name">{s.displayName}</div>
              <div className="hint">{s.caption}</div>
              {stars(s.stars)}
              <div className={`score ${scoreClass(s.score)}`}>{s.score.toFixed(1)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="eval-card">
        <div className="eval-head">
          <div className="eval-title">评估结论</div>
          <div
            className="pill"
            style={
              hasRisk
                ? {
                    color: "#ff8b96",
                    borderColor: "rgba(255,93,108,0.35)",
                    background: "rgba(255,93,108,0.08)",
                  }
                : undefined
            }
          >
            {evaluation.verdictLabel}
          </div>
        </div>
        <div className="conclusion">
          <div className="concl-text">{evaluation.summary}</div>
          <div className="eval-actions">
            <button className="act-btn manual" type="button" onClick={returnToEditor} disabled={!complete}>
              返回手动修改
            </button>
            {hasRisk && (
              <button className="act-btn ai" type="button" onClick={runAiOptimize} disabled={!complete || optimizing}>
                {optimizing ? "AI 优化中…" : "AI 一键优化"}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
