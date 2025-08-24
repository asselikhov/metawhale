/**
 * Session Manager
 * Manages user session states for the Telegram bot
 */

// Simple session storage for user states
const userSessions = new Map();

class SessionManager {
  // Get or create user session
  getUserSession(chatId) {
    if (!userSessions.has(chatId)) {
      console.log(`🆕 Creating new session for user ${chatId}`);
      userSessions.set(chatId, {});
    } else {
      console.log(`🔄 Using existing session for user ${chatId}`);
    }
    return userSessions.get(chatId);
  }

  // Clear user session
  clearUserSession(chatId) {
    console.log(`🗑 Clearing session for user ${chatId}`);
    userSessions.delete(chatId);
  }

  // Set session data
  setSessionData(chatId, key, value) {
    const session = this.getUserSession(chatId);
    console.log(`💾 Setting session data for user ${chatId}: ${key} = ${JSON.stringify(value)}`);
    session[key] = value;
  }

  // Get session data
  getSessionData(chatId, key) {
    const session = this.getUserSession(chatId);
    const value = session[key];
    console.log(`🔍 Getting session data for user ${chatId}: ${key} = ${JSON.stringify(value)}`);
    return value;
  }

  // Check if user is in a specific state
  isUserInState(chatId, stateKey) {
    return !!this.getSessionData(chatId, stateKey);
  }

  // Get user state type
  getUserState(chatId) {
    const session = this.getUserSession(chatId);
    
    if (session.awaitingTransfer) return 'transfer';
    if (session.awaitingP2POrder) return 'p2p_order';
    if (session.awaitingUserMessage) return 'user_message';
    
    return 'idle';
  }

  // Set user in transfer state
  setTransferState(chatId, transferType) {
    this.setSessionData(chatId, 'awaitingTransfer', true);
    this.setSessionData(chatId, 'transferType', transferType);
  }

  // Set user in P2P order state
  setP2POrderState(chatId, orderType, targetUserId = null) {
    this.setSessionData(chatId, 'awaitingP2POrder', true);
    this.setSessionData(chatId, 'p2pOrderType', orderType);
    if (targetUserId) {
      this.setSessionData(chatId, 'targetUserId', targetUserId);
    }
  }

  // Set user in messaging state
  setUserMessageState(chatId, targetUserId) {
    this.setSessionData(chatId, 'awaitingUserMessage', true);
    this.setSessionData(chatId, 'targetUserId', targetUserId);
  }

  // Get pending transfer data
  getPendingTransfer(chatId) {
    return this.getSessionData(chatId, 'pendingTransfer');
  }

  // Set pending transfer data
  setPendingTransfer(chatId, transferData) {
    this.setSessionData(chatId, 'pendingTransfer', transferData);
  }

  // Get pending P2P order data
  getPendingP2POrder(chatId) {
    return this.getSessionData(chatId, 'pendingP2POrder');
  }

  // Set pending P2P order data
  setPendingP2POrder(chatId, orderData) {
    this.setSessionData(chatId, 'pendingP2POrder', orderData);
  }
}

module.exports = new SessionManager();