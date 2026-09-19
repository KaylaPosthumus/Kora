// src/dev/ApiPlayground.tsx
import { useState } from "react";
import { getCurrentUser, CurrentUserDTO } from "@/services/authService";

const ApiPlayground: React.FC = () => {
  const [apiResult, setApiResult] = useState<CurrentUserDTO | null>(null);

  const handleGetUser = async () => {
    const user = await getCurrentUser();
    setApiResult(user);
  };

  return (
    <>
      <div className="max-w-4xl mx-auto mt-10">
        <h1 className="text-2xl font-bold mb-4">
          🔍 Current Firebase user
        </h1>
        <button
          onClick={handleGetUser}
          className="px-4 py-2 bg-korablue-500 text-white rounded hover:bg-korablue-400 transition"
        >
          Fetch Current User
        </button>

        {apiResult && (
          <pre className="mt-6 bg-zinc-100 p-4 rounded text-sm overflow-x-auto border border-zinc-300">
            {JSON.stringify(apiResult, null, 2)}
          </pre>
        )}
      </div>
    </>
  );
};

export default ApiPlayground;
