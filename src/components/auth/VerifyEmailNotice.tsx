import React, { useEffect, useRef, useState } from "react";
import { message } from "antd";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import KoraBtn from "../buttons/KoraBtn";
import { resendVerificationEmail } from "../../services/authService";

/**
 * Shown after a successful signup.
 *
 * Replaces the old `VeriCodeForm`: Firebase verifies an address by emailing a
 * link rather than a 6-digit code, so there is nothing to type back in. The
 * account already exists at this point — it just needs an admin to link it.
 */
function VerifyEmailNotice({ email, onBack }: { email: string; onBack: () => void }) {
  const [messageApi, contextHolder] = message.useMessage();
  const [secondsUntilResend, setSecondsUntilResend] = useState(60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rate-limit the resend button, same as the old code form did.
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsUntilResend((seconds) => {
        if (seconds <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleResend = async () => {
    const result = await resendVerificationEmail();

    if (result.errorCode === 200) {
      messageApi.success(result.message);
      setSecondsUntilResend(60);
    } else {
      messageApi.error(result.message);
    }
  };

  return (
    <div className="flex flex-col items-center w-[320px] gap-4">
      {contextHolder}
      <MarkEmailReadIcon className="text-corigreen-500" style={{ fontSize: "96px" }} />

      <div className="flex flex-col gap-2 items-center">
        <h1 className="text-3xl text-zinc-900 font-light text-center">
          <span className="font-bold text-corigreen-500">Check</span> your inbox
        </h1>
        <p className="text-zinc-500 text-center">
          We sent a verification link to <span className="font-semibold">{email}</span>. Open it to
          confirm your address, then ask your admin to activate your account.
        </p>
      </div>

      <div className="flex flex-col w-full">
        <KoraBtn
          type="button"
          style="black"
          className="w-full mt-3"
          disabled={secondsUntilResend > 0}
          onClick={handleResend}
        >
          {secondsUntilResend > 0 ? `Resend in ${secondsUntilResend}s` : "Resend email"}
        </KoraBtn>
        <KoraBtn secondary type="button" style="black" className="w-full mt-3" onClick={onBack}>
          Back
        </KoraBtn>
      </div>
    </div>
  );
}

export default VerifyEmailNotice;
