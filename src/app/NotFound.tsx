import React from "react";
import { useNavigate } from "react-router-dom";
import KoraBtn from "@/shared/components/KoraBtn";

/**
 * Catch-all for unmatched URLs. Without this an unknown path renders an empty
 * `<main>` and looks like a broken build.
 */
const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full h-full flex flex-col justify-center items-center gap-4 p-8 text-center">
      <p className="text-5xl font-bold text-zinc-300">404</p>
      <h1 className="text-2xl font-bold text-zinc-900">Page not found</h1>
      <p className="text-zinc-500 max-w-md">
        That link doesn&apos;t point anywhere in Kora. It may have been renamed or removed.
      </p>
      <KoraBtn onClick={() => navigate(-1)}>Go back</KoraBtn>
    </div>
  );
};

export default NotFound;
