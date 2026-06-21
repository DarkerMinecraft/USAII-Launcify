import type { Metadata } from "next";
import { SessionUi } from "@/components/pitch-session/session-ui";

export const metadata: Metadata = {
  title: "Pitch Session",
  robots: { index: false, follow: false },
};

const PitchSessionPage = () => <SessionUi />;
export default PitchSessionPage;
