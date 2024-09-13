import UserButton from "./UserButton";

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
            left: 0
          }}
        />
      )}
      <UserButton />
      {children}
    </div>
  );
}
