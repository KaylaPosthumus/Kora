import React, { useState } from "react";
import { Form, Input, message } from "antd";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import KoraBtn from "@/shared/components/KoraBtn";
import { requestPasswordReset } from "@/services/authService";

/**
 * Stands in for the login form when someone has lost their password.
 *
 * The confirmation is worded as "if", because the same answer is given whether or
 * not the address has an account. It also points Google users back to the login
 * form, since they have no Kora password to reset.
 */
function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const handleSubmit = async ({ email }: { email: string }) => {
    setSending(true);
    const result = await requestPasswordReset(email);
    setSending(false);

    if (result.errorCode === 200) {
      setSentTo(email);
    } else {
      messageApi.error(result.message);
    }
  };

  if (sentTo) {
    return (
      <div className="flex flex-col items-center w-full sm:w-[320px] gap-4">
        <MarkEmailReadIcon className="text-korablue-500" style={{ fontSize: "96px" }} />

        <div className="flex flex-col gap-2 items-center">
          <h1 className="text-3xl font-bold text-korablue-500 text-center">Check your email</h1>
          <p className="text-zinc-500 text-center">
            If <span className="font-semibold">{sentTo}</span> has a Kora password, a link to
            choose a new one is on its way. Look in your spam folder if you do not see it.
          </p>
          <p className="text-zinc-500 text-center">
            If you signed up with Google, go back and use Log In with Google instead.
          </p>
        </div>

        <KoraBtn secondary type="button" style="black" className="w-full mt-3" onClick={onBack}>
          Back to Log In
        </KoraBtn>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full sm:w-[300px]">
      {contextHolder}
      <h1 className="text-3xl font-bold mb-4 text-korablue-500">
        Reset <span className="text-zinc-900 font-light">Password</span>
      </h1>
      <p className="text-zinc-500 text-center mb-4">
        Type your email and we will send you a link to choose a new password.
      </p>
      <Form
        layout="vertical"
        variant="filled"
        className="flex flex-col w-full"
        onFinish={handleSubmit}
        autoComplete="off"
      >
        <Form.Item
          name="email"
          label="Email"
          normalize={(value: string) => value.toLowerCase().trim()}
          rules={[{ required: true, message: "Please enter an email" }]}
        >
          <Input type="email" />
        </Form.Item>
        <KoraBtn type="submit" style="black" disabled={sending}>
          Send Reset Link
        </KoraBtn>
      </Form>
      <KoraBtn secondary type="button" style="black" className="w-full mt-3" onClick={onBack}>
        Back to Log In
      </KoraBtn>
    </div>
  );
}

export default ForgotPassword;
