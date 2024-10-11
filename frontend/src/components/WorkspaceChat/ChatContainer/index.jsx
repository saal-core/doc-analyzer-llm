import { useState, useEffect, useRef, memo } from "react";
import _ChatHistory from "./ChatHistory";
import PromptInput, { PROMPT_INPUT_EVENT } from "./PromptInput";
import Workspace from "@/models/workspace";
import handleChat, { ABORT_STREAM_EVENT } from "@/utils/chat";
import { isMobile } from "react-device-detect";
import Scrollbars from "react-custom-scrollbars";
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
import {
  ListPlus,
  FileCsv,
  FileXls,
  Question,
  ListBullets,
  TreeStructure,
  Table,
  MagnifyingGlass,
  Note,
  SpeakerSimpleHigh,
  Play,
  Pause,
  Microphone,
  Trash,
} from "@phosphor-icons/react";
import renderMarkdown from "@/utils/chat/markdown";
import Skeleton from "react-loading-skeleton";
import System from "@/models/system";
import TTSMessage from "./ChatHistory/HistoricalMessage/Actions/TTSButton";
import ModalWrapper from "@/components/ModalWrapper";
import showToast from "@/utils/toast";


const ChatHistory = memo(
  _ChatHistory,
  (prev, next) => JSON.stringify(prev) === JSON.stringify(next)
);

export default function ChatContainer({ workspace, knownHistory = [] }) {
  const { threadSlug = null } = useParams();
  const [message, setMessage] = useState("");
  const [loadingResponse, setLoadingResponse] = useState(false);
  const [chatHistory, setChatHistory] = useState(knownHistory);
  const [socketId, setSocketId] = useState(null);
  const [websocket, setWebsocket] = useState(null);
  const [savedNotes, setSavedNotes] = useState([]);
  const [podcasts, setPodcasts] = useState([]);
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

  async function getNotes(workspace) {
    const res = await Workspace.getNotes(
      threadSlug || "default",
      workspace?.slug
    );
    setSavedNotes(res);
  }

  async function getPodcasts(workspace) {
    const res = await Workspace.getPodcasts(workspace?.slug);
    setPodcasts(res);
  }

  useEffect(() => {
    if (workspace) {
      getNotes(workspace);
      getPodcasts(workspace);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketId]);

  async function saveNote({ chatId, ...rest }, _workSpace) {
    const res = await Workspace.createNote({
      chatId,
      threadId: threadSlug ? threadSlug : "default",
      workspaceId: _workSpace?.slug,
    });
    if (res) {
      res.noteId = res.id;
      res.id = res.chatId;
      res.content = rest.content;
      setSavedNotes((n) => {
        return [res, ...n];
      });
    }
  }

  async function deleteNote(id) {
    const res = await Workspace.deleteNote(id);
  }

  async function savePodcast({ title, content }, _workSpace) {
    const res = await Workspace.createPodcast({
      podcastName: title,
      content: content,
      workspaceId: _workSpace?.slug,
    });
    if (res) {
      setTimeout(() => {
        setPodcasts((pd) => {
          pd[0].id = res?.id;
          return [...pd];
        });
      }, 100);
    }
  }

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
            savedNotes={savedNotes}
            onSaveNote={(val) => {
              if (!savedNotes?.find((_v) => (_v?.chatId || _v?.id) === val?.chatId)) {
                showToast(`Note saved successfully`, "success", {
                  clear: true,
                });
                saveNote(val, workspace);
              } else {
                setSavedNotes((v) => {
                  if (v?.find((_v) => (_v?.chatId || _v?.id) === val?.chatId)) {
                    const found = v?.find(
                      (_v) => (_v?.chatId || _v?.id) === val?.chatId
                    );
                    if (found?.noteId) {
                      deleteNote(found?.noteId);
                      showToast(`Note removed successfully`, "success", {
                        clear: true,
                      });
                    }
                    return v?.filter(
                      (_v) => (_v?.chatId || _v?.id) !== val?.chatId
                    );
                  }
                });
              }
            }}
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
                paddingInline: "8px",
                boxShadow:
                  "0px 2px 4px 0px rgba(0, 0, 0, 0.02), 0px 1px 6px -1px rgba(0, 0, 0, 0.02), 0px 2px 4px 1px rgba(0, 0, 0, 0.03)",
              }}
            >
              <div className="w-full h-full flex flex-col relative">
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 3,
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
                  <StyleGuide workspace={workspace} sendMessage={sendMessage} />
                )}
                {selectedSection === "notes" && (
                  <Notes
                    chatHistory={savedNotes}
                    setSavedNotes={setSavedNotes}
                    deleteNote={deleteNote}
                  />
                )}
                {selectedSection === "doc" && (
                  <Documents workspace={workspace} />
                )}
                {selectedSection === "podcast" && (
                  <Podcasts
                    workspace={workspace}
                    savePodcast={savePodcast}
                    podcasts={podcasts}
                    setPodcasts={setPodcasts}
                    sendMessage={sendMessage}
                  />
                )}
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
    Icon: Microphone,
    key: "podcast",
    disabled: false,
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
            ...(section?.disabled && {
              opacity: 0.7,
              pointerEvents: "none",
            }),
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
          <section.Icon size={24} />
          <div>{section?.label}</div>
        </div>
      ))}
    </div>
  );
}

