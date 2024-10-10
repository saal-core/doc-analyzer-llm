import { useState, useEffect } from "react";
import ChatHistory from "./ChatHistory";
import PromptInput, { PROMPT_INPUT_EVENT } from "./PromptInput";
import Workspace from "@/models/workspace";
import handleChat, { ABORT_STREAM_EVENT } from "@/utils/chat";
import { isMobile } from "react-device-detect";
import { SidebarMobileHeader } from "../../Sidebar";
import { useParams } from "react-router-dom";
import { v4 } from "uuid";
import Doc from "./Svgr/Doc";
import PDF from "./Svgr/Pdf";
import Guide from "./Svgr/Guide";
import Pin from "./Svgr/Pin";
import Cross from "./Svgr/Cross";
import handleSocketResponse, {
  websocketURI,
  AGENT_SESSION_END,
  AGENT_SESSION_START,
} from "@/utils/chat/agent";
import { FilePdf, FileCsv, FileXls } from "@phosphor-icons/react";


export default function ChatContainer({ workspace, knownHistory = [] }) {
  const { threadSlug = null } = useParams();
  const [message, setMessage] = useState("");
  const [loadingResponse, setLoadingResponse] = useState(false);
  const [chatHistory, setChatHistory] = useState(knownHistory);
  const [socketId, setSocketId] = useState(null);
  const [websocket, setWebsocket] = useState(null);

  const [selectedSection, setSelectedSection] = useState();
  // Maintain state of message from whatever is in PromptInput
  const handleMessageChange = (event) => {
    setMessage(event.target.value);
  };

  // Emit an update to the state of the prompt input without directly
  // passing a prop in so that it does not re-render constantly.
  function setMessageEmit(messageContent = "") {
    setMessage(messageContent);
    window.dispatchEvent(
      new CustomEvent(PROMPT_INPUT_EVENT, { detail: messageContent })
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!message || message === "") return false;
    const prevChatHistory = [
      ...chatHistory,
      { content: message, role: "user" },
      {
        content: "",
        role: "assistant",
        pending: true,
        userMessage: message,
        animate: true,
      },
    ];

    setChatHistory(prevChatHistory);
    setMessageEmit("");
    setLoadingResponse(true);
  };

  const sendMessage = async (message) => {
    const prevChatHistory = [
      ...chatHistory,
      { content: message, role: "user" },
      {
        content: "",
        role: "assistant",
        pending: true,
        userMessage: message,
        animate: true,
      },
    ];

    setChatHistory(prevChatHistory);
    setLoadingResponse(true);
  };

  const regenerateAssistantMessage = (chatId) => {
    const updatedHistory = chatHistory.slice(0, -1);
    const lastUserMessage = updatedHistory.slice(-1)[0];
    Workspace.deleteChats(workspace.slug, [chatId])
      .then(() => sendCommand(lastUserMessage.content, true, updatedHistory))
      .catch((e) => console.error(e));
  };

  const sendCommand = async (command, submit = false, history = []) => {
    if (!command || command === "") return false;
    if (!submit) {
      setMessageEmit(command);
      return;
    }

    let prevChatHistory;
    if (history.length > 0) {
      // use pre-determined history chain.
      prevChatHistory = [
        ...history,
        {
          content: "",
          role: "assistant",
          pending: true,
          userMessage: command,
          animate: true,
        },
      ];
    } else {
      prevChatHistory = [
        ...chatHistory,
        { content: command, role: "user" },
        {
          content: "",
          role: "assistant",
          pending: true,
          userMessage: command,
          animate: true,
        },
      ];
    }

    setChatHistory(prevChatHistory);
    setMessageEmit("");
    setLoadingResponse(true);
  };

  useEffect(() => {
    async function fetchReply() {
      const promptMessage =
        chatHistory.length > 0 ? chatHistory[chatHistory.length - 1] : null;
      const remHistory = chatHistory.length > 0 ? chatHistory.slice(0, -1) : [];
      var _chatHistory = [...remHistory];

      // Override hook for new messages to now go to agents until the connection closes
      if (websocket) {
        if (!promptMessage || !promptMessage?.userMessage) return false;
        websocket.send(
          JSON.stringify({
            type: "awaitingFeedback",
            feedback: promptMessage?.userMessage,
          })
        );
        return;
      }

      // TODO: Simplify this
      if (!promptMessage || !promptMessage?.userMessage) return false;
      if (threadSlug) {
        await Workspace.threads.streamChat(
          { workspaceSlug: workspace.slug, threadSlug },
          promptMessage.userMessage,
          (chatResult) =>
            handleChat(
              chatResult,
              setLoadingResponse,
              setChatHistory,
              remHistory,
              _chatHistory,
              setSocketId
            )
        );
      } else {
        await Workspace.streamChat(
          workspace,
          promptMessage.userMessage,
          (chatResult) =>
            handleChat(
              chatResult,
              setLoadingResponse,
              setChatHistory,
              remHistory,
              _chatHistory,
              setSocketId
            )
        );
      }
      return;
    }
    loadingResponse === true && fetchReply();
  }, [loadingResponse, chatHistory, workspace]);

  // TODO: Simplify this WSS stuff
  useEffect(() => {
    function handleWSS() {
      try {
        if (!socketId || !!websocket) return;
        const socket = new WebSocket(
          `${websocketURI()}/api/agent-invocation/${socketId}`
        );

        window.addEventListener(ABORT_STREAM_EVENT, () => {
          window.dispatchEvent(new CustomEvent(AGENT_SESSION_END));
          websocket.close();
        });

        socket.addEventListener("message", (event) => {
          setLoadingResponse(true);
          try {
            handleSocketResponse(event, setChatHistory);
          } catch (e) {
            console.error("Failed to parse data");
            window.dispatchEvent(new CustomEvent(AGENT_SESSION_END));
            socket.close();
          }
          setLoadingResponse(false);
        });

        socket.addEventListener("close", (_event) => {
          window.dispatchEvent(new CustomEvent(AGENT_SESSION_END));
          setChatHistory((prev) => [
            ...prev.filter((msg) => !!msg.content),
            {
              uuid: v4(),
              type: "statusResponse",
              content: "Agent session complete.",
              role: "assistant",
              sources: [],
              closed: true,
              error: null,
              animate: false,
              pending: false,
            },
          ]);
          setLoadingResponse(false);
          setWebsocket(null);
          setSocketId(null);
        });
        setWebsocket(socket);
        window.dispatchEvent(new CustomEvent(AGENT_SESSION_START));
      } catch (e) {
        setChatHistory((prev) => [
          ...prev.filter((msg) => !!msg.content),
          {
            uuid: v4(),
            type: "abort",
            content: e.message,
            role: "assistant",
            sources: [],
            closed: true,
            error: e.message,
            animate: false,
            pending: false,
          },
        ]);
        setLoadingResponse(false);
        setWebsocket(null);
        setSocketId(null);
      }
    }
    handleWSS();
  }, [socketId]);

  console.log("chatHistory>>>", chatHistory);
  console.log("workSpace>>>", workspace, knownHistory);
  return (
    <div
      style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
      className={`${!chatHistory?.length ? "chat-bg" : ""} chat-screen transition-all duration-500 relative md:ml-[2px] md:mr-[16px] md:my-[16px] md:rounded-[16px] bg-main-gradient w-full h-full overflow-y-scroll border-2 border-outline`}
    >
      {isMobile && <SidebarMobileHeader />}
      <div className="flex h-full w-full md:mt-0 mt-[40px]">
        <div
          className="flex flex-col h-full relative"
          style={{
            flexGrow: 1,
            marginRight: selectedSection ? "423px" : "85px",
          }}
        >
          <ChatHistory
            history={chatHistory}
            workspace={workspace}
            sendCommand={sendCommand}
            updateHistory={setChatHistory}
            regenerateAssistantMessage={regenerateAssistantMessage}
          />
          <PromptInput
            submit={handleSubmit}
            workspace={workspace}
            onChange={handleMessageChange}
            inputDisabled={loadingResponse}
            buttonDisabled={loadingResponse}
            sendCommand={sendCommand}
          />
        </div>

        <div>
          {selectedSection && (
            <div
              style={{
                width: "338px",
                height: "100%",
                backgroundColor: "rgba(255, 255, 255, 0.5)",
                position: "absolute",
                right: "85px",
                top: "0px",
                bottom: "0px",
                padding: "16px",
                boxShadow:
                  "0px 2px 4px 0px rgba(0, 0, 0, 0.02), 0px 1px 6px -1px rgba(0, 0, 0, 0.02), 0px 2px 4px 1px rgba(0, 0, 0, 0.03)",
              }}
            >
              <div className="w-full h-full relative">
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    height: "24px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                  onClick={() => {
                    setSelectedSection(null);
                  }}
                >
                  <Cross />
                </div>

                {selectedSection === "guide" && (
                  <StyleGuide sendMessage={sendMessage} />
                )}
                {selectedSection === "notes" && <Notes />}
                {selectedSection === "doc" && (
                  <Documents workspace={workspace} />
                )}
                {selectedSection === "podcast" && <Podcasts />}
              </div>
            </div>
          )}
          <SideSections
            selectedSection={selectedSection}
            setSelectedSection={setSelectedSection}
          />
        </div>
      </div>
    </div>
  );
}

