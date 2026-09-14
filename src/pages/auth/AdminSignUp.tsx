import {
  Modal,
  Button,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Tooltip,
  Upload,
} from "antd";
import KoraBtn from "../../components/buttons/KoraBtn";
import { GoogleOutlined, UserOutlined } from "@ant-design/icons";
import { useNavigate, Link } from "react-router-dom";
import GoogleIcon from "@mui/icons-material/Google";
import VerifyEmailNotice from "../../components/auth/VerifyEmailNotice";
import { adminSignUp, adminGoogleSignUp } from "../../services/authService";
import { useEffect, useState } from "react";
import BackgroundImage from "../../assets/images/Auth_Background.png";
import Logo from "../../assets/logos/cori_logo_green.png";

const AdminSignUp: React.FC = () => {
  const navigate = useNavigate();

  const [form] = Form.useForm();
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const messageKey = "signup";

  const handleGoogleSignUp = async () => {
    messageApi.open({ key: messageKey, type: "loading", content: "Signing up with Google..." });

    const result = await adminGoogleSignUp();

    messageApi.open({
      key: messageKey,
      type: result.errorCode === 200 ? "success" : "error",
      content: result.errorCode === 200 ? result.message : `Sign-up failed: ${result.message}`,
      duration: 3,
    });
  };

  const handleSignUp = async () => {
    try {
      messageApi.open({
        key: messageKey,
        type: "loading",
        content: "Signing you up...",
      });
      const values = await form.validateFields();

      const result = await adminSignUp({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
      });

      if (result.errorCode === 200) {
        messageApi.open({ key: messageKey, type: "success", content: result.message });
        setPendingEmail(values.email);
      } else {
        messageApi.open({ key: messageKey, type: "error", content: result.message });
      }
    } catch (err) {
      console.error("Validation or request failed:", err);
      messageApi.open({
        key: messageKey,
        type: "error",
        content: `Validation failded, please check if you can sign in, ${err}`,
      });
    }
  };

  return (
    <>
      {contextHolder}
      <div className="relative">
        <div className="flex w-full h-screen">
          <div className="w-1/2">
            <img
              src={Logo}
              alt="Logo"
              className="absolute top-4 left-4 w-[225px] h-[45px] object-contain mt-4 ml-4"
            />
            <img
              src={BackgroundImage}
              alt="Login Background"
              className="w-full h-full bg-corigreen-500 object-cover rounded-tr-[25px] rounded-br-[25px]"
            />
          </div>
          <div className="w-1/2 flex items-center justify-center mb-16">
            {!pendingEmail && (
              <div className="flex flex-col items-center w-[300px]">
                <h1 className="text-3xl font-bold mb-4 text-corigreen-500">
                  Admin <span className="text-zinc-900 font-light">Signup</span>
                </h1>
                <Form
                  form={form}
                  layout="vertical"
                  variant="filled"
                  className="flex flex-col w-full"
                >
                  {/* <Form.Item name="profilepic" valuePropName="fileList">
                    <Upload.Dragger name="profilepic" action="/">
                      <p className="ant-upload-drag-icon">
                        <UserOutlined />
                      </p>
                      <p className="text-zinc-500 text-[12px] mb-2">
                        Upload your profile picture
                      </p>
                    </Upload.Dragger>
                  </Form.Item> */}
                  <Form.Item
                    name="fullName"
                    label="Full Name"
                    normalize={(value: string) =>
                      value
                        .trimStart()
                        .split(" ")
                        .map(
                          (word: string) =>
                            word.charAt(0).toUpperCase() +
                            word.slice(1).toLowerCase()
                        )
                        .join(" ")
                    }
                    rules={[
                      {
                        required: true,
                        message: "Please enter your full name",
                      },
                      {
                        pattern: /^[a-zA-Z\s]+$/,
                        message: "Please enter a valid name",
                      },
                      {
                        pattern: /^[a-zA-Z]+\s[a-zA-Z]+/,
                        message: "Please enter atleast a first & last name.",
                      },
                    ]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item
                    name="email"
                    label="Email"
                    normalize={(value: string) => value.toLowerCase().trim()}
                    rules={[
                      { required: true, message: "Please enter an email." },
                    ]}
                  >
                    <Input type="email" />
                  </Form.Item>
                  <Form.Item
                    name="password"
                    label="Password"
                    rules={[
                      { required: true, message: "Please enter a password." },
                      {
                        min: 8,
                        message: "Password must be at least 8 characters long.",
                      },
                      {
                        pattern:
                          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
                        message:
                          "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
                      },
                    ]}
                  >
                    <Input type="password" />
                  </Form.Item>
                  <KoraBtn
                    type="submit"
                    style="black"
                    className="mt-2"
                    onClick={handleSignUp}
                  >
                    Sign Up
                  </KoraBtn>
                </Form>
                <KoraBtn
                  type="button"
                  secondary
                  style="black"
                  onClick={handleGoogleSignUp}
                  className="w-[300px] mt-3 flex items-center justify-center gap-2"
                >
                  <GoogleIcon fontSize="small" />
                  Sign up with Google
                </KoraBtn>
                <p className="mt-4 text-zinc-500">
                  Already have an account?{" "}
                  <Link
                    to="/"
                    className="text-corigreen-500 hover:text-corigreen-300 transition-colors font-bold"
                  >
                    Log in
                  </Link>
                </p>
              </div>
            )}
            {pendingEmail && (
              <VerifyEmailNotice email={pendingEmail} onBack={() => setPendingEmail(null)} />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminSignUp;
