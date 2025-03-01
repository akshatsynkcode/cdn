/**
 * Manages wallet connections and interactions through a Chrome extension.
 */
export class WalletManager {
  /**
   * Initializes a new instance of WalletManager.
   * @param {string} extensionId - The unique identifier for the Chrome extension.
   * @throws {Error} If the extension ID is not provided.
   */
  constructor(extensionId) {
    if (!extensionId) {
      throw new Error("Extension ID is missing. Please provide a valid Extension ID.");
    }
    this.extensionId = extensionId; // Store the extension ID for later use.
  }

  /**
   * Requests connection to the user's wallet via the extension.
   * @returns {Promise<string>} A promise that resolves with the auth token if user approves.
   * @throws {Error} If connection is not approved or fails.
   */
  async connectWallet() {
    try {
      console.log("Requesting connection to wallet...");
      const response = await this.sendMessageToExtension("request_connection");
      console.log(response, "response");
      if (response && response.success) {
        console.log("Approval popup opened successfully. Waiting for user approval...");
        const authToken = response.authToken;
        if (authToken) {
          console.log("User approved. Auth token received:", authToken);
          return authToken;
        } else {

          throw new Error("User did not approve the Connection.");
        }
      } else {
        throw new Error(response.error || "Connection Rejected By The User.");
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
      this.showErrorMessage(error.message || "An error occurred during wallet connection.");
    }
  }

  /**
   * Detects if the wallet extension is installed and available.
   * @returns {Promise<boolean>} A promise that resolves to true if the extension is detected, false otherwise.
   */
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
   * Retrieves the current authentication token from the extension.
   * @returns {Promise<string|null>} A promise that resolves to the current auth token or null if not available.
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
      this.showErrorMessage(error.message || "An error occurred while fetching the auth token.");
      return null;
    }
  }

  /**
   * Wrapper function to handle authentication checks.
   * @returns {Promise<any>} A promise that resolves with the authentication check response.
   */
  async getAuth() {
    try {
      const response = await this.sendMessageToExtension("check_auth");
      return response;
    } catch (error) {
      console.error("Error checking auth:", error);
      return false;
    }
  }

  /**
   * Fetches and updates the user's balance from the wallet.
   * @returns {Promise<number|boolean>} The current balance if successful, or false if the fetch fails.
   */
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
   * Sends a transaction request to the wallet via the Chrome extension.
   * @param {string} username - The user's username.
   * @param {string} fromWalletAddress - The sender's wallet address.
   * @param {string} toWalletAddress - The recipient's wallet address.
   * @param {number} amount - The transaction amount.
   * @param {string} authToken - The user's authorization token.
   * @param {string} transactionId - The transaction ID.
   * @param {string} url - The URL of Pusher.
   * @returns {Promise<any>} A promise that resolves with the transaction response or an error if the transaction fails.
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

  /**
   * Communicates with the Chrome extension by sending messages.
   * @param {string} action - The action type to send to the extension.
   * @param {object} data - Additional data to send with the action.
   * @returns {Promise<any>} A promise that resolves with the response from the extension or rejects if an error occurs.
   */
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

  /**
   * Displays an error message to the user using a modal dialog.
   * @param {string} message - The error message to display.
   */
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
    }).then((result) => {
      if (result.isConfirmed) {
        window.location.reload();
      }
    });
  }

  /**
   * Formats a numeric amount into a more readable format with abbreviations for thousands, millions, or billions.
   * @param {string|number} amount - The amount to format.
   * @returns {string} The formatted amount.
   */
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
