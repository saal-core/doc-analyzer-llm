import React, { memo, useState } from "react";
import useCopyText from "@/hooks/useCopyText";
import {
  Check,
  ThumbsUp,
  ThumbsDown,
  ArrowsClockwise,
  Copy,
} from "@phosphor-icons/react";
import { Tooltip } from "react-tooltip";
import Workspace from "@/models/workspace";
import TTSMessage from "./TTSButton";
import { PushPin } from "@phosphor-icons/react";
import { EditMessageAction } from "./EditMessage";

const Actions = ({
  message,
  feedbackScore,
  chatId,
  slug,
  isLastMessage,
  regenerateMessage,
  isEditing,
  role,
  savedNotes = [],
  onSaveNote = () => {},
  isSaveToNotes = false,
}) => {
  const [selectedFeedback, setSelectedFeedback] = useState(feedbackScore);
  const handleFeedback = async (newFeedback) => {
    const updatedFeedback =
      selectedFeedback === newFeedback ? null : newFeedback;
    await Workspace.updateChatFeedback(chatId, slug, updatedFeedback);
    setSelectedFeedback(updatedFeedback);
  };
  console.log("role>>>>", role, savedNotes);
  return (
    <div className="flex w-full justify-between items-center">
      <div className="flex justify-start items-center gap-x-4">
        <CopyMessage message={message} />
        <EditMessageAction chatId={chatId} role={role} isEditing={isEditing} />
        {isLastMessage && !isEditing && (
          <RegenerateMessage
            regenerateMessage={regenerateMessage}
            slug={slug}
            chatId={chatId}
          />
        )}
        {chatId && role !== "user" && !isEditing && (
          <>
            <FeedbackButton
              isSelected={selectedFeedback === true}
              handleFeedback={() => handleFeedback(true)}
              tooltipId={`${chatId}-thumbs-up`}
              tooltipContent="Good response"
              IconComponent={ThumbsUp}
            />
            <FeedbackButton
              isSelected={selectedFeedback === false}
              handleFeedback={() => handleFeedback(false)}
              tooltipId={`${chatId}-thumbs-down`}
              tooltipContent="Bad response"
              IconComponent={ThumbsDown}
            />
          </>
        )}
      </div>
      <div className="flex" style={{ alignItems: "center", columnGap: "12px" }}>
        <TTSMessage slug={slug} chatId={chatId} message={message} />
        {isSaveToNotes && role === "assistant" && (
          <div
            style={{
              fontSize: "14px",
              background: "rgba(228, 245, 254, 1)",
              border: "1px solid rgba(145, 216, 237, 1)",
              borderRadius: "50px",
              paddingInline: "16px",
              height: "32px",
              alignItems: "center",
              justifyContent: "center",
              columnGap: "8px",
              cursor: "pointer",
              ...(!!savedNotes?.find(
                (v) => (v?.chatId || v?.id) === chatId
              ) && {
                color: "rgba(41, 28, 166, 1)",
                opacity: 0.7,
                pointerEvents: "none",
              }),
            }}
            onClick={() => {
              onSaveNote({ role, chatId, content: message, slug });
            }}
            className="flex"
          >
            <PushPin
              weight={
                savedNotes?.find((v) => (v?.chatId || v?.id) === chatId)
                  ? "fill"
                  : "regular"
              }
            />
            Save to note
          </div>
        )}
      </div>
    </div>
  );
};

function FeedbackButton({
  isSelected,
  handleFeedback,
  tooltipId,
  tooltipContent,
  IconComponent,
}) {
  return (
    <div className="mt-3 relative">
      <button
        onClick={handleFeedback}
        data-tooltip-id={tooltipId}
        data-tooltip-content={tooltipContent}
        className="text-zinc-300"
        aria-label={tooltipContent}
      >
        <IconComponent
          size={18}
          className="mb-1"
          weight={isSelected ? "fill" : "regular"}
        />
      </button>
      <Tooltip
        id={tooltipId}
        place="bottom"
        delayShow={300}
        className="tooltip !text-xs"
      />
    </div>
  );
}

function CopyMessage({ message }) {
  const { copied, copyText } = useCopyText();

  return (
    <>
      <div className="mt-3 relative">
        <button
          onClick={() => copyText(message)}
          data-tooltip-id="copy-assistant-text"
          data-tooltip-content="Copy"
          className="text-zinc-300"
          aria-label="Copy"
        >
          {copied ? (
            <Check size={18} className="mb-1" />
          ) : (
            <Copy size={18} className="mb-1" />
          )}
        </button>
        <Tooltip
          id="copy-assistant-text"
          place="bottom"
          delayShow={300}
          className="tooltip !text-xs"
        />
      </div>
    </>
  );
}

function RegenerateMessage({ regenerateMessage, chatId }) {
  if (!chatId) return null;
  return (
    <div className="mt-3 relative">
      <button
        onClick={() => regenerateMessage(chatId)}
        data-tooltip-id="regenerate-assistant-text"
        data-tooltip-content="Regenerate response"
        className="border-none text-zinc-300"
        aria-label="Regenerate"
      >
        <ArrowsClockwise size={18} className="mb-1" weight="fill" />
      </button>
      <Tooltip
        id="regenerate-assistant-text"
        place="bottom"
        delayShow={300}
        className="tooltip !text-xs"
      />
    </div>
  );
}

export default memo(Actions);
