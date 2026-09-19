import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";

// Authentication
import {
  fullGoogleSignIn,
  fullEmailLogin,
  handleExistingLoginRedirect,
} from "@/services/authService";

// Styling and UI Components
import { Form, Input, message, Spin } from "antd";
import GoogleIcon from "@mui/icons-material/Google";
import Logo from "@/assets/logos/kora_logo.png";

// Child Components
import { UnlinkedMessage } from "@/features/auth/components";
import KoraBtn from "@/shared/components/KoraBtn";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const messageKey = "login";

  const [showUnlinkedMessage, setShowUnlinkedMessage] = useState(false);
  const [loading, setLoading] = useState(true); // Start in loading state
  const [showAdminBtn, setShowAdminBtn] = useState(false);

  // Effect for handling keyboard shortcuts
  useEffect(() => {
    const handleKeyCombo = (e: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement;
      if (
        activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA"
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === "a") {
        setShowAdminBtn((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyCombo);
    // Cleanup function to remove the event listener
    return () => document.removeEventListener("keydown", handleKeyCombo);
  }, []);

  // Effect for checking existing login sessions on component mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        await handleExistingLoginRedirect();
      } catch (error) {
        console.error("Failed to check existing session:", error);
        // Optionally show an error message to the user
      } finally {
        setLoading(false); // Ensure loading is always turned off
      }
    };
    checkSession();
  }, []);

  // Google sign-in — `signInWithPopup`, no Electron OAuth window involved.
  const handleGoogleLogin = async () => {
    messageApi.open({
      key: messageKey,
      type: "loading",
      content: "Logging in with Google...",
    });

    const { errorCode, message: msg } = await fullGoogleSignIn();

    if (errorCode === 200) {
      messageApi.open({
        key: messageKey,
        type: "success",
        content: "Login successful! Redirecting...",
        duration: 2,
      });
    } else if (errorCode === 300) {
      setShowUnlinkedMessage(true);
      messageApi.open({
        key: messageKey,
        type: "error",
        content: "Account not linked yet.",
        duration: 3,
      });
    } else {
      messageApi.open({
        key: messageKey,
        type: "error",
        content: `Login failed: ${msg}`,
        duration: 3,
      });
    }
  };

  // Handler for email/password form submission
  const handleEmailLogin = async (values: {
    email: string;
    password: string;
  }) => {
    const { email, password } = values;
    messageApi.open({
      key: messageKey,
      type: "loading",
      content: "Logging in...",
    });

    try {
      const result = await fullEmailLogin(email, password);

      if (result.errorCode === 200) {
        messageApi.open({
          key: messageKey,
          type: "success",
          content: "Login successful! Redirecting...",
          duration: 2,
        });
      } else if (result.errorCode === 300) {
        messageApi.open({
          key: messageKey,
          type: "error",
          content: `${result.message}`,
          duration: 3,
        });
        setShowUnlinkedMessage(true);
      } else {
        messageApi.open({
          key: messageKey,
          type: "error",
          content: `Login failed: ${result.message}`,
          duration: 3,
        });
      }
    } catch (error: any) {
      messageApi.open({
        key: messageKey,
        type: "error",
        content: `Unexpected error: ${error.message || "Please try again"}`,
        duration: 3,
      });
    }
  };

  // Effect for checking if URL contains /#notlinked
  useEffect(() => {
    if (window.location.hash === "#notlinked") {
      setShowUnlinkedMessage(true);
    }
  }, []);

  // Main render logic
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spin size="large" tip="Fetching user details..." />
      </div>
    );
  }

  return (
    <>
      {contextHolder}
      <div className="relative">
        <div className="flex w-full h-screen">
          {/* Background Image Section */}
          <div className="w-1/2">
            <img
              src={Logo}
              alt="Kora"
              className="cursor-pointer absolute top-4 left-4 w-[76px] h-[84px] object-contain mt-4 ml-4"
              onDoubleClick={() => setShowAdminBtn(true)}
            />
            {/* The auth panel is a flat blue field for now. It was a 3.3 MB
                photograph, later a 180 kB WebP, and it is on the landing route —
                so it was the single heaviest thing between a visitor and the
                login form. A colour costs nothing and carries the brand. */}
            <div
              className="w-full h-full bg-korablue-500 rounded-tr-[25px] rounded-br-[25px]"
              aria-hidden="true"
            />
          </div>

          {/* Form Section */}
          <div className="w-1/2 flex items-center justify-center mb-16">
            {showUnlinkedMessage ? (
              <UnlinkedMessage onLogOut={() => setShowUnlinkedMessage(false)} />
            ) : (
              <div className="flex flex-col items-center w-[300px]">
                <h1 className="text-3xl font-bold mb-4 text-korablue-500 ">
                  Welcome <span className="text-zinc-900 font-light">Back</span>
                </h1>
                <Form
                  layout="vertical"
                  variant="filled"
                  className="flex flex-col w-full"
                  onFinish={handleEmailLogin}
                  autoComplete="off"
                >
                  <Form.Item
                    name="email"
                    label="Email"
                    normalize={(value) => value.toLowerCase().trim()}
                    rules={[
                      { required: true, message: "Please enter an email" },
                    ]}
                  >
                    <Input type="email" />
                  </Form.Item>
                  <Form.Item
                    name="password"
                    label="Password"
                    rules={[
                      { required: true, message: "Please enter a password" },
                    ]}
                  >
                    <Input.Password />
                  </Form.Item>
                  <KoraBtn type="submit" style="black">
                    Log In
                  </KoraBtn>
                </Form>
                <KoraBtn
                  type="button"
                  secondary
                  style="black"
                  onClick={handleGoogleLogin}
                  className="w-full mt-3 flex items-center justify-center gap-2"
                >
                  <GoogleIcon fontSize="small" />
                  Log In with Google
                </KoraBtn>

                <p className="mt-4 text-zinc-500">
                  New employee?{" "}
                  <Link
                    to="/employee/signup"
                    className="text-korablue-500 hover:text-korablue-300 transition-colors font-bold"
                  >
                    Sign up
                  </Link>
                </p>
                {showAdminBtn && (
                  <p className="mt-4 text-zinc-500">
                    For admins?{" "}
                    <Link
                      to="/admin/signup"
                      className="text-korablue-500 hover:text-korablue-300 transition-colors font-bold"
                    >
                      Sign up
                    </Link>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
