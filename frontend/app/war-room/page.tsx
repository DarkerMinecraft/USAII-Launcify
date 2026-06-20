import { Swords, LogIn } from "lucide-react";
import { auth0 } from "@/lib/auth0";
import { Questionnaire } from "@/components/war-room/questionnaire";

const WarRoomPage = async () => {
  const session = await auth0.getSession();

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-8 py-16 text-center">
        <div
          className="flex items-center justify-center w-14 h-14 rounded-2xl mb-6"
          style={{
            background: "rgba(194,105,42,0.10)",
            border: "1px solid rgba(194,105,42,0.30)",
          }}
        >
          <Swords className="w-6 h-6" style={{ color: "#c2692a" }} />
        </div>

        <h1
          className="font-serif italic mb-3"
          style={{ fontSize: "30px", color: "#ede9e0" }}
        >
          Enter the War Room
        </h1>
        <p
          className="leading-relaxed mb-8"
          style={{ fontSize: "15px", color: "#9a958c", maxWidth: "26rem" }}
        >
          Sign in to stress-test your idea against three AI advisors and save your
          assumption map.
        </p>

        <a
          href="/auth/login"
          className="inline-flex items-center gap-2.5 font-semibold transition-colors"
          style={{
            background: "#ede9e0",
            color: "#131210",
            borderRadius: "9px",
            padding: "12px 22px",
            fontSize: "14.5px",
          }}
        >
          <LogIn className="w-4 h-4" />
          Sign in to continue
        </a>
      </div>
    );
  }

  return <Questionnaire />;
};
export default WarRoomPage;
