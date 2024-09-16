import useUser from "@/hooks/useUser";
import paths from "@/utils/paths";
import { ArrowUUpLeft, Wrench, GearSix } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { useMatch } from "react-router-dom";
import { ToolTipWrapper } from "../Footer";

export default function SettingsButton() {
  const isInSettings = !!useMatch("/settings/*");
  const { user } = useUser();

  if (user && user?.role === "default") return null;

  if (isInSettings)
    return (
      // <ToolTipWrapper id="go-home">
      <Link
        to={paths.home()}
        className="transition-all duration-300 p-1 text-black"
        style={{ width: "95%", paddingLeft: "8px" }}
        aria-label="Home"
        data-tooltip-id="go-home"
        data-tooltip-content="Back to workspaces"
      >
        <div
          style={{ alignItems: "center", width: "100%" }}
          className={`transition-all duration-[200ms] text-sm
            flex flex-grow w-[75%] gap-x-2 py-[8px] px-[12px] rounded-[4px] text-black justify-start items-center
            hover:bg-workspace-item-selected-gradient hover:font-bold border-2 border-outline
            `}
        >
          <ArrowUUpLeft className="h-5 w-5" weight="fill" />
          <span>Back to workspaces</span>
        </div>
      </Link>
      // </ToolTipWrapper>
    );

  return (
    // <ToolTipWrapper
    //   id="open-settings"
    // >
    <Link
      to={!!user?.role ? paths.settings.system() : paths.settings.appearance()}
      className="transition-all duration-300 p-1 text-black"
      // style={{ width: "95%", paddingLeft: "8px" }}
      style={{ paddingLeft: "8px" }}
      aria-label="Home"
      data-tooltip-id="go-home"
      data-tooltip-content="Back to workspaces"
    >
      <div
        // style={{ alignItems: "center", width: "100%" }}
        style={{ alignItems: "center", position: "fixed", width: "59px", display: "flex", left: "-40px", bottom: "22px" }}
        // className={`transition-all duration-[200ms] text-sm
        //   flex flex-grow w-[75%] gap-x-2 py-[8px] px-[12px] rounded-[4px] text-black justify-start items-center
        //   hover:bg-workspace-item-selected-gradient hover:font-bold border-2 border-outline
        //   `}
      >
        <GearSix className="h-5 w-5" weight="regular" />

        {/* <span>Settings</span> */}
      </div>
    </Link>
    // </ToolTipWrapper>
  );
}
