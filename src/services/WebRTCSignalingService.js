import {
  collection,
  doc,
  addDoc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase.js";

class WebRTCSignalingService {
  constructor() {
    this.localConnection = null;
    this.remoteConnection = null;
    this.callDoc = null;
    this.unsubscribeCallDoc = null;
    this.unsubscribeAnswerCandidates = null;
    this.unsubscribeOfferCandidates = null;
    this.onConnectionStateChange = null;
    this.onDataChannelMessage = null;
    this.onDataChannelOpen = null; // Callback for when data channel opens
    this.dataChannel = null;

    // Reconnection state
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.reconnectDelay = 2000; // Start with 2 seconds
    this.isReconnecting = false;
    this.lastCallId = null;
    this.lastRole = null; // 'initiator' or 'receiver'
    this.reconnectTimeout = null;
    this.heartbeatInterval = null;
    this.heartbeatTimeoutChecker = null;
    this.lastHeartbeatReceived = Date.now();
    this.connectionLossTimeout = null; // Debounce multiple connection loss events
    this.reconnectionTimeout = null; // Timeout for reconnection attempts
    this.gracefulDisconnectReceived = false;
    this.hasEverConnected = false; // Track if we've ever successfully connected
    this.wasDisconnected = false; // Track if we were disconnected (for recovery sync)

    // Latency measurement
    this.pendingPings = new Map(); // Store ping timestamps for latency calculation
  }

  // Fetch TURN credentials from API
  async fetchTurnCredentials() {
    try {
      const response = await fetch("/api/turn-credentials");
      if (!response.ok) {
        console.error("Failed to fetch TURN credentials:", response.status);
        return null;
      }
      const data = await response.json();
      return data.iceServers;
    } catch (error) {
      console.error("Error fetching TURN credentials:", error);
      return null;
    }
  }

  // Initialize WebRTC peer connection
  async initializePeerConnection() {
    // Fetch Cloudflare TURN credentials
    const turnIceServers = await this.fetchTurnCredentials();

    const configuration = {
      iceServers: [
        // Google STUN servers as fallback
        {
          urls: [
            "stun:stun1.l.google.com:19302",
            "stun:stun2.l.google.com:19302",
          ],
        },
        // Add Cloudflare TURN servers if credentials were fetched successfully
        ...(turnIceServers || []),
      ],
      iceCandidatePoolSize: 10,
    };

    this.localConnection = new RTCPeerConnection(configuration);

    // Create data channel for game state exchange
    // Both sides create it, but only one will actually be used (the one from ondatachannel)
    this.dataChannel = this.localConnection.createDataChannel("gameState", {
      ordered: true,
      // Note: NOT using maxRetransmits - this gives us reliable delivery
    });
    this.setupDataChannelHandlers(this.dataChannel);
    console.log(
      "[SYNC DEBUG] Created local data channel, role:",
      this.lastRole
    );

    // Handle remote data channel - CRITICAL: this is how we receive the peer's channel
    // The received channel replaces our local one to ensure both sides use the same channel
    this.localConnection.ondatachannel = (event) => {
      console.log(
        "[SYNC DEBUG] Remote data channel received, label:",
        event.channel.label,
        "role:",
        this.lastRole
      );

      // Replace our data channel with the received one
      // This ensures both sides are using the same channel object
      const receiveChannel = event.channel;
      this.dataChannel = receiveChannel;
      this.setupDataChannelHandlers(receiveChannel);
      console.log("[SYNC DEBUG] Now using received data channel");
    };

    // Handle ICE connection state changes
    this.localConnection.onconnectionstatechange = () => {
      console.log("Connection state:", this.localConnection.connectionState);

      // Track disconnection for recovery detection
      if (this.localConnection.connectionState === "disconnected") {
        console.log(
          "[SYNC DEBUG] Connection disconnected - marking wasDisconnected=true"
        );
        this.wasDisconnected = true;
      }

      // Handle successful reconnection
      if (
        this.localConnection.connectionState === "connected" &&
        this.isReconnecting
      ) {
        console.log("Reconnection successful!");

        // Clear reconnection timeout
        if (this.reconnectionTimeout) {
          clearTimeout(this.reconnectionTimeout);
          this.reconnectionTimeout = null;
        }

        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        this.wasDisconnected = false;

        // Notify successful reconnection
        if (this.onConnectionStateChange) {
          this.onConnectionStateChange("reconnection-successful");
        }

        // Only guest should request game state sync after reconnection
        // Host is the authoritative source
        if (this.lastRole === "receiver") {
          setTimeout(() => {
            console.log("Guest requesting game state sync after reconnection");
            this.requestGameStateSync();
          }, 1500);
        } else {
          console.log("Host reconnected - waiting for guest to request sync");
        }
      }

      // Also handle recovery from brief disconnect (not full reconnection)
      // This catches cases where connection drops briefly and recovers on its own
      // Only request sync if we were disconnected (not on initial connection)
      if (
        this.localConnection.connectionState === "connected" &&
        !this.isReconnecting &&
        this.wasDisconnected &&
        this.lastRole === "receiver"
      ) {
        console.log(
          "[SYNC DEBUG] Connection recovered from brief disconnect - guest will request sync"
        );
        this.wasDisconnected = false;
        // Small delay to let things stabilize
        setTimeout(() => {
          if (this.dataChannel && this.dataChannel.readyState === "open") {
            console.log(
              "[SYNC DEBUG] Guest requesting sync after brief disconnect recovery"
            );
            this.requestGameStateSync();
          }
        }, 500);
      }

      // Track that we've connected (for distinguishing initial connect vs recovery)
      if (this.localConnection.connectionState === "connected") {
        this.hasEverConnected = true;
      }

      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(this.localConnection.connectionState);
      }
    };

    // Monitor ICE connection state for reconnection logic
    this.localConnection.oniceconnectionstatechange = () => {
      // console.log('ICE connection state:', this.localConnection.iceConnectionState);

      // Handle ICE connection failures with debouncing
      if (this.localConnection.iceConnectionState === "failed") {
        // console.log('ICE connection failed - scheduling reconnection');
        if (!this.gracefulDisconnectReceived) {
          this.scheduleConnectionLossHandler();
        }
      } else if (this.localConnection.iceConnectionState === "disconnected") {
        // console.log('ICE connection disconnected - will check if this persists');
        // Give it a moment to see if it recovers
        setTimeout(() => {
          if (
            this.localConnection &&
            this.localConnection.iceConnectionState === "disconnected" &&
            !this.gracefulDisconnectReceived
          ) {
            // console.log('ICE connection still disconnected - scheduling reconnection');
            this.scheduleConnectionLossHandler();
          }
        }, 5000); // Wait 5 seconds before treating as persistent disconnection
      } else if (
        this.localConnection.iceConnectionState === "connected" ||
        this.localConnection.iceConnectionState === "completed"
      ) {
        console.log(
          "[SYNC DEBUG] ICE connection established/completed - checking data channel state:",
          {
            hasDataChannel: !!this.dataChannel,
            dataChannelState: this.dataChannel?.readyState,
            dataChannelLabel: this.dataChannel?.label,
            role: this.lastRole,
          }
        );
        // Don't cancel pending reconnections - let scheduleConnectionLossHandler decide
        // Update heartbeat timestamp to reflect good connection
        this.lastHeartbeatReceived = Date.now();

        // If we just recovered, only the receiver/guest should request game state sync
        // The host is the authoritative source of game state
        if (
          this.dataChannel &&
          this.dataChannel.readyState === "open" &&
          this.lastRole === "receiver"
        ) {
          setTimeout(() => {
            console.log(
              "[SYNC DEBUG] Connection recovered - guest requesting game state sync from host, dataChannel state:",
              this.dataChannel?.readyState
            );
            this.requestGameStateSync();
          }, 1000); // Small delay to ensure connection is stable
        } else if (this.lastRole === "initiator") {
          console.log(
            "[SYNC DEBUG] Connection recovered - host waiting for sync request from guest"
          );
        }
      }
    };

    return this.localConnection;
  }

  // Set up data channel event handlers
  setupDataChannelHandlers(channel) {
    // Store reference for debugging
    const channelRef = channel;

    channel.onopen = () => {
      console.log(
        "[SYNC DEBUG] Data channel opened, label:",
        channel.label,
        "role:",
        this.lastRole,
        "channelId:",
        channel.id,
        "ordered:",
        channel.ordered,
        "maxRetransmits:",
        channel.maxRetransmits,
        "binaryType:",
        channel.binaryType
      );
      // Notify that data channel is ready
      if (this.onDataChannelOpen) {
        console.log("[SYNC DEBUG] Calling onDataChannelOpen callback");
        this.onDataChannelOpen();
      } else {
        console.log("[SYNC DEBUG] No onDataChannelOpen callback set");
      }

      // Start a debug interval to monitor data channel state
      if (!this._debugInterval) {
        this._debugInterval = setInterval(() => {
          console.log("[SYNC DEBUG] Channel health check:", {
            thisDataChannel: this.dataChannel?.readyState,
            thisDataChannelLabel: this.dataChannel?.label,
            channelRefState: channelRef?.readyState,
            areSame: this.dataChannel === channelRef,
            role: this.lastRole,
          });
        }, 10000); // Every 10 seconds
      }
    };

    channel.onclose = () => {
      console.log(
        "[SYNC DEBUG] Data channel closed, label:",
        channel.label,
        "role:",
        this.lastRole
      );
      if (this._debugInterval) {
        clearInterval(this._debugInterval);
        this._debugInterval = null;
      }
    };

    channel.onerror = (error) => {
      console.error(
        "[SYNC DEBUG] Data channel ERROR:",
        error,
        "label:",
        channel.label,
        "role:",
        this.lastRole
      );
    };

    channel.onmessage = (event) => {
      // IMMEDIATE log before any processing - this MUST appear if message arrives
      console.log(
        "[SYNC DEBUG RAW] Message received! Size:",
        event.data.length,
        "bytes at",
        Date.now()
      );

      const receiveTimestamp = Date.now();
      const message = JSON.parse(event.data);

      console.log("[SYNC DEBUG] WebRTC onmessage received:", {
        type: message.type,
        hasData: !!message.data,
        dataType: message.data?.type,
        dataSize: event.data.length,
      });

      // Log latency for game state and move messages
      if (
        message.timestamp &&
        (message.type === "gameState" || message.type === "move")
      ) {
        const latency = receiveTimestamp - message.timestamp;
        console.log(
          `[WebRTC Latency] ${message.type} received - Latency: ${latency}ms (sent: ${message.timestamp}, received: ${receiveTimestamp})`
        );
      }

      // Update heartbeat timestamp for ANY message received (indicates connection is alive)
      this.lastHeartbeatReceived = Date.now();

      // Handle heartbeat messages
      if (message.type === "heartbeat") {
        // console.log('Heartbeat received, sending response');
        // Send heartbeat response
        this.sendHeartbeatResponse();
      } else if (message.type === "heartbeatResponse") {
        // console.log('Heartbeat response received');
      } else if (message.type === "ping") {
        // Handle latency measurement ping - send pong back immediately
        this.sendPong(message.pingId);
      } else if (message.type === "pong") {
        // Handle latency measurement pong - calculate latency and forward result
        this.handlePongReceived(message.pingId);
      } else if (
        message.type === "disconnect" &&
        message.data?.type === "gracefulDisconnect"
      ) {
        // console.log('Received graceful disconnect notification from peer');
        // Set flag to prevent reconnection attempts
        this.gracefulDisconnectReceived = true;
        // Stop heartbeat and reconnection attempts
        this.stopHeartbeat();
        this.isReconnecting = false;
        // Clear any pending timeouts
        if (this.connectionLossTimeout) {
          clearTimeout(this.connectionLossTimeout);
          this.connectionLossTimeout = null;
        }
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
        // Forward the message to the app
        if (this.onDataChannelMessage) {
          this.onDataChannelMessage(message);
        }
        // Notify the connection state callback about graceful disconnect
        if (this.onConnectionStateChange) {
          this.onConnectionStateChange("graceful-disconnect");
        }
      } else if (message.type === "requestGameStateSync") {
        // console.log('Peer requested game state sync');
        // Forward this request to the application layer
        if (this.onDataChannelMessage) {
          this.onDataChannelMessage(message);
        }
      } else if (this.onDataChannelMessage) {
        console.log(
          "[SYNC DEBUG] Forwarding message to app callback:",
          message.type
        );
        this.onDataChannelMessage(message);
      } else {
        console.log(
          "[SYNC DEBUG] WARNING: No onDataChannelMessage callback set! Message type:",
          message.type
        );
      }
    };

    channel.onerror = (error) => {
      console.error("Data channel error:", error);
      // Update heartbeat to prevent false positive timeouts after error
      this.lastHeartbeatReceived = Date.now();
      // Only log unexpected errors, not normal close operations
      if (
        error.error &&
        error.error.message !== "User-Initiated Abort, reason=Close called"
      ) {
        // console.log('Data channel closed normally');
      }
    };
  }

  // Create a new call (initiator)
  async createCall() {
    try {
      this.lastRole = "initiator";

      const callsCollection = collection(db, "calls");
      this.callDoc = doc(callsCollection);

      const offerCandidates = collection(this.callDoc, "offerCandidates");
      const answerCandidates = collection(this.callDoc, "answerCandidates");

      // Initialize peer connection
      const pc = await this.initializePeerConnection();

      // Collect ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(offerCandidates, event.candidate.toJSON());
        }
      };

      // Create offer
      const offerDescription = await pc.createOffer();
      await pc.setLocalDescription(offerDescription);

      const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
      };

      // Save call document with offer
      await setDoc(this.callDoc, {
        offer,
        createdAt: serverTimestamp(),
        status: "waiting",
      });

      // Listen for remote answer
      this.unsubscribeCallDoc = onSnapshot(this.callDoc, (snapshot) => {
        const data = snapshot.data();
        if (!pc.currentRemoteDescription && data?.answer) {
          const answerDescription = new RTCSessionDescription(data.answer);
          pc.setRemoteDescription(answerDescription);
        }
      });

      // Listen for remote ICE candidates
      this.unsubscribeAnswerCandidates = onSnapshot(
        answerCandidates,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const candidate = new RTCIceCandidate(change.doc.data());
              // Add error handling to prevent crashes when adding to closed connection
              if (pc.signalingState !== "closed") {
                pc.addIceCandidate(candidate).catch((err) => {
                  // console.log('Error adding ICE candidate:', err.message);
                });
              } else {
                // console.log('Skipping ICE candidate - connection is closed');
              }
            }
          });
        }
      );

      this.lastCallId = this.callDoc.id;
      this.startHeartbeat();
      return this.callDoc.id;
    } catch (error) {
      // console.error('Error creating call:', error);
      throw error;
    }
  }

  // Join an existing call (receiver)
  async joinCall(callId) {
    try {
      this.lastRole = "receiver";
      this.lastCallId = callId;

      this.callDoc = doc(db, "calls", callId);

      const offerCandidates = collection(this.callDoc, "offerCandidates");
      const answerCandidates = collection(this.callDoc, "answerCandidates");

      // Initialize peer connection
      const pc = await this.initializePeerConnection();

      // Collect ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(answerCandidates, event.candidate.toJSON());
        }
      };

      // Get call document
      const callSnapshot = await getDoc(this.callDoc);
      if (!callSnapshot.exists()) {
        throw new Error("Call not found");
      }

      const callData = callSnapshot.data();
      if (!callData.offer) {
        throw new Error("No offer found in call");
      }

      // Set remote description from offer
      const offerDescription = new RTCSessionDescription(callData.offer);
      await pc.setRemoteDescription(offerDescription);

      // Create answer
      const answerDescription = await pc.createAnswer();
      await pc.setLocalDescription(answerDescription);

      const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
      };

      // Update call document with answer
      await updateDoc(this.callDoc, {
        answer,
        status: "connected",
      });

      // Listen for remote ICE candidates
      this.unsubscribeOfferCandidates = onSnapshot(
        offerCandidates,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const candidate = new RTCIceCandidate(change.doc.data());
              // Add error handling to prevent crashes when adding to closed connection
              if (pc.signalingState !== "closed") {
                pc.addIceCandidate(candidate).catch((err) => {
                  // console.log('Error adding ICE candidate:', err.message);
                });
              } else {
                console.log("Skipping ICE candidate - connection is closed");
              }
            }
          });
        }
      );

      this.startHeartbeat();
      return true;
    } catch (error) {
      console.error("Error joining call:", error);
      throw error;
    }
  }

  // Schedule connection loss handling with debouncing
  scheduleConnectionLossHandler() {
    // Clear any existing timeout
    if (this.connectionLossTimeout) {
      clearTimeout(this.connectionLossTimeout);
    }

    // Schedule new timeout - simplified validation
    this.connectionLossTimeout = setTimeout(() => {
      // Check actual connection states, not just heartbeat timing
      const iceState = this.localConnection?.iceConnectionState;
      const connectionState = this.localConnection?.connectionState;

      // Proceed with reconnection if connection is genuinely broken
      const shouldReconnect =
        iceState === "failed" ||
        iceState === "disconnected" ||
        connectionState === "failed" ||
        connectionState === "disconnected";

      if (shouldReconnect) {
        // console.log('Connection loss confirmed - initiating reconnection');
        this.handleConnectionLoss();
      } else {
        // console.log('Connection recovered - cancelling reconnection attempt');
        // Only guest should request game state sync after recovery
        if (
          this.dataChannel &&
          this.dataChannel.readyState === "open" &&
          this.lastRole === "receiver"
        ) {
          // console.log('Guest requesting sync after recovery');
          this.requestGameStateSync();
        } else if (this.lastRole === "initiator") {
          // console.log('Host recovered - no sync request needed');
        }
      }
    }, 2000); // 2 second debounce
  } // Handle connection loss and attempt reconnection
  async handleConnectionLoss() {
    // Clear the debounce timeout
    if (this.connectionLossTimeout) {
      clearTimeout(this.connectionLossTimeout);
      this.connectionLossTimeout = null;
    }

    // Don't attempt reconnection if we received a graceful disconnect
    if (this.gracefulDisconnectReceived) {
      // console.log('Graceful disconnect received - not attempting reconnection');
      return;
    }

    if (this.isReconnecting) {
      // console.log('Already reconnecting, ignoring additional connection loss');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // console.log('Max reconnection attempts reached');
      this.notifyReconnectionFailed();
      return;
    }

    // Don't attempt reconnection if we're manually disconnecting
    if (!this.lastCallId || !this.lastRole) {
      // console.log('No call to reconnect to');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    // console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    // Notify that we're attempting to reconnect
    if (this.onConnectionStateChange) {
      this.onConnectionStateChange("reconnecting");
    }

    try {
      // Stop heartbeat to prevent interference
      this.stopHeartbeat();

      // Wait before attempting to reconnect (progressive delay)
      const delay = Math.min(
        this.reconnectDelay * this.reconnectAttempts,
        10000
      );
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Clean up old connection without deleting Firestore docs
      await this.cleanupConnectionForReconnect();

      // Attempt to recreate the connection
      if (this.lastRole === "initiator") {
        await this.recreateCall();
      } else if (this.lastRole === "receiver" && this.lastCallId) {
        await this.rejoinCall(this.lastCallId);
      }

      // If we get here, reconnection was initiated successfully
      // Wait for connection to be fully established before declaring success
      // console.log('Reconnection initiated, waiting for connection establishment...');

      // Set a timeout in case reconnection takes too long
      this.reconnectionTimeout = setTimeout(() => {
        if (
          this.isReconnecting &&
          this.localConnection?.connectionState !== "connected"
        ) {
          // console.log('Reconnection timeout - connection not established in time');
          this.isReconnecting = false;

          // Try again if we haven't exceeded max attempts
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            // console.log('Will retry reconnection');
            this.handleConnectionLoss();
          } else {
            // console.log('Max reconnection attempts reached');
            this.notifyReconnectionFailed();
          }
        }
      }, 20000); // 20 second timeout for reconnection

      // The actual success will be determined by the connection state callback
      // which will detect when connectionState becomes 'connected'
    } catch (error) {
      console.error("Reconnection attempt failed:", error);
      this.isReconnecting = false;

      // Clear reconnection timeout on error
      if (this.reconnectionTimeout) {
        clearTimeout(this.reconnectionTimeout);
        this.reconnectionTimeout = null;
      }

      // Try again if we haven't exceeded max attempts
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        // console.log(`Will retry in ${this.reconnectDelay}ms`);
        this.reconnectTimeout = setTimeout(
          () => this.handleConnectionLoss(),
          this.reconnectDelay
        );
      } else {
        this.notifyReconnectionFailed();
      }
    }
  } // Recreate call for initiator
  async recreateCall() {
    // console.log('Recreating call as initiator, reusing existing call document');

    if (!this.callDoc || !this.lastCallId) {
      console.error("No existing call document to reuse!");
      // Fallback to creating a new call
      return await this.createCall();
    }

    try {
      const offerCandidates = collection(this.callDoc, "offerCandidates");
      const answerCandidates = collection(this.callDoc, "answerCandidates");

      // Initialize NEW peer connection
      const pc = await this.initializePeerConnection();

      // Collect ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(offerCandidates, event.candidate.toJSON());
        }
      };

      // Create NEW offer
      const offerDescription = await pc.createOffer();
      await pc.setLocalDescription(offerDescription);

      const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
      };

      // UPDATE existing call document with new offer
      // console.log('Updating existing call document with new offer');
      await updateDoc(this.callDoc, {
        offer,
        answer: null, // Clear old answer
        updatedAt: serverTimestamp(),
        status: "reconnecting",
      });

      // Listen for remote answer (should already be set up, but reset just in case)
      this.unsubscribeCallDoc = onSnapshot(this.callDoc, (snapshot) => {
        const data = snapshot.data();
        if (!pc.currentRemoteDescription && data?.answer) {
          // console.log('Received answer during reconnection');
          const answerDescription = new RTCSessionDescription(data.answer);
          pc.setRemoteDescription(answerDescription);
        }
      });

      // Listen for remote ICE candidates
      this.unsubscribeAnswerCandidates = onSnapshot(
        answerCandidates,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const candidate = new RTCIceCandidate(change.doc.data());
              if (pc.signalingState !== "closed") {
                pc.addIceCandidate(candidate).catch((err) => {
                  // console.log('Error adding ICE candidate:', err.message);
                });
              }
            }
          });
        }
      );

      this.startHeartbeat();
      // console.log('Reconnection offer created and sent, using call ID:', this.lastCallId);
      return this.lastCallId;
    } catch (error) {
      console.error("Error recreating call:", error);
      throw error;
    }
  }

  // Rejoin call for receiver
  async rejoinCall(callId) {
    // console.log('Rejoining call as receiver, callId:', callId);
    await this.joinCall(callId);
    return true;
  }

  // Clean up connection for reconnection (keep Firestore docs)
  async cleanupConnectionForReconnect() {
    // console.log('Cleaning up connection for reconnection');

    // CRITICAL: Unsubscribe from Firestore listeners BEFORE closing connections
    // This prevents ICE candidates from being added to a closed connection
    if (this.unsubscribeCallDoc) {
      // console.log('Unsubscribing from call document');
      this.unsubscribeCallDoc();
      this.unsubscribeCallDoc = null;
    }

    if (this.unsubscribeAnswerCandidates) {
      // console.log('Unsubscribing from answer candidates');
      this.unsubscribeAnswerCandidates();
      this.unsubscribeAnswerCandidates = null;
    }

    if (this.unsubscribeOfferCandidates) {
      // console.log('Unsubscribing from offer candidates');
      this.unsubscribeOfferCandidates();
      this.unsubscribeOfferCandidates = null;
    }

    // Close data channel
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch (e) {
        // console.log('Error closing data channel:', e.message);
      }
      this.dataChannel = null;
    }

    // Close peer connection
    if (this.localConnection) {
      try {
        this.localConnection.close();
      } catch (e) {
        // console.log('Error closing peer connection:', e.message);
      }
      this.localConnection = null;
    }

    // Keep the callDoc reference - we'll reuse it for reconnection
    // Don't delete Firestore documents during reconnection
  }

  // Clean up connection completely (including Firestore documents)
  async cleanupConnection() {
    // Close data channel
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    // Close peer connection
    if (this.localConnection) {
      this.localConnection.close();
      this.localConnection = null;
    }

    // Unsubscribe from Firestore listeners
    if (this.unsubscribeCallDoc) {
      this.unsubscribeCallDoc();
      this.unsubscribeCallDoc = null;
    }

    if (this.unsubscribeAnswerCandidates) {
      this.unsubscribeAnswerCandidates();
      this.unsubscribeAnswerCandidates = null;
    }

    if (this.unsubscribeOfferCandidates) {
      this.unsubscribeOfferCandidates();
      this.unsubscribeOfferCandidates = null;
    }
  }

  // Start heartbeat mechanism
  startHeartbeat() {
    // Stop any existing heartbeat to prevent multiple intervals
    this.stopHeartbeat();

    // Reset heartbeat received timestamp
    this.lastHeartbeatReceived = Date.now();

    // Send heartbeats every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.dataChannel && this.dataChannel.readyState === "open") {
        console.log(
          "[SYNC DEBUG] Sending heartbeat, dataChannel state:",
          this.dataChannel.readyState,
          "role:",
          this.lastRole,
          "bufferedAmount:",
          this.dataChannel.bufferedAmount
        );
        try {
          this.dataChannel.send(
            JSON.stringify({
              type: "heartbeat",
              timestamp: Date.now(),
            })
          );
          console.log("[SYNC DEBUG] Heartbeat sent successfully");
        } catch (e) {
          console.error("[SYNC DEBUG] Heartbeat send FAILED:", e);
        }
        // console.log('Heartbeat sent');
      } else {
        console.warn(
          "[SYNC DEBUG] Heartbeat skipped - dataChannel not open:",
          this.dataChannel?.readyState
        );
      }
    }, 30000);

    // Check for heartbeat timeout every 10 seconds (separate from sending)
    this.heartbeatTimeoutChecker = setInterval(() => {
      const now = Date.now();
      const timeSinceLastHeartbeat = now - this.lastHeartbeatReceived;

      // Only trigger timeout if we haven't received heartbeat in 90 seconds AND data channel is supposed to be open AND no graceful disconnect
      if (
        timeSinceLastHeartbeat > 90000 &&
        this.dataChannel &&
        this.dataChannel.readyState === "open" &&
        !this.gracefulDisconnectReceived
      ) {
        // console.log('Heartbeat timeout detected - no response for', timeSinceLastHeartbeat, 'ms');
        this.scheduleConnectionLossHandler();
      }
    }, 10000); // Check every 10 seconds
  }

  // Send heartbeat response
  sendHeartbeatResponse() {
    if (this.dataChannel && this.dataChannel.readyState === "open") {
      console.log(
        "[SYNC DEBUG] Sending heartbeatResponse, dataChannel state:",
        this.dataChannel.readyState,
        "role:",
        this.lastRole
      );
      try {
        this.dataChannel.send(
          JSON.stringify({
            type: "heartbeatResponse",
            timestamp: Date.now(),
          })
        );
        console.log("[SYNC DEBUG] heartbeatResponse sent successfully");
      } catch (e) {
        console.error("[SYNC DEBUG] heartbeatResponse send FAILED:", e);
      }
    } else {
      console.warn(
        "[SYNC DEBUG] Cannot send heartbeatResponse - channel not ready:",
        this.dataChannel?.readyState
      );
    }
  }

  // Stop heartbeat mechanism
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeoutChecker) {
      clearInterval(this.heartbeatTimeoutChecker);
      this.heartbeatTimeoutChecker = null;
    }
  }

  // Notify that reconnection failed
  notifyReconnectionFailed() {
    // console.log('All reconnection attempts failed');
    if (this.onConnectionStateChange) {
      this.onConnectionStateChange("reconnection-failed");
    }
  }

  // Send graceful disconnect notification
  sendDisconnectNotification() {
    try {
      if (this.dataChannel && this.dataChannel.readyState === "open") {
        // console.log('Sending graceful disconnect notification');
        this.dataChannel.send(
          JSON.stringify({
            type: "disconnect",
            data: {
              type: "gracefulDisconnect",
              message: "Player left the game",
            },
            timestamp: Date.now(),
          })
        );
        return true;
      } else {
        // console.log('Data channel not available for disconnect notification');
        return false;
      }
    } catch (error) {
      // console.log('Could not send disconnect notification (channel likely closed):', error.message);
      return false;
    }
  }

  // Send game state through data channel
  sendGameState(gameState) {
    if (this.dataChannel && this.dataChannel.readyState === "open") {
      const sendTimestamp = Date.now();
      const payload = JSON.stringify({
        type: "gameState",
        data: gameState,
        timestamp: sendTimestamp,
      });

      // Check buffer status before sending
      const bufferedAmount = this.dataChannel.bufferedAmount;
      console.log(
        "[SYNC DEBUG] WebRTC sendGameState - payload size:",
        payload.length,
        "bytes, dataChannel state:",
        this.dataChannel.readyState,
        "dataChannel label:",
        this.dataChannel.label,
        "role:",
        this.lastRole,
        "bufferedAmount:",
        bufferedAmount
      );

      try {
        this.dataChannel.send(payload);
        console.log(
          "[WebRTC Latency] Game state sent at:",
          sendTimestamp,
          "- send successful, bufferedAmount after:",
          this.dataChannel.bufferedAmount
        );
      } catch (error) {
        console.error("[SYNC DEBUG] Error sending game state:", error);
      }

      // Update heartbeat timestamp since we successfully sent data (connection is alive)
      this.lastHeartbeatReceived = Date.now();
    } else {
      console.warn(
        "[SYNC DEBUG] Data channel not ready for sending - state:",
        this.dataChannel?.readyState,
        "role:",
        this.lastRole
      );
    }
  }

  // Send move through data channel
  sendMove(move) {
    if (this.dataChannel && this.dataChannel.readyState === "open") {
      const sendTimestamp = Date.now();
      this.dataChannel.send(
        JSON.stringify({
          type: "move",
          data: move,
          timestamp: sendTimestamp,
        })
      );
      console.log("[WebRTC Latency] Move sent at:", sendTimestamp);
      // Update heartbeat timestamp since we successfully sent data (connection is alive)
      this.lastHeartbeatReceived = Date.now();
    } else {
      console.warn("Data channel not ready for sending");
    }
  }

  // Send debug/test message through data channel
  sendDebugMessage(message) {
    if (this.dataChannel && this.dataChannel.readyState === "open") {
      const debugMsg = {
        type: "debug",
        data: message,
        timestamp: Date.now(),
      };
      this.dataChannel.send(JSON.stringify(debugMsg));
      // Update heartbeat timestamp since we successfully sent data (connection is alive)
      this.lastHeartbeatReceived = Date.now();
      return true;
    } else {
      console.warn("Data channel not ready for sending");
      return false;
    }
  }

  // Request current game state from peer (used after reconnection)
  requestGameStateSync() {
    console.log(
      "[SYNC DEBUG] requestGameStateSync called, dataChannel state:",
      {
        hasDataChannel: !!this.dataChannel,
        state: this.dataChannel?.readyState,
        label: this.dataChannel?.label,
        role: this.lastRole,
        bufferedAmount: this.dataChannel?.bufferedAmount,
      }
    );
    if (this.dataChannel && this.dataChannel.readyState === "open") {
      try {
        const payload = JSON.stringify({
          type: "requestGameStateSync",
          timestamp: Date.now(),
        });
        this.dataChannel.send(payload);
        console.log(
          "[SYNC DEBUG] requestGameStateSync sent successfully, bytes:",
          payload.length
        );
        // Update heartbeat timestamp since we successfully sent data (connection is alive)
        this.lastHeartbeatReceived = Date.now();
      } catch (error) {
        console.error("[SYNC DEBUG] requestGameStateSync send FAILED:", error);
      }
    } else {
      console.warn(
        "[SYNC DEBUG] requestGameStateSync - dataChannel not ready!"
      );
    }
  }

  // Send ping for latency measurement
  sendPing() {
    if (this.dataChannel && this.dataChannel.readyState === "open") {
      const pingId =
        Date.now().toString() + Math.random().toString(36).substring(7);
      const timestamp = Date.now();

      // Store the ping timestamp
      this.pendingPings.set(pingId, timestamp);

      // Send ping message
      this.dataChannel.send(
        JSON.stringify({
          type: "ping",
          pingId: pingId,
          timestamp: timestamp,
        })
      );

      // Clean up old pings after 5 seconds (in case pong never arrives)
      setTimeout(() => {
        if (this.pendingPings.has(pingId)) {
          this.pendingPings.delete(pingId);
          // Notify timeout
          if (this.onLatencyMeasured) {
            this.onLatencyMeasured({ success: false, error: "Timeout" });
          }
        }
      }, 5000);

      return pingId;
    }
    return null;
  }

  // Send pong in response to ping
  sendPong(pingId) {
    if (this.dataChannel && this.dataChannel.readyState === "open") {
      this.dataChannel.send(
        JSON.stringify({
          type: "pong",
          pingId: pingId,
          timestamp: Date.now(),
        })
      );
    }
  }

  // Handle pong received
  handlePongReceived(pingId) {
    if (this.pendingPings.has(pingId)) {
      const pingTimestamp = this.pendingPings.get(pingId);
      const now = Date.now();
      const rtt = now - pingTimestamp;
      const latency = rtt / 2; // Latency is half of RTT

      // Clean up
      this.pendingPings.delete(pingId);

      // Forward latency result through normal message channel
      if (this.onDataChannelMessage) {
        this.onDataChannelMessage({
          type: "latencyResult",
          data: {
            success: true,
            latency: latency,
            rtt: rtt,
          },
          timestamp: now,
        });
      }
    }
  }

  // Deprecated: Set callback for latency measurement
  // Latency results are now forwarded through onDataChannelMessage
  setLatencyMeasuredCallback(callback) {
    // Method kept for backwards compatibility but not used
  }

  // Disconnect and cleanup
  async disconnect() {
    try {
      // Reset reconnection state
      this.isReconnecting = false;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 2000;

      // Clear timeouts
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      if (this.connectionLossTimeout) {
        clearTimeout(this.connectionLossTimeout);
        this.connectionLossTimeout = null;
      }

      if (this.reconnectionTimeout) {
        clearTimeout(this.reconnectionTimeout);
        this.reconnectionTimeout = null;
      }

      // Stop heartbeat
      this.stopHeartbeat();

      // Send graceful disconnect notification before closing
      // Try multiple times to ensure it gets sent
      let notificationSent = false;
      for (let i = 0; i < 3 && !notificationSent; i++) {
        notificationSent = this.sendDisconnectNotification();
        if (!notificationSent && i < 2) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      // Give more time for the message to be delivered
      if (notificationSent) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // Close data channel
      if (this.dataChannel) {
        this.dataChannel.close();
        this.dataChannel = null;
      }

      // Close peer connection
      if (this.localConnection) {
        this.localConnection.close();
        this.localConnection = null;
      }

      // Unsubscribe from Firestore listeners
      if (this.unsubscribeCallDoc) {
        this.unsubscribeCallDoc();
        this.unsubscribeCallDoc = null;
      }

      if (this.unsubscribeAnswerCandidates) {
        this.unsubscribeAnswerCandidates();
        this.unsubscribeAnswerCandidates = null;
      }

      if (this.unsubscribeOfferCandidates) {
        this.unsubscribeOfferCandidates();
        this.unsubscribeOfferCandidates = null;
      }

      // Delete call document from Firestore
      if (this.callDoc) {
        await deleteDoc(this.callDoc);
        this.callDoc = null;
      }

      // Reset state
      this.lastCallId = null;
      this.lastRole = null;
      this.gracefulDisconnectReceived = false;

      // console.log('WebRTC connection disconnected and cleaned up');
    } catch (error) {
      console.error("Error during disconnect:", error);
    }
  }

  // Set callback for connection state changes
  setConnectionStateCallback(callback) {
    this.onConnectionStateChange = callback;
  }

  // Set callback for data channel messages
  setDataChannelMessageCallback(callback) {
    this.onDataChannelMessage = callback;
  }

  // Set callback for when data channel opens
  setDataChannelOpenCallback(callback) {
    this.onDataChannelOpen = callback;
  }

  // Get current connection state
  getConnectionState() {
    return this.localConnection
      ? this.localConnection.connectionState
      : "closed";
  }
}

export default WebRTCSignalingService;
