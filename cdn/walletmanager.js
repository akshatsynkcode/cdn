export class WalletManager {
  constructor(extensionId) {
    if (!extensionId) {
      throw new Error(
        "Extension ID is missing. Please provide a valid Extension ID."
      );
    }
    this.extensionId = extensionId;
  }

  async connectWallet() {
    try {
      const response = await this.sendMessageToExtension("request_connection");
      if (response && response.success) {
        console.log(
          "Approval popup opened successfully. Waiting for user approval..."
        );
        const authToken = response.authToken;
        if (authToken) {
          console.log("User approved. Auth token received:", authToken);
          return authToken;
        } else {
          throw new Error("User did not approve the transaction.");
        }
      } else {
        throw new Error(response.error || "Connection Rejected By The User.");
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
      this.showErrorMessage(
        error.message || "An error occurred during wallet connection."
      );
    }
  }
  async detectExtension() {
    try {
      const response = await this.sendMessageToExtension("detect_extension");
      return response && response.success;
    } catch (error) {
      console.error("Error detecting wallet extension:", error);
      return false;
    }
  }

  /**
   * Get the current auth token.
   * Calls the 'getauth' action in the background script to retrieve the token.
   */
  async getCurrentAuthToken() {
    try {
      const response = await this.sendMessageToExtension("get_auth");
      if (response && response.success && response.authToken) {
        console.log("Current Auth Token:", response.authToken);
        return response.authToken;
      } else {
        throw new Error(response.error || "Auth token not available.");
      }
    } catch (error) {
      console.error("Error fetching current auth token:", error);
      this.showErrorMessage(
        error.message || "An error occurred while fetching the auth token."
      );
      return null;
    }
  }


  async getAuth() {
    try {
      const response = await this.sendMessageToExtension("check_auth");
      return response;
    } catch (error) {
      console.error("Error checking auth:", error);
      return false;
    }
  }

  async fetchAndUpdateBalance() {
    const loader = document.getElementById("balance-loader");
    try {
      if (loader) {
        loader.style.display = "inline-block"; // Show loader before fetching balance
      }

      const response = await this.sendMessageToExtension("getbalance");
      if (response && response.success) {
        console.log("Balance fetched:", response.balance);
        return response.balance; // Return the balance for further use
      } else {
        console.error("Failed to fetch balance. Response:", response);
        return false;
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
      return false;
    } finally {
      if (loader) {
        loader.style.display = "none"; // Hide loader after fetching balance
      }
    }
  }

  /**
   * Send a transaction request to the Chrome extension.
   * @param {string} username - The user's username.
   * @param {string} fromWalletAddress - The sender's wallet address.
   * @param {string} toWalletAddress - The recipient's wallet address.
   * @param {number} amount - The transaction amount.
   * @param {string} authToken - The user's authorization token.
   * @param {string} transactionId - The transaction ID.
   * @param {string} url - The URL of Pusher.
   */
  async sendTransactionRequest(
    username,
    fromWalletAddress,
    toWalletAddress,
    amount,
    authToken,
    transactionId,
    url
  ) {
    try {
      const response = await this.sendMessageToExtension(
        "transaction_request",
        {
          toAddress: toWalletAddress,
          amount,
          fromAddress: fromWalletAddress,
          transaction_id: transactionId,
          username,
          authToken,
          url,
        }
      );

      if (response && response.success) {
        console.log("Transaction request sent successfully:", response);
        return response;
      } else {
        throw new Error(
          response.error || "Failed to send transaction request."
        );
      }
    } catch (error) {
      console.error("Error in sendTransactionRequest:", error);
      this.showErrorMessage(
        error.message ||
          "An error occurred while sending the transaction request."
      );
    }
  }

  sendMessageToExtension(action, data = {}) {
    return new Promise((resolve, reject) => {
      console.log(`Sending message to extension with action: ${action}`, {
        action,
        ...data,
      });

      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      let resolved = false;

      function handleMessage(event) {
        if (
          event.source !== window ||
          !event.data ||
          event.data.type !== "FROM_EXTENSION" ||
          event.data.requestId !== requestId
        ) {
          return;
        }

        window.removeEventListener("message", handleMessage);
        resolved = true;

        if (event.data.error) {
          console.error("Error in sendMessageToExtension:", event.data.error);
          return reject(new Error(event.data.error));
        }

        console.log("Response received from extension:", event.data.payload);
        resolve(event.data.payload);
      }

      window.addEventListener("message", handleMessage);

      window.postMessage(
        {
          type: "TO_EXTENSION",
          action,
          payload: data,
          requestId
        },
        "*"
      );

      const maxWaitTime = 10000; // 10 seconds
      setTimeout(() => {
        if (action == "detect_extension"  && !resolved) {
            window.removeEventListener("message", handleMessage);
            console.error("No response from extension after waiting.");
            reject(new Error("Extension is not found or took too long to respond"));
        }
      }, maxWaitTime);
    });
  }

  showErrorMessage(message) {
    if (message.includes('asynchronous')){
      message = "Please ensure extension is installed and enabled";
    }
    else if (message.includes('response')){
      message = "Please login again or contact the admin if the problem persists";
    }
    Swal.fire({
      text: message,
      icon: "warning",
      confirmButtonColor: "#3085d6",
      confirmButtonText: "OK",
    });
  }

  async formatAmount(amount) {
    // Convert the amount to a number
    amount = parseFloat(amount);

    // Check if the amount is a number after conversion
    if (isNaN(amount)) return "0"; // Return default if it's not a valid number

    // Handle numbers greater than 1,000 and format them accordingly
    if (amount >= 1e9) {
      return (amount / 1e9).toFixed(1) + "B"; // Billion
    } else if (amount >= 1e6) {
      return (amount / 1e6).toFixed(1) + "M"; // Million
    } else if (amount >= 1e3) {
      return (amount / 1e3).toFixed(1) + "K"; // Thousand
    } else {
      return amount.toFixed(2); // If it's less than 1,000, show the number with two decimals
    }
  }
}

let current_window = window.location.href;

window.addEventListener("beforeunload", () => {
  const action = "tab_refreshed";
  debugger;
  const data = { tabId: window.tabId };
  // chrome.runtime.sendMessage({ action: "tab_refreshed", tabId: window.tabId });
  if (current_window.includes('index') || current_window.includes('connect')){
    window.postMessage(
      {
        type: "TO_EXTENSION",
        action,
        payload: data,
      },
      "*"
    );
  }
});