function getQuestions(questionsString, num = 5) {
  // Split the string by lines
  const questionsArray = questionsString
    .split("\n")
    .map((q) => q.trim()) // Trim whitespace from each line
    .filter(
      (q) =>
        q.startsWith("1.") ||
        q.startsWith("2.") ||
        q.startsWith("3.") ||
        q.startsWith("4.") ||
        q.startsWith("5")
    ); // Filter only questions

  // Get the first five questions
  const firstFiveQuestions = questionsArray.slice(0, num);

  return firstFiveQuestions;
}

function StyleGuide({ sendMessage, workspace }) {
  const [summary, setSummary] = useState("");
  const summaryRef = useRef("");
  const [questions, setQuestions] = useState([]);
  const questionsRef = useRef("");

  useEffect(() => {
    const documents = workspace?.documents?.map((v) => v?.metadata);
    Workspace.streamChat(
      { ...workspace, chatMode: "query" },
      `Provide an overview from the uploaded documents in less than 150 words. Find meta details: ${documents}`,
      (chatResult) => {
        if (chatResult?.type === "textResponseChunk") {
          summaryRef.current += chatResult?.textResponse;
        } else if (chatResult?.type === "finalizeResponseStream") {
          setSummary(summaryRef.current);
          summaryRef.current = "";
          System.deleteChat(chatResult?.chatId);
        } else if (chatResult?.type === "abort") {
          setSummary(summaryRef.current);
          summaryRef.current = "";
          // System.deleteChat(chatResult?.chatId);
        }
      }
    );
  }, [workspace]);

  useEffect(() => {
    const documents = workspace?.documents?.map((v) => v?.metadata);
    Workspace.streamChat(
      { ...workspace },
      `Suggest questions from the uploaded documents. Find meta details: ${documents}`,
      (chatResult) => {
        if (chatResult?.type === "textResponseChunk") {
          questionsRef.current += chatResult?.textResponse;
        } else if (chatResult?.type === "finalizeResponseStream") {
          const _questions = getQuestions(questionsRef.current);
          const cleanedQuestions = _questions.map((q) =>
            q.replace(/^\d+\.\s*/, "")
          ); // Remove leading numbers
          System.deleteChat(chatResult?.chatId);
          questionsRef.current = "";
          setQuestions(cleanedQuestions);
        } else if (chatResult?.type === "abort") {
          setQuestions([]);
          questionsRef.current = "";
          // System.deleteChat(chatResult?.chatId);
        }
      }
    );
  }, [workspace]);

  return (
    <div
      className="flex flex-col"
      style={{
        rowGap: "16px",
        flexGrow: 1,
      }}
    >
      <div
        style={{
          fontSize: "16px",
          fontWeight: 600,
          lineHeight: "24px",
          color: "rgba(41, 28, 165, 1)",
          paddingInline: "8px",
        }}
      >
        Study guide
      </div>

      <Scrollbars>
        <div
          className="flex flex-col"
          style={{
            rowGap: "24px",
          }}
        >
          <div
            className="flex flex-col"
            style={{
              fontSize: "14px",
              rowGap: "4px",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                paddingInline: "8px",
              }}
            >
              Summary
            </div>
            <div>
              {!summary ? (
                <Skeleton count={4} />
              ) : (
                <Scrollbars
                  style={{
                    maxHeight: "250px",
                    height: "250px",
                  }}
                >
                  <div
                    style={{
                      paddingInline: "8px",
                    }}
                  >
                    <StatusResponse isShowMoreHide content={summary} />
                  </div>
                </Scrollbars>
              )}
            </div>
          </div>

          <div
            style={{
              borderTop: "1px solid rgba(0, 0, 0, 0.15)",
            }}
          />
          <div
            className="flex flex-col"
            style={{
              fontSize: "14px",
              rowGap: "16px",
            }}
          >
            <div
              style={{
                fontWeight: 600,
              }}
            >
              Help me create
            </div>
            <div
              className="flex"
              style={{ flexWrap: "wrap", rowGap: "8px", columnGap: "8px" }}
            >
              <div
                style={{
                  borderRadius: "8px",
                  padding: "4px 8px",
                  background: "rgba(228, 245, 254, 1)",
                  border: "1px solid rgba(145, 216, 237, 1)",
                  alignItems: "center",
                  columnGap: "4px",
                  display: "flex",
                  cursor: "pointer",
                }}
                onClick={() => {
                  sendMessage("Help me create FAQ");
                }}
              >
                <Question size={16} />
                <span>FAQ</span>
              </div>

              <div
                style={{
                  borderRadius: "8px",
                  padding: "4px 8px",
                  background: "rgba(228, 245, 254, 1)",
                  border: "1px solid rgba(145, 216, 237, 1)",
                  alignItems: "center",
                  columnGap: "4px",
                  display: "flex",
                  cursor: "pointer",
                }}
                onClick={() => {
                  sendMessage("Help me create Quick study guide");
                }}
              >
                <Table size={16} />
                <span>Quick study guide</span>
              </div>

              <div
                style={{
                  borderRadius: "8px",
                  padding: "4px 8px",
                  background: "rgba(228, 245, 254, 1)",
                  border: "1px solid rgba(145, 216, 237, 1)",
                  alignItems: "center",
                  columnGap: "4px",
                  display: "flex",
                  cursor: "pointer",
                }}
                onClick={() => {
                  sendMessage("Help me create Table of content");
                }}
              >
                <ListBullets size={16} />
                <span>Table of content</span>
              </div>

              <div
                style={{
                  borderRadius: "8px",
                  padding: "4px 8px",
                  background: "rgba(228, 245, 254, 1)",
                  border: "1px solid rgba(145, 216, 237, 1)",
                  alignItems: "center",
                  columnGap: "4px",
                  display: "flex",
                  cursor: "pointer",
                }}
                onClick={() => {
                  sendMessage("Help me create Timeline");
                }}
              >
                <TreeStructure size={16} />
                <span>Timeline</span>
              </div>
            </div>
          </div>

          <div
            style={{
              borderTop: "1px solid rgba(0, 0, 0, 0.15)",
            }}
          />

          <div
            className="flex flex-col"
            style={{
              fontSize: "14px",
              rowGap: "16px",
            }}
          >
            <div
              style={{
                fontWeight: 600,
              }}
            >
              Suggested Questions
            </div>
            <div
              className="flex flex-col"
              style={{
                rowGap: "16px",
              }}
            >
              {!questions?.length ? (
                <Skeleton count={4} />
              ) : (
                questions?.map((q, index) => (
                  <div
                    key={index}
                    style={{
                      background:
                        "linear-gradient(84.14deg, #F2F0FF 0%, #ECFBFF 100%)",
                      border: "1px solid rgba(206, 226, 232, 1)",
                      borderRadius: "8px",
                      padding: "16px",
                      cursor: "pointer",
                      alignItems: "flex-start",
                      columnGap: "8px",
                    }}
                    onClick={() => {
                      sendMessage(q);
                    }}
                    className="flex"
                  >
                    <div>
                      <ListPlus size={18} color="rgba(41, 28, 166, 1)" />
                    </div>
                    <div>{q}</div>
                  </div>
                ))
              )}
            </div>
          </div>
          {/* <button
            style={{
              border: "1px solid",
              marginTop: "16px",
            }}
            onClick={() => {
              sendMessage("Generate Prompt");
            }}
          >
            Generate Prompt
          </button> */}
        </div>
      </Scrollbars>
    </div>
  );
}

