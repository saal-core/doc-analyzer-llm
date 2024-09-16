import UserButton from "./UserButton";
import { Chats } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import paths from "@/utils/paths";


export default function UserMenu({ children }) {
  return (
    <div className="w-auto h-auto bg-sidebar">
      {children && (
        <div
          style={{
            position: "fixed",
            width: "60px",
            background: "#030852",
            top: "75px",
            bottom: 0,
            left: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "16px",
              cursor: "pointer",
              height: "40px",
              borderLeft: "4px solid #00A5D4",
              alignItems: "center",
            }}
          >
            <Link
              to={paths.home()}
            >
              <Chats color="#00A5D4" size={28} />
            </Link>
          </div>
        </div>
      )}
      <UserButton />
      {children}
    </div>
  );
}
