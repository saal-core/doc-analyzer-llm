import React, { useState, useEffect } from "react";
import System from "../../../models/system";
import SingleUserAuth from "./SingleUserAuth";
import MultiUserAuth from "./MultiUserAuth";
import {
  AUTH_TOKEN,
  AUTH_USER,
  AUTH_TIMESTAMP,
} from "../../../utils/constants";
import useLogo from "../../../hooks/useLogo";
import illustration from "@/media/illustrations/login-illustration.png";

export default function PasswordModal({ mode = "single" }) {
  const { loginLogo } = useLogo();
  const logo = (
    <img
      src={loginLogo}
      alt="Logo"
      // className={`hidden relative md:flex w-fit m-4 z-30 relative max-h-[65px]  md:shadow-[0_4px_14px_rgba(0,0,0,0.25)]`}
      className={`hidden relative md:flex w-fit z-30 relative max-h-[65px]`}
      style={{ objectFit: "contain" }}
    />
  );

  return (
    <div className="fixed top-0 left-0 right-0 z-50 w-full overflow-x-hidden overflow-y-auto md:inset-0 h-[calc(100%-1rem)] h-full bg-[#f5f5f5] flex flex-col md:flex-row-reverse items-center justify-center">
      <div
        style={{
          background: `
    radial-gradient(circle at center, transparent 40%, black 100%),
    linear-gradient(180deg, #85F8FF 0%, #65A6F2 100%)
  `,
          width: "575px",
          filter: "blur(150px)",
          opacity: "0.4",
        }}
        className="absolute left-0 top-0 z-0 h-full w-full"
      />
      <div style={{ position: "relative" }} className="hidden md:flex md:w-1/2 md:h-full md:items-center md:justify-center">
        <img
          // className="w-full h-full object-contain z-50"
          className="w-full h-full z-50"
          src={illustration}
          style={{ zIndex: 1 }}
          // style={{ objectFit: "cover" }}
          alt="login illustration"
        />
        <div style={{ zIndex: 2, maxWidth: "616px", position: "absolute", bottom: 60, left: 0, right: 0, margin: "auto", textAlign: "center", padding: "0px 24px", color: "white" }}>
          <div style={{ fontWeight: 500, fontSize: "38px", lineHeight: "46px" }}>
            Excel in the Digital Era
          </div>

          <div
            style={{
              fontWeight: 400, fontSize: "16px", lineHeight: "24px", marginTop: "16px"
            }}
          >
            ASK AFADI AI is an innovative AI-powered application designed to revolutionize the way you interact with books. With this cutting-edge tool, you can engage in dynamic conversations about your favorite literature, gain deeper insights, and enhance your reading experience like never before.
          </div>
        </div>
      </div>
      <div
        style={{ background: "white" }}
        className="flex flex-col items-center justify-center h-full w-full md:w-1/2 z-50 relative"
      >
        {mode === "single" ? (
          <SingleUserAuth logo={logo} />
        ) : (
          <MultiUserAuth logo={logo} />
        )}
      </div>
    </div>
  );
}

export function usePasswordModal(notry = false) {
  const [auth, setAuth] = useState({
    loading: true,
    requiresAuth: false,
    mode: "single",
  });

  useEffect(() => {
    async function checkAuthReq() {
      if (!window) return;

      // If the last validity check is still valid
      // we can skip the loading.
      if (!System.needsAuthCheck() && notry === false) {
        setAuth({
          loading: false,
          requiresAuth: false,
          mode: "multi",
        });
        return;
      }

      const settings = await System.keys();
      if (settings?.MultiUserMode) {
        const currentToken = window.localStorage.getItem(AUTH_TOKEN);
        if (!!currentToken) {
          const valid = notry ? false : await System.checkAuth(currentToken);
          if (!valid) {
            setAuth({
              loading: false,
              requiresAuth: true,
              mode: "multi",
            });
            window.localStorage.removeItem(AUTH_USER);
            window.localStorage.removeItem(AUTH_TOKEN);
            window.localStorage.removeItem(AUTH_TIMESTAMP);
            return;
          } else {
            setAuth({
              loading: false,
              requiresAuth: false,
              mode: "multi",
            });
            return;
          }
        } else {
          setAuth({
            loading: false,
            requiresAuth: true,
            mode: "multi",
          });
          return;
        }
      } else {
        // Running token check in single user Auth mode.
        // If Single user Auth is disabled - skip check
        const requiresAuth = settings?.RequiresAuth || false;
        if (!requiresAuth) {
          setAuth({
            loading: false,
            requiresAuth: false,
            mode: "single",
          });
          return;
        }

        const currentToken = window.localStorage.getItem(AUTH_TOKEN);
        if (!!currentToken) {
          const valid = notry ? false : await System.checkAuth(currentToken);
          if (!valid) {
            setAuth({
              loading: false,
              requiresAuth: true,
              mode: "single",
            });
            window.localStorage.removeItem(AUTH_TOKEN);
            window.localStorage.removeItem(AUTH_USER);
            window.localStorage.removeItem(AUTH_TIMESTAMP);
            return;
          } else {
            setAuth({
              loading: false,
              requiresAuth: false,
              mode: "single",
            });
            return;
          }
        } else {
          setAuth({
            loading: false,
            requiresAuth: true,
            mode: "single",
          });
          return;
        }
      }
    }
    checkAuthReq();
  }, []);

  return auth;
}
