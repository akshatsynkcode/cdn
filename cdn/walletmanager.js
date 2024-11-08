export class WalletManager {
    constructor(extensionId) {
        if (!extensionId) {
            throw new Error("Extension ID is missing. Please provide a valid Extension ID.");
        }
        this.extensionId = extensionId;
    }

    async connectWallet() {
        try {
            const response = await this.sendMessageToExtension("request_connection");
            if (response && response.success) {
                console.log("Approval popup opened successfully. Waiting for user approval...");
                const authToken = response.authToken;
                if (authToken) {
                    console.log("User approved. Auth token received:", authToken);
                    return authToken;
                } else {
                    throw new Error("User did not approve the transaction.");
                }
            } else {
                throw new Error(response.error || "Failed to open approval popup.");
            }
        } catch (error) {
            console.error("Error connecting wallet:", error);
            this.showErrorMessage(error.message || "An error occurred during wallet connection.");
        }
    }

    async detectExtension() {
        try {
            const response = await this.sendMessageToExtension('detect_extension');
            return response && response.success;
        } catch (error) {
            console.error("Error detecting wallet extension:", error);
            return false;
        }
    }

    async getAuth() {
        try {
            const response = await this.sendMessageToExtension('check_auth');
            return response;
        } catch (error) {
            console.error("Error checking auth:", error);
            return false;
        }
    }

    async fetchAndUpdateBalance() {
        const loader = document.getElementById('balance-loader');
        if (loader) {
            loader.style.display = 'inline-block'; // Show loader before fetching balance
        }

        try {
            const authResponse = await this.getAuth(); // Consistent way to get the auth token
            if (!authResponse || !authResponse.authToken) {
                console.error('Authorization token is missing or invalid');
                return;
            }

            const authToken = authResponse.authToken;

            const response = await fetch('https://wallet-api.dubaicustoms.network/api/ext-balance', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (response.ok) {
                const { balance } = await response.json();
                const balanceElement = document.getElementById('balance');
                if (balanceElement) {
                    balanceElement.textContent = `AED ${this.formatAmount(parseFloat(balance).toFixed(3))}`;
                } else {
                    console.error('Balance element not found in the DOM');
                }
            } else if (response.status === 401) {
                console.error('Token expired or invalid, redirecting to login.');
            } else {
                console.error('Failed to fetch balance:', response.statusText);
            }
        } catch (error) {
            console.error('Error fetching balance:', error);
        } finally {
            if (loader) {
                loader.style.display = 'none'; // Hide loader after balance is fetched
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
    async sendTransactionRequest(username, fromWalletAddress, toWalletAddress, amount, authToken, transactionId, url) {
        try {
            const response = await this.sendMessageToExtension('transaction_request', {
                toAddress: toWalletAddress,
                amount,
                fromAddress: fromWalletAddress,
                transaction_id: transactionId,
                username,
                authToken,
                url
            });

            if (response && response.success) {
                console.log("Transaction request sent successfully:", response);
                return response;
            } else {
                throw new Error(response.error || "Failed to send transaction request.");
            }
        } catch (error) {
            console.error("Error in sendTransactionRequest:", error);
            this.showErrorMessage(error.message || "An error occurred while sending the transaction request.");
        }
    }

    sendMessageToExtension(action, data = {}) {
        return new Promise((resolve, reject) => {
            console.log(`Sending message to extension with action: ${action}`, { action, ...data });

            chrome.runtime.sendMessage(this.extensionId, { action, ...data }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Error in sendMessageToExtension:", chrome.runtime.lastError.message);
                    return reject(new Error(chrome.runtime.lastError.message));
                }
                console.log("Response received from background:", response);
                resolve(response);
            });
        });
    }

    showErrorMessage(message) {
        Swal.fire({
            text: message,
            icon: "warning",
            confirmButtonColor: "#3085d6",
            confirmButtonText: 'OK'
        });
    }



    formatAmount(amount) {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }
}
