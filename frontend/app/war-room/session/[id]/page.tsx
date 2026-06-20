import { auth0 } from "@/lib/auth0";
import { WarRoomArena } from "@/components/war-room/war-room-arena";

const WarRoomSessionPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const session = await auth0.getSession();

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-8 py-16 text-center">
        <p
          className="font-serif italic mb-6"
          style={{ fontSize: "26px", color: "#ede9e0" }}
        >
          Sign in to enter the War Room.
        </p>
        <a
          href="/auth/login"
          className="inline-flex items-center gap-2 font-semibold"
          style={{
            background: "#ede9e0",
            color: "#131210",
            borderRadius: "9px",
            padding: "12px 22px",
            fontSize: "14.5px",
            textDecoration: "none",
          }}
        >
          Sign in
        </a>
      </div>
    );
  }

  return <WarRoomArena id={id} />;
};
export default WarRoomSessionPage;