const sections = [
  {
    label: "Guide",
    Icon: Guide,
    key: "guide",
  },
  {
    label: "Notes",
    Icon: Pin,
    key: "notes",
  },
  {
    label: "Doc",
    Icon: Doc,
    key: "doc",
  },
  {
    label: "Podcast",
    Icon: Doc,
    key: "podcast",
  },
];

function SideSections({ selectedSection, setSelectedSection }) {
  return (
    <div
      style={{
        width: "84px",
        position: "absolute",
        right: "0px",
        bottom: "0px",
        top: "0px",
        background: "#fff",
        borderLeft: "1px solid #F0F0F0",
      }}
    >
      {sections?.map((section) => (
        <div
          className="flex flex-col"
          style={{
            height: "74px",
            justifyContent: "center",
            alignItems: "center",
            fontSize: "14px",
            lineHeight: "22px",
            color: "#666666",
            borderBottom: "1px solid #F0F0F0",
            rowGap: "4px",
            cursor: "pointer",
            borderRight: "4px solid transparent",
            ...(section?.key === selectedSection && {
              background: "#E4F5FE",
              borderRight: "4px solid #291CA6",
              color: "#291CA6",
            }),
          }}
          onClick={() => {
            setSelectedSection(section?.key);
          }}
          key={section?.label}
        >
          <section.Icon />
          <div>{section?.label}</div>
        </div>
      ))}
    </div>
  );
}