function Notes({ chatHistory: _chatHistory, setSavedNotes, deleteNote }) {
  const [searchText, setSearchText] = useState("");
  const chatHistory = _chatHistory?.filter((v) =>
    (v?.response ? JSON.parse(v?.response)?.text : v?.content)
      ?.toLowerCase()
      ?.includes(searchText?.toLowerCase())
  );
  return (
    <div
      className="flex flex-col"
      style={{
        rowGap: "16px",
        flexGrow: 1,
      }}
    >
      <div
        style={{
          fontSize: "16px",
          fontWeight: 600,
          lineHeight: "24px",
          color: "rgba(41, 28, 165, 1)",
          paddingInline: "8px",
        }}
      >
        Saved Resources
      </div>
      <div
        style={{
          paddingInline: "8px",
        }}
        className="relative"
      >
        <input
          placeholder="Search"
          style={{
            border: "rgba(212, 214, 216, 1)",
            height: "46px",
            borderRadius: "8px",
            background: "#fff",
            width: "100%",
            padding: "12px 30px 12px 12px",
          }}
          onChange={(e) => {
            setSearchText(e?.target?.value);
          }}
        />
        <MagnifyingGlass
          color="rgba(41, 28, 166, 1)"
          style={{
            position: "absolute",
            right: "20px",
            top: "0px",
            bottom: "0px",
            margin: "auto",
          }}
        />
      </div>
      <Scrollbars>
        <div
          className="flex flex-col"
          style={{
            rowGap: "16px",
            paddingInline: "8px",
          }}
        >
          {!chatHistory?.length ? (
            <div
              className="flex"
              style={{ justifyContent: "center" }}
            >{`No Notes Found`}</div>
          ) : (
            chatHistory?.map((note) => (
              <div
                className="flex flex-col"
                key={note?.noteId || note?.chatId}
                style={{
                  border: "1px solid rgba(206, 226, 232, 1)",
                  background:
                    "linear-gradient(253.23deg, #ECFBFF 0%, #F2F0FF 100%)",
                  borderRadius: "8px",
                  padding: "16px",
                  cursor: "pointer",
                }}
                onClick={() => {
                  const ele = document?.getElementById(
                    `assistant_historical_${note?.chatId ? note?.chatId : note?.id}`
                  );
                  if (ele) {
                    ele.scrollIntoView({ behavior: "smooth" });
                  }
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
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexGrow: 1,
                    }}
                  >
                    <div
                      className="flex"
                      style={{
                        columnGap: "12px",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          background: "rgba(244, 243, 255, 1)",
                          border: "1px solid rgba(225, 222, 255, 1)",
                          borderRadius: "6px",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          width: "32px",
                          height: "32px",
                        }}
                      >
                        <Note size={18} color="rgba(41, 28, 166, 1)" />
                      </div>
                      <div>Notes</div>
                    </div>

                    <div>
                      <Trash
                        style={{ cursor: "pointer" }}
                        color="rgba(255, 77, 79, 1)"
                        onClick={(e) => {
                          e?.stopPropagation();
                          setSavedNotes((v) => {
                            if (
                              v?.find(
                                (_v) =>
                                  (_v?.chatId || _v?.id) ===
                                  (note?.chatId || note?.id)
                              )
                            ) {
                              const found = v?.find(
                                (_v) =>
                                  (_v?.chatId || _v?.id) ===
                                  (note?.chatId || note?.id)
                              );
                              if (found?.noteId) {
                                deleteNote(found?.noteId);
                                showToast(
                                  `Note removed successfully`,
                                  "success",
                                  {
                                    clear: true,
                                  }
                                );
                              }
                              return v?.filter(
                                (_v) =>
                                  (_v?.chatId || _v?.id) !==
                                  (note?.chatId || note?.id)
                              );
                            }
                          });
                        }}
                      />
                    </div>
                  </div>
                  {/* <div>
                    <input type="checkbox" />
                  </div> */}
                </div>

                <div
                  className="flex"
                  style={{
                    fontSize: "14px",
                    lineHeight: "22px",
                  }}
                >
                  <StatusResponse
                    content={
                      note?.response
                        ? JSON.parse(note?.response)?.text
                        : note?.content
                    }
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </Scrollbars>
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
  const [searchText, setSearchText] = useState("");
  const _docs =
    workspace?.documents?.map((v) => {
      const meta = JSON.parse(v?.metadata);
      return meta?.title;
    }) || [];

  const docs = _docs?.filter((v) =>
    v?.toLowerCase()?.includes(searchText?.toLowerCase())
  );
  return (
    <div
      className="flex flex-col"
      style={{
        rowGap: "16px",
        flexGrow: 1,
      }}
    >
      <div
        style={{
          fontSize: "16px",
          fontWeight: 600,
          lineHeight: "24px",
          color: "rgba(41, 28, 165, 1)",
          paddingInline: "8px",
        }}
      >
        Documents
      </div>
      <div
        className="relative flex"
        style={{
          paddingInline: "8px",
        }}
      >
        <input
          placeholder="Search"
          style={{
            border: "rgba(212, 214, 216, 1)",
            height: "46px",
            borderRadius: "8px",
            background: "#fff",
            width: "100%",
            padding: "12px 30px 12px 12px",
          }}
          onChange={(e) => {
            setSearchText(e?.target?.value);
          }}
        />
        <MagnifyingGlass
          color="rgba(41, 28, 166, 1)"
          style={{
            position: "absolute",
            right: "20px",
            top: "0px",
            bottom: "0px",
            margin: "auto",
          }}
        />
      </div>

      <Scrollbars>
        <div
          className="flex flex-col"
          style={{
            rowGap: "12px",
            paddingInline: "8px",
          }}
        >
          {!docs?.length ? (
            <div
              className="flex"
              style={{
                justifyContent: "center",
              }}
            >
              No Documents Found
            </div>
          ) : (
            docs?.map((d, index) => {
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
                    background: "white",
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
            })
          )}
        </div>
      </Scrollbars>
    </div>
  );
}

function Podcasts({
  workspace,
  savePodcast,
  podcasts: _podcasts = [],
  setPodcasts = () => {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [questions, setQuestions] = useState([]);
  const questionsRef = useRef("");
  const podcastRef = useRef("");
  const [isPodcastCreating, setIsPodcastCreating] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [searchText, setSearchText] = useState("");
  const isLoading = useRef(true);

  const podcasts = _podcasts?.filter((p) =>
    (p?.title || p?.podcastName)
      ?.toLowerCase()
      ?.includes(searchText?.toLowerCase())
  );
  useEffect(() => {
    const documents = workspace?.documents?.map((v) => v?.metadata);
    isLoading.current = true;
    Workspace.streamChat(
      { ...workspace },
      `Suggest podcast topics less that 5 words from the uploaded documents. Find meta details: ${documents}`,
      (chatResult) => {
        if (chatResult?.type === "textResponseChunk") {
          questionsRef.current += chatResult?.textResponse;
        } else if (chatResult?.type === "finalizeResponseStream") {
          const _questions = getQuestions(questionsRef.current, 3);
          const cleanedQuestions = _questions.map((q) =>
            q.replace(/^\d+\.\s*/, "")
          ); // Remove leading numbers
          System.deleteChat(chatResult?.chatId);
          questionsRef.current = "";
          isLoading.current = false;
          setQuestions(cleanedQuestions);
        } else if (chatResult?.type === "abort") {
          setQuestions([]);
          isLoading.current = false;
          questionsRef.current = "";
          // System.deleteChat(chatResult?.chatId);
        }
      }
    );
  }, [workspace]);

  return (
    <div
      className="flex flex-col"
      style={{
        rowGap: "16px",
        flexGrow: 1,
      }}
    >
      <div
        style={{
          fontSize: "16px",
          fontWeight: 600,
          lineHeight: "24px",
          color: "rgba(41, 28, 165, 1)",
          justifyContent: "space-between",
          alignItems: "center",
          marginInline: "8px",
        }}
        className="flex"
      >
        <div>Saved Podcasts</div>
        <div
          style={{
            width: "32px",
            height: "32px",
            justifyContent: "center",
            alignItems: "center",
            display: "flex",
            borderRadius: "6px",
            backgroundColor: "rgba(0, 165, 212, 1)",
            color: "white",
            fontSize: "16px",
            marginRight: "26px",
            cursor: "pointer",
          }}
          onClick={() => {
            setIsOpen(true);
          }}
        >
          <span
            style={{
              marginBottom: "5px",
            }}
          >
            +
          </span>
        </div>
      </div>
      <ModalWrapper isOpen={isOpen}>
        <div
          className="flex flex-col"
          style={{
            backgroundColor: "white",
            width: "1000px",
            // minHeight: "300px",
            borderRadius: "8px",
            padding: "24px",
            rowGap: "24px",
          }}
        >
          <div
            className="flex"
            style={{
              fontSize: "16px",
              fontWeight: 600,
              lineHeight: "24px",
              color: "rgba(41, 28, 165, 1)",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Suggest the topic</span>
            <span
              style={{
                cursor: "pointer",
                ...(isPodcastCreating && {
                  pointerEvents: "none",
                  opacity: 0.7,
                }),
              }}
              onClick={() => {
                setSelectedTopic("");
                setIsOpen(false);
              }}
            >
              <Cross />
            </span>
          </div>
          <div
            style={{
              flexGrow: 1,
              justifyContent: "space-between",
              rowGap: "24px",
            }}
            className="flex flex-col"
          >
            <div
              style={{
                flexWrap: "nowrap",
                display: isLoading?.current ? "block" : "flex",
                columnGap: "16px",
              }}
            >
              {isLoading?.current ? (
                <Skeleton count={4} />
              ) : (
                questions?.map((q, index) => (
                  <div
                    key={q?.id || index}
                    style={{
                      background:
                        "linear-gradient(84.14deg, #F2F0FF 0%, #ECFBFF 100%)",
                      border: "1px solid rgba(206, 226, 232, 1)",
                      borderRadius: "8px",
                      padding: "16px",
                      cursor: "pointer",
                      alignItems: "flex-start",
                      columnGap: "8px",
                      flex: "0 1 33.3%",
                      display: "flex",
                      height: "auto",
                    }}
                    onClick={() => {
                      // sendMessage(q);
                      setSelectedTopic(q);
                    }}
                    className="flex"
                  >
                    <div>
                      <ListPlus size={18} color="rgba(41, 28, 166, 1)" />
                    </div>
                    <div>{q}</div>
                  </div>
                ))
              )}
            </div>

            <div>
              <input
                style={{
                  padding: "16px",
                  border: "1px solid rgba(206, 226, 232, 1)",
                  borderRadius: "8px",
                  width: "100%",
                }}
                value={selectedTopic}
                onChange={(e) => {
                  setSelectedTopic(e?.target?.value);
                }}
                placeholder="Enter your topic here"
              />
            </div>
          </div>
          <div className="flex">
            <div
              className="flex"
              style={{
                columnGap: "8px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => {
                  setSelectedTopic("");
                  setIsOpen(false);
                }}
                className="flex"
                style={{
                  height: "32px",
                  justifyContent: "center",
                  alignItems: "center",
                  borderRadius: "8px",
                  border: "1px solid rgba(206, 226, 232, 1)",
                  paddingInline: "16px",
                  fontSize: "14px",
                }}
                disabled={isPodcastCreating}
              >
                Cancel
              </button>
              <button
                style={{
                  height: "32px",
                  justifyContent: "center",
                  alignItems: "center",
                  borderRadius: "8px",
                  paddingInline: "16px",
                  color: "white",
                  fontSize: "14px",
                  background:
                    "linear-gradient(90deg, #291CA6 0%, #00A5D4 100%)",
                  ...((!selectedTopic || isPodcastCreating) && {
                    opacity: 0.7,
                    pointerEvents: "none",
                  }),
                }}
                className="flex"
                onClick={() => {
                  setIsPodcastCreating(true);
                  Workspace.streamChat(
                    { ...workspace },
                    `Provide Podcast script on ${selectedTopic} without titles and placeholders.`,
                    (chatResult) => {
                      if (chatResult?.type === "textResponseChunk") {
                        podcastRef.current += chatResult?.textResponse;
                      } else if (
                        chatResult?.type === "finalizeResponseStream"
                      ) {
                        setPodcasts((p) => [
                          {
                            content: podcastRef.current,
                            title: selectedTopic,
                            id: Date?.now(),
                          },
                          ...p,
                        ]);
                        savePodcast(
                          {
                            content: podcastRef.current,
                            title: selectedTopic,
                          },
                          workspace
                        );
                        setSelectedTopic("");
                        setIsPodcastCreating(false);
                        setIsOpen(false);
                        showToast(`Podcast created successfully`, "success", {
                          clear: true,
                        });
                        System.deleteChat(chatResult?.chatId);
                        podcastRef.current = "";
                      } else if (chatResult?.type === "abort") {
                        podcastRef.current = "";
                        setIsPodcastCreating(false);
                        setSelectedTopic("");
                        setIsOpen(false);
                      }
                    }
                  );
                }}
              >
                {isPodcastCreating ? "Creating..." : "Done"}
              </button>
            </div>
          </div>
        </div>
      </ModalWrapper>
      <div
        className="relative flex"
        style={{
          paddingInline: "8px",
        }}
      >
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
          onChange={(e) => {
            setSearchText(e?.target?.value);
          }}
        />
        <MagnifyingGlass
          color="rgba(41, 28, 166, 1)"
          style={{
            position: "absolute",
            right: "20px",
            top: "0px",
            bottom: "0px",
            margin: "auto",
          }}
        />
      </div>

      <Scrollbars>
        <div
          className="flex flex-col"
          style={{
            rowGap: "16px",
            paddingInline: "8px",
          }}
        >
          {!podcasts?.length ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
              }}
            >
              No Podcasts Found
            </div>
          ) : (
            podcasts?.map((podcast) => (
              <div
                className="flex flex-col"
                key={podcast?.id}
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
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexGrow: 1,
                    }}
                  >
                    <div
                      className="flex"
                      style={{
                        columnGap: "12px",
                        alignItems: "flex-start",
                      }}
                    >
                      <div
                        style={{
                          background: "rgba(244, 243, 255, 1)",
                          border: "1px solid rgba(225, 222, 255, 1)",
                          width: "32px",
                          minWidth: "32px",
                          height: "32px",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          borderRadius: "6px",
                        }}
                      >
                        <SpeakerSimpleHigh />
                      </div>
                      <div
                        style={{
                          lineHeight: "32px",
                          display: "flex",
                          alignItems: "center",
                          minHeight: "32px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "14px",
                            lineHeight: "18px",
                            fontWeight: 600,
                          }}
                        >
                          {podcast?.title || podcast?.podcastName}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        cursor: "pointer",
                      }}
                      onClick={(e) => {
                        e?.stopPropagation();
                        setPodcasts((p) => {
                          const filtered = p?.filter(
                            (v) => v?.id !== podcast?.id
                          );
                          Workspace?.deletePodcast(podcast?.id);
                          showToast(`Podcast deleted successfully`, "success", {
                            clear: true,
                          });
                          return filtered;
                        });
                      }}
                    >
                      <Trash color="rgba(255, 77, 79, 1)" />
                    </div>
                  </div>
                  {/* <div>
                  <input type="checkbox" />
                </div> */}
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
                    alignItems: "center",
                    columnGap: "12px",
                  }}
                  className="flex"
                >
                  <div
                    className="flex"
                    style={{
                      fontSize: "14px",
                      lineHeight: "22px",
                      width: "36px",
                      minWidth: "36px",
                      height: "36px",
                      background:
                        "linear-gradient(270.8deg, #00A5D4 0.74%, #291FA7 99.39%)",
                      borderRadius: "50%",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                    }}
                  >
                    <TTSMessage
                      playIcon={
                        <Play
                          color="white"
                          weight="fill"
                          style={{ marginTop: "-18px" }}
                        />
                      }
                      pauseIcon={
                        <Pause
                          color="white"
                          weight="fill"
                          style={{ marginTop: "-18px" }}
                        />
                      }
                      isTooltipDisabled
                      message={podcast?.content}
                    />
                  </div>
                  <span>Tap to listen to your podcast</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Scrollbars>
    </div>
  );
}

function StatusResponse({ content, error, isShowMoreHide }) {
  if (isShowMoreHide) {
    return (
      <div
        style={{ wordBreak: "break-word" }}
        className={`flex markdown flex-col ${error ? "bg-red-200" : {}}`}
      >
        <div className="flex gap-x-5">
          <span
            className={`reply whitespace-pre-line font-normal text-sm md:text-sm flex flex-col gap-y-1`}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        </div>
      </div>
    );
  }
  return (
    <div
      style={{ wordBreak: "break-word" }}
      className={`flex markdown flex-col ${error ? "bg-red-200" : {}}`}
    >
      <div className="flex gap-x-5">
        <span
          className={`reply whitespace-pre-line font-normal text-sm md:text-sm flex flex-col gap-y-1`}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content?.slice(0, 150)) }}
        />
      </div>
    </div>
  );
}
