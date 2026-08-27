import { EvaluationBar } from "../components/EvaluationBar";
import { FpvViewport } from "../components/FpvViewport";
import { Header } from "../components/Header";
import { InfoPanel } from "../components/InfoPanel";
import { LiveAnalysis } from "../components/LiveAnalysis";
import { PlaybackBar } from "../components/PlaybackBar";
import { TwinViewport } from "../components/TwinViewport";

export function SimPage() {
  return (
    <div className="app">
      <Header />
      <section className="main">
        <InfoPanel />
        <section className="center">
          <FpvViewport />
          <TwinViewport />
          <PlaybackBar />
        </section>
        <LiveAnalysis />
      </section>
      <EvaluationBar />
    </div>
  );
}