function StyleGuide({ sendMessage }) {
  return (
    <div className="flex flex-col">
      <div
        style={{
          fontSize: "16px",
          fontWeight: 600,
          lineHeight: "24px",
          color: "rgba(41, 28, 165, 1)",
        }}
      >
        Study guide
      </div>

      <button
        style={{
          border: "1px solid",
          marginTop: "16px",
        }}
        onClick={() => {
          sendMessage("Generate Prompt");
        }}
      >
        Generate Prompt
      </button>
    </div>
  );
}

const notes = [
  {
    note_id: "123",
    chatid: 10,
    content: "This is the first note",
    created_at: "2024-10-10T12:00:00Z",
  },
  {
    note_id: "124",
    chatid: 10,
    content: "This is the second note",
    created_at: "2024-10-09T15:30:00Z",
  },
];
function Notes() {
  return (
    <div
      className="flex flex-col"
      style={{
        rowGap: "16px",
      }}
    >
      <div
        style={{
          fontSize: "16px",
          fontWeight: 600,
          lineHeight: "24px",
          color: "rgba(41, 28, 165, 1)",
        }}
      >
        Saved Resources
      </div>
      <div>
        <input
          placeholder="Search"
          style={{
            border: "rgba(212, 214, 216, 1)",
            height: "46px",
            borderRadius: "8px",
            background: "#fff",
            width: "100%",
            padding: "12px",
          }}
        />
      </div>
      <div
        className="flex flex-col"
        style={{
          rowGap: "16px",
        }}
      >
        {notes?.map((note) => (
          <div
            className="flex flex-col"
            key={note?.note_id}
            style={{
              border: "1px solid rgba(206, 226, 232, 1)",
              background:
                "linear-gradient(253.23deg, #ECFBFF 0%, #F2F0FF 100%)",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <div
              className="flex"
              style={{
                alignItems: "center",
                justifyContent: "space-between",
                columnGap: "12px",
                fontSize: "16px",
                lineHeight: "24px",
              }}
            >
              <div
                className="flex"
                style={{
                  columnGap: "12px",
                }}
              >
                <div>icon</div>
                <div>Notes</div>
              </div>
              <div>
                <input type="checkbox" />
              </div>
            </div>

            <div
              className="flex"
              style={{
                fontSize: "14px",
                lineHeight: "22px",
              }}
            >
              {note?.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const extensions = {
  pdf: {
    Icon: <PDF />,
    color: "rgba(245, 34, 45, 1)",
  },
  csv: {
    Icon: <FileCsv color="#fff" />,
    color: "rgba(87, 47, 246, 1)",
  },
  xls: {
    Icon: <FileXls color="#fff" />,
    color: "rgba(32, 158, 0, 1)",
  },
};

function getFileExtension(filename) {
  const lastDotIndex = filename.lastIndexOf(".");
  return lastDotIndex !== -1 ? filename.substring(lastDotIndex + 1) : ""; // Return the substring after the last dot
}

function Documents({ workspace }) {
  const docs =
    workspace?.documents?.map((v) => {
      const meta = JSON.parse(v?.metadata);
      return meta?.title;
    }) || [];

  console.log("docs>>>", docs);
  return (
    <div
      className="flex flex-col"
      style={{
        rowGap: "16px",
      }}
    >
      <div
        style={{
          fontSize: "16px",
          fontWeight: 600,
          lineHeight: "24px",
          color: "rgba(41, 28, 165, 1)",
        }}
      >
        Documents
      </div>
      <div>
        <input
          placeholder="Search"
          style={{
            border: "rgba(212, 214, 216, 1)",
            height: "46px",
            borderRadius: "8px",
            background: "#fff",
            width: "100%",
            padding: "12px",
          }}
        />
      </div>

      <div
        className="flex flex-col"
        style={{
          rowGap: "12px",
        }}
      >
        {docs?.map((d, index) => {
          console.log(getFileExtension(d));
          return (
            <div
              key={`${d}_${index}`}
              style={{
                display: "flex",
                border: "1px solid rgba(206, 226, 232, 1)",
                borderRadius: "8px",
                padding: "16px",
                fontSize: "14px",
                lineHeight: "22px",
                alignItems: "flex-start",
                columnGap: "12px",
              }}
            >
              <div
                style={{
                  padding: "7px",
                  background: extensions?.[getFileExtension(d)]?.color,
                  borderRadius: "8px",
                  width: "32px",
                  height: "32px",
                  minWidth: "32px",
                  minHeight: "32px",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {extensions?.[getFileExtension(d)]?.Icon}
              </div>

              <div>{d}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const podcasts = [
  {
    Podcast_name: "Podcast_name",
    Podcast_id: "123",
    content: "This is the first Podcast on ai",
    created_at: "2024-10-10T12:00:00Z",
  },
];

function Podcasts() {
  return (
    <div
      className="flex flex-col"
      style={{
        rowGap: "16px",
      }}
    >
      <div
        style={{
          fontSize: "16px",
          fontWeight: 600,
          lineHeight: "24px",
          color: "rgba(41, 28, 165, 1)",
        }}
      >
        Saved Podcasts
      </div>
      <div>
        <input
          placeholder="Search"
          style={{
            border: "rgba(212, 214, 216, 1)",
            height: "46px",
            borderRadius: "8px",
            background: "#fff",
            width: "100%",
            padding: "12px",
          }}
        />
      </div>
      <div
        className="flex flex-col"
        style={{
          rowGap: "16px",
        }}
      >
        {podcasts?.map((podcast) => (
          <div
            className="flex flex-col"
            key={podcast?.Podcast_id}
            style={{
              border: "1px solid rgba(206, 226, 232, 1)",
              background:
                "linear-gradient(253.23deg, #ECFBFF 0%, #F2F0FF 100%)",
              borderRadius: "8px",
              padding: "16px",
              rowGap: "16px",
            }}
          >
            <div
              className="flex"
              style={{
                alignItems: "center",
                justifyContent: "space-between",
                columnGap: "12px",
                fontSize: "16px",
                lineHeight: "24px",
              }}
            >
              <div
                className="flex"
                style={{
                  columnGap: "12px",
                }}
              >
                <div>icon</div>
                <div>{podcast?.Podcast_name}</div>
              </div>
              <div>
                <input type="checkbox" />
              </div>
            </div>

            <div
              style={{
                border: "1px solid rgba(206, 226, 232, 1)",
              }}
            />
            <div
              style={{
                fontSize: "12px",
                lineHeight: "20px",
              }}
            >
              Tap to listen to your podcast
            </div>
            <div
              className="flex"
              style={{
                fontSize: "14px",
                lineHeight: "22px",
              }}
            >
              {podcast?.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
