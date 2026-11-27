// Independent deployment adapter; never trusts Sites authentication headers.
export { getOwnerUser as getChatGPTUser, requireOwnerUser as requireChatGPTUser, ownerSignInPath as chatGPTSignInPath, ownerSignOutPath as chatGPTSignOutPath } from "./owner-auth";
