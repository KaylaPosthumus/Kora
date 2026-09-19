import React from "react";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import KoraBtn from "@/shared/components/KoraBtn";

/**
 * Shown after a successful signup.
 *
 * Replaces `VerifyEmailNotice`, which told the user to open a verification link.
 * Kora does not verify email addresses: access is gated on an admin linking the
 * account to an employee or admin record, and nothing ever read whether the
 * address was confirmed. Asking people to do something with no effect was the
 * half-wired state the migration roadmap warned against.
 *
 * So this says the one thing that is actually true at this point — the account
 * exists and is waiting on an admin.
 */
function SignUpComplete({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <div className="flex flex-col items-center w-[320px] gap-4">
      <HowToRegIcon className="text-corigreen-500" style={{ fontSize: "96px" }} />

      <div className="flex flex-col gap-2 items-center">
        <h1 className="text-3xl text-zinc-900 font-light text-center">
          <span className="font-bold text-corigreen-500">Account</span> created
        </h1>
        <p className="text-zinc-500 text-center">
          We created your account for <span className="font-semibold">{email}</span>. An admin
          needs to activate it before you can sign in — they will see your request.
        </p>
      </div>

      <KoraBtn secondary type="button" style="black" className="w-full mt-3" onClick={onBack}>
        Back
      </KoraBtn>
    </div>
  );
}

export default SignUpComplete;
