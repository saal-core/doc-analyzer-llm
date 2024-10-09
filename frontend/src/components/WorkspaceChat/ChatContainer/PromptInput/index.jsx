import React, { useState, useRef, useEffect } from "react";
import SlashCommandsButton, {
  SlashCommands,
  useSlashCommands,
} from "./SlashCommands";
import debounce from "lodash.debounce";
import { PaperPlaneRight, FilePlus } from "@phosphor-icons/react";
import StopGenerationButton from "./StopGenerationButton";
import { useManageWorkspaceModal } from "../../../Modals/ManageWorkspace";
import ManageWorkspace from "../../../Modals/ManageWorkspace";
import AvailableAgentsButton, {
  AvailableAgents,
  useAvailableAgents,
} from "./AgentMenu";
import TextSizeButton from "./TextSizeMenu";
import SpeechToText from "./SpeechToText";
import { Tooltip } from "react-tooltip";

export const PROMPT_INPUT_EVENT = "set_prompt_input";
export default function PromptInput({
  submit,
  onChange,
  inputDisabled,
  buttonDisabled,
  sendCommand,
  workspace,
}) {
  const [promptInput, setPromptInput] = useState("");
  const { showAgents, setShowAgents } = useAvailableAgents();
  const { showSlashCommand, setShowSlashCommand } = useSlashCommands();
  const formRef = useRef(null);
  const textareaRef = useRef(null);
  const [_, setFocused] = useState(false);
  const { showing, showModal, hideModal } = useManageWorkspaceModal();

  // To prevent too many re-renders we remotely listen for updates from the parent
  // via an event cycle. Otherwise, using message as a prop leads to a re-render every
  // change on the input.
  function handlePromptUpdate(e) {
    setPromptInput(e?.detail ?? "");
  }

  useEffect(() => {
    if (!!window)
      window.addEventListener(PROMPT_INPUT_EVENT, handlePromptUpdate);
    return () =>
      window?.removeEventListener(PROMPT_INPUT_EVENT, handlePromptUpdate);
  }, []);

  useEffect(() => {
    if (!inputDisabled && textareaRef.current) {
      textareaRef.current.focus();
    }
    resetTextAreaHeight();
  }, [inputDisabled]);

  const handleSubmit = (e) => {
    setFocused(false);
    submit(e);
  };

  const resetTextAreaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const checkForSlash = (e) => {
    const input = e.target.value;
    if (input === "/") setShowSlashCommand(true);
    if (showSlashCommand) setShowSlashCommand(false);
    return;
  };

  const checkForAt = (e) => {
    const input = e.target.value;
    if (input === "@") return setShowAgents(true);
    if (showAgents) return setShowAgents(false);
  };

  const captureEnter = (event) => {
    if (event.keyCode == 13) {
      if (!event.shiftKey) {
        submit(event);
      }
    }
  };

  const adjustTextArea = (event) => {
    const element = event.target;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  };

  const watchForSlash = debounce(checkForSlash, 300);
  const watchForAt = debounce(checkForAt, 300);

  return (
    <div className="w-full fixed md:absolute bottom-0 left-0 z-10 md:z-0 flex justify-center items-center">
      <SlashCommands
        showing={showSlashCommand}
        setShowing={setShowSlashCommand}
        sendCommand={sendCommand}
      />
      <AvailableAgents
        showing={showAgents}
        setShowing={setShowAgents}
        sendCommand={sendCommand}
        promptRef={textareaRef}
      />
      {showing && (
        <ManageWorkspace hideModal={hideModal} providedSlug={workspace.slug} />
      )}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-y-1 rounded-t-lg mx-auto w-full"
      >
        <div className="flex items-center rounded-lg md:mb-4" style={{ alignItems: "flex-start", justifyContent: "center", columnGap: "20px", width: "100%" }}>
          {/* {
            workspace?.slug &&
            <button style={{ minHeight: "48px", display: "flex", alignItems: "center", padding: "4px 12px", borderRadius: "4px", columnGap: "4px", background: "#E1F8FF", border: "1px solid #91D8ED" }} type="button" onClick={showModal}>
              <FilePlus size={20} />
              <span style={{ fontSize: "12px", lineHeight: "20px" }}>Manage</span>
            </button>
          } */}
          <div style={{ position: "relative", overflow: "visible", width: "85%" }} className="chat-box bg-main-gradient shadow-2xl border border-white/50 rounded-2xl flex flex-col px-4 overflow-hidden">
            <div className="flex items-center w-full">
              <textarea
                ref={textareaRef}
                onChange={(e) => {
                  onChange(e);
                  watchForSlash(e);
                  watchForAt(e);
                  adjustTextArea(e);
                  setPromptInput(e.target.value);
                }}
                onKeyDown={captureEnter}
                required={true}
                disabled={inputDisabled}
                onFocus={() => setFocused(true)}
                onBlur={(e) => {
                  setFocused(false);
                  adjustTextArea(e);
                }}
                value={promptInput}
                style={{
                  minHeight: "fit-content",
                  height: "fit-content",
                  maxHeight: "32px",
                  padding: "4px 0 0 0",
                }}
                className="cursor-text max-h-[50vh] md:max-h-[350px] md:min-h-[40px] mx-2 md:mx-0 py-2 w-full text-[16px] md:text-md text-white bg-transparent placeholder:text-white/60 resize-none active:outline-none focus:outline-none flex-grow"
                placeholder={"Send a message"}
              />
              {buttonDisabled ? (
                <StopGenerationButton />
              ) : (
                <>
                  <button
                    ref={formRef}
                    type="submit"
                    className="send-message inline-flex justify-center rounded-2xl cursor-pointer text-white/60 hover:text-white group ml-8"
                    data-tooltip-id="send-prompt"
                    data-tooltip-content="Send prompt message to workspace"
                    aria-label="Send prompt message to workspace"
                    style={{
                      maxHeight: "32px",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ paddingLeft: "2px", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", background: "#00A5D4", borderRadius: "50%", color: "white", transform: "rotate(-45deg)" }}>
                      <PaperPlaneRight size={14} className="" weight="fill" />
                    </div>
                    <span className="sr-only">Send message</span>
                  </button>
                  <Tooltip
                    id="send-prompt"
                    place="bottom"
                    delayShow={300}
                    className="tooltip !text-xs z-99"
                  />
                </>
              )}
            </div>
            <div style={{ position: "absolute", bottom: "-8px", borderTop: "1px solid rgba(0, 0, 0, 0.06)", width: "100%", left: 0 }} />
            <div style={{ position: "absolute", bottom: "-43px", width: "100%", left: 0 }} className="flex justify-between py-2">
              <div className="flex gap-x-2">
                <SlashCommandsButton
                  showing={showSlashCommand}
                  setShowSlashCommand={setShowSlashCommand}
                />
                <AvailableAgentsButton
                  showing={showAgents}
                  setShowAgents={setShowAgents}
                />
                <TextSizeButton />
              </div>
              <div className="flex">
                <SpeechToText sendCommand={sendCommand} />
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
